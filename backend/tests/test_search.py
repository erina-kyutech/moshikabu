"""銘柄コード判定・社名検索・銘柄解決のテスト（ネットワーク不要）。

データソースはフェイクに差し替え、JPX 辞書は同梱の JSON をそのまま使う。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from app import directory
from app.providers.base import SymbolCandidate, SymbolInfo, SymbolNotFoundError
from app.services import search as search_service
from app.symbols import candidates, clean, describe, is_jp_code, meta, normalize


# ---------------------------------------------------------------- コード判定
@pytest.mark.parametrize(
    "raw,expected",
    [
        ("5401", "5401.T"),
        ("7203", "7203.T"),
        ("9984", "9984.T"),
        ("150A", "150A.T"),     # 2024年以降の英字入りコード
        ("130A", "130A.T"),
        ("150a", "150A.T"),     # 小文字
        ("１５０Ａ", "150A.T"),  # 全角
        (" 150A ", "150A.T"),
        ("150A.T", "150A.T"),
        ("150a.t", "150A.T"),
        ("25935", "25935.T"),   # 優先株などの5桁コード
        ("AAPL", "AAPL"),
        ("nvda", "NVDA"),
        ("BRK-B", "BRK-B"),
        ("^N225", "^N225"),
        ("JPY=X", "JPY=X"),
    ],
)
def test_normalize(raw, expected):
    assert normalize(raw) == expected


def test_jp_code_shape_is_not_digits_only():
    # 「数字4桁だけ」ではなく、JPX のルール（1・3桁目が数字、2・4桁目は数字か英字）で判定
    for code in ["5401", "150A", "130A", "1A2B", "9Z9Z"]:
        assert is_jp_code(code), code
    # 英字で始まるもの（米国ティッカー）は日本株扱いしない → .T を付けない
    for ticker in ["AAPL", "NVDA", "TSLA", "ABCD", "A1B2", "IBM"]:
        assert not is_jp_code(ticker), ticker
        assert not normalize(ticker).endswith(".T"), ticker
    # 桁数違いも日本のコードではない
    for s in ["540", "540123", "15A", "1234A"]:
        assert not is_jp_code(s), s


def test_candidates_known_code_is_certain():
    """JPX 辞書に載っているコードは日本株で確定（米国ティッカーとして試さない）。"""
    assert directory.lookup("150A") is not None
    assert candidates("150A") == ["150A.T"]
    assert candidates("5401") == ["5401.T"]


def test_candidates_unknown_code_falls_back_to_raw():
    """辞書に無い日本式コード（辞書更新後の新規上場など）は .T を先に試し、だめなら素のまま。"""
    unknown = "9Z9Z"
    assert directory.lookup(unknown) is None
    assert candidates(unknown) == ["9Z9Z.T", "9Z9Z"]


def test_describe_does_not_add_suffix():
    assert describe("9Z9Z").ticker == "9Z9Z"
    assert describe("9Z9Z").market == "US"
    assert meta("9Z9Z").ticker == "9Z9Z.T"


def test_clean():
    assert clean(" ｎｖｄａ ") == "NVDA"


# ------------------------------------------------------------------ JPX 辞書
def test_directory_lookup_alnum_code():
    jsh = directory.lookup("150A")
    assert jsh is not None
    assert jsh.name == "JSH"             # 全角「ＪＳＨ」は半角に正規化済み
    assert jsh.segment == "東証グロース"
    assert jsh.ticker == "150A.T"
    assert directory.lookup("150A.T") == jsh


def test_directory_lookup_classic_code():
    steel = directory.lookup("5401")
    assert steel and steel.name == "日本製鉄" and steel.segment == "東証プライム"


@pytest.mark.parametrize(
    "query,code",
    [
        ("JSH", "150A"),
        ("jsh", "150A"),
        ("株式会社JSH", "150A"),
        ("株式会社ＪＳＨ", "150A"),
        ("日本製鉄", "5401"),
        ("日本製鉄株式会社", "5401"),
        ("トヨタ自動車", "7203"),
        ("5401", "5401"),
        ("150A", "150A"),
    ],
)
def test_directory_search_top_hit(query, code):
    hits = directory.search(query, limit=5)
    assert hits, query
    assert hits[0][1].code == code, [h[1].code for h in hits]


def test_directory_search_hiragana_matches_katakana():
    codes = [issue.code for _, issue in directory.search("とよた", limit=10)]
    assert "7203" in codes


def test_directory_search_partial_code():
    codes = [issue.code for _, issue in directory.search("150", limit=20)]
    assert "150A" in codes


# ------------------------------------------------------------ 検索の統合
class FakeProvider:
    """Yahoo Finance の検索・銘柄情報を模したフェイク。"""

    def __init__(self, search_results=None, existing=None):
        self._search = search_results or {}
        self._existing = existing or {}

    def search(self, query, limit=10):
        return self._search.get(query.lower(), [])

    def get_info(self, ticker):
        if ticker not in self._existing:
            raise SymbolNotFoundError(ticker)
        return SymbolInfo(ticker=ticker, name=self._existing[ticker], market="US", currency="USD")


def cand(ticker, name, exch_code, exch, qtype="EQUITY"):
    return SymbolCandidate(ticker=ticker, name=name, exchange=exch, exchange_code=exch_code, quote_type=qtype)


APPLE_SEARCH = [
    cand("AAPL", "Apple Inc.", "NMS", "NASDAQ"),
    cand("SAAPL=F", "Apple futures", "CME", "Chicago Mercantile Exchange", "FUTURE"),
    cand("APLE", "Apple Hospitality REIT, Inc.", "NYQ", "NYSE"),
    cand("AAPL.TO", "Apple Inc.", "TOR", "Toronto"),
]
JSH_SEARCH = [
    cand("JSHL.BO", "JLA Infraville", "BSE", "Bombay"),
    cand("JSHG", "Joshua Gold Resources", "OID", "OID"),
    cand("150A.T", "JSH Co.,Ltd.", "JPX", "Tokyo Stock Exchange"),
    cand("JSHSX", "Janus Henderson fund", "NAS", "NASDAQ", "MUTUALFUND"),
]


@pytest.fixture
def fake(monkeypatch):
    def install(**kwargs):
        provider = FakeProvider(**kwargs)
        monkeypatch.setattr(search_service, "get_provider", lambda: provider)
        return provider

    return install


def test_search_company_name_filters_noise(fake):
    fake(search_results={"apple": APPLE_SEARCH})
    results = search_service.search("Apple")
    tickers = [r.ticker for r in results]
    assert tickers[0] == "AAPL"
    assert results[0].exchange == "NASDAQ"
    assert "APLE" in tickers
    # 先物・カナダの重複上場は出さない
    assert "SAAPL=F" not in tickers and "AAPL.TO" not in tickers


def test_search_exact_ticker_first(fake):
    fake(search_results={"nvda": [cand("NVDX", "2X NVIDIA", "BTS", "BATS", "ETF"), cand("NVDA", "NVIDIA Corporation", "NMS", "NASDAQ")]})
    results = search_service.search("NVDA")
    assert results[0].ticker == "NVDA" and results[0].exact


def test_search_jsh_by_name_and_code(fake):
    fake(search_results={"jsh": JSH_SEARCH, "150a": [JSH_SEARCH[2]]})
    for q in ["JSH", "株式会社JSH", "150A", "150a"]:
        results = search_service.search(q)
        top = results[0]
        assert top.ticker == "150A.T", (q, [r.ticker for r in results])
        assert top.name == "JSH"
        assert top.exchange == "東証グロース"
        assert top.market == "JP"
    # インド・OTC・投信はフィルタされる
    tickers = [r.ticker for r in search_service.search("JSH")]
    assert not any(t in tickers for t in ["JSHL.BO", "JSHG", "JSHSX"])


def test_search_japanese_name_uses_directory_only(fake):
    provider = fake()
    called = []
    provider.search = lambda q, limit=10: called.append(q) or []
    results = search_service.search("日本製鉄")
    assert results[0].ticker == "5401.T"
    assert results[0].exchange == "東証プライム"
    assert called == []  # 日本語はデータソース検索を呼ばない（引けないので無駄）


def test_search_unknown_jp_code_offers_suffix_fallback(fake):
    fake()
    results = search_service.search("9Z9Z")
    assert results[0].ticker == "9Z9Z.T"
    assert results[0].verified is False


def test_search_nothing_found_offers_raw_ticker(fake):
    fake()
    results = search_service.search("ZZQQ")
    assert [r.ticker for r in results] == ["ZZQQ"]
    assert results[0].verified is False


# ------------------------------------------------------------------ 銘柄解決
def test_resolve_alnum_code(fake):
    fake(existing={"150A.T": "JSH Co.,Ltd."})
    assert search_service.resolve("150A") == "150A.T"
    assert search_service.resolve("１５０ａ") == "150A.T"


def test_resolve_unknown_code_falls_back_to_raw(fake):
    fake(existing={"9Z9Z": "Hypothetical"})
    assert search_service.resolve("9Z9Z") == "9Z9Z"


def test_resolve_company_name(fake):
    fake(existing={"5401.T": "Nippon Steel"})
    assert search_service.resolve("日本製鉄") == "5401.T"


def test_resolve_not_found(fake):
    fake()
    with pytest.raises(SymbolNotFoundError):
        search_service.resolve("ZZQQ")


def test_search_filters_pts_symbols(fake):
    """5401@F.T のような私設取引所（PTS）の派生シンボルは候補に出さない。"""
    fake(search_results={"5401": [
        cand("5401.T", "NIPPON STEEL", "JPX", "Tokyo"),
        cand("5401@F.T", "NIPPON STEEL", "JPX", "Tokyo"),
        cand("5401@S.T", "NIPPON STEEL", "JPX", "Tokyo"),
    ]})
    assert [r.ticker for r in search_service.search("5401")] == ["5401.T"]


def test_search_prefers_large_caps_on_tie(fake):
    """「とよた」はトヨタ紡織（Mid400）よりトヨタ自動車（Core30）を先に出す。"""
    fake()
    results = search_service.search("とよた")
    assert results[0].ticker == "7203.T", [r.name for r in results]
