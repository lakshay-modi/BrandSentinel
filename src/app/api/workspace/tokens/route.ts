import { z } from "zod";
import { fail, json, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { isManager, withSession } from "@/lib/session";
import { newToken } from "@/lib/tokens";

/** Create an API token (brand manager). The token is in the answer once; only its fingerprint is stored. */
export const POST = withSession(async (req, _ctx, me) => {
  const body = await readJson(req, z.object({ name: z.string().trim().min(2, "Give the token a name, for example “Riya's browser”").max(60) }));
  if (!body.ok) return body.res;
  if (!isManager(me)) return fail(me.workspace.isDemo ? "The demo has one public token already. Create your own workspace to make private tokens." : "Only a brand manager can create tokens.", 403);
  const { count } = await db().from("api_tokens").select("id", { count: "exact", head: true }).eq("workspace_id", me.workspace.id);
  if ((count ?? 0) >= 20) return fail("This workspace has 20 tokens already. Delete one you no longer use.", 409);
  const t = newToken();
  const { data, error } = await db()
    .from("api_tokens")
    .insert({ workspace_id: me.workspace.id, name: body.data.name, token_hash: t.hash, hint: t.hint, created_by: me.userId, created_by_name: me.name })
    .select("id, name, hint, created_by_name, created_at, last_used_at")
    .single();
  if (error) throw new Error(error.message);
  return json({ token: t.token, row: data });
}, "workspace/tokens");
