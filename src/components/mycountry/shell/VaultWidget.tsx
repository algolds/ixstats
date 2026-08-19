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
  // eslint-disable-next-line unused-imports/no-unused-imports
  Home,
  Grid3x3,
  Wallet,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Package,
  // eslint-disable-next-line unused-imports/no-unused-imports
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
import { useTheme } from "~/context/theme-context";

import { DailyBonusWidget } from "~/components/vault/DailyBonusWidget";

export function VaultWidget() {
  const { userId } = useAuth();
  const [showPassiveIncome, setShowPassiveIncome] = useState(false);
  const pathname = stripBasePath(usePathname());
  const { showNsImporter } = useTheme();
  const isImportActive = pathname.startsWith("/vault/import");
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
      className={cn(
        cutoutCardSurfaceClassName,
        "w-48 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-xl shadow-slate-200/50 backdrop-blur-xl transition-all duration-200 dark:border-white/10 dark:bg-white/[0.02] dark:shadow-black/40"
      )}
      trackPointerHover={false}
      texture="dots"
      textureOpacity={0.05}
    >
      {/* Sleek Apple-style header bar */}
      <div className="relative flex items-center justify-between border-b border-amber-500/20 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/5 px-3 py-2.5 backdrop-blur-md dark:border-amber-500/15 dark:from-amber-500/15 dark:via-amber-500/10 dark:to-amber-500/5">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/20 shadow-sm shadow-amber-500/10 backdrop-blur-sm">
            <Wallet className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="text-xs font-semibold tracking-tight text-amber-900 dark:text-amber-300">
            IxVault
          </span>
        </div>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium tracking-wider text-amber-800 uppercase dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
          Wallet
        </span>
      </div>
      <CutoutCardContent className="space-y-2.5 p-3 pt-2.5">
        <div className="space-y-2.5">
          {!isMainVaultPage && (
            <>
              {/* Balance */}
              <div>
                <p className="text-muted-foreground text-[9px] font-medium tracking-wider uppercase">
                  IxCredits
                </p>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <IxCreditsSymbol className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 dark:drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
                  <p className="text-base font-bold tracking-tight text-amber-700 tabular-nums sm:text-lg dark:text-amber-400 dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                    {balanceLoading ? (
                      <span className="animate-pulse">...</span>
                    ) : (
                      Math.round(balanceData?.credits ?? 0).toLocaleString()
                    )}
                  </p>
                  {passiveIncomeData && passiveIncomeData.dailyDividend > 0 && (
                    <button
                      onClick={() => setShowPassiveIncome((prev) => !prev)}
                      className={`rounded-md p-1 text-blue-600 backdrop-blur-sm transition-all duration-150 hover:bg-blue-500/15 focus:ring-1 focus:ring-blue-500/30 focus:outline-none active:scale-[0.92] dark:text-blue-400 ${
                        showPassiveIncome
                          ? "bg-blue-500/20 text-blue-700 ring-1 ring-blue-500/30 dark:text-blue-300"
                          : ""
                      }`}
                      title={
                        showPassiveIncome
                          ? "Hide Treasury Revenue Details"
                          : "Show Treasury Revenue Details"
                      }
                      aria-label={
                        showPassiveIncome
                          ? "Hide Treasury Revenue Details"
                          : "Show Treasury Revenue Details"
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
                  <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-tight">
                    Today&apos;s Earnings
                  </p>
                  <div className="space-y-1 text-xs">
                    {todayEarnings.sources.map((source) => (
                      <div
                        key={source.type}
                        className="text-muted-foreground flex justify-between text-[11px] font-normal tracking-normal"
                      >
                        <span>{source.label}</span>
                        <span className="font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                          +{Math.round(source.amount).toLocaleString()}
                        </span>
                      </div>
                    ))}
                    <div className="border-border/40 flex justify-between border-t pt-1 text-[11px] font-medium tracking-tight">
                      <span className="text-foreground">Total</span>
                      <span className="flex items-center gap-0.5 font-bold text-amber-700 tabular-nums dark:text-amber-400">
                        +<IxCreditsSymbol className="h-3 w-3 shrink-0" />
                        {Math.round(todayEarnings.total).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Treasury Revenue Projection */}
              {showPassiveIncome && passiveIncomeData && passiveIncomeData.dailyDividend > 0 && (
                <div className="animate-in fade-in slide-in-from-top-1 rounded-xl border border-blue-500/25 bg-blue-500/10 p-2.5 shadow-sm backdrop-blur-md duration-200">
                  <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Treasury Revenue
                  </p>
                  <div className="text-muted-foreground space-y-1 text-xs">
                    <div className="flex justify-between text-[11px] font-normal tracking-normal">
                      <span>Daily</span>
                      <span className="flex items-center gap-0.5 font-semibold text-blue-600 tabular-nums dark:text-blue-400">
                        +<IxCreditsSymbol className="h-3 w-3 shrink-0" />
                        {Math.round(passiveIncomeData.dailyDividend).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] font-normal tracking-normal">
                      <span className="text-muted-foreground">Weekly</span>
                      <span className="text-muted-foreground flex items-center gap-0.5 tabular-nums">
                        ~<IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
                        {Math.round(passiveIncomeData.weeklyDividend).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] font-normal tracking-normal">
                      <span className="text-muted-foreground">Monthly</span>
                      <span className="text-muted-foreground flex items-center gap-0.5 tabular-nums">
                        ~<IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
                        {Math.round(passiveIncomeData.monthlyDividend).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Budget Multiplier Bonus */}
                  {budgetMultiplierData && (
                    <div className="mt-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-1.5 backdrop-blur-sm dark:border-amber-500/25">
                      <div className="flex items-center justify-between text-[10px] tracking-tight">
                        <span className="font-medium text-amber-900 dark:text-amber-300">
                          Budget Bonus
                        </span>
                        <span
                          className={`font-semibold tabular-nums ${
                            budgetMultiplierData.percentChange > 0
                              ? "text-emerald-600 dark:text-emerald-400"
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
                !isMainVaultPage && "border-t border-slate-200/60 dark:border-white/10"
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
                    "from-purple-500/15 to-pink-500/15 hover:from-purple-500/25 hover:to-pink-500/25",
                  activeBorder: "border-purple-500/30",
                  activeGlow: "shadow-purple-500/10",
                  activeText: "text-purple-800 dark:text-purple-300",
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
                    "from-amber-500/15 to-yellow-500/15 hover:from-amber-500/25 hover:to-yellow-500/25",
                  activeBorder: "border-amber-500/30",
                  activeGlow: "shadow-amber-500/10",
                  activeText: "text-amber-800 dark:text-amber-300",
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
                    "from-blue-500/15 to-cyan-500/15 hover:from-blue-500/25 hover:to-cyan-500/25",
                  activeBorder: "border-blue-500/30",
                  activeGlow: "shadow-blue-500/10",
                  activeText: "text-blue-800 dark:text-blue-300",
                },
                {
                  id: "import" as const,
                  href: "/vault/import",
                  title: "NS Importer",
                  icon: Download,
                  isActive: pathname.startsWith("/vault/import"),
                  gradient:
                    "from-rose-500/15 to-orange-500/15 hover:from-rose-500/25 hover:to-rose-500/25",
                  activeBorder: "border-rose-500/30",
                  activeGlow: "shadow-rose-500/10",
                  activeText: "text-rose-800 dark:text-rose-300",
                },
                {
                  id: "achievements" as const,
                  href: "/achievements",
                  title: "Achievements",
                  icon: Trophy,
                  isActive: pathname.startsWith("/achievements"),
                  gradient:
                    "from-amber-500/15 to-orange-500/15 hover:from-amber-500/25 hover:to-orange-500/25",
                  activeBorder: "border-amber-500/30",
                  activeGlow: "shadow-amber-500/10",
                  activeText: "text-amber-800 dark:text-amber-300",
                },
              ]
                .filter((item) => {
                  if (item.id === "import") return isImportActive || showNsImporter;
                  return true;
                })
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-medium backdrop-blur-md transition-all duration-150 active:scale-[0.97]",
                        item.isActive
                          ? cn(
                              "bg-gradient-to-r shadow-md",
                              item.gradient,
                              item.activeBorder,
                              item.activeGlow,
                              item.activeText
                            )
                          : "text-muted-foreground hover:text-foreground border-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <PreText
                        font="12px Geist, -apple-system, sans-serif"
                        lineHeight={14}
                        className="flex-1 truncate text-[11px] leading-tight font-medium tracking-tight select-none"
                      >
                        {item.title}
                      </PreText>
                    </Link>
                  );
                })}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 pt-0.5">
              <Link
                href="/vault"
                className="block text-center text-[11px] font-semibold tracking-tight text-amber-700 transition-all duration-150 hover:text-amber-800 hover:underline active:scale-[0.97] dark:text-amber-400 dark:hover:text-amber-300"
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
