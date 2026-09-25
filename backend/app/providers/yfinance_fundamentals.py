"""yfinance による財務指標の取得。

2種類を明確に分ける:

  get_current(...)  … いま時点の指標。スクリーニング（現在の銘柄探し）用
  get_as_of(...)    … 指定日に「公表済みだった」決算だけから作る指標。バックテスト用

get_as_of では、決算の公表日（earnings_dates の実績）を使い、
`公表日 <= 指定日` の決算だけを使う。公表日が取れない銘柄は、
期末＋一定日数（日本株90日／米国株60日）を保守的な公表日とみなす。
どちらも取れない場合は None を返し、呼び出し側でその銘柄を検証対象外にする。

データが無い指標は values に入れない。0 や推定値で埋めない。
"""
from __future__ import annotations

import math
from datetime import date, timedelta

import pandas as pd
import yfinance as yf

from .. import cache
from ..symbols import describe as symbol_meta
from .base import Fundamentals, FundamentalProvider, HistoricalFundamentalProvider, MarketDataError

# どの指標が、どのデータ取得を必要とするか。
# 必要な取得だけに絞ることで、スクリーニングの待ち時間を短くする。
INFO_METRICS = frozenset({
    "pbr", "per", "dividendYield", "roe", "roa", "operatingMargin",
    "revenueGrowth", "debtRatio", "marketCap", "revenue", "price",
})
STATEMENT_METRICS = frozenset({
    "operatingIncomeGrowth", "epsGrowth", "equityRatio",
    # .info に無い場合の補完としても使う
    "pbr", "per", "roe", "roa", "operatingMargin", "revenueGrowth",
    "debtRatio", "marketCap", "revenue",
})
PRICE_METRICS = frozenset({
    "return1m", "return3m", "return6m", "return12m", "volumeGrowth", "distanceFrom52wHigh",
})

# 決算発表までの保守的な想定日数（実際の公表日が取れない銘柄向け）
ASSUMED_REPORTING_LAG_DAYS = {"JP": 90, "US": 60}

# yfinance の行名は銘柄によって揺れるので、候補を順に探す
REVENUE_ROWS = ("Total Revenue", "Operating Revenue")
OPERATING_INCOME_ROWS = ("Operating Income", "Total Operating Income As Reported", "EBIT")
NET_INCOME_ROWS = ("Net Income Common Stockholders", "Net Income", "Net Income Including Noncontrolling Interests")
EPS_ROWS = ("Diluted EPS", "Basic EPS")
EQUITY_ROWS = ("Stockholders Equity", "Total Equity Gross Minority Interest")
ASSETS_ROWS = ("Total Assets",)
DEBT_ROWS = ("Total Debt",)
SHARES_ROWS = ("Ordinary Shares Number", "Share Issued")


def _f(v) -> float | None:
    try:
        if v is None:
            return None
        f = float(v)
        return None if math.isnan(f) or math.isinf(f) else f
    except (TypeError, ValueError):
        return None


def _row(df: pd.DataFrame | None, names: tuple[str, ...], col) -> float | None:
    if df is None or df.empty or col not in df.columns:
        return None
    for name in names:
        if name in df.index:
            v = _f(df.loc[name, col])
            if v is not None:
                return v
    return None


def _pct(numerator: float | None, denominator: float | None) -> float | None:
    if numerator is None or denominator in (None, 0):
        return None
    return numerator / abs(denominator) * 100


def _growth(current: float | None, previous: float | None) -> float | None:
    """前期比の成長率（%）。前期が赤字・ゼロだと意味を持たないので出さない。"""
    if current is None or previous is None or previous <= 0:
        return None
    return (current - previous) / previous * 100


