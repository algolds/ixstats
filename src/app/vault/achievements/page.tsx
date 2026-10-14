"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Trophy as Award } from "iconoir-react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { Button } from "~/components/ui/button";
import { Stat } from "~/components/ui/stat";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { Card } from "~/components/ui/card";
import { PageHeader } from "~/components/shell/PageHeader";
import { AchievementsTabs } from "~/components/achievements/AchievementsTabs";

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
  const { data: summary } = api.achievements.getMySummary.useQuery(undefined, {
    enabled: hasProfile,
  });

  const utils = api.useUtils();
  const { mutate: syncAchievements } = api.achievements.syncMyCollectorAchievements.useMutation({
    onSuccess: () => {
      void utils.achievements.getAllWithStatus.invalidate();
      void utils.achievements.getMySummary.invalidate();
    },
  });

  useEffect(() => {
    if (hasProfile) {
      syncAchievements();
    }
  }, [hasProfile, userProfile?.countryId, syncAchievements]);

  const completionPercent = summary
    ? Math.round((summary.unlocked / Math.max(summary.activeTotal, 1)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Achievements"
        subtitle={summary ? `${completionPercent}% mastered` : undefined}
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/leaderboards">
              <Award aria-hidden />
              <span>Global leaderboards</span>
            </Link>
          </Button>
        }
      />

      {summary && (
        <Card padding="lg">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat
              label="Achievements unlocked"
              value={<NumberFlowDisplay value={summary.unlocked} />}
              hint={`of ${summary.activeTotal}`}
            />
            <Stat
              label="Achievement points"
              value={
                <span className="flex items-baseline gap-1">
                  <span className="text-success-ink">
                    <NumberFlowDisplay value={summary.points} />
                  </span>
                  <span className="text-footnote text-label-secondary">pts</span>
                </span>
              }
            />
            <Stat
              label="Rank"
              value={
                summary.rank ? (
                  <span className="flex items-baseline">
                    #<NumberFlowDisplay value={summary.rank} />
                  </span>
                ) : (
                  "Unranked"
                )
              }
            />
          </div>
        </Card>
      )}

      <AchievementsTabs achievements={achievements} isLoading={achievements === undefined} />
    </div>
  );
}
