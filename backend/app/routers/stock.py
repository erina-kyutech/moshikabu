from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query

from ..providers import get_provider
from ..providers.base import MarketDataError, SymbolNotFoundError
from ..schemas import (
    ActionsOut,
    DividendOut,
    HistoryOut,
    PricePointOut,
    QuoteOut,
    SplitOut,
    SymbolInfoOut,
)
from ..services.simulation import downsample
from ..symbols import meta as symbol_meta

router = APIRouter(prefix="/api", tags=["stock"])


def _not_found(ticker: str) -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={"code": "SYMBOL_NOT_FOUND", "message": f"銘柄が見つかりませんでした（{ticker}）"},
    )


def _upstream_error() -> HTTPException:
    return HTTPException(
        status_code=502,
        detail={
            "code": "UPSTREAM_ERROR",
            "message": "株価データを取得できませんでした。しばらくしてからもう一度お試しください。",
        },
    )


@router.get("/stock/{ticker}", response_model=QuoteOut)
def get_stock(ticker: str) -> QuoteOut:
    provider = get_provider()
    m = symbol_meta(ticker)
    try:
        info = provider.get_info(m.ticker)
        quote = provider.get_quote(m.ticker)
    except SymbolNotFoundError:
        raise _not_found(m.ticker)
    except MarketDataError:
        raise _upstream_error()
    return QuoteOut(
        ticker=m.ticker,
        name=info.name,
        market=info.market,
        currency=info.currency,
        price=quote.price,
        previousClose=quote.previous_close,
        change=quote.change,
        changePercent=quote.change_percent,
        asOf=quote.as_of,
    )


@router.get("/stock/{ticker}/info", response_model=SymbolInfoOut)
def get_stock_info(ticker: str) -> SymbolInfoOut:
    provider = get_provider()
    m = symbol_meta(ticker)
    try:
        info = provider.get_info(m.ticker)
    except SymbolNotFoundError:
        raise _not_found(m.ticker)
    except MarketDataError:
        raise _upstream_error()
    return SymbolInfoOut(**info.__dict__)


@router.get("/stock/{ticker}/history", response_model=HistoryOut)
def get_stock_history(
    ticker: str,
    start: date | None = Query(None, description="取得開始日 (YYYY-MM-DD)"),
    end: date | None = Query(None, description="取得終了日 (YYYY-MM-DD, 当日を含む)"),
    interval: str = Query("1d"),
    maxPoints: int = Query(400, ge=2, le=5000),
) -> HistoryOut:
    provider = get_provider()
    m = symbol_meta(ticker)
    start = start or (date.today() - timedelta(days=365))
    try:
        points = provider.get_history(m.ticker, start=start, end=end, interval=interval)
    except SymbolNotFoundError:
        raise _not_found(m.ticker)
    except MarketDataError:
        raise _upstream_error()
    if not points:
        raise _not_found(m.ticker)
    return HistoryOut(
        ticker=m.ticker,
        currency=m.currency,
        interval=interval,
        points=[PricePointOut(**p.__dict__) for p in downsample(points, maxPoints)],
    )


@router.get("/stock/{ticker}/actions", response_model=ActionsOut)
def get_stock_actions(ticker: str, start: date | None = None) -> ActionsOut:
    provider = get_provider()
    m = symbol_meta(ticker)
    try:
        actions = provider.get_actions(m.ticker, start=start)
    except SymbolNotFoundError:
        raise _not_found(m.ticker)
    except MarketDataError:
        raise _upstream_error()
    return ActionsOut(
        ticker=actions.ticker,
        splits=[SplitOut(date=s.date, ratio=s.ratio) for s in actions.splits],
        dividends=[DividendOut(date=d.date, amount=d.amount) for d in actions.dividends],
    )


def _quote_one(ticker: str) -> QuoteOut | None:
    provider = get_provider()
    m = symbol_meta(ticker)
    try:
        quote = provider.get_quote(m.ticker)
    except (SymbolNotFoundError, MarketDataError):
        return None
    try:
        name = provider.get_info(m.ticker).name
    except (SymbolNotFoundError, MarketDataError):
        name = None
    return QuoteOut(
        ticker=m.ticker,
        name=name,
        market=m.market,
        currency=quote.currency,
        price=quote.price,
        previousClose=quote.previous_close,
        change=quote.change,
        changePercent=quote.change_percent,
        asOf=quote.as_of,
    )


@router.get("/quotes", response_model=list[QuoteOut])
def get_quotes(tickers: str = Query(..., description="カンマ区切りのティッカー")) -> list[QuoteOut]:
    """ポートフォリオ画面用の一括取得。1銘柄失敗しても全体は落とさない。

    yfinance の呼び出しは I/O 待ちが大半なので、銘柄ごとに並列で取得する。
    """
    requested = [t for t in tickers.split(",") if t.strip()][:50]
    if not requested:
        return []

    with ThreadPoolExecutor(max_workers=min(8, len(requested))) as pool:
        results = list(pool.map(_quote_one, requested))
    return [q for q in results if q is not None]
