"""TTY-keyed signal-file reader for extension message channels.

Each SignalSource watches a directory for JSON files named <tty-basename>.json
(e.g. ttys003.json) written atomically by in-pane hook scripts. read_all()
is called once per snapshot tick and returns parsed payloads indexed by
source name and TTY basename, with opportunistic GC of stale files.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path


@dataclass
class SignalSource:
    name: str
    directory: Path
    # None (default) means signals represent persistent state — files live
    # until the next hook overwrites them or the daemon restarts. Set a value
    # only if signals are events that should expire (e.g. a 5s heartbeat).
    ttl_seconds: float | None = None


def read_all(sources: list[SignalSource]) -> dict[str, dict[str, dict]]:
    """Return {source_name: {tty_basename: payload_dict}} for all sources.

    If a source declares a ttl_seconds, files older than that are skipped and
    opportunistically removed. Otherwise files persist and are only cleaned at
    daemon startup (see sweep_sources). Any file that cannot be stat'd, read,
    or parsed is silently skipped.
    """
    result: dict[str, dict[str, dict]] = {}
    now = time.time()
    for src in sources:
        payloads: dict[str, dict] = {}
        try:
            files = list(src.directory.glob("*.json"))
        except Exception:
            result[src.name] = payloads
            continue
        for f in files:
            try:
                if src.ttl_seconds is not None and now - f.stat().st_mtime > src.ttl_seconds:
                    f.unlink(missing_ok=True)
                    continue
                data = json.loads(f.read_text())
                if isinstance(data, dict):
                    payloads[f.stem] = data
            except Exception:
                pass
        result[src.name] = payloads
    return result


def sweep_sources(sources: list[SignalSource], ttl_seconds: float = 60.0) -> None:
    """Remove signal files older than ttl_seconds from each source's directory.

    Called once at daemon startup to clear leftovers from a previous run while
    preserving any signals written within the last ttl_seconds (which may be
    from a hook that fired during the daemon restart).
    """
    now = time.time()
    for src in sources:
        if not src.directory.is_dir():
            continue
        for f in src.directory.glob("*.json"):
            try:
                if now - f.stat().st_mtime > ttl_seconds:
                    f.unlink(missing_ok=True)
            except Exception:
                pass
