import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SignupView } from "@/components/account-views";

export const metadata: Metadata = { title: "Join a workspace" };

export default function JoinPage({ params }: PageProps<"/join/[token]">) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-soft">Checking the invite link…</p>}>
      <Join params={params} />
    </Suspense>
  );
}

async function Join({ params }: Pick<PageProps<"/join/[token]">, "params">) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();
  return <SignupView invite={token} />;
}
