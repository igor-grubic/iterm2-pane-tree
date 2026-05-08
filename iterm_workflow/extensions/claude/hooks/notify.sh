#!/bin/sh
# Claude Code hook — writes a TTY-keyed signal file for the iterm2-pane-tree daemon.
#
# Usage (via ~/.claude/settings.json):
#   notify.sh running    # UserPromptSubmit hook
#   notify.sh idle       # Stop hook
#   notify.sh attention  # Notification hook
#
# The script is intentionally silent on failure — it must never interrupt
# the user's Claude Code session.

set -u

state=${1:-running}
out_dir="/tmp/iterm-pane-tree/claude"

# Whitelist state to keep JSON construction safe and to reject typos in
# settings.json — unknown values are silently dropped.
case "$state" in
    running|idle|attention) ;;
    *) exit 0 ;;
esac

# Drain stdin: Claude Code pipes the hook payload here; discard it so the
# parent process doesn't get a broken-pipe error.
cat > /dev/null

# Discover controlling TTY. Stdin is consumed above, so we probe stderr.
tty_path=$(tty <&2 2>/dev/null)
if [ -z "$tty_path" ] || [ "$tty_path" = "not a tty" ]; then
    # Fallback: ask ps for the TTY of the parent (the Claude CLI process).
    raw=$(ps -p "$PPID" -o tty= 2>/dev/null | tr -d ' ')
    if [ -n "$raw" ] && [ "$raw" != "??" ]; then
        tty_path="/dev/$raw"
    fi
fi

# Validate the TTY path against the macOS/Linux conventions. Anything else
# (including empty) is rejected so we never write user-controlled bytes into
# the JSON payload unescaped.
case "$tty_path" in
    /dev/ttys[0-9]*|/dev/ttyp[0-9]*|/dev/pts/[0-9]*) ;;
    *) exit 0 ;;
esac

tty_base=$(basename "$tty_path")
mkdir -p "$out_dir"

ts=$(date +%s)
json="{\"tty\":\"$tty_path\",\"state\":\"$state\",\"ts\":$ts}"

# Atomic write: write to a temp file then rename to avoid partial reads.
tmp="$out_dir/$tty_base.json.tmp.$$"
printf '%s' "$json" > "$tmp" && mv -f "$tmp" "$out_dir/$tty_base.json"
