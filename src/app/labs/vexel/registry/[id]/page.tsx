"use client";

import { use } from "react";
import Link from "next/link";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import AchievementDetail from "~/components/maps/vexel/registry/AchievementDetail";

interface VexelRegistryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function VexelRegistryDetailPage({ params }: VexelRegistryDetailPageProps) {
  const { id } = use(params);

  return (
    <div className="bg-grouped text-label min-h-screen p-8 font-sans">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Roll of arms"
          back={{ href: "/labs/vexel/registry", label: "Registry" }}
          actions={
            <Button asChild size="sm">
              <Link href="/labs/vexel">Create your own</Link>
            </Button>
          }
        />

        <AchievementDetail achievementId={id} />
      </div>
    </div>
  );
}
