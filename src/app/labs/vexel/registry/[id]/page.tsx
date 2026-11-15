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
    <div className="px-4 py-4 sm:px-6 sm:py-6">
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
