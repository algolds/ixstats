import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import {
  Package,
  ShoppingCart,
  Layers,
  TrendingUp,
  Gift,
  ArrowRight,
  Calendar,
  Flame,
  ArrowUp,
  ArrowDown,
  Star,
  ShoppingBag,
  Sparkles,
  Download,
  Check,
  Wallet,
  History,
  Trophy,
} from "lucide-react";
import { useVaultStats } from "~/hooks/vault/useVaultStats";
import { useRecentActivity } from "~/hooks/vault/useRecentActivity";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { vaultNotify } from "~/lib/vault-notifications";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import NumberFlow from "~/components/ui/number-flow";
import { cn } from "~/lib/utils";
import { CardDisplay } from "~/components/cards/display/CardDisplay";
import type { CardInstance } from "~/types/cards-display";
import type { VaultSection } from "../VaultSidebarNav";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { IxCreditsSymbol } from "../IxCreditsSymbol";
import { GradientHeading } from "~/components/ui/gradient-heading";
import { LiquidMetalButton } from "~/components/ui/liquid-metal-button";
import { TextureCard, TextureCardContent } from "~/components/ui/texture-card";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";

interface VaultDashboardSectionProps {
  onNavigate?: (section: VaultSection) => void;
}

interface ActivityEntry {
  id: string;
  type: string;
  amount: number;
  source: string;
  createdAt: Date;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  rotate: number;
  scale: number;
}

const getRarityGlow = (rarity?: string | null) => {
  if (!rarity) return "rgba(255,255,255,0.05)";
  switch (rarity.toUpperCase()) {
    case "LEGENDARY":
      return "rgba(234,179,8,0.25)";
    case "EPIC":
      return "rgba(168,85,247,0.25)";
    case "ULTRA_RARE":
      return "rgba(239,68,68,0.25)";
    case "RARE":
      return "rgba(59,130,246,0.25)";
    case "UNCOMMON":
      return "rgba(34,197,94,0.25)";
    default:
      return "rgba(255,255,255,0.05)";
  }
};

const getRarityBorder = (rarity?: string | null) => {
  if (!rarity) return "rgba(255,255,255,0.1)";
  switch (rarity.toUpperCase()) {
    case "LEGENDARY":
      return "rgba(234,179,8,0.35)";
    case "EPIC":
      return "rgba(168,85,247,0.35)";
    case "ULTRA_RARE":
      return "rgba(239,68,68,0.35)";
    case "RARE":
      return "rgba(59,130,246,0.35)";
    case "UNCOMMON":
      return "rgba(34,197,94,0.35)";
    default:
      return "rgba(255,255,255,0.1)";
  }
};

const getRankTitle = (level: number) => {
  if (level >= 21) return "Diamond Cardmaster";
  if (level >= 11) return "Gold Specialist";
  if (level >= 6) return "Silver Collector";
  return "Bronze Novice";
};

const getRankBadgeClass = (level: number) => {
  if (level >= 21) return "border-cyan-500/30 text-cyan-600 dark:text-cyan-400 bg-cyan-500/10";
  if (level >= 11) return "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10";
  if (level >= 6) return "border-slate-400/30 text-slate-600 dark:text-slate-300 bg-slate-400/10";
  return "border-orange-500/20 text-orange-600 dark:text-orange-400 bg-orange-500/10";
};

