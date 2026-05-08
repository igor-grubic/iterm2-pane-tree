#!/usr/bin/env python3
"""Interactive uninstaller: remove iterm2-pane-tree hooks from ~/.claude/settings.json.

Run to undo what install.py added. Re-running is safe (idempotent).
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

SETTINGS = Path.home() / ".claude" / "settings.json"
NOTIFY = Path(__file__).resolve().parent / "notify.sh"

EVENTS: dict[str, str] = {
    "UserPromptSubmit": "running",
    "Stop": "idle",
    "Notification": "attention",
}


def _our_entry(entries: list, state: str) -> list[int]:
    """Return indices of entries that contain our notify.sh command."""
    needle = f"notify.sh {state}"
    return [i for i, e in enumerate(entries) if needle in json.dumps(e)]


def main() -> None:
    print()
    print("iterm2-pane-tree — Claude Code hook uninstaller")
    print("=" * 49)
    print()
    print("This script removes iterm2-pane-tree hook entries from:")
    print(f"  {SETTINGS}")
    print()

    if not SETTINGS.exists():
        print(f"{SETTINGS} does not exist — nothing to remove.")
        sys.exit(0)

    try:
        existing = json.loads(SETTINGS.read_text())
    except Exception as exc:
        print(f"ERROR: could not parse {SETTINGS}: {exc}")
        sys.exit(1)

    hooks: dict = existing.get("hooks", {})

    # Find what we actually installed.
    to_remove: dict[str, list[int]] = {}
    for event, state in EVENTS.items():
        entries = hooks.get(event, [])
        indices = _our_entry(entries, state)
        if indices:
            to_remove[event] = indices

    if not to_remove:
        print("No iterm2-pane-tree hook entries found — nothing to remove.")
        sys.exit(0)

    print("Entries that will be removed:")
    print()
    for event, _state in EVENTS.items():
        entries = hooks.get(event, [])
        indices = to_remove.get(event, [])
        if indices:
            for i in indices:
                cmd = json.dumps(entries[i])
                print(f"  {event}")
                print(f"    - {cmd}")
        else:
            print(f"  {event}")
            print("    ✓ not present — skip")
        print()

    remaining: dict[str, int] = {}
    for event, indices in to_remove.items():
        total = len(hooks.get(event, []))
        remaining[event] = total - len(indices)
    kept = [f"{event} ({remaining[event]} other entries kept)" for event in to_remove if remaining[event] > 0]
    if kept:
        print("Other hooks in these events will be preserved:")
        for line in kept:
            print(f"  {line}")
        print()

    print(f"A backup will be written to: {SETTINGS}.bak")
    print()

    answer = input("Remove these entries? [y/N]: ").strip().lower()
    if answer != "y":
        print("Aborted — no changes made.")
        sys.exit(0)

    # Build updated settings with our entries removed.
    updated = dict(existing)
    updated_hooks = dict(hooks)
    for event, indices in to_remove.items():
        entries = list(updated_hooks.get(event, []))
        for i in sorted(indices, reverse=True):
            entries.pop(i)
        if entries:
            updated_hooks[event] = entries
        else:
            del updated_hooks[event]

    if updated_hooks:
        updated["hooks"] = updated_hooks
    elif "hooks" in updated:
        del updated["hooks"]

    # Backup then atomic write.
    bak = SETTINGS.with_suffix(".json.bak")
    bak.write_text(SETTINGS.read_text())
    print(f"Backup written to: {bak}")

    tmp = SETTINGS.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(updated, indent=2) + "\n")
    os.replace(tmp, SETTINGS)

    print(f"Done — hook entries removed from {SETTINGS}")


if __name__ == "__main__":
    main()
