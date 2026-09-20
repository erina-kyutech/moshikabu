"""期間と時間足の組み合わせ・ローソクの集約のテスト（ネットワーク不要）。"""
from __future__ import annotations

import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from app.services import candles as cs

JST = timezone(timedelta(hours=9))


BASE = datetime(2026, 9, 18, 9, 0, tzinfo=JST)


def bar(minute: int, o: float, h: float, low: float, c: float, v: float = 100) -> cs.Bar:
    return cs.Bar(
        time=BASE + timedelta(minutes=minute), open=o, high=h, low=low, close=c, volume=v
    )


def test_resolve_keeps_valid_combination():
    spec, used, notice = cs.resolve("1d", "5m")
    assert (spec.key, used, notice) == ("1d", "5m", None)


def test_resolve_uses_default_when_interval_missing():
    spec, used, notice = cs.resolve("1y", None)
    assert used == "1d" and notice is None and spec.period == "1y"


@pytest.mark.parametrize("range_key,interval", [("3mo", "5m"), ("1y", "1m"), ("max", "1h"), ("5y", "15m")])
def test_resolve_falls_back_for_unavailable_intraday(range_key, interval):
    """分足が取れない期間を選んでもエラーにせず、使える足に切り替えて理由を返す。"""
    spec, used, notice = cs.resolve(range_key, interval)
    assert used == spec.default
    assert used in spec.intervals
    assert notice and cs.INTERVAL_LABELS[interval] in notice


def test_resolve_unknown_values():
    spec, used, notice = cs.resolve("100y", "3s")
    assert spec.key == cs.DEFAULT_RANGE
    assert used == spec.default
    assert notice


def test_every_range_default_is_selectable():
    for spec in cs.RANGES:
        assert spec.default in spec.intervals
        assert all(i in cs.INTERVAL_LABELS for i in spec.intervals)


def test_intraday_and_refresh_interval():
    assert cs.is_intraday("5m") and cs.is_intraday("1h")
    assert not cs.is_intraday("1d")
    assert cs.refresh_seconds("5m") == 60
    assert cs.refresh_seconds("1d") == 300


def test_labels_use_market_local_time():
    t = datetime(2026, 9, 18, 9, 5, tzinfo=JST)
    assert cs.axis_label(t, "5m") == "09:05"
    assert cs.axis_label(t, "1d") == "9/18"
    assert cs.axis_label(t, "1mo") == "26/09"
    assert cs.full_label(t, "5m") == "2026/09/18 09:05"
    assert cs.full_label(t, "1d") == "2026/09/18"


def test_aggregate_keeps_high_and_low():
    """間引くときに高値・安値を落とさない（単純な間引きでは消えてしまう）。"""
    bars = [bar(0, 100, 110, 90, 105), bar(5, 105, 130, 104, 120), bar(10, 120, 121, 60, 70)]
    merged, factor = cs.aggregate(bars, max_bars=1)
    assert factor == 3 and len(merged) == 1
    m = merged[0]
    assert (m.open, m.high, m.low, m.close, m.volume) == (100, 130, 60, 70, 300)
    assert m.time == bars[0].time


def test_aggregate_noop_when_few_bars():
    bars = [bar(0, 1, 2, 0.5, 1.5)]
    merged, factor = cs.aggregate(bars, max_bars=600)
    assert merged is bars and factor == 1


def test_aggregate_respects_max_bars():
    bars = [bar(i, 1, 2, 0.5, 1.5) for i in range(1000)]
    merged, factor = cs.aggregate(bars, max_bars=250)
    assert len(merged) <= 250 and factor == 4
