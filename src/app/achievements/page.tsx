"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { VaultSidebarLayout } from "~/components/vault/VaultSidebarLayout";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Trophy as Award } from "iconoir-react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { FacetCard } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { FlagWatermark } from "~/components/ui/facet";
import NumberFlow from "~/components/ui/number-flow";
import { useFlag } from "~/hooks/useUnifiedFlags";

// Subcomponents
import { AllAchievementsTab } from "~/components/achievements/tabs/AllAchievementsTab";
import { ShowcaseTab } from "~/components/achievements/tabs/ShowcaseTab";

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

  const { flagUrl: simpleFlagUrl } = useFlag(userProfile?.country?.name);
  const country = userProfile?.country;
  const countryFlagUrl =
    (country && "flagUrl" in country && typeof country.flagUrl === "string"
      ? country.flagUrl
      : null) ??
    (country && "flag" in country && typeof country.flag === "string" ? country.flag : null) ??
    simpleFlagUrl;

  return (
    <VaultSidebarLayout activeSection="achievements">
      <div className="space-y-6">
        {/* The page title is the hero's h1; without a profile (signed out, loading, no country)
            there is no hero, so the h1 is visually hidden — one h1 on every render. */}
        {!(isMounted && userProfile) && <h1 className="sr-only">Achievements</h1>}

        {/* Country profile header card */}
        {isMounted && userProfile && (
          // v2 (c5c6b382): the glass hero with the dot texture and the flag watermark.
          <FacetCard
            variant="glass"
            glow
            padding="lg"
            texture="dots"
            textureOpacity={0.03}
            className="overflow-hidden"
          >
            <FlagWatermark src={countryFlagUrl} />

            <div className="relative space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-label text-title-1 flex flex-wrap items-center gap-3">
                  <span>Achievements</span>
                  <Badge variant="yellow">
                    <span className="font-data tabular-nums">{completionPercent}%</span> mastered
                  </Badge>
                </h1>

                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild variant="gray" size="sm" className="rounded-full">
                    <Link href="/leaderboards">
                      <Award aria-hidden className="text-yellow" />
                      <span>Global leaderboards</span>
                    </Link>
                  </Button>

                  {/* Showcase shelf toggle */}
                  <div className="bg-fill-3 flex h-(--control-height-sm) items-center gap-2 rounded-full px-3">
                    <Label
                      htmlFor="cabinet-toggle"
                      className="text-label text-footnote cursor-pointer font-medium select-none"
                    >
                      Showcase shelf
                    </Label>
                    <Switch
                      id="cabinet-toggle"
                      checked={showCabinet}
                      onCheckedChange={toggleCabinet}
                    />
                  </div>
                </div>
              </div>

              {/* Metrics summary */}
              <div className="border-separator grid grid-cols-1 gap-4 border-t pt-5 sm:grid-cols-3">
                <Stat label="Achievements unlocked" value={<NumberFlow value={totalUnlocked} />} />
                <Stat
                  label="Achievement points"
                  value={
                    <span className="flex items-baseline gap-1">
                      <span className="text-success-ink">
                        <NumberFlow value={gameplayPoints} />
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
                        #<NumberFlow value={globalRank} />
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
              </div>
            </div>
          </FacetCard>
        )}

        {/* Showcase Cabinet */}
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

        {/* Achievement Catalog */}
        {!isLoading && <AllAchievementsTab achievements={achievements} />}
      </div>
    </VaultSidebarLayout>
  );
}
