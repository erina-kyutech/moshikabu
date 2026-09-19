"""複数銘柄比較・積立投資・一括 vs 積立 のエンドポイント。

株価の取得は既存の MarketDataProvider（＋TTLキャッシュ）をそのまま再利用する。
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query

from ..providers import get_provider
from ..providers.base import (
    MarketDataError,
    PricePoint,
    Split,
    SymbolInfo,
    SymbolNotFoundError,
)
from ..schemas import SplitOut
from ..schemas_strategies import (
    ComparisonFailureOut,
    ComparisonItemOut,
    ComparisonOut,
    LotOut,
    RecurringOut,
    RecurringPointOut,
    SeriesRowOut,
    StrategyOut,
    StrategyPointOut,
    StrategySideOut,
)
from ..services import fx as fx_service
from ..services.simulation import SimulationError, downsample
from ..services.strategies import (
    Money,
    contribution_window_end,
    identity_money,
    make_price_lookup,
    make_rate_lookup,
    months_between,
    simulate_lump_investment,
    simulate_recurring,
)
from ..services.search import resolve
from ..symbols import describe
from ..symbols import meta as symbol_meta

router = APIRouter(prefix="/api/simulate", tags=["simulate"])

MAX_COMPARE_TICKERS = 10
BASE_JPY = "JPY"
BASE_LOCAL = "LOCAL"


def _bad_input(message: str) -> HTTPException:
    return HTTPException(status_code=400, detail={"code": "BAD_INPUT", "message": message})


def _not_found(ticker: str) -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={"code": "SYMBOL_NOT_FOUND", "message": f"銘柄が見つかりませんでした（{ticker}）"},
    )


def _upstream() -> HTTPException:
    return HTTPException(
        status_code=502,
        detail={
            "code": "UPSTREAM_ERROR",
            "message": "株価データを取得できませんでした。しばらくしてからもう一度お試しください。",
        },
    )


def _normalize_base(base: str) -> str:
    b = (base or BASE_JPY).upper()
    if b not in (BASE_JPY, BASE_LOCAL):
        raise _bad_input("通貨の指定が不正です。")
    return b


def _money_for(currency: str, base: str, start: date) -> Money:
    """銘柄の通貨と表示基準から換算器を作る。"""
    if base == BASE_LOCAL or currency == BASE_JPY:
        return identity_money(currency)

    points = fx_service.rate_history("usdjpy", start=start - timedelta(days=10))
    latest = fx_service.latest_rate("usdjpy") or fx_service.FALLBACK_USDJPY
    return Money(
        base_currency=BASE_JPY,
        local_currency=currency,
        rate_at=make_rate_lookup(points, latest),
    )


def _fetch(ticker: str, start: date) -> tuple[SymbolInfo, list[PricePoint], list[Split]]:
    """銘柄情報・株価履歴・分割情報をまとめて取得する。"""
    provider = get_provider()
    m = describe(resolve(ticker))
    info = provider.get_info(m.ticker)
    points = provider.get_history(m.ticker, start=start)
    if not points:
        raise SymbolNotFoundError(m.ticker)
    actions = provider.get_actions(m.ticker)
    return info, points, actions.splits


# ------------------------------------------------------------------ 銘柄比較
@router.get("/compare", response_model=ComparisonOut)
def compare(
    tickers: str = Query(..., description="カンマ区切りの銘柄（5401 / AAPL など）"),
    date_: date = Query(..., alias="date", description="投資開始日 (YYYY-MM-DD)"),
    amount: float = Query(1_000_000, gt=0, description="各銘柄に投じる金額"),
    base: str = Query(BASE_JPY, description="JPY（円換算）または LOCAL（現地通貨）"),
    fractional: bool = Query(True, description="端株を許可するか"),
    maxPoints: int = Query(300, ge=2, le=2000),
) -> ComparisonOut:
    base = _normalize_base(base)
    if date_ > date.today():
        raise _bad_input("開始日には過去の日付を指定してください。")

    raw = [t.strip() for t in tickers.split(",") if t.strip()]
    if not raw:
        raise _bad_input("比較する銘柄を1つ以上指定してください。")
    if len(raw) > MAX_COMPARE_TICKERS:
        raise _bad_input(f"比較できる銘柄は最大{MAX_COMPARE_TICKERS}件です。")

    # 同じ銘柄の重複を除く（判定は正規化後、取得には入力そのものを渡して
    # 「150A → 150A.T → 150A」のフォールバックを効かせる）
    seen: set[str] = set()
    normalized: list[str] = []
    for t in raw:
        try:
            n = symbol_meta(t).ticker
        except ValueError:
            continue
        if n not in seen:
            seen.add(n)
            normalized.append(t)

    def load(ticker: str):
        try:
            return ticker, _fetch(ticker, date_), None
        except SymbolNotFoundError:
            return ticker, None, f"銘柄が見つかりませんでした（{ticker}）"
        except MarketDataError:
            return ticker, None, f"{ticker} の株価データを取得できませんでした"

    with ThreadPoolExecutor(max_workers=min(8, len(normalized))) as pool:
        loaded = list(pool.map(load, normalized))

    items: list[ComparisonItemOut] = []
    failed: list[ComparisonFailureOut] = []
    series_by_key: dict[str, list[tuple[date, float]]] = {}
    currencies: set[str] = set()

    for index, (ticker, payload, error) in enumerate(loaded):
        if payload is None:
            failed.append(ComparisonFailureOut(ticker=ticker, message=error or "取得に失敗しました"))
            continue

        info, points, splits = payload
        m = describe(info.ticker)  # 入力（150A / 日本製鉄）ではなく解決済みのティッカー
        # 日経平均 (^N225) のように、サフィックスからは通貨を判断できない銘柄があるため
        # プロバイダが返す通貨を優先する
        currency = info.currency or m.currency
        money = _money_for(currency, base, date_)
        try:
            result = simulate_lump_investment(
                points, splits, date_, amount, money, allow_fractional=fractional
            )
        except SimulationError as exc:
            failed.append(ComparisonFailureOut(ticker=ticker, message=str(exc)))
            continue

        key = f"s{index}"
        currencies.add(currency)
        series_by_key[key] = result.series
        items.append(
            ComparisonItemOut(
                key=key,
                ticker=m.ticker,
                name=info.name,
                market=info.market,
                currency=currency,
                tradeDate=result.trade_date,
                marketClosed=result.market_closed,
                purchasePrice=result.purchase_price,
                shares=result.shares,
                sharesNow=result.shares_now,
                splitFactor=result.split_factor,
                splits=[SplitOut(date=s.date, ratio=s.ratio) for s in result.splits],
                investedLocal=result.invested_local,
                invested=result.invested,
                currentPrice=result.current_price,
                currentDate=result.current_date,
                currentValue=result.current_value,
                profit=result.profit,
                returnPct=result.return_pct,
                fxRateAtBuy=result.fx_rate_at_buy,
                fxRateNow=result.fx_rate_now,
                rank=0,
            )
        )

    if not items:
        message = failed[0].message if failed else "比較できる銘柄がありませんでした。"
        raise HTTPException(status_code=404, detail={"code": "SYMBOL_NOT_FOUND", "message": message})

    # 現在評価額が高い順にランキング
    items.sort(key=lambda i: i.currentValue, reverse=True)
    items = [i.model_copy(update={"rank": n + 1}) for n, i in enumerate(items)]

    return ComparisonOut(
        startDate=date_,
        amount=amount,
        base=base,
        baseCurrency=BASE_JPY if base == BASE_JPY else "MIXED",
        allowFractional=fractional,
        mixedCurrency=base == BASE_LOCAL and len(currencies) > 1,
        items=items,
        failed=failed,
        series=_merge_series(series_by_key, maxPoints),
    )


def _merge_series(
    series_by_key: dict[str, list[tuple[date, float]]], max_points: int
) -> list[SeriesRowOut]:
    """銘柄ごとの系列を日付でそろえる。

    日本株と米国株では営業日が違うため、値の無い日は直前の値で埋める。
    """
    if not series_by_key:
        return []

    all_dates = sorted({d for series in series_by_key.values() for d, _ in series})
    lookups = {
        key: make_price_lookup([PricePoint(date=d, close=v) for d, v in series])
        for key, series in series_by_key.items()
    }
    starts = {key: series[0][0] for key, series in series_by_key.items() if series}

    rows: list[SeriesRowOut] = []
    for d in all_dates:
        values: dict[str, float] = {}
        for key, lookup in lookups.items():
            if d < starts.get(key, d):
                continue
            value = lookup(d)
            if value is not None:
                values[key] = round(value, 2)
        if values:
            rows.append(SeriesRowOut(date=d, values=values))

    return downsample(rows, max_points)


# ------------------------------------------------------------------ 積立投資
@router.get("/recurring", response_model=RecurringOut)
def recurring(
    ticker: str = Query(..., description="銘柄（5401 / AAPL など）"),
    start: date = Query(..., description="積立開始日 (YYYY-MM-DD)"),
    amount: float = Query(30_000, gt=0, description="毎月の積立金額"),
    buyDay: str = Query("1", description="買付日：1 / 5 / 10 / 15 / 20 / 25 / end"),
    base: str = Query(BASE_JPY, description="JPY（円換算）または LOCAL（現地通貨）"),
    fractional: bool = Query(True, description="端株を許可するか"),
    maxPoints: int = Query(400, ge=2, le=2000),
) -> RecurringOut:
    base = _normalize_base(base)
    if start > date.today():
        raise _bad_input("積立開始日には過去の日付を指定してください。")

    buy_day = _parse_buy_day(buyDay)
    try:
        info, points, splits = _fetch(ticker, start)
    except ValueError:
        raise _bad_input("銘柄を入力してください。")
    except SymbolNotFoundError:
        raise _not_found(ticker)
    except MarketDataError:
        raise _upstream()
    m = describe(info.ticker)

    currency = info.currency or m.currency
    money = _money_for(currency, base, start)
    try:
        result = simulate_recurring(
            points, splits, start, amount, money, buy_day=buy_day, allow_fractional=fractional
        )
    except SimulationError as exc:
        raise HTTPException(status_code=400, detail={"code": "SIMULATION_ERROR", "message": str(exc)})

    return RecurringOut(
        ticker=m.ticker,
        name=info.name,
        market=info.market,
        currency=currency,
        base=base,
        baseCurrency=BASE_JPY if base == BASE_JPY else currency,
        startDate=start,
        buyDay=buyDay,
        monthlyAmount=amount,
        contributions=result.months,
        invested=result.invested,
        sharesNow=result.shares_now,
        currentPrice=result.current_price,
        currentDate=result.current_date,
        currentValue=result.current_value,
        profit=result.profit,
        returnPct=result.return_pct,
        periodMonths=months_between(result.lots[0].trade_date, result.current_date),
        lots=[
            LotOut(
                requestedDate=lot.requested_date,
                tradeDate=lot.trade_date,
                marketClosed=lot.market_closed,
                price=lot.price,
                shares=lot.shares,
                sharesNow=lot.shares_now,
                amount=lot.amount,
                amountLocal=lot.amount_local,
                fxRate=lot.fx_rate,
            )
            for lot in result.lots
        ],
        series=[
            RecurringPointOut(date=d, value=round(v, 2), principal=round(p, 2))
            for d, v, p in downsample(result.series, maxPoints)
        ],
    )


def _parse_buy_day(raw: str):
    value = (raw or "1").strip().lower()
    if value in ("end", "月末", "last"):
        return "end"
    try:
        day = int(value)
    except ValueError:
        raise _bad_input("買付日の指定が不正です。")
    if day not in (1, 5, 10, 15, 20, 25):
        raise _bad_input("買付日は 1 / 5 / 10 / 15 / 20 / 25 / 月末 から選んでください。")
    return day


# ------------------------------------------------------------ 一括 vs 積立
@router.get("/strategy", response_model=StrategyOut)
def strategy(
    ticker: str = Query(..., description="銘柄（5401 / AAPL など）"),
    start: date = Query(..., description="開始日 (YYYY-MM-DD)"),
    monthly: float = Query(30_000, gt=0, description="毎月の積立金額"),
    months: int = Query(60, ge=1, le=600, description="積立する月数"),
    buyDay: str = Query("1", description="買付日：1 / 5 / 10 / 15 / 20 / 25 / end"),
    base: str = Query(BASE_JPY, description="JPY（円換算）または LOCAL（現地通貨）"),
    fractional: bool = Query(True, description="端株を許可するか"),
    maxPoints: int = Query(400, ge=2, le=2000),
) -> StrategyOut:
    base = _normalize_base(base)
    if start > date.today():
        raise _bad_input("開始日には過去の日付を指定してください。")

    buy_day = _parse_buy_day(buyDay)
    try:
        info, points, splits = _fetch(ticker, start)
    except ValueError:
        raise _bad_input("銘柄を入力してください。")
    except SymbolNotFoundError:
        raise _not_found(ticker)
    except MarketDataError:
        raise _upstream()
    m = describe(info.ticker)

    currency = info.currency or m.currency
    money = _money_for(currency, base, start)
    total = monthly * months

    contributions_end = contribution_window_end(start, months)

    try:
        lump = simulate_lump_investment(points, splits, start, total, money, allow_fractional=fractional)
        dca = simulate_recurring(
            points,
            splits,
            start,
            monthly,
            money,
            buy_day=buy_day,
            contributions_end=contributions_end,
            allow_fractional=fractional,
        )
    except SimulationError as exc:
        raise HTTPException(status_code=400, detail={"code": "SIMULATION_ERROR", "message": str(exc)})

    lump_by_date = {d: v for d, v in lump.series}
    dca_by_date = {d: (v, p) for d, v, p in dca.series}
    all_dates = sorted(set(lump_by_date) | set(dca_by_date))

    rows: list[StrategyPointOut] = []
    last_lump = 0.0
    last_dca = 0.0
    last_principal = 0.0
    for d in all_dates:
        last_lump = lump_by_date.get(d, last_lump)
        value, principal = dca_by_date.get(d, (last_dca, last_principal))
        last_dca, last_principal = value, principal
        rows.append(
            StrategyPointOut(
                date=d,
                lump=round(last_lump, 2),
                recurring=round(last_dca, 2),
                principal=round(last_principal, 2),
            )
        )

    diff = lump.current_value - dca.current_value
    winner = "lump" if diff > 0.5 else "recurring" if diff < -0.5 else "tie"
    average_price = (
        sum(lot.amount_local for lot in dca.lots) / sum(lot.shares for lot in dca.lots)
        if dca.lots and sum(lot.shares for lot in dca.lots) > 0
        else None
    )

    return StrategyOut(
        ticker=m.ticker,
        name=info.name,
        market=info.market,
        currency=currency,
        base=base,
        baseCurrency=BASE_JPY if base == BASE_JPY else currency,
        startDate=start,
        buyDay=buyDay,
        monthlyAmount=monthly,
        months=months,
        totalInvested=total,
        currentDate=lump.current_date,
        winner=winner,
        lump=StrategySideOut(
            label="一括投資",
            invested=lump.invested,
            sharesNow=lump.shares_now,
            currentValue=lump.current_value,
            profit=lump.profit,
            returnPct=lump.return_pct,
            tradeDate=lump.trade_date,
            purchasePrice=lump.purchase_price,
        ),
        recurring=StrategySideOut(
            label="積立投資",
            invested=dca.invested,
            sharesNow=dca.shares_now,
            currentValue=dca.current_value,
            profit=dca.profit,
            returnPct=dca.return_pct,
            tradeDate=dca.lots[0].trade_date if dca.lots else None,
            contributions=dca.months,
            averagePrice=average_price,
        ),
        series=downsample(rows, maxPoints),
    )
