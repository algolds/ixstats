"use client";

import Link from "next/link";

export default function VexelRegistryPage() {
  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-wider text-amber-500">Heraldic Authority</h1>
            <p className="mt-1 text-sm text-zinc-400">Registry of published coats of arms</p>
          </div>
          <Link
            href="/labs/vexel"
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-600"
          >
            Create New Arms
          </Link>
        </header>

        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-12 text-center backdrop-blur-md">
          <p className="mb-2 text-zinc-400">The Heraldic Authority Registry is loading...</p>
          <span className="text-xs text-zinc-600">
            Task 7 will complete this browser interface.
          </span>
        </div>
      </div>
    </div>
  );
}
