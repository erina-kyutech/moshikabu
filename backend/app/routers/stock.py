from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query

from ..providers import get_provider
from ..providers.base import MarketDataError, SymbolNotFoundError
from ..schemas import (
    ActionsOut,
    CandleOut,
    CandlesOut,
    DividendOut,
    HistoryOut,
    PricePointOut,
    QuoteOut,
    RangeOptionOut,
    SplitOut,
    SymbolInfoOut,
)
from ..services.simulation import downsample
from ..services import candles as candle_service
from ..services.search import resolve
from ..symbols import clean, describe
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
    """銘柄情報＋最新価格。

    「150A」のような入力は 150A.T → 150A の順に取得を試し、見つかったものを返す。
    """
    provider = get_provider()
    try:
        m = describe(resolve(ticker))
    except ValueError:
        raise HTTPException(status_code=400, detail={"code": "BAD_INPUT", "message": "銘柄を入力してください。"})
    except SymbolNotFoundError:
        # 「150A.T」のような内部の形ではなく、ユーザーが入力した形で伝える
        raise _not_found(clean(ticker))
    except MarketDataError:
        raise _upstream_error()
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
        dayHigh=quote.day_high,
        dayLow=quote.day_low,
        volume=quote.volume,
        asOf=quote.as_of,
    )


@router.get("/stock/{ticker}/info", response_model=SymbolInfoOut)
def get_stock_info(ticker: str) -> SymbolInfoOut:
    provider = get_provider()
    try:
        m = describe(resolve(ticker))
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
        dayHigh=quote.day_high,
        dayLow=quote.day_low,
        volume=quote.volume,
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


@router.get("/stock/{ticker}/candles", response_model=CandlesOut)
def get_stock_candles(
    ticker: str,
    range_: str = Query("1mo", alias="range", description="1d / 5d / 1mo / 3mo / 6mo / 1y / 5y / max"),
    interval: str | None = Query(None, description="1m / 5m / 15m / 30m / 1h / 1d / 1wk / 1mo"),
    maxBars: int = Query(candle_service.MAX_BARS, ge=20, le=2000),
) -> CandlesOut:
    """チャート用の OHLCV。

    分足は取得できる期間に制限があるため、選べない組み合わせはエラーにせず、
    その期間で使える時間足に切り替えて `notice` で理由を返す。
    """
    provider = get_provider()
    try:
        m = describe(resolve(ticker))
        info = provider.get_info(m.ticker)
    except ValueError:
        raise HTTPException(status_code=400, detail={"code": "BAD_INPUT", "message": "銘柄を入力してください。"})
    except SymbolNotFoundError:
        raise _not_found(clean(ticker))
    except MarketDataError:
        raise _upstream_error()

    spec, used, notice = candle_service.resolve(range_, interval)
    try:
        series = provider.get_candles(m.ticker, spec.period, used)
        # 連休などで「1日」の足が空になることがある。その場合は少し広げて表示する
        if not series.candles and spec.key in ("1d", "5d"):
            fallback = candle_service.RANGE_BY_KEY["5d" if spec.key == "1d" else "1mo"]
            retry_interval = used if used in fallback.intervals else fallback.default
            series = provider.get_candles(m.ticker, fallback.period, retry_interval)
            if series.candles:
                notice = f"{spec.label}のデータが無かったため、{fallback.label}で表示しています。"
                spec, used = fallback, retry_interval
    except SymbolNotFoundError:
        raise _not_found(m.ticker)
    except MarketDataError:
        raise _upstream_error()

    bars = [
        candle_service.Bar(
            time=c.time, open=c.open, high=c.high, low=c.low, close=c.close, volume=c.volume
        )
        for c in series.candles
    ]
    bars, factor = candle_service.aggregate(bars, maxBars)

    return CandlesOut(
        ticker=m.ticker,
        code=m.symbol_hint,
        name=info.name,
        market=info.market,
        currency=info.currency,
        exchange=info.exchange,
        range=spec.key,
        interval=used,
        requestedInterval=interval,
        notice=notice,
        timezone=series.timezone or None,
        refreshSeconds=candle_service.refresh_seconds(used),
        aggregatedBy=factor,
        rangeOptions=[
            RangeOptionOut(range=r.key, label=r.label, intervals=list(r.intervals), default=r.default)
            for r in candle_service.RANGES
        ],
        intervalLabels=candle_service.INTERVAL_LABELS,
        candles=[
            CandleOut(
                t=b.time,
                label=candle_service.axis_label(b.time, used),
                fullLabel=candle_service.full_label(b.time, used),
                o=round(b.open, 4),
                h=round(b.high, 4),
                l=round(b.low, 4),
                c=round(b.close, 4),
                v=b.volume,
            )
            for b in bars
        ],
    )
