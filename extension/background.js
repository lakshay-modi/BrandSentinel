// BrandSentinel extension: the background worker. It is the only part that talks to the BrandSentinel server.
// The page's text is sent only when the creator has turned checking on for that page.

const DEFAULTS = {
  apiBase: "https://brand-sentinel-delta.vercel.app",
  // the open demo's public token: replace it with your workspace's token in the popup
  token: "bs_demo_public_token",
  brand: "",
  channel: "instagram",
  author: "",
};

async function settings() {
  const saved = await chrome.storage.local.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...Object.fromEntries(Object.entries(saved).filter(([, v]) => v !== undefined && v !== "")) };
}

/** One request to the BrandSentinel API. Always answers with { ok, data } or { ok: false, error }. */
async function call(path, options) {
  const s = await settings();
  const base = String(s.apiBase).replace(/\/+$/, "");
  if (!/^https:\/\/|^http:\/\/localhost(:\d+)?$/.test(base)) return { ok: false, error: "The server address must start with https://" };
  try {
    const res = await fetch(base + path, {
      ...options,
      headers: { authorization: `Bearer ${s.token}`, ...(options && options.body ? { "content-type": "application/json" } : {}) },
      signal: AbortSignal.timeout(options && options.slow ? 60000 : 15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `The server answered ${res.status}.`, status: res.status };
    return { ok: true, data, base };
  } catch (e) {
    return { ok: false, error: e && e.name === "TimeoutError" ? "The check took too long. Try again." : "Couldn't reach BrandSentinel. Check your connection and the server address." };
  }
}

async function check(text, opts) {
  const s = await settings();
  return call("/api/v1/check", {
    method: "POST",
    slow: !!(opts && opts.ai),
    body: JSON.stringify({ text: String(text).slice(0, 3000), brand: s.brand || undefined, channel: s.channel, ai: !!(opts && opts.ai), save: !!(opts && opts.save), author: s.author || "" }),
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (!msg || typeof msg.type !== "string") return false;
  if (msg.type === "bs-check") check(msg.text, msg).then(reply);
  else if (msg.type === "bs-brands") call("/api/v1/brands").then(reply);
  else if (msg.type === "bs-settings") settings().then(reply);
  else return false;
  return true; // the answer comes later
});

// for tests
self.__brandsentinel = { check, call, settings, DEFAULTS };
