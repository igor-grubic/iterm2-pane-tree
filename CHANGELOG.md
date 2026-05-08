# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- Settings button (⚙) in the footer icon row — opens a panel showing the plugin version and installed extensions (enabled and available-but-disabled).
- Extension system: opt-in modules under `iterm_workflow/extensions/<name>/` with a small `register(api)` surface for snapshot enrichment, webview asset injection (CSS/JS), and HTTP route registration. Enable/disable with `python -m iterm_workflow ext enable|disable <name>`.
- `claude` bundled extension: detects Claude-driven panes (job match + descendant process walk), tags them as `ext.claude.active`, and decorates them with an accent color and `✦` badge. Enabled by default; `ext disable claude` for a vanilla worktree panel.
- Click the folder pill on a pane to focus it; on the active pane, the pill reveals "copy" on hover and clicking copies its working directory to the clipboard.
- Editable tab names: hover a tab to reveal a ✎ rename button; type a new name and press Enter to save. Custom names persist until the tab or window is closed. Names are also settable programmatically via `POST /api/rename-tab`.

### Changed
- Cheatsheet buttons (iTerm and Claude) are now compact icon buttons (glyph + label) on a single shared row, reducing footer height.
- Closing a pane now shows a small inline `sure?` confirmation next to the × button instead of closing immediately. Click `no` (or press `Escape` / click outside) to cancel.

## [0.1.0] - 2026-05-03

### Added
- Live hierarchical tree view of all iTerm2 windows, tabs, and panes
- Click to focus any window, tab, or pane
- Per-pane status popup showing current job, working directory, and recent output
- Create new tabs and windows from the panel
- Bury and unbury sessions (hide a pane without closing it)
- Runs as an AutoLaunch daemon; persists across iTerm2 restarts
