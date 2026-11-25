"""記録（仮想ポートフォリオ・マイルール・デイトレ練習）の保存先。

ブラウザの localStorage だけに置いていると、
iOS Safari が「7日間サイトを開かないと保存データを削除する」仕様などで
記録が消えてしまうため、サーバー側（Neon / PostgreSQL）にも保存する。

DATABASE_URL が未設定のときはサーバー保存を無効にし、
フロントはブラウザ内保存だけで動く（開発時に DB を用意しなくてよいようにするため）。
"""
from __future__ import annotations

import os
import threading
from contextlib import contextmanager
from typing import Iterator

_lock = threading.Lock()
_schema_ready = False


class DatabaseUnavailable(RuntimeError):
    """DATABASE_URL が無い、または接続できない。"""


def configured() -> bool:
    return bool(os.getenv("DATABASE_URL"))


def _dsn() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise DatabaseUnavailable("DATABASE_URL が設定されていません。")
    return url


@contextmanager
def connect() -> Iterator["psycopg.Connection"]:  # noqa: F821
    """接続を1つ開いて返す。

    サーバーレスでは実行のたびにプロセスが立ち上がるため、
    プールは持たず、Neon のプーラー経由で短い接続を都度張る。
    """
    try:
        import psycopg
    except ImportError as exc:  # pragma: no cover - 依存が入っていない環境
        raise DatabaseUnavailable("psycopg がインストールされていません。") from exc

    try:
        # Neon は複数のIPに解決されるため、待ち時間は「秒数 x 候補数」になる。
        # サーバーレスの実行時間を食い潰さないよう短めにする。
        conn = psycopg.connect(_dsn(), connect_timeout=5)
    except psycopg.Error as exc:
        raise DatabaseUnavailable(str(exc)) from exc

    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


SCHEMA = """
create table if not exists books (
    id uuid primary key,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists positions (
    id uuid primary key,
    book_id uuid not null references books(id) on delete cascade,
    ticker text not null,
    name text not null,
    market text not null,
    currency text not null,
    buy_date date not null,
    buy_at timestamptz not null,
    buy_price double precision not null,
    shares double precision not null,
    invested double precision not null,
    status text not null,
    sell_date date,
    sell_at timestamptz,
    sell_price double precision,
    proceeds double precision,
    schema_version integer not null default 1,
    created_at timestamptz not null default now()
);
create index if not exists positions_book_idx on positions (book_id, buy_at desc);

create table if not exists rules (
    id uuid primary key,
    book_id uuid not null references books(id) on delete cascade,
    name text not null,
    conditions jsonb not null,
    universe text not null default 'jp-core30',
    created_at timestamptz not null default now()
);
create index if not exists rules_book_idx on rules (book_id, created_at desc);

create table if not exists day_trade_sessions (
    book_id uuid primary key references books(id) on delete cascade,
    session jsonb not null,
    updated_at timestamptz not null default now()
);
"""


def ensure_schema() -> None:
    """テーブルが無ければ作る（プロセスごとに1回だけ確認する）。"""
    global _schema_ready
    if _schema_ready:
        return
    with _lock:
        if _schema_ready:
            return
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(SCHEMA)
        _schema_ready = True


def reset_schema_cache() -> None:
    """テスト用。次回アクセス時にスキーマ確認をやり直す。"""
    global _schema_ready
    with _lock:
        _schema_ready = False
