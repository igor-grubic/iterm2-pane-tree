"""Discover, validate, and load enabled extensions at daemon startup."""

from __future__ import annotations

import importlib
import json
import logging
from pathlib import Path

from ._api import ExtensionAPI, Registry

log = logging.getLogger("iterm2_claude_cockpit.extensions")

PKG_ROOT = Path(__file__).resolve().parent.parent
EXT_ROOT = PKG_ROOT / "extensions"
CONFIG_PATH = PKG_ROOT / "extensions.json"

# extensions.json is user-writable (and gitignored), so on a fresh checkout
# it doesn't exist. Ship "claude" enabled by default to match what the
# CHANGELOG / README promise.
DEFAULT_ENABLED: list[str] = ["claude"]


def list_available() -> list[str]:
    if not EXT_ROOT.is_dir():
        return []
    out: list[str] = []
    for p in sorted(EXT_ROOT.iterdir()):
        if not p.is_dir() or p.name.startswith("_"):
            continue
        if (p / "__init__.py").is_file():
            out.append(p.name)
    return out


def read_config() -> dict:
    if not CONFIG_PATH.is_file():
        return {"enabled": list(DEFAULT_ENABLED)}
    try:
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except Exception:
        log.exception("extensions.json is invalid; treating as empty")
        return {"enabled": []}
    if not isinstance(data, dict):
        return {"enabled": []}
    enabled = data.get("enabled")
    if not isinstance(enabled, list):
        data["enabled"] = []
    return data


def write_config(data: dict) -> None:
    CONFIG_PATH.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def list_enabled() -> list[str]:
    return [str(n) for n in read_config().get("enabled", []) if isinstance(n, str)]


def load() -> Registry:
    registry = Registry()
    available = set(list_available())
    for name in list_enabled():
        if name not in available:
            log.warning("extension %r: not found under %s; skipping", name, EXT_ROOT)
            continue
        ext_dir = EXT_ROOT / name
        try:
            mod = importlib.import_module(f"extensions.{name}")
        except Exception:
            log.exception("extension %r: import failed; skipping", name)
            continue
        register = getattr(mod, "register", None)
        if not callable(register):
            log.warning("extension %r: no register(api) function; skipping", name)
            continue
        api = ExtensionAPI(name, ext_dir, registry)
        try:
            register(api)
        except Exception:
            log.exception("extension %r: register() raised; skipping", name)
            continue
        log.info("extension %r loaded", name)
    return registry
