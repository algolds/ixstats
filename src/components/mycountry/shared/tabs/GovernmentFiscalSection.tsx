"use client";

import React from "react";
import { motion } from "motion/react";
import { City as Building, NavArrowRight as ChevronRight } from "iconoir-react";
import { SectorBreakdownCard } from "~/components/mycountry/shared/primitives";
import { formatCompactCurrency } from "~/lib/utils";
import type { MappedEconomyData } from "~/components/mycountry/shared/primitives/CountryDataProvider";

interface GovernmentFiscalSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  economyData?: MappedEconomyData | null;
  currency: string;
}

export function GovernmentFiscalSection({
  isExpanded,
  onToggle,
  economyData,
  currency,
}: GovernmentFiscalSectionProps): React.JSX.Element {
  const taxEfficiency = economyData?.fiscal?.taxEfficiency ?? null;

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
          <Building
            className={`h-3.5 w-3.5 ${isExpanded ? "text-label" : "text-label-secondary"}`}
          />
          <span>Fiscal policy</span>
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
          <div className="bg-fill-3 rounded-row grid grid-cols-2 gap-4 p-3 md:grid-cols-3">
            <div className="min-w-0">
              <span className="text-stat-label text-label-secondary block">Tax Revenue % GDP</span>
              <p className="text-label text-headline mt-0.5">
                {`${(economyData?.fiscal?.taxRevenueGDPPercent ?? 0).toFixed(1)}%`}
              </p>
              <p className="text-label-secondary text-footnote mt-0.5">Tax burden ratio</p>
            </div>
            <div className="min-w-0">
              <span className="text-stat-label text-label-secondary block">Total debt</span>
              <p className="text-label text-headline mt-0.5">
                {formatCompactCurrency(
                  (economyData?.core.nominalGDP ?? 0) *
                    ((economyData?.fiscal?.totalDebtGDPRatio ?? 0) / 100),
                  "N/A",
                  currency
                )}
              </p>
              <p className="text-label-secondary text-footnote mt-0.5">Outstanding national debt</p>
            </div>
            <div className="min-w-0">
              <span className="text-stat-label text-label-secondary block">Debt to GDP ratio</span>
              <p className="text-label text-headline mt-0.5">
                {`${(economyData?.fiscal?.totalDebtGDPRatio ?? 0).toFixed(1)}%`}
              </p>
              <p className="text-label-secondary text-footnote mt-0.5">Relative to economic size</p>
            </div>
          </div>

          <SectorBreakdownCard
            title="Fiscal conditions & policy"
            subtitle="National fiscal policy indicators"
            layout="list"
            showProgressBars={true}
            sectors={[
              ...(taxEfficiency != null
                ? [
                    {
                      id: "tax-compliance",
                      name: "Tax compliance rate",
                      value: 0,
                      percentage: Math.round(taxEfficiency * 100),
                      color: "emerald" as const,
                    },
                  ]
                : []),
              {
                id: "inflation",
                name: "Annual inflation rate",
                value: 0,
                percentage: economyData?.core?.inflationRate ?? 0,
                color: "blue",
              },
              {
                id: "interest",
                name: "Central bank interest rate",
                value: 0,
                percentage: economyData?.fiscal?.interestRates ?? 0,
                color: "indigo",
              },
            ]}
          />
        </div>
      </motion.div>
    </div>
  );
}
