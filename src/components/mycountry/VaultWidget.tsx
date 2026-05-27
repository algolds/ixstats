/**
 * VaultWidget Component
 *
 * Displays IxCredits balance and today's earnings 
 * - Real-time balance display
 * - Today's earnings breakdown
 * - Link to full vault page
 */

"use client";

import React, { useState } from "react";
import { api } from "~/trpc/react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { cn } from "~/lib/utils";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";

export function VaultWidget() {
  const { userId } = useAuth();
  const [showPassiveIncome, setShowPassiveIncome] = useState(false);

  // Get user's country to calculate vault data
  const { data: userData } = api.users.getProfile.useQuery(undefined, {
    enabled: !!userId,
  });

  const { data: balanceData, isLoading: balanceLoading } = api.vault.getBalance.useQuery(
    { userId: userId ?? "" },
    {
      enabled: !!userId && !!userData?.countryId,
      refetchInterval: 30000, // Auto-refresh every 30s
    }
  );

  const { data: todayEarnings } = api.vault.getTodayEarnings.useQuery(undefined, {
    enabled: !!userId && !!userData?.countryId,
  });

  const { data: passiveIncomeData } = api.vault.calculatePassiveIncome.useQuery(
    { countryId: userData?.countryId ?? "" },
    {
      enabled: !!userData?.countryId,
      refetchInterval: 300000, // Refresh every 5 minutes
    }
  );

  // Get budget multiplier data
  const { data: budgetMultiplierData } = api.vault.getBudgetMultiplier.useQuery(
    { countryId: userData?.countryId ?? "" },
    {
      enabled: !!userData?.countryId,
      refetchInterval: 300000, // Refresh every 5 minutes
    }
  );

  // Hide widget for unsigned users or users without a country
  if (!userId || !userData?.countryId) {
    return null;
  }

  return (
    <CutoutCard className={cn(cutoutCardSurfaceClassName, "rounded-xl overflow-hidden")}
      trackPointerHover={false}
    >
      {/* Cutout tab header */}
      <div className="relative bg-yellow-500/10 px-2.5 pt-2.5 pb-4">
        <div className="flex items-center gap-1.5 text-xs font-bold text-card-foreground">
          <svg
            className="h-3.5 w-3.5 text-yellow-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          MyVault
        </div>
        <CutoutCorner className="absolute -bottom-px left-0 text-card" size={16} />
        <CutoutCorner className="absolute -bottom-px right-0 -scale-x-100 text-card" size={16} />
      </div>
      <CutoutCardContent className="space-y-2.5 p-2.5 pt-1">

      <div className="space-y-2.5">
        {/* Balance */}
        <div>
          <p className="text-muted-foreground text-xs">IxCredits</p>
          <div className="flex items-center gap-1.5">
            <p className="text-lg font-bold text-yellow-500">
              {balanceLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                (balanceData?.credits.toLocaleString() ?? 0)
              )}
            </p>
            {passiveIncomeData && passiveIncomeData.dailyDividend > 0 && (
              <button
                onClick={() => setShowPassiveIncome((prev) => !prev)}
                className={`text-blue-500 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300 transition-colors p-0.5 rounded hover:bg-blue-500/10 focus:outline-none focus:ring-1 focus:ring-blue-500/30 ${showPassiveIncome ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : ""
                  }`}
                title={showPassiveIncome ? "Hide Passive Income Details" : "Show Passive Income Details"}
                aria-label={showPassiveIncome ? "Hide Passive Income Details" : "Show Passive Income Details"}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Today's Earnings */}
        {todayEarnings && todayEarnings.sources.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-1 text-xs">Today&apos;s Earnings</p>
            <div className="space-y-0.5 text-xs">
              {todayEarnings.sources.map((source) => (
                <div key={source.type} className="text-muted-foreground flex justify-between">
                  <span>{source.label}</span>
                  <span className="text-green-600 dark:text-green-400">+{source.amount}</span>
                </div>
              ))}
              <div className="border-border flex justify-between border-t pt-1 font-semibold">
                <span className="text-foreground">Total</span>
                <span className="text-yellow-500">+{todayEarnings.total}</span>
              </div>
            </div>
          </div>
        )}

        {/* Passive Income Projection */}
        {showPassiveIncome && passiveIncomeData && passiveIncomeData.dailyDividend > 0 && (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200 rounded-lg border border-blue-300 bg-blue-50 p-2 dark:border-blue-500/30 dark:bg-blue-900/20">
            <p className="mb-1 flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-300">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Passive Income
            </p>
            <div className="text-muted-foreground space-y-0.5 text-xs">
              <div className="flex justify-between">
                <span>Daily</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  +{passiveIncomeData.dailyDividend.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-[0.65rem]">
                <span className="text-muted-foreground">Weekly</span>
                <span className="text-muted-foreground">
                  ~{passiveIncomeData.weeklyDividend.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-[0.65rem]">
                <span className="text-muted-foreground">Monthly</span>
                <span className="text-muted-foreground">
                  ~{passiveIncomeData.monthlyDividend.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Budget Multiplier Bonus */}
            {budgetMultiplierData && (
              <div className="mt-1.5 rounded border border-yellow-300 bg-yellow-50 p-1.5 dark:border-yellow-500/30 dark:bg-yellow-900/20">
                <div className="flex items-center justify-between text-[0.65rem]">
                  <span className="text-yellow-700 dark:text-yellow-300">Budget Bonus</span>
                  <span
                    className={`font-semibold ${budgetMultiplierData.percentChange > 0
                        ? "text-green-600 dark:text-green-400"
                        : budgetMultiplierData.percentChange < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-muted-foreground"
                      }`}
                  >
                    {budgetMultiplierData.percentChange > 0 ? "+" : ""}
                    {budgetMultiplierData.percentChange}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Vault Level — compact inline */}
        {balanceData && (
          <div className="flex items-center justify-between rounded-md bg-purple-500/10 px-2 py-1 text-[10px]">
            <span className="flex items-center gap-1 font-semibold text-purple-400">
              <svg
                className="h-3 w-3 text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              Lv.{balanceData.vaultLevel}
            </span>
            <span className="text-muted-foreground text-[9px]">
              {balanceData.vaultXp % 1000}/1k XP
            </span>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex flex-col gap-1.5">
          <Link
            href="/vault"
            className="block text-center text-[0.65rem] text-blue-600 transition-colors hover:text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            View Full Vault →
          </Link>
        </div>
      </div>
      </CutoutCardContent>
    </CutoutCard>
  );
}
