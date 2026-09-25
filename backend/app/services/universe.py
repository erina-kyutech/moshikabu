"""スクリーニングの対象銘柄（ユニバース）。

財務データは1銘柄ずつ取得する必要があり、全上場銘柄（4,000超）を毎回調べると
現実的な時間で終わらない。そこで、規模の大きい銘柄を中心にした
現実的な大きさのユニバースを用意する。

日本株は JPX の上場銘柄一覧（app/data/jpx_listed.json）の規模区分から作るので、
銘柄リストを手で持つ必要がない。
"""
from __future__ import annotations

from dataclasses import dataclass

from .. import directory

# 米国株は規模区分のデータを持っていないため、代表的な大型株を明示的に並べる
US_LARGE_CAPS: tuple[str, ...] = (
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "AVGO", "TSLA", "BRK-B", "JPM",
    "LLY", "V", "XOM", "UNH", "MA", "COST", "HD", "PG", "JNJ", "ABBV",
    "WMT", "NFLX", "CRM", "BAC", "AMD", "KO", "PEP", "ADBE", "TMO", "CSCO",
    "MCD", "ORCL", "ACN", "INTC", "QCOM", "TXN", "DIS", "PFE", "IBM", "GE",
)


@dataclass(frozen=True)
class UniverseDef:
    id: str
    label: str
    description: str
    size: int
    slow: bool = False   # 取得に時間がかかる（画面で注意を出す）


UNIVERSES: tuple[UniverseDef, ...] = (
    UniverseDef("jp-core30", "日本株・超大型（31銘柄）", "TOPIX Core30。いちばん速く終わります", 31),
    UniverseDef("jp-large", "日本株・大型（99銘柄）", "TOPIX Core30 + Large70", 99, slow=True),
    UniverseDef("us-large", "米国株・大型（40銘柄）", "代表的な米国大型株", 40, slow=True),
    UniverseDef("all", "日本株・大型 ＋ 米国株（139銘柄）", "時間がかかります", 139, slow=True),
    UniverseDef("jp-mid", "日本株・中型まで（492銘柄）", "非常に時間がかかります。ローカル環境向け", 492, slow=True),
)

UNIVERSE_BY_ID = {u.id: u for u in UNIVERSES}
DEFAULT_UNIVERSE = "jp-core30"


def _jp_by_size(max_size: int) -> list[str]:
    """JPX の規模区分（1=TOPIX Core30 … 5=Small2）で絞った日本株。"""
    issues = [
        issue
        for issue in directory.all_issues()
        if issue.kind == "EQUITY" and issue.size <= max_size
    ]
    issues.sort(key=lambda i: (i.size, i.code))
    return [i.ticker for i in issues]


def tickers(universe_id: str) -> list[str]:
    key = (universe_id or DEFAULT_UNIVERSE).lower()
    if key == "jp-core30":
        return _jp_by_size(1)
    if key == "jp-large":
        return _jp_by_size(2)
    if key == "jp-mid":
        return _jp_by_size(3)
    if key == "us-large":
        return list(US_LARGE_CAPS)
    if key == "all":
        return _jp_by_size(2) + list(US_LARGE_CAPS)
    return _jp_by_size(2)
