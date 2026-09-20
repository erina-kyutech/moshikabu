"""プロセス内 TTL キャッシュ。

Yahoo Finance への無駄なアクセスを減らすための最小実装。
将来 Redis 等に差し替える場合もこのモジュールだけを変更すればよい。
"""
from __future__ import annotations

import threading
import time
from typing import Any, Callable, TypeVar

T = TypeVar("T")

_lock = threading.Lock()
_store: dict[str, tuple[float, Any]] = {}

# 日足は数分キャッシュ、現在値は短め
TTL_QUOTE = 60          # 秒
TTL_HISTORY = 300
TTL_INTRADAY = 60       # 分足は短め（デイトレ画面が定期取得するため）
TTL_ACTIONS = 3600
TTL_INFO = 3600


def get_or_set(key: str, ttl: int, producer: Callable[[], T]) -> T:
    now = time.time()
    with _lock:
        hit = _store.get(key)
        if hit and hit[0] > now:
            return hit[1]
    value = producer()
    with _lock:
        _store[key] = (now + ttl, value)
        if len(_store) > 500:  # 単純な上限管理
            for k in [k for k, v in _store.items() if v[0] <= now]:
                _store.pop(k, None)
    return value


def clear() -> None:
    with _lock:
        _store.clear()
