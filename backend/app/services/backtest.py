"""バックテストエンジン（純粋関数）。

データ取得は `BacktestData` 越しに行うため、この関数自体はネットワークに触れない。
（テストではフェイクのデータ層を渡して検証する）

考え方:
  1. 毎年きまった月に、その時点で「公表済みだった」財務データだけで銘柄を絞り込む
  2. そのとき持っている資金を、該当銘柄へ均等に投資する
  3. 指定した保有期間が過ぎたら全部売って現金に戻す
  4. 次の抽出日まで現金のまま持ち、また 1 に戻る

未来の情報を使わないことがこのエンジンの前提。
「その日に取得できなかった銘柄」は対象外として除外し、件数と理由を結果に残す。
"""
from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Protocol

from ..providers.base import Fundamentals
from .screening import Condition, ScreeningError, screen, validate

HOLDING_PERIODS = (1, 3, 6, 12)   # か月


@dataclass(frozen=True)
class BacktestConfig:
    conditions: list[Condition]
    start: date
    end: date
    screening_month: int = 4      # 毎年この月の1日に銘柄を抽出する
    holding_months: int = 12
    initial_capital: float = 1_000_000
    benchmark: str = "^TOPX"
    universe: str = "jp-large"
    max_positions: int = 30       # 1回の抽出で投資する上限（多すぎると1銘柄あたりが細かくなりすぎる）


class BacktestData(Protocol):
    """バックテストに必要なデータの取り出し口。"""

    def universe(self) -> list[str]: ...

    def name_of(self, ticker: str) -> str: ...

    def fundamentals(self, ticker: str, on: date) -> Fundamentals | None: ...

    def price(self, ticker: str, on: date) -> float | None:
        """その日（以前で直近）の株価。分割調整済み・基準通貨（円）に換算済み。"""

    def benchmark(self, on: date) -> float | None: ...


@dataclass(frozen=True)
class Trade:
    ticker: str
    name: str
    buy_date: date
    sell_date: date
    buy_price: float
    sell_price: float
    shares: float
    invested: float
    final_value: float
    profit: float
    return_pct: float


@dataclass(frozen=True)
class YearResult:
    year: int
    screening_date: date
    candidates: int          # 条件を満たした銘柄数
    excluded: int            # データ不足などで判定できなかった銘柄数
    trades: int
    win_rate: float
    average_return: float
    median_return: float
    benchmark_return: float | None
    profit: float


@dataclass(frozen=True)
class EquityPoint:
    date: date
    value: float
    benchmark: float | None


@dataclass(frozen=True)
class BacktestResult:
    total_invested: float
    final_value: float
    profit: float
    return_rate: float
    win_rate: float
    average_return: float
    median_return: float
    trades: list[Trade] = field(default_factory=list)
    yearly: list[YearResult] = field(default_factory=list)
    equity: list[EquityPoint] = field(default_factory=list)
    benchmark_return: float | None = None
    screening_dates: list[date] = field(default_factory=list)
    excluded_counts: dict[str, int] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


