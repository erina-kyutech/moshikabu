"""複数銘柄比較・積立投資の計算（純粋関数）。

ネットワークには触れず、株価履歴と分割情報を受け取って計算するだけ。
株価の扱いは simulation.py と同じ前提に立つ:

  - プロバイダが返す終値 adj(t) は「分割調整後」（今日基準）
  - 当時実際に約定した株価 = adj(t) × その後の分割倍率 F(t)
  - 金額 A を t 日に投資したときの「今日換算の保有株数」
      = A / (adj(t) × F(t)) × F(t) = A / adj(t)
    → 分割を意識せずに adj(t) だけで積み上げられる

通貨は「基準通貨（円）」と「現地通貨」を切り替えられるようにしてある。
為替レートは日付ごとの関数として外から渡すため、
将来ほかの通貨ペアを足すときもこのモジュールは変更不要。
"""
from __future__ import annotations

import calendar
import math
from bisect import bisect_right
from dataclasses import dataclass, field
from datetime import date
from typing import Callable, Sequence

from ..providers.base import PricePoint, Split
from .simulation import SimulationError, split_factor_after

# 毎月の買付日として選べる値。"end" は月末。
BuyDay = int | str
VALID_BUY_DAYS: tuple[BuyDay, ...] = (1, 5, 10, 15, 20, 25, "end")


# --------------------------------------------------------------------- 通貨
@dataclass(frozen=True)
class Money:
    """現地通貨と基準通貨のあいだの換算。

    rate_at(d) は「現地通貨1単位 = 基準通貨いくらか」を返す。
    日本株や現地通貨モードでは常に 1.0。
    """

    base_currency: str
    local_currency: str
    rate_at: Callable[[date], float]

    def to_base(self, local_value: float, d: date) -> float:
        return local_value * self.rate_at(d)

    def to_local(self, base_amount: float, d: date) -> float:
        rate = self.rate_at(d)
        if rate <= 0:
            raise SimulationError("為替レートを取得できませんでした。")
        return base_amount / rate


def identity_money(currency: str) -> Money:
    """換算しない（現地通貨＝基準通貨）。"""
    return Money(base_currency=currency, local_currency=currency, rate_at=lambda _d: 1.0)


def make_rate_lookup(points: Sequence[PricePoint], fallback: float) -> Callable[[date], float]:
    """日付 → その日以前で最も新しいレート。無ければ fallback。"""
    if not points:
        return lambda _d: fallback
    ordered = sorted(points, key=lambda p: p.date)
    dates = [p.date for p in ordered]
    closes = [p.close for p in ordered]

    def lookup(d: date) -> float:
        i = bisect_right(dates, d)
        if i == 0:
            return closes[0]
        value = closes[i - 1]
        return value if value and value > 0 else fallback

    return lookup


def make_price_lookup(points: Sequence[PricePoint]) -> Callable[[date], float | None]:
    """日付 → その日以前で最も新しい分割調整後終値。"""
    if not points:
        return lambda _d: None
    dates = [p.date for p in points]
    closes = [p.close for p in points]

    def lookup(d: date) -> float | None:
        i = bisect_right(dates, d)
        return closes[i - 1] if i > 0 else None

    return lookup


# ------------------------------------------------------------- 一括投資（比較）
@dataclass(frozen=True)
class ComparisonItem:
    ticker: str
    trade_date: date
    market_closed: bool
    purchase_price: float        # 当時の実際の株価（現地通貨・分割調整前）
    shares: float                # 当時買えた株数
    shares_now: float            # 分割反映後の株数
    split_factor: float
    splits: list[Split]
    invested_local: float        # 現地通貨での投資額
    invested: float              # 基準通貨での投資額
    current_price: float
    current_date: date
    current_value: float         # 基準通貨
    profit: float
    return_pct: float
    fx_rate_at_buy: float
    fx_rate_now: float
    series: list[tuple[date, float]] = field(default_factory=list)


def simulate_lump_investment(
    points: Sequence[PricePoint],
    splits: Sequence[Split],
    start: date,
    amount: float,
    money: Money,
    *,
    allow_fractional: bool = True,
) -> ComparisonItem:
    """`start` 以降の最初の取引日に amount（基準通貨）を投じた場合。"""
    if not points:
        raise SimulationError("株価データを取得できませんでした。")
    if amount <= 0:
        raise SimulationError("投資金額は1以上を指定してください。")

    buy = next((p for p in points if p.date >= start), None)
    if buy is None:
        raise SimulationError("指定日以降の株価データが見つかりませんでした。")

    factor, applied = split_factor_after(list(splits), buy.date)
    purchase_price = buy.close * factor
    if purchase_price <= 0:
        raise SimulationError("株価が取得できませんでした。")

    rate_at_buy = money.rate_at(buy.date)
    invested_local = money.to_local(amount, buy.date)

    shares = invested_local / purchase_price
    if not allow_fractional:
        shares = float(math.floor(shares))
        if shares < 1:
            raise SimulationError("投資金額が1株分の価格に届いていません。")
        invested_local = shares * purchase_price

    shares_now = shares * factor
    invested_base = money.to_base(invested_local, buy.date)

    latest = points[-1]
    rate_now = money.rate_at(latest.date)
    current_value = money.to_base(shares_now * latest.close, latest.date)
    profit = current_value - invested_base

    series = [
        (p.date, money.to_base(shares_now * p.close, p.date)) for p in points if p.date >= buy.date
    ]

    return ComparisonItem(
        ticker="",
        trade_date=buy.date,
        market_closed=buy.date != start,
        purchase_price=purchase_price,
        shares=shares,
        shares_now=shares_now,
        split_factor=factor,
        splits=applied,
        invested_local=invested_local,
        invested=invested_base,
        current_price=latest.close * 1.0,
        current_date=latest.date,
        current_value=current_value,
        profit=profit,
        return_pct=(profit / invested_base * 100) if invested_base else 0.0,
        fx_rate_at_buy=rate_at_buy,
        fx_rate_now=rate_now,
        series=series,
    )


