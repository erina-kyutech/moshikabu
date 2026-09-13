from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query

from ..providers import get_provider
from ..providers.base import MarketDataError, SymbolNotFoundError
from ..schemas import FxOut, PricePointOut
from ..services.simulation import downsample

router = APIRouter(prefix="/api/fx", tags=["fx"])

# プロバイダ固有のシンボルを UI に漏らさないためのマッピング
_PAIRS = {"usdjpy": "JPY=X"}


@router.get("/{pair}", response_model=FxOut)
def get_fx(
    pair: str,
    start: date | None = Query(None),
    end: date | None = Query(None),
    maxPoints: int = Query(400, ge=2, le=5000),
) -> FxOut:
    symbol = _PAIRS.get(pair.lower())
    if symbol is None:
        raise HTTPException(status_code=404, detail={"code": "BAD_INPUT", "message": "未対応の通貨ペアです。"})

    provider = get_provider()
    try:
        quote = provider.get_quote(symbol)
        points = []
        if start:
            points = provider.get_history(symbol, start=start, end=end)
    except SymbolNotFoundError:
        raise HTTPException(status_code=404, detail={"code": "SYMBOL_NOT_FOUND", "message": "為替レートを取得できませんでした。"})
    except MarketDataError:
        raise HTTPException(
            status_code=502,
            detail={"code": "UPSTREAM_ERROR", "message": "為替レートを取得できませんでした。"},
        )

    return FxOut(
        pair=pair.upper(),
        rate=quote.price,
        asOf=quote.as_of or datetime.now(timezone.utc),
        points=[PricePointOut(**p.__dict__) for p in downsample(points, maxPoints)],
    )
