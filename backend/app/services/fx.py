"""為替レートの取得。

プロバイダ固有のシンボル（Yahoo Finance の "JPY=X" など）を
ここだけに閉じ込め、呼び出し側は通貨ペア名だけを扱う。
"""
from __future__ import annotations

from datetime import date

from ..providers import get_provider
from ..providers.base import MarketDataError, PricePoint, SymbolNotFoundError

# 通貨ペア → プロバイダ上のシンボル
PAIR_SYMBOLS: dict[str, str] = {"usdjpy": "JPY=X"}

# 取得できなかったときの保守的なフォールバック（表示は必ず注記付きにする）
FALLBACK_USDJPY = 150.0


def pair_symbol(pair: str) -> str | None:
    return PAIR_SYMBOLS.get(pair.lower())


def latest_rate(pair: str) -> float | None:
    symbol = pair_symbol(pair)
    if symbol is None:
        return None
    try:
        return get_provider().get_quote(symbol).price
    except (SymbolNotFoundError, MarketDataError):
        return None


def rate_history(pair: str, start: date, end: date | None = None) -> list[PricePoint]:
    symbol = pair_symbol(pair)
    if symbol is None:
        return []
    try:
        return get_provider().get_history(symbol, start=start, end=end)
    except (SymbolNotFoundError, MarketDataError):
        return []
