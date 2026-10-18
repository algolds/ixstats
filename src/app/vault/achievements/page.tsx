"use client";

import React, { useEffect } from "react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { AchievementsTabs } from "~/components/achievements/AchievementsTabs";
import { VaultLorewardsPanel } from "~/components/vault/sections/VaultLorewardsPanel";

export default function VaultAchievementsPage() {
  useEffect(() => {
    document.title = "Achievements - IxStates";
  }, []);

  const { user } = useUser();
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

  // Achievements belong to the account; the country (if any) only adds country achievements
  const hasProfile = !!userProfile;
  const { data: achievements } = api.achievements.getAllWithStatus.useQuery(
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

  return (
    // pt-14: the tabs are the first row and the page has no header toolbar, so it clears Halo's floating band itself.
    <div className="space-y-6 pt-14">
      {/* The page's title for assistive tech; the sidebar's Achievements row names it on screen. */}
      <h1 className="sr-only">Achievements</h1>
      <AchievementsTabs
        achievements={achievements}
        isLoading={achievements === undefined}
        lorewardsPanel={<VaultLorewardsPanel />}
      />
    </div>
  );
}
