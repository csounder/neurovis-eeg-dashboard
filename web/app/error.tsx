"use client";

import * as React from "react";
import { formatCaught } from "@/lib/formatCaught";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  const raw =
    error instanceof Error
      ? error.message
      : formatCaught(error as unknown);
  const message =
    raw === "[object Event]" || raw === "[object DOMException]"
      ? formatCaught(error as unknown)
      : raw;

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-lg font-semibold text-zinc-100">Something went wrong</h1>
      <p className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 font-mono text-sm text-rose-200/90">
        {message}
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-zinc-500">digest: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="self-start rounded-md border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-700"
      >
        Try again
      </button>
    </div>
  );
}
