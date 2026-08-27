"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { VaultSidebarLayout } from "~/components/vault/VaultSidebarLayout";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import {
  SystemRestart as Loader2,
  Trophy as Award,
  OpenNewWindow as ExternalLink,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { TextureOverlay } from "~/components/ui/texture-overlay";
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

  // Get all master achievements with status for current user's country
  const { data: achievements, isLoading } = api.achievements.getAllWithStatus.useQuery(
    { countryId: userProfile?.countryId || undefined },
    { enabled: !!userProfile?.countryId }
  );

  const utils = api.useUtils();
  const { mutate: syncAchievements } = api.achievements.syncMyCollectorAchievements.useMutation({
    onSuccess: () => {
      void utils.achievements.getAllWithStatus.invalidate();
    },
  });

  useEffect(() => {
    if (userProfile?.countryId) {
      syncAchievements();
    }
  }, [userProfile?.countryId, syncAchievements]);

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
        {/* Country Profile Header Card */}
        {isMounted && userProfile && (
          <div className="border-border/60 bg-card/75 dark:border-border/40 dark:bg-card/60 relative overflow-hidden rounded-3xl border border-t-white/20 p-6 shadow-xl backdrop-blur-2xl transition-all duration-300 dark:border-t-white/10">
            <TextureOverlay texture="dots" opacity={0.03} />

            {/* Country Flag Background Wash & Watermark */}
            {countryFlagUrl && (
              <>
                <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-10 select-none dark:opacity-15">
                  <img
                    src={countryFlagUrl}
                    alt=""
                    className="h-full w-full object-cover object-center blur-2xl saturate-[0.4]"
                  />
                  <div className="from-card via-card/85 to-card absolute inset-0 bg-gradient-to-r" />
                </div>
                <div className="pointer-events-none absolute -top-12 -right-12 h-64 w-64 overflow-hidden opacity-10 transition-all duration-700 select-none dark:opacity-20">
                  <img
                    src={countryFlagUrl}
                    alt=""
                    className="h-full w-full rounded-full object-cover object-center mix-blend-luminosity blur-[1px] filter dark:mix-blend-normal"
                  />
                  <div className="via-card/60 to-card absolute inset-0 bg-gradient-to-l from-transparent" />
                </div>
              </>
            )}

            <div className="relative z-10 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h1 className="text-foreground flex flex-wrap items-center gap-3 text-2xl font-black tracking-tight">
                    <span>Achievements</span>
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-600 backdrop-blur-md dark:text-amber-400">
                      {completionPercent}% Mastered
                    </span>
                  </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Global Leaderboards Badge Link */}
                  <Link
                    href="/leaderboards"
                    className="border-border/60 bg-muted/50 text-foreground/80 hover:bg-muted/80 hover:text-foreground flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold backdrop-blur-md transition-all active:scale-95"
                  >
                    <Award className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                    <span>Global Leaderboards</span>
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </Link>

                  {/* Showcase Cabinet Toggle */}
                  <div className="border-border/60 bg-muted/40 flex items-center gap-2 rounded-full border px-3.5 py-1.5 backdrop-blur-md">
                    <Label
                      htmlFor="cabinet-toggle"
                      className="text-muted-foreground hover:text-foreground cursor-pointer text-[10px] font-extrabold tracking-wider uppercase select-none"
                    >
                      Showcase Shelf
                    </Label>
                    <Switch
                      id="cabinet-toggle"
                      checked={showCabinet}
                      onCheckedChange={toggleCabinet}
                      className="data-[state=checked]:bg-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Metrics Summary Row */}
              <div className="border-border/50 grid grid-cols-1 gap-4 border-t pt-5 sm:grid-cols-3">
                <div className="space-y-1">
                  <div className="text-foreground text-3xl font-black tracking-tight">
                    <NumberFlow value={totalUnlocked} />
                  </div>
                  <div className="text-muted-foreground text-[10px] font-extrabold tracking-wider uppercase">
                    Achievements Unlocked
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                    <span className="flex items-baseline gap-1">
                      <NumberFlow value={gameplayPoints} />
                      <span className="text-sm font-bold text-emerald-600/80 dark:text-emerald-400/80">
                        pts
                      </span>
                    </span>
                  </div>
                  <div className="text-muted-foreground text-[10px] font-extrabold tracking-wider uppercase">
                    Achievement Points
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-3xl font-black tracking-tight text-purple-600 dark:text-purple-400">
                    {globalRank > 0 ? (
                      <span className="flex items-baseline">
                        #<NumberFlow value={globalRank} />
                      </span>
                    ) : (
                      "—"
                    )}
                  </div>
                  <div className="text-muted-foreground text-[10px] font-extrabold tracking-wider uppercase">
                    Global Rank
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Showcase Cabinet */}
        {!isLoading && showCabinet && <ShowcaseTab achievements={achievements} />}

        {/* Loader */}
        {isLoading && (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500 dark:text-amber-400" />
          </div>
        )}

        {/* Achievement Catalog */}
        {!isLoading && <AllAchievementsTab achievements={achievements} />}
      </div>
    </VaultSidebarLayout>
  );
}
