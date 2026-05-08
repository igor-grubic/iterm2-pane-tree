(() => {
  const ext = window.PaneTreeExt;
  if (!ext) {
    console.warn("PaneTreeExt registry missing; claude extension disabled");
    return;
  }

  const isClaude = (p) => Boolean(p && p["ext.claude.active"]);
  const claudeState = (p) => (p && p["ext.claude.state"]) || "idle";
  const claudeActionNeeded = (p) => Boolean(p && p["ext.claude.action_needed"]);

  ext.paneRowDecorators.push((row, p) => {
    if (!isClaude(p)) return;
    const state = claudeState(p);
    row.classList.add("claude");
    if (state === "running") row.classList.add("claude-running");
    if (state === "attention") row.classList.add("claude-attention");
    if (state === "plan") row.classList.add("claude-plan");
  });

  ext.paneTitleDecorators.push((label, p) => {
    if (!isClaude(p) || !claudeActionNeeded(p)) return;
    const icon = document.createElement("span");
    icon.className = "claude-attention-icon";
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
    const slot = document.getElementById("footer-icons");
    if (!slot) return false;
    if (slot.querySelector(".claude-cheatsheet-btn")) return true;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-btn claude-cheatsheet-btn";
    btn.title = "Claude Code cheatsheet";
    btn.innerHTML = '<span class="icon-btn-glyph">✦</span><span class="icon-btn-label">Claude</span>';
    btn.addEventListener("click", (ev) => { ev.stopPropagation(); openCheatsheet(); });

    const settingsBtn = slot.querySelector("#btn-settings");
    if (settingsBtn) slot.insertBefore(btn, settingsBtn);
    else slot.appendChild(btn);
    return true;
  }

  if (!injectButton()) {
    document.addEventListener("DOMContentLoaded", injectButton, { once: true });
  }
})();
