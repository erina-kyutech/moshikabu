"""プロバイダのレジストリ。

環境変数 MARKET_DATA_PROVIDER を切り替えるだけで別のデータソースへ移行できる。
"""
from __future__ import annotations

import os
from functools import lru_cache

from .base import (
    Candle,
    FundamentalProvider,
    Fundamentals,
    HistoricalFundamentalProvider,
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
    "FundamentalProvider",
    "Fundamentals",
    "HistoricalFundamentalProvider",
    "get_fundamental_provider",
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

_FUNDAMENTAL_REGISTRY: dict[str, str] = {
    "yfinance": "app.providers.yfinance_fundamentals:YFinanceFundamentals",
}

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


@lru_cache(maxsize=4)
def get_fundamental_provider(name: str | None = None):
    """財務データの取得元。現在値用と過去時点用を同じ実装が担う。

    将来 別の財務データ提供元（有料APIなど）に替えるときは、
    FundamentalProvider / HistoricalFundamentalProvider を実装して
    ここに登録するだけでよい。
    """
    key = (name or os.getenv("FUNDAMENTAL_PROVIDER") or "yfinance").lower()
    path = _FUNDAMENTAL_REGISTRY.get(key)
    if path is None:
        raise ValueError(f"unknown fundamental provider: {key}")
    module_name, _, class_name = path.partition(":")
    module = __import__(module_name, fromlist=[class_name])
    return getattr(module, class_name)()
