// BrandSentinel extension: the popup. Turns checking on for the current page, and holds the connection settings.
const $ = (id) => document.getElementById(id);
const FIELDS = ["apiBase", "token", "brand", "channel", "author"];
const ask = (msg) => new Promise((resolve) => chrome.runtime.sendMessage(msg, (r) => resolve(r || { ok: false, error: "The extension didn't answer. Reload it and try again." })));

function note(el, text, kind) {
  el.textContent = text;
  el.className = kind || "";
}

async function loadBrands(selected) {
  const res = await ask({ type: "bs-brands" });
  const menu = $("brand");
  menu.textContent = "";
  if (!res.ok) {
    menu.append(new Option("(connect first)", ""));
    return res;
  }
  for (const b of res.data.brands) menu.append(new Option(b.name, b.slug));
  if (selected && res.data.brands.some((b) => b.slug === selected)) menu.value = selected;
  return res;
}

async function init() {
  const s = await ask({ type: "bs-settings" });
  for (const f of FIELDS) if (f !== "brand") $(f).value = s[f] || "";
  const res = await loadBrands(s.brand);
  if (res.ok) note($("status"), `Connected to ${res.data.workspace}.`, "ok");
  else {
    note($("status"), res.error, "error");
    $("setup").open = true;
  }
}

$("save").addEventListener("click", async () => {
  $("save").disabled = true;
  note($("saved"), "Testing…");
  const values = Object.fromEntries(FIELDS.map((f) => [f, $(f).value.trim()]));
  await chrome.storage.local.set(values);
  const res = await loadBrands(values.brand);
  if (res.ok) {
    await chrome.storage.local.set({ brand: $("brand").value });
    note($("saved"), `Connected to ${res.data.workspace}.`, "ok");
    note($("status"), `Connected to ${res.data.workspace}.`, "ok");
  } else note($("saved"), res.error, "error");
  $("save").disabled = false;
});

for (const f of ["brand", "channel"]) $(f).addEventListener("change", () => chrome.storage.local.set({ [f]: $(f).value }));

$("start").addEventListener("click", async () => {
  $("start").disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("No page is open.");
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    window.close();
  } catch (e) {
    note($("status"), "This page can't be checked (browser pages and the extension store are off limits). Open the site you write on and try again.", "error");
    $("start").disabled = false;
  }
});

init();
