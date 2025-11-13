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
    <div className="glass-card-parent overflow-hidden rounded-lg border border-gray-700/50 bg-gradient-to-br from-gray-800/90 to-gray-900/90 p-6 backdrop-blur-md">
      <h3 className="mb-4 text-lg font-semibold text-white">MyVault</h3>

      <div className="space-y-4">
        {/* Balance */}
        <div>
          <p className="text-sm text-gray-400">IxCredits Balance</p>
          <p className="text-3xl font-bold text-yellow-500">
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
            <p className="mb-2 text-sm text-gray-400">Today&apos;s Earnings</p>
            <div className="space-y-1 text-sm">
              {todayEarnings.sources.map((source) => (
                <div key={source.type} className="flex justify-between text-gray-300">
                  <span>{source.label}</span>
                  <span className="text-green-400">+{source.amount}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-gray-700 pt-1 font-bold">
                <span className="text-white">Total</span>
                <span className="text-yellow-500">+{todayEarnings.total}</span>
              </div>
            </div>
          </div>
        )}

        {/* Passive Income Projection */}
        {passiveIncomeData && passiveIncomeData.dailyDividend > 0 && (
          <div className="rounded-md border border-blue-500/30 bg-blue-900/20 p-3">
            <p className="mb-2 flex items-center gap-1 text-sm font-medium text-blue-300">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Nation Passive Income
            </p>
            <div className="space-y-1 text-sm text-gray-300">
              <div className="flex justify-between">
                <span>Daily Dividend</span>
                <span className="font-semibold text-blue-400">+{passiveIncomeData.dailyDividend.toFixed(2)} IxC</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Weekly Projection</span>
                <span className="text-gray-400">~{passiveIncomeData.weeklyDividend.toFixed(2)} IxC</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Monthly Projection</span>
                <span className="text-gray-400">~{passiveIncomeData.monthlyDividend.toFixed(2)} IxC</span>
              </div>
            </div>

            {/* Budget Multiplier Bonus */}
            {budgetMultiplierData && (
              <div className="mt-2 rounded border border-yellow-500/30 bg-yellow-900/20 p-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-yellow-300">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Budget Bonus
                  </span>
                  <span className={`font-semibold ${
                    budgetMultiplierData.percentChange > 0 ? "text-green-400" :
                    budgetMultiplierData.percentChange < 0 ? "text-red-400" :
                    "text-gray-400"
                  }`}>
                    {budgetMultiplierData.percentChange > 0 ? "+" : ""}{budgetMultiplierData.percentChange}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-400" title={budgetMultiplierData.description}>
                  {budgetMultiplierData.multiplier.toFixed(2)}x from budget allocation
                </p>
              </div>
            )}

            <p className="mt-2 text-xs text-gray-400">
              Based on your nation&apos;s economic performance {budgetMultiplierData ? "and budget allocation" : ""}
            </p>
          </div>
        )}

        {/* Vault Level */}
        {balanceData && (
          <div>
            <p className="text-sm text-gray-400">Vault Level</p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-purple-400">Level {balanceData.vaultLevel}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-700">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                  style={{
                    width: `${((balanceData.vaultXp % 1000) / 1000) * 100}%`,
                  }}
                />
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {balanceData.vaultXp % 1000} / 1000 XP
            </p>
          </div>
        )}

        {/* Quick Action */}
        <Link
          href="/vault/packs"
          className="block w-full rounded-md bg-gradient-to-r from-yellow-500 to-yellow-600 px-4 py-2 text-center font-medium text-gray-900 transition-all hover:from-yellow-400 hover:to-yellow-500 hover:shadow-lg"
        >
          Open Pack
        </Link>

        <Link
          href="/vault"
          className="block text-center text-sm text-blue-400 transition-colors hover:text-blue-300 hover:underline"
        >
          View Full Vault →
        </Link>
      </div>
    </div>
  );
}
