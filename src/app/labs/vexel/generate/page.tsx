"use client";

import Link from "next/link";
import GalleryMode from "~/components/vexel/GalleryMode";

export default function VexelGeneratePage() {
  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-wider text-amber-500">🛡️ Vexel Gallery</h1>
            <p className="mt-1 text-sm text-zinc-400">Procedural armorial achievements generator</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/labs/vexel/registry"
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-all"
            >
              Public Registry
            </Link>
            <Link
              href="/labs/vexel"
              className="rounded-lg bg-amber-500 hover:bg-amber-600 px-4 py-2 text-sm font-semibold text-zinc-950 transition-all"
            >
              Open Studio
            </Link>
          </div>
        </header>

        <GalleryMode />
      </div>
    </div>
  );
}
