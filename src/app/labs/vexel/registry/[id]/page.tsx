"use client";

import { use } from "react";
import Link from "next/link";
import AchievementDetail from "~/components/maps/vexel/registry/AchievementDetail";

interface VexelRegistryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function VexelRegistryDetailPage({ params }: VexelRegistryDetailPageProps) {
  const { id } = use(params);

  return (
    <div className="min-h-screen bg-zinc-950 p-8 font-sans text-zinc-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/labs/vexel/registry"
              className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              &larr; Back to Registry
            </Link>
            <div className="h-4 w-px bg-white/10" />
            <h1 className="text-xl font-bold tracking-wider text-amber-500">🛡️ Roll of Arms</h1>
          </div>
          <Link
            href="/labs/vexel"
            className="animate-pulse rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-all hover:bg-amber-600"
          >
            Create Your Own
          </Link>
        </header>

        <AchievementDetail achievementId={id} />
      </div>
    </div>
  );
}
