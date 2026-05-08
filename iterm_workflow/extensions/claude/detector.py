"""Detect Claude-driven panes via TTY process check and hook signal files."""

from __future__ import annotations

from pathlib import Path
from typing import Any

_CLAUDE_JOBS = {"claude", "claude-code"}

# Narrow set of markers used only to promote state → "plan" when the plan-mode
# banner is visible. Screen-scraping is intentionally limited to this one check.
_PLAN_MARKERS = (
    "plan mode on",
    "Claude has written up a plan",
    "shift+tab to approve",
)


def _claude_attached_to_tty(tty_path: str, ps_output: str) -> bool:
    """True if a claude/claude-code process is attached to this pane's TTY.

    ps_output must be from `ps -A -o pid=,ppid=,tty=,comm=` (4 columns).
    The TTY column in ps output uses the basename (e.g. ttys003), not /dev/.
    """
    if not tty_path or not ps_output:
        return False
    tty_base = Path(tty_path).name  # "/dev/ttys003" → "ttys003"
    for line in ps_output.splitlines():
        parts = line.split(None, 3)
        if len(parts) < 4:
            continue
        _, _, tty_col, comm = parts
        if tty_col.strip() == tty_base and comm.strip() in _CLAUDE_JOBS:
            return True
    return False


def _plan_banner_visible(screen_lines: list[str]) -> bool:
    """True if the plan-mode banner is visible in recent screen content."""
    return any(any(m in line for m in _PLAN_MARKERS) for line in screen_lines)


async def detect(
    session: Any,
    node: dict,
    ps_output: str,
    screen_lines: list[str],
    signals: dict | None = None,
) -> dict:
    """Session enricher: classify Claude state from TTY process check + hook signals."""
    tty = node.get("tty") or ""
    active = _claude_attached_to_tty(tty, ps_output)

    if not active:
        return {
            "ext.claude.active": False,
            "ext.claude.state": "idle",
            "ext.claude.action_needed": False,
        }

    # Read state from hook signal file (keyed by TTY basename).
    tty_base = Path(tty).name if tty else ""
    sig = (signals or {}).get("claude", {}).get(tty_base, {})
    state = sig.get("state", "running")  # default: active but no signal yet → running

    # Narrow screen-scrape fallback for plan-mode (hooks don't cover it).
    if state != "plan" and _plan_banner_visible(screen_lines):
        state = "plan"

    return {
        "ext.claude.active": True,
        "ext.claude.state": state,
        "ext.claude.action_needed": state == "attention",
    }
