// @ts-nocheck
"use client";

import { useMemo } from "react";
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
} from "lucide-react";
import { useVaultStats } from "~/hooks/vault/useVaultStats";
import { useRecentActivity } from "~/hooks/vault/useRecentActivity";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { vaultNotify } from "~/lib/vault-notifications";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import NumberFlow from "~/components/ui/number-flow";
import { cn } from "~/lib/utils";
import { CardDisplay } from "~/components/cards/CardDisplay";
import type { CardInstance } from "~/types/cards-display";
import type { VaultSection } from "../VaultSidebarNav";

interface VaultDashboardSectionProps {
  onNavigate?: (section: VaultSection) => void;
}

export function VaultDashboardSection({ onNavigate }: VaultDashboardSectionProps) {
  const { user } = useUser();
  const { stats, loading: statsLoading, refreshing } = useVaultStats();
  const { activities, loading: activitiesLoading } = useRecentActivity();

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

  const { data: topCardsData, isLoading: topCardsLoading } = api.cards.getMyCards.useQuery(
    { sortBy: "value" },
    { enabled: !!user }
  );

  const featuredCards: CardInstance[] = useMemo(
    () =>
      topCardsData?.slice(0, 3).map((ownership: any) => ({
        id: ownership.id,
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
      vaultNotify.dailyBonusClaimed(data.message);
      void refetchBalance();
    },
    onError: (error) => {
      vaultNotify.error(error.message);
    },
  });

  const loading = statsLoading || activitiesLoading || earningsLoading;

  return (
    <div className="space-y-4">
      {/* Stats Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "Total Cards",
            value: stats?.totalCards ?? 0,
            icon: Layers,
            color: "text-amber-400",
          },
          {
            label: refreshing ? "Syncing Values..." : "Deck Value",
            value: stats?.deckValue ?? 0,
            icon: TrendingUp,
            color: "text-purple-400",
            suffix: " IxC",
          },
          {
            label: "Unopened Packs",
            value: stats?.unopenedPacks ?? 0,
            icon: Package,
            color: "text-blue-400",
          },
          {
            label: "Active Auctions",
            value: stats?.activeAuctions ?? 0,
            icon: ShoppingBag,
            color: "text-cyan-400",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="glass-hierarchy-child flex items-center gap-2.5 rounded-lg p-2.5"
          >
            <stat.icon className={cn("h-3.5 w-3.5 flex-shrink-0", stat.color)} />
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground truncate text-[0.65rem]">{stat.label}</p>
              {statsLoading ? (
                <Skeleton className="h-5 w-12" />
              ) : (
                <p className={cn("text-lg leading-tight font-bold", stat.color)}>
                  <NumberFlow value={stat.value} />
                  {stat.suffix ?? ""}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions + Earnings */}
      <div className="grid gap-3 md:grid-cols-2">
        {/* Quick Actions */}
        <Card className="glass-hierarchy-child p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold">Quick Actions</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                title: "Market",
                icon: ShoppingCart,
                section: "acquire" as VaultSection,
                color: "text-blue-400",
              },
              {
                title: "My Cards",
                icon: Layers,
                section: "cards" as VaultSection,
                color: "text-amber-400",
              },
              {
                title: "Import NS",
                icon: Gift,
                section: "import" as VaultSection,
                color: "text-cyan-400",
              },
            ].map((action) => (
              <button
                key={action.title}
                onClick={() => onNavigate?.(action.section)}
                className="glass-hierarchy-interactive flex items-center gap-2 rounded-lg p-2.5 text-left transition-all hover:scale-[1.02]"
              >
                <action.icon className={cn("h-4 w-4 flex-shrink-0", action.color)} />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold">{action.title}</span>
                  {action.badge != null && action.badge > 0 && (
                    <Badge variant="outline" className="ml-1.5 px-1 py-0 text-[9px]">
                      {action.badge}
                    </Badge>
                  )}
                </div>
                <ArrowRight className="text-muted-foreground h-3 w-3" />
              </button>
            ))}
          </div>
        </Card>

        {/* Today's Earnings + Login Streak */}
        <Card className="glass-hierarchy-child p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold">Today&apos;s Earnings</span>
          </div>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-lg font-bold text-amber-400">
                +<NumberFlow value={earningsData?.total ?? 0} /> IxC
              </div>
              {earningsData?.sources?.map((source, i) => (
                <div
                  key={`${source.type}-${i}`}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-muted-foreground">{source.label}</span>
                  <span className="font-semibold text-amber-400">
                    +{source.amount.toLocaleString()}
                  </span>
                </div>
              ))}
              {/* Login Streak inline */}
              <div className="border-border mt-2 flex items-center justify-between border-t pt-2">
                <div className="flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-orange-400" />
                  <span className="text-xs font-semibold">Login Streak</span>
                </div>
                <span className="text-sm font-bold text-orange-400">
                  {balanceData?.loginStreak ?? 0} days
                </span>
              </div>
              {balanceData?.canClaimDailyBonus && (
                <Button
                  size="sm"
                  onClick={() => claimDailyBonus.mutate()}
                  disabled={claimDailyBonus.isPending}
                  className="w-full text-xs"
                >
                  Claim Daily Bonus
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Unopened Packs CTA - Removed */}

      {/* Featured Cards */}
      <Card className="glass-hierarchy-child p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold">Top Cards</span>
          </div>
          {featuredCards.length > 0 && (
            <button
              onClick={() => onNavigate?.("cards")}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[0.65rem] transition-colors"
            >
              View All <ArrowRight className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
        {topCardsLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : featuredCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6">
            <Layers className="text-muted-foreground/40 mb-2 h-8 w-8" />
            <p className="text-foreground/80 text-xs font-semibold">No Cards Yet</p>
            <p className="text-muted-foreground mb-2 text-[0.6rem]">
              Import your NationStates cards to get started
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigate?.("import")}
              className="text-xs"
            >
              <Download className="mr-1.5 h-3 w-3" /> Import NS Cards
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-3">
            {featuredCards.map((card) => (
              <div
                key={card.id}
                className="glass-hierarchy-child flex w-full flex-col items-center rounded-lg p-3"
              >
                <CardDisplay
                  card={card}
                  size="medium"
                  performanceMode
                  enable3D={false}
                  enableHolographic={false}
                />
                <p className="mt-2 text-xs font-bold text-amber-400">
                  {card.marketValue.toLocaleString()} IxC
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Activity */}
      <Card className="glass-hierarchy-child p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-xs font-semibold">Recent Activity</span>
        </div>
        {loading ? (
          <div className="space-y-1.5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : !activities || activities.length === 0 ? (
          <p className="text-muted-foreground py-3 text-center text-xs">No recent activity</p>
        ) : (
          <div className="space-y-1">
            {activities.slice(0, 8).map((activity) => {
              const isPositive = activity.type.startsWith("EARN_");
              return (
                <div
                  key={activity.id}
                  className="flex items-center justify-between rounded px-1.5 py-1 text-xs hover:bg-white/5"
                >
                  <div className="flex items-center gap-1.5">
                    {isPositive ? (
                      <ArrowUp className="h-3 w-3 text-green-400" />
                    ) : (
                      <ArrowDown className="h-3 w-3 text-red-400" />
                    )}
                    <span className="text-muted-foreground">{activity.source}</span>
                  </div>
                  <span
                    className={cn("font-semibold", isPositive ? "text-green-400" : "text-red-400")}
                  >
                    {isPositive ? "+" : "-"}
                    {Math.abs(activity.amount).toLocaleString()} IxC
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
