# HTTP API

The daemon listens on `127.0.0.1:9876`. All endpoints are local-only.

## Core endpoints

### `GET /`

Returns the panel HTML (`webview/index.html` with extension assets injected).

**Response:** `200 text/html`

---

### `GET /api/tree`

Returns the current session tree snapshot.

**Response:** `200 application/json`

```json
{
  "windows": [ <window>, ... ]
}
```

See `specs/snapshot-format.md` for the full schema.

---

### `POST /api/focus`

Focus a window, tab, or pane.

**Request body:** `application/json`

```json
{ "id": "<session|tab|window id>", "kind": "session" | "tab" | "window" }
```

**Response:** `200 application/json`

```json
{ "ok": true }
```

On error:

```json
{ "error": "<message>" }
```

---

### `POST /api/close`

Close a session (pane).

**Request body:** `application/json`

```json
{ "id": "<session id>" }
```

**Response:** `200 application/json` — `{ "ok": true }` or `{ "error": "..." }`

---

### `POST /api/create`

Create a new tab or window.

**Request body:** `application/json`

```json
{ "kind": "tab" | "window" }
```

**Response:** `200 application/json` — `{ "ok": true }` or `{ "error": "..." }`

---

### `POST /api/bury`

Bury (hide without closing) or unbury a session.

**Request body:** `application/json`

```json
{ "id": "<session id>", "bury": true | false }
```

**Response:** `200 application/json` — `{ "ok": true }` or `{ "error": "..." }`

---

### `POST /api/project`

Open a named project layout from `iterm_workflow/projects/<name>.yaml`.

**Request body:** `application/json`

```json
{ "name": "<project name>" }
```

**Response:** `200 application/json` — `{ "ok": true }` or `{ "error": "..." }`

---

## Static assets

### `GET /static/<path>`

Serves files from `iterm_workflow/webview/`. Used by the panel for `app.js`, `styles.css`, etc.

### `GET /static/ext/<name>/<path>`

Serves files from a registered extension static directory. Only available if the extension called `api.add_static_dir(...)`.

---

## Extension routes

### `GET|POST /api/ext/<name>/<path>`

Handled by the extension that registered the route via `api.add_route(...)` or `api.add_action(...)`.

**Request body:** raw bytes passed to the handler.

**Response:** The handler's return value serialized as JSON, `200 application/json`.

---

## Error handling

All endpoints return `200` with `{ "error": "<message>" }` on handled errors. Unhandled exceptions produce a `500` with a plain-text body (logged to the iTerm2 console). The webview shows a toast notification on `{ "error": ... }` responses.

## Versioning

The API is unversioned in v1. There is no `/v1/` prefix. Breaking changes will be coordinated with the webview JS, which is bundled and not a public API.
