"""複数銘柄比較・積立シミュレーションのレスポンススキーマ。"""
from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field

from .schemas import SplitOut


class ComparisonItemOut(BaseModel):
    """比較対象1銘柄ぶんの結果。"""

    # Recharts の dataKey にティッカーを使うと "5401.T" がパス扱いされるため、
    # 系列は安全なキー（s0, s1, ...）で参照する
    key: str
    ticker: str
    name: str
    market: str
    currency: str

    tradeDate: date
    marketClosed: bool

    purchasePrice: float
    shares: float
    sharesNow: float
    splitFactor: float
    splits: list[SplitOut] = Field(default_factory=list)

    investedLocal: float
    invested: float
    currentPrice: float
    currentDate: date
    currentValue: float
    profit: float
    returnPct: float

    fxRateAtBuy: float
    fxRateNow: float

    rank: int


class ComparisonFailureOut(BaseModel):
    ticker: str
    message: str


class SeriesRowOut(BaseModel):
    """{"date": "2020-01-02", "s0": 1000000, "s1": 980000} の形。"""

    date: date
    values: dict[str, float]


class ComparisonOut(BaseModel):
    startDate: date
    amount: float
    base: str
    baseCurrency: str
    allowFractional: bool
    includeDividends: bool = False
    mixedCurrency: bool
    items: list[ComparisonItemOut]
    failed: list[ComparisonFailureOut] = Field(default_factory=list)
    series: list[SeriesRowOut] = Field(default_factory=list)


class LotOut(BaseModel):
    requestedDate: date
    tradeDate: date
    marketClosed: bool
    price: float
    shares: float
    sharesNow: float
    amount: float
    amountLocal: float
    fxRate: float


class RecurringPointOut(BaseModel):
    date: date
    value: float
    principal: float


class RecurringOut(BaseModel):
    ticker: str
    name: str
    market: str
    currency: str
    base: str
    baseCurrency: str

    startDate: date
    buyDay: str
    monthlyAmount: float

    contributions: int
    invested: float
    sharesNow: float
    currentPrice: float
    currentDate: date
    currentValue: float
    profit: float
    returnPct: float
    periodMonths: int
    includeDividends: bool = False

    lots: list[LotOut] = Field(default_factory=list)
    series: list[RecurringPointOut] = Field(default_factory=list)


class StrategySideOut(BaseModel):
    label: str
    invested: float
    sharesNow: float
    currentValue: float
    profit: float
    returnPct: float
    tradeDate: date | None = None
    purchasePrice: float | None = None
    contributions: int | None = None
    averagePrice: float | None = None


class StrategyPointOut(BaseModel):
    date: date
    lump: float
    recurring: float
    principal: float


class StrategyOut(BaseModel):
    ticker: str
    name: str
    market: str
    currency: str
    base: str
    baseCurrency: str

    startDate: date
    buyDay: str
    monthlyAmount: float
    months: int
    totalInvested: float
    currentDate: date
    winner: str  # "lump" | "recurring" | "tie"
    includeDividends: bool = False

    lump: StrategySideOut
    recurring: StrategySideOut
    series: list[StrategyPointOut] = Field(default_factory=list)
