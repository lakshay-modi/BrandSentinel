import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-mono text-sm text-ink-faint">404</p>
      <h1 className="mt-2 text-2xl font-semibold">This page doesn&apos;t exist</h1>
      <p className="mt-2 text-sm text-ink-soft">The link may be old, or the post may have a different ID.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/" className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-white">
          Check a post
        </Link>
        <Link href="/queue" className="rounded-md border border-line-strong px-3 py-2 text-sm font-medium">
          Review queue
        </Link>
      </div>
    </div>
  );
}
