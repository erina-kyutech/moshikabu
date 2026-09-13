"""シミュレーション計算のテスト（ネットワーク不要）。"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from app.providers.base import Dividend, PricePoint, Split
from app.services.simulation import (
    SimulationError,
    resolve_trade_point,
    shares_from_amount,
    simulate_past,
    split_factor_after,
    downsample,
)


def p(d: str, close: float) -> PricePoint:
    return PricePoint(date=date.fromisoformat(d), close=close)


# 2023-01-07(土), 08(日) は休場という想定のデータ
POINTS = [p("2023-01-06", 2200.0), p("2023-01-10", 2300.0), p("2023-01-11", 2350.0), p("2024-06-28", 3100.0)]


def test_shares_simulation_basic():
    r = simulate_past(POINTS, [], date(2023, 1, 10), shares=100)
    assert r.trade_date == date(2023, 1, 10)
    assert r.market_closed is False
    assert r.purchase_price == 2300.0
    assert r.invested == 230_000
    assert r.current_price == 3100.0
    assert r.current_value == 310_000
    assert r.profit == 80_000
    assert round(r.return_pct, 2) == 34.78


def test_market_closed_rolls_forward():
    r = simulate_past(POINTS, [], date(2023, 1, 7), shares=100)
    assert r.market_closed is True
    assert r.trade_date == date(2023, 1, 10)
    assert r.purchase_price == 2300.0


def test_amount_input_floors_to_whole_shares():
    r = simulate_past(POINTS, [], date(2023, 1, 10), amount=250_000)
    assert r.shares == 108              # floor(250000 / 2300)
    assert r.invested == 108 * 2300
    assert round(r.leftover_cash) == 250_000 - 108 * 2300


def test_amount_too_small():
    with pytest.raises(SimulationError):
        simulate_past(POINTS, [], date(2023, 1, 10), amount=1000)


def test_split_is_reflected_in_shares_and_price():
    """購入後に 1:2 分割 → 保有株数は倍、当時の株価は調整後終値の2倍。"""
    splits = [Split(date=date(2023, 6, 1), ratio=2.0)]
    r = simulate_past(POINTS, splits, date(2023, 1, 10), shares=100)
    assert r.split_factor == 2.0
    assert r.purchase_price == 4600.0        # 調整後2300 × 2
    assert r.shares == 100
    assert r.shares_now == 200
    assert r.invested == 460_000
    assert r.current_value == 200 * 3100.0   # = 620,000
    assert r.profit == 160_000
    # 単純な株価比較（2300→3100）では +34.78% だが、分割考慮でも同じリターンになる
    assert round(r.return_pct, 2) == 34.78


def test_split_before_purchase_is_ignored():
    splits = [Split(date=date(2022, 1, 1), ratio=2.0)]
    r = simulate_past(POINTS, splits, date(2023, 1, 10), shares=100)
    assert r.split_factor == 1.0
    assert r.purchase_price == 2300.0


def test_split_on_purchase_date_is_ignored():
    """購入日当日の分割は、その日の終値にすでに反映済みとみなす。"""
    splits = [Split(date=date(2023, 1, 10), ratio=2.0)]
    f, applied = split_factor_after(splits, date(2023, 1, 10))
    assert f == 1.0 and applied == []


def test_value_series_is_continuous_across_split():
    splits = [Split(date=date(2023, 6, 1), ratio=2.0)]
    r = simulate_past(POINTS, splits, date(2023, 1, 10), shares=100)
    assert r.series[0].date == date(2023, 1, 10)
    assert r.series[0].value == 200 * 2300.0  # 200株 × 分割調整後株価2300 = 460,000
    assert r.series[0].value == r.invested
    assert r.series[-1].value == r.current_value


def test_dividends_optional():
    divs = [Dividend(date=date(2023, 3, 31), amount=50.0), Dividend(date=date(2022, 3, 31), amount=40.0)]
    off = simulate_past(POINTS, [], date(2023, 1, 10), shares=100, dividends=divs)
    on = simulate_past(POINTS, [], date(2023, 1, 10), shares=100, dividends=divs, include_dividends=True)
    assert off.dividend_total == 0
    assert on.dividend_total == 100 * 50.0          # 購入日より後の配当のみ
    assert on.profit == off.profit + 5000


def test_us_stock_decimals():
    us = [p("2023-01-10", 130.73), p("2024-06-28", 210.62)]
    r = simulate_past(us, [], date(2023, 1, 10), shares=10)
    assert round(r.invested, 2) == 1307.30
    assert round(r.current_value, 2) == 2106.20
    assert round(r.profit, 2) == 798.90
    assert round(r.return_pct, 2) == 61.11


def test_requires_exactly_one_of_shares_amount():
    with pytest.raises(SimulationError):
        simulate_past(POINTS, [], date(2023, 1, 10))
    with pytest.raises(SimulationError):
        simulate_past(POINTS, [], date(2023, 1, 10), shares=1, amount=1000)


def test_future_date_has_no_data():
    with pytest.raises(SimulationError):
        resolve_trade_point(POINTS, date(2030, 1, 1))


def test_shares_from_amount_fractional():
    assert shares_from_amount(1000, 300, allow_fractional=True) == pytest.approx(3.3333, rel=1e-3)
    assert shares_from_amount(1000, 300) == 3


def test_downsample_keeps_ends():
    items = list(range(1000))
    out = downsample(items, 100)
    assert len(out) == 100
    assert out[0] == 0 and out[-1] == 999
    assert downsample(items, 5000) is items
