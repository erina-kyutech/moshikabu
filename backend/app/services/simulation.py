"""シミュレーション計算（純粋関数）。

ネットワークに依存しないため単体テストが容易。
株式分割の扱いが要点:
  - プロバイダが返す終値は「分割調整後」である
  - 実際にその日に支払った株価 = 分割調整後終値 × その後の分割倍率
  - 現在保有している株数        = 購入株数 × その後の分割倍率
  - よって評価額 = 購入株数 × 分割倍率 × 分割調整後終値(t) となり時系列として連続する
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date

from ..providers.base import Dividend, PricePoint, Split


class SimulationError(Exception):
    """入力が不正、またはデータが足りずシミュレーションできない。"""


@dataclass(frozen=True)
class ValuePoint:
    date: date
    price: float   # 分割調整後の株価
    value: float   # 仮想資産額


@dataclass(frozen=True)
class PastSimulation:
    requested_date: date
    trade_date: date
    market_closed: bool          # 指定日が休場でずれたか
    purchase_price: float        # 当時実際に約定したであろう株価（分割調整前）
    purchase_price_adjusted: float
    shares: float                # 購入した株数
    shares_now: float            # 分割反映後に保有している株数
    split_factor: float
    splits: list[Split]
    invested: float
    requested_amount: float | None
    leftover_cash: float
    current_price: float
    current_date: date
    current_value: float
    profit: float
    return_pct: float
    dividend_total: float
    include_dividends: bool
    series: list[ValuePoint] = field(default_factory=list)


def split_factor_after(splits: list[Split], after: date, until: date | None = None) -> tuple[float, list[Split]]:
    """`after` より後（`until` まで）に発生した分割の累積倍率を返す。"""
    applied = [s for s in splits if s.date > after and (until is None or s.date <= until)]
    factor = 1.0
    for s in applied:
        factor *= s.ratio
    return factor, applied


def resolve_trade_point(points: list[PricePoint], requested: date) -> PricePoint:
    """指定日、休場ならその次の取引日の終値を返す。"""
    for p in points:
        if p.date >= requested:
            return p
    raise SimulationError("指定日以降の株価データが見つかりませんでした。")


def shares_from_amount(amount: float, price: float, allow_fractional: bool = False) -> float:
    if price <= 0:
        raise SimulationError("株価が取得できませんでした。")
    raw = amount / price
    if allow_fractional:
        return raw
    shares = math.floor(raw)
    if shares < 1:
        raise SimulationError("投資金額が1株分の価格に届いていません。金額を増やしてください。")
    return float(shares)


def simulate_past(
    points: list[PricePoint],
    splits: list[Split],
    requested_date: date,
    *,
    shares: float | None = None,
    amount: float | None = None,
    dividends: list[Dividend] | None = None,
    include_dividends: bool = False,
    allow_fractional: bool = False,
) -> PastSimulation:
    if not points:
        raise SimulationError("株価データを取得できませんでした。")
    if (shares is None) == (amount is None):
        raise SimulationError("購入株数または投資金額のどちらか一方を指定してください。")

    buy = resolve_trade_point(points, requested_date)
    latest = points[-1]

    factor, applied = split_factor_after(splits, buy.date)
    purchase_price = buy.close * factor          # 当時の実際の株価
    purchase_price = round(purchase_price, 4)

    if shares is None:
        shares = shares_from_amount(float(amount), purchase_price, allow_fractional)
    if shares <= 0:
        raise SimulationError("購入株数は1株以上を指定してください。")

    invested = shares * purchase_price
    shares_now = shares * factor

    current_price = latest.close
    current_value = shares_now * current_price

    dividend_total = 0.0
    if include_dividends and dividends:
        per_share = sum(d.amount for d in dividends if d.date > buy.date)
        dividend_total = shares_now * per_share

    total_value = current_value + dividend_total
    profit = total_value - invested
    return_pct = (profit / invested * 100) if invested else 0.0

    series = [
        ValuePoint(date=p.date, price=p.close, value=shares_now * p.close)
        for p in points
        if p.date >= buy.date
    ]

    return PastSimulation(
        requested_date=requested_date,
        trade_date=buy.date,
        market_closed=buy.date != requested_date,
        purchase_price=purchase_price,
        purchase_price_adjusted=buy.close,
        shares=shares,
        shares_now=shares_now,
        split_factor=factor,
        splits=applied,
        invested=invested,
        requested_amount=float(amount) if amount is not None else None,
        leftover_cash=(float(amount) - invested) if amount is not None else 0.0,
        current_price=current_price,
        current_date=latest.date,
        current_value=current_value,
        profit=profit,
        return_pct=return_pct,
        dividend_total=dividend_total,
        include_dividends=include_dividends,
        series=series,
    )


def downsample(items: list, max_points: int = 400) -> list:
    """チャート用に間引く（先頭と末尾は必ず残す）。"""
    n = len(items)
    if n <= max_points or max_points < 2:
        return items
    step = (n - 1) / (max_points - 1)
    picked = [items[round(i * step)] for i in range(max_points)]
    if picked[-1] is not items[-1]:
        picked[-1] = items[-1]
    return picked
