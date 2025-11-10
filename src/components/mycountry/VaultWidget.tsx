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
