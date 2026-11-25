"""記録（ブック）の同期スキーマ。

1人分の記録をまとめて「ブック」と呼ぶ。
ログインを求めない代わりに、推測できないIDを鍵として扱う。
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class PositionIn(BaseModel):
    id: str
    ticker: str
    name: str
    market: str
    currency: str
    buyDate: str
    buyAt: datetime
    buyPrice: float
    shares: float
    invested: float
    status: str
    sellDate: str | None = None
    sellAt: datetime | None = None
    sellPrice: float | None = None
    proceeds: float | None = None
    schemaVersion: int = 1


class RuleIn(BaseModel):
    id: str
    name: str
    conditions: list[dict[str, Any]]
    universe: str = "jp-core30"
    createdAt: datetime | None = None


class BookIn(BaseModel):
    """ブックまるごとの内容。差分ではなく全体を送る（データ量が小さいため）。"""

    positions: list[PositionIn] = Field(default_factory=list)
    rules: list[RuleIn] = Field(default_factory=list)
    dayTrade: dict[str, Any] | None = None


class BookOut(BookIn):
    id: str
    updatedAt: datetime


class BookCreatedOut(BaseModel):
    id: str
    updatedAt: datetime
