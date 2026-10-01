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
import { FacetCard, FacetCardContent, FacetCardHeader } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { EnhancedNumberInput } from "~/app/builder/primitives/enhanced/EnhancedNumberInput";
import { FieldHelpTooltip } from "~/app/builder/components/help/FieldHelpTooltip";
import { AdvancedFieldsDisclosure } from "~/app/builder/primitives/AdvancedFieldsDisclosure";
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

/** Values used when fiscalYear does not name them; also the "untouched" baseline for the disclosure. */
const ADVANCED_BUDGET_DEFAULTS = {
  auditLevel: "Standard Executive Audit",
  reserveTarget: "5%",
  debtLimit: "5%",
};

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
  const parts = data.fiscalYear.includes(" | ") ? data.fiscalYear.split(" | ") : [data.fiscalYear];

  let fiscalStance = "Balanced Budget Directive";
  let auditLevel = ADVANCED_BUDGET_DEFAULTS.auditLevel;
  let reserveTarget = ADVANCED_BUDGET_DEFAULTS.reserveTarget;
  let debtLimit = ADVANCED_BUDGET_DEFAULTS.debtLimit;

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
    colorClass = "border-green/30 text-green";
    statusText = `Fully Funded (Surplus: ${Math.abs(deficitSurplus).toFixed(1)}% of GDP)`;
  } else if (deficitSurplus <= 5) {
    colorClass = "border-yellow/30 text-yellow";
    statusText = `Mild Deficit (+${deficitSurplus.toFixed(1)}% of GDP)`;
  } else if (deficitSurplus <= 15) {
    colorClass = "border-orange/30 text-orange";
    statusText = `Moderate Deficit (+${deficitSurplus.toFixed(1)}% of GDP)`;
  } else {
    colorClass = "border-destructive/30 text-destructive";
    statusText = `Critical Deficit (+${deficitSurplus.toFixed(1)}% of GDP)`;
  }

  const content = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
            format={(val) => safeFormatCurrency(Number(val), data.budgetCurrency || "USD", false)}
            placeholder="Enter budget limit..."
            className="text-label"
          />
          <div className="flex flex-col gap-1">
            {gdpData?.nominalGDP && gdpData.nominalGDP > 0 && (
              <>
                <Badge variant="outline" className={cn("mt-0.5", colorClass)}>
                  {ratio.toFixed(1)}% of GDP ({gdpData.countryName || "Baseline"})
                </Badge>
                <span className="text-label-secondary text-caption px-0.5 leading-relaxed">
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
            className="text-label text-headline flex items-center gap-2"
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
            <SelectTrigger>
              <SelectValue placeholder="Select budget stance" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(stanceDetails).map(([val, info]) => (
                <SelectItem key={val} value={val} title={info.tooltip} description={info.desc}>
                  {val}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Audit, reserve and debt limits (advanced tier in FIELD_IMPORTANCE.government) */}
      <AdvancedFieldsDisclosure
        section="government"
        id="budget"
        values={{ auditLevel, reserveTarget, debtLimit }}
        defaults={ADVANCED_BUDGET_DEFAULTS}
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Auditing & Transparency */}
          <div className="space-y-2">
            <Label
              htmlFor="auditLevel"
              className="text-label text-headline flex items-center gap-2"
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
              <SelectTrigger>
                <SelectValue placeholder="Select transparency level" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(auditDetails).map(([val, info]) => (
                  <SelectItem key={val} value={val} title={info.tooltip} description={info.desc}>
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
              className="text-label text-headline flex items-center gap-2"
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
              <SelectTrigger>
                <SelectValue placeholder="Select reserve target" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(reserveDetails).map(([val, info]) => (
                  <SelectItem key={val} value={val} title={info.tooltip} description={info.desc}>
                    {info.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Debt Financing Limit */}
          <div className="space-y-2">
            <Label htmlFor="debtLimit" className="text-label text-headline flex items-center gap-2">
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
              <SelectTrigger>
                <SelectValue placeholder="Select debt limit" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(debtDetails).map(([val, info]) => (
                  <SelectItem key={val} value={val} title={info.tooltip} description={info.desc}>
                    {info.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </AdvancedFieldsDisclosure>
    </div>
  );

  if (asGlassCard) {
    return (
      <FacetCard>
        <FacetCardHeader className="border-separator border-b px-6 py-4">
          <h2 className="text-label text-title-3 flex items-center gap-2">
            <Building2 aria-hidden="true" className="text-label-secondary h-5 w-5" />
            Budget Configuration
          </h2>
        </FacetCardHeader>
        <FacetCardContent className="p-6">{content}</FacetCardContent>
      </FacetCard>
    );
  }

  return (
    <div className="border-separator rounded-control space-y-4 border p-4">
      <h4 className="text-label text-title-3 mb-3">Budget Configuration</h4>
      {content}
    </div>
  );
}
