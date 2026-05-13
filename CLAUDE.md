# CLAUDE.md — Agent Guide for iterm2-claude-cockpit

This file is the authoritative guide for AI agents (Claude Code and others) working in this repo. Read it before making any changes.

---

## Project in one sentence

`iterm2-claude-cockpit` is a zero-dependency iTerm2 AutoLaunch daemon that serves a live window/tab/pane tree as a toolbelt cockpit, with first-class support for managing parallel Claude Code panes via a bundled extension.

---

## Critical structural constraint — DO NOT change

iTerm2's Full Environment loader requires the folder name, inner package name, and entry script name to all match:

```
iterm2_claude_cockpit/          ← cloned/symlinked folder (must be named iterm2_claude_cockpit)
├── setup.cfg            ← required for Full Environment
└── iterm2_claude_cockpit/      ← Python package (must match folder name)
    └── iterm2_claude_cockpit.py ← entry point (must match package name)
```

Never rename these, change the two-level structure, or remove `setup.cfg`. The repo name (`iterm2-claude-cockpit`) intentionally differs from the install name (`iterm2_claude_cockpit`).

---

## Architecture

See `specs/architecture.md` for the full picture. Quick map:

| Module | Role |
|--------|------|
| `iterm2_claude_cockpit.py` | Daemon entry point; registers iTerm2 update hooks |
| `server/tree.py` | Builds the JSON snapshot (window → tab → pane) |
| `server/http.py` | Serves the panel HTML and `/api/*` routes |
| `server/actions.py` | Handles user actions: focus, create, close, bury |
| `extensions/_api.py` | `ExtensionAPI` and shared `Registry` (the v1 contract) |
| `extensions/_signals.py` | TTY-keyed signal-file reader; feeds hook payloads to enrichers |
| `extensions/_loader.py` | Loads enabled extensions at startup |
| `extensions/claude/` | Bundled Claude-detection extension |
| `webview/` | The browser-side panel (HTML/CSS/JS) |
| `projects/` | User-defined YAML project layouts |

---

## Code style

- Formatter and linter: `ruff` (config in `pyproject.toml`, line length 120)
- Type checker: `mypy` with `ignore_missing_imports = true` (iterm2 has no stubs)
- **No external runtime dependencies** — stdlib + the `iterm2` library only
- Run before every commit:
  ```bash
  ruff check iterm2_claude_cockpit/
  ruff format iterm2_claude_cockpit/
  mypy iterm2_claude_cockpit/
  ```

---

## Changelog — always update

The changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

**Rules:**
- Every user-visible change goes under `## [Unreleased]` before a release
- Use subsections: `### Added`, `### Changed`, `### Fixed`, `### Removed`
- One bullet per change, written for a user, not a developer ("Added X" not "Implement X")
- Extension changes go under `Added` (new extensions) or `Changed` (modifications to existing ones)
- Do not touch dated version sections unless doing a release

**When to update:** Any time you add a feature, fix a bug visible to users, or change user-facing behavior. Internal refactors with no observable effect don't need a changelog entry.

---

## README — keep in sync

The README is the public face. Keep these sections up to date:

- **Features list** — add a bullet if you add a user-visible capability
- **Extensions → Bundled extensions** — update when adding/modifying extensions
- **Extensions → Authoring an extension** — update if the `ExtensionAPI` surface changes
- **Troubleshooting** — add an entry for any new failure mode with a known fix
- **Badges** — do not change the badge URLs; they point to the live CI and shields.io

The Python version badge must reflect `requires-python` in `pyproject.toml`. Both are currently `3.10+`.

---

## Extension authoring rules

- Extensions live in `iterm2_claude_cockpit/extensions/<name>/__init__.py`
- Must expose `register(api: ExtensionAPI) -> None`
- Use `ext.<name>.<field>` namespace for all snapshot keys — never write top-level keys
- Register in `iterm2_claude_cockpit/extensions.json` to appear in `ext list`
- See `specs/extension-api.md` for the full v1 API contract
- The `claude` extension is the canonical worked example

---

## Specs folder

`specs/` contains agentic-readable specifications. These are the source of truth for contracts and formats — consult them before changing any interface.

| File | What it covers |
|------|----------------|
| `specs/architecture.md` | System architecture, data flow, module responsibilities |
| `specs/snapshot-format.md` | The JSON tree snapshot schema (all fields, types, invariants) |
| `specs/extension-api.md` | Extension API v1 full contract |
| `specs/http-api.md` | All HTTP endpoints, request/response shapes |

**When to update specs:** Whenever the contract described in a spec file changes. A spec going out of sync with the code is a bug. If you change `_api.py`, update `specs/extension-api.md`. If you add an HTTP route, update `specs/http-api.md`.

---

## Testing

There are no automated integration tests — iTerm2's runtime environment cannot run in CI. The CI pipeline runs:

1. `ruff check` + `ruff format --check` (lint/format)
2. `mypy` (type checking)
3. YAML validation for `iterm2_claude_cockpit/projects/*.yaml`

Manual testing: install via symlink (see CONTRIBUTING.md), run the daemon, exercise the feature in iTerm2.

When adding logic that doesn't depend on the iTerm2 runtime (e.g., parsing, data transformation, path manipulation), write it in a way that can be tested in isolation. Consider adding a `tests/` directory if unit-testable logic accumulates.

---

## Commits and PRs

- Branch names: `<type>/<short-description>` (e.g., `feat/extension-badges`, `fix/bury-crash`)
- Commit messages: imperative mood, present tense ("Add X", not "Added X")
- PR checklist (also in `.github/pull_request_template.md`):
  - `ruff check` passes
  - `ruff format --check` passes
  - `mypy` passes
  - CHANGELOG updated under `[Unreleased]`
  - README updated if user-facing behavior changed
  - Relevant spec file updated if a contract changed

---

## What NOT to do

- Do not add external runtime dependencies (anything beyond `iterm2` and stdlib)
- Do not rename `iterm2_claude_cockpit/` or the inner package — the iTerm2 loader will break
- Do not write top-level snapshot keys from an extension — use `ext.<name>.<field>`
- Do not commit `iterm2env/` or anything under `iterm2env-*/` (gitignored for a reason)
- Do not push directly to `main` — open a PR
- Do not let this file exceed 200 lines — keep it scannable; move detail into `specs/`
