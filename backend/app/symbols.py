"""ティッカー正規化と市場判定。

Yahoo Finance 固有のサフィックス規則をここに閉じ込め、
将来別データソースへ移行してもUI/計算側を変更しなくて済むようにする。
"""
from __future__ import annotations

import re
from dataclasses import dataclass

# 日本株: 4桁数字 (7203) / 数字3桁+英字1桁 (130A) など東証の新形式にも対応
_JP_CODE = re.compile(r"^\d{4}$|^\d{3}[A-Z]$", re.IGNORECASE)

MARKET_JP = "JP"
MARKET_US = "US"

_JP_SUFFIXES = (".T", ".JP", ".TYO")


@dataclass(frozen=True)
class SymbolMeta:
    ticker: str        # 正規化済みシンボル (例: 5401.T / AAPL)
    market: str        # JP / US
    currency: str      # JPY / USD
    symbol_hint: str   # ユーザーに見せる短縮表記 (例: 5401 / AAPL)


def normalize(raw: str) -> str:
    """ユーザー入力を Yahoo Finance のシンボルに正規化する。"""
    s = (raw or "").strip().upper().replace("　", "")
    if not s:
        raise ValueError("ticker is empty")
    if _JP_CODE.match(s):
        return f"{s}.T"
    # 5401.t のような入力も救う
    if "." in s:
        head, _, tail = s.partition(".")
        if _JP_CODE.match(head) and f".{tail}" in _JP_SUFFIXES:
            return f"{head}.T"
    return s


def meta(raw: str) -> SymbolMeta:
    t = normalize(raw)
    if t.endswith(".T"):
        return SymbolMeta(ticker=t, market=MARKET_JP, currency="JPY", symbol_hint=t[:-2])
    return SymbolMeta(ticker=t, market=MARKET_US, currency="USD", symbol_hint=t)
