"use client";

import React, { useEffect } from "react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { PageHeader } from "~/components/shell/PageHeader";
import { Card } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { AchievementsTabs } from "~/components/achievements/AchievementsTabs";
import { VaultLorewardsPanel } from "~/components/vault/sections/VaultLorewardsPanel";

export default function VaultAchievementsPage() {
  useEffect(() => {
    document.title = "Achievements - IxStates";
  }, []);

  const { user } = useUser();
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );

  // Achievements belong to the account; the country (if any) only adds country achievements
  const hasProfile = !!userProfile;
  const {
    data: achievements,
    isLoading: achievementsLoading,
    isError: achievementsError,
    refetch: refetchAchievements,
  } = api.achievements.getAllWithStatus.useQuery(
    { countryId: userProfile?.countryId || undefined },
    { enabled: hasProfile }
  );
  const utils = api.useUtils();
  const { mutate: syncAchievements } = api.achievements.syncMyCollectorAchievements.useMutation({
    onSuccess: () => {
      void utils.achievements.getAllWithStatus.invalidate();
      void utils.achievements.getMySummary.invalidate();
      void utils.achievements.getNextUnlock.invalidate();
    },
  });

  useEffect(() => {
    if (hasProfile) {
      syncAchievements();
    }
  }, [hasProfile, userProfile?.countryId, syncAchievements]);

  const activeCatalogue = achievements?.filter((a) => !("isLegacy" in a && a.isLegacy)) ?? [];
  const unlockedCount = activeCatalogue.filter((a) => a.isUnlocked).length;
  const totalCount = activeCatalogue.length;
  const totalPoints =
    achievements?.filter((a) => a.isUnlocked).reduce((sum, a) => sum + (a.points ?? 0), 0) ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Achievements"
        subtitle="Collector, lore and nation milestones across your Vault."
        back={{ href: "/vault", label: "Vault" }}
        bleed
      />

      {user && achievements && totalCount > 0 && (
        <Card padding="md" className="space-y-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-headline text-label tabular-nums">
              {unlockedCount.toLocaleString()} of {totalCount.toLocaleString()} unlocked
            </span>
            <span className="text-footnote text-label-secondary tabular-nums">
              {totalPoints.toLocaleString()} pts earned
            </span>
          </div>
          <Progress
            value={unlockedCount}
            max={totalCount}
            aria-label="Achievements unlocked"
            className="h-1.5"
          />
        </Card>
      )}

      <AchievementsTabs
        achievements={achievements}
        isLoading={Boolean(user) && (profileLoading || achievementsLoading)}
        isError={achievementsError}
        onRetry={() => void refetchAchievements()}
        // Signed out, the catalogue never loads: no achievements rather than a skeleton that never ends.
        lorewardsPanel={<VaultLorewardsPanel achievements={user ? achievements : []} />}
      />
    </div>
  );
}
