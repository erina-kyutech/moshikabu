from __future__ import annotations

from datetime import date

from fastapi import APIRouter, HTTPException, Query

from ..providers import get_provider
from ..providers.base import MarketDataError, SymbolNotFoundError
from ..schemas import PastSimulationOut, SplitOut, ValuePointOut
from ..services.simulation import SimulationError, downsample, simulate_past
from ..symbols import meta as symbol_meta

router = APIRouter(prefix="/api/simulate", tags=["simulate"])


@router.get("/past", response_model=PastSimulationOut)
def simulate_past_endpoint(
    ticker: str = Query(..., description="銘柄コード（5401 / 5401.T / AAPL）"),
    date_: date = Query(..., alias="date", description="購入日 (YYYY-MM-DD)"),
    shares: float | None = Query(None, gt=0),
    amount: float | None = Query(None, gt=0),
    includeDividends: bool = Query(False, description="配当込みで計算する（将来拡張用）"),
    maxPoints: int = Query(400, ge=2, le=5000),
) -> PastSimulationOut:
    if (shares is None) == (amount is None):
        raise HTTPException(
            status_code=400,
            detail={"code": "BAD_INPUT", "message": "購入株数または投資金額のどちらか一方を指定してください。"},
        )
    if date_ > date.today():
        raise HTTPException(
            status_code=400,
            detail={"code": "BAD_INPUT", "message": "購入日には過去の日付を指定してください。"},
        )

    provider = get_provider()
    m = symbol_meta(ticker)
    try:
        info = provider.get_info(m.ticker)
        points = provider.get_history(m.ticker, start=date_)
        actions = provider.get_actions(m.ticker)
    except SymbolNotFoundError:
        raise HTTPException(
            status_code=404,
            detail={"code": "SYMBOL_NOT_FOUND", "message": f"銘柄が見つかりませんでした（{m.ticker}）"},
        )
    except MarketDataError:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "UPSTREAM_ERROR",
                "message": "株価データを取得できませんでした。しばらくしてからもう一度お試しください。",
            },
        )

    try:
        result = simulate_past(
            points,
            actions.splits,
            date_,
            shares=shares,
            amount=amount,
            dividends=actions.dividends,
            include_dividends=includeDividends,
        )
    except SimulationError as exc:
        raise HTTPException(status_code=400, detail={"code": "SIMULATION_ERROR", "message": str(exc)})

    return PastSimulationOut(
        ticker=m.ticker,
        name=info.name,
        market=info.market,
        currency=info.currency,
        requestedDate=result.requested_date,
        tradeDate=result.trade_date,
        marketClosed=result.market_closed,
        purchasePrice=result.purchase_price,
        shares=result.shares,
        sharesNow=result.shares_now,
        splitFactor=result.split_factor,
        splits=[SplitOut(date=s.date, ratio=s.ratio) for s in result.splits],
        invested=result.invested,
        requestedAmount=result.requested_amount,
        leftoverCash=result.leftover_cash,
        currentPrice=result.current_price,
        currentDate=result.current_date,
        currentValue=result.current_value,
        profit=result.profit,
        returnPct=result.return_pct,
        dividendTotal=result.dividend_total,
        includeDividends=result.include_dividends,
        series=[
            ValuePointOut(date=p.date, price=p.price, value=p.value)
            for p in downsample(result.series, maxPoints)
        ],
    )
