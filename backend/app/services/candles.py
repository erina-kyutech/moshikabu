"""チャート用の期間・時間足の組み合わせを扱う。

yfinance（Yahoo Finance）の分足には取得できる期間の制限があるため、
「どの期間でどの足が選べるか」をここで一元管理する。
ユーザーが取れない組み合わせを選んでもエラーにせず、その期間で使える足に自動で切り替える。
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

# 時間足（Yahoo の interval 表記）と日本語ラベル
INTERVAL_LABELS: dict[str, str] = {
    "1m": "1分足",
    "5m": "5分足",
    "15m": "15分足",
    "30m": "30分足",
    "1h": "1時間足",
    "1d": "日足",
    "1wk": "週足",
    "1mo": "月足",
}

INTRADAY_INTERVALS = {"1m", "5m", "15m", "30m", "1h"}


@dataclass(frozen=True)
class RangeSpec:
    key: str
    label: str
    period: str            # yfinance の period
    intervals: tuple[str, ...]   # その期間で選べる時間足
    default: str           # 既定の時間足


# 分足の制限（Yahoo の目安）:
#   1m  … 直近7日程度まで
#   5m〜30m … 直近60日程度まで
#   1h  … 直近730日程度まで
RANGES: tuple[RangeSpec, ...] = (
    RangeSpec("1d", "1日", "1d", ("1m", "5m", "15m", "30m", "1h"), "5m"),
    RangeSpec("5d", "5日", "5d", ("1m", "5m", "15m", "30m", "1h"), "15m"),
    RangeSpec("1mo", "1か月", "1mo", ("5m", "15m", "30m", "1h", "1d"), "1h"),
    RangeSpec("3mo", "3か月", "3mo", ("1h", "1d", "1wk"), "1d"),
    RangeSpec("6mo", "6か月", "6mo", ("1h", "1d", "1wk"), "1d"),
    RangeSpec("1y", "1年", "1y", ("1h", "1d", "1wk", "1mo"), "1d"),
    RangeSpec("5y", "5年", "5y", ("1d", "1wk", "1mo"), "1wk"),
    RangeSpec("max", "全期間", "max", ("1d", "1wk", "1mo"), "1mo"),
)

RANGE_BY_KEY: dict[str, RangeSpec] = {r.key: r for r in RANGES}
DEFAULT_RANGE = "1mo"

# 画面に出すローソクの本数の上限（多すぎると潰れて読めない）
MAX_BARS = 600


def resolve(range_key: str | None, interval: str | None) -> tuple[RangeSpec, str, str | None]:
    """(期間, 使う時間足, お知らせ) を返す。

    選べない組み合わせはエラーにせず、その期間の既定の足に切り替えて理由を返す。
    """
    spec = RANGE_BY_KEY.get((range_key or DEFAULT_RANGE).lower()) or RANGE_BY_KEY[DEFAULT_RANGE]
    requested = (interval or "").lower()

    if not requested:
        return spec, spec.default, None
    if requested not in INTERVAL_LABELS:
        return spec, spec.default, f"「{requested}」は対応していない時間足です。{INTERVAL_LABELS[spec.default]}に切り替えました。"
    if requested not in spec.intervals:
        return (
            spec,
            spec.default,
            f"{spec.label}の表示では{INTERVAL_LABELS[requested]}を利用できません。"
            f"{INTERVAL_LABELS[spec.default]}に切り替えました。",
        )
    return spec, requested, None


def is_intraday(interval: str) -> bool:
    return interval in INTRADAY_INTERVALS


def refresh_seconds(interval: str) -> int:
    """フロントに知らせる推奨の再取得間隔（秒）。データ取得側が更新頻度を決める。"""
    return 60 if is_intraday(interval) else 300


def axis_label(when: datetime, interval: str) -> str:
    """チャートの横軸に出す短いラベル（市場のローカル時刻）。"""
    if is_intraday(interval):
        return when.strftime("%H:%M")
    if interval == "1mo":
        return f"{when.year % 100:02d}/{when.month:02d}"
    return f"{when.month}/{when.day}"


def full_label(when: datetime, interval: str) -> str:
    """ツールチップに出す日時（市場のローカル時刻）。"""
    if is_intraday(interval):
        return f"{when.year}/{when.month:02d}/{when.day:02d} {when.strftime('%H:%M')}"
    return f"{when.year}/{when.month:02d}/{when.day:02d}"


@dataclass(frozen=True)
class Bar:
    """集約後のローソク1本。"""

    time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float | None


def aggregate(bars: list[Bar], max_bars: int = MAX_BARS) -> tuple[list[Bar], int]:
    """本数が多すぎる場合、隣り合うローソクをまとめて間引く。

    単純に間引くと高値・安値が消えてしまうので、
    始値=最初、高値=最大、安値=最小、終値=最後、出来高=合計 でまとめる。
    """
    if len(bars) <= max_bars or max_bars < 1:
        return bars, 1

    factor = (len(bars) + max_bars - 1) // max_bars
    merged: list[Bar] = []
    for i in range(0, len(bars), factor):
        chunk = bars[i : i + factor]
        volumes = [b.volume for b in chunk if b.volume is not None]
        merged.append(
            Bar(
                time=chunk[0].time,
                open=chunk[0].open,
                high=max(b.high for b in chunk),
                low=min(b.low for b in chunk),
                close=chunk[-1].close,
                volume=sum(volumes) if volumes else None,
            )
        )
    return merged, factor
