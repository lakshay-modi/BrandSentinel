// End-to-end test of the browser extension in Chromium: the real extension files, against the stand-in API.
// Run: node tests/integrations/extension.e2e.cjs   (needs Playwright with Chromium)
// The test copy adds one permission (host access) so the script can start the checker on the test page;
// in normal use the person grants that by clicking the extension's button.
const assert = require("assert");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");
const api = require("./stand-in-api.cjs");

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bs-ext-"));
  const ext = path.join(tmp, "ext");
  fs.cpSync(path.join(__dirname, "../../extension"), ext, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(ext, "manifest.json"), "utf8"));
  manifest.host_permissions = ["<all_urls>"];
  fs.writeFileSync(path.join(ext, "manifest.json"), JSON.stringify(manifest));

  const stub = api.start(4556);
  const site = http.createServer((_q, r) => r.end('<!doctype html><meta charset="utf-8"><textarea id="t" style="width:600px;height:160px"></textarea>')).listen(4555);
  const ctx = await chromium.launchPersistentContext(path.join(tmp, "profile"), { channel: "chromium", headless: true, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
  try {
    const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
    const id = sw.url().split("/")[2];
    await sw.evaluate(() => chrome.storage.local.set({ apiBase: "http://localhost:4556" }));

    // the popup connects with the built-in demo token and lists the brands
    const popup = await ctx.newPage();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.waitForFunction(() => /Connected/.test(document.getElementById("status").textContent));
    assert.deepStrictEqual(await popup.$$eval("#brand option", (o) => o.map((x) => x.textContent)), ["Oatvia Foods", "Solvira Skincare", "Voltaro"]);

    // the creator types on a website, then starts the checker
    const page = await ctx.newPage();
    await page.goto("http://localhost:4555/");
    await page.click("#t");
    await page.keyboard.type(api.T1);
    const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: "http://localhost:4555/*" }))[0].id);
    await sw.evaluate((t) => chrome.scripting.executeScript({ target: { tabId: t }, files: ["content.js"] }), tabId);
    const panel = () => page.evaluate(() => { const r = document.getElementById("brandsentinel-panel")?.shadowRoot; return r ? [...r.children].filter((e) => e.tagName !== "STYLE").map((e) => e.innerText).join(" ") : ""; });
    await page.waitForFunction(() => /\/ 100/.test(document.getElementById("brandsentinel-panel")?.shadowRoot?.textContent || ""));
    const first = await panel();
    assert.match(first, /62\s*\/ 100/);
    assert.match(first, /6 problems/);

    // Apply fix changes the text box the way typing would
    await page.evaluate(() => [...document.getElementById("brandsentinel-panel").shadowRoot.querySelectorAll("button")].find((b) => /apply/i.test(b.textContent)).click());
    await page.waitForFunction(() => !document.getElementById("t").value.includes("Hurry"));
    assert.ok((await page.$eval("#t", (e) => e.value)).includes("Pick yours up today"));

    // it re-checks while the creator keeps writing
    const before = stub.log.filter((l) => l.url === "/api/v1/check").length;
    await page.click("#t");
    await page.keyboard.press("End");
    await page.keyboard.type(" It cures tiredness.");
    await page.waitForFunction(() => /WORD-02/.test(document.getElementById("brandsentinel-panel")?.shadowRoot?.textContent || ""), null, { timeout: 15000 });
    assert.ok(stub.log.filter((l) => l.url === "/api/v1/check").length > before);

    // a wrong token is reported in plain words
    await sw.evaluate(() => chrome.storage.local.set({ token: "bs_wrong_token" }));
    await popup.reload();
    await popup.waitForFunction(() => /wrong token/i.test(document.getElementById("status").textContent));
    console.log("extension: all checks passed");
  } finally {
    await ctx.close();
    stub.close();
    site.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error("extension test FAILED:", e.message);
  process.exit(1);
});
