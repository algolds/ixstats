"use client";

import React from "react";
import { motion } from "motion/react";
import { Globe, NavArrowRight as ChevronRight } from "iconoir-react";
import { formatCompactCurrency } from "~/lib/utils";
import type { MappedEconomyData } from "~/components/mycountry/shared/primitives/CountryDataProvider";

interface EconomyTradeSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  economyData?: MappedEconomyData | null;
  currency: string;
}

function TradeFigure({
  label,
  amount,
  detail,
  currency,
  tone = "text-label",
}: {
  label: string;
  amount: number | null;
  detail: string;
  currency: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <span className="text-stat-label text-label-secondary block">{label}</span>
      <p className={`${tone} text-headline mt-0.5`}>
        {amount == null ? (
          <span role="img" aria-label="Not recorded">
            —
          </span>
        ) : (
          formatCompactCurrency(amount, "N/A", currency)
        )}
      </p>
      <p className="text-label-secondary text-footnote mt-0.5">{detail}</p>
    </div>
  );
}

export function EconomyTradeSection({
  isExpanded,
  onToggle,
  economyData,
  currency,
}: EconomyTradeSectionProps): React.JSX.Element {
  const gdp = economyData?.core.nominalGDP ?? 0;
  const exportsPct = economyData?.core.exportsGDPPercent ?? null;
  const importsPct = economyData?.core.importsGDPPercent ?? null;
  const exports = gdp > 0 && exportsPct != null ? (gdp * exportsPct) / 100 : null;
  const imports = gdp > 0 && importsPct != null ? (gdp * importsPct) / 100 : null;
  const balance = exports != null && imports != null ? exports - imports : null;

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
        <div className="relative z-10 p-4">
          <div className="bg-fill-3 rounded-row grid grid-cols-3 gap-4 p-3">
            <TradeFigure
              label="Total exports"
              amount={exports}
              detail={exportsPct != null ? `${exportsPct.toFixed(1)}% of GDP` : "Not recorded"}
              currency={currency}
            />
            <TradeFigure
              label="Total imports"
              amount={imports}
              detail={importsPct != null ? `${importsPct.toFixed(1)}% of GDP` : "Not recorded"}
              currency={currency}
            />
            <TradeFigure
              label="Trade balance"
              amount={balance}
              detail={balance == null ? "Not recorded" : balance >= 0 ? "Surplus" : "Deficit"}
              currency={currency}
              tone={balance == null ? undefined : balance >= 0 ? "text-green" : "text-destructive"}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