def add_months(d: date, months: int) -> date:
    """月を足す（月末は月の長さに合わせて丸める）。"""
    total = d.month - 1 + months
    year = d.year + total // 12
    month = total % 12 + 1
    day = min(d.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
                      31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return date(year, month, day)


def screening_dates(config: BacktestConfig) -> list[date]:
    """毎年の抽出日。検証期間に収まるものだけ。"""
    out: list[date] = []
    for year in range(config.start.year, config.end.year + 1):
        d = date(year, config.screening_month, 1)
        if config.start <= d <= config.end:
            out.append(d)
    return out


def _month_ends(start: date, end: date) -> list[date]:
    """資産推移グラフ用に、月ごとの区切り日を並べる。"""
    out = [start]
    cursor = add_months(date(start.year, start.month, 1), 1)
    while cursor <= end:
        out.append(cursor)
        cursor = add_months(cursor, 1)
    if out[-1] != end:
        out.append(end)
    return out


def run(config: BacktestConfig, data: BacktestData) -> BacktestResult:
    validate(config.conditions, require_historical=True)
    if config.start >= config.end:
        raise ScreeningError("検証終了日は開始日より後にしてください。")
    if config.holding_months not in HOLDING_PERIODS:
        raise ScreeningError("保有期間は1・3・6・12か月から選んでください。")
    if config.initial_capital <= 0:
        raise ScreeningError("初期資金は1以上で指定してください。")

    dates = screening_dates(config)
    if not dates:
        raise ScreeningError("検証期間に抽出日が含まれていません。期間または基準月を見直してください。")

    universe = data.universe()
    cash = config.initial_capital
    trades: list[Trade] = []
    yearly: list[YearResult] = []
    excluded_counts: dict[str, int] = {}
    notes: list[str] = []
    # (ticker, shares, sell_date) … 資産推移の計算に使う
    holdings: list[tuple[str, float, date]] = []

    for screening_date in dates:
        sell_date = min(add_months(screening_date, config.holding_months), config.end)
        if sell_date <= screening_date:
            continue

        snapshots = {t: data.fundamentals(t, screening_date) for t in universe}
        result = screen(config.conditions, snapshots)
        for reason in result.excluded.values():
            excluded_counts[reason] = excluded_counts.get(reason, 0) + 1

        picks = [row.ticker for row in result.matched][: config.max_positions]
        year_trades: list[Trade] = []

        if picks:
            # 持っている資金を該当銘柄へ均等に配分する
            per_stock = cash / len(picks)
            spent = 0.0
            for ticker in picks:
                buy_price = data.price(ticker, screening_date)
                sell_price = data.price(ticker, sell_date)
                if buy_price is None or sell_price is None or buy_price <= 0:
                    excluded_counts["売買時の株価を取得できませんでした"] = (
                        excluded_counts.get("売買時の株価を取得できませんでした", 0) + 1
                    )
                    continue
                shares = per_stock / buy_price
                final_value = shares * sell_price
                trade = Trade(
                    ticker=ticker,
                    name=data.name_of(ticker),
                    buy_date=screening_date,
                    sell_date=sell_date,
                    buy_price=buy_price,
                    sell_price=sell_price,
                    shares=shares,
                    invested=per_stock,
                    final_value=final_value,
                    profit=final_value - per_stock,
                    return_pct=(sell_price - buy_price) / buy_price * 100,
                )
                year_trades.append(trade)
                holdings.append((ticker, shares, sell_date))
                spent += per_stock

            cash -= spent
            cash += sum(t.final_value for t in year_trades)
            trades.extend(year_trades)

        returns = [t.return_pct for t in year_trades]
        bench_start = data.benchmark(screening_date)
        bench_end = data.benchmark(sell_date)
        bench_return = (
            (bench_end - bench_start) / bench_start * 100
            if bench_start and bench_end and bench_start > 0
            else None
        )

        yearly.append(
            YearResult(
                year=screening_date.year,
                screening_date=screening_date,
                candidates=len(result.matched),
                excluded=len(result.excluded),
                trades=len(year_trades),
                win_rate=(sum(1 for r in returns if r > 0) / len(returns) * 100) if returns else 0.0,
                average_return=(sum(returns) / len(returns)) if returns else 0.0,
                median_return=statistics.median(returns) if returns else 0.0,
                benchmark_return=bench_return,
                profit=sum(t.profit for t in year_trades),
            )
        )

    all_returns = [t.return_pct for t in trades]
    final_value = cash
    profit = final_value - config.initial_capital

    if not trades:
        notes.append("条件を満たす銘柄が1つも見つからなかったため、投資は行われませんでした。")

    return BacktestResult(
        total_invested=config.initial_capital,
        final_value=final_value,
        profit=profit,
        return_rate=profit / config.initial_capital * 100,
        win_rate=(sum(1 for r in all_returns if r > 0) / len(all_returns) * 100) if all_returns else 0.0,
        average_return=(sum(all_returns) / len(all_returns)) if all_returns else 0.0,
        median_return=statistics.median(all_returns) if all_returns else 0.0,
        trades=trades,
        yearly=yearly,
        equity=_equity_curve(config, data, trades),
        benchmark_return=_benchmark_total(config, data),
        screening_dates=dates,
        excluded_counts=excluded_counts,
        notes=notes,
    )


def _equity_curve(config: BacktestConfig, data: BacktestData, trades: list[Trade]) -> list[EquityPoint]:
    """月ごとの資産額。保有中は時価、保有していない期間は現金のまま。"""
    base_bench = data.benchmark(config.start)
    points: list[EquityPoint] = []

    for when in _month_ends(config.start, config.end):
        cash = config.initial_capital
        holding_value = 0.0
        for t in trades:
            if t.buy_date <= when:
                cash -= t.invested
                if when < t.sell_date:
                    price = data.price(t.ticker, when)
                    holding_value += t.shares * price if price else t.invested
                else:
                    cash += t.final_value
        bench = data.benchmark(when)
        points.append(
            EquityPoint(
                date=when,
                value=cash + holding_value,
                benchmark=(
                    config.initial_capital * bench / base_bench
                    if bench and base_bench and base_bench > 0
                    else None
                ),
            )
        )
    return points


def _benchmark_total(config: BacktestConfig, data: BacktestData) -> float | None:
    start = data.benchmark(config.start)
    end = data.benchmark(config.end)
    if not start or not end or start <= 0:
        return None
    return (end - start) / start * 100


def next_business_day(d: date) -> date:
    """土日なら翌営業日（祝日は株価データ側で吸収する）。"""
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d
