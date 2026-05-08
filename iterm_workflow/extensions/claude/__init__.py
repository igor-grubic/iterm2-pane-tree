"""Claude extension: detect Claude-driven panes and tweak their rendering.

Adds ext.claude.{active,state,action_needed} to each session node and
registers JS/CSS assets that decorate matching rows in the webview.
Status is driven by Claude Code hook signal files written to
/tmp/iterm-pane-tree/claude/ by the bundled hooks/notify.sh script.
"""

from __future__ import annotations

from pathlib import Path

from extensions._api import ExtensionAPI

from .detector import detect

_DIR = Path(__file__).resolve().parent

_SIGNAL_DIR = "/tmp/iterm-pane-tree/claude"


def register(api: ExtensionAPI) -> None:
    api.add_signal_dir_source("claude", _SIGNAL_DIR)
    api.add_session_enricher(detect)
    api.add_static_dir(_DIR / "static")
    api.add_webview_asset("css", "claude.css")
    api.add_webview_asset("js", "claude.js")
