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
    <div className="bg-grouped text-label min-h-screen p-8 font-sans">
      <div className="mx-auto max-w-6xl">
        <header className="border-separator mb-8 flex items-center justify-between border-b pb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/labs/vexel/registry"
              className="text-body text-label-secondary hover:text-label transition-colors"
            >
              &larr; Back to Registry
            </Link>
            <div className="bg-separator h-4 w-px" />
            <h1 className="text-title-2 text-label">🛡️ Roll of Arms</h1>
          </div>
          <Link
            href="/labs/vexel"
            className="rounded-control bg-tint text-body text-on-tint hover:bg-tint-hover px-4 py-2 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform]"
          >
            Create Your Own
          </Link>
        </header>

        <AchievementDetail achievementId={id} />
      </div>
    </div>
  );
}
