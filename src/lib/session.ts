// Who is making this request. Login is Supabase Auth; the session lives in httpOnly cookies that only this
// server reads. Every route runs inside withSession, which gives it a database client that acts AS that person,
// so the database's row rules decide what they can see and change.
import "server-only";
import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminDb, DEMO_WORKSPACE, NoBrandError, requestScope, userDb } from "./db";
import { fail, serverError } from "./api";
import type { Role } from "./types";

export const ACCESS_COOKIE = "bs-at";
export const REFRESH_COOKIE = "bs-rt";
export const WORKSPACE_COOKIE = "bs-ws";

export type MemberRole = Role | "guest";

export interface Membership {
  workspace_id: string;
  workspace: string;
  is_demo: boolean;
  role: MemberRole;
  name: string;
  email: string;
}

export interface Session {
  userId: string;
  /** false for the public visitor who has not signed in (they use the demo workspace) */
  signedIn: boolean;
  /** one of the shared "Try as…" demo accounts */
  demoAccount: boolean;
  email: string;
  name: string;
  workspace: { id: string; name: string; isDemo: boolean };
  /** the role this person holds here; "guest" may switch between the three roles */
  memberRole: MemberRole;
  memberships: Membership[];
  /**
   * May act in any of the three roles: the demo's guest, and a brand manager of a real workspace, who can
   * cover for the creator or expert in a small team (history still records their own name).
   */
  canSwitchRole: boolean;
  /** The role to act with: the person's own role, or the role they picked on screen if they may switch. */
  role(picked?: Role): Role;
  /** The name written into history: the person's own name, or for the guest the name they typed. */
  actor(typed?: string): string;
  db: SupabaseClient;
}

interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user?: { id: string; email?: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> };
}

function authEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.BRANDSENTINEL_DB_KEY?.trim();
  if (!url || !key) throw new Error("SUPABASE_URL and BRANDSENTINEL_DB_KEY (or SUPABASE_PUBLISHABLE_KEY) must be set");
  return { url, key };
}

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string = "",
    public status: number = 400,
  ) {
    super(message);
  }
}

