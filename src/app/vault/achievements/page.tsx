"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WarningCircle } from "iconoir-react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import {
  AchievementsSummaryCard,
  RarestEarnedMedalsShelf,
} from "~/components/achievements/AchievementsSummaryCard";
import { VaultLorewardsPanel } from "~/components/achievements/VaultLorewardsPanel";
import { AllAchievementsTab } from "~/components/achievements/tabs/AllAchievementsTab";

type AchievementTab = "achievements" | "lorewards";

const ACHIEVEMENT_OPTIONS = [
  { value: "achievements", label: "Achievements" },
  { value: "lorewards", label: "Lorewards" },
] as const satisfies ReadonlyArray<{ value: AchievementTab; label: string }>;

export default function VaultAchievementsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isLorewards = searchParams?.get("tab") === "lorewards";
  const activeTab: AchievementTab = isLorewards ? "lorewards" : "achievements";

  useEffect(() => {
    document.title = isLorewards ? "Lorewards - IxStates" : "Achievements - IxStates";
  }, [isLorewards]);

  const { user } = useUser();
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    undefined,
    { enabled: Boolean(user?.id) }
  );

  const hasProfile = Boolean(userProfile);
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

  const isCatalogueLoading = Boolean(user) && (profileLoading || achievementsLoading);

  return (
    <div className="space-y-6">
      <PageHeader
        title={isLorewards ? "Lorewards" : "Achievements"}
        subtitle={
          isLorewards
            ? "Annual community writing honours, peer nominations, and wiki citations."
            : "Platform milestones, simulation mastery, and collector honours."
        }
        bleed
        actions={
          <SegmentedControl
            aria-label="Achievement categories"
            size="sm"
            value={activeTab}
            onValueChange={(next) =>
              router.replace(
                next === "lorewards" ? "/vault/achievements?tab=lorewards" : "/vault/achievements",
                { scroll: false }
              )
            }
            options={ACHIEVEMENT_OPTIONS}
          />
        }
      />

      {isLorewards ? (
        <VaultLorewardsPanel achievements={user ? achievements : []} />
      ) : (
        <>
          {user && achievements && <AchievementsSummaryCard achievements={achievements} />}

          {user && achievements && <RarestEarnedMedalsShelf achievements={achievements} />}

          {achievementsError ? (
            <Card>
              <EmptyState
                icon={<WarningCircle />}
                title="Achievements didn't load"
                message="Please try again in a moment."
                action={
                  <Button variant="secondary" size="sm" onClick={() => void refetchAchievements()}>
                    Try again
                  </Button>
                }
              />
            </Card>
          ) : isCatalogueLoading ? (
            <div aria-busy className="space-y-3">
              <Skeleton className="rounded-control-sm h-9 max-w-md" />
              <Skeleton className="rounded-row h-64" />
            </div>
          ) : (
            <AllAchievementsTab achievements={achievements} />
          )}
        </>
      )}
    </div>
  );
}
