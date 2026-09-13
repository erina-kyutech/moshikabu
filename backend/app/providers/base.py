"""MarketDataProvider インターフェース。

株価データの取得先 (yfinance / Alpha Vantage / Twelve Data ...) を
差し替えても、UI・計算ロジックを書き換えずに済むようにするための境界。
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date, datetime


class MarketDataError(Exception):
    """データ取得に失敗した (通信・レート制限など)。"""


class SymbolNotFoundError(MarketDataError):
    """銘柄が見つからない。"""


@dataclass(frozen=True)
class SymbolInfo:
    ticker: str
    name: str
    market: str
    currency: str
    exchange: str | None = None
    sector: str | None = None


@dataclass(frozen=True)
class Quote:
    ticker: str
    price: float
    previous_close: float | None
    change: float | None
    change_percent: float | None
    currency: str
    as_of: datetime


@dataclass(frozen=True)
class PricePoint:
    date: date
    close: float          # 分割調整後の終値
    open: float | None = None
    high: float | None = None
    low: float | None = None
    volume: float | None = None


@dataclass(frozen=True)
class Split:
    date: date
    ratio: float          # 1:2 分割なら 2.0


@dataclass(frozen=True)
class Dividend:
    date: date
    amount: float


@dataclass(frozen=True)
class CorporateActions:
    ticker: str
    splits: list[Split] = field(default_factory=list)
    dividends: list[Dividend] = field(default_factory=list)


class MarketDataProvider(ABC):
    """株価データ取得の抽象基底クラス。"""

    name: str = "abstract"

    @abstractmethod
    def get_info(self, ticker: str) -> SymbolInfo:
        """銘柄基本情報 (企業名など)。"""

    @abstractmethod
    def get_quote(self, ticker: str) -> Quote:
        """最新価格。"""

    @abstractmethod
    def get_history(
        self, ticker: str, start: date, end: date | None = None, interval: str = "1d"
    ) -> list[PricePoint]:
        """期間内の株価履歴 (分割調整後・配当未調整の終値)。"""

    @abstractmethod
    def get_actions(self, ticker: str, start: date | None = None) -> CorporateActions:
        """株式分割・配当。"""
