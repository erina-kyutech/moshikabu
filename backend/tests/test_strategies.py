"""複数銘柄比較・積立投資の計算テスト（ネットワーク不要）。"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from app.providers.base import PricePoint, Split
from app.services.simulation import SimulationError
from app.services.strategies import (
    Money,
    identity_money,
    make_rate_lookup,
    month_targets,
    months_between,
    simulate_lump_investment,
    simulate_recurring,
)

JPY = identity_money("JPY")


def p(d: str, close: float) -> PricePoint:
    return PricePoint(date=date.fromisoformat(d), close=close)


# ------------------------------------------------------------------ 買付日
def test_month_targets_basic():
    targets = month_targets(date(2024, 1, 1), date(2024, 4, 15), 1)
    assert targets == [date(2024, 1, 1), date(2024, 2, 1), date(2024, 3, 1), date(2024, 4, 1)]


def test_month_targets_month_end_handles_february():
    targets = month_targets(date(2024, 1, 15), date(2024, 3, 31), "end")
    assert targets == [date(2024, 1, 31), date(2024, 2, 29), date(2024, 3, 31)]  # 2024 は閏年


def test_month_targets_clamps_day_to_month_length():
    # 2月に「25日」は存在するのでそのまま。存在しない日付は月末に丸める
    assert month_targets(date(2023, 1, 1), date(2023, 2, 28), 25) == [
        date(2023, 1, 25),
        date(2023, 2, 25),
    ]


def test_month_targets_stops_at_until():
    assert month_targets(date(2024, 1, 1), date(2023, 12, 31), 1) == []


def test_months_between():
    assert months_between(date(2020, 1, 10), date(2026, 9, 13)) == 80
    assert months_between(date(2020, 1, 10), date(2020, 2, 9)) == 0
    assert months_between(date(2020, 1, 10), date(2020, 2, 10)) == 1


# ------------------------------------------------------------------ 一括投資
LUMP_POINTS = [p("2020-01-06", 100.0), p("2020-06-01", 150.0), p("2026-09-11", 250.0)]


def test_lump_basic():
    r = simulate_lump_investment(LUMP_POINTS, [], date(2020, 1, 6), 1_000_000, JPY)
    assert r.trade_date == date(2020, 1, 6)
    assert r.purchase_price == 100.0
    assert r.shares == 10_000
    assert r.invested == 1_000_000
    assert r.current_value == 2_500_000
    assert r.profit == 1_500_000
    assert r.return_pct == 150.0


def test_lump_rolls_forward_from_holiday():
    r = simulate_lump_investment(LUMP_POINTS, [], date(2020, 1, 1), 1_000_000, JPY)
    assert r.market_closed is True
    assert r.trade_date == date(2020, 1, 6)


def test_lump_reflects_split():
    """購入後の 1:4 分割。当時の株価は4倍、保有株数も4倍になり、リターンは変わらない。"""
    splits = [Split(date=date(2021, 1, 1), ratio=4.0)]
    r = simulate_lump_investment(LUMP_POINTS, splits, date(2020, 1, 6), 1_000_000, JPY)
    assert r.purchase_price == 400.0          # 調整後100 × 4
    assert r.shares == 2_500                  # 100万 ÷ 400
    assert r.shares_now == 10_000             # 分割で4倍
    assert r.current_value == 2_500_000
    assert r.return_pct == 150.0


def test_lump_integer_shares_only():
    r = simulate_lump_investment(
        [p("2020-01-06", 300.0), p("2026-09-11", 400.0)],
        [],
        date(2020, 1, 6),
        1_000_000,
        JPY,
        allow_fractional=False,
    )
    assert r.shares == 3_333
    assert r.invested == 3_333 * 300
    assert r.current_value == 3_333 * 400


def test_lump_amount_too_small_for_one_share():
    with pytest.raises(SimulationError):
        simulate_lump_investment(
            [p("2020-01-06", 5000.0), p("2026-09-11", 6000.0)],
            [],
            date(2020, 1, 6),
            1000,
            JPY,
            allow_fractional=False,
        )


def test_lump_series_starts_at_invested_amount():
    r = simulate_lump_investment(LUMP_POINTS, [], date(2020, 1, 6), 1_000_000, JPY)
    assert r.series[0] == (date(2020, 1, 6), 1_000_000)
    assert r.series[-1] == (date(2026, 9, 11), 2_500_000)


# ---------------------------------------------------------------- 為替換算
def test_lump_converts_usd_to_jpy():
    """円で100万円ぶんの米国株を買う。株価2倍・円安1.5倍なら評価額は3倍。"""
    fx = Money(
        base_currency="JPY",
        local_currency="USD",
        rate_at=make_rate_lookup(
            [p("2020-01-06", 100.0), p("2026-09-11", 150.0)], fallback=100.0
        ),
    )
    points = [p("2020-01-06", 10.0), p("2026-09-11", 20.0)]
    r = simulate_lump_investment(points, [], date(2020, 1, 6), 1_000_000, fx)

    assert r.invested_local == pytest.approx(10_000)   # 100万円 ÷ 100円/ドル = 1万ドル
    assert r.shares == pytest.approx(1_000)            # 1万ドル ÷ 10ドル
    assert r.invested == pytest.approx(1_000_000)
    # 1000株 × 20ドル × 150円 = 300万円
    assert r.current_value == pytest.approx(3_000_000)
    assert r.return_pct == pytest.approx(200.0)


def test_rate_lookup_uses_latest_value_at_or_before_date():
    lookup = make_rate_lookup([p("2020-01-06", 100.0), p("2020-02-03", 110.0)], fallback=1.0)
    assert lookup(date(2019, 1, 1)) == 100.0   # 最初より前は先頭値
    assert lookup(date(2020, 1, 20)) == 100.0
    assert lookup(date(2020, 2, 3)) == 110.0
    assert lookup(date(2026, 1, 1)) == 110.0


# ------------------------------------------------------------------ 積立投資
DCA_POINTS = [
    p("2024-01-01", 100.0),
    p("2024-02-01", 200.0),
    p("2024-03-01", 50.0),
    p("2024-03-15", 400.0),
]


def test_recurring_accumulates_shares_and_principal():
    r = simulate_recurring(DCA_POINTS, [], date(2024, 1, 1), 10_000, JPY, until=date(2024, 3, 15))
    assert r.months == 3
    assert r.invested == 30_000
    # 100株 + 50株 + 200株
    assert r.shares_now == pytest.approx(100 + 50 + 200)
    assert r.current_price == 400.0
    assert r.current_value == pytest.approx(350 * 400)
    assert r.profit == pytest.approx(140_000 - 30_000)


def test_recurring_rolls_forward_from_holiday():
    """1/1 が休場なら次の取引日で買う。"""
    points = [p("2024-01-04", 100.0), p("2024-02-01", 100.0)]
    r = simulate_recurring(points, [], date(2024, 1, 1), 10_000, JPY, until=date(2024, 2, 1))
    assert r.lots[0].requested_date == date(2024, 1, 1)
    assert r.lots[0].trade_date == date(2024, 1, 4)
    assert r.lots[0].market_closed is True


def test_recurring_reflects_split_in_each_lot():
    """買付後に 1:2 分割。当時の株価は2倍、当時の株数は半分、今の株数は同じ。"""
    splits = [Split(date=date(2024, 2, 15), ratio=2.0)]
    points = [p("2024-01-01", 100.0), p("2024-03-01", 120.0)]
    r = simulate_recurring(points, splits, date(2024, 1, 1), 10_000, JPY, until=date(2024, 3, 1))

    first = r.lots[0]
    assert first.price == 200.0        # 調整後100 × 分割2
    assert first.shares == 50.0        # 当時は50株買えた
    assert first.shares_now == 100.0   # 分割後は100株
    second = r.lots[1]
    assert second.price == 120.0       # 分割後の買付は調整不要
    assert second.shares == second.shares_now


def test_recurring_series_tracks_principal_as_steps():
    r = simulate_recurring(DCA_POINTS, [], date(2024, 1, 1), 10_000, JPY, until=date(2024, 3, 15))
    principals = [round(pr) for _, _, pr in r.series]
    assert principals == [10_000, 20_000, 30_000, 30_000]
    # 最初の点では元本と評価額が一致する
    assert r.series[0][1] == pytest.approx(10_000)


def test_recurring_stops_contributions_at_end():
    r = simulate_recurring(
        DCA_POINTS,
        [],
        date(2024, 1, 1),
        10_000,
        JPY,
        until=date(2024, 3, 15),
        contributions_end=date(2024, 2, 10),
    )
    assert r.months == 2
    assert r.invested == 20_000
    # 積立をやめても保有は続くので、最後まで評価額は動く
    assert r.series[-1][0] == date(2024, 3, 15)
    assert r.series[-1][2] == pytest.approx(20_000)


def test_recurring_buy_day_option():
    points = [p("2024-01-15", 100.0), p("2024-02-15", 100.0)]
    r = simulate_recurring(
        points, [], date(2024, 1, 1), 10_000, JPY, buy_day=15, until=date(2024, 2, 15)
    )
    assert [lot.trade_date for lot in r.lots] == [date(2024, 1, 15), date(2024, 2, 15)]


def test_recurring_rejects_empty_period():
    with pytest.raises(SimulationError):
        simulate_recurring([p("2024-01-01", 100.0)], [], date(2030, 1, 1), 10_000, JPY)


def test_recurring_converts_usd_to_jpy_per_lot():
    """円建てで毎月1万円。為替が動くと買えるドル額が変わる。"""
    fx = Money(
        base_currency="JPY",
        local_currency="USD",
        rate_at=make_rate_lookup([p("2024-01-01", 100.0), p("2024-02-01", 125.0)], fallback=100.0),
    )
    points = [p("2024-01-01", 10.0), p("2024-02-01", 10.0)]
    r = simulate_recurring(points, [], date(2024, 1, 1), 10_000, fx, until=date(2024, 2, 1))

    assert r.lots[0].amount_local == pytest.approx(100)   # 1万円 ÷ 100 = 100ドル
    assert r.lots[1].amount_local == pytest.approx(80)    # 1万円 ÷ 125 = 80ドル
    assert r.lots[0].shares == pytest.approx(10)
    assert r.lots[1].shares == pytest.approx(8)
    assert r.invested == pytest.approx(20_000)
    # 18株 × 10ドル × 125円 = 22,500円
    assert r.current_value == pytest.approx(22_500)


# --------------------------------------------------- 一括 vs 積立の積立期間
def test_contribution_window_end_gives_exact_month_count():
    from app.services.strategies import contribution_window_end

    # 2020-01 から60回 → 最終買付月は 2024-12（その末日まで）
    end = contribution_window_end(date(2020, 1, 1), 60)
    assert end == date(2024, 12, 31)
    # 買付日が1日でも月末でも、回数はちょうど60回になる
    assert len(month_targets(date(2020, 1, 1), end, 1)) == 60
    assert len(month_targets(date(2020, 1, 1), end, "end")) == 60
    assert len(month_targets(date(2020, 1, 1), end, 25)) == 60


def test_contribution_window_end_wraps_year():
    from app.services.strategies import contribution_window_end

    assert contribution_window_end(date(2023, 11, 1), 3) == date(2024, 1, 31)
    assert contribution_window_end(date(2024, 1, 1), 1) == date(2024, 1, 31)
