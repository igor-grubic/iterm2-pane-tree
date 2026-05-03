# Extension API v1

This document is the authoritative contract for the extension system. The v1 API is stable — breaking changes require a major version bump and migration path.

## Loading

An extension is a subpackage of `iterm_workflow.extensions` with an `__init__.py` that exposes:

```python
def register(api: ExtensionAPI) -> None: ...
```

The loader calls `register(api)` at daemon startup. If `register` raises, the extension is skipped and the error is logged — it must not crash the daemon.

Extensions are opt-in. They are listed in `iterm_workflow/extensions.json`:

```json
{
  "extensions": {
    "claude": { "enabled": true, "description": "Detects Claude-driven panes" }
  }
}
```

Enable/disable via CLI (requires daemon restart):

```bash
python -m iterm_workflow ext enable <name>
python -m iterm_workflow ext disable <name>
python -m iterm_workflow ext list
```

## ExtensionAPI

`ExtensionAPI` is instantiated per extension and bound to its name. All registered hooks, routes, and assets are scoped to that name automatically.

### Properties

```python
api.name: str        # the extension name (e.g. "claude")
api.dir: Path        # absolute path to the extension's package directory
```

### `api.add_session_enricher(fn)`

Register a function called for every session node during tree build.

```python
def fn(
    session: iterm2.Session,
    node: dict,
    ps_output: str,
    screen_lines: list[str],
) -> dict | None: ...
```

- `session` — the iTerm2 Session object (read-only recommended; writes are not tested)
- `node` — the partially-built session dict; may be mutated in place
- `ps_output` — raw output of `ps -A -o pid=,ppid=,comm=` (shared across all enrichers for this snapshot)
- `screen_lines` — up to 20 recent non-empty visible terminal lines, oldest-first
- Return a `dict` to merge into `node`, or `None`/mutate in place

The function may be `async`. Errors are caught and logged; a failing enricher does not abort the snapshot.

**Namespace rule:** Only write keys in the `ext.<name>.<field>` namespace. Never write top-level keys — collisions with future core fields or other extensions are silent and hard to debug.

### `api.add_static_dir(path)`

Serve a directory of static files at `/static/ext/<name>/...`.

```python
api.add_static_dir(api.dir / "static")
```

`path` must exist at registration time; raises `ValueError` otherwise.

### `api.add_webview_asset(kind, relpath)`

Inject a `<link>` or `<script>` tag into the panel HTML.

```python
api.add_webview_asset("css", "static/claude.css")
api.add_webview_asset("js", "static/claude.js")
```

- `kind`: `"css"` or `"js"` (raises `ValueError` otherwise)
- `relpath`: path relative to `/static/ext/<name>/`
- CSS is injected in `<head>`, JS before `</body>` and after `app.js`

### `api.add_route(method, path, handler)`

Register an HTTP route at `/api/ext/<name>/<path>`.

```python
async def my_handler(request_body: bytes) -> dict: ...
api.add_route("POST", "action", my_handler)
# → handles POST /api/ext/<name>/action
```

- `method`: `"GET"` or `"POST"` (raises `ValueError` otherwise)
- `path`: relative path (leading `/` is stripped)
- `handler`: sync or async callable; receives the raw request body as `bytes`; should return a JSON-serializable dict

### `api.add_action(name, handler)`

Convenience wrapper for `add_route("POST", name, handler)`.

## Webview extension points

The panel JS exposes `window.PaneTreeExt` — a registry for decorating the rendered tree. Extension JS runs after `app.js`, so the registry always exists.

```typescript
window.PaneTreeExt = {
  paneRowDecorators:  Array<(row: HTMLElement, node: SessionNode) => void>,
  paneTitleDecorators: Array<(label: HTMLElement, node: SessionNode) => void>,
  shouldShowJob: Array<(node: SessionNode) => boolean>,
}
```

| Hook | Called when | Use case |
|------|-------------|----------|
| `paneRowDecorators` | A pane row is rendered or updated | Add classes, badges, icons |
| `paneTitleDecorators` | The title label is rendered | Modify or replace the title text |
| `shouldShowJob` | Deciding whether to render the job badge | Return `false` to hide it |

`shouldShowJob` is evaluated as OR-suppression: if any registered function returns `false` for a node, the job badge is hidden.

## Example extension skeleton

```python
# iterm_workflow/extensions/myext/__init__.py
from __future__ import annotations
from pathlib import Path


def register(api) -> None:
    api.add_session_enricher(_enrich)
    api.add_static_dir(api.dir / "static")
    api.add_webview_asset("js", "static/myext.js")
    api.add_action("ping", _ping)


def _enrich(session, node, ps_output, screen_lines):
    node[f"ext.myext.active"] = "myprocess" in ps_output


async def _ping(body: bytes) -> dict:
    return {"pong": True}
```

```javascript
// iterm_workflow/extensions/myext/static/myext.js
window.PaneTreeExt.paneRowDecorators.push((row, node) => {
  if (node["ext.myext.active"]) row.classList.add("myext-active");
});
```

## Versioning

The current API version is **v1**. `ExtensionAPI.version` is `1`.

Any additive change (new method, new webview hook) is a minor change and does not break v1 extensions. Removing or changing the signature of an existing method is a breaking change and requires incrementing the version.