# ------------------------------------------------------------------- 積立投資
def month_targets(start: date, until: date, buy_day: BuyDay) -> list[date]:
    """積立の「予定買付日」を月ごとに並べる。"""
    if buy_day not in VALID_BUY_DAYS:
        raise SimulationError("買付日の指定が不正です。")

    targets: list[date] = []
    year, month = start.year, start.month
    while True:
        last_day = calendar.monthrange(year, month)[1]
        day = last_day if buy_day == "end" else min(int(buy_day), last_day)
        target = date(year, month, day)
        if target > until:
            break
        if target >= date(start.year, start.month, 1):
            targets.append(target)
        month += 1
        if month > 12:
            month = 1
            year += 1
        if len(targets) > 1200:  # 100年分。無限ループ防止
            break
    return targets


@dataclass(frozen=True)
class Lot:
    """1回分の買付。"""

    requested_date: date  # 予定していた買付日
    trade_date: date      # 実際に約定した取引日
    market_closed: bool
    price: float          # 当時の実際の株価（現地通貨・分割調整前）
    shares: float         # 当時買えた株数
    shares_now: float     # 分割反映後の株数
    amount: float         # 投資額（基準通貨）
    amount_local: float   # 投資額（現地通貨）
    fx_rate: float


@dataclass(frozen=True)
class RecurringSimulation:
    lots: list[Lot]
    invested: float           # 基準通貨の累計投資額
    shares_now: float
    current_price: float
    current_date: date
    current_value: float
    profit: float
    return_pct: float
    months: int
    series: list[tuple[date, float, float]] = field(default_factory=list)  # (日付, 評価額, 元本)


def simulate_recurring(
    points: Sequence[PricePoint],
    splits: Sequence[Split],
    start: date,
    monthly_amount: float,
    money: Money,
    *,
    buy_day: BuyDay = 1,
    until: date | None = None,
    contributions_end: date | None = None,
    allow_fractional: bool = True,
) -> RecurringSimulation:
    """毎月 monthly_amount（基準通貨）ずつ積み立てた場合。

    contributions_end を指定すると、その日以降は積立を止めて保有だけ続ける
    （一括 vs 積立の比較で使う）。
    """
    if not points:
        raise SimulationError("株価データを取得できませんでした。")
    if monthly_amount <= 0:
        raise SimulationError("毎月の積立金額は1以上を指定してください。")

    last_date = until or points[-1].date
    split_list = list(splits)

    targets = month_targets(start, min(last_date, contributions_end or last_date), buy_day)
    if not targets:
        raise SimulationError("積立できる期間がありません。開始日を見直してください。")

    lots: list[Lot] = []
    for target in targets:
        # 休場日なら次の取引日
        point = next((p for p in points if p.date >= target), None)
        if point is None or point.date > last_date:
            continue
        factor, _ = split_factor_after(split_list, point.date)
        price = point.close * factor
        if price <= 0:
            continue

        amount_local = money.to_local(monthly_amount, point.date)
        shares = amount_local / price
        if not allow_fractional:
            shares = float(math.floor(shares))
            if shares < 1:
                continue
            amount_local = shares * price

        lots.append(
            Lot(
                requested_date=target,
                trade_date=point.date,
                market_closed=point.date != target,
                price=price,
                shares=shares,
                shares_now=shares * factor,
                amount=money.to_base(amount_local, point.date),
                amount_local=amount_local,
                fx_rate=money.rate_at(point.date),
            )
        )

    if not lots:
        raise SimulationError("この条件では買付できる日がありませんでした。")

    invested = sum(lot.amount for lot in lots)
    shares_now = sum(lot.shares_now for lot in lots)

    latest = points[-1]
    current_value = money.to_base(shares_now * latest.close, latest.date)
    profit = current_value - invested

    # 評価額と元本の推移
    series: list[tuple[date, float, float]] = []
    lot_index = 0
    running_shares = 0.0
    running_invested = 0.0
    first_trade = lots[0].trade_date
    for p in points:
        if p.date < first_trade:
            continue
        while lot_index < len(lots) and lots[lot_index].trade_date <= p.date:
            running_shares += lots[lot_index].shares_now
            running_invested += lots[lot_index].amount
            lot_index += 1
        series.append((p.date, money.to_base(running_shares * p.close, p.date), running_invested))

    return RecurringSimulation(
        lots=lots,
        invested=invested,
        shares_now=shares_now,
        current_price=latest.close,
        current_date=latest.date,
        current_value=current_value,
        profit=profit,
        return_pct=(profit / invested * 100) if invested else 0.0,
        months=len(lots),
        series=series,
    )


def contribution_window_end(start: date, months: int) -> date:
    """`months` 回ぶんの積立が収まる最後の日（最終買付月の末日）。

    買付日の指定（1日／月末など）によらず回数がちょうど months になるよう、
    月末までを含める。
    """
    if months < 1:
        raise SimulationError("積立月数は1以上を指定してください。")
    offset = start.month - 1 + months - 1
    year = start.year + offset // 12
    month = offset % 12 + 1
    return date(year, month, calendar.monthrange(year, month)[1])


def months_between(start: date, end: date) -> int:
    """暦月での月数（積立期間の表示用）。"""
    months = (end.year - start.year) * 12 + (end.month - start.month)
    if end.day < start.day:
        months -= 1
    return max(0, months)
