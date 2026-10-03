"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { VaultSidebarLayout } from "~/components/vault/VaultSidebarLayout";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Trophy as Award } from "iconoir-react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { NumberFlowDisplay } from "~/components/ui/number-flow";

// Subcomponents
import { AllAchievementsTab } from "~/components/achievements/tabs/AllAchievementsTab";
import { ShowcaseTab } from "~/components/achievements/tabs/ShowcaseTab";
import { Card } from "~/components/ui/card";
import { PageHeader } from "~/components/shell/PageHeader";

export default function AchievementsPage() {
  useEffect(() => {
    document.title = "Achievements - IxStats";
  }, []);

  const { user } = useUser();
  const [isMounted, setIsMounted] = useState(false);
  const [showCabinet, setShowCabinet] = useState<boolean>(true);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ixstats-show-achievements-cabinet");
      if (stored === "false") {
        setShowCabinet(false);
      }
    }
  }, []);

  const toggleCabinet = (checked: boolean) => {
    setShowCabinet(checked);
    if (typeof window !== "undefined") {
      localStorage.setItem("ixstats-show-achievements-cabinet", String(checked));
    }
  };

  // Get user profile
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

  // Achievements belong to the account; the country (if any) only adds country achievements
  const hasProfile = !!userProfile;
  const { data: achievements, isLoading } = api.achievements.getAllWithStatus.useQuery(
    { countryId: userProfile?.countryId || undefined },
    { enabled: hasProfile }
  );

  const utils = api.useUtils();
  const { mutate: syncAchievements } = api.achievements.syncMyCollectorAchievements.useMutation({
    onSuccess: () => {
      void utils.achievements.getAllWithStatus.invalidate();
    },
  });

  useEffect(() => {
    if (hasProfile) {
      syncAchievements();
    }
  }, [hasProfile, userProfile?.countryId, syncAchievements]);

  // Get global leaderboard
  const { data: leaderboard } = api.achievements.getLeaderboard.useQuery({
    limit: 20,
  });

  const unlockedAchievements = achievements?.filter((a) => a.isUnlocked) || [];
  const totalUnlocked = unlockedAchievements.length;
  const totalAvailable = achievements?.length || 1;
  const completionPercent = Math.round((totalUnlocked / totalAvailable) * 100);

  const unlockedStandard = unlockedAchievements.filter(
    (a) => a.triggerType !== "OOL_MEDAL" && a.triggerType !== "WIKI_AWARD"
  );
  const gameplayPoints = unlockedStandard.reduce((sum, a) => sum + (a.points || 10), 0);

  const rankIndex = leaderboard?.findIndex(
    (l: { countryId: string }) => l.countryId === userProfile?.countryId
  );
  const globalRank = rankIndex !== undefined && rankIndex !== -1 ? rankIndex + 1 : 0;

  return (
    <VaultSidebarLayout activeSection="achievements">
      <div className="space-y-6">
        <PageHeader
          title="Achievements"
          subtitle={isMounted && userProfile ? `${completionPercent}% mastered` : undefined}
          actions={
            <>
              <Button asChild variant="secondary" size="sm">
                <Link href="/leaderboards">
                  <Award aria-hidden />
                  <span>Global leaderboards</span>
                </Link>
              </Button>

              <div className="bg-fill-3 rounded-control-sm flex h-(--control-height-sm) items-center gap-2 px-3">
                <Label
                  htmlFor="cabinet-toggle"
                  className="text-label text-footnote cursor-pointer font-medium select-none"
                >
                  Showcase shelf
                </Label>
                <Switch id="cabinet-toggle" checked={showCabinet} onCheckedChange={toggleCabinet} />
              </div>
            </>
          }
        />

        {isMounted && userProfile && (
          <Card padding="lg">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Stat
                label="Achievements unlocked"
                value={<NumberFlowDisplay value={totalUnlocked} />}
              />
              <Stat
                label="Achievement points"
                value={
                  <span className="flex items-baseline gap-1">
                    <span className="text-success-ink">
                      <NumberFlowDisplay value={gameplayPoints} />
                    </span>
                    <span className="text-footnote text-label-secondary">pts</span>
                  </span>
                }
              />
              <Stat
                label="Global rank"
                value={
                  globalRank > 0 ? (
                    <span className="flex items-baseline">
                      #<NumberFlowDisplay value={globalRank} />
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
            </div>
          </Card>
        )}

        {/* Showcase shelf */}
        {!isLoading && showCabinet && <ShowcaseTab achievements={achievements} />}

        {/* Loading */}
        {isLoading && (
          <div aria-busy className="space-y-4">
            <Skeleton className="rounded-card h-40" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="rounded-card h-48" />
              <Skeleton className="rounded-card h-48" />
              <Skeleton className="rounded-card h-48" />
            </div>
          </div>
        )}

        {/* Catalog */}
        {!isLoading && <AllAchievementsTab achievements={achievements} />}
      </div>
    </VaultSidebarLayout>
  );
}
