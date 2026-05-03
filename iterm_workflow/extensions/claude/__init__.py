"""Claude extension: detect Claude-driven panes and tweak their rendering.

Adds the field `ext.claude.active` to each session node and registers a JS
asset that decorates the matching rows in the webview.
"""

from __future__ import annotations

from pathlib import Path

from extensions._api import ExtensionAPI

from .detector import detect

_DIR = Path(__file__).resolve().parent


def register(api: ExtensionAPI) -> None:
    api.add_session_enricher(detect)
    api.add_static_dir(_DIR / "static")
    api.add_webview_asset("css", "claude.css")
    api.add_webview_asset("js", "claude.js")
