"""プロバイダのレジストリ。

環境変数 MARKET_DATA_PROVIDER を切り替えるだけで別のデータソースへ移行できる。
"""
from __future__ import annotations

import os
from functools import lru_cache

from .base import (
    Candle,
    CandleSeries,
    CorporateActions,
    Dividend,
    MarketDataError,
    MarketDataProvider,
    PricePoint,
    Quote,
    Split,
    SymbolCandidate,
    SymbolInfo,
    SymbolNotFoundError,
)

__all__ = [
    "Candle",
    "CandleSeries",
    "CorporateActions",
    "Dividend",
    "MarketDataError",
    "MarketDataProvider",
    "PricePoint",
    "Quote",
    "Split",
    "SymbolCandidate",
    "SymbolInfo",
    "SymbolNotFoundError",
    "get_provider",
]

_REGISTRY: dict[str, str] = {
    "yfinance": "app.providers.yfinance_provider:YFinanceProvider",
    # "alphavantage": "app.providers.alphavantage_provider:AlphaVantageProvider",
    # "twelvedata":   "app.providers.twelvedata_provider:TwelveDataProvider",
}


@lru_cache(maxsize=4)
def get_provider(name: str | None = None) -> MarketDataProvider:
    key = (name or os.getenv("MARKET_DATA_PROVIDER") or "yfinance").lower()
    path = _REGISTRY.get(key)
    if path is None:
        raise ValueError(f"unknown market data provider: {key}")
    module_name, _, class_name = path.partition(":")
    module = __import__(module_name, fromlist=[class_name])
    return getattr(module, class_name)()
