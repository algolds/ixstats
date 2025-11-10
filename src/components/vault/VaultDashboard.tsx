"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import {
  TrendingUp,
  Package,
  ShoppingBag,
  Layers,
  Calendar,
  Flame,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";
import { cn } from "~/lib/utils";

interface EarningSource {
  type: string;
  label: string;
  amount: number;
}

interface RecentActivity {
  id: string;
  type: string;
  amount: number;
  source: string;
  createdAt: Date;
}

interface VaultStats {
  totalCards: number;
  deckValue: number;
  unopenedPacks: number;
  activeAuctions: number;
}

interface VaultDashboardProps {
  stats?: VaultStats;
  todayEarnings?: {
    total: number;
    sources: EarningSource[];
  };
  recentActivity?: RecentActivity[];
  loginStreak?: number;
  dailyBonusAvailable?: boolean;
  loading?: boolean;
  onClaimDailyBonus?: () => void;
}

export function VaultDashboard({
  stats,
  todayEarnings,
  recentActivity,
  loginStreak = 0,
  dailyBonusAvailable = false,
  loading = false,
  onClaimDailyBonus,
}: VaultDashboardProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Quick stats grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-hierarchy-child">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Cards</CardTitle>
            <Layers className="h-3 w-3 sm:h-4 sm:w-4 text-gold-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-6 sm:h-8 w-16 sm:w-24" />
            ) : (
              <div className="text-xl sm:text-2xl font-bold text-gold-400">
                {stats?.totalCards ?? 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground">In your collection</p>
          </CardContent>
        </Card>

        <Card className="glass-hierarchy-child">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Deck Value</CardTitle>
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-6 sm:h-8 w-16 sm:w-24" />
            ) : (
              <div className="text-xl sm:text-2xl font-bold text-green-400">
                {stats?.deckValue.toLocaleString() ?? 0} IxC
              </div>
            )}
            <p className="text-xs text-muted-foreground">Total market value</p>
          </CardContent>
        </Card>

        <Card className="glass-hierarchy-child">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Unopened Packs</CardTitle>
            <Package className="h-3 w-3 sm:h-4 sm:w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-6 sm:h-8 w-16 sm:w-24" />
            ) : (
              <div className="text-xl sm:text-2xl font-bold text-purple-400">
                {stats?.unopenedPacks ?? 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Ready to open</p>
          </CardContent>
        </Card>

        <Card className="glass-hierarchy-child">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Active Auctions</CardTitle>
            <ShoppingBag className="h-3 w-3 sm:h-4 sm:w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-6 sm:h-8 w-16 sm:w-24" />
            ) : (
              <div className="text-xl sm:text-2xl font-bold text-blue-400">
                {stats?.activeAuctions ?? 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground">In the market</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's earnings */}
      <Card className="glass-hierarchy-child">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gold-400" />
            Today&apos;s Earnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : (
            <>
              <div className="mb-4 text-2xl sm:text-3xl font-bold text-gold-400">
                +{todayEarnings?.total.toLocaleString() ?? 0} IxC
              </div>
              <div className="space-y-2">
                {todayEarnings?.sources.map((source) => (
                  <div
                    key={source.type}
                    className="flex items-center justify-between rounded-lg bg-white/5 p-3"
                  >
                    <span className="text-sm">{source.label}</span>
                    <span className="font-semibold text-gold-400">
                      +{source.amount.toLocaleString()} IxC
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
        {/* Login streak */}
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-400" />
              Login Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-3xl sm:text-4xl font-bold text-orange-400">
              {loginStreak} days
            </div>
            {dailyBonusAvailable && onClaimDailyBonus && (
              <button
                onClick={onClaimDailyBonus}
                className="w-full rounded-lg bg-gradient-to-r from-gold-500 to-orange-500 px-3 sm:px-4 py-2 text-sm sm:text-base font-semibold text-black transition-all hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-gold-500/50 touch-manipulation"
              >
                Claim Daily Bonus
              </button>
            )}
            {!dailyBonusAvailable && (
              <p className="text-sm text-muted-foreground">
                Come back tomorrow to claim your next bonus
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="glass-hierarchy-child">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-400" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {recentActivity?.slice(0, 10).map((activity) => {
                  const isPositive = activity.type.startsWith("EARN_");
                  const Icon = isPositive ? ArrowUp : isPositive === false ? ArrowDown : Minus;

                  return (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between rounded-lg bg-white/5 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            isPositive ? "text-green-400" : "text-red-400"
                          )}
                        />
                        <span className="text-sm">{activity.source}</span>
                      </div>
                      <span
                        className={cn(
                          "font-semibold",
                          isPositive ? "text-green-400" : "text-red-400"
                        )}
                      >
                        {isPositive ? "+" : "-"}
                        {Math.abs(activity.amount).toLocaleString()} IxC
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
