"""ティッカー正規化と市場判定。

Yahoo Finance 固有のサフィックス規則をここに閉じ込め、
将来別データソースへ移行してもUI/計算側を変更しなくて済むようにする。

日本株の証券コードについて
--------------------------
2024年1月以降の新規コードには英字が入る（例: 130A / 150A）。
JPX のルールでは「1桁目と3桁目は数字、2桁目と4桁目は数字または英字」。
そのため「数字4桁なら日本株」という判定は使わない。

判定の考え方（米国ティッカーとの衝突を避ける）:
  1. 「.T」が付いていればそのまま日本株
  2. 先頭が数字で、日本のコードの形をしているもの
       → 日本株の候補（{code}.T を最初に試す）
       JPX 辞書に載っていれば日本株で確定。載っていなければ取得結果で判断する
  3. 先頭が英字のもの（AAPL / NVDA / BRK-B / ^N225 など）
       → 米国などのティッカーとしてそのまま扱う。ここに .T を付けることはしない
米国の上場銘柄のティッカーは英字で始まるので、2 と 3 は衝突しない。
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from . import directory

# 日本の証券コード:
#   - 通常の4文字コード（1・3桁目が数字、2・4桁目は数字か英字）… 5401 / 150A / 1A2B
#   - 優先株などの5桁コード … 25935
_JP_CODE = re.compile(r"^(?:[0-9][0-9A-Z][0-9][0-9A-Z]|[0-9]{5})$")

MARKET_JP = "JP"
MARKET_US = "US"

_JP_SUFFIXES = (".T", ".JP", ".TYO")


@dataclass(frozen=True)
class SymbolMeta:
    ticker: str        # 正規化済みシンボル (例: 5401.T / AAPL)
    market: str        # JP / US
    currency: str      # JPY / USD
    symbol_hint: str   # ユーザーに見せる短縮表記 (例: 5401 / AAPL)


def clean(raw: str) -> str:
    """全角→半角・前後の空白除去・大文字化。「１５０ａ」→「150A」"""
    s = unicodedata.normalize("NFKC", raw or "")
    return re.sub(r"\s+", "", s).upper()


def is_jp_code(text: str) -> bool:
    """日本の証券コードの「形」をしているか（実在するかは別）。"""
    return bool(_JP_CODE.match(clean(text)))


def _split_jp_suffix(s: str) -> str | None:
    """「5401.T」「150a.jp」などからコード部分を取り出す。"""
    if "." not in s:
        return None
    head, _, tail = s.rpartition(".")
    if f".{tail}" in _JP_SUFFIXES and _JP_CODE.match(head):
        return head
    return None


def candidates(raw: str) -> list[str]:
    """入力を、株価取得を試す順番のティッカー候補に変換する。

    例:
      "5401"   → ["5401.T"]            （JPX 辞書にあるので日本株で確定）
      "150A"   → ["150A.T"]
      "999Z"   → ["999Z.T", "999Z"]    （辞書に無い日本式コード → .T を先に試す）
      "AAPL"   → ["AAPL"]
      "5401.T" → ["5401.T"]
    """
    s = clean(raw)
    if not s:
        raise ValueError("ticker is empty")

    code = _split_jp_suffix(s)
    if code:
        return [f"{code}.T"]

    if _JP_CODE.match(s):
        if directory.lookup(s):
            return [f"{s}.T"]
        return [f"{s}.T", s]

    return [s]


def normalize(raw: str) -> str:
    """ユーザー入力を Yahoo Finance のシンボルに正規化する（最有力の候補）。"""
    return candidates(raw)[0]


def describe(ticker: str) -> SymbolMeta:
    """確定済みのティッカーから市場・通貨を判定する（候補への変換はしない）。

    株価取得の段階では「999Z」を「999Z」のまま扱う必要があるため、
    正規化（.T の付与）とは分けている。
    """
    t = clean(ticker)
    if not t:
        raise ValueError("ticker is empty")
    if t.endswith(".T"):
        return SymbolMeta(ticker=t, market=MARKET_JP, currency="JPY", symbol_hint=t[:-2])
    return SymbolMeta(ticker=t, market=MARKET_US, currency="USD", symbol_hint=t)


def meta(raw: str) -> SymbolMeta:
    """ユーザー入力を正規化したうえで市場・通貨を判定する。"""
    return describe(normalize(raw))
