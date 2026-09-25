"""条件スクリーナー・バックテストのスキーマ。"""
from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


# ------------------------------------------------------------------ カタログ
class MetricOut(BaseModel):
    id: str
    label: str
    unit: str
    category: str
    decimals: int
    historical: bool     # 過去時点を再現できるか（バックテストで使えるか）
    note: str = ""


class TemplateConditionOut(BaseModel):
    metric: str
    operator: str
    value: float


class TemplateOut(BaseModel):
    id: str
    name: str
    description: str
    conditions: list[TemplateConditionOut]


class UniverseOut(BaseModel):
    id: str
    label: str
    description: str
    size: int
    slow: bool


class BenchmarkOut(BaseModel):
    id: str
    label: str


class CatalogOut(BaseModel):
    metrics: list[MetricOut]
    operators: dict[str, str]
    categories: dict[str, str]
    universes: list[UniverseOut]
    templates: list[TemplateOut]
    benchmarks: list[BenchmarkOut]
    holdingPeriods: list[int]
    # 過去データの制約（画面に注意として出す）
    dataNotes: list[str] = Field(default_factory=list)


# ------------------------------------------------------------- スクリーニング
class ConditionIn(BaseModel):
    metric: str
    operator: str
    value: float


class ScreenRequest(BaseModel):
    conditions: list[ConditionIn]
    universe: str = "jp-core30"


class CheckOut(BaseModel):
    metric: str
    operator: str
    threshold: float
    actual: float | None = None
    passed: bool


class ScreenRowOut(BaseModel):
    ticker: str
    code: str
    name: str
    market: str
    currency: str
    exchange: str | None = None
    price: float | None = None
    change: float | None = None
    changePercent: float | None = None
    values: dict[str, float] = Field(default_factory=dict)
    checks: list[CheckOut] = Field(default_factory=list)


class ScreenResponse(BaseModel):
    asOf: date
    universe: str
    universeLabel: str
    scanned: int
    matchedCount: int
    rejectedCount: int
    excludedCount: int
    excludedReasons: dict[str, int] = Field(default_factory=dict)
    rows: list[ScreenRowOut] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class FundamentalsOut(BaseModel):
    ticker: str
    code: str
    name: str
    market: str
    currency: str
    exchange: str | None = None
    asOf: date
    values: dict[str, float] = Field(default_factory=dict)
    missing: list[str] = Field(default_factory=list)


# --------------------------------------------------------------- バックテスト
class BacktestRequest(BaseModel):
    conditions: list[ConditionIn]
    startDate: date
    endDate: date
    screeningMonth: int = 4
    holdingPeriod: int = 12          # か月
    initialCapital: float = 1_000_000
    benchmark: str = "TOPIX"
    universe: str = "jp-core30"
    ruleName: str | None = None


class TradeOut(BaseModel):
    ticker: str
    code: str
    name: str
    buyDate: date
    sellDate: date
    buyPrice: float
    sellPrice: float
    shares: float
    invested: float
    finalValue: float
    profit: float
    returnPct: float


class YearResultOut(BaseModel):
    year: int
    screeningDate: date
    candidates: int
    excluded: int
    trades: int
    winRate: float
    averageReturn: float
    medianReturn: float
    benchmarkReturn: float | None = None
    profit: float


class EquityPointOut(BaseModel):
    date: date
    value: float
    benchmark: float | None = None


class BacktestResponse(BaseModel):
    ruleName: str | None = None
    conditions: list[ConditionIn]
    startDate: date
    endDate: date
    screeningMonth: int
    holdingPeriod: int
    universe: str
    universeLabel: str
    benchmark: str
    benchmarkLabel: str

    totalInvested: float
    finalValue: float
    profit: float
    returnRate: float
    winRate: float
    averageReturn: float
    medianReturn: float
    benchmarkReturn: float | None = None

    trades: list[TradeOut] = Field(default_factory=list)
    yearly: list[YearResultOut] = Field(default_factory=list)
    equity: list[EquityPointOut] = Field(default_factory=list)
    screeningDates: list[date] = Field(default_factory=list)
    excludedReasons: dict[str, int] = Field(default_factory=dict)
    notes: list[str] = Field(default_factory=list)
