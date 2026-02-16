/**
 * VaultWidget Component
 *
 * Displays IxCredits balance and today's earnings in MyCountry overview
 * - Real-time balance display
 * - Today's earnings breakdown
 * - Quick action button to open packs
 * - Link to full vault page
 */

"use client";

import React from "react";
import { api } from "~/trpc/react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useHasRoleLevel } from "~/hooks/usePermissions";

export function VaultWidget() {
  const { userId } = useAuth();
  const isAdmin = useHasRoleLevel(10); // Admin level or higher

  const { data: balanceData, isLoading: balanceLoading } = api.vault.getBalance.useQuery(
    { userId: userId ?? "" },
    {
      enabled: !!userId && isAdmin,
      refetchInterval: 30000, // Auto-refresh every 30s
    }
  );

  const { data: todayEarnings } = api.vault.getTodayEarnings.useQuery(undefined, {
    enabled: !!userId && isAdmin,
  });

  // Get user's country to calculate passive income
  const { data: userData } = api.users.getProfile.useQuery(undefined, {
    enabled: !!userId && isAdmin,
  });

  const { data: passiveIncomeData } = api.vault.calculatePassiveIncome.useQuery(
    { countryId: userData?.countryId ?? "" },
    {
      enabled: !!userData?.countryId && isAdmin,
      refetchInterval: 300000, // Refresh every 5 minutes
    }
  );

  // Get budget multiplier data
  const { data: budgetMultiplierData } = api.vault.getBudgetMultiplier.useQuery(
    { countryId: userData?.countryId ?? "" },
    {
      enabled: !!userData?.countryId && isAdmin,
      refetchInterval: 300000, // Refresh every 5 minutes
    }
  );

  // Hide widget for non-admins
  if (!userId || !isAdmin) {
    return null;
  }

  return (
    <div className="glass-hierarchy-child overflow-hidden rounded-xl border border-yellow-500/15 p-2.5 backdrop-blur-md">
      <div className="mb-2 flex items-center gap-1.5">
        <svg className="h-3.5 w-3.5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <span className="text-xs font-semibold">MyVault</span>
      </div>

      <div className="space-y-2.5">
        {/* Balance */}
        <div>
          <p className="text-xs text-gray-400">IxCredits</p>
          <p className="text-lg font-bold text-yellow-500">
            {balanceLoading ? (
              <span className="animate-pulse">...</span>
            ) : (
              balanceData?.credits.toLocaleString() ?? 0
            )}
          </p>
        </div>

        {/* Today's Earnings */}
        {todayEarnings && todayEarnings.sources.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-gray-400">Today&apos;s Earnings</p>
            <div className="space-y-0.5 text-xs">
              {todayEarnings.sources.map((source) => (
                <div key={source.type} className="flex justify-between text-gray-300">
                  <span>{source.label}</span>
                  <span className="text-green-400">+{source.amount}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-gray-700 pt-1 font-semibold">
                <span className="text-white">Total</span>
                <span className="text-yellow-500">+{todayEarnings.total}</span>
              </div>
            </div>
          </div>
        )}

        {/* Passive Income Projection */}
        {passiveIncomeData && passiveIncomeData.dailyDividend > 0 && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-900/20 p-2">
            <p className="mb-1 flex items-center gap-1 text-xs font-medium text-blue-300">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Passive Income
            </p>
            <div className="space-y-0.5 text-xs text-gray-300">
              <div className="flex justify-between">
                <span>Daily</span>
                <span className="font-semibold text-blue-400">+{passiveIncomeData.dailyDividend.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[0.65rem]">
                <span className="text-gray-400">Weekly</span>
                <span className="text-gray-400">~{passiveIncomeData.weeklyDividend.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[0.65rem]">
                <span className="text-gray-400">Monthly</span>
                <span className="text-gray-400">~{passiveIncomeData.monthlyDividend.toFixed(2)}</span>
              </div>
            </div>

            {/* Budget Multiplier Bonus */}
            {budgetMultiplierData && (
              <div className="mt-1.5 rounded border border-yellow-500/30 bg-yellow-900/20 p-1.5">
                <div className="flex items-center justify-between text-[0.65rem]">
                  <span className="text-yellow-300">Budget Bonus</span>
                  <span className={`font-semibold ${
                    budgetMultiplierData.percentChange > 0 ? "text-green-400" :
                    budgetMultiplierData.percentChange < 0 ? "text-red-400" :
                    "text-gray-400"
                  }`}>
                    {budgetMultiplierData.percentChange > 0 ? "+" : ""}{budgetMultiplierData.percentChange}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Vault Level */}
        {balanceData && (
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-purple-400">Lv.{balanceData.vaultLevel}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-700">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                  style={{
                    width: `${((balanceData.vaultXp % 1000) / 1000) * 100}%`,
                  }}
                />
              </div>
              <span className="text-[0.6rem] text-gray-500">{balanceData.vaultXp % 1000}/1k</span>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex flex-col gap-1.5">
          <Link
            href="/vault/packs"
            className="block w-full rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-600 px-3 py-1.5 text-center text-xs font-semibold text-gray-900 transition-all hover:from-yellow-400 hover:to-yellow-500"
          >
            Open Pack
          </Link>
          <Link
            href="/vault"
            className="block text-center text-[0.65rem] text-blue-400 transition-colors hover:text-blue-300 hover:underline"
          >
            View Full Vault →
          </Link>
        </div>
      </div>
    </div>
  );
}
