"use client";

import React from "react";
import { motion } from "motion/react";
import { Globe, NavArrowRight as ChevronRight } from "iconoir-react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { SectorBreakdownCard } from "~/components/mycountry/shared/primitives";
import { formatCompactCurrency } from "~/lib/utils";
import type { MappedEconomyData } from "~/components/mycountry/shared/primitives/CountryDataProvider";

interface EconomyTradeSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  economyData?: MappedEconomyData | null;
  currency: string;
}

export function EconomyTradeSection({
  isExpanded,
  onToggle,
  economyData,
  currency,
}: EconomyTradeSectionProps): React.JSX.Element {
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
          <Globe
            className={`h-3.5 w-3.5 ${isExpanded ? "text-emerald-500" : "text-muted-foreground/60"}`}
          />
          <span>Trade Flows & Balance</span>
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
          <div className="border-border/10 grid grid-cols-3 gap-4 rounded-xl border bg-white/10 p-3 dark:bg-white/[0.02]">
            <div className="min-w-0">
              <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                Total Exports
              </p>
              <p className="text-foreground mt-0.5 text-sm font-bold">
                {formatCompactCurrency(
                  (economyData?.core.nominalGDP ?? 0) * 0.35,
                  "N/A",
                  currency
                )}
              </p>
              <p className="text-muted-foreground/80 mt-0.5 text-[10px]">35.0% of GDP</p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                Total Imports
              </p>
              <p className="text-foreground mt-0.5 text-sm font-bold">
                {formatCompactCurrency(
                  (economyData?.core.nominalGDP ?? 0) * 0.32,
                  "N/A",
                  currency
                )}
              </p>
              <p className="text-muted-foreground/80 mt-0.5 text-[10px]">32.0% of GDP</p>
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground/60 text-[9px] font-semibold tracking-wider uppercase">
                Trade Balance
              </p>
              <p className="mt-0.5 text-sm font-bold text-emerald-500">
                {formatCompactCurrency(
                  (economyData?.core.nominalGDP ?? 0) * 0.03,
                  "N/A",
                  currency
                )}
              </p>
              <p className="text-muted-foreground/80 mt-0.5 text-[10px]">Surplus (+3.0%)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectorBreakdownCard
              title="Export Composition"
              subtitle="Distribution of goods and services exported"
              layout="list"
              showProgressBars={true}
              cardWrapper="panel"
              accent="emerald"
              currency={currency}
              sectors={[
                {
                  id: "manufactured",
                  name: "Manufactured Goods",
                  value: 0,
                  percentage: 45,
                  color: "blue",
                  trend: "up",
                  trendValue: 1.5,
                },
                {
                  id: "tech",
                  name: "Technology Products",
                  value: 0,
                  percentage: 25,
                  color: "cyan",
                  trend: "up",
                  trendValue: 3.2,
                },
                {
                  id: "services",
                  name: "Services",
                  value: 0,
                  percentage: 15,
                  color: "purple",
                  trend: "stable",
                },
                {
                  id: "agri",
                  name: "Agricultural Products",
                  value: 0,
                  percentage: 10,
                  color: "green",
                  trend: "down",
                  trendValue: -0.8,
                },
                {
                  id: "raw",
                  name: "Raw Materials",
                  value: 0,
                  percentage: 5,
                  color: "amber",
                  trend: "stable",
                },
              ]}
            />
            <SectorBreakdownCard
              title="Import Composition"
              subtitle="Distribution of goods and services imported"
              layout="list"
              showProgressBars={true}
              cardWrapper="panel"
              accent="emerald"
              currency={currency}
              sectors={[
                {
                  id: "energy",
                  name: "Energy & Fuels",
                  value: (economyData?.core.nominalGDP ?? 0) * 0.32 * 0.3,
                  percentage: 30,
                  color: "red",
                  trend: "down",
                  trendValue: -2.1,
                },
                {
                  id: "manufactured",
                  name: "Manufactured Goods",
                  value: 0,
                  percentage: 25,
                  color: "blue",
                  trend: "stable",
                },
                {
                  id: "tech",
                  name: "Technology Products",
                  value: 0,
                  percentage: 20,
                  color: "cyan",
                  trend: "up",
                  trendValue: 1.8,
                },
                {
                  id: "raw",
                  name: "Raw Materials",
                  value: 0,
                  percentage: 15,
                  color: "amber",
                  trend: "stable",
                },
                {
                  id: "food",
                  name: "Food & Agricultural",
                  value: 0,
                  percentage: 10,
                  color: "green",
                  trend: "up",
                  trendValue: 0.5,
                },
              ]}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
