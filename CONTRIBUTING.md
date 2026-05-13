# Contributing

Bug reports and pull requests are welcome.

## Reporting bugs

Open an issue and include:
- iTerm2 version (`Help → About iTerm2`)
- macOS version
- The full error from `Scripts → Manage → Console`
- Steps to reproduce

## Suggesting features

Open an issue with the label `enhancement`. Describe the use case, not just the feature.

## Development setup

```bash
git clone https://github.com/igorgrubic/iterm2-claude-cockpit.git ~/code/iterm_workflow
ln -s "$HOME/code/iterm_workflow" \
  "$HOME/Library/Application Support/iTerm2/Scripts/AutoLaunch/iterm_workflow"
```

> The destination path `~/code/iterm_workflow` is required — the real directory name must be `iterm_workflow` to match the inner package and entry script. Cloning to a differently-named directory will cause autolaunch to silently fail.

Then run the script once to initialize the environment:

`Scripts → AutoLaunch → iterm_workflow → iterm_workflow.py`

This creates `~/code/iterm_workflow/iterm2env/` (gitignored). AutoLaunch will work on every subsequent iTerm2 start.

Install dev tools (these run on your local Python, not inside iTerm2's env):

```bash
pip install ruff mypy
```

Lint and format:

```bash
ruff check iterm_workflow/
ruff format iterm_workflow/
```

Type check:

```bash
mypy iterm_workflow/
```

## Code style

- `ruff` enforces formatting and lint (see `pyproject.toml`)
- No external runtime dependencies — stdlib + `iterm2` only
- The `iterm2` library has no type stubs; `ignore_missing_imports = true` is set in mypy config

## iTerm2 structural constraint

The two-level folder layout (`iterm_workflow/iterm_workflow/iterm_workflow.py`) and `setup.cfg` are required by iTerm2's Full Environment loader and cannot be changed.

## Writing an extension

User-facing behavior that isn't strictly part of "manage iTerm2 windows/tabs/panes" should live in an extension under `iterm_workflow/extensions/<name>/`, not in core. Each extension is a folder with `__init__.py` exposing `register(api)`. See the `claude` extension for a worked example and the README's [Extensions](README.md#extensions) section for the v1 API surface.

Use the `ext.<name>.<field>` namespace when adding fields to session nodes. Don't write top-level snapshot keys from an extension — collisions become a future problem.

## Submitting a pull request

1. Fork the repo and create a branch
2. Make changes and run `ruff check` + `mypy`
3. Open a PR describing what changed and why
