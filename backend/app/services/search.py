"""銘柄検索と、入力文字列から実在するティッカーへの解決。

検索は2つの情報源を組み合わせる:
  - JPX 辞書（日本語社名・証券コード・市場区分）… 日本株
  - データソースの検索（Yahoo Finance）        … 英語名・米国株・辞書に無い新規上場

ユーザーは Yahoo 形式（150A.T）を知らなくてよい。
「150A」「日本製鉄」「株式会社JSH」「apple」のどれでも候補が出るようにする。
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from .. import directory
from ..providers import get_provider
from ..providers.base import MarketDataError, SymbolCandidate, SymbolNotFoundError
from ..symbols import candidates as ticker_candidates
from ..symbols import clean, is_jp_code

# 米国の主要な取引所（Yahoo の取引所コード → 表示名）。OTC やカナダ・欧州の重複上場は出さない
US_EXCHANGES: dict[str, str] = {
    "NMS": "NASDAQ",
    "NGM": "NASDAQ",
    "NCM": "NASDAQ",
    "NAS": "NASDAQ",
    "NYQ": "NYSE",
    "NYS": "NYSE",
    "ASE": "NYSE American",
    "PCX": "NYSE Arca",
    "BTS": "Cboe",
}
# 指数（S&P500・NASDAQ・ダウ・日経平均など）を出してよい取引所コード
INDEX_EXCHANGES = {"SNP", "NIM", "DJI", "OSA", "NYB", "WCB"}
ALLOWED_TYPES = {"EQUITY", "ETF", "INDEX"}

_CJK = re.compile(r"[぀-ヿ㐀-鿿ｦ-ﾟ]")
_TICKER_LIKE = re.compile(r"^[A-Z^][A-Z0-9.\-=^]{0,9}$")


@dataclass(frozen=True)
class SearchResult:
    ticker: str            # データ取得に使うティッカー（150A.T / AAPL）
    code: str              # ユーザーに見せる短いコード（150A / AAPL）
    name: str
    market: str            # JP / US
    exchange: str          # 表示用の市場名（東証グロース / NASDAQ）
    quote_type: str        # EQUITY / ETF / REIT / INDEX
    exact: bool            # 入力がコード・ティッカーとして完全一致
    verified: bool         # データソースか辞書で存在を確認できたか
    source: str            # directory / provider / direct
    score: int


def _jp_result(issue: directory.JpIssue, score: int, exact: bool) -> SearchResult:
    return SearchResult(
        ticker=issue.ticker,
        code=issue.code,
        name=issue.name,
        market="JP",
        exchange=issue.segment,
        quote_type=issue.kind,
        exact=exact,
        verified=True,
        source="directory",
        score=score,
    )


def _from_provider(c: SymbolCandidate, score: int, query_clean: str) -> SearchResult | None:
    """データソースの候補を、このアプリで扱える日本株・米国株に絞って変換する。"""
    if c.quote_type not in ALLOWED_TYPES:
        return None

    if c.ticker.endswith(".T"):
        code = c.ticker[:-2]
        # 5401@F.T のような私設取引所（PTS）などの派生シンボルは出さない
        if not is_jp_code(code):
            return None
        issue = directory.lookup(code)
        if issue:
            return _jp_result(issue, score, exact=code == query_clean.removesuffix(".T"))
        # 辞書更新後の新規上場など。データソースの情報で出す
        return SearchResult(
            ticker=c.ticker,
            code=code,
            name=c.name,
            market="JP",
            exchange="東証",
            quote_type=c.quote_type,
            exact=code == query_clean.removesuffix(".T"),
            verified=True,
            source="provider",
            score=score,
        )

    if c.quote_type == "INDEX":
        if c.exchange_code not in INDEX_EXCHANGES:
            return None
        market = "JP" if c.exchange_code == "OSA" else "US"
        exchange = "指数"
    else:
        exchange = US_EXCHANGES.get(c.exchange_code or "")
        if exchange is None or "." in c.ticker:
            return None
        market = "US"

    return SearchResult(
        ticker=c.ticker,
        code=c.ticker,
        name=c.name,
        market=market,
        exchange=exchange,
        quote_type=c.quote_type,
        exact=c.ticker == query_clean,
        verified=True,
        source="provider",
        score=score,
    )


def search(query: str, limit: int = 8) -> list[SearchResult]:
    q = (query or "").strip()
    if not q:
        return []
    qc = clean(q)
    results: dict[str, SearchResult] = {}

    def add(r: SearchResult | None) -> None:
        if r is None:
            return
        prev = results.get(r.ticker)
        if prev is None or r.score > prev.score:
            results[r.ticker] = r

    # 1) 日本の証券コードとして完全一致（辞書に無ければ「.T を付けて試す」候補を出す）
    code = qc.removesuffix(".T")
    if is_jp_code(code):
        issue = directory.lookup(code)
        if issue:
            add(_jp_result(issue, 100, exact=True))
        else:
            add(
                SearchResult(
                    ticker=f"{code}.T",
                    code=code,
                    name=f"証券コード {code}",
                    market="JP",
                    exchange="東証",
                    quote_type="EQUITY",
                    exact=True,
                    verified=False,
                    source="direct",
                    score=95,
                )
            )

    # 2) 日本語の社名・コードで辞書を検索
    for score, issue in directory.search(q, limit=limit):
        add(_jp_result(issue, score, exact=issue.code == code))

    # 3) データソースの検索（日本語の社名は引けないので、英数字を含む入力のときだけ）
    if not _CJK.search(q):
        try:
            provider_hits = get_provider().search(q, limit=10)
        except MarketDataError:
            provider_hits = []
        for rank, c in enumerate(provider_hits):
            # データソース側の並び順を尊重しつつ、完全一致は最上位に
            score = 100 if c.ticker == qc else 70 - rank * 2
            add(_from_provider(c, score, qc))

    # 4) 何も見つからないときの最後の手段：入力をティッカーとしてそのまま試す
    if not results and _TICKER_LIKE.match(qc):
        add(
            SearchResult(
                ticker=qc,
                code=qc,
                name=qc,
                market="US",
                exchange="ティッカーとして検索",
                quote_type="EQUITY",
                exact=True,
                verified=False,
                source="direct",
                score=10,
            )
        )

    def size_of(r: SearchResult) -> int:
        issue = directory.lookup(r.code) if r.market == "JP" else None
        return issue.size if issue else 9

    ordered = sorted(
        results.values(),
        key=lambda r: (-r.score, not r.exact, size_of(r), r.market != "JP", r.ticker),
    )
    return ordered[:limit]


def resolve(raw: str) -> str:
    """入力（150A / 5401.T / AAPL / 日本製鉄）を、株価が取れる確定ティッカーにする。

    1. 入力から作ったティッカー候補を順に試す（150A → 150A.T → 150A）
    2. どれも取れず、入力が社名っぽければ、検索でほぼ確実に一致した銘柄を使う
    """
    provider = get_provider()
    tried: list[str] = []

    for ticker in ticker_candidates(raw):
        tried.append(ticker)
        try:
            provider.get_info(ticker)
            return ticker
        except SymbolNotFoundError:
            continue

    # 社名で入力された場合（APIを直接呼ばれたときなど）。完全一致に近いものだけ採用する
    if not is_jp_code(clean(raw).removesuffix(".T")):
        for r in search(raw, limit=3):
            if r.score >= 90 and r.ticker not in tried:
                try:
                    provider.get_info(r.ticker)
                    return r.ticker
                except SymbolNotFoundError:
                    continue

    raise SymbolNotFoundError(tried[0] if tried else raw)
