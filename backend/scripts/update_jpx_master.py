"""JPX（日本取引所グループ）の上場銘柄一覧から、銘柄辞書 JSON を作り直すスクリプト。

    cd backend
    ./.venv/Scripts/python.exe scripts/update_jpx_master.py

出力: app/data/jpx_listed.json（リポジトリにコミットして使う）

- 日本語社名での検索と、「東証プライム／グロース」などの市場区分表示に使う
- 実行時に JPX へアクセスしないよう、生成結果をファイルとして同梱する
- 新規上場があったら、このスクリプトを流し直して JSON を更新する
  （辞書に無い新しいコードでも、コード入力なら .T を付けた取得にフォールバックする）

依存: pandas, openpyxl（このスクリプト専用。アプリ本体の実行には不要）
"""
from __future__ import annotations

import io
import json
import re
import sys
import unicodedata
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

LIST_PAGE = "https://www.jpx.co.jp/markets/statistics-equities/misc/01.html"
BASE = "https://www.jpx.co.jp"
OUT = Path(__file__).resolve().parents[1] / "app" / "data" / "jpx_listed.json"

# JPX の「市場・商品区分」→ 画面表示用の短い名前
SEGMENTS = {
    "プライム（内国株式）": "東証プライム",
    "スタンダード（内国株式）": "東証スタンダード",
    "グロース（内国株式）": "東証グロース",
    "プライム（外国株式）": "東証プライム（外国株）",
    "スタンダード（外国株式）": "東証スタンダード（外国株）",
    "グロース（外国株式）": "東証グロース（外国株）",
    "ETF・ETN": "東証 ETF・ETN",
    "REIT・ベンチャーファンド・カントリーファンド・インフラファンド": "東証 REIT等",
    "PRO Market": "TOKYO PRO Market",
    "出資証券": "東証 出資証券",
}

# 規模区分 → 並び順に使う数値（小さいほど大型・有名な銘柄）
SIZE_RANK = {
    "TOPIX Core30": 1,
    "TOPIX Large70": 2,
    "TOPIX Mid400": 3,
    "TOPIX Small 1": 4,
    "TOPIX Small 2": 5,
}

KINDS = {
    "ETF・ETN": "ETF",
    "REIT・ベンチャーファンド・カントリーファンド・インフラファンド": "REIT",
}


def find_xlsx_url() -> str:
    html = urllib.request.urlopen(LIST_PAGE, timeout=30).read().decode("utf-8", "replace")
    match = re.search(r'href="([^"]+data_j\.xlsx?)"', html)
    if not match:
        raise SystemExit("JPX のページから上場銘柄一覧のリンクが見つかりませんでした。")
    href = match.group(1)
    return href if href.startswith("http") else BASE + href


def clean_name(raw: str) -> str:
    """全角英数・全角スペースを半角に寄せる（ＪＳＨ → JSH）。"""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", str(raw))).strip()


def main() -> None:
    url = find_xlsx_url()
    print("downloading", url)
    data = urllib.request.urlopen(url, timeout=60).read()
    df = pd.read_excel(io.BytesIO(data), dtype=str)

    as_of = str(df["日付"].iloc[0]) if "日付" in df.columns and len(df) else ""
    rows = []
    for _, r in df.iterrows():
        code = str(r["コード"]).strip().upper()
        segment_raw = str(r["市場・商品区分"]).strip()
        rows.append(
            {
                "code": code,
                "name": clean_name(r["銘柄名"]),
                "segment": SEGMENTS.get(segment_raw, "東証"),
                "kind": KINDS.get(segment_raw, "EQUITY"),
                "industry": "" if str(r.get("33業種区分", "-")) in ("-", "nan") else str(r["33業種区分"]),
                "size": SIZE_RANK.get(str(r.get("規模区分", "")).strip(), 9),
            }
        )

    rows.sort(key=lambda x: x["code"])
    payload = {
        "source": url,
        "asOf": as_of,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(rows),
        "items": rows,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    alnum = sum(1 for x in rows if not x["code"].isdigit())
    print(f"wrote {OUT} ({len(rows)} issues, {alnum} with letters, as of {as_of})")


if __name__ == "__main__":
    sys.exit(main())
