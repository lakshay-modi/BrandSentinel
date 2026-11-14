import { z } from "zod";
import { allow, clientId, postInputSchema } from "@/lib/api";
import { addHistory, adminDb, db, getBrandContext, listBrands, NoBrandError, requestScope } from "@/lib/db";
import { runReview } from "@/lib/review/run-review";
import { loadWorkspaceAiKey } from "@/lib/secrets";
import { apiJson, CORS, tokenScope } from "@/lib/tokens";
import { describeFix } from "@/lib/fixes";
import { whereLabel } from "@/lib/video";
import type { Finding, PostInput } from "@/lib/types";

export const maxDuration = 60;

const bodySchema = z.object({
  /** the text being written; the rest of a post's details are optional here */
  text: z.string().max(3000, "The text is over 3,000 characters").default(""),
  /** which brand's rules to use (its short name); the workspace's first brand if left out */
  brand: z.string().regex(/^[a-z0-9-]{1,40}$/).optional(),
  channel: z.enum(["instagram", "linkedin", "x", "website", "email"]).default("instagram"),
  post_type: z.string().trim().max(40).default("product"),
  product: z.string().trim().max(120).default(""),
  partner: z.boolean().default(false),
  /** false (default): fast checks only, instant and free. true: also the AI check, for a final look. */
  ai: z.boolean().default(false),
  /** save the text as a draft post in BrandSentinel, so it can go through approval there */
  save: z.boolean().default(false),
  author: z.string().trim().max(40).default(""),
});

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function publicFinding(f: Finding, input: PostInput) {
  const replace = f.fix.kind === "replace" ? f.fix.pairs : f.fix.kind === "remove" ? f.fix.quotes.map((q) => ({ from: q, to: "" })) : [];
  return { id: f.id, rule_id: f.rule_id, severity: f.severity, category: f.category, where: f.location === "caption" ? "in the text" : whereLabel(f, input), quotes: f.quotes, message: f.message, rule: f.evidence, fix: describeFix(f.fix), replace, checked_by: f.source };
}

/**
 * The same check as the app, for other tools: the browser extension and the Google Docs add-on call this
 * while the creator writes. Protected by a workspace token ("Authorization: Bearer bs_…").
 */
export async function POST(req: Request) {
  const scope = await tokenScope(req).catch(() => null);
  if (!scope) return apiJson({ error: "Missing or wrong token. Create one in BrandSentinel under Connect, and send it as “Authorization: Bearer <token>”." }, 401);
  let raw: unknown;
  try {
    raw = JSON.parse((await req.text()).slice(0, 20_000));
  } catch {
    return apiJson({ error: "The request body must be JSON." }, 400);
  }
  const body = bodySchema.safeParse(raw);
  if (!body.success) return apiJson({ error: body.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ") }, 400);
  const b = body.data;
  if (!allow("v1-check", `${scope.workspaceId}:${clientId(req)}`, 90, 60_000)) return apiJson({ error: "Too many checks in a minute. Wait a moment." }, 429);
  if (b.save && !b.text.trim()) return apiJson({ error: "There is no text to save." }, 400);

  // a token acts for its whole workspace: the server's own client is used, limited to that workspace's brands
  return requestScope.run({ db: adminDb(), workspaceId: scope.workspaceId }, async () => {
    try {
      const ctx = await getBrandContext(b.brand);
      if (b.brand && ctx.brand.slug !== b.brand) return apiJson({ error: `This workspace has no brand called “${b.brand}”.`, brands: await listBrands() }, 404);
      const input = postInputSchema.parse({ channel: b.channel, post_type: b.post_type, product: b.product, partner: b.partner, caption: b.text, images: [] });
      if (b.ai) await loadWorkspaceAiKey(scope.workspaceId);
      const result = await runReview(input, ctx, { origin: new URL(req.url).origin, clientId: `v1:${scope.workspaceId}:${clientId(req)}`, codeOnly: !b.ai });
      let saved: { post_id: string; url: string } | null = null;
      if (b.save) {
        const author = b.author || scope.tokenName;
        const { data: post, error } = await db()
          .from("posts")
          .insert({ brand_id: ctx.brand.id, title: b.text.slice(0, 60), channel: input.channel, post_type: input.post_type, product: input.product, partner: input.partner, caption: input.caption, images: [], created_by: author })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        const { error: rErr } = await db()
          .from("reviews")
          .insert({ post_id: post.id, caption: input.caption, images: [], score: result.score, band: result.band, findings: result.findings, ask_human: result.ask_human, goal: result.goal, suggested_caption: result.suggested_caption, dropped: result.dropped, redacted: result.redacted, rulebook_version: result.rulebook_version, model: result.model, ai_status: result.ai_status });
        if (rErr) throw new Error(rErr.message);
        await addHistory(post.id as string, "created", "creator", author, { via: scope.tokenName });
        await addHistory(post.id as string, "checked", "creator", author, { score: result.score, problems: result.findings.length, ai: result.ai_status });
        saved = { post_id: post.id as string, url: `${new URL(req.url).origin}/posts/${post.id}` };
      }
      return apiJson({
        brand: { slug: ctx.brand.slug, name: ctx.brand.name },
        score: result.score,
        band: result.band,
        problems: result.findings.map((f) => publicFinding(f, input)),
        ai: result.ai_status,
        ...(b.ai && result.ai_status !== "ok" ? { note: "The AI check wasn't available just now, so only the fast checks ran." } : {}),
        saved,
      });
    } catch (e) {
      if (e instanceof NoBrandError) return apiJson({ error: e.message }, 409);
      console.error("[v1/check]", e);
      return apiJson({ error: "The check failed on the server. Try again." }, 500);
    }
  });
}
