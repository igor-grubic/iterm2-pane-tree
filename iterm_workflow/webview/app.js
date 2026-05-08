window.PaneTreeExt = window.PaneTreeExt || {
  paneRowDecorators: [],
  paneTitleDecorators: [],
  shouldShowJob: [],
};

(() => {
  const treeEl = document.getElementById("tree");
  const statusEl = document.getElementById("status");
  const collapsed = new Set();
  const ext = window.PaneTreeExt;

  const IDLE_JOBS = new Set(["zsh", "-zsh", "bash", "-bash", "sh", "-sh", "fish", "-fish"]);
  function isIdle(job) { return !job || IDLE_JOBS.has(job); }

  let _measurePill = null;
  function pillWidth(text) {
    if (!_measurePill) {
      _measurePill = document.createElement("span");
      _measurePill.className = "pane-folder-pill";
      _measurePill.style.position = "absolute";
      _measurePill.style.visibility = "hidden";
      _measurePill.style.whiteSpace = "nowrap";
      _measurePill.style.left = "-9999px";
      _measurePill.style.top = "0";
      document.body.appendChild(_measurePill);
    }
    _measurePill.textContent = text;
    return _measurePill.offsetWidth;
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) { /* fall through to execCommand */ }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (_) {
      return false;
    }
  }

  let toastTimer = null;
  function toast(text, ok = true) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.background = ok ? "#2c4a2c" : "#5a2929";
    el.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1500);
  }

  function setStatus(text, cls) {
    if (cls === "ok") {
      statusEl.classList.add("hidden");
    } else {
      statusEl.textContent = text;
      statusEl.className = "status " + (cls || "");
    }
  }

  function nodeKey(node) {
    return `${node.kind}:${node.id}`;
  }

  function renderTree(snapshot) {
    treeEl.innerHTML = "";
    if (!snapshot.windows || snapshot.windows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "node";
      empty.style.color = "var(--muted)";
      empty.textContent = "(no windows open)";
      treeEl.appendChild(empty);
    } else {
      for (const w of snapshot.windows) {
        treeEl.appendChild(renderWindow(w));
      }
    }
  }

  function renderWindow(w) {
    const wrap = document.createElement("div");
    const wKey = nodeKey(w);
    const wIsCollapsed = collapsed.has(wKey);
    const row = nodeRow(w, "window", wIsCollapsed);
    row.querySelector(".caret").addEventListener("click", (ev) => {
      ev.stopPropagation();
      toggle(wKey);
    });
    wrap.appendChild(row);
    if (!wIsCollapsed) {
      for (const t of w.tabs || []) {
        wrap.appendChild(renderTab(t));
      }
    }
    return wrap;
  }

  function startTabEdit(row, t) {
    const labelEl = row.querySelector(".node-label");
    const editBtn = row.querySelector(".tab-edit-btn");
    if (!labelEl) return;
    const input = document.createElement("input");
    input.className = "tab-edit-input";
    input.value = t.title;
    labelEl.replaceWith(input);
    if (editBtn) editBtn.style.display = "none";
    input.focus();
    input.select();

    let committed = false;
    function commit() {
      if (committed) return;
      committed = true;
      postAction("/api/rename-tab", { id: t.id, name: input.value.trim() });
      input.replaceWith(labelEl);
      if (editBtn) editBtn.style.display = "";
    }
    function cancel() {
      if (committed) return;
      committed = true;
      input.replaceWith(labelEl);
      if (editBtn) editBtn.style.display = "";
    }

    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.stopPropagation(); commit(); }
      if (ev.key === "Escape") { ev.stopPropagation(); cancel(); }
    });
    input.addEventListener("blur", commit);
    input.addEventListener("click", (ev) => ev.stopPropagation());
  }

  function renderTab(t) {
    const wrap = document.createElement("div");
    const tKey = nodeKey(t);
    const tIsCollapsed = collapsed.has(tKey);
    const row = nodeRow(t, "tab", tIsCollapsed, true);
    const caret = row.querySelector(".caret");
    if (caret) {
      caret.addEventListener("click", (ev) => {
        ev.stopPropagation();
        toggle(tKey);
      });
    }
    const editBtn = document.createElement("span");
    editBtn.className = "tab-edit-btn";
    editBtn.textContent = "✎";
    editBtn.title = "Rename tab";
    editBtn.addEventListener("click", (ev) => { ev.stopPropagation(); startTabEdit(row, t); });
    row.appendChild(editBtn);
    wrap.appendChild(row);
    if (!tIsCollapsed && (t.panes || []).length > 0) {
      for (const p of t.panes) {
        wrap.appendChild(renderPane(p, t.id));
      }
    }
    return wrap;
  }

  function renderPane(p, tabId) {
    const row = document.createElement("div");
    row.className = "node pane" + (p.active ? " active" : "") + (p.buried ? " buried" : "");
    if (p.last_line) row.title = p.last_line;

    // Left action buttons — fixed at window-level left edge, always visible
    const leftActions = document.createElement("span");
    leftActions.className = "pane-left-actions";

    const idle = isIdle(p.job);
    const statusBtn = makeActionBtn("ℹ", (ev) => { ev.stopPropagation(); showStatusPopup(p, statusBtn); });
    statusBtn.setAttribute("title", idle ? "Status — idle" : `Status — ${p.job}`);
    statusBtn.classList.add(idle ? "action-idle" : "action-running");

    if (p.buried) {
      const unburyBtn = makeActionBtn("↑", (ev) => { ev.stopPropagation(); postAction("/api/unbury-session", { id: p.id }); });
      unburyBtn.setAttribute("title", "Restore pane");
      leftActions.append(statusBtn, unburyBtn);
    } else {
      const buryBtn = makeActionBtn("⊟", (ev) => { ev.stopPropagation(); postAction("/api/bury-session", { id: p.id, tab_id: tabId }); });
      buryBtn.setAttribute("title", "Bury — removes pane from tab, keeps running");
      leftActions.append(statusBtn, buryBtn);
    }
    row.appendChild(leftActions);


    const label = document.createElement("span");
    label.className = "pane-title";
    label.textContent = p.session_name || p.title || p.id;
    row.appendChild(label);
    for (const fn of ext.paneTitleDecorators) {
      try { fn(label, p); } catch (e) { console.error("paneTitleDecorator error", e); }
    }

    const showJob = p.job && ext.shouldShowJob.every((fn) => {
      try { return fn(p); } catch (e) { console.error("shouldShowJob error", e); return true; }
    });
    if (showJob) {
      const job = document.createElement("span");
      job.className = "node-job";
      job.textContent = p.job;
      row.appendChild(job);
    }

    if (p.title) {
      const pill = document.createElement("span");
      pill.className = "pane-folder-pill";
      pill.textContent = p.title;
      if (p.cwd) {
        pill.title = p.cwd;
        if (p.active) {
          pill.classList.add("pill-copyable");
          const w = Math.max(pillWidth(p.title), pillWidth("copy"));
          pill.style.minWidth = w + "px";
          pill.addEventListener("mouseenter", () => { pill.textContent = "copy"; });
          pill.addEventListener("mouseleave", () => { pill.textContent = p.title; });
        }
        pill.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (p.active) {
            copyToClipboard(p.cwd);
          } else {
            focusNode(p.kind, p.id);
          }
        });
      }
      row.appendChild(pill);
    }

    if (p.buried) {
      const badge = document.createElement("span");
      badge.className = "node-job buried-badge";
      badge.textContent = "buried";
      row.appendChild(badge);
    } else {
      const closeBtn = makeActionBtn("×", (ev) => {
        ev.stopPropagation();
        showConfirmPopup(closeBtn, () => postAction("/api/close-session", { id: p.id }));
      });
      closeBtn.setAttribute("title", "Close session");
      closeBtn.classList.add("pane-close-btn");
      row.appendChild(closeBtn);
    }

    row.addEventListener("click", () => focusNode(p.kind, p.id));
    for (const fn of ext.paneRowDecorators) {
      try { fn(row, p); } catch (e) { console.error("paneRowDecorator error", e); }
    }
    return row;
  }

  function nodeRow(node, kindCls, isCollapsed, hasChildren = true) {
    const row = document.createElement("div");
    row.className = "node " + kindCls + (node.active ? " active" : "");
    if (hasChildren) {
      const caret = document.createElement("span");
      caret.className = "caret";
      caret.textContent = isCollapsed ? "▸" : "▾";
      row.appendChild(caret);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "caret";
      spacer.textContent = "•";
      row.appendChild(spacer);
    }
    const label = document.createElement("span");
    label.className = "node-label";
    label.textContent = node.title || node.id;
    row.appendChild(label);
    row.addEventListener("click", () => focusNode(node.kind, node.id));
    return row;
  }

  function makeActionBtn(text, handler) {
    const btn = document.createElement("span");
    btn.className = "pane-action-btn";
    btn.textContent = text;
    btn.addEventListener("click", handler);
    return btn;
  }

  async function postAction(path, body) {
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) toast(data.error || path + " failed", false);
    } catch (e) {
      toast(path + " error: " + e, false);
    }
  }

  async function showStatusPopup(node, anchor) {
    dismissPopup();
    const popup = document.createElement("div");
    popup.className = "lines-popup status-popup";
    popup.addEventListener("click", (ev) => ev.stopPropagation());

    for (const [label, value] of [
      ["job", node.job  || "(none)"],
      ["cwd", node.cwd  || "(unknown)"],
    ]) {
      const row = document.createElement("div");
      row.className = "status-row";
      const lbl = document.createElement("span");
      lbl.className = "status-label";
      lbl.textContent = label;
      const val = document.createElement("span");
      val.className = "status-value";
      val.textContent = value;
      row.append(lbl, val);
      popup.appendChild(row);
    }

    const divider = document.createElement("div");
    divider.className = "status-divider";
    popup.appendChild(divider);

    const rect = anchor.getBoundingClientRect();
    popup.style.top = (rect.bottom + 4) + "px";
    popup.style.left = "8px";
    popup.style.right = "8px";
    document.body.appendChild(popup);
    activePopup = popup;

    try {
      const res = await fetch(`/api/session-lines?id=${encodeURIComponent(node.id)}`);
      const data = await res.json();
      if (data.ok && data.lines && data.lines.length > 0) {
        for (const line of data.lines) {
          const el = document.createElement("div");
          el.className = "lines-line";
          el.textContent = line;
          popup.appendChild(el);
        }
      } else {
        const empty = document.createElement("div");
        empty.className = "lines-empty";
        empty.textContent = "(no output)";
        popup.appendChild(empty);
      }
    } catch (e) {
      const err = document.createElement("div");
      err.className = "lines-empty";
      err.textContent = "error fetching lines";
      popup.appendChild(err);
    }
  }

  let activePopup = null;
  function dismissPopup() {
    if (activePopup) { activePopup.remove(); activePopup = null; }
  }

  function showConfirmPopup(anchor, onConfirm) {
    dismissPopup();
    const popup = document.createElement("div");
    popup.className = "confirm-popup";
    popup.addEventListener("click", (ev) => ev.stopPropagation());

    const label = document.createElement("span");
    label.className = "confirm-label";
    label.textContent = "sure?";

    const yes = document.createElement("button");
    yes.className = "confirm-yes";
    yes.textContent = "yes";
    yes.addEventListener("click", () => { dismissPopup(); onConfirm(); });

    const no = document.createElement("button");
    no.className = "confirm-no";
    no.textContent = "no";
    no.addEventListener("click", () => dismissPopup());

    popup.append(label, yes, no);

    const rect = anchor.getBoundingClientRect();
    popup.style.top = (rect.bottom + 4) + "px";
    popup.style.right = (window.innerWidth - rect.right) + "px";

    document.body.appendChild(popup);
    activePopup = popup;
    yes.focus();
  }
  document.addEventListener("click", dismissPopup);
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") dismissPopup(); });

  function toggle(key) {
    if (collapsed.has(key)) collapsed.delete(key);
    else collapsed.add(key);
    if (lastSnapshot) renderTree(lastSnapshot);
  }

  async function focusNode(kind, id) {
    try {
      const res = await fetch("/api/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id }),
      });
      const data = await res.json();
      if (!data.ok) toast(data.error || "focus failed", false);
    } catch (e) {
      toast("focus error: " + e, false);
    }
  }

  function activeSessionId() {
    for (const w of lastSnapshot?.windows || []) {
      for (const t of w.tabs || []) {
        for (const p of t.panes || []) {
          if (p.active) return p.id;
        }
      }
    }
    return null;
  }

  let itermCheatsheetCache = null;

  async function openItermCheatsheet() {
    if (activePopup) { dismissPopup(); return; }
    const popup = document.createElement("div");
    popup.className = "iterm-cheatsheet-popup";
    popup.addEventListener("click", (ev) => ev.stopPropagation());

    const header = document.createElement("div");
    header.className = "iterm-cheatsheet-header";
    const title = document.createElement("span");
    title.className = "iterm-cheatsheet-title";
    title.textContent = "iTerm2 cheatsheet";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "iterm-cheatsheet-close";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", (ev) => { ev.stopPropagation(); dismissPopup(); });
    header.append(title, close);

    const body = document.createElement("div");
    body.className = "iterm-cheatsheet-body";
    body.textContent = "Loading…";

    popup.append(header, body);
    document.body.appendChild(popup);
    activePopup = popup;

    try {
      if (itermCheatsheetCache === null) {
        const res = await fetch("/static/iterm_cheatsheet.html", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        itermCheatsheetCache = await res.text();
      }
      body.innerHTML = itermCheatsheetCache;
    } catch (err) {
      body.textContent = "Failed to load cheatsheet: " + err.message;
    }
  }

  document.getElementById("btn-cheatsheet").addEventListener("click", (ev) => {
    ev.stopPropagation();
    openItermCheatsheet();
  });

  document.getElementById("btn-split-vertical").addEventListener("click", async () => {
    const id = activeSessionId();
    if (!id) { toast("no active pane", false); return; }
    try {
      const res = await fetch("/api/split-pane", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, vertical: true }),
      });
      const data = await res.json();
      if (!data.ok) toast(data.error || "split failed", false);
    } catch (e) { toast("split error: " + e, false); }
  });

  document.getElementById("btn-split-horizontal").addEventListener("click", async () => {
    const id = activeSessionId();
    if (!id) { toast("no active pane", false); return; }
    try {
      const res = await fetch("/api/split-pane", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, vertical: false }),
      });
      const data = await res.json();
      if (!data.ok) toast(data.error || "split failed", false);
    } catch (e) { toast("split error: " + e, false); }
  });

  document.getElementById("btn-new-tab").addEventListener("click", async () => {
    try {
      const res = await fetch("/api/new-tab", { method: "POST" });
      const data = await res.json();
      if (!data.ok) toast(data.error || "new tab failed", false);
    } catch (e) { toast("new tab error: " + e, false); }
  });

  document.getElementById("btn-new-window").addEventListener("click", async () => {
    try {
      const res = await fetch("/api/new-window", { method: "POST" });
      const data = await res.json();
      if (!data.ok) toast(data.error || "new window failed", false);
    } catch (e) { toast("new window error: " + e, false); }
  });

  let lastSnapshot = null;
  let lastSnapshotJson = "";
  let consecutiveFailures = 0;

  async function pollOnce() {
    try {
      const res = await fetch("/api/tree", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      consecutiveFailures = 0;
      setStatus("live", "ok");
      const json = JSON.stringify(data);
      if (json !== lastSnapshotJson) {
        lastSnapshotJson = json;
        lastSnapshot = data;
        if (!document.querySelector(".tab-edit-input")) {
          renderTree(lastSnapshot);
        }
      }
    } catch (e) {
      consecutiveFailures++;
      if (consecutiveFailures >= 2) {
        setStatus("disconnected — retrying", "error");
      }
    }
  }

  setStatus("connecting…");
  pollOnce();
  setInterval(pollOnce, 500);
})();
