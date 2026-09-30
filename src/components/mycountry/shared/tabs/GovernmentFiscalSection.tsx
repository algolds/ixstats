"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
import React from "react";
import { motion } from "motion/react";
import { City as Building, NavArrowRight as ChevronRight } from "iconoir-react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
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
  return (
    <div className="flex flex-col">
      <div className="flex">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          className={`focus-visible:ring-ring relative z-10 flex min-h-9 cursor-pointer items-center gap-2 rounded-t-xl border-x border-t px-4 py-2 text-sm font-semibold transition-[color,background-color,border-color] duration-150 outline-none focus-visible:ring-2 ${
            isExpanded
              ? "text-foreground border-border bg-card"
              : "text-muted-foreground hover:text-foreground border-transparent bg-transparent"
          }`}
        >
          <Building
            className={`h-3.5 w-3.5 ${isExpanded ? "text-foreground" : "text-muted-foreground"}`}
          />
          <span>Fiscal Policy</span>
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
        className={`bg-card relative overflow-hidden rounded-tr-xl rounded-b-xl transition-colors duration-200 ${
          isExpanded ? "border-border border" : "border border-transparent"
        }`}
      >
        <TextureOverlay
          texture="paperGrain"
          opacity={0.06}
          className="pointer-events-none absolute inset-0 z-0"
        />
        <div className="relative z-10 space-y-4 p-4">
          <div className="bg-muted/50 grid grid-cols-2 gap-4 rounded-xl p-3 md:grid-cols-4">
            <div className="min-w-0">
              <Eyebrow className="block">Tax Revenue % GDP</Eyebrow>
              <p className="text-foreground mt-0.5 text-sm font-bold">
                {`${(economyData?.fiscal?.taxRevenueGDPPercent ?? 0).toFixed(1)}%`}
              </p>
              <p className="text-muted-foreground/80 mt-0.5 text-xs">Tax burden ratio</p>
            </div>
            <div className="min-w-0">
              <Eyebrow className="block">Total Debt</Eyebrow>
              <p className="text-foreground mt-0.5 text-sm font-bold">
                {formatCompactCurrency(
                  (economyData?.core.nominalGDP ?? 0) *
                    ((economyData?.fiscal?.totalDebtGDPRatio ?? 0) / 100),
                  "N/A",
                  currency
                )}
              </p>
              <p className="text-muted-foreground/80 mt-0.5 text-xs">Outstanding national debt</p>
            </div>
            <div className="min-w-0">
              <Eyebrow className="block">Debt to GDP Ratio</Eyebrow>
              <p className="text-foreground mt-0.5 text-sm font-bold">
                {`${(economyData?.fiscal?.totalDebtGDPRatio ?? 0).toFixed(1)}%`}
              </p>
              <p className="text-muted-foreground/80 mt-0.5 text-xs">Relative to economic size</p>
            </div>
            <div className="min-w-0">
              <Eyebrow className="block">Sovereign Rating</Eyebrow>
              <p className="mt-0.5 text-sm font-bold text-emerald-500">AAA</p>
              <p className="text-muted-foreground/80 mt-0.5 text-xs">Credit worthiness rating</p>
            </div>
          </div>

          <SectorBreakdownCard
            title="Fiscal Conditions & Policy"
            subtitle="National fiscal policy indicators"
            layout="list"
            showProgressBars={true}
            cardWrapper="panel"
            accent="amber"
            sectors={[
              {
                id: "tax-compliance",
                name: "Tax Compliance Rate",
                value: 0,
                percentage:
                  economyData?.fiscal?.taxEfficiency != null
                    ? Math.round(economyData.fiscal.taxEfficiency * 100)
                    : 88,
                color: "emerald",
              },
              {
                id: "inflation",
                name: "Annual Inflation Rate",
                value: 0,
                percentage: economyData?.core?.inflationRate ?? 2.4,
                color: "blue",
              },
              {
                id: "interest",
                name: "Central Bank Interest Rate",
                value: 0,
                percentage: economyData?.fiscal?.interestRates ?? 4.25,
                color: "indigo",
              },
              {
                id: "reserves",
                name: "Foreign Exchange Reserves % GDP",
                value: 0,
                percentage: economyData?.fiscal?.fiscalBalanceGDPPercent ?? 18,
                color: "cyan",
              },
            ]}
          />
        </div>
      </motion.div>
    </div>
  );
}
