"""Detect Claude-driven panes by job name or descendant process."""

from __future__ import annotations

from typing import Any

_CLAUDE_JOBS = {"claude", "claude-code"}


def _has_claude_descendant(shell_pid: str, ps_output: str) -> bool:
    shell_pid = shell_pid.strip()
    children: dict[str, list[str]] = {}
    comms: dict[str, str] = {}
    for line in ps_output.splitlines():
        parts = line.split(None, 2)
        if len(parts) < 3:
            continue
        pid, ppid, comm = parts[0], parts[1], parts[2].strip()
        comms[pid] = comm
        children.setdefault(ppid, []).append(pid)

    queue = list(children.get(shell_pid, []))
    visited: set[str] = {shell_pid}
    while queue:
        pid = queue.pop()
        if pid in visited:
            continue
        visited.add(pid)
        if "claude" in comms.get(pid, "").lower():
            return True
        queue.extend(children.get(pid, []))
    return False


_PLAN_MARKERS = (
    "plan mode on",  # the plan-mode banner
    "Claude has written up a plan",  # plan-approval prompt header
    "shift+tab to approve",  # plan-approval prompt footer
)


def _classify(screen_lines: list[str]) -> tuple[str, bool]:
    """Return (mode, action_needed) from recent screen content.

    mode is 'plan' if the plan-mode banner OR the plan-approval prompt is
    visible, else 'working'. The plan-approval prompt replaces the banner
    on screen, so we look for either marker.

    action_needed is True if a numbered choice prompt is visible. The two
    signals are independent: plan mode + approval prompt is a valid
    combination.
    """
    mode = "working"
    action_needed = False
    for line in screen_lines:
        if not action_needed and line.lstrip().startswith("❯ 1."):
            action_needed = True
        if mode == "working" and any(m in line for m in _PLAN_MARKERS):
            mode = "plan"
    return mode, action_needed


async def detect(
    session: Any,
    node: dict,
    ps_output: str,
    screen_lines: list[str],
) -> dict:
    """Session enricher: classify Claude state from job + recent screen lines."""
    job = node.get("job") or ""
    active = job in _CLAUDE_JOBS
    if not active and ps_output:
        try:
            raw_pid = await session.async_get_variable("pid")
            shell_pid = str(raw_pid).strip() if raw_pid is not None else None
        except Exception:
            shell_pid = None
        if shell_pid:
            active = _has_claude_descendant(shell_pid, ps_output)
    if active:
        mode, action_needed = _classify(screen_lines)
    else:
        mode, action_needed = "idle", False
    return {
        "ext.claude.active": active,
        "ext.claude.mode": mode,
        "ext.claude.action_needed": action_needed,
    }
