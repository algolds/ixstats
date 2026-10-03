"use client";

import React from "react";
import { motion } from "motion/react";
import { Globe, NavArrowRight as ChevronRight } from "iconoir-react";
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
          aria-expanded={isExpanded}
          className={`focus-visible:ring-tint rounded-t-row text-headline relative z-10 flex min-h-9 cursor-pointer items-center gap-2 border-x border-t px-4 py-2 transition-[color,background-color,border-color] duration-150 outline-none focus-visible:ring-2 ${
            isExpanded
              ? "text-label border-separator bg-surface"
              : "text-label-secondary hover:text-label border-transparent bg-transparent"
          }`}
        >
          <Globe className={`h-3.5 w-3.5 ${isExpanded ? "text-label" : "text-label-secondary"}`} />
          <span>Trade flows & balance</span>
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
        transition={{ type: "spring", bounce: 0, duration: 0.25 }}
        className={`bg-surface rounded-tr-row rounded-b-row relative overflow-hidden transition-colors duration-200 ${
          isExpanded ? "border-separator border" : "border border-transparent"
        }`}
      >
        <div className="relative z-10 space-y-4 p-4">
          <div className="bg-fill-3 rounded-row grid grid-cols-3 gap-4 p-3">
            <div className="min-w-0">
              <span className="text-stat-label text-label-secondary block">Total exports</span>
              <p className="text-label text-headline mt-0.5">
                {formatCompactCurrency((economyData?.core.nominalGDP ?? 0) * 0.35, "N/A", currency)}
              </p>
              <p className="text-label-secondary text-footnote mt-0.5">35.0% of GDP</p>
            </div>
            <div className="min-w-0">
              <span className="text-stat-label text-label-secondary block">Total imports</span>
              <p className="text-label text-headline mt-0.5">
                {formatCompactCurrency((economyData?.core.nominalGDP ?? 0) * 0.32, "N/A", currency)}
              </p>
              <p className="text-label-secondary text-footnote mt-0.5">32.0% of GDP</p>
            </div>
            <div className="min-w-0">
              <span className="text-stat-label text-label-secondary block">Trade balance</span>
              <p className="text-headline text-green mt-0.5">
                {formatCompactCurrency((economyData?.core.nominalGDP ?? 0) * 0.03, "N/A", currency)}
              </p>
              <p className="text-label-secondary text-footnote mt-0.5">Surplus (+3.0%)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectorBreakdownCard
              title="Export composition"
              subtitle="Distribution of goods and services exported"
              layout="list"
              showProgressBars={true}
              currency={currency}
              sectors={[
                {
                  id: "manufactured",
                  name: "Manufactured goods",
                  value: 0,
                  percentage: 45,
                  color: "blue",
                  trend: "up",
                  trendValue: 1.5,
                },
                {
                  id: "tech",
                  name: "Technology products",
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
                  name: "Agricultural products",
                  value: 0,
                  percentage: 10,
                  color: "green",
                  trend: "down",
                  trendValue: -0.8,
                },
                {
                  id: "raw",
                  name: "Raw materials",
                  value: 0,
                  percentage: 5,
                  color: "amber",
                  trend: "stable",
                },
              ]}
            />
            <SectorBreakdownCard
              title="Import composition"
              subtitle="Distribution of goods and services imported"
              layout="list"
              showProgressBars={true}
              currency={currency}
              sectors={[
                {
                  id: "energy",
                  name: "Energy & fuels",
                  value: (economyData?.core.nominalGDP ?? 0) * 0.32 * 0.3,
                  percentage: 30,
                  color: "red",
                  trend: "down",
                  trendValue: -2.1,
                },
                {
                  id: "manufactured",
                  name: "Manufactured goods",
                  value: 0,
                  percentage: 25,
                  color: "blue",
                  trend: "stable",
                },
                {
                  id: "tech",
                  name: "Technology products",
                  value: 0,
                  percentage: 20,
                  color: "cyan",
                  trend: "up",
                  trendValue: 1.8,
                },
                {
                  id: "raw",
                  name: "Raw materials",
                  value: 0,
                  percentage: 15,
                  color: "amber",
                  trend: "stable",
                },
                {
                  id: "food",
                  name: "Food & agricultural",
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
