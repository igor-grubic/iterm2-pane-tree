(() => {
  const ext = window.PaneTreeExt;
  if (!ext) {
    console.warn("PaneTreeExt registry missing; claude extension disabled");
    return;
  }

  const isClaude = (p) => Boolean(p && p["ext.claude.active"]);
  const claudeMode = (p) => (p && p["ext.claude.mode"]) || "idle";
  const claudeActionNeeded = (p) => Boolean(p && p["ext.claude.action_needed"]);

  ext.paneRowDecorators.push((row, p) => {
    if (!isClaude(p)) return;
    row.classList.add("claude");
    if (claudeMode(p) === "plan") row.classList.add("claude-plan");
    if (claudeActionNeeded(p)) row.classList.add("claude-action");
  });

  ext.paneTitleDecorators.push((label, p) => {
    if (!isClaude(p) || !claudeActionNeeded(p)) return;
    const icon = document.createElement("span");
    icon.className = "claude-action-icon";
    icon.textContent = "❗";
    label.prepend(icon);
  });

  ext.shouldShowJob.push((p) => !isClaude(p));

  // ── Cheatsheet button + popup ─────────────────────────────────────
  const ASSET_BASE = "/static/ext/claude";
  let cheatsheetCache = null;
  let activePopup = null;

  function dismiss() {
    if (!activePopup) return;
    activePopup.remove();
    activePopup = null;
    document.removeEventListener("click", onOutsideClick, true);
    document.removeEventListener("keydown", onKey, true);
  }

  function onOutsideClick(ev) {
    if (activePopup && !activePopup.contains(ev.target)) dismiss();
  }

  function onKey(ev) {
    if (ev.key === "Escape") dismiss();
  }

  async function loadCheatsheet() {
    if (cheatsheetCache !== null) return cheatsheetCache;
    const res = await fetch(`${ASSET_BASE}/cheatsheet.html`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cheatsheetCache = await res.text();
    return cheatsheetCache;
  }

  async function openCheatsheet() {
    dismiss();
    const popup = document.createElement("div");
    popup.className = "claude-cheatsheet-popup";

    const header = document.createElement("div");
    header.className = "claude-cheatsheet-header";
    const title = document.createElement("span");
    title.className = "claude-cheatsheet-title";
    title.textContent = "Claude Code cheatsheet";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "claude-cheatsheet-close";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", (ev) => { ev.stopPropagation(); dismiss(); });
    header.append(title, close);

    const body = document.createElement("div");
    body.className = "claude-cheatsheet-body";
    body.textContent = "Loading…";

    popup.append(header, body);
    document.body.appendChild(popup);
    activePopup = popup;
    setTimeout(() => {
      document.addEventListener("click", onOutsideClick, true);
      document.addEventListener("keydown", onKey, true);
    }, 0);

    try {
      const html = await loadCheatsheet();
      body.innerHTML = html;
    } catch (err) {
      body.textContent = "Failed to load cheatsheet: " + err.message;
    }
  }

  function injectButton() {
    const footer = document.querySelector("footer");
    if (!footer) return false;
    if (footer.querySelector(".claude-cheatsheet-btn")) return true;

    const row = document.createElement("div");
    row.className = "row";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "claude-cheatsheet-btn";
    btn.textContent = "✦ Claude Cheatsheet";
    btn.addEventListener("click", (ev) => { ev.stopPropagation(); openCheatsheet(); });
    row.appendChild(btn);

    const status = footer.querySelector(".status");
    if (status) footer.insertBefore(row, status);
    else footer.appendChild(row);
    return true;
  }

  if (!injectButton()) {
    document.addEventListener("DOMContentLoaded", injectButton, { once: true });
  }
})();
