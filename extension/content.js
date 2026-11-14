// BrandSentinel extension: runs in the page once the creator clicks "Check what I'm writing on this page".
// It watches the text box being typed in, asks the BrandSentinel server to check the text (through the
// background worker), and shows the result in a small panel. It reads nothing else on the page.
(() => {
  if (window.__brandsentinel) {
    window.__brandsentinel.show();
    return;
  }

  const SEVERITY = { high: "#c0392b", medium: "#b9770e", low: "#2f6fed" };
  const BAND = { green: ["#1f7a4d", "Ready for review"], amber: ["#b9770e", "Needs work"], red: ["#c0392b", "High risk"] };

  // ── which text box ──────────────────────────────────────────────────────────────────────────────
  const editable = (el) =>
    !!el && el.nodeType === 1 && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && /^(text|search|)$/i.test(el.type || "")) || el.isContentEditable);
  function focused() {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
    return editable(el) ? el : null;
  }
  function biggest() {
    let best = null;
    let area = 0;
    for (const el of document.querySelectorAll('textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]')) {
      if (!editable(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height > area && r.width > 40 && r.height > 16) {
        area = r.width * r.height;
        best = el;
      }
    }
    return best;
  }
  let field = focused() || biggest();
  const textOf = (el) => (!el ? "" : "value" in el && typeof el.value === "string" ? el.value : el.innerText || "").replace(/ /g, " ");

  /** Put new text into a plain text box the way typing would, so the website notices the change. */
  function replaceIn(el, from, to) {
    if (!el || typeof el.value !== "string") return false;
    const v = el.value;
    let i = v.indexOf(from);
    if (i < 0) i = v.toLowerCase().indexOf(from.toLowerCase());
    if (i < 0) return false;
    const next = v.slice(0, i) + to + v.slice(i + from.length);
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value");
    if (setter && setter.set) setter.set.call(el, next);
    else el.value = next;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  // ── the panel (in its own shadow tree, so the page's styles can't change it and it can't change the page) ──
  const host = document.createElement("div");
  host.id = "brandsentinel-panel";
  host.style.cssText = "all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483647;";
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .card { width: 340px; max-height: min(70vh, 560px); display: flex; flex-direction: column; font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #121a2e; background: #fff; border: 1px solid #d9dee8; border-radius: 14px; box-shadow: 0 12px 40px rgba(18,26,46,.22); overflow: hidden; }
    header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #e6e9f0; }
    header b { font-size: 13px; letter-spacing: -.01em; }
    header span { color: #57607a; font-size: 12px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    button { font: inherit; font-weight: 600; cursor: pointer; border-radius: 8px; border: 1px solid #d9dee8; background: #fff; color: #121a2e; padding: 5px 10px; }
    button:hover { border-color: #9aa3b8; }
    button:disabled { opacity: .6; cursor: wait; }
    button:focus-visible { outline: 2px solid #2f6fed; outline-offset: 2px; }
    .x { border: 0; padding: 2px 6px; font-size: 16px; line-height: 1; color: #57607a; }
    .score { display: flex; align-items: baseline; gap: 8px; padding: 10px 12px 6px; }
    .score .n { font-size: 30px; font-weight: 700; letter-spacing: -.02em; }
    .score .of { color: #8a92a6; font-size: 12px; }
    .score .band { margin-left: auto; font-weight: 700; font-size: 12px; padding: 2px 8px; border-radius: 999px; color: #fff; }
    .msg { padding: 0 12px 8px; color: #57607a; font-size: 12px; min-height: 18px; }
    .msg.error { color: #c0392b; }
    ul { list-style: none; margin: 0; padding: 0; overflow-y: auto; border-top: 1px solid #e6e9f0; }
    li { padding: 9px 12px; border-bottom: 1px solid #eef0f5; }
    li:last-child { border-bottom: 0; }
    .top { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #57607a; }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
    .rule { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; color: #121a2e; }
    .what { margin: 3px 0 0; }
    .fix { margin: 3px 0 0; color: #57607a; font-size: 12px; }
    .apply { margin-top: 5px; padding: 3px 9px; font-size: 12px; }
    .empty { padding: 16px 12px; color: #1f7a4d; font-weight: 600; text-align: center; }
    footer { display: flex; gap: 6px; padding: 9px 12px; border-top: 1px solid #e6e9f0; background: #f7f8fb; }
    footer button { flex: 1; padding: 6px 6px; font-size: 12px; }
    footer .primary { background: #121a2e; color: #fff; border-color: #121a2e; }
    a { color: #121a2e; font-weight: 600; }
  `;
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const card = el("div", "card");
  card.setAttribute("role", "region");
  card.setAttribute("aria-label", "BrandSentinel check");
  const head = el("header");
  const title = el("b", "", "BrandSentinel");
  const brandName = el("span", "", "");
  const close = el("button", "x", "×");
  close.setAttribute("aria-label", "Close BrandSentinel");
  head.append(title, brandName, close);
  const score = el("div", "score");
  const num = el("span", "n", "–");
  const of = el("span", "of", "/ 100");
  const band = el("span", "band", "");
  score.append(num, of, band);
  const msg = el("div", "msg", "");
  msg.setAttribute("role", "status");
  const list = el("ul");
  const foot = el("footer");
  const full = el("button", "", "Full check with AI");
  const save = el("button", "primary", "Save as draft");
  foot.append(full, save);
  card.append(head, score, msg, list, foot);
  root.append(style, card);
  document.documentElement.append(host);

  // ── checking ────────────────────────────────────────────────────────────────────────────────────
  let lastText = null;
  let seq = 0;
  let timer = null;
  let busy = false;

  const say = (text, error) => {
    msg.textContent = text;
    msg.className = error ? "msg error" : "msg";
  };
  const send = (payload) =>
    new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(payload, (r) => resolve(r || { ok: false, error: "The extension was reloaded. Refresh this page and start again." }));
      } catch {
        resolve({ ok: false, error: "The extension was reloaded. Refresh this page and start again." });
      }
    });

  function render(data) {
    brandName.textContent = data.brand ? data.brand.name : "";
    num.textContent = String(data.score);
    const b = BAND[data.band] || BAND.amber;
    band.textContent = b[1];
    band.style.background = b[0];
    list.textContent = "";
    if (!data.problems.length) list.append(el("li", "empty", "No problems found in this text."));
    for (const p of data.problems) {
      const li = el("li");
      const top = el("div", "top");
      const dot = el("span", "dot");
      dot.style.background = SEVERITY[p.severity] || SEVERITY.low;
      top.append(dot, el("span", "rule", p.rule_id), el("span", "", `${p.severity} · ${p.where}`));
      li.append(top, el("p", "what", p.message));
      if (p.fix) li.append(el("p", "fix", `Fix: ${p.fix}`));
      const pair = (p.replace || [])[0];
      if (pair && field && typeof field.value === "string") {
        const apply = el("button", "apply", pair.to ? "Apply fix" : "Remove it");
        apply.addEventListener("click", () => {
          if (replaceIn(field, pair.from, pair.to)) schedule(100);
          else say("That text has changed already. The check will refresh.", true);
        });
        li.append(apply);
      }
      list.append(li);
    }
  }

  async function run(opts) {
    const text = textOf(field).trim();
    if (!field) return say("Click the text box you are writing in.");
    if (!text) {
      lastText = "";
      num.textContent = "–";
      band.textContent = "";
      band.style.background = "transparent";
      list.textContent = "";
      return say("Start typing. The check runs as you write.");
    }
    if (!opts && text === lastText) return;
    const mine = ++seq;
    busy = !!opts;
    full.disabled = save.disabled = busy;
    say(opts && opts.save ? "Saving the draft…" : opts && opts.ai ? "Full check with AI (up to 20 seconds)…" : "Checking…");
    const res = await send({ type: "bs-check", text, ai: !!(opts && opts.ai), save: !!(opts && opts.save) });
    if (mine !== seq) return; // a newer check has started
    busy = false;
    full.disabled = save.disabled = false;
    if (!res.ok) return say(res.error, true);
    lastText = text;
    render(res.data);
    const n = res.data.problems.length;
    say(res.data.note || `${n} problem${n === 1 ? "" : "s"} · ${res.data.ai === "ok" ? "fast checks and AI" : "fast checks"}`);
    if (res.data.saved) {
      msg.textContent = "Saved as a draft. ";
      const link = el("a", "", "Open it in BrandSentinel");
      link.href = res.data.saved.url;
      link.target = "_blank";
      link.rel = "noopener";
      msg.append(link);
    }
  }
  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(() => !busy && run(), ms === undefined ? 800 : ms);
  }

  const onInput = (e) => {
    const t = e.composedPath ? e.composedPath()[0] : e.target;
    if (host.contains(t)) return;
    if (editable(t)) field = t;
    else if (field && !field.isConnected) field = focused();
    schedule();
  };
  const onFocus = (e) => {
    const t = e.composedPath ? e.composedPath()[0] : e.target;
    if (!editable(t) || host.contains(t) || t === field) return;
    field = t;
    lastText = null;
    schedule(200);
  };
  document.addEventListener("input", onInput, true);
  document.addEventListener("focusin", onFocus, true);
  full.addEventListener("click", () => run({ ai: true }));
  save.addEventListener("click", () => run({ ai: false, save: true }));
  close.addEventListener("click", () => {
    host.style.display = "none";
    clearTimeout(timer);
    document.removeEventListener("input", onInput, true);
    document.removeEventListener("focusin", onFocus, true);
    window.__brandsentinel = null;
    host.remove();
  });

  window.__brandsentinel = { show: () => (host.style.display = "") };
  run();
})();
