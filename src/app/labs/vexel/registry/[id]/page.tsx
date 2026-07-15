"use client";

import { use } from "react";
import Link from "next/link";

interface VexelRegistryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function VexelRegistryDetailPage({ params }: VexelRegistryDetailPageProps) {
  const { id } = use(params);

  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center gap-4 border-b border-white/10 pb-6">
          <Link
            href="/labs/vexel/registry"
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
          >
            &larr; Back to Registry
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <h1 className="text-xl font-semibold text-zinc-300">Arms Detail</h1>
        </header>

        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-12 text-center backdrop-blur-md">
          <p className="mb-2 text-zinc-400">Displaying Achievement: {id}</p>
          <span className="text-xs text-zinc-600">Task 7 will render the detailed layout.</span>
        </div>
      </div>
    </div>
  );
}
