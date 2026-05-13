"""Action handlers invoked from the webview via HTTP POST."""

from __future__ import annotations

import asyncio

import iterm2


async def focus_node(app: iterm2.App, kind: str, node_id: str) -> dict:
    if kind == "session":
        session = app.get_session_by_id(node_id)
        if session is None:
            return {"ok": False, "error": f"no session {node_id}"}
        await session.async_activate(select_tab=True, order_window_front=True)
        return {"ok": True}

    if kind == "tab":
        tab = app.get_tab_by_id(node_id)
        if tab is None:
            return {"ok": False, "error": f"no tab {node_id}"}
        await tab.async_select(order_window_front=True)
        return {"ok": True}

    if kind == "window":
        window = app.get_window_by_id(node_id)
        if window is None:
            return {"ok": False, "error": f"no window {node_id}"}
        await window.async_activate()
        return {"ok": True}

    return {"ok": False, "error": f"unknown kind {kind!r}"}


async def new_tab(app: iterm2.App, window_id: str | None = None) -> dict:
    window = app.get_window_by_id(window_id) if window_id else app.current_terminal_window
    if window is None:
        return {"ok": False, "error": "no target window"}
    tab = await window.async_create_tab()
    return {"ok": True, "tab_id": str(tab.tab_id)}


async def new_window(connection: iterm2.Connection) -> dict:
    window = await iterm2.Window.async_create(connection)
    return {"ok": True, "window_id": window.window_id if window else None}


async def get_session_lines(app: iterm2.App, session_id: str, count: int = 10) -> dict:
    session = app.get_session_by_id(session_id)
    if session is None:
        return {"ok": False, "error": f"no session {session_id}"}
    try:
        contents = await session.async_get_screen_contents()
        lines = []
        for i in range(contents.number_of_lines - 1, -1, -1):
            line = contents.line(i).string.strip()
            if line:
                lines.append(line)
            if len(lines) >= count:
                break
        lines.reverse()
        return {"ok": True, "lines": lines}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


async def unbury_session(connection: iterm2.Connection, app: iterm2.App, session_id: str) -> dict:
    try:
        buried = app.buried_sessions or []
        session = next((s for s in buried if s.session_id == session_id), None)
        if session is None:
            return {"ok": False, "error": f"no buried session {session_id}"}
        if hasattr(session, "async_unbury"):
            await session.async_unbury()
        else:
            import iterm2.rpc

            await iterm2.rpc.async_set_property(connection, "buried", "false", session_id=session_id)
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


async def bury_session(connection: iterm2.Connection, app: iterm2.App, session_id: str) -> dict:
    session = app.get_session_by_id(session_id)
    if session is None:
        return {"ok": False, "error": f"no session {session_id}"}
    try:
        if hasattr(session, "async_bury"):
            await session.async_bury()
        else:
            import iterm2.rpc

            await iterm2.rpc.async_set_property(connection, "buried", "true", session_id=session_id)
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


async def split_pane(app: iterm2.App, session_id: str, vertical: bool) -> dict:
    session = app.get_session_by_id(session_id)
    if session is None:
        return {"ok": False, "error": f"no session {session_id}"}
    try:
        new_session = await session.async_split_pane(vertical=vertical)
        return {"ok": True, "session_id": new_session.session_id if new_session else None}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


async def close_session(app: iterm2.App, session_id: str) -> dict:
    session = app.get_session_by_id(session_id)
    if session is None:
        return {"ok": False, "error": f"no session {session_id}"}
    await session.async_close(force=True)
    return {"ok": True}


async def move_tab(app: iterm2.App, window_id: str, tab_id: str, position: int) -> dict:
    window = app.get_window_by_id(window_id)
    if window is None:
        return {"ok": False, "error": f"no window {window_id}"}
    tabs = list(window.tabs)
    tab = next((t for t in tabs if str(t.tab_id) == tab_id), None)
    if tab is None:
        return {"ok": False, "error": f"no tab {tab_id}"}
    tabs.remove(tab)
    tabs.insert(max(0, min(position, len(tabs))), tab)
    await asyncio.wait_for(window.async_set_tabs(tabs), timeout=3.0)
    return {"ok": True}
