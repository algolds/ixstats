"use client";

import React from "react";
import { TrendingUp, Flame, Gift, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { IxCreditsSymbol } from "../../IxCreditsSymbol";

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
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl backdrop-blur-2xl transition-all duration-300 border-t-white/20 dark:bg-black/60 dark:border-white/12 dark:border-t-white/25 hover:border-blue-500/30 hover:shadow-blue-500/10"
      )}
    >
      <TextureOverlay texture="horizontalLines" opacity={0.04} />

      <div className="relative z-10 mb-5 flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 shadow-sm backdrop-blur-md">
            <TrendingUp className="h-4.5 w-4.5 text-blue-400" />
          </div>
          <span className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
            Treasury Revenue & Yields
          </span>
        </div>
        {canClaimDailyBonus && (
          <Button
            size="sm"
            onClick={onClaimDailyBonus}
            disabled={isClaimPending}
            className="h-8 rounded-full border border-amber-300/40 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 px-4 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 backdrop-blur-md transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            {isClaimPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-slate-950" />
                Claiming...
              </>
            ) : (
              <>
                <Gift className="mr-1.5 h-3.5 w-3.5 text-slate-950" />
                Claim Daily Bonus
              </>
            )}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-5 w-1/3 rounded-lg bg-white/5" />
          <Skeleton className="h-12 w-full rounded-xl bg-white/5" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Projections */}
            <div className="space-y-3">
              <span className="block text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
                Treasury Revenue Forecasts
              </span>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Daily Treasury Yield</span>
                  <span className="flex items-center gap-0.5 font-mono font-bold text-blue-400">
                    +<IxCreditsSymbol className="h-3 w-3 shrink-0" />
                    {passiveIncomeData?.dailyDividend ? Math.round(passiveIncomeData.dailyDividend).toLocaleString() : "0"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Weekly Treasury Yield</span>
                  <span className="flex items-center gap-0.5 font-mono font-bold text-slate-200">
                    ~<IxCreditsSymbol className="h-3 w-3 shrink-0" />
                    {passiveIncomeData?.weeklyDividend ? Math.round(passiveIncomeData.weeklyDividend).toLocaleString() : "0"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Monthly Treasury Yield</span>
                  <span className="flex items-center gap-0.5 font-mono font-bold text-slate-200">
                    ~<IxCreditsSymbol className="h-3 w-3 shrink-0" />
                    {passiveIncomeData?.monthlyDividend ? Math.round(passiveIncomeData.monthlyDividend).toLocaleString() : "0"}
                  </span>
                </div>
              </div>
            </div>

            {/* active multipliers */}
            <div className="space-y-3 md:border-l md:border-white/10 md:pl-6">
              <span className="block text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
                Active Multipliers & Streaks
              </span>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-slate-400">
                    <Flame className="h-3.5 w-3.5 fill-orange-500/20 text-orange-400" />{" "}
                    Active Streak
                  </span>
                  <span className="font-bold text-orange-400">
                    {loginStreak} Days
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Budget Multiplier</span>
                  <span
                    className={cn(
                      "font-mono font-bold",
                      budgetMultiplierPercent > 0
                        ? "text-emerald-400"
                        : budgetMultiplierPercent < 0
                          ? "text-rose-400"
                          : "text-slate-400"
                    )}
                  >
                    {budgetMultiplierPercent > 0 ? "+" : ""}
                    {budgetMultiplierPercent}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Tier Bonus</span>
                  <span className="font-mono font-bold text-purple-400">
                    1.{vaultLevel * 5}x
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Allowances (Earning Caps) */}
          <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
            <span className="block text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
              Daily Allowance Progress
            </span>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Active Gameplay Cap */}
              <div className="space-y-2">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span className="text-slate-400">Active Gameplay</span>
                  <span className="flex items-center gap-0.5 font-mono text-[11px] font-bold text-white">
                    {activeCapLoading ? (
                      "..."
                    ) : (
                      <>
                        <IxCreditsSymbol className="h-2.5 w-2.5 shrink-0 text-emerald-400" />
                        {Math.round(
                          (activeCapData?.cap ?? 100) - (activeCapData?.remaining ?? 100)
                        )}{" "}
                        / {activeCapData?.cap ?? 100}
                      </>
                    )}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-white/5 p-0.5 backdrop-blur-md">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    style={{
                      width: `${activeCapData ? ((activeCapData.cap - activeCapData.remaining) / activeCapData.cap) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Social Earning Cap */}
              <div className="space-y-2">
                <div className="flex justify-between text-[11px] font-semibold">
                  <span className="text-slate-400">Social Engagement</span>
                  <span className="flex items-center gap-0.5 font-mono text-[11px] font-bold text-white">
                    {socialCapLoading ? (
                      "..."
                    ) : (
                      <>
                        <IxCreditsSymbol className="h-2.5 w-2.5 shrink-0 text-indigo-400" />
                        {Math.round(
                          (socialCapData?.cap ?? 50) - (socialCapData?.remaining ?? 50)
                        )}{" "}
                        / {socialCapData?.cap ?? 50}
                      </>
                    )}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-white/5 p-0.5 backdrop-blur-md">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-400 transition-all duration-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
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
    </div>
  );
}
