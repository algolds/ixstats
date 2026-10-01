"use client";

import React, { useEffect } from "react";
import { VaultSidebarLayout } from "~/components/vault/VaultSidebarLayout";
import { LeaderboardTab } from "~/components/achievements/tabs/LeaderboardTab";
import { Trophy } from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";

export default function LeaderboardsPage() {
  useEffect(() => {
    document.title = "Global Leaderboards";
  }, []);

  return (
    <VaultSidebarLayout activeSection="leaderboards">
      <div className="space-y-6">
        {/* Page Hero Header */}
        <FacetCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="bg-yellow/10 text-yellow rounded-card flex size-12 items-center justify-center">
              <Trophy aria-hidden className="size-6" />
            </div>
            <h1 className="text-large-title text-label">Global Leaderboards</h1>
          </div>
        </FacetCard>

        {/* The standalone <LeaderboardTab /> inside <VaultSidebarLayout />. */}
        <LeaderboardTab standalone />
      </div>
    </VaultSidebarLayout>
  );
}
