"use client";

import React, { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
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
import { Skeleton } from "~/components/ui/skeleton";
import { DailyBonusWidget } from "~/components/vault/DailyBonusWidget";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Card } from "~/components/ui/card";

type PassiveIncome = RouterOutputs["vault"]["calculatePassiveIncome"];
type BudgetMultiplier = RouterOutputs["vault"]["getBudgetMultiplier"];

const roundedCredits = (amount: number) => Math.round(amount).toLocaleString();

const NAV_ITEMS = [
  {
    id: "dashboard",
    href: "/vault",
    title: "MyVault (Wallet)",
    icon: Wallet,
    exact: ["/vault", "/vault/"],
  },
  {
    id: "cards",
    href: "/vault/cards",
    title: "My cards",
    icon: Grid3x3,
    prefixes: [
      "/vault/cards",
      "/vault/inventory",
      "/vault/collections",
      "/vault/gallery",
      "/vault/lore-gallery",
      "/vault/ns-library",
    ],
  },
  {
    id: "marketplace",
    href: "/vault/marketplace",
    title: "Marketplace",
    icon: ShoppingCart,
    prefixes: [
      "/vault/marketplace",
      "/vault/acquire",
      "/vault/create",
      "/vault/packs",
      "/vault/trading",
      "/vault/market",
    ],
  },
  {
    id: "import",
    href: "/vault/import",
    title: "NS importer",
    icon: Download,
    prefixes: ["/vault/import"],
  },
  {
    id: "achievements",
    href: "/achievements",
    title: "Achievements",
    icon: Trophy,
    prefixes: ["/achievements"],
  },
];

const isNavActive = (item: (typeof NAV_ITEMS)[number], pathname: string) =>
  item.exact?.includes(pathname) || item.prefixes?.some((prefix) => pathname.startsWith(prefix));

function Dividend({ label, amount, muted }: { label: string; amount: number; muted?: boolean }) {
  return (
    <div className="text-footnote flex justify-between font-normal">
      <span className={cn(muted && "text-label-secondary")}>{label}</span>
      <span
        className={cn(
          "flex items-center gap-0.5 tabular-nums",
          muted ? "text-label-secondary" : "text-label font-semibold"
        )}
      >
        {muted ? "~" : "+"}
        <IxCreditsSymbol className={cn("shrink-0", muted ? "h-2.5 w-2.5" : "h-3 w-3")} />
        {roundedCredits(amount)}
      </span>
    </div>
  );
}

function TodayEarnings({ earnings }: { earnings: RouterOutputs["vault"]["getTodayEarnings"] }) {
  return (
    <div>
      <Eyebrow className="mb-1 block">Today&apos;s earnings</Eyebrow>
      <div className="text-footnote space-y-1">
        {earnings.sources.map((source) => (
          <div
            key={source.type}
            className="text-label-secondary text-footnote flex justify-between font-normal"
          >
            <span>{source.label}</span>
            <span className="text-green font-semibold tabular-nums">
              +{roundedCredits(source.amount)}
            </span>
          </div>
        ))}
        <div className="border-separator text-caption flex justify-between border-t pt-1">
          <span className="text-label">Total</span>
          <span className="text-label flex items-center gap-0.5 font-semibold tabular-nums">
            +<IxCreditsSymbol className="h-3 w-3 shrink-0" />
            {roundedCredits(earnings.total)}
          </span>
        </div>
      </div>
    </div>
  );
}

