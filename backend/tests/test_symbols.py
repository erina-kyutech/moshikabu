from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from app.symbols import meta, normalize


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("5401", "5401.T"),
        (" 7203 ", "7203.T"),
        ("5401.T", "5401.T"),
        ("5401.t", "5401.T"),
        ("130A", "130A.T"),
        ("aapl", "AAPL"),
        ("NVDA", "NVDA"),
        ("BRK-B", "BRK-B"),
        ("JPY=X", "JPY=X"),
    ],
)
def test_normalize(raw, expected):
    assert normalize(raw) == expected


def test_meta_jp():
    m = meta("5401")
    assert (m.ticker, m.market, m.currency, m.symbol_hint) == ("5401.T", "JP", "JPY", "5401")


def test_meta_us():
    m = meta("aapl")
    assert (m.ticker, m.market, m.currency) == ("AAPL", "US", "USD")


def test_empty_raises():
    with pytest.raises(ValueError):
        normalize("  ")
