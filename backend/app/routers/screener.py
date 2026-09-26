"""条件スクリーナーとバックテストのエンドポイント。

この機能は「上がる銘柄を予測する」ものではなく、
利用者が決めた条件に一致する銘柄を探し、その条件が過去にどうだったかを調べるもの。
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import date

from fastapi import APIRouter, HTTPException

from .. import directory, metrics
from ..providers import get_fundamental_provider, get_provider
from ..providers.base import MarketDataError, SymbolNotFoundError
from ..schemas_screener import (
    BacktestRequest,
    BacktestResponse,
    BenchmarkOut,
    CatalogOut,
    CheckOut,
    ConditionIn,
    ConditionStatOut,
    EquityPointOut,
    FundamentalsOut,
    MetricOut,
    ScreenRequest,
    ScreenResponse,
    ScreenRowOut,
    TemplateConditionOut,
    TemplateOut,
    TradeOut,
    UniverseOut,
    YearResultOut,
)
from ..services import backtest as backtest_engine
from ..services import fx as fx_service
from ..services import universe as universe_service
from ..services.backtest_data import BENCHMARKS, MarketBacktestData
from ..services.screening import Condition, ScreeningError, check, screen
from ..services.search import resolve
from ..symbols import describe

router = APIRouter(prefix="/api", tags=["screener"])

MAX_WORKERS = 24

# 条件の例。「おすすめ銘柄」ではなく、あくまで検索条件の組み合わせ例
TEMPLATES = (
    {
        "id": "value-growth",
        "name": "割安成長株",
        "description": "PBRが低めで、売上と利益が伸びている会社を探す条件",
        "conditions": [
            {"metric": "pbr", "operator": "<=", "value": 1.0},
            {"metric": "revenueGrowth", "operator": ">=", "value": 10},
            {"metric": "operatingIncomeGrowth", "operator": ">=", "value": 10},
        ],
    },
    {
        "id": "high-growth",
        "name": "高成長株",
        "description": "売上・利益がともに大きく伸びている会社を探す条件",
        "conditions": [
            {"metric": "revenueGrowth", "operator": ">=", "value": 20},
            {"metric": "operatingIncomeGrowth", "operator": ">=", "value": 20},
        ],
    },
    {
        "id": "high-return",
        "name": "高収益企業",
        "description": "自己資本を効率よく使い、利益率も高い会社を探す条件",
        "conditions": [
            {"metric": "roe", "operator": ">=", "value": 15},
            {"metric": "operatingMargin", "operator": ">=", "value": 10},
        ],
    },
    {
        "id": "small-cap",
        "name": "小型株",
        "description": "時価総額が小さい会社を探す条件",
        "conditions": [{"metric": "marketCap", "operator": "<=", "value": 500}],
    },
)

DATA_NOTES = (
    "財務データは直近4〜5期分しか取得できないため、バックテストで使える期間は概ね2024年以降です。"
    "それ以前の日付では「その時点で公表済みだった決算」が存在せず、対象外になります。",
    "対象は現在上場している銘柄のみです。過去に上場廃止となった銘柄を含められないため、"
    "生存者バイアス（Survivorship bias）があります。",
    "過去の検証結果は、将来の成績を保証するものではありません。",
)


def _bad(message: str) -> HTTPException:
    return HTTPException(status_code=400, detail={"code": "BAD_INPUT", "message": message})


def _conditions(items: list[ConditionIn]) -> list[Condition]:
    return [Condition(metric=c.metric, operator=c.operator, value=c.value) for c in items]


@router.get("/screener/catalog", response_model=CatalogOut)
def catalog() -> CatalogOut:
    """指標・演算子・ユニバース・条件テンプレートの一覧。画面はこれを見て入力欄を作る。"""
    return CatalogOut(
        metrics=[MetricOut(**m.__dict__) for m in metrics.METRICS],
        operators=metrics.OPERATORS,
        categories=metrics.CATEGORIES,
        universes=[UniverseOut(**u.__dict__) for u in universe_service.UNIVERSES],
        templates=[
            TemplateOut(
                id=t["id"],
                name=t["name"],
                description=t["description"],
                conditions=[TemplateConditionOut(**c) for c in t["conditions"]],
            )
            for t in TEMPLATES
        ],
        benchmarks=[BenchmarkOut(id=k, label=v["label"]) for k, v in BENCHMARKS.items()],
        holdingPeriods=list(backtest_engine.HOLDING_PERIODS),
        dataNotes=list(DATA_NOTES),
    )


@router.post("/screener/search", response_model=ScreenResponse)
def search(request: ScreenRequest) -> ScreenResponse:
    """いまの財務データで、条件に一致する銘柄を探す。"""
    conditions = _conditions(request.conditions)
    try:
        from ..services.screening import validate

        validate(conditions)
    except ScreeningError as exc:
        raise _bad(str(exc))

    spec = universe_service.UNIVERSE_BY_ID.get(request.universe)
    if spec is None:
        raise _bad("対象銘柄の指定が不正です。")

    tickers = universe_service.tickers(request.universe)
    needed = frozenset(c.metric for c in conditions)
    fundamentals = get_fundamental_provider()
    usd_jpy = fx_service.latest_rate("usdjpy") or fx_service.FALLBACK_USDJPY

    def load(ticker: str):
        fx = 1.0 if describe(ticker).currency == "JPY" else usd_jpy
        try:
            return ticker, fundamentals.get_current(ticker, fx, needed)
        except (SymbolNotFoundError, MarketDataError):
            return ticker, None

    with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, max(1, len(tickers)))) as pool:
        snapshots = dict(pool.map(load, tickers))

    result = screen(conditions, snapshots)

    # 一致した銘柄だけ、表示用に現在値を付ける
    provider = get_provider()

    def quote_of(ticker: str):
        try:
            return ticker, provider.get_quote(ticker)
        except (SymbolNotFoundError, MarketDataError):
            return ticker, None

    matched_tickers = [row.ticker for row in result.matched]
    quotes = {}
    if matched_tickers:
        with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(matched_tickers))) as pool:
            quotes = dict(pool.map(quote_of, matched_tickers))

    rows: list[ScreenRowOut] = []
    for row in result.matched:
        meta = describe(row.ticker)
        issue = directory.lookup(row.ticker)
        quote = quotes.get(row.ticker)
        rows.append(
            ScreenRowOut(
                ticker=row.ticker,
                code=meta.symbol_hint,
                name=issue.name if issue else (quote.ticker if quote else meta.symbol_hint),
                market=meta.market,
                currency=meta.currency,
                exchange=issue.segment if issue else ("NASDAQ / NYSE" if meta.market == "US" else None),
                price=quote.price if quote else None,
                change=quote.change if quote else None,
                changePercent=quote.change_percent if quote else None,
                values=row.values,
                checks=[CheckOut(**c.__dict__) for c in row.checks],
            )
        )

    excluded_reasons: dict[str, int] = {}
    for reason in result.excluded.values():
        excluded_reasons[reason] = excluded_reasons.get(reason, 0) + 1

    return ScreenResponse(
        asOf=date.today(),
        universe=request.universe,
        universeLabel=spec.label,
        scanned=len(tickers),
        matchedCount=len(result.matched),
        rejectedCount=len(result.rejected),
        excludedCount=len(result.excluded),
        excludedReasons=excluded_reasons,
        conditionStats=[ConditionStatOut(**st.__dict__) for st in result.stats],
        rows=rows,
        notes=[
            "条件に一致した銘柄の一覧です。将来の値上がりを示すものではありません。",
            f"対象は{spec.label}の{len(tickers)}銘柄です。",
        ],
    )


@router.get("/stock/{ticker}/fundamentals", response_model=FundamentalsOut)
def fundamentals_of(ticker: str) -> FundamentalsOut:
    """1銘柄の財務指標（銘柄詳細の「財務」「条件適合」タブ用）。"""
    try:
        resolved = resolve(ticker)
    except SymbolNotFoundError:
        raise HTTPException(
            status_code=404,
            detail={"code": "SYMBOL_NOT_FOUND", "message": f"銘柄が見つかりませんでした（{ticker}）"},
        )
    meta = describe(resolved)
    usd_jpy = fx_service.latest_rate("usdjpy") or fx_service.FALLBACK_USDJPY
    fx = 1.0 if meta.currency == "JPY" else usd_jpy

    try:
        snapshot = get_fundamental_provider().get_current(resolved, fx)
    except (SymbolNotFoundError, MarketDataError):
        raise HTTPException(
            status_code=502,
            detail={"code": "UPSTREAM_ERROR", "message": "財務データを取得できませんでした。"},
        )

    issue = directory.lookup(resolved)
    try:
        info = get_provider().get_info(resolved)
        name, exchange = info.name, info.exchange
    except (SymbolNotFoundError, MarketDataError):
        name, exchange = (issue.name if issue else meta.symbol_hint), None

    return FundamentalsOut(
        ticker=resolved,
        code=meta.symbol_hint,
        name=name,
        market=meta.market,
        currency=meta.currency,
        exchange=exchange,
        asOf=snapshot.as_of,
        values=snapshot.values,
        missing=[m.id for m in metrics.METRICS if m.id not in snapshot.values],
    )


@router.post("/backtest/run", response_model=BacktestResponse)
def run_backtest(request: BacktestRequest) -> BacktestResponse:
    """作った条件が、過去にどのような結果になったかを検証する。

    銘柄の抽出には「その時点で公表済みだった決算」だけを使う（未来の情報を使わない）。
    """
    spec = universe_service.UNIVERSE_BY_ID.get(request.universe)
    if spec is None:
        raise _bad("対象銘柄の指定が不正です。")
    if not 1 <= request.screeningMonth <= 12:
        raise _bad("抽出する月は1〜12で指定してください。")

    config = backtest_engine.BacktestConfig(
        conditions=_conditions(request.conditions),
        start=request.startDate,
        end=request.endDate,
        screening_month=request.screeningMonth,
        holding_months=request.holdingPeriod,
        initial_capital=request.initialCapital,
        benchmark=request.benchmark,
        universe=request.universe,
    )

    data = MarketBacktestData(request.universe, request.benchmark, request.startDate, request.endDate)
    try:
        data.preload()
        result = backtest_engine.run(config, data)
    except ScreeningError as exc:
        raise _bad(str(exc))
    except MarketDataError:
        raise HTTPException(
            status_code=502,
            detail={"code": "UPSTREAM_ERROR", "message": "株価データを取得できませんでした。"},
        )

    excluded = dict(result.excluded_counts)
    for reason in data.failed.values():
        excluded[reason] = excluded.get(reason, 0) + 1

    notes = list(result.notes) + list(DATA_NOTES)
    if not result.trades:
        notes.insert(
            0,
            "この期間・この条件では、売買が1件も成立しませんでした。"
            "検証期間を2024年以降にするか、条件をゆるめてお試しください。",
        )

    return BacktestResponse(
        ruleName=request.ruleName,
        conditions=request.conditions,
        startDate=request.startDate,
        endDate=request.endDate,
        screeningMonth=request.screeningMonth,
        holdingPeriod=request.holdingPeriod,
        universe=request.universe,
        universeLabel=spec.label,
        benchmark=request.benchmark,
        benchmarkLabel=data.benchmark_label,
        totalInvested=result.total_invested,
        finalValue=result.final_value,
        profit=result.profit,
        returnRate=result.return_rate,
        winRate=result.win_rate,
        averageReturn=result.average_return,
        medianReturn=result.median_return,
        benchmarkReturn=result.benchmark_return,
        trades=[
            TradeOut(
                ticker=t.ticker,
                code=describe(t.ticker).symbol_hint,
                name=t.name,
                buyDate=t.buy_date,
                sellDate=t.sell_date,
                buyPrice=t.buy_price,
                sellPrice=t.sell_price,
                shares=t.shares,
                invested=t.invested,
                finalValue=t.final_value,
                profit=t.profit,
                returnPct=t.return_pct,
            )
            for t in result.trades
        ],
        yearly=[
            YearResultOut(
                year=y.year,
                screeningDate=y.screening_date,
                candidates=y.candidates,
                excluded=y.excluded,
                trades=y.trades,
                winRate=y.win_rate,
                averageReturn=y.average_return,
                medianReturn=y.median_return,
                benchmarkReturn=y.benchmark_return,
                profit=y.profit,
            )
            for y in result.yearly
        ],
        equity=[EquityPointOut(date=p.date, value=p.value, benchmark=p.benchmark) for p in result.equity],
        screeningDates=result.screening_dates,
        excludedReasons=excluded,
        notes=notes,
    )
