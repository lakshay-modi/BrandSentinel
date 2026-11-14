// A stand-in for the BrandSentinel public API that replays answers recorded from the live API (14 Nov 2026),
// so the extension and the Docs add-on can be tested on a machine that can't reach the live site.
const http = require("http");
const rec = require("./recorded-api.json");
const T1 = "Our new ProBar is the BEST protein bar in India!!! Hurry, last chance. #oatviaeveryday";

/** The live answer for a recorded text; for an edited text, the recorded problems whose words are still there. */
function answerFor(text) {
  if (text === T1) return rec.t1;
  if (text === T1 + " It cures tiredness.") return rec.t2;
  const base = text.includes("cures") ? rec.t2 : rec.t1;
  const problems = base.problems.filter((p) => (p.replace[0]?.from ? text.includes(p.replace[0].from) : p.quotes.every((q) => text.includes(q))));
  return { ...base, problems, score: Math.min(100, base.score + (base.problems.length - problems.length) * 5) };
}

function start(port) {
  const log = [];
  const server = http
    .createServer((q, r) => {
      let body = "";
      q.on("data", (c) => (body += c));
      q.on("end", () => {
        const send = (s, o) => {
          r.writeHead(s, { "content-type": "application/json" });
          r.end(JSON.stringify(o));
        };
        const auth = q.headers.authorization || "";
        log.push({ method: q.method, url: q.url, token: auth.slice(7), body: body ? JSON.parse(body) : null });
        if (auth !== "Bearer bs_demo_public_token") return send(rec.bad.status, rec.bad.body);
        if (q.url === "/api/v1/brands") return send(200, rec.brands);
        if (q.url === "/api/v1/check" && q.method === "POST") return send(200, answerFor(JSON.parse(body).text));
        send(404, { error: "Not found" });
      });
    })
    .listen(port);
  return { log, close: () => server.close() };
}

module.exports = { T1, answerFor, start, rec };