function TreasuryRevenue({
  income,
  budgetMultiplier,
}: {
  income: PassiveIncome;
  budgetMultiplier: BudgetMultiplier | undefined;
}) {
  const change = budgetMultiplier?.percentChange ?? 0;
  return (
    <Card variant="well" className="animate-in fade-in slide-in-from-top-1 p-2 duration-200">
      <Eyebrow className="mb-1 flex items-center gap-1">
        <Coins aria-hidden="true" className="size-3" />
        Treasury revenue
      </Eyebrow>
      <div className="text-label-secondary text-footnote space-y-1">
        <Dividend label="Daily" amount={income.dailyDividend} />
        <Dividend label="Weekly" amount={income.weeklyDividend} muted />
        <Dividend label="Monthly" amount={income.monthlyDividend} muted />
      </div>

      {budgetMultiplier && (
        <div className="border-separator mt-2 border-t pt-2">
          <div className="text-footnote flex items-center justify-between">
            <span className="text-label font-medium">Budget bonus</span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                change > 0 ? "text-green" : change < 0 ? "text-destructive" : "text-label-secondary"
              )}
            >
              {change > 0 ? "+" : ""}
              {change}%
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

function VaultNav({ pathname }: { pathname: string }) {
  const { showNsImporter } = useTheme();
  const isMainVaultPage = pathname === "/vault" || pathname === "/vault/";
  const items = NAV_ITEMS.filter(
    (item) => item.id !== "import" || pathname.startsWith("/vault/import") || showNsImporter
  );

  return (
    <div className={cn("mt-2 space-y-1 pt-3", !isMainVaultPage && "border-separator border-t")}>
      {items.map((item) => {
        const isActive = isNavActive(item, pathname);
        return (
          <Button
            key={item.id}
            asChild
            variant="ghost"
            size="sm"
            className={cn(
              "rounded-row h-8 w-full justify-start gap-2 px-3",
              isActive ? "bg-fill-3 text-label" : "text-label-secondary hover:text-label"
            )}
          >
            <Link href={item.href} aria-current={isActive ? "page" : undefined}>
              <item.icon
                aria-hidden="true"
                className={cn("size-3.5 shrink-0", isActive && "text-yellow")}
              />
              <PreText
                font="12px Schibsted Grotesk, sans-serif"
                lineHeight={14}
                className="text-caption flex-1 truncate leading-tight select-none"
              >
                {item.title}
              </PreText>
            </Link>
          </Button>
        );
      })}
    </div>
  );
}

function useVaultWidgetData(userId: string | null | undefined) {
  const { data: userData } = api.users.getProfile.useQuery(undefined, { enabled: !!userId });
  const hasCountry = !!userId && !!userData?.countryId;

  const { data: balanceData, isLoading: balanceLoading } = api.vault.getBalance.useQuery(
    undefined,
    { enabled: hasCountry, refetchInterval: 30000 }
  );
  const { data: todayEarnings } = api.vault.getTodayEarnings.useQuery(undefined, {
    enabled: hasCountry,
  });

  // The dividend is paid from the account's primary nation, not necessarily the active one.
  const { data: myNations } = api.realms.myNations.useQuery(undefined, { enabled: hasCountry });
  const dividendCountryId = myNations?.dividendCountryId ?? null;
  const dividendQuery = { enabled: !!dividendCountryId, refetchInterval: 300000 };
  const { data: passiveIncomeData } = api.vault.calculatePassiveIncome.useQuery(
    { countryId: dividendCountryId ?? "" },
    dividendQuery
  );
  const { data: budgetMultiplierData } = api.vault.getBudgetMultiplier.useQuery(
    { countryId: dividendCountryId ?? "" },
    dividendQuery
  );

  return {
    hasCountry,
    balanceData,
    balanceLoading,
    todayEarnings,
    budgetMultiplierData,
    dividend: passiveIncomeData && passiveIncomeData.dailyDividend > 0 ? passiveIncomeData : null,
  };
}

export function VaultWidget() {
  const { userId } = useAuth();
  const [showPassiveIncome, setShowPassiveIncome] = useState(false);
  const pathname = stripBasePath(usePathname());
  const isOnVault = pathname.startsWith("/vault") || pathname.startsWith("/achievements");
  const isMainVaultPage = pathname === "/vault" || pathname === "/vault/";

  const { hasCountry, balanceData, balanceLoading, todayEarnings, dividend, budgetMultiplierData } =
    useVaultWidgetData(userId);

  // Hide widget for unsigned users or users without a country
  if (!hasCountry) return null;

  const treasuryLabel = `${showPassiveIncome ? "Hide" : "Show"} Treasury Revenue Details`;

  return (
    <CutoutCard
      className={cn(cutoutCardSurfaceClassName, "rounded-card w-48 overflow-hidden")}
      trackPointerHover={false}
    >
      <div className="border-separator flex items-center gap-2 border-b px-3 py-2">
        <Wallet aria-hidden="true" className="text-yellow size-4 shrink-0" />
        <h3 className="text-label text-headline">IxVault</h3>
      </div>
      <CutoutCardContent className="space-y-2 p-3 pt-2">
        <div className="space-y-2">
          {!isMainVaultPage && (
            <>
              <div>
                <span className="text-stat-label text-label-secondary block">IxCredits</span>
                <div className="flex items-center gap-2 pt-0.5">
                  <IxCreditsSymbol decorative className="text-yellow size-4 shrink-0" />
                  {balanceLoading ? (
                    <Skeleton className="h-5 w-16" />
                  ) : (
                    <p className="text-label text-title-3 sm:text-title-3 tabular-nums">
                      {roundedCredits(balanceData?.credits ?? 0)}
                    </p>
                  )}
                  {dividend && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-pressed={showPassiveIncome}
                      onClick={() => setShowPassiveIncome((prev) => !prev)}
                      className={cn(
                        "text-label-secondary ml-auto size-7",
                        showPassiveIncome && "bg-fill-3 text-label"
                      )}
                      title={treasuryLabel}
                      aria-label={treasuryLabel}
                    >
                      <Coins aria-hidden="true" className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {todayEarnings && todayEarnings.sources.length > 0 && (
                <TodayEarnings earnings={todayEarnings} />
              )}

              {showPassiveIncome && dividend && (
                <TreasuryRevenue income={dividend} budgetMultiplier={budgetMultiplierData} />
              )}
            </>
          )}

          <DailyBonusWidget />

          {isOnVault ? (
            <VaultNav pathname={pathname} />
          ) : (
            <div className="flex flex-col gap-2 pt-0.5">
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
