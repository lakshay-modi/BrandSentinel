import { adminDb } from "@/lib/db";
import { apiJson, CORS, tokenScope } from "@/lib/tokens";

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** The brands a token can check against. The extension and the add-on use it to fill their brand menu, and to test a token. */
export async function GET(req: Request) {
  const scope = await tokenScope(req).catch(() => null);
  if (!scope) return apiJson({ error: "Missing or wrong token. Send it as “Authorization: Bearer <token>”." }, 401);
  const { data, error } = await adminDb().from("brands").select("slug, name").eq("workspace_id", scope.workspaceId).order("created_at");
  if (error) return apiJson({ error: "Couldn't load the brands. Try again." }, 500);
  return apiJson({ workspace: scope.workspace, brands: data ?? [] });
}
