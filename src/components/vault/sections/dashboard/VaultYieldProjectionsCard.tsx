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
import { Card, CardTitle } from "~/components/ui/card";

interface VaultYieldProjectionsCardProps {
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

/** Daily earning allowance: credits used of the cap, or a dash when the cap is not loaded. */
function CapProgress({
  label,
  data,
  loading,
  symbolClassName,
  barClassName,
}: {
  label: string;
  data?: { cap: number; remaining: number } | null;
  loading?: boolean;
  symbolClassName: string;
  barClassName: string;
}) {
  const used = data ? Math.round(data.cap - data.remaining) : null;

  return (
    <div className="space-y-2">
      <div className="text-footnote flex justify-between font-semibold">
        <span className="text-label-secondary">{label}</span>
        <span className="text-label text-footnote flex items-center gap-0.5 font-semibold tabular-nums">
          {loading ? (
            "..."
          ) : data ? (
            <>
              <IxCreditsSymbol aria-hidden className={`${symbolClassName} h-2.5 w-2.5 shrink-0`} />
              {used} / {data.cap}
            </>
          ) : (
            <span aria-label="Not recorded">–</span>
          )}
        </span>
      </div>
      <div className="border-separator bg-fill-3 h-2 w-full overflow-hidden rounded-full border p-0.5">
        <div
          className={`${barClassName} ease-out-facet h-full rounded-full transition-[width] duration-500`}
          style={{
            width: `${data && data.cap > 0 ? ((data.cap - data.remaining) / data.cap) * 100 : 0}%`,
          }}
        />
      </div>
    </div>
  );
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
    <Card padding="lg" className="overflow-hidden">
      <div className="border-separator mb-5 flex items-center justify-between border-b pb-4">
        <CardTitle icon={<TrendingUp />}>Treasury revenue &amp; yields</CardTitle>
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
              <span className="text-label-secondary text-footnote block font-medium">
                Treasury revenue forecasts
              </span>
              <div className="space-y-2">
                <div className="text-footnote flex items-center justify-between">
                  <span className="text-label-secondary font-medium">Daily treasury yield</span>
                  <span className="text-blue-ink flex items-center gap-0.5 font-semibold tabular-nums">
                    +<IxCreditsSymbol aria-hidden className="h-3 w-3 shrink-0" />
                    {passiveIncomeData
                      ? Math.round(passiveIncomeData.dailyDividend ?? 0).toLocaleString()
                      : "–"}
                  </span>
                </div>
                <div className="text-footnote flex items-center justify-between">
                  <span className="text-label-secondary font-medium">Weekly treasury yield</span>
                  <span className="text-label flex items-center gap-0.5 font-semibold tabular-nums">
                    ~<IxCreditsSymbol aria-hidden className="h-3 w-3 shrink-0" />
                    {passiveIncomeData
                      ? Math.round(passiveIncomeData.weeklyDividend ?? 0).toLocaleString()
                      : "–"}
                  </span>
                </div>
                <div className="text-footnote flex items-center justify-between">
                  <span className="text-label-secondary font-medium">Monthly treasury yield</span>
                  <span className="text-label flex items-center gap-0.5 font-semibold tabular-nums">
                    ~<IxCreditsSymbol aria-hidden className="h-3 w-3 shrink-0" />
                    {passiveIncomeData
                      ? Math.round(passiveIncomeData.monthlyDividend ?? 0).toLocaleString()
                      : "–"}
                  </span>
                </div>
              </div>
            </div>

            {/* active multipliers */}
            <div className="md:border-separator space-y-3 md:border-l md:pl-6">
              <span className="text-label-secondary text-footnote block font-medium">
                Active multipliers &amp; streaks
              </span>
              <div className="space-y-2">
                <div className="text-footnote flex items-center justify-between">
                  <span className="text-label-secondary flex items-center gap-2 font-medium">
                    <Flame aria-hidden className="fill-orange/20 text-orange h-3.5 w-3.5" /> Active
                    streak
                  </span>
                  <span className="text-orange-ink font-semibold">
                    <span className="tabular-nums">{loginStreak}</span> days
                  </span>
                </div>
                <div className="text-footnote flex items-center justify-between">
                  <span className="text-label-secondary font-medium">Budget multiplier</span>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
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
                  <span className="text-yellow-ink font-semibold tabular-nums">
                    1.{vaultLevel * 5}x
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Allowances (Earning Caps) */}
          <div className="border-separator mt-5 space-y-3 border-t pt-5">
            <span className="text-label-secondary text-footnote block font-medium">
              Daily allowance progress
            </span>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <CapProgress
                label="Active gameplay"
                data={activeCapData}
                loading={activeCapLoading}
                symbolClassName="text-green"
                barClassName="bg-green"
              />
              <CapProgress
                label="Social engagement"
                data={socialCapData}
                loading={socialCapLoading}
                symbolClassName="text-indigo"
                barClassName="bg-indigo"
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
