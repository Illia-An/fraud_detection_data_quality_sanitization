"""In-process /process result cache for snapshot ``source=db`` (Wave 9 / P-04).

Enabled by default after measured p95 exceeded interactive SLA on the default
``from_2025`` window. Disable with ``PROCESS_RESULT_CACHE=0``.

Key: ``(snapshot_loaded_at, from_date, to_date, config hash)``.
Per-process only — with ``UVICORN_WORKERS>1`` each worker has its own copy.
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
from collections import OrderedDict
from typing import Any

from backend.schemas import ProcessRequest, SanitizationResponse


def _truthy(raw: str) -> bool:
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _falsy(raw: str) -> bool:
    return raw.strip().lower() in ("0", "false", "no", "off")


def process_result_cache_enabled() -> bool:
    """Default on; set ``PROCESS_RESULT_CACHE=0`` to disable."""
    raw = os.environ.get("PROCESS_RESULT_CACHE", "").strip()
    if raw and _falsy(raw):
        return False
    if raw and _truthy(raw):
        return True
    return True


def process_result_cache_maxsize() -> int:
    raw = os.environ.get("PROCESS_RESULT_CACHE_SIZE", "").strip()
    if raw:
        try:
            return max(1, min(int(raw), 256))
        except ValueError:
            pass
    return 32


def make_process_cache_key(
    body: ProcessRequest,
    *,
    snapshot_loaded_at: str | None,
) -> str:
    """Stable hash for deterministic snapshot process results."""
    payload = {
        "loaded_at": snapshot_loaded_at or "",
        "from_date": body.from_date.isoformat() if body.from_date else None,
        "to_date": body.to_date.isoformat() if body.to_date else None,
        "config": body.config.model_dump(mode="json"),
    }
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


class ProcessResultCache:
    """Thread-safe bounded LRU of ``SanitizationResponse`` + meta_extra."""

    def __init__(self, maxsize: int | None = None) -> None:
        self._maxsize = process_result_cache_maxsize() if maxsize is None else maxsize
        self._lock = threading.Lock()
        self._data: OrderedDict[str, tuple[SanitizationResponse, dict[str, Any]]] = (
            OrderedDict()
        )
        self.hits = 0
        self.misses = 0

    def clear(self) -> None:
        with self._lock:
            self._data.clear()
            self.hits = 0
            self.misses = 0

    def get(
        self, key: str
    ) -> tuple[SanitizationResponse, dict[str, Any]] | None:
        with self._lock:
            item = self._data.get(key)
            if item is None:
                self.misses += 1
                return None
            self._data.move_to_end(key)
            self.hits += 1
            result, meta_extra = item
            # Defensive copy so callers can mutate meta without poisoning cache.
            return (
                SanitizationResponse.model_validate(result.model_dump(mode="python")),
                dict(meta_extra),
            )

    def put(
        self,
        key: str,
        result: SanitizationResponse,
        meta_extra: dict[str, Any],
    ) -> None:
        stored_result = SanitizationResponse.model_validate(
            result.model_dump(mode="python")
        )
        stored_meta = dict(meta_extra)
        with self._lock:
            self._data[key] = (stored_result, stored_meta)
            self._data.move_to_end(key)
            while len(self._data) > self._maxsize:
                self._data.popitem(last=False)


_CACHE = ProcessResultCache()


def get_process_result_cache() -> ProcessResultCache:
    return _CACHE


def clear_process_result_cache() -> None:
    _CACHE.clear()
