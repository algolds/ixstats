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
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { stripBasePath } from "~/lib/base-path";
import {
  Home,
  Grid3x3,
  Wallet,
  Package,
  ArrowRightLeft,
  Download,
  Trophy,
  ShoppingCart,
} from "lucide-react";
import { cn } from "~/lib/utils";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { PreText } from "~/components/ui/pretext";

import { DailyBonusWidget } from "~/components/vault/DailyBonusWidget";

export function VaultWidget() {
  const { userId } = useAuth();
  const [showPassiveIncome, setShowPassiveIncome] = useState(false);
  const pathname = stripBasePath(usePathname());
  const isOnVault = pathname.startsWith("/vault") || pathname.startsWith("/achievements");
  const isMainVaultPage = pathname === "/vault" || pathname === "/vault/";

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
    <CutoutCard
      className={cn(cutoutCardSurfaceClassName, "w-48 overflow-hidden rounded-xl")}
      trackPointerHover={false}
      texture="dots"
      textureOpacity={0.06}
    >
      {/* Cutout tab header */}
      <div className="relative bg-yellow-500/10 px-2.5 pt-2.5 pb-4">
        <div className="text-card-foreground flex items-center gap-1.5 text-xs font-bold">
          <svg
            className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400"
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
        <CutoutCorner className="text-card absolute -bottom-px left-0" size={16} />
        <CutoutCorner className="text-card absolute right-0 -bottom-px -scale-x-100" size={16} />
      </div>
      <CutoutCardContent className="space-y-2.5 p-2.5 pt-1">
        <div className="space-y-2.5">
          {!isMainVaultPage && (
            <>
              {/* Balance */}
              <div>
                <p className="text-muted-foreground text-xs">IxCredits</p>
                <div className="flex items-center gap-1.5">
                  <IxCreditsSymbol className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                    {balanceLoading ? (
                      <span className="animate-pulse">...</span>
                    ) : (
                      (balanceData?.credits.toLocaleString() ?? 0)
                    )}
                  </p>
                  {passiveIncomeData && passiveIncomeData.dailyDividend > 0 && (
                    <button
                      onClick={() => setShowPassiveIncome((prev) => !prev)}
                      className={`rounded p-0.5 text-blue-500 transition-colors hover:bg-blue-500/10 hover:text-blue-400 focus:ring-1 focus:ring-blue-500/30 focus:outline-none dark:text-blue-400 dark:hover:text-blue-300 ${
                        showPassiveIncome ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : ""
                      }`}
                      title={
                        showPassiveIncome
                          ? "Hide Passive Income Details"
                          : "Show Passive Income Details"
                      }
                      aria-label={
                        showPassiveIncome
                          ? "Hide Passive Income Details"
                          : "Show Passive Income Details"
                      }
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
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
                      <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                        +<IxCreditsSymbol className="h-3 w-3 shrink-0" />
                        {todayEarnings.total}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Passive Income Projection */}
              {showPassiveIncome && passiveIncomeData && passiveIncomeData.dailyDividend > 0 && (
                <div className="animate-in fade-in slide-in-from-top-1 rounded-lg border border-blue-300 bg-blue-50 p-2 duration-200 dark:border-blue-500/30 dark:bg-blue-900/20">
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
                      <span className="flex items-center gap-0.5 font-semibold text-blue-600 dark:text-blue-400">
                        +<IxCreditsSymbol className="h-3 w-3 shrink-0" />
                        {passiveIncomeData.dailyDividend.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[0.65rem]">
                      <span className="text-muted-foreground">Weekly</span>
                      <span className="text-muted-foreground flex items-center gap-0.5">
                        ~<IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
                        {passiveIncomeData.weeklyDividend.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[0.65rem]">
                      <span className="text-muted-foreground">Monthly</span>
                      <span className="text-muted-foreground flex items-center gap-0.5">
                        ~<IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
                        {passiveIncomeData.monthlyDividend.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Budget Multiplier Bonus */}
                  {budgetMultiplierData && (
                    <div className="mt-1.5 rounded border border-yellow-300 bg-yellow-50 p-1.5 dark:border-yellow-500/30 dark:bg-yellow-900/20">
                      <div className="flex items-center justify-between text-[0.65rem]">
                        <span className="text-yellow-700 dark:text-yellow-300">Budget Bonus</span>
                        <span
                          className={`font-semibold ${
                            budgetMultiplierData.percentChange > 0
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


            </>
          )}

          {/* Daily Claim Modal Trigger */}
          <DailyBonusWidget />

          {/* Quick Actions / Integrated Navigation */}
          {isOnVault ? (
            <div
              className={cn(
                "mt-1.5 space-y-1 pt-3",
                !isMainVaultPage && "border-t border-slate-200 dark:border-white/5"
              )}
            >
              {[
                {
                  id: "dashboard" as const,
                  href: "/vault",
                  title: "MyVault (Wallet)",
                  icon: Wallet,
                  isActive: pathname === "/vault" || pathname === "/vault/",
                  gradient:
                    "from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 hover:from-purple-500/15 hover:to-pink-500/15 dark:hover:from-purple-500/30 dark:hover:to-pink-500/30",
                  activeBorder: "border-purple-500/30",
                  activeGlow: "shadow-purple-500/10",
                  activeText: "text-purple-600 dark:text-purple-400",
                },
                {
                  id: "cards" as const,
                  href: "/vault/cards",
                  title: "My Cards",
                  icon: Grid3x3,
                  isActive:
                    pathname.startsWith("/vault/cards") ||
                    pathname.startsWith("/vault/inventory") ||
                    pathname.startsWith("/vault/collections") ||
                    pathname.startsWith("/vault/gallery") ||
                    pathname.startsWith("/vault/lore-gallery") ||
                    pathname.startsWith("/vault/ns-library"),
                  gradient:
                    "from-amber-500/10 to-yellow-500/10 dark:from-amber-500/20 dark:to-yellow-500/20 hover:from-amber-500/15 hover:to-yellow-500/15 dark:hover:from-amber-500/30 dark:hover:to-yellow-500/30",
                  activeBorder: "border-amber-500/30",
                  activeGlow: "shadow-amber-500/10",
                  activeText: "text-amber-600 dark:text-amber-400",
                },
                {
                  id: "marketplace" as const,
                  href: "/vault/marketplace",
                  title: "Marketplace",
                  icon: ShoppingCart,
                  isActive:
                    pathname.startsWith("/vault/marketplace") ||
                    pathname.startsWith("/vault/acquire") ||
                    pathname.startsWith("/vault/create") ||
                    pathname.startsWith("/vault/packs") ||
                    pathname.startsWith("/vault/trading") ||
                    pathname.startsWith("/vault/market"),
                  gradient:
                    "from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20 hover:from-blue-500/15 hover:to-cyan-500/15 dark:hover:from-blue-500/30 dark:hover:to-cyan-500/30",
                  activeBorder: "border-blue-500/30",
                  activeGlow: "shadow-blue-500/10",
                  activeText: "text-blue-600 dark:text-blue-400",
                },
                {
                  id: "import" as const,
                  href: "/vault/import",
                  title: "NS Importer",
                  icon: Download,
                  isActive: pathname.startsWith("/vault/import"),
                  gradient:
                    "from-rose-500/10 to-orange-500/10 dark:from-rose-500/20 dark:to-orange-500/20 hover:from-rose-500/15 hover:to-orange-500/15 dark:hover:from-rose-500/30 dark:hover:to-rose-500/30",
                  activeBorder: "border-rose-500/30",
                  activeGlow: "shadow-rose-500/10",
                  activeText: "text-rose-600 dark:text-rose-400",
                },
                {
                  id: "achievements" as const,
                  href: "/achievements",
                  title: "Achievements",
                  icon: Trophy,
                  isActive: pathname.startsWith("/achievements"),
                  gradient:
                    "from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 hover:from-amber-500/15 hover:to-orange-500/15 dark:hover:from-amber-500/30 dark:hover:to-orange-500/30",
                  activeBorder: "border-amber-500/30",
                  activeGlow: "shadow-amber-500/10",
                  activeText: "text-amber-600 dark:text-amber-400",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold backdrop-blur-sm transition-all duration-205",
                      item.isActive
                        ? cn(
                            "bg-gradient-to-r",
                            item.gradient,
                            item.activeBorder,
                            item.activeGlow,
                            item.activeText
                          )
                        : "text-muted-foreground hover:text-foreground border-transparent hover:bg-white/5"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <PreText
                      font="12px Inter, sans-serif"
                      lineHeight={14}
                      className="flex-1 truncate text-[11px] leading-tight font-semibold select-none"
                    >
                      {item.title}
                    </PreText>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Link
                href="/vault"
                className="block text-center text-[0.65rem] text-blue-600 transition-colors hover:text-blue-500 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                View Full Vault →
              </Link>
            </div>
          )}
        </div>
      </CutoutCardContent>
    </CutoutCard>
  );
}
