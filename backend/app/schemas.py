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
