"use client";

import React, { useState, useEffect } from "react";
import { VaultSidebarLayout } from "~/components/vault/VaultSidebarLayout";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Trophy,
  Star,
  Medal,
  Crown,
  Sparkles,
  TrendingUp,
  Wifi,
  WifiOff,
  Shield,
  Landmark,
  BookOpen,
  Lock,
  Globe,
  Loader2,
  Layers,
  Package,
} from "lucide-react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { cn } from "~/lib/utils";
import Link from "next/link";
import { useAchievementNotifications } from "~/hooks/useAchievementNotifications";
import { GradientHeading } from "~/components/ui/gradient-heading";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { TextureCard, TextureCardContent } from "~/components/ui/texture-card";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";

const QUEST_PATHS = [
  {
    name: "Merchant Path",
    description: "Build a massive national economy and GDP",
    icon: TrendingUp,
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    glowColor: "shadow-emerald-500/20 shadow-lg",
    lineColor: "bg-emerald-500/30",
    activeLineColor: "bg-emerald-500",
    nodeColor: "emerald",
    keys: [
      "econ-first-million",
      "econ-millionaire-nation",
      "econ-economic-powerhouse",
      "econ-trillion-club",
      "econ-global-titan",
    ],
  },
  {
    name: "Prosperity Path",
    description: "Improve citizen wealth and economic development",
    icon: Sparkles,
    badgeColor: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    glowColor: "shadow-yellow-500/20 shadow-lg",
    lineColor: "bg-yellow-500/30",
    activeLineColor: "bg-yellow-500",
    nodeColor: "yellow",
    keys: [
      "econ-wealthy-citizens",
      "econ-prosperity-nation",
      "econ-first-world-status",
      "econ-ultra-prosperity",
      "econ-tier-advancement",
    ],
  },
  {
    name: "Warlord Path",
    description: "Expand and fund the armed forces",
    icon: Shield,
    badgeColor: "bg-red-500/10 text-red-650 dark:text-red-400 border-red-500/20",
    glowColor: "shadow-red-500/20 shadow-lg",
    lineColor: "bg-red-500/30",
    activeLineColor: "bg-red-500",
    nodeColor: "red",
    keys: [
      "mil-first-branch",
      "mil-armed-forces",
      "mil-full-spectrum",
      "mil-defense-commitment",
      "mil-strong-defense",
      "mil-military-superpower",
      "mil-standing-army",
      "mil-large-force",
      "mil-massive-force",
      "mil-global-force",
    ],
  },
  {
    name: "Diplomat Path",
    description: "Extend global influence through treaties and trade",
    icon: Globe,
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    glowColor: "shadow-blue-500/20 shadow-lg",
    lineColor: "bg-blue-500/30",
    activeLineColor: "bg-blue-500",
    nodeColor: "blue",
    keys: [
      "dip-first-embassy",
      "dip-diplomatic-network",
      "dip-global-presence",
      "dip-embassy-network",
      "dip-first-treaty",
      "dip-treaty-network",
      "dip-trade-partners",
      "dip-trade-hub",
      "dip-alliance-maker",
      "dip-alliance-network",
    ],
  },
  {
    name: "Statesman Path",
    description: "Develop atomic governance structures",
    icon: Landmark,
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    glowColor: "shadow-purple-500/20 shadow-lg",
    lineColor: "bg-purple-500/30",
    activeLineColor: "bg-purple-500",
    nodeColor: "purple",
    keys: ["gov-first-component", "gov-building-blocks", "gov-sophisticated", "gov-complex-system"],
  },
  {
    name: "Thinker Path",
    description: "Influence public discourse on ThinkPages",
    icon: BookOpen,
    badgeColor: "bg-pink-500/10 text-pink-650 dark:text-pink-400 border-pink-500/20",
    glowColor: "shadow-pink-500/20 shadow-lg",
    lineColor: "bg-pink-500/30",
    activeLineColor: "bg-pink-500",
    nodeColor: "pink",
    keys: [
      "social-first-thinkpage",
      "social-thinkpage-author",
      "social-prolific-author",
      "social-popular",
      "social-trending",
    ],
  },
  {
    name: "Vidmaster Path",
    description: "The ultimate trial of system mastery and dedication",
    icon: Crown,
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    glowColor: "shadow-amber-500/20 shadow-lg",
    lineColor: "bg-amber-500/30",
    activeLineColor: "bg-amber-500",
    nodeColor: "yellow",
    keys: ["vid-lightswitch", "vid-annual", "vid-end-of-days"],
  },
  {
    name: "Lore & Meme Path",
    description: "Nostalgic community jokes, stonks, and wiki archives",
    icon: Trophy,
    badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    glowColor: "shadow-indigo-500/20 shadow-lg",
    lineColor: "bg-indigo-500/30",
    activeLineColor: "bg-indigo-500",
    nodeColor: "purple",
    keys: [
      "meme-stonks",
      "meme-1337",
      "meme-bankruptcy",
      "lore-scholar",
      "lore-collector",
      "meme-ns-ref",
    ],
  },
];

