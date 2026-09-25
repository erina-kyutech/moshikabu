"""スクリーニングとバックテストのテスト（ネットワーク不要）。"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from app.providers.base import Fundamentals
from app.services import backtest as bt
from app.services.screening import Condition, ScreeningError, check, screen, validate


def snap(ticker: str, **values) -> Fundamentals:
    return Fundamentals(ticker=ticker, as_of=date(2026, 4, 1), values=values)


CONDITIONS = [
    Condition("pbr", "<=", 1.0),
    Condition("revenueGrowth", ">=", 20),
    Condition("roe", ">=", 10),
]


# ------------------------------------------------------------ スクリーニング
def test_matches_when_all_conditions_pass():
    result = screen(CONDITIONS, {"A.T": snap("A.T", pbr=0.8, revenueGrowth=28.1, roe=14.2)})
    assert [r.ticker for r in result.matched] == ["A.T"]
    assert all(c.passed for c in result.matched[0].checks)


def test_rejected_when_one_condition_fails():
    result = screen(CONDITIONS, {"A.T": snap("A.T", pbr=1.4, revenueGrowth=28.1, roe=14.2)})
    assert result.matched == []
    assert [r.ticker for r in result.rejected] == ["A.T"]
    failed = [c.metric for c in result.rejected[0].checks if not c.passed]
    assert failed == ["pbr"]


def test_missing_metric_is_excluded_not_passed():
    """指標が取れない銘柄を「条件を満たす」と扱わない（0で埋めない）。"""
    result = screen(CONDITIONS, {"A.T": snap("A.T", pbr=0.8, roe=14.2)})
    assert result.matched == [] and result.rejected == []
    assert "A.T" in result.excluded
    assert "売上高成長率" in result.excluded["A.T"]


def test_snapshot_none_is_excluded():
    result = screen(CONDITIONS, {"A.T": None})
    assert result.excluded["A.T"] == "財務データを取得できませんでした"


def test_boundary_is_inclusive():
    result = screen([Condition("pbr", "<=", 1.0)], {"A.T": snap("A.T", pbr=1.0)})
    assert len(result.matched) == 1
    result = screen([Condition("pbr", "<", 1.0)], {"A.T": snap("A.T", pbr=1.0)})
    assert len(result.rejected) == 1


def test_check_reports_actual_values():
    row = check(CONDITIONS, snap("A.T", pbr=0.82, revenueGrowth=28.1, roe=14.2))
    assert row.matched
    assert [c.actual for c in row.checks] == [0.82, 28.1, 14.2]


def test_validate_rejects_unknown_metric_and_operator():
    with pytest.raises(ScreeningError):
        validate([Condition("unknown", ">=", 1)])
    with pytest.raises(ScreeningError):
        validate([Condition("pbr", "~=", 1)])
    with pytest.raises(ScreeningError):
        validate([])


def test_validate_rejects_non_historical_metric_for_backtest():
    """配当利回りは過去時点を再現できないのでバックテストでは使えない。"""
    validate([Condition("dividendYield", ">=", 3)])  # スクリーニングならOK
    with pytest.raises(ScreeningError) as e:
        validate([Condition("dividendYield", ">=", 3)], require_historical=True)
    assert "配当利回り" in str(e.value)


# -------------------------------------------------------------- バックテスト
class FakeData:
    """価格と財務データを固定で返すテスト用のデータ層。"""

    def __init__(self, prices, fundamentals, bench=None):
        self._prices = prices              # {ticker: {date: price}}
        self._fundamentals = fundamentals  # {ticker: {date: Fundamentals|None}}
        self._bench = bench or {}

    def universe(self):
        return list(self._prices)

    def name_of(self, ticker):
        return f"{ticker}社"

    def fundamentals(self, ticker, on):
        return self._fundamentals.get(ticker, {}).get(on)

    def price(self, ticker, on):
        series = self._prices.get(ticker, {})
        past = [d for d in series if d <= on]
        return series[max(past)] if past else None

    def benchmark(self, on):
        past = [d for d in self._bench if d <= on]
        return self._bench[max(past)] if past else None


D2024, D2025, D2026 = date(2024, 4, 1), date(2025, 4, 1), date(2026, 4, 1)


def simple_config(**over):
    base = dict(
        conditions=[Condition("pbr", "<=", 1.0)],
        start=D2024,
        end=D2026,
        screening_month=4,
        holding_months=12,
        initial_capital=1_000_000,
    )
    base.update(over)
    return bt.BacktestConfig(**base)


def test_screening_dates_are_yearly():
    assert bt.screening_dates(simple_config()) == [D2024, D2025, D2026]
    assert bt.screening_dates(simple_config(screening_month=10)) == [date(2024, 10, 1), date(2025, 10, 1)]


def test_add_months_handles_month_end():
    assert bt.add_months(date(2024, 1, 31), 1) == date(2024, 2, 29)   # 閏年
    assert bt.add_months(date(2025, 1, 31), 1) == date(2025, 2, 28)
    assert bt.add_months(date(2025, 4, 1), 12) == date(2026, 4, 1)


def test_single_cohort_doubles_capital():
    """1銘柄が2倍になれば、資金も2倍になる。"""
    data = FakeData(
        prices={"A.T": {D2024: 100, D2025: 200}},
        fundamentals={"A.T": {D2024: snap("A.T", pbr=0.5)}},
    )
    result = bt.run(simple_config(end=D2025), data)
    assert len(result.trades) == 1
    assert result.final_value == pytest.approx(2_000_000)
    assert result.profit == pytest.approx(1_000_000)
    assert result.return_rate == pytest.approx(100)
    assert result.win_rate == 100
    assert result.average_return == pytest.approx(100)


def test_equal_weight_across_matched_stocks():
    data = FakeData(
        prices={
            "A.T": {D2024: 100, D2025: 150},   # +50%
            "B.T": {D2024: 100, D2025: 50},    # -50%
            "C.T": {D2024: 100, D2025: 100},   # 条件を満たさない
        },
        fundamentals={
            "A.T": {D2024: snap("A.T", pbr=0.5)},
            "B.T": {D2024: snap("B.T", pbr=0.8)},
            "C.T": {D2024: snap("C.T", pbr=2.0)},
        },
    )
    result = bt.run(simple_config(end=D2025), data)
    assert sorted(t.ticker for t in result.trades) == ["A.T", "B.T"]
    assert all(t.invested == pytest.approx(500_000) for t in result.trades)
    assert result.final_value == pytest.approx(750_000 + 250_000)
    assert result.win_rate == pytest.approx(50)
    assert result.average_return == pytest.approx(0)
    assert result.median_return == pytest.approx(0)


def test_profits_compound_into_the_next_year():
    data = FakeData(
        prices={"A.T": {D2024: 100, D2025: 200, D2026: 300}},
        fundamentals={
            "A.T": {D2024: snap("A.T", pbr=0.5), D2025: snap("A.T", pbr=0.5), D2026: snap("A.T", pbr=0.5)}
        },
    )
    result = bt.run(simple_config(), data)
    # 100万 → 200万（1年目）→ 300万（2年目は 200→300 で1.5倍）
    assert result.final_value == pytest.approx(3_000_000)
    assert len(result.trades) == 2


def test_stock_without_data_is_excluded_from_that_year():
    data = FakeData(
        prices={"A.T": {D2024: 100, D2025: 120}, "B.T": {D2024: 100, D2025: 500}},
        fundamentals={
            "A.T": {D2024: snap("A.T", pbr=0.5)},
            "B.T": {D2024: None},   # その時点では財務データが無い
        },
    )
    result = bt.run(simple_config(end=D2025), data)
    assert [t.ticker for t in result.trades] == ["A.T"]
    assert sum(result.excluded_counts.values()) == 1


def test_yearly_results_and_benchmark():
    data = FakeData(
        prices={"A.T": {D2024: 100, D2025: 130, D2026: 117}},
        fundamentals={"A.T": {D2024: snap("A.T", pbr=0.5), D2025: snap("A.T", pbr=0.5)}},
        bench={D2024: 1000, D2025: 1100, D2026: 1155},
    )
    result = bt.run(simple_config(), data)
    y2024, y2025 = result.yearly[0], result.yearly[1]
    assert y2024.year == 2024 and y2024.trades == 1
    assert y2024.average_return == pytest.approx(30)
    assert y2024.benchmark_return == pytest.approx(10)
    assert y2025.average_return == pytest.approx(-10)
    assert y2025.benchmark_return == pytest.approx(5)
    assert result.benchmark_return == pytest.approx(15.5)


def test_no_matches_leaves_capital_untouched():
    data = FakeData(
        prices={"A.T": {D2024: 100, D2025: 900}},
        fundamentals={"A.T": {D2024: snap("A.T", pbr=5.0)}},
    )
    result = bt.run(simple_config(end=D2025), data)
    assert result.trades == []
    assert result.final_value == pytest.approx(1_000_000)
    assert result.profit == 0
    assert result.notes


def test_equity_curve_starts_at_capital_and_ends_at_final_value():
    data = FakeData(
        prices={"A.T": {D2024: 100, date(2024, 10, 1): 150, D2025: 200}},
        fundamentals={"A.T": {D2024: snap("A.T", pbr=0.5)}},
        bench={D2024: 1000, D2025: 1200},
    )
    result = bt.run(simple_config(end=D2025), data)
    assert result.equity[0].value == pytest.approx(1_000_000)
    assert result.equity[-1].value == pytest.approx(result.final_value)
    # 保有中は時価で評価される
    mid = next(p for p in result.equity if p.date == date(2024, 10, 1))
    assert mid.value == pytest.approx(1_500_000)
    # ベンチマークは同じ初期資金から始める
    assert result.equity[0].benchmark == pytest.approx(1_000_000)


def test_holding_period_is_respected():
    data = FakeData(
        prices={"A.T": {D2024: 100, date(2024, 7, 1): 150, D2025: 500}},
        fundamentals={"A.T": {D2024: snap("A.T", pbr=0.5)}},
    )
    result = bt.run(simple_config(end=D2025, holding_months=3), data)
    assert result.trades[0].sell_date == date(2024, 7, 1)
    assert result.final_value == pytest.approx(1_500_000)   # 7月に売って現金のまま


def test_invalid_config():
    data = FakeData(prices={}, fundamentals={})
    with pytest.raises(ScreeningError):
        bt.run(simple_config(holding_months=2), data)
    with pytest.raises(ScreeningError):
        bt.run(simple_config(start=D2026, end=D2024), data)
    with pytest.raises(ScreeningError):
        bt.run(simple_config(initial_capital=0), data)
