"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { VaultSidebarLayout } from "~/components/vault/VaultSidebarLayout";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Loader2, Award, ExternalLink } from "lucide-react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import NumberFlow from "~/components/ui/number-flow";
import { useSimpleFlag } from "~/hooks/useSimpleFlag";

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

  const { flagUrl: simpleFlagUrl } = useSimpleFlag(userProfile?.country?.name);
  const countryFlagUrl =
    (userProfile?.country as any)?.flagUrl || (userProfile?.country as any)?.flag || simpleFlagUrl;

  return (
    <VaultSidebarLayout activeSection="achievements">
      <div className="space-y-6">
        {/* Country Profile Header Card */}
        {isMounted && userProfile && (
          <div className="relative overflow-hidden rounded-3xl border border-white/10 border-t-white/20 bg-slate-950/70 p-6 shadow-2xl backdrop-blur-2xl transition-all duration-300 dark:border-white/12 dark:border-t-white/25 dark:bg-black/60">
            <TextureOverlay texture="dots" opacity={0.03} />

            {/* Country Flag Background Wash & Watermark */}
            {countryFlagUrl && (
              <>
                <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-15 select-none dark:opacity-20">
                  <img
                    src={countryFlagUrl}
                    alt=""
                    className="h-full w-full object-cover object-center blur-2xl saturate-[0.4]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950 dark:from-black dark:via-black/80 dark:to-black" />
                </div>
                <div className="pointer-events-none absolute -top-12 -right-12 h-64 w-64 overflow-hidden opacity-15 transition-all duration-700 select-none dark:opacity-20">
                  <img
                    src={countryFlagUrl}
                    alt=""
                    className="h-full w-full rounded-full object-cover object-center mix-blend-luminosity blur-[1px] filter dark:mix-blend-normal"
                  />
                  <div className="absolute inset-0 bg-gradient-to-l from-transparent via-slate-950/60 to-slate-950 dark:via-black/60 dark:to-black" />
                </div>
              </>
            )}

            <div className="relative z-10 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h1 className="flex flex-wrap items-center gap-3 text-2xl font-black tracking-tight text-slate-100">
                    <span>Achievements</span>
                    <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-400 backdrop-blur-md">
                      {completionPercent}% Mastered
                    </span>
                  </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Global Leaderboards Badge Link */}
                  <Link
                    href="/leaderboards"
                    className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-bold text-slate-300 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white active:scale-95"
                  >
                    <Award className="h-3.5 w-3.5 text-amber-400" />
                    <span>Global Leaderboards</span>
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </Link>

                  {/* Showcase Cabinet Toggle */}
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/60 px-3.5 py-1.5 backdrop-blur-md">
                    <Label
                      htmlFor="cabinet-toggle"
                      className="cursor-pointer text-[10px] font-extrabold tracking-wider text-slate-300 uppercase select-none"
                    >
                      Showcase Shelf
                    </Label>
                    <Switch
                      id="cabinet-toggle"
                      checked={showCabinet}
                      onCheckedChange={toggleCabinet}
                      className="data-[state=checked]:bg-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Metrics Summary Row */}
              <div className="grid grid-cols-1 gap-4 border-t border-white/10 pt-5 sm:grid-cols-3">
                <div className="space-y-1">
                  <div className="text-3xl font-black tracking-tight text-slate-100">
                    <NumberFlow value={totalUnlocked} />
                  </div>
                  <div className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
                    Achievements Unlocked
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-3xl font-black tracking-tight text-emerald-400">
                    <span className="flex items-baseline gap-1">
                      <NumberFlow value={gameplayPoints} />
                      <span className="text-sm font-bold text-emerald-400/80">pts</span>
                    </span>
                  </div>
                  <div className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
                    Achievement Points
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-3xl font-black tracking-tight text-purple-400">
                    {globalRank > 0 ? (
                      <span className="flex items-baseline">
                        #<NumberFlow value={globalRank} />
                      </span>
                    ) : (
                      "—"
                    )}
                  </div>
                  <div className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
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
            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          </div>
        )}

        {/* Achievement Catalog */}
        {!isLoading && <AllAchievementsTab achievements={achievements} />}
      </div>
    </VaultSidebarLayout>
  );
}
