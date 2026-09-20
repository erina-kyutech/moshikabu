"""API のレスポンススキーマ（フロントの型と 1:1 対応）。"""
from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class SymbolInfoOut(BaseModel):
    ticker: str
    name: str
    market: str
    currency: str
    exchange: str | None = None
    sector: str | None = None


class QuoteOut(BaseModel):
    ticker: str
    name: str | None = None
    market: str
    currency: str
    price: float
    previousClose: float | None = None
    change: float | None = None
    changePercent: float | None = None
    dayHigh: float | None = None
    dayLow: float | None = None
    volume: float | None = None
    asOf: datetime


class PricePointOut(BaseModel):
    date: date
    close: float
    open: float | None = None
    high: float | None = None
    low: float | None = None
    volume: float | None = None


class HistoryOut(BaseModel):
    ticker: str
    currency: str
    interval: str
    points: list[PricePointOut]


class SplitOut(BaseModel):
    date: date
    ratio: float


class DividendOut(BaseModel):
    date: date
    amount: float


class ActionsOut(BaseModel):
    ticker: str
    splits: list[SplitOut]
    dividends: list[DividendOut]


class ValuePointOut(BaseModel):
    date: date
    price: float
    value: float


class PastSimulationOut(BaseModel):
    ticker: str
    name: str
    market: str
    currency: str

    requestedDate: date
    tradeDate: date
    marketClosed: bool

    purchasePrice: float
    shares: float
    sharesNow: float
    splitFactor: float
    splits: list[SplitOut]

    invested: float
    requestedAmount: float | None = None
    leftoverCash: float = 0

    currentPrice: float
    currentDate: date
    currentValue: float

    profit: float
    returnPct: float

    dividendTotal: float = 0
    includeDividends: bool = False

    series: list[ValuePointOut] = Field(default_factory=list)


class FxOut(BaseModel):
    pair: str
    rate: float
    asOf: datetime
    points: list[PricePointOut] = Field(default_factory=list)


class ErrorOut(BaseModel):
    code: str
    message: str


class SearchResultOut(BaseModel):
    ticker: str          # 取得に使うティッカー（150A.T / AAPL）
    code: str            # 表示用のコード（150A / AAPL）
    name: str
    market: str          # JP / US
    exchange: str        # 東証グロース / NASDAQ など
    quoteType: str       # EQUITY / ETF / REIT / INDEX
    exact: bool          # 入力がコード・ティッカーとして完全一致
    verified: bool       # 存在を確認済みか（false は「.T を付けて試す」などの推定候補）
    source: str


class SearchOut(BaseModel):
    query: str
    directoryAsOf: str | None = None
    results: list[SearchResultOut]


class CandleOut(BaseModel):
    t: datetime          # 市場のローカル時刻（タイムゾーン付き）
    label: str           # 横軸用（09:05 / 9/18）
    fullLabel: str       # ツールチップ用
    o: float
    h: float
    l: float
    c: float
    v: float | None = None


class RangeOptionOut(BaseModel):
    range: str
    label: str
    intervals: list[str]
    default: str


class CandlesOut(BaseModel):
    ticker: str
    code: str
    name: str
    market: str
    currency: str
    exchange: str | None = None

    range: str
    interval: str          # 実際に使った時間足
    requestedInterval: str | None = None
    notice: str | None = None    # 「この期間では5分足を利用できません」など
    timezone: str | None = None
    refreshSeconds: int
    aggregatedBy: int = 1        # 本数が多いときに何本ずつまとめたか

    rangeOptions: list[RangeOptionOut] = Field(default_factory=list)
    intervalLabels: dict[str, str] = Field(default_factory=dict)
    candles: list[CandleOut] = Field(default_factory=list)
