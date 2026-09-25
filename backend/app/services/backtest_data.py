"""バックテストエンジンに渡すデータ層。

エンジン（services/backtest.py）は計算に専念し、
「どこからデータを取るか」はここが引き受ける。

  - 株価は分割調整後の終値を使う（分割で誤ったリターンにならないようにするため）
  - 米国株は、その日の USD/JPY で円に換算してから比較・集計する
  - 財務データは HistoricalFundamentalProvider（公表日を考慮）から取る
"""
from __future__ import annotations

from bisect import bisect_right
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

from .. import directory
from ..providers import get_fundamental_provider, get_provider
from ..providers.base import Fundamentals, MarketDataError, SymbolNotFoundError
from ..symbols import describe
from . import fx as fx_service
from . import universe as universe_service

# ベンチマークの Yahoo Finance シンボル。
# TOPIX の指数そのもの（^TOPX）は Yahoo Finance から取得できないため、
# 連動する上場投信（1306）で代用し、その旨をラベルに明記する。
BENCHMARKS: dict[str, dict[str, str]] = {
    "TOPIX": {"symbol": "1306.T", "label": "TOPIX（連動ETF 1306で代用）", "currency": "JPY"},
    "N225": {"symbol": "^N225", "label": "日経平均株価", "currency": "JPY"},
    "SP500": {"symbol": "^GSPC", "label": "S&P500（円換算）", "currency": "USD"},
    "NASDAQ100": {"symbol": "^NDX", "label": "NASDAQ100（円換算）", "currency": "USD"},
}
DEFAULT_BENCHMARK = "TOPIX"

MAX_WORKERS = 24


class _Series:
    """日付→値の時系列。指定日以前で直近の値を返す。"""

    def __init__(self, points: list[tuple[date, float]]):
        points = sorted(points)
        self.dates = [p[0] for p in points]
        self.values = [p[1] for p in points]

    def at(self, on: date) -> float | None:
        if not self.dates:
            return None
        i = bisect_right(self.dates, on)
        return self.values[i - 1] if i > 0 else None

    def __bool__(self) -> bool:
        return bool(self.dates)


class MarketBacktestData:
    """実データでバックテストを動かすためのデータ層。"""

    def __init__(self, universe_id: str, benchmark: str, start: date, end: date):
        self._tickers = universe_service.tickers(universe_id)
        self._benchmark_key = benchmark if benchmark in BENCHMARKS else DEFAULT_BENCHMARK
        self._start = start
        self._end = end
        self._prices: dict[str, _Series] = {}
        self._names: dict[str, str] = {}
        self._fundamentals = get_fundamental_provider()
        self._fx: _Series | None = None
        self._benchmark_series: _Series = _Series([])
        self.failed: dict[str, str] = {}

    # ------------------------------------------------------------ 事前取得
    def preload(self) -> None:
        """株価・為替・ベンチマークをまとめて取得する（銘柄ごとに並列）。"""
        provider = get_provider()
        history_start = self._start - timedelta(days=40)

        # 為替（米国株の円換算に使う）
        self._fx = _Series(
            [(p.date, p.close) for p in fx_service.rate_history("usdjpy", start=history_start, end=self._end)]
        )

        symbol = BENCHMARKS[self._benchmark_key]["symbol"]
        try:
            self._benchmark_series = _Series(
                [(p.date, p.close) for p in provider.get_history(symbol, start=history_start, end=self._end)]
            )
        except (SymbolNotFoundError, MarketDataError):
            self._benchmark_series = _Series([])

        def load(ticker: str):
            try:
                points = provider.get_history(ticker, start=history_start, end=self._end)
                return ticker, [(p.date, p.close) for p in points], None
            except (SymbolNotFoundError, MarketDataError) as exc:
                return ticker, [], str(exc) or "株価データを取得できませんでした"

        with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, max(1, len(self._tickers)))) as pool:
            for ticker, points, error in pool.map(load, self._tickers):
                if points:
                    self._prices[ticker] = _Series(points)
                else:
                    self.failed[ticker] = error or "株価データがありません"

    # ------------------------------------------- BacktestData プロトコル
    def universe(self) -> list[str]:
        return [t for t in self._tickers if t in self._prices]

    def name_of(self, ticker: str) -> str:
        if ticker not in self._names:
            issue = directory.lookup(ticker)
            self._names[ticker] = issue.name if issue else describe(ticker).symbol_hint
        return self._names[ticker]

    def _fx_at(self, ticker: str, on: date) -> float:
        if describe(ticker).currency == "JPY":
            return 1.0
        rate = self._fx.at(on) if self._fx else None
        return rate or fx_service.FALLBACK_USDJPY

    def fundamentals(self, ticker: str, on: date) -> Fundamentals | None:
        try:
            return self._fundamentals.get_as_of(ticker, on, self._fx_at(ticker, on))
        except (SymbolNotFoundError, MarketDataError):
            return None

    def price(self, ticker: str, on: date) -> float | None:
        series = self._prices.get(ticker)
        if series is None:
            return None
        close = series.at(on)
        if close is None:
            return None
        return close * self._fx_at(ticker, on)

    def benchmark(self, on: date) -> float | None:
        value = self._benchmark_series.at(on)
        if value is None:
            return None
        # 米国の指数は、日本円で投資した場合と比べられるよう円換算する
        if BENCHMARKS[self._benchmark_key]["currency"] == "USD":
            rate = self._fx.at(on) if self._fx else None
            value *= rate or fx_service.FALLBACK_USDJPY
        return value

    @property
    def benchmark_label(self) -> str:
        return BENCHMARKS[self._benchmark_key]["label"]
