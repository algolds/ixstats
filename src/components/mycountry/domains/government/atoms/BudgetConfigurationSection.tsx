"use client";

import React from "react";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { City as Building2 } from "iconoir-react";
import { safeFormatCurrency, cn } from "~/lib/utils";
import { FacetCard, FacetCardContent } from "~/components/ui/facet-container";
import { EnhancedNumberInput } from "~/app/builder/primitives/enhanced/EnhancedNumberInput";
import { FieldHelpTooltip } from "~/app/builder/components/help/FieldHelpTooltip";
import type { GovernmentStructureInput } from "~/types/government";
import {
  validStances,
  validAudits,
  validReserves,
  validDebts,
  stanceDetails,
  auditDetails,
  reserveDetails,
  debtDetails,
} from "./governmentStructureConstants";

interface BudgetConfigurationSectionProps {
  data: GovernmentStructureInput;
  onChange: (field: keyof GovernmentStructureInput, value: string | number) => void;
  isReadOnly?: boolean;
  gdpData?: {
    nominalGDP: number;
    countryName?: string;
    taxRevenue?: number;
    taxRevenuePercent?: number;
  };
  asGlassCard?: boolean;
}

export function BudgetConfigurationSection({
  data,
  onChange,
  isReadOnly = false,
  gdpData,
  asGlassCard = false,
}: BudgetConfigurationSectionProps) {
  const parts = data.fiscalYear.includes(" | ")
    ? data.fiscalYear.split(" | ")
    : [data.fiscalYear];

  let fiscalStance = "Balanced Budget Directive";
  let auditLevel = "Standard Executive Audit";
  let reserveTarget = "5%";
  let debtLimit = "5%";

  const isLegacyComposite =
    parts.length === 2 &&
    !validStances.includes(parts[0] || "") &&
    validStances.includes(parts[1] || "");

  if (isLegacyComposite) {
    fiscalStance = parts[1]!;
  } else {
    if (parts[0] && validStances.includes(parts[0])) fiscalStance = parts[0];
    if (parts[1] && validAudits.includes(parts[1])) auditLevel = parts[1];
    if (parts[2] && validReserves.includes(parts[2])) reserveTarget = parts[2];
    if (parts[3] && validDebts.includes(parts[3])) debtLimit = parts[3];
  }

  const handleConfigChange = (field: "stance" | "audit" | "reserve" | "debt", value: string) => {
    const newStance = field === "stance" ? value : fiscalStance;
    const newAudit = field === "audit" ? value : auditLevel;
    const newReserve = field === "reserve" ? value : reserveTarget;
    const newDebt = field === "debt" ? value : debtLimit;
    onChange("fiscalYear", `${newStance} | ${newAudit} | ${newReserve} | ${newDebt}`);
  };

  const ratio =
    gdpData?.nominalGDP && gdpData.nominalGDP > 0 && data.totalBudget
      ? (data.totalBudget / gdpData.nominalGDP) * 100
      : 0;

  const taxPercent =
    gdpData?.taxRevenuePercent ||
    (gdpData?.nominalGDP && gdpData.taxRevenue
      ? (gdpData.taxRevenue / gdpData.nominalGDP) * 100
      : 20);

  const deficitSurplus = ratio - taxPercent;

  let colorClass = "";
  let statusText = "";
  if (deficitSurplus <= 0) {
    colorClass = "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20";
    statusText = `Fully Funded (Surplus: ${Math.abs(deficitSurplus).toFixed(1)}% of GDP)`;
  } else if (deficitSurplus <= 5) {
    colorClass = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    statusText = `Mild Deficit (+${deficitSurplus.toFixed(1)}% of GDP)`;
  } else if (deficitSurplus <= 15) {
    colorClass = "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20";
    statusText = `Moderate Deficit (+${deficitSurplus.toFixed(1)}% of GDP)`;
  } else {
    colorClass = "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    statusText = `Critical Deficit (+${deficitSurplus.toFixed(1)}% of GDP)`;
  }

  const content = (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {/* Total Budget */}
      <div className="space-y-2">
        <EnhancedNumberInput
          label="Total Budget Limit"
          value={data.totalBudget}
          onChange={(val) =>
            onChange("totalBudget", typeof val === "string" ? parseFloat(val) || 0 : val)
          }
          min={0}
          step={1000000}
          disabled={isReadOnly}
          showButtons={true}
          dynamicStep={true}
          sectionId="spending"
          size="sm"
          format={(val) =>
            safeFormatCurrency(Number(val), data.budgetCurrency || "USD", false)
          }
          placeholder="Enter budget limit..."
          className="animate-fade-in text-zinc-900 dark:text-white"
        />
        <div className="flex flex-col gap-1">
          {gdpData?.nominalGDP && gdpData.nominalGDP > 0 && (
            <>
              <span
                className={cn(
                  "mt-0.5 w-max rounded-full border px-2 py-0.5 text-xs font-semibold",
                  colorClass
                )}
              >
                {ratio.toFixed(1)}% of GDP ({gdpData.countryName || "Baseline"})
              </span>
              <span className="text-muted-foreground/80 px-0.5 text-[10px] leading-relaxed font-medium">
                Tax Revenue: {taxPercent.toFixed(1)}% • {statusText}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Fiscal Stance & Strategy */}
      <div className="space-y-2">
        <Label
          htmlFor="fiscalStance"
          className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300"
        >
          Fiscal Stance & Strategy
          <FieldHelpTooltip
            content="Determines the overriding objective of the government's annual budget plan, impacting public savings, economic growth, and austerity directives."
            title="Fiscal Stance & Strategy"
          />
        </Label>
        <Select
          value={fiscalStance}
          onValueChange={(value) => handleConfigChange("stance", value)}
          disabled={isReadOnly}
        >
          <SelectTrigger className="border-zinc-200 bg-white text-zinc-900 focus:border-cyan-500/30 focus:ring-cyan-500/20 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white">
            <SelectValue placeholder="Select budget stance" />
          </SelectTrigger>
          <SelectContent className="border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-950/95 dark:text-white">
            {Object.entries(stanceDetails).map(([val, info]) => (
              <SelectItem
                key={val}
                value={val}
                className="focus:bg-zinc-100 dark:focus:bg-zinc-800"
                title={info.tooltip}
                description={info.desc}
              >
                {val}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Auditing & Transparency */}
      <div className="space-y-2">
        <Label
          htmlFor="auditLevel"
          className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300"
        >
          Auditing & Transparency
          <FieldHelpTooltip
            content="Defines the degree of access and oversight of national accounts, balancing anti-corruption measures against covert and strategic intelligence flexibility."
            title="Auditing & Transparency"
          />
        </Label>
        <Select
          value={auditLevel}
          onValueChange={(value) => handleConfigChange("audit", value)}
          disabled={isReadOnly}
        >
          <SelectTrigger className="border-zinc-200 bg-white text-zinc-900 focus:border-cyan-500/30 focus:ring-cyan-500/20 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white">
            <SelectValue placeholder="Select transparency level" />
          </SelectTrigger>
          <SelectContent className="border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-950/95 dark:text-white">
            {Object.entries(auditDetails).map(([val, info]) => (
              <SelectItem
                key={val}
                value={val}
                className="focus:bg-zinc-100 dark:focus:bg-zinc-800"
                title={info.tooltip}
                description={info.desc}
              >
                {val}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Emergency Reserve Target */}
      <div className="space-y-2">
        <Label
          htmlFor="reserveTarget"
          className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300"
        >
          Emergency Reserve Target
          <FieldHelpTooltip
            content="The portion of annual revenues systematically allocated to sovereign wealth or contingency reserve accounts to mitigate economic shocks."
            title="Emergency Reserve Target"
          />
        </Label>
        <Select
          value={reserveTarget}
          onValueChange={(value) => handleConfigChange("reserve", value)}
          disabled={isReadOnly}
        >
          <SelectTrigger className="border-zinc-200 bg-white text-zinc-900 focus:border-cyan-500/30 focus:ring-cyan-500/20 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white">
            <SelectValue placeholder="Select reserve target" />
          </SelectTrigger>
          <SelectContent className="border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-950/95 dark:text-white">
            {Object.entries(reserveDetails).map(([val, info]) => (
              <SelectItem
                key={val}
                value={val}
                className="focus:bg-zinc-100 dark:focus:bg-zinc-800"
                title={info.tooltip}
                description={info.desc}
              >
                {info.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Debt Financing Limit */}
      <div className="space-y-2">
        <Label
          htmlFor="debtLimit"
          className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300"
        >
          Debt Financing Limit
          <FieldHelpTooltip
            content="The statutory maximum limit for annual borrowing to finance capital projects or deficits, expressed as a percent of the total budget."
            title="Debt Financing Limit"
          />
        </Label>
        <Select
          value={debtLimit}
          onValueChange={(value) => handleConfigChange("debt", value)}
          disabled={isReadOnly}
        >
          <SelectTrigger className="border-zinc-200 bg-white text-zinc-900 focus:border-cyan-500/30 focus:ring-cyan-500/20 dark:border-white/10 dark:bg-zinc-950/40 dark:text-white">
            <SelectValue placeholder="Select debt limit" />
          </SelectTrigger>
          <SelectContent className="border-zinc-200 bg-white text-zinc-900 dark:border-white/10 dark:bg-zinc-950/95 dark:text-white">
            {Object.entries(debtDetails).map(([val, info]) => (
              <SelectItem
                key={val}
                value={val}
                className="focus:bg-zinc-100 dark:focus:bg-zinc-800"
                title={info.tooltip}
                description={info.desc}
              >
                {info.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  if (asGlassCard) {
    return (
      <FacetCard
        depth={1}
        className="facet-surface facet-refraction border-cyan-500/20 bg-card/60 backdrop-blur-md"
      >
        <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
          <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
            <Building2 className="h-5 w-5 text-cyan-400" />
            Budget Configuration
          </h3>
        </div>
        <FacetCardContent className="p-6">{content}</FacetCardContent>
      </FacetCard>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)] p-4">
      <h4 className="mb-3 text-lg font-medium text-[var(--color-text-primary)]">
        Budget Configuration
      </h4>
      {content}
    </div>
  );
}
