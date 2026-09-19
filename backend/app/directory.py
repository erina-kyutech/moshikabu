"""日本株の銘柄辞書（JPX 上場銘柄一覧から生成した JSON）。

役割:
  - 日本語社名での検索（Yahoo Finance の検索は日本語の社名を引けないため）
  - 「東証プライム／グロース」などの市場区分の表示
  - 証券コードが実在する日本株かどうかの判定材料

辞書は scripts/update_jpx_master.py で生成して同梱している。
辞書に無いコード（辞書更新後の新規上場など）でも、呼び出し側で
「.T を付けて株価取得を試す」フォールバックを行うので、辞書の鮮度は致命的ではない。
"""
from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

_DATA_FILE = Path(__file__).resolve().parent / "data" / "jpx_listed.json"

# 検索時に無視する法人格などの表記
_NOISE = re.compile(r"株式会社|\(株\)|（株）|㈱|有限会社|合同会社|co\.?,?\s*ltd\.?|inc\.?|corp(oration)?\.?", re.I)


@dataclass(frozen=True)
class JpIssue:
    code: str       # 証券コード（例: 5401 / 150A）
    name: str       # 銘柄名（例: 日本製鉄 / JSH）
    segment: str    # 表示用の市場区分（例: 東証プライム）
    kind: str       # EQUITY / ETF / REIT
    industry: str
    size: int = 9   # 規模（1=TOPIX Core30 … 5=Small 2、9=指数外）。検索の並び順に使う

    @property
    def ticker(self) -> str:
        return f"{self.code}.T"


def search_key(text: str) -> str:
    """検索用の正規化。

    全角→半角、大文字小文字の無視、ひらがな→カタカナ、空白・法人格の除去。
      「株式会社ＪＳＨ」→「jsh」、「とよた」→「トヨタ」
    """
    s = unicodedata.normalize("NFKC", text or "")
    s = _NOISE.sub("", s)
    s = "".join(chr(ord(c) + 0x60) if "ぁ" <= c <= "ゖ" else c for c in s)
    s = re.sub(r"[\s・･\-_.,、。()（）\[\]「」]", "", s)
    return s.lower()


@dataclass(frozen=True)
class _Directory:
    as_of: str
    by_code: dict[str, JpIssue]
    entries: tuple[tuple[str, JpIssue], ...]   # (search_key(name), issue)


@lru_cache(maxsize=1)
def _load() -> _Directory:
    try:
        payload = json.loads(_DATA_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        # 辞書が無くてもアプリは動かす（日本語名検索と市場区分表示だけが使えなくなる）
        return _Directory(as_of="", by_code={}, entries=())

    by_code: dict[str, JpIssue] = {}
    entries: list[tuple[str, JpIssue]] = []
    for row in payload.get("items", []):
        issue = JpIssue(
            code=str(row["code"]).upper(),
            name=row.get("name") or row["code"],
            segment=row.get("segment") or "東証",
            kind=row.get("kind") or "EQUITY",
            industry=row.get("industry") or "",
            size=int(row.get("size") or 9),
        )
        by_code[issue.code] = issue
        entries.append((search_key(issue.name), issue))
    return _Directory(as_of=str(payload.get("asOf", "")), by_code=by_code, entries=tuple(entries))


def as_of() -> str:
    return _load().as_of


def lookup(code_or_ticker: str) -> JpIssue | None:
    """証券コード（5401 / 150A）または Yahoo 形式（5401.T）から引く。"""
    s = unicodedata.normalize("NFKC", code_or_ticker or "").strip().upper()
    if s.endswith(".T"):
        s = s[:-2]
    return _load().by_code.get(s)


def search(query: str, limit: int = 10) -> list[tuple[int, JpIssue]]:
    """社名・コードで日本株を探す。(スコア, 銘柄) を良い順に返す。"""
    key = search_key(query)
    if not key:
        return []

    code = unicodedata.normalize("NFKC", query).strip().upper().removesuffix(".T")
    results: dict[str, tuple[int, JpIssue]] = {}

    exact_code = _load().by_code.get(code)
    if exact_code:
        results[exact_code.code] = (100, exact_code)

    for name_key, issue in _load().entries:
        if not name_key:
            continue
        if name_key == key:
            score = 90
        elif name_key.startswith(key):
            score = 80
        elif key in name_key:
            score = 60
        elif len(key) >= 2 and issue.code.lower().startswith(key):
            score = 50  # コードの前方一致（「150」→ 150A）
        else:
            continue
        prev = results.get(issue.code)
        if prev is None or prev[0] < score:
            results[issue.code] = (score, issue)

    # 同点なら、大型でよく知られた銘柄（TOPIX Core30 など）→ 名前が短い順
    ordered = sorted(results.values(), key=lambda x: (-x[0], x[1].size, len(x[1].name), x[1].code))
    return ordered[:limit]