async function authCall(path: string, body: unknown): Promise<Tokens> {
  const { url, key } = authEnv();
  const res = await fetch(`${url}/auth/v1/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new AuthError(String(data.msg ?? data.error_description ?? data.message ?? "Sign-in failed"), String(data.error_code ?? data.error ?? ""), res.status);
  return data as unknown as Tokens;
}

export function passwordSignIn(email: string, password: string): Promise<Tokens> {
  return authCall("token?grant_type=password", { email, password });
}

function refreshTokens(refresh_token: string): Promise<Tokens> {
  return authCall("token?grant_type=refresh_token", { refresh_token });
}

/** The readable middle part of a session token. It is only used to see who and until when; the database verifies it. */
function claims(token: string): { sub?: string; exp?: number; email?: string; app_metadata?: { demo?: boolean } } {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  } catch {
    return {};
  }
}

const COOKIE = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };

export async function setSessionCookies(t: Tokens) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, t.access_token, { ...COOKIE, maxAge: Math.max(60, t.expires_in) });
  jar.set(REFRESH_COOKIE, t.refresh_token, { ...COOKIE, maxAge: 60 * 60 * 24 * 30 });
}

export async function clearSessionCookies() {
  const jar = await cookies();
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, WORKSPACE_COOKIE]) jar.set(name, "", { ...COOKIE, maxAge: 0 });
}

export async function setWorkspaceCookie(id: string) {
  (await cookies()).set(WORKSPACE_COOKIE, id, { ...COOKIE, maxAge: 60 * 60 * 24 * 365 });
}

// ── Demo accounts ───────────────────────────────────────────────────────────────────────────────────
// The public visitor ("guest") and the three "Try as…" accounts are real accounts that belong only to the
// demo workspace. The guest's password is derived from the server's secret and never shown; the three demo
// passwords are public on purpose (they open nothing but the fictional demo brands).

export const DEMO_DOMAIN = "brandsentinel.demo";
export const DEMO_PASSWORD = "brandsentinel-demo";
export const DEMO_ACCOUNTS: Record<Role, { email: string; name: string }> = {
  creator: { email: `creator@${DEMO_DOMAIN}`, name: "Priya (demo)" },
  expert: { email: `expert@${DEMO_DOMAIN}`, name: "Meera (demo)" },
  brand_manager: { email: `manager@${DEMO_DOMAIN}`, name: "Arjun (demo)" },
};
const GUEST_EMAIL = `guest@${DEMO_DOMAIN}`;

function guestPassword(): string {
  const secret = process.env.BRANDSENTINEL_DB_KEY?.trim() || process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || "";
  return createHmac("sha256", secret).update("brandsentinel-guest-v1").digest("hex").slice(0, 40);
}

/** Sign in to a demo account, creating it (and its place in the demo workspace) the first time. */
async function demoSignIn(email: string, password: string, role: MemberRole, name: string): Promise<Tokens> {
  try {
    return await passwordSignIn(email, password);
  } catch (e) {
    if (!(e instanceof AuthError) || e.status >= 500) throw e;
  }
  // not there yet, or its password was changed: (re)create it with the server's own key
  const admin = adminDb();
  const { data: existing } = await admin.from("workspace_members").select("user_id").eq("workspace_id", DEMO_WORKSPACE).eq("email", email).maybeSingle();
  let userId = existing?.user_id as string | undefined;
  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) userId = undefined;
  }
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { demo: true }, user_metadata: { name } });
    if (error || !data.user) throw new Error(`Could not create the demo account: ${error?.message ?? "no user returned"}`);
    userId = data.user.id;
  }
  const { error: mErr } = await admin.from("workspace_members").upsert({ workspace_id: DEMO_WORKSPACE, user_id: userId, role, name, email });
  if (mErr) throw new Error(`Could not add the demo account to the demo workspace: ${mErr.message}`);
  return passwordSignIn(email, password);
}

export function signInDemoAccount(role: Role): Promise<Tokens> {
  const a = DEMO_ACCOUNTS[role];
  return demoSignIn(a.email, DEMO_PASSWORD, role, a.name);
}

// the guest's session is shared by all visitors of this server instance and renewed before it runs out
let guest: { token: string; exp: number; userId: string } | null = null;
let guestInflight: Promise<{ token: string; exp: number; userId: string }> | null = null;

async function guestSession() {
  const now = Date.now() / 1000;
  if (guest && guest.exp - now > 120) return guest;
  guestInflight ??= demoSignIn(GUEST_EMAIL, guestPassword(), "guest", "Guest")
    .then((t) => {
      const c = claims(t.access_token);
      guest = { token: t.access_token, exp: c.exp ?? now + t.expires_in, userId: c.sub ?? t.user?.id ?? "" };
      return guest;
    })
    .finally(() => {
      guestInflight = null;
    });
  return guestInflight;
}

// ── Who belongs where: asked once per person every few seconds, not on every request ──────────────────
const CONTEXT_TTL = 15_000;
const contexts = new Map<string, { at: number; memberships: Membership[] }>();

/** Call after someone joins, leaves or changes role, so the next request sees it. */
export function forgetMemberships(userId?: string) {
  if (userId) contexts.delete(userId);
  else contexts.clear();
}

async function membershipsOf(userId: string, client: SupabaseClient): Promise<Membership[]> {
  const hit = contexts.get(userId);
  if (hit && Date.now() - hit.at < CONTEXT_TTL) return hit.memberships;
  const { data, error } = await client.rpc("my_context");
  if (error) throw new AuthError(error.message, error.code ?? "", 401);
  const memberships = ((data as { memberships?: Membership[] } | null)?.memberships ?? []) as Membership[];
  contexts.set(userId, { at: Date.now(), memberships });
  if (contexts.size > 2000) contexts.clear();
  return memberships;
}

function build(userId: string, token: string, email: string, signedIn: boolean, demoAccount: boolean, memberships: Membership[], m: Membership): Session {
  const client = userDb(token);
  const canSwitchRole = m.role === "guest" || (m.role === "brand_manager" && !m.is_demo);
  const own: Role = m.role === "guest" ? "creator" : m.role;
  return {
    canSwitchRole,
    userId,
    signedIn,
    demoAccount,
    email,
    name: m.name || email.split("@")[0] || "Member",
    workspace: { id: m.workspace_id, name: m.workspace, isDemo: m.is_demo },
    memberRole: m.role,
    memberships,
    role: (picked) => (canSwitchRole ? (picked ?? own) : own),
    actor: (typed) => (m.role === "guest" ? typed?.trim() || "Guest" : m.name || email.split("@")[0] || "Member"),
    db: client,
  };
}

/** A signed-in person who is not in any workspace yet (for example, their invite was cancelled). */
export class NoWorkspaceError extends Error {
  constructor(
    public userId: string,
    public email: string,
    public token: string,
  ) {
    super("You are signed in but not in a workspace yet. Create one or open an invite link.");
  }
}

/** For the health check: can the public visitor's session be opened? Returns "ok" or a short reason. */
export async function guestSessionCheck(): Promise<string> {
  try {
    const g = await guestSession();
    const memberships = await membershipsOf(g.userId, userDb(g.token));
    return memberships.some((m) => m.workspace_id === DEMO_WORKSPACE) ? "ok" : "guest account is not in the demo workspace";
  } catch (e) {
    return `error: ${(e instanceof Error ? e.message : String(e)).slice(0, 140)}`;
  }
}

async function guestAsSession(): Promise<Session> {
  try {
    const g = await guestSession();
    const memberships = await membershipsOf(g.userId, userDb(g.token));
    const m = memberships.find((x) => x.workspace_id === DEMO_WORKSPACE);
    if (!m) throw new Error("The demo workspace is not set up (the guest account has no membership)");
    return build(g.userId, g.token, "", false, false, [m], m);
  } catch (e) {
    // If the login service can't be reached, the open demo keeps working with the server's own client,
    // limited to the demo workspace. /api/health reports this under "auth".
    console.error("[session] guest session failed; serving the demo with the server client", e);
    const m: Membership = { workspace_id: DEMO_WORKSPACE, workspace: "BrandSentinel demo", is_demo: true, role: "guest", name: "Guest", email: "" };
    return { ...build("guest", "", "", false, false, [m], m), db: adminDb() };
  }
}

/** Works out who is asking. Not signed in (or a session that can't be renewed) means the demo's guest. */
export async function getSession(): Promise<Session> {
  const jar = await cookies();
  let access = jar.get(ACCESS_COOKIE)?.value;
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  const now = Date.now() / 1000;

  if ((!access || (claims(access).exp ?? 0) - now < 30) && refresh) {
    try {
      const t = await refreshTokens(refresh);
      await setSessionCookies(t);
      access = t.access_token;
    } catch (e) {
      // a refresh token that was already used or has run out: sign the person out quietly
      if (e instanceof AuthError && e.status < 500) {
        await clearSessionCookies().catch(() => undefined);
        access = undefined;
      } else if (!access || (claims(access).exp ?? 0) <= now) {
        access = undefined;
      }
    }
  }
  if (!access || (claims(access).exp ?? 0) <= now) return guestAsSession();

  const c = claims(access);
  if (!c.sub) return guestAsSession();
  let memberships: Membership[];
  try {
    memberships = await membershipsOf(c.sub, userDb(access));
  } catch (e) {
    if (e instanceof AuthError) {
      await clearSessionCookies().catch(() => undefined);
      return guestAsSession();
    }
    throw e;
  }
  const email = c.email ?? "";
  if (!memberships.length) throw new NoWorkspaceError(c.sub, email, access);
  const wanted = jar.get(WORKSPACE_COOKIE)?.value;
  const m = memberships.find((x) => x.workspace_id === wanted) ?? memberships[0];
  return build(c.sub, access, email, true, !!c.app_metadata?.demo, memberships, m);
}

/** Only a brand manager of a real workspace runs the team, the invites and the AI key. */
export function isManager(me: Session): boolean {
  return me.memberRole === "brand_manager" && !me.workspace.isDemo;
}

type Handler<C> = (req: Request, ctx: C, me: Session) => Promise<Response>;

/**
 * Wraps an API route: finds out who is asking and runs the route with a database client that acts as them.
 * Inside, db() is that client.
 */
export function withSession<C = unknown>(handler: Handler<C>, where = "api"): (req: Request, ctx: C) => Promise<Response> {
  return async (req, ctx) => {
    // every route depends on who is asking, so none of them can be prepared ahead of time
    await connection();
    let me: Session;
    try {
      me = await getSession();
    } catch (e) {
      if (e instanceof NoWorkspaceError) return fail(e.message, 409);
      return serverError(e, `${where} (session)`);
    }
    try {
      return await requestScope.run({ db: me.db, workspaceId: me.workspace.id }, () => handler(req, ctx, me));
    } catch (e) {
      if (e instanceof NoBrandError) return fail(e.message, 409);
      return serverError(e, where);
    }
  };
}
