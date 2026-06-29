"use client";

import React, { useState, useEffect } from "react";
import { VaultSidebarLayout } from "~/components/vault/VaultSidebarLayout";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { cn } from "~/lib/utils";
import {
  CutoutCard,
  CutoutCardContent,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";

// Tab Subcomponents
import { QuestTreesTab } from "~/components/achievements/tabs/QuestTreesTab";
import { AllAchievementsTab } from "~/components/achievements/tabs/AllAchievementsTab";
import { WikiLoreTab } from "~/components/achievements/tabs/WikiLoreTab";
import { ShowcaseTab } from "~/components/achievements/tabs/ShowcaseTab";
import { LeaderboardTab } from "~/components/achievements/tabs/LeaderboardTab";

export default function AchievementsPage() {
  useEffect(() => {
    document.title = "Achievements - IxStats";
  }, []);

  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<string>("quest-trees");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showCabinet, setShowCabinet] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ixstats-show-achievements-cabinet");
      return stored !== "false";
    }
    return true;
  });

  const toggleCabinet = (checked: boolean) => {
    setShowCabinet(checked);
    if (typeof window !== "undefined") {
      localStorage.setItem("ixstats-show-achievements-cabinet", String(checked));
    }
  };

  // Dynamic Winners Calendar States (Default: June 2026)
  const [calendarYear, setCalendarYear] = useState<number>(2026);
  const [calendarMonth, setCalendarMonth] = useState<number>(6);

  // Read tab query parameter on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (
        tabParam &&
        ["quest-trees", "all-achievements", "wiki-lore", "leaderboard"].includes(tabParam)
      ) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  // Get user profile
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });
  const isAdmin =
    userProfile?.role?.name === "owner" ||
    userProfile?.role?.name === "admin" ||
    userProfile?.role?.name === "staff";

  // Get OOL stats
  const { data: lorewardStats } = api.lorewards.getUserStats.useQuery(
    { username: userProfile?.wikiUsername || "" },
    { enabled: !!userProfile?.wikiUsername }
  );

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

  // Automatically trigger sync on mount if country context is ready
  useEffect(() => {
    if (userProfile?.countryId) {
      syncAchievements();
    }
  }, [userProfile?.countryId, syncAchievements]);

  // Get global leaderboard
  const { data: leaderboard } = api.achievements.getLeaderboard.useQuery({
    limit: 20,
    category: selectedCategory !== "all" ? selectedCategory : undefined,
  });

  // UFC-Style Leaderboard
  const {
    data: ufcLeaderboard,
    isLoading: isUfcLoading,
    refetch: refetchUfc,
  } = api.lorewards.getUfcLeaderboard.useQuery(undefined, { enabled: activeTab === "wiki-lore" });

  // Winners Calendar Query
  const { data: winnersCalendar } = api.lorewards.getWinnersCalendar.useQuery(
    { year: calendarYear, month: calendarMonth },
    { enabled: activeTab === "wiki-lore" }
  );

  const unlockedAchievements = achievements?.filter((a) => a.isUnlocked) || [];
  const totalPoints = unlockedAchievements.reduce((sum, a) => sum + (a.points || 10), 0);
  const totalUnlocked = unlockedAchievements.length;

  const unlockedStandard = unlockedAchievements.filter(
    (a) => a.triggerType !== "OOL_MEDAL" && a.triggerType !== "WIKI_AWARD"
  );
  const gameplayPoints = unlockedStandard.reduce((sum, a) => sum + (a.points || 10), 0);
  const loreScore = lorewardStats?.stats?.totalScore || 0;

  return (
    <VaultSidebarLayout activeSection="achievements">
      <div className="space-y-6">
        {/* User Stats Card */}
        {userProfile && (
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
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-foreground text-lg font-bold">Your Achievement Profile</h2>
                  <p className="text-muted-foreground text-xs">{userProfile.country?.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="cabinet-toggle"
                      className="text-muted-foreground cursor-pointer text-[10px] font-bold tracking-wider uppercase select-none"
                    >
                      Showcase Cabinet
                    </Label>
                    <Switch
                      id="cabinet-toggle"
                      checked={showCabinet}
                      onCheckedChange={toggleCabinet}
                      className="data-[state=checked]:bg-purple-600"
                    />
                  </div>
                </div>
              </div>

              <div className="border-border/50 grid grid-cols-2 gap-4 border-t pt-4 md:grid-cols-4 dark:border-white/5">
                <div className="space-y-1">
                  <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
                    {totalUnlocked}
                  </div>
                  <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Total Unlocked
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-3xl font-black text-green-600 dark:text-green-400">
                    {gameplayPoints} pts
                  </div>
                  <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Achievement Points
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
                    {loreScore} pts
                  </div>
                  <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Lore Score
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-purple-650 text-3xl font-black dark:text-purple-400">
                    #
                    {leaderboard?.findIndex(
                      (l: { countryId: string }) => l.countryId === userProfile.countryId
                    )! + 1 || "—"}
                  </div>
                  <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Global Rank
                  </div>
                </div>
              </div>
            </CutoutCardContent>
          </CutoutCard>
        )}

        {/* Showcase Cabinet (Toggleable) */}
        {!isLoading && showCabinet && <ShowcaseTab achievements={achievements} />}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="border-border/50 mb-4 rounded-xl border bg-black/5 p-1 dark:border-white/5 dark:bg-black/40">
            <TabsTrigger
              value="quest-trees"
              className="text-muted-foreground data-[state=active]:text-foreground px-3 py-1.5 text-xs font-bold data-[state=active]:dark:text-white"
            >
              Quest Paths
            </TabsTrigger>
            <TabsTrigger
              value="all-achievements"
              className="text-muted-foreground data-[state=active]:text-foreground px-3 py-1.5 text-xs font-bold data-[state=active]:dark:text-white"
            >
              Achievements
            </TabsTrigger>
            <TabsTrigger
              value="wiki-lore"
              className="text-muted-foreground data-[state=active]:text-foreground px-3 py-1.5 text-xs font-bold data-[state=active]:dark:text-white"
            >
              Lorewards
            </TabsTrigger>
            <TabsTrigger
              value="leaderboard"
              className="text-muted-foreground data-[state=active]:text-foreground px-3 py-1.5 text-xs font-bold data-[state=active]:dark:text-white"
            >
              Global Leaderboards
            </TabsTrigger>
          </TabsList>

          {/* Loader */}
          {isLoading && (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="text-amber-555 h-8 w-8 animate-spin" />
            </div>
          )}

          {!isLoading && (
            <>
              {/* Quest Trees Tab */}
              <QuestTreesTab achievements={achievements} />

              {/* All Achievements Tab */}
              <AllAchievementsTab
                achievements={achievements}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
              />

              {/* Wiki & Lore Tab */}
              <WikiLoreTab
                ufcLeaderboard={ufcLeaderboard}
                isUfcLoading={isUfcLoading}
                winnersCalendar={winnersCalendar}
                calendarYear={calendarYear}
                setCalendarYear={setCalendarYear}
                calendarMonth={calendarMonth}
                setCalendarMonth={setCalendarMonth}
                isAdmin={isAdmin}
              />

              {/* Leaderboard Tab */}
              <LeaderboardTab leaderboard={leaderboard} />
            </>
          )}
        </Tabs>
      </div>
    </VaultSidebarLayout>
  );
}