class YFinanceFundamentals(FundamentalProvider, HistoricalFundamentalProvider):
    name = "yfinance"

    # ------------------------------------------------------------ 生データ
    def _statements(self, ticker: str) -> dict:
        """年次の損益計算書・貸借対照表・決算公表日をまとめて取る（重いのでキャッシュ）。"""

        def load() -> dict:
            try:
                t = yf.Ticker(ticker)
                income = t.income_stmt
                balance = t.balance_sheet
                try:
                    earnings = t.earnings_dates
                except Exception:
                    earnings = None
            except Exception as exc:
                raise MarketDataError(str(exc)) from exc

            reported: list[date] = []
            if earnings is not None and len(earnings) and "Reported EPS" in earnings.columns:
                for idx, row in earnings.iterrows():
                    if pd.notna(row.get("Reported EPS")):
                        reported.append(idx.date())
            return {"income": income, "balance": balance, "reported_dates": sorted(reported)}

        return cache.get_or_set(f"statements:{ticker}", cache.TTL_INFO, load)

    def _publication_date(self, period_end: date, reported_dates: list[date], market: str) -> tuple[date, str]:
        """決算期末に対応する公表日。実績が取れればそれを、無ければ期末＋想定日数。"""
        lag = ASSUMED_REPORTING_LAG_DAYS.get(market, 90)
        limit = period_end + timedelta(days=lag + 60)
        for d in reported_dates:
            # 期末の翌日以降、想定より少し広めの範囲で最初に見つかった発表日
            if period_end < d <= limit:
                return d, "reported"
        return period_end + timedelta(days=lag), "estimated"

    def _price_series(self, ticker: str, start: date, end: date | None = None):
        def load():
            try:
                df = yf.Ticker(ticker).history(
                    start=start.isoformat(),
                    end=(end + timedelta(days=1)).isoformat() if end else None,
                    interval="1d",
                    auto_adjust=False,   # 分割調整済み・配当未調整の終値
                    actions=False,
                    raise_errors=False,
                )
            except Exception as exc:
                raise MarketDataError(str(exc)) from exc
            if df is None or df.empty:
                return []
            return [
                (idx.date(), _f(row.get("Close")), _f(row.get("Volume")))
                for idx, row in df.iterrows()
                if _f(row.get("Close")) is not None
            ]

        return cache.get_or_set(f"fundprice:{ticker}:{start}:{end}", cache.TTL_HISTORY, load)

    # ------------------------------------------------------- 共通の計算部分
    def _price_metrics(self, series, on: date | None = None) -> dict[str, float]:
        """騰落率・出来高増加率・52週高値からの乖離率。"""
        if not series:
            return {}
        rows = [r for r in series if on is None or r[0] <= on]
        if not rows:
            return {}

        last_date, last_close, _ = rows[-1]
        out: dict[str, float] = {}

        def price_before(days: int) -> float | None:
            target = last_date - timedelta(days=days)
            prior = [r for r in rows if r[0] <= target]
            return prior[-1][1] if prior else None

        for key, days in (("return1m", 30), ("return3m", 91), ("return6m", 182), ("return12m", 365)):
            base = price_before(days)
            if base:
                out[key] = (last_close - base) / base * 100

        year = [r for r in rows if r[0] > last_date - timedelta(days=365)]
        highs = [r[1] for r in year]
        if highs:
            high = max(highs)
            if high > 0:
                out["distanceFrom52wHigh"] = (last_close - high) / high * 100

        volumes = [r[2] for r in year if r[2] is not None]
        if len(volumes) >= 20:
            recent = volumes[-10:]
            base = sum(volumes) / len(volumes)
            if base > 0:
                out["volumeGrowth"] = (sum(recent) / len(recent)) / base * 100 - 100
        return out

    def _statement_metrics(
        self, income, balance, col, prev_col, price: float | None, fx: float
    ) -> tuple[dict[str, float], float | None]:
        """決算の1期分（＋前期）から指標を作る。戻り値は (指標, 1株純資産)。"""
        out: dict[str, float] = {}

        revenue = _row(income, REVENUE_ROWS, col)
        operating = _row(income, OPERATING_INCOME_ROWS, col)
        net = _row(income, NET_INCOME_ROWS, col)
        eps = _row(income, EPS_ROWS, col)
        equity = _row(balance, EQUITY_ROWS, col)
        assets = _row(balance, ASSETS_ROWS, col)
        debt = _row(balance, DEBT_ROWS, col)
        shares = _row(balance, SHARES_ROWS, col)

        if prev_col is not None:
            g = _growth(revenue, _row(income, REVENUE_ROWS, prev_col))
            if g is not None:
                out["revenueGrowth"] = g
            g = _growth(operating, _row(income, OPERATING_INCOME_ROWS, prev_col))
            if g is not None:
                out["operatingIncomeGrowth"] = g
            g = _growth(eps, _row(income, EPS_ROWS, prev_col))
            if g is not None:
                out["epsGrowth"] = g

        v = _pct(net, equity)
        if v is not None:
            out["roe"] = v
        v = _pct(net, assets)
        if v is not None:
            out["roa"] = v
        v = _pct(operating, revenue)
        if v is not None:
            out["operatingMargin"] = v
        v = _pct(equity, assets)
        if v is not None:
            out["equityRatio"] = v
        v = _pct(debt, equity)
        if v is not None:
            out["debtRatio"] = v
        if revenue is not None:
            out["revenue"] = revenue * fx / 1e8      # 億円

        bvps = equity / shares if equity is not None and shares else None
        if price is not None:
            if bvps and bvps > 0:
                out["pbr"] = price / bvps
            if eps and eps > 0:
                out["per"] = price / eps
            if shares:
                out["marketCap"] = price * shares * fx / 1e8   # 億円
            out["price"] = price * fx
        return out, bvps

    # ------------------------------------------------------------- 現在値
    def get_current(
        self, ticker: str, fx_to_jpy: float = 1.0, needed: frozenset[str] | None = None
    ) -> Fundamentals:
        """いま時点の指標。

        `needed` に必要な指標だけを渡すと、不要なデータ取得を省いて速くなる。
        （PBR と ROE だけなら .info の1回で済み、決算書や株価履歴は取りに行かない）
        """
        m = symbol_meta(ticker)
        today = date.today()
        want = frozenset(needed) if needed else None
        need_statements = want is None or bool(want & STATEMENT_METRICS)
        need_prices = want is None or bool(want & PRICE_METRICS)
        key_suffix = "all" if want is None else ",".join(sorted(want))

        def load() -> Fundamentals:
            try:
                info = yf.Ticker(m.ticker).info or {}
            except Exception as exc:
                raise MarketDataError(str(exc)) from exc

            values: dict[str, float] = {}

            def put(key: str, value: float | None, scale: float = 1.0) -> None:
                v = _f(value)
                if v is not None:
                    values[key] = v * scale

            put("pbr", info.get("priceToBook"))
            put("per", info.get("trailingPE"))
            put("dividendYield", info.get("dividendYield"))     # すでに % 表記
            put("roe", info.get("returnOnEquity"), 100)
            put("roa", info.get("returnOnAssets"), 100)
            put("operatingMargin", info.get("operatingMargins"), 100)
            put("revenueGrowth", info.get("revenueGrowth"), 100)
            put("debtRatio", info.get("debtToEquity"))
            put("marketCap", info.get("marketCap"), fx_to_jpy / 1e8)
            put("revenue", info.get("totalRevenue"), fx_to_jpy / 1e8)

            price = _f(info.get("currentPrice")) or _f(info.get("regularMarketPrice"))
            if price is not None:
                values["price"] = price * fx_to_jpy

            # .info に無い指標は決算書から計算する
            income = balance = None
            if need_statements:
                statements = self._statements(m.ticker)
                income, balance = statements["income"], statements["balance"]
            if income is not None and not income.empty:
                cols = list(income.columns)
                col = cols[0]
                prev = cols[1] if len(cols) > 1 else None
                derived, _ = self._statement_metrics(income, balance, col, prev, price, fx_to_jpy)
                for key in ("operatingIncomeGrowth", "epsGrowth", "equityRatio"):
                    if key in derived:
                        values.setdefault(key, derived[key])
                # .info に無いものは決算書の値で補う
                for key, val in derived.items():
                    values.setdefault(key, val)

            if need_prices:
                values.update(
                    self._price_metrics(self._price_series(m.ticker, today - timedelta(days=430)))
                )

            return Fundamentals(
                ticker=m.ticker,
                as_of=today,
                values=values,
                currency=info.get("currency") or m.currency,
                publication_source="current",
            )

        return cache.get_or_set(
            f"fund:{m.ticker}:{today}:{round(fx_to_jpy, 2)}:{key_suffix}", cache.TTL_INFO, load
        )

    # --------------------------------------------------------- 過去の一時点
    def get_as_of(self, ticker: str, on: date, fx_to_jpy: float = 1.0) -> Fundamentals | None:
        m = symbol_meta(ticker)
        statements = self._statements(m.ticker)
        income, balance = statements["income"], statements["balance"]
        if income is None or income.empty:
            return None

        cols = list(income.columns)  # 新しい順
        # 「指定日までに公表済みだった」決算のうち、いちばん新しいもの
        usable: list[tuple[int, date, date, str]] = []
        for i, col in enumerate(cols):
            period_end = col.date() if hasattr(col, "date") else col
            published, source = self._publication_date(period_end, statements["reported_dates"], m.market)
            if published <= on:
                usable.append((i, period_end, published, source))
        if not usable:
            return None

        index, period_end, published, source = usable[0]
        prev_col = cols[index + 1] if index + 1 < len(cols) else None

        series = self._price_series(m.ticker, on - timedelta(days=430), on)
        price = None
        for d, close, _v in reversed(series):
            if d <= on:
                price = close
                break
        if price is None:
            return None

        values, _ = self._statement_metrics(income, balance, cols[index], prev_col, price, fx_to_jpy)
        values.update(self._price_metrics(series, on))
        if not values:
            return None

        return Fundamentals(
            ticker=m.ticker,
            as_of=on,
            values=values,
            currency=m.currency,
            fiscal_period_end=period_end,
            published_on=published,
            publication_source=source,
        )
