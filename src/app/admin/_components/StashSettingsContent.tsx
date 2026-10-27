"use client";
// src/app/admin/_components/StashSettingsContent.tsx
// Stash and WikiOS Article Caching Administration Panel

import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { Card } from "~/components/ui/card";

export function StashSettingsContent() {
  usePageTitle({ title: "Admin - Stash Settings" });

  // Stash limits and storage switches were never enforced (WK-11), so only usage is shown.
  const { data: stats, isLoading: statsLoading } = api.admin.getStashStats.useQuery();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stash and wiki caching"
        subtitle="WikiOS article stash and highlight usage."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-label-secondary text-eyebrow">Total stashed articles</p>
          {statsLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="text-label text-title-2 mt-1 tabular-nums">
              {stats?.totalStashes.toLocaleString() ?? "—"}
            </p>
          )}
        </Card>

        <Card className="p-4">
          <p className="text-label-secondary text-eyebrow">Text highlight marks</p>
          {statsLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="text-title-2 text-purple mt-1 tabular-nums">
              {stats?.totalHighlights.toLocaleString() ?? "—"}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
