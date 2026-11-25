"""ローカル開発用に backend/.env を読み込む。

Vercel では環境変数がプラットフォームから渡るため、このファイルは存在しない。
依存を増やさないよう、必要最小限の読み取りだけを行う。
"""
from __future__ import annotations

import os
from pathlib import Path


def _load_env_file() -> None:
    path = Path(__file__).resolve().parent.parent / ".env"
    if not path.exists():
        return
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        # すでに環境変数があるときは、そちらを優先する
        os.environ.setdefault(key, value)


_load_env_file()
