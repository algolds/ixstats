"use client";

import React from "react";
import {
  StatUp as TrendingUp,
  FireFlame as Flame,
  Gift,
  SystemRestart as Loader2,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";
import { Card } from "~/components/ui/card";

export interface VaultYieldProjectionsCardProps {
  loading: boolean;
  canClaimDailyBonus?: boolean;
  isClaimPending?: boolean;
  onClaimDailyBonus: () => void;
  passiveIncomeData?: {
    dailyDividend?: number;
    weeklyDividend?: number;
    monthlyDividend?: number;
  } | null;
  loginStreak?: number;
  budgetMultiplierPercent?: number;
  vaultLevel?: number;
  activeCapLoading?: boolean;
  activeCapData?: { cap: number; remaining: number } | null;
  socialCapLoading?: boolean;
  socialCapData?: { cap: number; remaining: number } | null;
}

export function VaultYieldProjectionsCard({
  loading,
  canClaimDailyBonus,
  isClaimPending,
  onClaimDailyBonus,
  passiveIncomeData,
  loginStreak = 0,
  budgetMultiplierPercent = 0,
  vaultLevel = 1,
  activeCapLoading,
  activeCapData,
  socialCapLoading,
  socialCapData,
}: VaultYieldProjectionsCardProps) {
  return (
    // v2 (c5c6b382): a glass feature card that lifts on hover.
    <Card variant="hero" padding="lg" className="overflow-hidden">
      <div className="border-separator mb-5 flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-2">
          <div className="rounded-row border-blue/30 bg-blue/15 text-blue shadow-card flex h-8 w-8 items-center justify-center border">
            <TrendingUp aria-hidden className="text-blue h-4.5 w-4.5" />
          </div>
          <span className="text-label-secondary text-eyebrow">Treasury revenue & yields</span>
        </div>
        {canClaimDailyBonus && (
          <Button
            size="sm"
            onClick={onClaimDailyBonus}
            disabled={isClaimPending}
            className="border-yellow/40 rounded-full border px-4 hover:brightness-110 disabled:opacity-50"
          >
            {isClaimPending ? (
              <>
                <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                Claiming...
              </>
            ) : (
              <>
                <Gift aria-hidden className="h-3.5 w-3.5" />
                Claim daily bonus
              </>
            )}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="bg-fill-3 rounded-control h-5 w-1/3" />
          <Skeleton className="bg-fill-3 rounded-row h-12 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Projections */}
            <div className="space-y-3">
              <span className="text-label-secondary text-eyebrow block">
                Treasury revenue forecasts
              </span>
              <div className="space-y-2">
                <div className="text-footnote flex items-center justify-between">
                  <span className="text-label-secondary font-medium">Daily treasury yield</span>
                  <span className="text-blue-ink font-data flex items-center gap-0.5 font-semibold tabular-nums">
                    +<IxCreditsSymbol aria-hidden className="h-3 w-3 shrink-0" />
                    {passiveIncomeData?.dailyDividend
                      ? Math.round(passiveIncomeData.dailyDividend).toLocaleString()
                      : "0"}
                  </span>
                </div>
                <div className="text-footnote flex items-center justify-between">
                  <span className="text-label-secondary font-medium">Weekly treasury yield</span>
                  <span className="text-label font-data flex items-center gap-0.5 font-semibold tabular-nums">
                    ~<IxCreditsSymbol aria-hidden className="h-3 w-3 shrink-0" />
                    {passiveIncomeData?.weeklyDividend
                      ? Math.round(passiveIncomeData.weeklyDividend).toLocaleString()
                      : "0"}
                  </span>
                </div>
                <div className="text-footnote flex items-center justify-between">
                  <span className="text-label-secondary font-medium">Monthly treasury yield</span>
                  <span className="text-label font-data flex items-center gap-0.5 font-semibold tabular-nums">
                    ~<IxCreditsSymbol aria-hidden className="h-3 w-3 shrink-0" />
                    {passiveIncomeData?.monthlyDividend
                      ? Math.round(passiveIncomeData.monthlyDividend).toLocaleString()
                      : "0"}
                  </span>
                </div>
              </div>
            </div>

            {/* active multipliers */}
            <div className="md:border-separator space-y-3 md:border-l md:pl-6">
              <span className="text-label-secondary text-eyebrow block">
                Active multipliers & streaks
              </span>
              <div className="space-y-2">
                <div className="text-footnote flex items-center justify-between">
                  <span className="text-label-secondary flex items-center gap-2 font-medium">
                    <Flame aria-hidden className="fill-orange/20 text-orange h-3.5 w-3.5" /> Active
                    streak
                  </span>
                  <span className="text-orange-ink font-semibold">
                    <span className="font-data tabular-nums">{loginStreak}</span> days
                  </span>
                </div>
                <div className="text-footnote flex items-center justify-between">
                  <span className="text-label-secondary font-medium">Budget multiplier</span>
                  <span
                    className={cn(
                      "font-data font-semibold tabular-nums",
                      budgetMultiplierPercent > 0
                        ? "text-green-ink"
                        : budgetMultiplierPercent < 0
                          ? "text-red-ink"
                          : "text-label-secondary"
                    )}
                  >
                    {budgetMultiplierPercent > 0 ? "+" : ""}
                    {budgetMultiplierPercent}%
                  </span>
                </div>
                <div className="text-footnote flex items-center justify-between">
                  <span className="text-label-secondary font-medium">Tier bonus</span>
                  <span className="text-yellow-ink font-data font-semibold tabular-nums">
                    1.{vaultLevel * 5}x
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Allowances (Earning Caps) */}
          <div className="border-separator mt-5 space-y-3 border-t pt-5">
            <span className="text-label-secondary text-eyebrow block">
              Daily allowance progress
            </span>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Active Gameplay Cap */}
              <div className="space-y-2">
                <div className="text-footnote flex justify-between font-semibold">
                  <span className="text-label-secondary">Active gameplay</span>
                  <span className="text-label text-footnote font-data flex items-center gap-0.5 font-semibold tabular-nums">
                    {activeCapLoading ? (
                      "..."
                    ) : (
                      <>
                        <IxCreditsSymbol aria-hidden className="text-green h-2.5 w-2.5 shrink-0" />
                        {Math.round(
                          (activeCapData?.cap ?? 100) - (activeCapData?.remaining ?? 100)
                        )}{" "}
                        / {activeCapData?.cap ?? 100}
                      </>
                    )}
                  </span>
                </div>
                <div className="border-separator bg-fill-3 h-2 w-full overflow-hidden rounded-full border p-0.5">
                  <div
                    className="bg-green ease-out-facet h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${activeCapData ? ((activeCapData.cap - activeCapData.remaining) / activeCapData.cap) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Social Earning Cap */}
              <div className="space-y-2">
                <div className="text-footnote flex justify-between font-semibold">
                  <span className="text-label-secondary">Social engagement</span>
                  <span className="text-label text-footnote font-data flex items-center gap-0.5 font-semibold tabular-nums">
                    {socialCapLoading ? (
                      "..."
                    ) : (
                      <>
                        <IxCreditsSymbol aria-hidden className="text-indigo h-2.5 w-2.5 shrink-0" />
                        {Math.round(
                          (socialCapData?.cap ?? 50) - (socialCapData?.remaining ?? 50)
                        )}{" "}
                        / {socialCapData?.cap ?? 50}
                      </>
                    )}
                  </span>
                </div>
                <div className="border-separator bg-fill-3 h-2 w-full overflow-hidden rounded-full border p-0.5">
                  <div
                    className="bg-indigo ease-out-facet h-full rounded-full transition-[width] duration-500"
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
    </Card>
  );
}
