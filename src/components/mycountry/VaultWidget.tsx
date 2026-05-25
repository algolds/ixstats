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

function MiniProgressCircle({
  progress,
  colorClass = "stroke-purple-500",
}: {
  progress: number;
  colorClass?: string;
}) {
  const radius = 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;
  return (
    <svg className="h-4 w-4 -rotate-90 transform shrink-0" viewBox="0 0 16 16">
      <circle
        cx="8"
        cy="8"
        r={radius}
        fill="none"
        className="stroke-slate-200 dark:stroke-slate-800"
        strokeWidth="1.8"
      />
      <circle
        cx="8"
        cy="8"
        r={radius}
        fill="none"
        className={colorClass}
        strokeWidth="1.8"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

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
    <div className="glass-hierarchy-child overflow-hidden rounded-xl border border-yellow-500/30 p-2.5 backdrop-blur-md dark:border-yellow-500/15">
      <div className="mb-2 flex items-center gap-1.5">
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
        <span className="text-xs font-semibold">MyVault</span>
      </div>

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

        {/* Vault Level */}
        {balanceData && (
          <div className="flex items-center justify-between text-[8px] bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/15 dark:border-purple-500/10 rounded-md px-1.5 py-1">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground font-medium">Vault:</span>
              <span className="font-bold text-purple-600 dark:text-purple-400">Lv.{balanceData.vaultLevel}</span>
            </div>
            <div className="flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-400">
              <span className="text-muted-foreground text-[7px]">{balanceData.vaultXp % 1000}/1k</span>
              <MiniProgressCircle
                progress={((balanceData.vaultXp % 1000) / 1000) * 100}
                colorClass="stroke-purple-500 dark:stroke-purple-400"
              />
            </div>
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
    </div>
  );
}