interface QuestPathCardProps {
  path: (typeof QUEST_PATHS)[number];
  achievements: any[] | undefined;
  getRarityColor: (rarity: string) => string;
  getRarityBg: (rarity: string, isUnlocked?: boolean) => string;
}

function QuestPathCard({ path, achievements, getRarityColor, getRarityBg }: QuestPathCardProps) {
  const PathIcon = path.icon;
  // Gather path achievements
  const pathAchievements = path.keys
    .map((key) => achievements?.find((a) => a.key === key))
    .filter(Boolean);

  const unlockedCount = pathAchievements.filter((a) => a.isUnlocked).length;
  const totalCount = pathAchievements.length;
  const progressPercent = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  // Track currently selected node in path card to show detail panel (prevents vertical tooltip cut-off)
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(
    pathAchievements[0]?.key || null
  );
  const selectedNode = pathAchievements.find((a) => a.key === selectedNodeKey);

  return (
    <CutoutCard
      className={cn(
        cutoutCardSurfaceClassName,
        "border-border/50 bg-card/65 relative overflow-hidden rounded-2xl shadow-lg backdrop-blur-md"
      )}
      texture="horizontalLines"
      textureOpacity={0.03}
      trackPointerHover={false}
    >
      <CutoutCardContent className="relative z-10 p-0">
        {/* Path Header */}
        <div className="border-border/40 bg-muted/20 border-b px-6 py-4 dark:border-white/5 dark:bg-white/[0.01]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("rounded-lg border p-2", path.badgeColor)}>
                <PathIcon className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-foreground text-base font-bold">{path.name}</h3>
                <p className="text-muted-foreground text-xs">{path.description}</p>
              </div>
            </div>
            <div className="bg-muted/40 border-border/50 flex items-center gap-3 rounded-lg border px-3 py-1.5 dark:border-white/5 dark:bg-black/40">
              <span className="text-xs font-semibold text-[--intel-gold]">
                {unlockedCount} / {totalCount} ({Math.round(progressPercent)}%)
              </span>
              <div className="bg-muted/50 h-1.5 w-24 overflow-hidden rounded-full dark:bg-white/10">
                <div
                  className={cn(
                    "h-full transition-all duration-500",
                    path.nodeColor === "emerald"
                      ? "bg-emerald-500"
                      : path.nodeColor === "yellow"
                        ? "bg-yellow-500"
                        : path.nodeColor === "red"
                          ? "bg-red-500"
                          : path.nodeColor === "blue"
                            ? "bg-blue-500"
                            : path.nodeColor === "purple"
                              ? "bg-purple-500"
                              : "bg-pink-500"
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Path Nodes container */}
        <div className="scrollbar-thumb-muted-foreground/20 scrollbar-thin overflow-x-auto px-6 py-8">
          <div className="relative flex min-w-max items-center justify-start gap-4 py-4">
            {pathAchievements.map((achievement: any, idx: number) => {
              const isUnlocked = achievement.isUnlocked;
              const nextNode = pathAchievements[idx + 1];
              const isSelected = selectedNodeKey === achievement.key;
              const isSecret =
                (achievement.key.startsWith("vid-") || achievement.key.startsWith("meme-")) &&
                !isUnlocked;

              return (
                <React.Fragment key={achievement.key}>
                  {/* Node */}
                  <div className="group relative z-10 flex flex-col items-center gap-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setSelectedNodeKey(achievement.key)}
                          onMouseEnter={() => setSelectedNodeKey(achievement.key)}
                          className={cn(
                            "relative flex h-16 w-16 items-center justify-center rounded-full border transition-all duration-300 select-none",
                            isUnlocked
                              ? "bg-card cursor-pointer border-amber-500 shadow-lg dark:border-amber-400"
                              : "bg-muted/80 border-border opacity-40",
                            isSelected && "ring-primary ring-offset-background ring-2 ring-offset-2"
                          )}
                        >
                          {isUnlocked ? (
                            <span className="text-3xl transition duration-300 group-hover:scale-110">
                              {achievement.iconUrl}
                            </span>
                          ) : (
                            <Lock className="text-muted-foreground/50 h-5 w-5" />
                          )}

                          {/* Glow Ring */}
                          {isUnlocked && (
                            <div
                              className={cn(
                                "absolute inset-0 rounded-full opacity-35 blur-md transition duration-300 group-hover:opacity-65",
                                path.nodeColor === "emerald"
                                  ? "bg-emerald-500"
                                  : path.nodeColor === "yellow"
                                    ? "bg-yellow-500"
                                    : path.nodeColor === "red"
                                      ? "bg-red-500"
                                      : path.nodeColor === "blue"
                                        ? "bg-blue-500"
                                        : path.nodeColor === "purple"
                                          ? "bg-purple-500"
                                          : "bg-pink-500"
                              )}
                            />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="bg-card/95 border-border/80 text-card-foreground z-50 w-64 space-y-1.5 p-3 shadow-2xl backdrop-blur-md"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg select-none">
                              {isUnlocked ? achievement.iconUrl : "🔒"}
                            </span>
                            <span className="text-foreground text-xs leading-none font-bold">
                              {isSecret ? "Secret Achievement" : achievement.title}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "px-1.5 py-0 text-[8px] leading-none",
                                getRarityColor(achievement.rarity),
                                getRarityBg(achievement.rarity, isUnlocked)
                              )}
                            >
                              {achievement.rarity}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground text-[10px] leading-normal">
                            {isSecret
                              ? "Keep playing to unlock this secret achievement challenge."
                              : achievement.description}
                          </p>
                          <div className="border-border/30 mt-1 flex items-center justify-between border-t pt-1.5 text-[9px]">
                            <span className="font-bold text-green-600 dark:text-green-400">
                              {achievement.points} pts
                            </span>
                            {achievement.globalUnlockPercent !== undefined && (
                              <span className="text-muted-foreground/60">
                                ({achievement.globalUnlockPercent}% unlocked)
                              </span>
                            )}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>

                    <span
                      className={cn(
                        "max-w-[110px] truncate text-center text-xs font-medium",
                        isUnlocked ? "text-foreground font-semibold" : "text-muted-foreground/50"
                      )}
                    >
                      {isSecret ? "Secret" : achievement.title}
                    </span>
                  </div>

                  {/* Connector Line */}
                  {idx < pathAchievements.length - 1 && (
                    <div className="relative z-0 h-0.5 w-10 shrink-0">
                      <div
                        className={cn(
                          "absolute inset-0 transition-all duration-300",
                          isUnlocked && nextNode?.isUnlocked
                            ? path.activeLineColor
                            : "bg-muted dark:bg-white/5"
                        )}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Selected Node Details Panel (Prevents cut-offs and supports touch screens) */}
        {selectedNode && (
          <div className="border-border/40 bg-muted/10 border-t p-5 transition-all duration-300 dark:border-white/5 dark:bg-white/[0.01]">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <div className="flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-2xl select-none">{selectedNode.iconUrl}</span>
                  <span className="text-foreground text-sm font-bold md:text-base">
                    {selectedNode.title}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "px-1.5 py-0 text-[9px] leading-none",
                      getRarityColor(selectedNode.rarity),
                      getRarityBg(selectedNode.rarity)
                    )}
                  >
                    {selectedNode.rarity}
                  </Badge>
                  {selectedNode.isUnlocked ? (
                    <Badge className="border-green-500/20 bg-green-500/10 px-1.5 py-0 text-[9px] leading-none text-green-600 dark:text-green-400">
                      Unlocked
                    </Badge>
                  ) : (
                    <Badge className="bg-muted text-muted-foreground/60 border-border/50 px-1.5 py-0 text-[9px] leading-none">
                      Locked
                    </Badge>
                  )}
                  <span className="text-muted-foreground/50 text-[10px] font-semibold tracking-widest uppercase">
                    {selectedNode.category}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {selectedNode.description}
                </p>
                {selectedNode.isUnlocked && selectedNode.unlockedAt && (
                  <div className="text-muted-foreground/50 text-[10px]">
                    Unlocked on {new Date(selectedNode.unlockedAt).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div className="border-border/30 flex w-full shrink-0 flex-col gap-2.5 border-t pt-3 md:w-auto md:items-end md:border-t-0 md:pt-0">
                <div className="text-green-655 flex items-center gap-1.5 text-xs font-bold select-none dark:text-green-400">
                  <span>Value:</span>
                  <span>{selectedNode.points} pts</span>
                  {selectedNode.globalUnlockPercent !== undefined && (
                    <span className="text-muted-foreground/60 font-normal">
                      ({selectedNode.globalUnlockPercent}% unlocked)
                    </span>
                  )}
                </div>

                {selectedNode.rewards && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNode.rewards.credits > 0 && (
                      <Badge
                        variant="secondary"
                        className="border-emerald-500/20 bg-emerald-500/10 text-[9px] text-emerald-600 dark:text-emerald-400"
                      >
                        <IxCreditsSymbol className="mr-1 inline-block h-3 w-3 align-text-top" />
                        {selectedNode.rewards.credits} IxC
                      </Badge>
                    )}
                    {selectedNode.rewards.cardIds?.map((cId: string) => (
                      <Badge
                        key={cId}
                        variant="secondary"
                        className="border-blue-500/20 bg-blue-500/10 text-[9px] text-blue-600 dark:text-blue-400"
                      >
                        <Layers className="mr-1 inline-block h-3 w-3 align-text-top" />
                        Card
                      </Badge>
                    ))}
                    {selectedNode.rewards.cardPacks?.map((pId: string) => (
                      <Badge
                        key={pId}
                        variant="secondary"
                        className="text-purple-650 border-purple-500/20 bg-purple-500/10 text-[9px] dark:text-purple-400"
                      >
                        <Package className="mr-1 inline-block h-3 w-3 align-text-top" />
                        Pack
                      </Badge>
                    ))}
                    {selectedNode.rewards.titles?.map((t: string) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="border-pink-500/20 bg-pink-500/10 text-[9px] text-pink-600 dark:text-pink-400"
                      >
                        <Crown className="mr-1 inline-block h-3 w-3 align-text-top" />
                        Title: {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CutoutCardContent>
    </CutoutCard>
  );
}

export default function AchievementsPage() {
  useEffect(() => {
    document.title = "Achievements - IxStats";
  }, []);

  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<string>("quest-trees");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedRarity, setSelectedRarity] = useState<string>("all");
  const [showAllPaths, setShowAllPaths] = useState<boolean>(false);

  // Get user profile
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

  // Get all master achievements with status for current user's country
  const { data: achievements, isLoading } = api.achievements.getAllWithStatus.useQuery(
    { countryId: userProfile?.countryId || undefined },
    { enabled: !!userProfile?.countryId }
  );

  // Get global leaderboard
  const { data: leaderboard } = api.achievements.getLeaderboard.useQuery({
    limit: 20,
    category: selectedCategory !== "all" ? selectedCategory : undefined,
  });

  // Achievement notification system
  const achievementNotifications = useAchievementNotifications({
    countryId: userProfile?.countryId || "",
    countryName: userProfile?.country?.name || "",
    enableRealTime: false,
    enableToast: true,
    enableDynamicIsland: true,
    enableNotificationCenter: true,
  });

  const categories = [
    { id: "all", name: "All Categories", icon: Star },
    { id: "Economic", name: "Economic", icon: TrendingUp },
    { id: "Diplomatic", name: "Diplomatic", icon: Globe },
    { id: "Government", name: "Government", icon: Landmark },
    { id: "Military", name: "Military", icon: Shield },
    { id: "Social", name: "Social", icon: BookOpen },
    { id: "General", name: "General", icon: Trophy },
  ];

  const rarities = ["all", "Common", "Uncommon", "Rare", "Epic", "Legendary"];

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "Legendary":
        return "text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "Epic":
        return "text-purple-600 dark:text-purple-400 border-purple-500/30";
      case "Rare":
        return "text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "Uncommon":
        return "text-green-600 dark:text-green-400 border-green-500/30";
      default:
        return "text-muted-foreground border-border/50 dark:border-white/10";
    }
  };

  const getRarityBg = (rarity: string, isUnlocked = true) => {
    if (!isUnlocked) return "bg-muted/50 border-border dark:bg-black/40 dark:border-white/5";
    switch (rarity) {
      case "Legendary":
        return "bg-amber-500/10 border-amber-500/20 dark:bg-amber-500/5";
      case "Epic":
        return "bg-purple-500/10 border-purple-500/20 dark:bg-purple-500/5";
      case "Rare":
        return "bg-blue-500/10 border-blue-500/20 dark:bg-blue-500/5";
      case "Uncommon":
        return "bg-green-500/10 border-green-500/20 dark:bg-green-500/5";
      default:
        return "bg-muted border-border/50 dark:bg-white/5 dark:border-white/10";
    }
  };

  const unlockedAchievements = achievements?.filter((a) => a.isUnlocked) || [];
  const totalPoints = unlockedAchievements.reduce((sum, a) => sum + (a.points || 10), 0);
  const totalUnlocked = unlockedAchievements.length;

  const filteredAchievements = achievements?.filter((a) => {
    const categoryMatch = selectedCategory === "all" || a.category === selectedCategory;
    const rarityMatch = selectedRarity === "all" || a.rarity === selectedRarity;
    return categoryMatch && rarityMatch;
  });

  // Calculate rarest showcase: top 4 rarest unlocked achievements based on global Unlock Percent
  const rarestShowcase = unlockedAchievements
    .sort((a, b) => (a.globalUnlockPercent ?? 100) - (b.globalUnlockPercent ?? 100))
    .slice(0, 4);

  // Show only first 4 paths by default
  const pathsToRender = showAllPaths ? QUEST_PATHS : QUEST_PATHS.slice(0, 4);

  return (
    <VaultSidebarLayout activeSection="achievements">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <GradientHeading
              variant="default"
              size="sm"
              weight="black"
              className="flex items-center gap-3"
            >
              <Trophy className="h-8 w-8 shrink-0 text-amber-500" />
              Achievements
            </GradientHeading>
            <p className="text-muted-foreground mt-1 text-sm">
              Unlock achievement milestones, progress along quest paths, and showcase awards.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Score Badge */}
            <div className="flex items-center gap-2.5 rounded-xl border border-green-500/20 bg-green-500/10 px-3.5 py-1.5 text-green-600 select-none dark:text-green-400">
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-green-500 bg-green-500/20 text-xs font-black">
                A
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground mb-0.5 text-[9px] leading-none font-bold tracking-wider uppercase">
                  Achievement Points
                </span>
                <span className="text-sm leading-none font-black tracking-tight">
                  {totalPoints} pts
                </span>
              </div>
            </div>

            <Link href="/leaderboards">
              <Button
                variant="outline"
                size="sm"
                className="border-border/50 hover:bg-muted text-muted-foreground hover:text-foreground h-9"
              >
                <Medal className="mr-2 h-4 w-4 text-[--intel-gold]" />
                Leaderboards
              </Button>
            </Link>

            {userProfile?.countryId && (
              <Button
                variant="outline"
                size="sm"
                onClick={
                  achievementNotifications.isConnected
                    ? achievementNotifications.disconnect
                    : achievementNotifications.connect
                }
                className="border-border/50 hover:bg-muted text-muted-foreground hover:text-foreground flex h-9 items-center gap-2"
              >
                {achievementNotifications.isConnected ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span>Live Updates</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="text-muted-foreground h-4 w-4" />
                    <span>Enable Live Updates</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

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
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-foreground text-lg font-bold">Your Achievement Profile</h2>
                  <p className="text-muted-foreground text-xs">{userProfile.country?.name}</p>
                </div>
                <Badge className="text-amber-660 border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[9px] font-bold tracking-wider uppercase dark:text-amber-400">
                  National Achievements
                </Badge>
              </div>

              <div className="border-border/50 grid grid-cols-2 gap-4 border-t pt-4 md:grid-cols-4 dark:border-white/5">
                <div className="space-y-1">
                  <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
                    {totalUnlocked}
                  </div>
                  <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Total Unlocked
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-3xl font-black text-green-600 dark:text-green-400">
                    {totalPoints} pts
                  </div>
                  <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Total Points
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
                    {
                      unlockedAchievements.filter(
                        (a) =>
                          a.rarity === "Rare" || a.rarity === "Epic" || a.rarity === "Legendary"
                      ).length
                    }
                  </div>
                  <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                    Rare+ Unlocks
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
              value="showcase"
              className="text-muted-foreground data-[state=active]:text-foreground px-3 py-1.5 text-xs font-bold data-[state=active]:dark:text-white"
            >
              Showcase
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
              <Loader2 className="text-amber-550 h-8 w-8 animate-spin" />
            </div>
          )}

          {/* Quest Trees Tab */}
          {!isLoading && (
            <TabsContent value="quest-trees" className="space-y-6 outline-none">
              <div className="space-y-6">
                {pathsToRender.map((path) => (
                  <QuestPathCard
                    key={path.name}
                    path={path}
                    achievements={achievements}
                    getRarityColor={getRarityColor}
                    getRarityBg={getRarityBg}
                  />
                ))}
              </div>

              {QUEST_PATHS.length > 4 && (
                <div className="mt-6 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setShowAllPaths(!showAllPaths)}
                    className="border-border/50 hover:bg-muted text-muted-foreground hover:text-foreground h-10 px-5 font-semibold"
                  >
                    {showAllPaths ? "See Less" : `See All Quest Paths (${QUEST_PATHS.length})`}
                  </Button>
                </div>
              )}
            </TabsContent>
          )}

          {/* All Achievements Tab */}
          {!isLoading && (
            <TabsContent value="all-achievements" className="space-y-6 outline-none">
              {/* Category / Rarity Filters */}
              <TextureCard className="border-border/50 bg-black/5 dark:bg-black/25">
                <TextureCardContent className="flex flex-col items-start justify-between gap-4 p-4 lg:flex-row lg:items-center">
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = selectedCategory === cat.id;
                      return (
                        <Button
                          key={cat.id}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedCategory(cat.id)}
                          className={cn(
                            "h-8 text-xs transition-all duration-200",
                            isSelected
                              ? "bg-primary text-primary-foreground font-bold shadow-md"
                              : "border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Icon className="mr-1.5 h-3.5 w-3.5" />
                          {cat.name}
                        </Button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground mr-1 text-xs font-medium">Rarity:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {rarities.map((r) => {
                        const isSelected = selectedRarity === r;
                        return (
                          <Button
                            key={r}
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedRarity(r)}
                            className={cn(
                              "h-8 text-xs capitalize transition-all duration-200",
                              isSelected
                                ? "bg-primary text-primary-foreground font-bold shadow-md"
                                : "border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {r === "all" ? "All" : r}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </TextureCardContent>
              </TextureCard>

              {/* Achievements list layout */}
              {filteredAchievements && filteredAchievements.length > 0 ? (
                <div className="space-y-3">
                  {filteredAchievements.map((achievement) => {
                    const isUnlocked = achievement.isUnlocked;
                    const isSecret =
                      (achievement.key.startsWith("vid-") || achievement.key.startsWith("meme-")) &&
                      !isUnlocked;

                    return (
                      <div
                        key={achievement.key}
                        className={cn(
                          "group border-border/50 bg-card/65 hover:border-border hover:bg-card/85 relative flex flex-col items-start justify-between gap-4 overflow-hidden rounded-xl border p-4 backdrop-blur-md transition-all duration-200 sm:flex-row sm:items-center",
                          !isUnlocked && "opacity-60"
                        )}
                      >
                        {/* Status bar */}
                        {isUnlocked && (
                          <div className="absolute top-0 bottom-0 left-0 w-1 bg-green-500" />
                        )}

                        <div className="flex min-w-0 flex-1 items-center gap-3.5 pl-1">
                          {/* Icon Badge */}
                          <div
                            className={cn(
                              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-2xl shadow-inner transition-transform duration-300 select-none group-hover:scale-105",
                              isUnlocked
                                ? "border-green-500/30 bg-green-500/10 text-green-500 dark:bg-green-500/20"
                                : "bg-muted border-border/50 text-muted-foreground/30 dark:border-white/5"
                            )}
                          >
                            {isUnlocked ? (
                              achievement.iconUrl
                            ) : (
                              <Lock className="text-muted-foreground/45 h-5 w-5" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <h4
                                className={cn(
                                  "text-sm font-bold tracking-tight",
                                  isUnlocked ? "text-foreground" : "text-muted-foreground"
                                )}
                              >
                                {isSecret ? "Secret Achievement" : achievement.title}
                              </h4>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "px-1.5 py-0.5 text-[8px] leading-none font-bold tracking-wider uppercase",
                                  getRarityColor(achievement.rarity),
                                  getRarityBg(achievement.rarity, isUnlocked)
                                )}
                              >
                                {achievement.rarity}
                              </Badge>
                              <span className="text-muted-foreground/50 text-[10px] font-semibold tracking-widest uppercase">
                                {achievement.category}
                              </span>
                            </div>
                            <p className="text-muted-foreground mt-0.5 max-w-xl truncate text-xs">
                              {isSecret
                                ? "Keep playing to unlock this secret achievement challenge."
                                : achievement.description}
                            </p>
                          </div>
                        </div>

                        {/* Right side stats */}
                        <div className="border-border/30 mt-2 flex w-full shrink-0 items-center justify-end gap-4 border-t pt-2.5 sm:mt-0 sm:w-auto sm:border-t-0 sm:pt-0">
                          {/* Unlock rate */}
                          <div className="flex flex-col justify-center text-right">
                            <span className="text-muted-foreground/60 text-[9px] leading-none font-bold tracking-wider uppercase">
                              Unlock Rate
                            </span>
                            <span className="text-foreground mt-0.5 font-mono text-xs font-bold">
                              {achievement.globalUnlockPercent !== undefined
                                ? `${achievement.globalUnlockPercent}%`
                                : "—"}
                            </span>
                          </div>

                          {/* Points value */}
                          <div className="flex items-center gap-1.5 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-extrabold text-green-600 select-none dark:text-green-400">
                            <span>{achievement.points}</span>
                            <span className="text-[9px] font-semibold tracking-wide text-green-500/70 uppercase">
                              pts
                            </span>
                          </div>

                          {/* Date details */}
                          <div className="text-muted-foreground w-20 text-right text-[10px]">
                            {isUnlocked && achievement.unlockedAt ? (
                              <>
                                <span className="block text-[8px] font-medium tracking-wider uppercase opacity-60">
                                  Unlocked
                                </span>
                                <span className="mt-0.5 block font-semibold">
                                  {new Date(achievement.unlockedAt).toLocaleDateString()}
                                </span>
                              </>
                            ) : (
                              <span className="italic opacity-40">Locked</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <TextureCard className="border-border/50 bg-black/5 dark:bg-black/25">
                  <TextureCardContent className="py-12">
                    <div className="space-y-4 text-center">
                      <Trophy className="text-muted-foreground/20 mx-auto h-16 w-16" />
                      <div>
                        <h3 className="text-foreground mb-2 text-lg font-bold">
                          No Matching Achievements
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          Try adjusting your category or rarity filters.
                        </p>
                      </div>
                    </div>
                  </TextureCardContent>
                </TextureCard>
              )}
            </TabsContent>
          )}

          {/* Showcase Tab */}
          {!isLoading && (
            <TabsContent value="showcase" className="space-y-6 outline-none">
              <div className="flex flex-col gap-1.5">
                <h3 className="text-foreground text-base font-bold">Rarest Unlocked Showcase</h3>
                <p className="text-muted-foreground text-xs">
                  Showcase your rarest unlocked achievement milestones compared to global player
                  rates.
                </p>
              </div>

              {rarestShowcase && rarestShowcase.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {rarestShowcase.map((achievement) => {
                    const isUnlocked = achievement.isUnlocked;

                    return (
                      <CutoutCard
                        key={achievement.key}
                        className={cn(
                          cutoutCardSurfaceClassName,
                          "border-border/50 bg-card/65 relative overflow-hidden rounded-2xl p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:border-amber-500/40 hover:shadow-2xl"
                        )}
                        texture="horizontalLines"
                        textureOpacity={0.03}
                        trackPointerHover={false}
                      >
                        {/* Shimmer overlay based on Rarity */}
                        {achievement.rarity === "Legendary" && (
                          <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 opacity-10 blur-xl transition duration-500 group-hover:opacity-20" />
                        )}
                        {achievement.rarity === "Epic" && (
                          <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 opacity-10 blur-xl transition duration-500 group-hover:opacity-20" />
                        )}

                        <div className="relative z-10 mb-4 flex items-center justify-between">
                          <Badge
                            className={cn(
                              "px-2 py-0.5 text-[8px] font-bold tracking-wider uppercase",
                              getRarityColor(achievement.rarity),
                              getRarityBg(achievement.rarity, isUnlocked)
                            )}
                          >
                            {achievement.rarity}
                          </Badge>
                          <div className="text-[10px] font-bold tracking-wider text-amber-600 uppercase dark:text-amber-400">
                            {achievement.globalUnlockPercent !== undefined
                              ? `${achievement.globalUnlockPercent}% Unlocked`
                              : "Rare unlock"}
                          </div>
                        </div>

                        <div className="relative z-10 mb-4 flex flex-col items-center space-y-3 text-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-3xl shadow-inner transition duration-300 select-none group-hover:scale-110">
                            {achievement.iconUrl}
                          </div>
                          <div>
                            <h3 className="text-foreground text-base leading-tight font-bold transition-colors duration-300 group-hover:text-amber-500">
                              {achievement.title}
                            </h3>
                            <span className="text-muted-foreground mt-1 block text-[9px] font-bold tracking-widest uppercase">
                              {achievement.category}
                            </span>
                          </div>
                        </div>

                        <p className="text-muted-foreground relative z-10 mb-4 min-h-[44px] text-center text-xs leading-relaxed">
                          {achievement.description}
                        </p>

                        <div className="border-border/40 text-muted-foreground relative z-10 mt-auto flex items-center justify-between border-t pt-3 text-[10px] dark:border-white/5">
                          <div className="flex items-center gap-1 rounded-md border border-green-500/20 bg-green-500/10 px-2 py-0.5 font-bold text-green-600 dark:text-green-400">
                            <span>+{achievement.points}</span>
                            <span>pts</span>
                          </div>
                          {achievement.unlockedAt && (
                            <span>
                              Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </CutoutCard>
                    );
                  })}
                </div>
              ) : (
                <TextureCard className="border-border/50 bg-black/5 dark:bg-black/25">
                  <TextureCardContent className="py-12">
                    <div className="space-y-4 text-center">
                      <Trophy className="text-muted-foreground/20 mx-auto h-16 w-16" />
                      <div>
                        <h3 className="text-foreground mb-2 text-lg font-bold">
                          Showcase Cabinet Empty
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          Unlock rarest achievement badges to populate this showcase shelf!
                        </p>
                      </div>
                    </div>
                  </TextureCardContent>
                </TextureCard>
              )}
            </TabsContent>
          )}

          {/* Global Leaderboard Tab */}
          <TabsContent value="leaderboard">
            <TextureCard className="border-border/50 bg-black/5 dark:bg-black/25">
              <TextureCardContent className="p-6">
                <div className="mb-4">
                  <h3 className="text-foreground text-lg font-bold">
                    Global Achievement Leaderboard
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    Top nations ranked by achievement points
                  </p>
                </div>

                {leaderboard && leaderboard.length > 0 ? (
                  <div className="space-y-2">
                    {leaderboard.map(
                      (
                        entry: {
                          countryId: string;
                          countryName: string;
                          achievementCount: number;
                          rareAchievements: number;
                          totalPoints: number;
                        },
                        index: number
                      ) => (
                        <div
                          key={entry.countryId}
                          className={cn(
                            "flex items-center justify-between rounded-xl border p-4 backdrop-blur-md transition-all duration-300",
                            index < 3
                              ? "border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-transparent dark:from-amber-500/5 dark:to-transparent"
                              : "border-border/50 bg-card/45 dark:border-white/5 dark:bg-black/20"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={cn(
                                "w-8 text-center text-2xl font-black",
                                index === 0
                                  ? "text-amber-500"
                                  : index === 1
                                    ? "text-slate-400"
                                    : index === 2
                                      ? "text-amber-700 dark:text-amber-600"
                                      : "text-muted-foreground"
                              )}
                            >
                              {index + 1}
                            </div>
                            <div>
                              <div className="text-foreground font-bold">{entry.countryName}</div>
                              <div className="text-muted-foreground text-xs">
                                {entry.achievementCount} achievements • {entry.rareAchievements}{" "}
                                rare+
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Star className="text-amber-550 h-5 w-5 animate-pulse fill-amber-500/20" />
                            <span className="text-foreground text-xl font-black">
                              {entry.totalPoints} pts
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="text-muted-foreground py-12 text-center text-sm">
                    No leaderboard data available
                  </div>
                )}
              </TextureCardContent>
            </TextureCard>
          </TabsContent>
        </Tabs>
      </div>
    </VaultSidebarLayout>
  );
}
