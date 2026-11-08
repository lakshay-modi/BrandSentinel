"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink-soft">This part of the page couldn&apos;t load. Your work is saved; try again.</p>
      <button onClick={reset} className="mt-6 rounded-md bg-ink px-3 py-2 text-sm font-medium text-white">
        Try again
      </button>
    </div>
  );
}