export function VaultDashboardSection({ onNavigate }: VaultDashboardSectionProps) {
  const { user } = useUser();
  const { stats, loading: statsLoading, refreshing } = useVaultStats();
  const { activities, loading: activitiesLoading } = useRecentActivity() as {
    activities: ActivityEntry[] | undefined;
    loading: boolean;
  };

  const [showCoinExplosion, setShowCoinExplosion] = useState(false);
  const [claimedBonusAmount, setClaimedBonusAmount] = useState(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "feed" | "showcase">("overview");

  const { data: earningsData, isLoading: earningsLoading } = api.vault.getTodayEarnings.useQuery(
    undefined,
    {
      enabled: !!user,
    }
  );

  const { data: balanceData, refetch: refetchBalance } = api.vault.getBalance.useQuery(
    { userId: user?.id ?? "" },
    { enabled: !!user?.id }
  );

  const { data: levelData, isLoading: levelLoading } = api.vault.getVaultLevel.useQuery(
    { userId: user?.id ?? "" },
    { enabled: !!user?.id }
  );

  const { data: topCardsData, isLoading: topCardsLoading } = api.cards.getMyCards.useQuery(
    { sortBy: "value" },
    { enabled: !!user }
  );

  const { data: userData } = api.users.getProfile.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: myAchievements } = api.achievements.getAllByCountry.useQuery(
    { countryId: userData?.countryId || "" },
    { enabled: !!userData?.countryId }
  );

  const { data: leaderboard } = api.achievements.getLeaderboard.useQuery(
    { limit: 100 },
    { enabled: !!userData?.countryId }
  );

  const { data: passiveIncomeData } = api.vault.calculatePassiveIncome.useQuery(
    { countryId: userData?.countryId ?? "" },
    { enabled: !!userData?.countryId }
  );

  const { data: budgetMultiplierData } = api.vault.getBudgetMultiplier.useQuery(
    { countryId: userData?.countryId ?? "" },
    { enabled: !!userData?.countryId }
  );

  const { data: activeCapData, isLoading: activeCapLoading } = api.vault.checkDailyCap.useQuery(
    { earnType: "EARN_ACTIVE" },
    { enabled: !!user }
  );

  const { data: socialCapData, isLoading: socialCapLoading } = api.vault.checkDailyCap.useQuery(
    { earnType: "EARN_SOCIAL" },
    { enabled: !!user }
  );

  const featuredCards: CardInstance[] = useMemo(
    () =>
      topCardsData?.slice(0, 3).map((ownership: any) => ({
        id: ownership.cards?.id ?? ownership.id,
        title: ownership.cards?.title ?? "Unknown",
        description: ownership.cards?.description || "",
        artwork: ownership.cards?.artwork || "/images/cards/placeholder-nation.png",
        artworkVariants: ownership.cards?.artworkVariants || null,
        cardType: ownership.cards?.cardType ?? "NS_IMPORT",
        rarity: ownership.cards?.rarity ?? "COMMON",
        season: ownership.cards?.season ?? 1,
        nsCardId: ownership.cards?.nsCardId || null,
        nsSeason: ownership.cards?.nsSeason || null,
        nsData: ownership.cards?.nsData || null,
        wikiSource: ownership.cards?.wikiSource || null,
        wikiArticleTitle: ownership.cards?.wikiArticleTitle || null,
        wikiUrl: ownership.cards?.wikiUrl || null,
        countryId: ownership.cards?.countryId ?? null,
        stats: ownership.cards?.stats || {},
        marketValue: ownership.cards?.marketValue || 0,
        totalSupply: ownership.cards?.totalSupply || 0,
        level: ownership.level || 1,
        evolutionStage: ownership.cards?.evolutionStage || 0,
        enhancements: ownership.cards?.enhancements || null,
        createdAt: ownership.cards?.createdAt ?? new Date(),
        updatedAt: ownership.cards?.updatedAt ?? new Date(),
        lastTrade: ownership.cards?.lastTrade || null,
        country: ownership.cards?.country ?? null,
        owners: [],
      })) || [],
    [topCardsData]
  );

  const claimDailyBonus = api.vault.claimDailyBonus.useMutation({
    onSuccess: (data) => {
      setClaimedBonusAmount(data.bonus);

      // Generate physics-drifting particles
      const list = Array.from({ length: 30 }).map((_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 360,
        y: (Math.random() - 0.5) * 300 - 100,
        rotate: Math.random() * 360,
        scale: 0.6 + Math.random() * 0.7,
      }));
      setParticles(list);
      setShowCoinExplosion(true);

      vaultNotify.dailyBonusClaimed(data.message);
      void refetchBalance();

      // Clear sequence after 3 seconds
      setTimeout(() => {
        setShowCoinExplosion(false);
        setParticles([]);
      }, 3200);
    },
    onError: (error) => {
      vaultNotify.error(error.message);
    },
  });

  const loading = statsLoading || activitiesLoading || earningsLoading;

  // Calculate Net Worth
  const collectionValuation = stats?.deckValue ?? 0;
  const liquidCredits = balanceData?.credits ?? 0;
  const netWorth = collectionValuation + liquidCredits;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1"></div>

      {/* 2-Column Premium Banking Grid Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (Financial Center) */}
        <div className="space-y-6 lg:col-span-2">
          {/* 1. Account Net Worth Card (Premium Cutout style) */}
          <CutoutCard
            className={cn(
              cutoutCardSurfaceClassName,
              "relative overflow-hidden rounded-2xl shadow-lg transition-shadow duration-300 hover:shadow-purple-500/10"
            )}
            texture="chevron"
            textureOpacity={0.05}
            trackPointerHover={false}
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:32px_32px] opacity-20 dark:bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] dark:opacity-25" />

            <CutoutCardContent className="relative z-10 flex h-full min-h-[160px] flex-col justify-between p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4.5 w-4.5 text-purple-600 dark:text-purple-400" />
                </div>
                <Badge className="border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[9px] font-bold tracking-wider text-purple-600 uppercase dark:text-purple-400">
                  Tier {levelData?.vaultLevel ?? 1} Account
                </Badge>
              </div>

              <div className="mt-4">
                <p className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                  MyVault Balance
                </p>
                <div className="mt-1.5 flex items-center gap-1.5 text-4xl font-extrabold tracking-tighter text-amber-600 sm:text-5xl dark:text-amber-400">
                  <IxCreditsSymbol className="h-7 w-7 shrink-0 text-amber-600 sm:h-9 sm:w-9 dark:text-amber-400" />
                  <NumberFlow value={netWorth} />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-200 pt-4 text-xs dark:border-white/5">
                <div>
                  <span className="text-muted-foreground block text-[9px] font-bold tracking-wider uppercase">
                    Available Balance
                  </span>
                  <div className="mt-0.5 flex items-center gap-1 text-lg font-extrabold text-amber-600 dark:text-amber-400">
                    <IxCreditsSymbol className="h-4.5 w-4.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <NumberFlow value={liquidCredits} />
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[9px] font-bold tracking-wider uppercase">
                    Card Deck Value
                  </span>
                  <div className="mt-0.5 flex items-center gap-1 text-lg font-extrabold text-purple-600 dark:text-purple-400">
                    <IxCreditsSymbol className="h-4.5 w-4.5 shrink-0 text-purple-600 dark:text-purple-400" />
                    <NumberFlow value={collectionValuation} />
                  </div>
                </div>
              </div>

              {/* Quick stats inline badges */}
              <div className="mt-5 flex flex-wrap gap-1.5 border-t border-slate-200 pt-3.5 text-[10px] dark:border-white/5">
                <div className="text-muted-foreground flex items-center gap-1 rounded-full border border-slate-200/50 bg-slate-500/10 px-2.5 py-0.5 font-medium dark:border-white/5 dark:bg-white/5">
                  <Layers className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    Total Cards:{" "}
                    <strong className="text-foreground font-bold">
                      {stats?.totalCards ?? 0} / {150 + (stats?.capacityBoost ?? 0)}
                    </strong>
                  </span>
                </div>
                <div className="text-muted-foreground flex items-center gap-1 rounded-full border border-slate-200/50 bg-slate-500/10 px-2.5 py-0.5 font-medium dark:border-white/5 dark:bg-white/5">
                  <Package className="h-3 w-3 shrink-0 text-purple-600 dark:text-purple-400" />
                  <span>
                    Packs:{" "}
                    <strong className="text-foreground font-bold">
                      {stats?.unopenedPacks ?? 0}
                    </strong>
                  </span>
                </div>
                <div className="text-muted-foreground flex items-center gap-1 rounded-full border border-slate-200/50 bg-slate-500/10 px-2.5 py-0.5 font-medium dark:border-white/5 dark:bg-white/5">
                  <ShoppingBag className="h-3 w-3 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>
                    Auctions:{" "}
                    <strong className="text-foreground font-bold">
                      {stats?.activeAuctions ?? 0}
                    </strong>
                  </span>
                </div>
              </div>
            </CutoutCardContent>
          </CutoutCard>

          {/* 2. Interactive Yield & Multiplier Forecast */}
          <CutoutCard
            className={cn(
              cutoutCardSurfaceClassName,
              "relative overflow-hidden rounded-2xl shadow-md transition-shadow duration-300 hover:shadow-purple-500/10"
            )}
            texture="horizontalLines"
            textureOpacity={0.04}
            trackPointerHover={false}
          >
            <CutoutCardContent className="relative overflow-hidden p-5">
              <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                  <span className="text-foreground text-xs tracking-wider uppercase">
                    Passive Income & Yields
                  </span>
                </div>
                {balanceData?.canClaimDailyBonus && (
                  <LiquidMetalButton
                    viewMode="text"
                    label="Claim Daily Bonus"
                    onClick={() => claimDailyBonus.mutate()}
                    disabled={claimDailyBonus.isPending}
                    inverted={true}
                  />
                )}
              </div>

              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Projections */}
                    <div className="space-y-3">
                      <span className="text-muted-foreground block text-[10px] font-bold tracking-widest uppercase">
                        Passive Dividend Projections
                      </span>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Daily Passive Yield</span>
                          <span className="flex items-center gap-0.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                            +<IxCreditsSymbol className="h-3 w-3 shrink-0" />
                            {passiveIncomeData?.dailyDividend?.toFixed(2) ?? "0.00"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Weekly Dividend Yield</span>
                          <span className="flex items-center gap-0.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                            ~<IxCreditsSymbol className="h-3 w-3 shrink-0" />
                            {passiveIncomeData?.weeklyDividend?.toFixed(2) ?? "0.00"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Monthly Dividend Yield</span>
                          <span className="flex items-center gap-0.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                            ~<IxCreditsSymbol className="h-3 w-3 shrink-0" />
                            {passiveIncomeData?.monthlyDividend?.toFixed(2) ?? "0.00"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* active multipliers */}
                    <div className="space-y-3 md:border-l md:border-slate-200 md:pl-6 dark:md:border-white/5">
                      <span className="text-muted-foreground block text-[10px] font-bold tracking-widest uppercase">
                        Active Multipliers & Streaks
                      </span>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <Flame className="h-3.5 w-3.5 fill-orange-500/20 text-orange-600 dark:text-orange-400" />{" "}
                            Active Streak
                          </span>
                          <span className="font-bold text-orange-600 dark:text-orange-400">
                            {balanceData?.loginStreak ?? 0} Days
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Budget Multiplier</span>
                          <span
                            className={cn(
                              "font-mono font-bold",
                              (budgetMultiplierData?.percentChange ?? 0) > 0
                                ? "text-green-600 dark:text-green-400"
                                : (budgetMultiplierData?.percentChange ?? 0) < 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-muted-foreground"
                            )}
                          >
                            {(budgetMultiplierData?.percentChange ?? 0) > 0 ? "+" : ""}
                            {budgetMultiplierData?.percentChange ?? 0}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Tier Bonus</span>
                          <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                            1.{(levelData?.vaultLevel ?? 1) * 5}x
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Daily Allowances (Earning Caps) */}
                  <div className="mt-5 space-y-3 border-t border-slate-200 pt-4 dark:border-white/5">
                    <span className="text-muted-foreground block text-[10px] font-bold tracking-widest uppercase">
                      Daily Allowance Progress
                    </span>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {/* Active Gameplay Cap */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-muted-foreground">Active Gameplay</span>
                          <span className="text-foreground flex items-center gap-0.5 font-mono text-[10px]">
                            {activeCapLoading ? (
                              "..."
                            ) : (
                              <>
                                <IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
                                {Math.round(
                                  (activeCapData?.cap ?? 100) - (activeCapData?.remaining ?? 100)
                                )}{" "}
                                / {activeCapData?.cap ?? 100}
                              </>
                            )}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-white/5 dark:bg-white/5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                            style={{
                              width: `${activeCapData ? ((activeCapData.cap - activeCapData.remaining) / activeCapData.cap) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Social Earning Cap */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-muted-foreground">Social Engagement</span>
                          <span className="text-foreground flex items-center gap-0.5 font-mono text-[10px]">
                            {socialCapLoading ? (
                              "..."
                            ) : (
                              <>
                                <IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
                                {Math.round(
                                  (socialCapData?.cap ?? 50) - (socialCapData?.remaining ?? 50)
                                )}{" "}
                                / {socialCapData?.cap ?? 50}
                              </>
                            )}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-white/5 dark:bg-white/5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-500"
                            style={{
                              width: `${socialCapData ? ((socialCapData.cap - socialCapData.remaining) / socialCapData.cap) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CutoutCardContent>
          </CutoutCard>

          {/* 3. Account Statement (Ledger) */}
          <TextureCard className="border-border/50 shadow-sm dark:border-white/10">
            <TextureCardContent className="relative overflow-hidden p-5">
              <TextureOverlay texture="dots" opacity={0.03} />
              <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-white/5">
                <History className="text-muted-foreground h-4.5 w-4.5" />
                <span className="text-foreground text-xs tracking-wider uppercase">
                  Recent Activity
                </span>
              </div>
              {loading ? (
                <div className="space-y-2.5">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : !activities || activities.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-xs italic">
                  No transactions recorded
                </p>
              ) : (
                <div className="thin-scrollbar max-h-[280px] space-y-2 overflow-y-auto pr-1">
                  {activities.slice(0, 8).map((activity) => {
                    const isEarn = activity.amount > 0;
                    return (
                      <div
                        key={activity.id}
                        className="dark:border-border/30 flex items-center justify-between rounded-xl border border-slate-200/60 bg-slate-100/80 px-4 py-2.5 text-xs transition-colors hover:bg-slate-200/80 dark:bg-black/20 dark:hover:bg-white/5"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              "rounded-full p-1",
                              isEarn
                                ? "bg-green-500/10 dark:bg-green-500/15"
                                : "bg-red-500/10 dark:bg-red-500/15"
                            )}
                          >
                            {isEarn ? (
                              <ArrowUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-foreground font-bold">
                              {activity.source.replace(/_/g, " ")}
                            </p>
                            <p className="text-muted-foreground mt-0.5 text-[9px]">
                              {new Date(activity.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "flex items-center gap-0.5 font-mono text-sm font-bold",
                            isEarn
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          )}
                        >
                          {isEarn ? "+" : "-"}
                          <IxCreditsSymbol className="h-3 w-3 shrink-0" />
                          {Math.abs(activity.amount).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </TextureCardContent>
          </TextureCard>
        </div>

        {/* Right Column (Asset Portfolio & Account Status) */}
        <div className="space-y-6">
          {/* Card Assets Portfolio Shelf */}
          <CutoutCard
            className={cn(
              cutoutCardSurfaceClassName,
              "relative overflow-hidden rounded-2xl shadow-md transition-shadow duration-300 hover:shadow-purple-500/10"
            )}
            texture="dots"
            textureOpacity={0.04}
            trackPointerHover={false}
          >
            <CutoutCardContent className="relative overflow-hidden p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4.5 w-4.5 text-purple-600 dark:text-purple-400" />
                  <span className="text-foreground text-xs tracking-wider uppercase">
                    Card Holdings
                  </span>
                </div>
                {featuredCards.length > 0 && (
                  <button
                    onClick={() => onNavigate?.("cards")}
                    className="hover:text-foreground flex items-center gap-0.5 text-[10px] font-bold text-purple-600 transition-colors dark:text-purple-400"
                  >
                    Manage Portfolio <ArrowRight className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>

              {topCardsLoading ? (
                <div className="flex justify-center py-8">
                  <Skeleton className="h-64 w-44 rounded-xl bg-white/5" />
                </div>
              ) : featuredCards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Layers className="text-muted-foreground/30 mb-3 h-10 w-10" />
                  <span className="text-foreground/80 block text-xs font-bold">
                    Portfolio Empty
                  </span>
                  <p className="text-muted-foreground mt-1 mb-3 text-[10px]">
                    Import cards or open packs to populate your assets.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate?.("import")}
                    className="h-7 border-rose-500/20 text-[10px] text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                  >
                    <Download className="mr-1 h-3 w-3" /> NS Import
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 3D Featured Assets Display */}
                  <div className="flex justify-center pt-2">
                    <motion.div
                      whileHover={{ scale: 1.03, y: -4 }}
                      transition={{ type: "spring", stiffness: 120, damping: 15 }}
                      className={cn(
                        "relative flex flex-col items-center rounded-xl border bg-black/50 p-2 shadow-xl backdrop-blur-md transition-shadow",
                        "border-[var(--border)] shadow-[0_0_12px_var(--glow)]"
                      )}
                      style={
                        {
                          "--glow": getRarityGlow(featuredCards[0]?.rarity),
                          "--border": getRarityBorder(featuredCards[0]?.rarity),
                        } as any
                      }
                    >
                      <CardDisplay
                        card={featuredCards[0] as any}
                        size="medium"
                        performanceMode={false}
                        enable3D={true}
                        enableHolographic={true}
                        className="h-[240px] w-40"
                      />
                      <p className="mt-2 flex items-center gap-0.5 font-mono text-[10px] text-amber-600 dark:text-amber-400">
                        <IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
                        {featuredCards[0]?.marketValue.toLocaleString()} Val
                      </p>
                    </motion.div>
                  </div>

                  {/* Other assets list */}
                  {featuredCards.length > 1 && (
                    <div className="space-y-1.5 border-t border-slate-200 pt-3 dark:border-white/5">
                      {featuredCards.slice(1, 3).map((card) => (
                        <div
                          key={card.id}
                          className="flex items-center justify-between py-1 text-xs"
                        >
                          <span className="text-muted-foreground max-w-[120px] truncate font-medium">
                            {card.title}
                          </span>
                          <span className="flex items-center gap-0.5 font-mono text-[11px] font-bold text-purple-600 dark:text-purple-400">
                            <IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
                            {card.marketValue.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CutoutCardContent>
          </CutoutCard>

          {/* Achievements & Vault Milestones */}
          <CutoutCard
            className={cn(
              cutoutCardSurfaceClassName,
              "relative overflow-hidden rounded-2xl shadow-md transition-shadow duration-300 hover:shadow-purple-500/10"
            )}
            texture="dots"
            textureOpacity={0.04}
            trackPointerHover={false}
          >
            <CutoutCardContent className="relative overflow-hidden p-4">
              <div className="mb-3.5 flex items-center gap-2">
                <Trophy className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                <span className="text-foreground text-xs tracking-wider uppercase">
                  Achievements & Milestones
                </span>
              </div>

              <div className="space-y-4">
                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-xl border border-slate-200/50 bg-slate-500/5 p-2 dark:border-white/5 dark:bg-white/5">
                    <span className="text-muted-foreground block text-[8px] font-bold tracking-wider uppercase">
                      Achievement Points
                    </span>
                    <span className="mt-0.5 block font-mono text-base font-extrabold text-amber-600 dark:text-amber-400">
                      {myAchievements
                        ? myAchievements.reduce((sum: number, a: any) => sum + (a.points || 10), 0)
                        : 0}{" "}
                      pts
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-200/50 bg-slate-500/5 p-2 dark:border-white/5 dark:bg-white/5">
                    <span className="text-muted-foreground block text-[8px] font-bold tracking-wider uppercase">
                      Global Rank
                    </span>
                    <span className="mt-0.5 block font-mono text-base font-extrabold text-purple-600 dark:text-purple-400">
                      {leaderboard && userData?.countryId
                        ? leaderboard.findIndex((l: any) => l.countryId === userData.countryId) !==
                          -1
                          ? `#${leaderboard.findIndex((l: any) => l.countryId === userData.countryId) + 1}`
                          : "—"
                        : "—"}
                    </span>
                  </div>
                </div>

                {/* Milestones list */}
                <div className="space-y-3 pt-1">
                  {/* Card Collector */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Layers className="h-3 w-3 text-amber-600 dark:text-amber-400" /> Card
                        Collector
                      </span>
                      <span className="text-foreground font-mono">
                        {stats?.totalCards ?? 0} /{" "}
                        {(stats?.totalCards ?? 0) < 5
                          ? 5
                          : (stats?.totalCards ?? 0) < 10
                            ? 10
                            : (stats?.totalCards ?? 0) < 25
                              ? 25
                              : (stats?.totalCards ?? 0) < 50
                                ? 50
                                : 100}
                      </span>
                    </div>
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-white/5 dark:bg-white/5">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-500"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(
                            ((stats?.totalCards ?? 0) /
                              ((stats?.totalCards ?? 0) < 5
                                ? 5
                                : (stats?.totalCards ?? 0) < 10
                                  ? 10
                                  : (stats?.totalCards ?? 0) < 25
                                    ? 25
                                    : (stats?.totalCards ?? 0) < 50
                                      ? 50
                                      : 100)) *
                              100,
                            100
                          )}%`,
                        }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                      />
                    </div>
                  </div>

                  {/* Wealth Accumulator */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Wallet className="h-3 w-3 text-purple-600 dark:text-purple-400" /> Wealth
                        Accumulator
                      </span>
                      <span className="text-foreground font-mono">
                        {balanceData?.credits ?? 0} /{" "}
                        {(balanceData?.credits ?? 0) < 1000
                          ? 1000
                          : (balanceData?.credits ?? 0) < 5000
                            ? 5000
                            : (balanceData?.credits ?? 0) < 10000
                              ? 10000
                              : 25000}
                      </span>
                    </div>
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100 dark:border-white/5 dark:bg-white/5">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(
                            ((balanceData?.credits ?? 0) /
                              ((balanceData?.credits ?? 0) < 1000
                                ? 1000
                                : (balanceData?.credits ?? 0) < 5000
                                  ? 5000
                                  : (balanceData?.credits ?? 0) < 10000
                                    ? 10000
                                    : 25000)) *
                              100,
                            100
                          )}%`,
                        }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Navigation Button */}
                <div className="border-t border-slate-200 pt-3 dark:border-white/5">
                  <Link href="/achievements" className="block w-full">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-muted-foreground hover:text-foreground h-7 w-full border-slate-200 text-[10px] font-bold hover:bg-slate-100 dark:border-white/10 dark:hover:bg-white/5"
                    >
                      <Trophy className="mr-1.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      View Constellation
                    </Button>
                  </Link>
                </div>
              </div>
            </CutoutCardContent>
          </CutoutCard>
        </div>
      </div>

      {/* Claim Celebration Modal Overlay */}
      <AnimatePresence>
        {showCoinExplosion && (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            {/* Drifting Gold Coins */}
            <div className="relative">
              {particles.map((p) => (
                <motion.div
                  key={p.id}
                  className="absolute flex h-6 w-6 items-center justify-center rounded-full border border-amber-300 bg-gradient-to-br from-amber-400 to-yellow-500 p-1 text-amber-950 shadow-[0_0_8px_rgba(245,158,11,0.5)] select-none"
                  initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                  animate={{
                    x: p.x,
                    y: p.y,
                    scale: p.scale,
                    opacity: [1, 1, 0],
                    rotate: p.rotate,
                  }}
                  transition={{ duration: 2.5, ease: "easeOut" }}
                >
                  <IxCreditsSymbol className="h-full w-full" strokeWidth={3.5} />
                </motion.div>
              ))}

              {/* Central Celebration Bubble */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [0.8, 1.05, 1], opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="relative flex flex-col items-center rounded-2xl border border-amber-500/35 border-t-amber-400/50 bg-slate-950/95 px-10 py-7 text-center shadow-[0_0_40px_rgba(245,158,11,0.25)]"
              >
                <div className="animate-bounce text-4xl">🎁</div>
                <h3 className="mt-3 text-sm font-bold tracking-wider text-amber-400 uppercase">
                  Daily Bonus Claimed!
                </h3>
                <p className="mt-2 flex items-center justify-center gap-1 font-mono text-3xl font-extrabold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
                  +<IxCreditsSymbol className="h-7 w-7 shrink-0 text-amber-400" />
                  {claimedBonusAmount}
                </p>
                <p className="mt-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                  Added to Vault Balance
                </p>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
