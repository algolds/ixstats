"use client";
/**
 * VaultWidget Component
 *
 * Displays IxCredits balance and today's earnings
 * - Real-time balance display
 * - Today's earnings breakdown
 * - Link to full vault page
 */

import React, { useState } from "react";
import { api } from "~/trpc/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { stripBasePath } from "~/lib/base-path";
import {
  ViewGrid as Grid3x3,
  Wallet,
  Download,
  Trophy,
  Cart as ShoppingCart,
  Coins,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import {
  CutoutCard,
  CutoutCardContent,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { PreText } from "~/components/ui/pretext";
import { useTheme } from "~/context/theme-context";
import { Button } from "~/components/ui/button";
import { FacetContainer } from "~/components/ui/facet-container";
import { Skeleton } from "~/components/ui/skeleton";

import { DailyBonusWidget } from "~/components/vault/DailyBonusWidget";
import { Eyebrow } from "~/components/ui/eyebrow";

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
    undefined,
    {
      enabled: !!userId && !!userData?.countryId,
      refetchInterval: 30000, // Auto-refresh every 30s
    }
  );

  const { data: todayEarnings } = api.vault.getTodayEarnings.useQuery(undefined, {
    enabled: !!userId && !!userData?.countryId,
  });

  // The dividend is paid from the account's primary nation, not necessarily the active one.
  const { data: myNations } = api.realms.myNations.useQuery(undefined, {
    enabled: !!userId && !!userData?.countryId,
  });
  const dividendCountryId = myNations?.dividendCountryId ?? null;

  const { data: passiveIncomeData } = api.vault.calculatePassiveIncome.useQuery(
    { countryId: dividendCountryId ?? "" },
    {
      enabled: !!dividendCountryId,
      refetchInterval: 300000, // Refresh every 5 minutes
    }
  );

  // Get budget multiplier data
  const { data: budgetMultiplierData } = api.vault.getBudgetMultiplier.useQuery(
    { countryId: dividendCountryId ?? "" },
    {
      enabled: !!dividendCountryId,
      refetchInterval: 300000, // Refresh every 5 minutes
    }
  );

  // Hide widget for unsigned users or users without a country
  if (!userId || !userData?.countryId) {
    return null;
  }

  return (
    <CutoutCard
      className={cn(cutoutCardSurfaceClassName, "w-48 overflow-hidden rounded-2xl")}
      trackPointerHover={false}
      texture="dots"
      textureOpacity={0.05}
    >
      {/* Header: plain glyph in the Vault accent and a sentence-case title */}
      <div className="border-border flex items-center gap-2 border-b px-3 py-2.5">
        <Wallet aria-hidden="true" className="size-4 shrink-0 text-amber-600" />
        <h3 className="text-foreground text-sm font-semibold tracking-tight">IxVault</h3>
      </div>
      <CutoutCardContent className="space-y-2.5 p-3 pt-2.5">
        <div className="space-y-2.5">
          {!isMainVaultPage && (
            <>
              {/* Balance */}
              <div>
                <Eyebrow className="block">IxCredits</Eyebrow>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <IxCreditsSymbol className="size-4 shrink-0 text-amber-600" />
                  <p className="text-foreground text-base font-bold tracking-tight tabular-nums sm:text-lg">
                    {balanceLoading ? (
                      <Skeleton className="h-5 w-16" />
                    ) : (
                      Math.round(balanceData?.credits ?? 0).toLocaleString()
                    )}
                  </p>
                  {passiveIncomeData && passiveIncomeData.dailyDividend > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-pressed={showPassiveIncome}
                      onClick={() => setShowPassiveIncome((prev) => !prev)}
                      className={cn(
                        "text-muted-foreground ml-auto size-7",
                        showPassiveIncome && "bg-accent text-foreground"
                      )}
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
                      <Coins aria-hidden="true" className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Today's Earnings */}
              {todayEarnings && todayEarnings.sources.length > 0 && (
                <div>
                  <Eyebrow className="mb-1 block">Today&apos;s earnings</Eyebrow>
                  <div className="space-y-1 text-xs">
                    {todayEarnings.sources.map((source) => (
                      <div
                        key={source.type}
                        className="text-muted-foreground flex justify-between text-xs font-normal tracking-normal"
                      >
                        <span>{source.label}</span>
                        <span className="font-semibold text-emerald-600 tabular-nums">
                          +{Math.round(source.amount).toLocaleString()}
                        </span>
                      </div>
                    ))}
                    <div className="border-border/40 flex justify-between border-t pt-1 text-xs font-medium tracking-tight">
                      <span className="text-foreground">Total</span>
                      <span className="text-foreground flex items-center gap-0.5 font-bold tabular-nums">
                        +<IxCreditsSymbol className="h-3 w-3 shrink-0" />
                        {Math.round(todayEarnings.total).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Treasury Revenue Projection */}
              {showPassiveIncome && passiveIncomeData && passiveIncomeData.dailyDividend > 0 && (
                <FacetContainer
                  depth={3}
                  surface="solid"
                  className="animate-in fade-in slide-in-from-top-1 rounded-xl p-2.5 duration-200"
                >
                  <Eyebrow className="mb-1 flex items-center gap-1">
                    <Coins aria-hidden="true" className="size-3" />
                    Treasury revenue
                  </Eyebrow>
                  <div className="text-muted-foreground space-y-1 text-xs">
                    <div className="flex justify-between text-xs font-normal tracking-normal">
                      <span>Daily</span>
                      <span className="text-foreground flex items-center gap-0.5 font-semibold tabular-nums">
                        +<IxCreditsSymbol className="h-3 w-3 shrink-0" />
                        {Math.round(passiveIncomeData.dailyDividend).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-normal tracking-normal">
                      <span className="text-muted-foreground">Weekly</span>
                      <span className="text-muted-foreground flex items-center gap-0.5 tabular-nums">
                        ~<IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
                        {Math.round(passiveIncomeData.weeklyDividend).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-normal tracking-normal">
                      <span className="text-muted-foreground">Monthly</span>
                      <span className="text-muted-foreground flex items-center gap-0.5 tabular-nums">
                        ~<IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
                        {Math.round(passiveIncomeData.monthlyDividend).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Budget Multiplier Bonus */}
                  {budgetMultiplierData && (
                    <div className="border-border mt-1.5 border-t pt-1.5">
                      <div className="flex items-center justify-between text-xs tracking-tight">
                        <span className="text-foreground font-medium">Budget bonus</span>
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            budgetMultiplierData.percentChange > 0
                              ? "text-emerald-600"
                              : budgetMultiplierData.percentChange < 0
                                ? "text-destructive"
                                : "text-muted-foreground"
                          )}
                        >
                          {budgetMultiplierData.percentChange > 0 ? "+" : ""}
                          {budgetMultiplierData.percentChange}%
                        </span>
                      </div>
                    </div>
                  )}
                </FacetContainer>
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
                !isMainVaultPage && "border-border/60 border-t"
              )}
            >
              {[
                {
                  id: "dashboard" as const,
                  href: "/vault",
                  title: "MyVault (Wallet)",
                  icon: Wallet,
                  isActive: pathname === "/vault" || pathname === "/vault/",
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
                },
                {
                  id: "import" as const,
                  href: "/vault/import",
                  title: "NS Importer",
                  icon: Download,
                  isActive: pathname.startsWith("/vault/import"),
                },
                {
                  id: "achievements" as const,
                  href: "/achievements",
                  title: "Achievements",
                  icon: Trophy,
                  isActive: pathname.startsWith("/achievements"),
                },
              ]
                .filter((item) => {
                  if (item.id === "import") return isImportActive || showNsImporter;
                  return true;
                })
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.id}
                      asChild
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-8 w-full justify-start gap-2 rounded-xl px-2.5",
                        item.isActive
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Link href={item.href} aria-current={item.isActive ? "page" : undefined}>
                        <Icon
                          aria-hidden="true"
                          className={cn("size-3.5 shrink-0", item.isActive && "text-amber-600")}
                        />
                        <PreText
                          font="12px Geist, -apple-system, sans-serif"
                          lineHeight={14}
                          className="flex-1 truncate text-xs leading-tight font-medium tracking-tight select-none"
                        >
                          {item.title}
                        </PreText>
                      </Link>
                    </Button>
                  );
                })}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 pt-0.5">
              <Button asChild variant="link" size="sm" className="h-auto justify-center p-0">
                <Link href="/vault">View full vault</Link>
              </Button>
            </div>
          )}
        </div>
      </CutoutCardContent>
    </CutoutCard>
  );
}
