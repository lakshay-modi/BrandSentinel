// End-to-end test of the Google Docs add-on: the real Code.gs and Sidebar.html, with stand-ins for Google's
// services (the document, settings and UrlFetchApp). BrandSentinel's answers are the ones recorded from the live API.
// Run: node tests/integrations/docs-addon.e2e.cjs   (needs Playwright with Chromium)
const vm = require("vm"); const fs = require("fs"); const path = require("path"); const assert = require("assert"); const { chromium } = require("playwright");
const D = path.join(__dirname, "../../public/downloads/google-docs-addon");
const { rec } = require("./stand-in-api.cjs");
const T1 = "Our new ProBar is the BEST protein bar in India!!! Hurry, last chance. #oatviaeveryday";

// ── a tiny Google Doc: one paragraph per line ──
const doc = { name: "Launch post draft", paras: ["Launch post", T1], selection: null };
const textEl = (i) => ({
  getText: () => doc.paras[i],
  deleteText: (a, b) => { doc.paras[i] = doc.paras[i].slice(0, a) + doc.paras[i].slice(b + 1); },
  insertText: (a, t) => { doc.paras[i] = doc.paras[i].slice(0, a) + t + doc.paras[i].slice(a); },
});
const props = {}; const calls = [];
const sandbox = {
  console,
  DocumentApp: {
    getUi: () => ({ createMenu: () => ({ addItem() { return this; }, addToUi() {} }), showSidebar() {} }),
    getActiveDocument: () => ({
      getName: () => doc.name,
      getSelection: () => doc.selection && { getRangeElements: () => [{ getElement: () => ({ editAsText: () => textEl(doc.selection.p) }), isPartial: () => true, getStartOffset: () => doc.selection.a, getEndOffsetInclusive: () => doc.selection.b }] },
      getBody: () => ({
        getText: () => doc.paras.join("\n"),
        findText: (pattern) => { const re = new RegExp(pattern); for (let i = 0; i < doc.paras.length; i++) { const m = re.exec(doc.paras[i]); if (m) return { getElement: () => ({ asText: () => textEl(i) }), getStartOffset: () => m.index, getEndOffsetInclusive: () => m.index + m[0].length - 1 }; } return null; },
      }),
    }),
  },
  HtmlService: { createHtmlOutputFromFile: () => ({ setTitle() { return this; } }) },
  PropertiesService: { getUserProperties: () => ({ getProperties: () => ({ ...props }), setProperties: (o) => Object.assign(props, o) }) },
  UrlFetchApp: {
    fetch: (url, o) => {
      calls.push(`${o.method.toUpperCase()} ${url.replace(/^https:\/\/[^/]+/, "")} ${o.headers.Authorization.slice(7, 20)} ${o.payload ? o.payload.slice(0, 90) : ""}`);
      const res = (code, body) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(body) });
      if (!/^https:\/\/brand-sentinel-delta\.vercel\.app\//.test(url)) throw new Error("DNS error");
      if (o.headers.Authorization !== "Bearer bs_demo_public_token") return res(rec.bad.status, rec.bad.body);
      if (url.endsWith("/api/v1/brands")) return res(200, rec.brands);
      const text = JSON.parse(o.payload).text;
      if (text === T1) return res(200, rec.t1);
      const problems = rec.t1.problems.filter((p) => (p.replace[0]?.from ? text.includes(p.replace[0].from) : p.quotes.every((q) => text.includes(q))));
      return res(200, { ...rec.t1, problems, score: rec.t1.score + (rec.t1.problems.length - problems.length) * 5 });
    },
  },
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(D + "/Code.gs.txt", "utf8"), sandbox, { filename: "Code.gs" });
const run = (name, args = []) => vm.runInContext(`${name}.apply(null, ${JSON.stringify(args)})`, sandbox);

(async () => {
  const out = {};
  // server side on its own
  out.onOpen = (() => { try { run("onOpen"); return "ok"; } catch (e) { return e.message; } })();
  out.whole = (() => { const r = run("checkDocument"); return [r.ok, r.data.score, r.data.problems.length, r.doc.selected, r.doc.title]; })();
  doc.selection = { p: 1, a: 51, b: 56 }; // "Hurry,"
  out.selection = (() => { const r = run("checkDocument"); return [r.doc.selected, r.doc.text]; })();
  doc.selection = null;
  out.badSettings = (() => { try { run("saveSettings", [{ apiBase: "http://evil.example" }]); return "accepted"; } catch (e) { return e.message; } })();
  run("saveSettings", [{ token: "bs_wrong" }]); out.wrongToken = run("listBrands"); run("saveSettings", [{ token: "" }]);
  const saved = doc.paras.slice(); doc.paras = ["", "  "]; out.empty = run("checkDocument").empty; doc.paras = saved;

  // the sidebar, in a browser, with google.script.run calling the code above
  const html = fs.readFileSync(D + "/Sidebar.html.txt", "utf8");
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 300, height: 760 } });
  const pageErrors = []; page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.exposeFunction("__gas", (name, args) => { try { return { ok: true, value: run(name, args) }; } catch (e) { return { ok: false, error: e.message }; } });
  await page.addInitScript(() => {
    const make = (ok, fail) => new Proxy({}, { get: (_, k) => k === "withSuccessHandler" ? (f) => make(f, fail) : k === "withFailureHandler" ? (f) => make(ok, f) : (...a) => window.__gas(k, a).then((r) => (r.ok ? ok && ok(r.value) : fail && fail(new Error(r.error)))) });
    window.google = { script: { run: make(null, null) } };
  });
  await page.route("http://addon.test/**", (r) => r.fulfill({ contentType: "text/html", body: html }));
  await page.goto("http://addon.test/sidebar");
  await page.waitForTimeout(2500);
  const shown = () => page.evaluate(() => document.body.innerText.replace(/\n+/g, " | ").slice(0, 600));
  out.sidebarFirst = await shown();
  const n = calls.length;
  out.clickedApply = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /apply/i.test(x.textContent)); if (!b) return null; b.click(); return b.closest("li,div")?.innerText?.slice(0, 60); });
  await page.waitForTimeout(1500);
  out.docAfterFix = doc.paras[1];
  doc.paras[1] += " It cures tiredness."; // the writer keeps typing in the document
  await page.waitForTimeout(5500);
  out.recheckedWhileWriting = calls.slice(n).filter((c) => c.includes("/check")).length;
  out.sidebarAfter = await shown();
  out.calls = calls.length;
  await browser.close();
  assert.deepStrictEqual(pageErrors, []);
  assert.strictEqual(out.onOpen, "ok");
  assert.deepStrictEqual(out.whole, [true, 62, 6, false, "Launch post draft"]);
  assert.deepStrictEqual(out.selection, [true, "Hurry,"]);
  assert.strictEqual(out.badSettings, "The server address must start with https://");
  assert.match(out.wrongToken.error, /wrong token/i);
  assert.strictEqual(out.empty, true);
  assert.match(out.sidebarFirst, /62 \| \/ 100/);
  assert.ok(out.docAfterFix.includes("Pick yours up today") && !out.docAfterFix.includes("Hurry"));
  assert.ok(out.recheckedWhileWriting >= 1, "re-checks while writing");
  console.log("docs add-on: all checks passed");
})().catch((e) => { console.error("docs add-on test FAILED:", e.message); process.exit(1); });
