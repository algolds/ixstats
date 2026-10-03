"use client";

import React, { useEffect } from "react";
import { VaultSidebarLayout } from "~/components/vault/VaultSidebarLayout";
import { LeaderboardTab } from "~/components/achievements/tabs/LeaderboardTab";
import { Trophy } from "iconoir-react";
import { CutoutCard } from "~/components/ui/cutout-card";

export default function LeaderboardsPage() {
  useEffect(() => {
    document.title = "Global Leaderboards";
  }, []);

  return (
    <VaultSidebarLayout activeSection="leaderboards">
      <div className="space-y-6">
        {/* Page Hero Header */}
        {/* v2 (c5c6b382): a hero CutoutCard over a fine grid texture — now the glass hero tier
            with the domain glow. */}
        <CutoutCard variant="glass" trackPointerHover={false}>
          <div className="relative flex items-center gap-4 p-6">
            <div className="border-yellow/30 bg-yellow/10 text-yellow rounded-card flex size-12 items-center justify-center border">
              <Trophy aria-hidden className="size-6" />
            </div>
            <h1 className="text-large-title text-label">Global Leaderboards</h1>
          </div>
        </CutoutCard>

        {/* The standalone <LeaderboardTab /> inside <VaultSidebarLayout />. */}
        <LeaderboardTab standalone />
      </div>
    </VaultSidebarLayout>
  );
}
