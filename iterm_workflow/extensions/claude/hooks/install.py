#!/usr/bin/env python3
"""Interactive installer: register iterm2-pane-tree hooks in ~/.claude/settings.json.

Run once after cloning the repo. Re-running is safe (idempotent).
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

DESCRIPTIONS: dict[str, str] = {
    "UserPromptSubmit": "you submit a prompt → marks the pane as running",
    "Stop": "Claude finishes a turn   → marks the pane as idle",
    "Notification": "Claude needs attention    → marks the pane as attention (❗)",
}


def _cmd(state: str) -> str:
    return f"{NOTIFY} {state}"


def _already_present(entries: list, state: str) -> bool:
    needle = f"notify.sh {state}"
    return any(needle in json.dumps(e) for e in entries)


def main() -> None:
    print()
    print("iterm2-pane-tree — Claude Code hook installer")
    print("=" * 48)
    print()
    print("This script adds three entries to:")
    print(f"  {SETTINGS}")
    print()
    print("Hook script that will be registered:")
    print(f"  {NOTIFY}")
    print()

    if not NOTIFY.exists():
        print(f"ERROR: hook script not found at {NOTIFY}")
        print("Make sure you are running this from the correct repo.")
        sys.exit(1)

    # Load existing settings (or empty dict).
    existing: dict = {}
    if SETTINGS.exists():
        try:
            existing = json.loads(SETTINGS.read_text())
        except Exception as exc:
            print(f"ERROR: could not parse {SETTINGS}: {exc}")
            sys.exit(1)

    hooks: dict = existing.get("hooks", {})

    # Check which events need adding.
    to_add: list[str] = []
    for event, state in EVENTS.items():
        entries = hooks.get(event, [])
        if not _already_present(entries, state):
            to_add.append(event)

    if not to_add:
        print("Already installed — all three hooks are present. Nothing to do.")
        sys.exit(0)

    # Show the diff.
    print("Changes that will be made:")
    print()
    for event in EVENTS:
        state = EVENTS[event]
        entries = hooks.get(event, [])
        desc = DESCRIPTIONS[event]
        if _already_present(entries, state):
            print(f"  {event}")
            print("    ✓ already present — skip")
        else:
            print(f"  {event}  [{desc}]")
            if entries:
                print(f"    existing entries: {len(entries)} (will be kept)")
            else:
                print("    existing entries: [none]")
            print(f"    + add: {_cmd(state)}")
        print()

    if SETTINGS.exists():
        print(f"A backup will be written to: {SETTINGS}.bak")
    else:
        print(f"Note: {SETTINGS} does not exist — it will be created.")
    print()

    answer = input("Apply these changes? [y/N]: ").strip().lower()
    if answer != "y":
        print("Aborted — no changes made.")
        sys.exit(0)

    # Build updated settings.
    updated = dict(existing)
    updated_hooks: dict = dict(hooks)
    for event, state in EVENTS.items():
        entries = list(updated_hooks.get(event, []))
        if not _already_present(entries, state):
            entries.append({"hooks": [{"type": "command", "command": _cmd(state)}]})
        updated_hooks[event] = entries
    updated["hooks"] = updated_hooks

    # Backup then atomic write.
    SETTINGS.parent.mkdir(parents=True, exist_ok=True)
    if SETTINGS.exists():
        bak = SETTINGS.with_suffix(".json.bak")
        bak.write_text(SETTINGS.read_text())
        print(f"Backup written to: {bak}")

    tmp = SETTINGS.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(updated, indent=2) + "\n")
    os.replace(tmp, SETTINGS)

    print(f"Done — hooks registered in {SETTINGS}")
    print()
    print("Restart any open Claude Code sessions for the hooks to take effect.")


if __name__ == "__main__":
    main()
