"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Role } from "@/lib/types";
import { ROLE_INFO } from "@/lib/roles";
import { send } from "@/lib/client/send";
import { afterSignIn, restartApp, useMe, useMeState } from "@/lib/client/use-me";
import { ROLE_DOT } from "./role-note";
import { Button, ErrorNote, PageSkeleton } from "./ui";

const ROLES: Role[] = ["creator", "expert", "brand_manager"];
const DEMO_LOGINS: Record<Role, string> = { creator: "creator@brandsentinel.demo", expert: "expert@brandsentinel.demo", brand_manager: "manager@brandsentinel.demo" };
const DEMO_PASSWORD = "brandsentinel-demo";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function Card({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
      {lead && <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{lead}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** One click into a ready-made demo account, so nobody has to type anything to try a role. */
function TryAs() {
  const [busy, setBusy] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const go = async (role: Role) => {
    setBusy(role);
    setError(null);
    try {
      await send("/api/auth/demo", "POST", { role });
      restartApp(afterSignIn(role === "creator" ? "/" : "/queue"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };
  return (
    <div>
      <ul className="grid gap-2.5">
        {ROLES.map((r) => (
          <li key={r}>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => go(r)}
              className="flex w-full items-center gap-3 rounded-lg border border-line-strong bg-surface px-3.5 py-3 text-left transition-colors hover:border-ink-faint hover:bg-paper disabled:cursor-wait disabled:opacity-70"
            >
              <span className={`size-2.5 shrink-0 rounded-full ${ROLE_DOT[r]}`} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold">{busy === r ? "Signing in…" : `Sign in as ${ROLE_INFO[r].label}`}</span>
                <span className="block text-[13px] text-ink-soft">{ROLE_INFO[r].summary}</span>
              </span>
              <span aria-hidden="true" className="text-ink-faint">
                →
              </span>
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </div>
  );
}

/** The demo accounts' emails and password, shown openly so judges and testers can type them too. */
function DemoCredentials({ onPick }: { onPick: (email: string) => void }) {
  return (
    <div className="mt-4 rounded-lg bg-paper px-3.5 py-3 text-[13px]">
      <p className="font-semibold">Demo accounts</p>
      <p className="mt-0.5 text-ink-soft">Use the buttons above, or type one of these into the sign-in form. Click an email to fill the form.</p>
      <ul className="mt-2 grid gap-1.5">
        {ROLES.map((r) => (
          <li key={r} className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
            <span className="text-ink-soft sm:w-28 sm:shrink-0">{ROLE_INFO[r].label}</span>
            <button
              type="button"
              onClick={() => onPick(DEMO_LOGINS[r])}
              title="Put this email and the password in the sign-in form"
              className="self-start whitespace-nowrap text-left font-mono text-[12.5px] underline decoration-line-strong underline-offset-2 hover:decoration-ink"
            >
              {DEMO_LOGINS[r]}
            </button>
          </li>
        ))}
        <li className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
          <span className="text-ink-soft sm:w-28 sm:shrink-0">Password (all three)</span>
          <span className="font-mono text-[12.5px]">{DEMO_PASSWORD}</span>
        </li>
      </ul>
      <p className="mt-2 text-ink-soft">They open only the demo workspace and its fictional brands (Oatvia Foods, Solvira Skincare, Voltaro).</p>
    </div>
  );
}

export function LoginView() {
  const { me } = useMeState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // already signed in (for example the sign-in page was opened from a bookmark): go to the app
  useEffect(() => {
    if (me?.signed_in) window.location.replace(afterSignIn("/"));
  }, [me]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await send("/api/auth/signin", "POST", { email, password });
      restartApp(afterSignIn("/"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };
  const pick = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError(null);
  };
  return (
    <div data-account-page className="mx-auto max-w-4xl">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">Sign in to BrandSentinel</h1>
      <p className="mt-1 max-w-2xl text-[15px] text-ink-soft">
        BrandSentinel checks your brand&apos;s posts against its own rules and approved facts before they go live. Sign in with a demo account to try it, or with your own workspace.
      </p>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Card title="Try the demo" lead="One click, nothing to type. Each demo account has one role, the way a real team member does. To change role, sign out and sign in with another demo account.">
          <TryAs />
          <DemoCredentials onPick={pick} />
        </Card>
        <Card title="Sign in" lead="With a demo account above, or with your own account for your company's private workspace.">
          <form onSubmit={submit} className="grid gap-3.5" noValidate>
            <Field label="Email">
              <input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password">
              <input className="field" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {error && <ErrorNote>{error}</ErrorNote>}
            <Button variant="primary" type="submit" disabled={busy || !email || !password}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-3 text-[13px] text-ink-soft">
            Forgot your password? Ask a brand manager in your workspace for a reset link (Team → Reset password). No email is needed.
          </p>
          <p className="mt-4 text-[14px] text-ink-soft">
            New here?{" "}
            <Link href="/signup" className="font-semibold text-ink underline underline-offset-4">
              Create a workspace
            </Link>{" "}
            for your own company. No confirmation email is needed.
          </p>
        </Card>
      </div>
    </div>
  );
}

interface InviteInfo {
  workspace: string;
  role: Role;
  invited_by: string;
  state: "open" | "used" | "expired";
}

/** Create an account: either start a company workspace, or (with an invite link) join one. */
export function SignupView({ invite }: { invite?: string }) {
  const { me } = useMeState();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", workspace: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invite) return;
    let alive = true;
    fetch(`/api/invites/${encodeURIComponent(invite)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) setInfoError(data.error ?? "This invite link is not valid.");
        else setInfo(data.invite as InviteInfo);
      })
      .catch(() => alive && setInfoError("Couldn't check the invite link. Check your connection and reload."));
    return () => {
      alive = false;
    };
  }, [invite]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const signedInOwn = !!me?.signed_in && !me.demo_account;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (signedInOwn) {
        // already has an account: join with it
        await send("/api/workspaces", "POST", invite ? { invite } : { name: form.workspace });
        restartApp("/");
        return;
      }
      const res = await send<{ needs_workspace?: boolean }>("/api/auth/signup", "POST", {
        name: form.name,
        email: form.email,
        password: form.password,
        ...(invite ? { invite } : { workspace: form.workspace }),
      });
      restartApp(res.needs_workspace ? "/welcome" : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  if (invite && !info && !infoError) return <PageSkeleton rows={3} />;
  if (invite && (infoError || info?.state !== "open")) {
    return (
      <div data-account-page className="mx-auto max-w-lg">
        <Card title="This invite link can't be used">
          <p className="text-[14px] text-ink-soft">
            {infoError ?? (info?.state === "used" ? "It has already been used. Each link works for one person." : "It has expired. Invite links work for 7 days.")} Ask your brand manager for a
            new link.
          </p>
          <p className="mt-4">
            <Link href="/login" className="text-[14px] font-semibold text-ink underline underline-offset-4">
              Go to sign in
            </Link>
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div data-account-page className="mx-auto max-w-lg">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">{invite ? `Join ${info?.workspace}` : "Create your workspace"}</h1>
      <p className="mt-1 text-[15px] text-ink-soft">
        {invite ? (
          <>
            {info?.invited_by || "Your brand manager"} invited you as <strong className="font-semibold text-ink">{info ? ROLE_INFO[info.role].label : ""}</strong>: {info ? ROLE_INFO[info.role].summary.toLowerCase() : ""}
          </>
        ) : (
          "A workspace holds your company's brands, rulebooks, facts and posts. Only people you invite can see it, and you start as its brand manager."
        )}
      </p>
      <div className="mt-5">
        <Card title={signedInOwn ? `Signed in as ${me?.email}` : "Your account"}>
          <form onSubmit={submit} className="grid gap-3.5" noValidate>
            {!signedInOwn && (
              <>
                <Field label="Your name" hint="Shown next to what you check, decide and approve.">
                  <input className="field" autoComplete="name" required maxLength={40} value={form.name} onChange={set("name")} />
                </Field>
                <Field label="Work email">
                  <input className="field" type="email" autoComplete="email" required value={form.email} onChange={set("email")} />
                </Field>
                <Field label="Password" hint="At least 8 characters.">
                  <input className="field" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set("password")} />
                </Field>
              </>
            )}
            {!invite && (
              <Field label="Workspace name" hint="Usually your company's name. You can rename it later.">
                <input className="field" autoComplete="organization" required maxLength={80} value={form.workspace} onChange={set("workspace")} />
              </Field>
            )}
            {error && <ErrorNote>{error}</ErrorNote>}
            <Button variant="primary" type="submit" disabled={busy}>
              {busy ? "Setting up…" : invite ? "Join workspace" : "Create workspace"}
            </Button>
          </form>
          {!signedInOwn && (
            <p className="mt-4 text-[14px] text-ink-soft">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-ink underline underline-offset-4">
                Sign in
              </Link>
              {invite ? ", then open this link again." : "."}
            </p>
          )}
        </Card>
        {!invite && (
          <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
            No confirmation email is sent, so your account works at once. New workspaces use BrandSentinel&apos;s shared AI key until you connect your own under Team, so keep to
            non-confidential content until then.
          </p>
        )}
      </div>
    </div>
  );
}

/** Signed in, but not in a workspace (for example the first try at creating one failed). */
export function WelcomeView() {
  const { me } = useMeState();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!me) return <PageSkeleton rows={2} />;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await send("/api/workspaces", "POST", { name });
      restartApp("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };
  const signOut = async () => {
    await send("/api/auth/signout", "POST", {}).catch(() => undefined);
    restartApp("/login");
  };
  if (!me.signed_in) {
    return (
      <div data-account-page className="mx-auto max-w-lg">
        <Card title="Sign in first">
          <p className="text-[14px] text-ink-soft">Create an account to start your own workspace.</p>
          <p className="mt-4 flex gap-4 text-[14px] font-semibold">
            <Link href="/signup" className="text-ink underline underline-offset-4">
              Create a workspace
            </Link>
            <Link href="/login" className="text-ink underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    );
  }
  return (
    <div data-account-page className="mx-auto max-w-lg">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">{me.workspace ? "Start another workspace" : "One more step"}</h1>
      <p className="mt-1 text-[15px] text-ink-soft">
        {me.workspace ? "For a separate company or client. Its brands and posts are kept apart from your other workspaces." : "You are signed in, but not in a workspace yet. Create one, or open the invite link you were sent."}
      </p>
      <div className="mt-5">
        <Card title="New workspace">
          <form onSubmit={submit} className="grid gap-3.5" noValidate>
            <Field label="Workspace name" hint="Usually the company's name.">
              <input className="field" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" type="submit" disabled={busy || name.trim().length < 2}>
                {busy ? "Creating…" : "Create workspace"}
              </Button>
              {!me.workspace && (
                <Button type="button" onClick={signOut}>
                  Sign out
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

/** A reset link from a brand manager: choose a new password, then you are signed in. */
export function ResetView({ token }: { token: string }) {
  const me = useMe();
  const [email, setEmail] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/auth/reset?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) setLinkError(data.error ?? "This reset link is not valid.");
        else setEmail(data.email ?? "");
      })
      .catch(() => alive && setLinkError("Couldn't check the link. Check your connection and reload."));
    return () => {
      alive = false;
    };
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password !== again) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await send("/api/auth/reset", "POST", { token, password });
      restartApp("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  if (email === null && !linkError) return <PageSkeleton rows={2} />;
  return (
    <div data-account-page className="mx-auto max-w-lg">
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">Choose a new password</h1>
      <div className="mt-5">
        {linkError ? (
          <Card title="This reset link can't be used">
            <p className="text-[14px] text-ink-soft">{linkError}</p>
            <p className="mt-4">
              <Link href="/login" className="text-[14px] font-semibold text-ink underline underline-offset-4">
                Go to sign in
              </Link>
            </p>
          </Card>
        ) : (
          <Card title={email ? `For ${email}` : "Your account"} lead="Your brand manager made this link for you. It works once, for 24 hours.">
            {me?.signed_in && me.email && email && me.email.toLowerCase() !== email.toLowerCase() && (
              <p className="mb-3.5 rounded-lg bg-med-bg px-3 py-2 text-[13px] text-ink">
                You are signed in as {me.email} on this device. Saving signs you out of that account and into {email}.
              </p>
            )}
            <form onSubmit={submit} className="grid gap-3.5" noValidate>
              <Field label="New password" hint="At least 8 characters.">
                <input className="field" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Field label="New password again">
                <input className="field" type="password" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} />
              </Field>
              {error && <ErrorNote>{error}</ErrorNote>}
              <Button variant="primary" type="submit" disabled={busy || password.length < 8 || !again}>
                {busy ? "Saving…" : "Save and sign in"}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
