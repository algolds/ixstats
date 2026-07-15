"use client";

import Link from "next/link";

export default function VexelGeneratePage() {
  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-wider text-amber-500">Generate Arms</h1>
            <p className="mt-1 text-sm text-zinc-400">Procedural armorial achievements generator</p>
          </div>
          <Link
            href="/labs/vexel"
            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-zinc-100 transition-colors hover:bg-white/5"
          >
            Open Editor
          </Link>
        </header>

        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-12 text-center backdrop-blur-md">
          <p className="mb-2 text-zinc-400">Procedural generation gallery loading...</p>
          <span className="text-xs text-zinc-600">
            Task 6 will implement the generation algorithms and gallery view.
          </span>
        </div>
      </div>
    </div>
  );
}
