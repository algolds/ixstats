"use client";

import React, { useEffect } from "react";
import { VaultSidebarLayout } from "~/components/vault/VaultSidebarLayout";
import { LeaderboardTab } from "~/components/achievements/tabs/LeaderboardTab";
import { Trophy } from "iconoir-react";
import {
  CutoutCard,
  CutoutCardContent,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { cn } from "~/lib/utils";

export default function LeaderboardsPage() {
  useEffect(() => {
    document.title = "Global Leaderboards";
  }, []);

  return (
    <VaultSidebarLayout activeSection="leaderboards">
      <div className="space-y-6">
        {/* Page Hero Header */}
        <CutoutCard
          className={cn(
            cutoutCardSurfaceClassName,
            "border-border/50 bg-card/65 relative overflow-hidden rounded-2xl shadow-lg backdrop-blur-md"
          )}
          texture="chevron"
          textureOpacity={0.04}
          trackPointerHover={false}
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:32px_32px] opacity-20 dark:bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] dark:opacity-25" />
          <CutoutCardContent className="relative z-10 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-500 dark:text-amber-400">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-foreground text-2xl font-black">Global Leaderboards</h1>
                </div>
              </div>
            </div>
          </CutoutCardContent>
        </CutoutCard>

        {/* 
          Next.js App Router Page Shell
          Assembles the standalone <LeaderboardTab /> component inside <VaultSidebarLayout />.
        */}
        <LeaderboardTab standalone />
      </div>
    </VaultSidebarLayout>
  );
}
