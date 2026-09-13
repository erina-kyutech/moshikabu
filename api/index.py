"""Vercel Serverless Function のエントリポイント。

backend/ 配下の FastAPI アプリをそのまま ASGI として公開する。
ローカル開発では backend ディレクトリで uvicorn app.main:app を使う。
"""
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_BACKEND = os.path.join(_ROOT, "backend")
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from app.main import app  # noqa: E402

__all__ = ["app"]
