"use client";

import React from "react";
import { motion } from "motion/react";
import { Dollar as DollarSign, NavArrowRight as ChevronRight } from "iconoir-react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { SectorBreakdownCard } from "~/components/mycountry/shared/primitives";
import { formatCompactCurrency, formatExactCurrency } from "~/lib/utils";
import type { MappedEconomyData } from "~/components/mycountry/shared/primitives/CountryDataProvider";

interface GovernmentSpendingSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  economyData?: MappedEconomyData | null;
  currency: string;
}

export function GovernmentSpendingSection({
  isExpanded,
  onToggle,
  economyData,
  currency,
}: GovernmentSpendingSectionProps): React.JSX.Element {
  const spendingCats = economyData?.spending?.spendingCategories ?? [];
  const defenseAmount = spendingCats.find((c) => c.category.toLowerCase().includes("defense"))?.amount ?? 0;
  const infraAmount = spendingCats.find((c) => c.category.toLowerCase().includes("infra"))?.amount ?? 0;
  const totalSpending = economyData?.spending?.totalSpending || 1;

  return (
    <div className="flex flex-col">
      <div className="flex">
        <button
          type="button"
          onClick={onToggle}
          className={`relative z-10 flex cursor-pointer items-center gap-2 rounded-t-xl border-x border-t px-4 py-2 text-xs font-bold tracking-wider uppercase transition-all duration-200 ${
            isExpanded
              ? "text-foreground border-white/10 bg-white/10 dark:bg-white/[0.04]"
              : "text-muted-foreground hover:text-foreground border-transparent bg-transparent"
          }`}
        >
          <DollarSign
            className={`h-3.5 w-3.5 ${isExpanded ? "text-indigo-500" : "text-muted-foreground/60"}`}
          />
          <span>Public Budget</span>
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.25 }}
            className="ml-1"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </motion.div>
        </button>
      </div>
      <motion.div
        initial={false}
        animate={{ height: isExpanded ? "auto" : 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.35 }}
        className={`relative overflow-hidden rounded-tr-xl rounded-b-xl bg-white/10 backdrop-blur-xs transition-colors duration-200 dark:bg-white/[0.03] ${
          isExpanded ? "border border-white/10" : "border border-transparent"
        }`}
      >
        <TextureOverlay
          texture="paperGrain"
          opacity={0.06}
          className="pointer-events-none absolute inset-0 z-0"
        />
        <div className="relative z-10 space-y-4 p-4">
          <div className="border-border/10 grid grid-cols-2 gap-4 rounded-xl border bg-white/10 p-3 md:grid-cols-4 dark:bg-white/[0.02]">
            <div className="min-w-0">
              <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                Total Spending
              </p>
              <p className="text-foreground mt-0.5 text-sm font-bold">
                {formatCompactCurrency(
                  economyData?.spending?.totalSpending ?? 0,
                  "N/A",
                  currency
                )}
              </p>
              <p className="text-muted-foreground/80 mt-0.5 text-[10px]">
                Annual expenditure
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                Spending % GDP
              </p>
              <p className="text-foreground mt-0.5 text-sm font-bold">
                {`${(economyData?.spending?.spendingGDPPercent ?? 0).toFixed(1)}%`}
              </p>
              <p className="text-muted-foreground/80 mt-0.5 text-[10px]">
                GDP share percentage
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                Spending per Capita
              </p>
              <p className="text-foreground mt-0.5 text-sm font-bold">
                {formatExactCurrency(economyData?.spending?.spendingPerCapita ?? 0, currency)}
              </p>
              <p className="text-muted-foreground/80 mt-0.5 text-[10px]">Per citizen share</p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                Budget Balance
              </p>
              <p
                className={(() => {
                  const balance = economyData?.spending?.deficitSurplus ?? 0;
                  return balance >= 0
                    ? "mt-0.5 text-sm font-bold text-emerald-500"
                    : "mt-0.5 text-sm font-bold text-red-500";
                })()}
              >
                {formatCompactCurrency(
                  economyData?.spending?.deficitSurplus ?? 0,
                  "N/A",
                  currency
                )}
              </p>
              <p className="text-muted-foreground/80 mt-0.5 text-[10px]">
                {(economyData?.spending?.deficitSurplus ?? 0) >= 0 ? "Surplus" : "Deficit"}
              </p>
            </div>
          </div>

          <SectorBreakdownCard
            title="National Budget Allocations"
            subtitle="Major functional expenditure areas"
            layout="list"
            showProgressBars={true}
            cardWrapper="panel"
            accent="amber"
            currency={currency}
            sectors={[
              {
                id: "education",
                name: "Education",
                value: economyData?.spending?.education ?? 0,
                percentage:
                  ((economyData?.spending?.education ?? 0) / totalSpending) * 100,
                color: "blue",
              },
              {
                id: "healthcare",
                name: "Healthcare",
                value: economyData?.spending?.healthcare ?? 0,
                percentage:
                  ((economyData?.spending?.healthcare ?? 0) / totalSpending) * 100,
                color: "emerald",
              },
              {
                id: "welfare",
                name: "Social Welfare",
                value: economyData?.spending?.socialSafety ?? 0,
                percentage:
                  ((economyData?.spending?.socialSafety ?? 0) / totalSpending) * 100,
                color: "indigo",
              },
              {
                id: "defense",
                name: "Military & Defense",
                value: defenseAmount,
                percentage: (defenseAmount / totalSpending) * 100,
                color: "red",
              },
              {
                id: "infrastructure",
                name: "Infrastructure",
                value: infraAmount,
                percentage: (infraAmount / totalSpending) * 100,
                color: "amber",
              },
            ]}
          />
        </div>
      </motion.div>
    </div>
  );
}
