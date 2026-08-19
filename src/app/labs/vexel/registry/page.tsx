"use client";

import Link from "next/link";
import RegistryBrowser from "~/components/maps/vexel/registry/RegistryBrowser";

export default function VexelRegistryPage() {
  return (
    <div className="min-h-screen bg-zinc-950 p-8 font-sans text-zinc-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-wider text-amber-500">
              🛡️ Heraldic Registry
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Rolls of the public sovereign, institutional, and personal coats of arms
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/labs/vexel/generate"
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-400 transition-all hover:bg-white/5 hover:text-zinc-100"
            >
              Generator Gallery
            </Link>
            <Link
              href="/labs/vexel"
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-all hover:bg-amber-600"
            >
              Open Studio
            </Link>
          </div>
        </header>

        <RegistryBrowser />
      </div>
    </div>
  );
}
