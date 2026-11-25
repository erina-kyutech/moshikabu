"""記録（ブック）の保存・復元。

ブラウザの保存領域は消えることがある（iOS Safari は7日間アクセスが無いと削除する）。
そこで記録をサーバーにも置き、IDさえ分かれば別の端末からでも戻せるようにする。

ログインは求めない。代わりに推測できないUUIDを鍵として扱うため、
IDを知っている人はその記録を読み書きできる。扱うのは実在しない仮想取引の記録のみ。
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from .. import db
from ..schemas_books import BookCreatedOut, BookIn, BookOut, PositionIn, RuleIn

router = APIRouter(prefix="/api/books", tags=["books"])


def _unavailable() -> HTTPException:
    return HTTPException(
        status_code=503,
        detail={
            "code": "STORAGE_UNAVAILABLE",
            "message": "記録の保存先に接続できませんでした。この端末のブラウザには保存されています。",
        },
    )


def _not_found() -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={"code": "BOOK_NOT_FOUND", "message": "その記録IDは見つかりませんでした。"},
    )


def _parse_id(book_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(book_id)
    except ValueError:
        raise _not_found()


@router.post("", response_model=BookCreatedOut)
@router.post("/", response_model=BookCreatedOut)
def create_book() -> BookCreatedOut:
    """新しい記録IDを発行する。"""
    if not db.configured():
        raise _unavailable()
    book_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    try:
        db.ensure_schema()
        with db.connect() as conn, conn.cursor() as cur:
            cur.execute(
                "insert into books (id, created_at, updated_at) values (%s, %s, %s)",
                (book_id, now, now),
            )
    except db.DatabaseUnavailable:
        raise _unavailable()
    return BookCreatedOut(id=str(book_id), updatedAt=now)


@router.get("/{book_id}", response_model=BookOut)
def get_book(book_id: str) -> BookOut:
    """記録の中身をまとめて返す。"""
    if not db.configured():
        raise _unavailable()
    bid = _parse_id(book_id)
    try:
        db.ensure_schema()
        with db.connect() as conn, conn.cursor() as cur:
            cur.execute("select updated_at from books where id = %s", (bid,))
            row = cur.fetchone()
            if row is None:
                raise _not_found()
            updated_at = row[0]

            cur.execute(
                """
                select id, ticker, name, market, currency, buy_date, buy_at, buy_price,
                       shares, invested, status, sell_date, sell_at, sell_price, proceeds,
                       schema_version
                  from positions
                 where book_id = %s
                 order by buy_at desc
                """,
                (bid,),
            )
            positions = [
                PositionIn(
                    id=str(r[0]),
                    ticker=r[1],
                    name=r[2],
                    market=r[3],
                    currency=r[4],
                    buyDate=r[5].isoformat(),
                    buyAt=r[6],
                    buyPrice=r[7],
                    shares=r[8],
                    invested=r[9],
                    status=r[10],
                    sellDate=r[11].isoformat() if r[11] else None,
                    sellAt=r[12],
                    sellPrice=r[13],
                    proceeds=r[14],
                    schemaVersion=r[15],
                )
                for r in cur.fetchall()
            ]

            cur.execute(
                "select id, name, conditions, universe, created_at from rules"
                " where book_id = %s order by created_at desc",
                (bid,),
            )
            rules = [
                RuleIn(
                    id=str(r[0]),
                    name=r[1],
                    conditions=r[2],
                    universe=r[3],
                    createdAt=r[4],
                )
                for r in cur.fetchall()
            ]

            cur.execute("select session from day_trade_sessions where book_id = %s", (bid,))
            row = cur.fetchone()
            day_trade = row[0] if row else None
    except db.DatabaseUnavailable:
        raise _unavailable()

    return BookOut(
        id=str(bid), updatedAt=updated_at, positions=positions, rules=rules, dayTrade=day_trade
    )


@router.put("/{book_id}", response_model=BookCreatedOut)
def put_book(book_id: str, body: BookIn) -> BookCreatedOut:
    """記録をまるごと置き換える。

    差分同期にすると端末をまたいだときの整合が複雑になるため、
    「その端末の内容で全体を上書きする」単純な方式にしている。
    データ量が小さい（数十件程度）ので実用上の問題はない。
    """
    if not db.configured():
        raise _unavailable()
    bid = _parse_id(book_id)
    now = datetime.now(timezone.utc)
    try:
        db.ensure_schema()
        with db.connect() as conn, conn.cursor() as cur:
            cur.execute(
                "insert into books (id, created_at, updated_at) values (%s, %s, %s)"
                " on conflict (id) do update set updated_at = excluded.updated_at",
                (bid, now, now),
            )

            cur.execute("delete from positions where book_id = %s", (bid,))
            for p in body.positions:
                cur.execute(
                    """
                    insert into positions
                      (id, book_id, ticker, name, market, currency, buy_date, buy_at, buy_price,
                       shares, invested, status, sell_date, sell_at, sell_price, proceeds,
                       schema_version)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        _as_uuid(p.id),
                        bid,
                        p.ticker,
                        p.name,
                        p.market,
                        p.currency,
                        p.buyDate,
                        p.buyAt,
                        p.buyPrice,
                        p.shares,
                        p.invested,
                        p.status,
                        p.sellDate,
                        p.sellAt,
                        p.sellPrice,
                        p.proceeds,
                        p.schemaVersion,
                    ),
                )

            cur.execute("delete from rules where book_id = %s", (bid,))
            for r in body.rules:
                cur.execute(
                    "insert into rules (id, book_id, name, conditions, universe, created_at)"
                    " values (%s, %s, %s, %s, %s, %s)",
                    (
                        _as_uuid(r.id),
                        bid,
                        r.name,
                        json.dumps(r.conditions),
                        r.universe,
                        r.createdAt or now,
                    ),
                )

            if body.dayTrade is None:
                cur.execute("delete from day_trade_sessions where book_id = %s", (bid,))
            else:
                cur.execute(
                    "insert into day_trade_sessions (book_id, session, updated_at)"
                    " values (%s, %s, %s)"
                    " on conflict (book_id) do update"
                    " set session = excluded.session, updated_at = excluded.updated_at",
                    (bid, json.dumps(body.dayTrade), now),
                )
    except db.DatabaseUnavailable:
        raise _unavailable()

    return BookCreatedOut(id=str(bid), updatedAt=now)


def _as_uuid(value: str) -> uuid.UUID:
    """ブラウザ側で作ったIDをそのまま使う。UUID でなければ決まった規則で変換する。"""
    try:
        return uuid.UUID(value)
    except ValueError:
        return uuid.uuid5(uuid.NAMESPACE_URL, f"moshikabu:{value}")
