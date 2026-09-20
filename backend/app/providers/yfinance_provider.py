"""yfinance を用いた MarketDataProvider 実装。

このファイル以外に yfinance / Yahoo Finance 固有の知識を漏らさないこと。
"""
from __future__ import annotations

import math
from datetime import date, datetime, timedelta, timezone

import pandas as pd
import yfinance as yf

from .. import cache
from .. import directory
# プロバイダは確定済みのティッカーを受け取る（.T の付与などの正規化はルーター側の責務）
from ..symbols import describe as symbol_meta
from .base import (
    Candle,
    CandleSeries,
    CorporateActions,
    Dividend,
    MarketDataError,
    MarketDataProvider,
    PricePoint,
    Quote,
    Split,
    SymbolCandidate,
    SymbolInfo,
    SymbolNotFoundError,
)


def _f(v) -> float | None:
    try:
        if v is None:
            return None
        f = float(v)
        return None if math.isnan(f) or math.isinf(f) else f
    except (TypeError, ValueError):
        return None


class YFinanceProvider(MarketDataProvider):
    name = "yfinance"

    # ------------------------------------------------------------------ info
    def get_info(self, ticker: str) -> SymbolInfo:
        m = symbol_meta(ticker)

        def load() -> SymbolInfo:
            try:
                raw = yf.Ticker(m.ticker).info or {}
            except Exception as exc:  # 通信エラーなど
                raise MarketDataError(str(exc)) from exc

            name = raw.get("longName") or raw.get("shortName")
            has_price = raw.get("regularMarketPrice") is not None
            if not name and not has_price:
                raise SymbolNotFoundError(m.ticker)

            # 日経平均 (^N225) のようにサフィックスから市場を判断できない銘柄があるため、
            # 通貨が取れる場合はそちらを優先する
            currency = raw.get("currency") or m.currency
            market = "JP" if currency == "JPY" else m.market

            # 日本株は JPX の辞書から日本語の銘柄名と市場区分（東証プライム等）を補う
            jp = directory.lookup(m.ticker) if m.ticker.endswith(".T") else None

            return SymbolInfo(
                ticker=m.ticker,
                name=(jp.name if jp else None) or name or m.ticker,
                market=market,
                currency=currency,
                exchange=(jp.segment if jp else None)
                or raw.get("fullExchangeName")
                or raw.get("exchange"),
                sector=(jp.industry if jp and jp.industry else None) or raw.get("sector"),
            )

        return cache.get_or_set(f"info:{m.ticker}", cache.TTL_INFO, load)

    # ----------------------------------------------------------------- quote
    def get_quote(self, ticker: str) -> Quote:
        m = symbol_meta(ticker)

        def load() -> Quote:
            try:
                fi = yf.Ticker(m.ticker).fast_info
                price = _f(getattr(fi, "last_price", None))
                prev = _f(getattr(fi, "previous_close", None))
                currency = getattr(fi, "currency", None) or m.currency
                day_high = _f(getattr(fi, "day_high", None))
                day_low = _f(getattr(fi, "day_low", None))
                volume = _f(getattr(fi, "last_volume", None))
            except Exception as exc:
                raise MarketDataError(str(exc)) from exc

            if price is None:
                # fast_info が取れない銘柄は日足の最後の終値で代替
                hist = self.get_history(m.ticker, date.today() - timedelta(days=14))
                if not hist:
                    raise SymbolNotFoundError(m.ticker)
                price = hist[-1].close
                prev = hist[-2].close if len(hist) >= 2 else None
                currency = m.currency
                day_high = hist[-1].high
                day_low = hist[-1].low
                volume = hist[-1].volume

            change = None if prev in (None, 0) else price - prev
            pct = None if prev in (None, 0) else (price - prev) / prev * 100
            return Quote(
                ticker=m.ticker,
                price=price,
                previous_close=prev,
                change=change,
                change_percent=pct,
                currency=currency,
                as_of=datetime.now(timezone.utc),
                day_high=day_high,
                day_low=day_low,
                volume=volume,
            )

        return cache.get_or_set(f"quote:{m.ticker}", cache.TTL_QUOTE, load)

    # --------------------------------------------------------------- history
    def get_history(
        self, ticker: str, start: date, end: date | None = None, interval: str = "1d"
    ) -> list[PricePoint]:
        m = symbol_meta(ticker)
        end = end or date.today()
        # end は排他的なので +1 日して当日を含める
        key = f"hist:{m.ticker}:{start}:{end}:{interval}"

        def load() -> list[PricePoint]:
            try:
                df = yf.Ticker(m.ticker).history(
                    start=start.isoformat(),
                    end=(end + timedelta(days=1)).isoformat(),
                    interval=interval,
                    auto_adjust=False,   # Close = 分割調整済み・配当未調整
                    actions=False,
                    raise_errors=False,
                )
            except Exception as exc:
                raise MarketDataError(str(exc)) from exc

            if df is None or df.empty:
                return []

            points: list[PricePoint] = []
            for idx, row in df.iterrows():
                close = _f(row.get("Close"))
                if close is None:
                    continue
                d = idx.date() if isinstance(idx, pd.Timestamp) else idx
                points.append(
                    PricePoint(
                        date=d,
                        close=close,
                        open=_f(row.get("Open")),
                        high=_f(row.get("High")),
                        low=_f(row.get("Low")),
                        volume=_f(row.get("Volume")),
                    )
                )
            return points

        return cache.get_or_set(key, cache.TTL_HISTORY, load)

    # --------------------------------------------------------------- actions
    def get_actions(self, ticker: str, start: date | None = None) -> CorporateActions:
        m = symbol_meta(ticker)

        def load() -> CorporateActions:
            try:
                yt = yf.Ticker(m.ticker)
                splits_s = yt.splits
                divs_s = yt.dividends
            except Exception as exc:
                raise MarketDataError(str(exc)) from exc

            splits: list[Split] = []
            if splits_s is not None and len(splits_s) > 0:
                for idx, ratio in splits_s.items():
                    r = _f(ratio)
                    if r and r > 0:
                        splits.append(Split(date=idx.date(), ratio=r))

            divs: list[Dividend] = []
            if divs_s is not None and len(divs_s) > 0:
                for idx, amount in divs_s.items():
                    a = _f(amount)
                    if a:
                        divs.append(Dividend(date=idx.date(), amount=a))

            return CorporateActions(ticker=m.ticker, splits=splits, dividends=divs)

        actions = cache.get_or_set(f"actions:{m.ticker}", cache.TTL_ACTIONS, load)
        if start is None:
            return actions
        return CorporateActions(
            ticker=actions.ticker,
            splits=[s for s in actions.splits if s.date >= start],
            dividends=[d for d in actions.dividends if d.date >= start],
        )

    # --------------------------------------------------------------- candles
    def get_candles(self, ticker: str, period: str, interval: str) -> CandleSeries:
        m = symbol_meta(ticker)
        key = f"candles:{m.ticker}:{period}:{interval}"
        ttl = cache.TTL_INTRADAY if interval.endswith(("m", "h")) else cache.TTL_HISTORY

        def load() -> CandleSeries:
            try:
                df = yf.Ticker(m.ticker).history(
                    period=period,
                    interval=interval,
                    auto_adjust=False,
                    actions=False,
                    prepost=False,
                    raise_errors=False,
                )
            except Exception as exc:
                raise MarketDataError(str(exc)) from exc

            if df is None or df.empty:
                return CandleSeries(ticker=m.ticker, interval=interval, timezone="", candles=[])

            tz = str(getattr(df.index, "tz", "") or "")
            candles: list[Candle] = []
            for idx, row in df.iterrows():
                o, h, low, c = (_f(row.get(k)) for k in ("Open", "High", "Low", "Close"))
                if None in (o, h, low, c):
                    continue
                when = idx.to_pydatetime() if isinstance(idx, pd.Timestamp) else idx
                candles.append(
                    Candle(time=when, open=o, high=h, low=low, close=c, volume=_f(row.get("Volume")))
                )
            return CandleSeries(ticker=m.ticker, interval=interval, timezone=tz, candles=candles)

        return cache.get_or_set(key, ttl, load)

    # ---------------------------------------------------------------- search
    def search(self, query: str, limit: int = 10) -> list[SymbolCandidate]:
        q = (query or "").strip()
        if not q:
            return []

        def load() -> list[SymbolCandidate]:
            try:
                raw = yf.Search(q, max_results=max(limit, 10), news_count=0).quotes or []
            except Exception as exc:
                raise MarketDataError(str(exc)) from exc
            out: list[SymbolCandidate] = []
            for item in raw:
                symbol = item.get("symbol")
                if not symbol:
                    continue
                out.append(
                    SymbolCandidate(
                        ticker=str(symbol).upper(),
                        name=item.get("longname") or item.get("shortname") or str(symbol),
                        exchange=item.get("exchDisp"),
                        exchange_code=item.get("exchange"),
                        quote_type=str(item.get("quoteType") or "").upper(),
                    )
                )
            return out

        return cache.get_or_set(f"search:{q.lower()}", cache.TTL_INFO, load)
