import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ResetView } from "@/components/account-views";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPage({ params }: PageProps<"/reset/[token]">) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-soft">Checking the link…</p>}>
      <Reset params={params} />
    </Suspense>
  );
}

async function Reset({ params }: Pick<PageProps<"/reset/[token]">, "params">) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();
  return <ResetView token={token} />;
}
