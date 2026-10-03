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
import { Card, CardContent, CardHeader } from "~/components/ui/card";

/** Values used when fiscalYear does not name them; also the "untouched" baseline for the disclosure. */
const ADVANCED_BUDGET_DEFAULTS = {
  auditLevel: "Standard Executive Audit",
  reserveTarget: "5%",
  debtLimit: "5%",
};

type Details = Record<string, { label?: string; desc: string; tooltip: string }>;
type ConfigKey = "stance" | "audit" | "reserve" | "debt";

/** Fields packed into `fiscalYear` as "stance | audit | reserve | debt", in order. */
const CONFIG_FIELDS: {
  key: ConfigKey;
  id: string;
  label: string;
  help: string;
  placeholder: string;
  valid: string[];
  fallback: string;
  details: Details;
}[] = [
  {
    key: "stance",
    id: "fiscalStance",
    label: "Fiscal stance & strategy",
    help: "Determines the overriding objective of the government's annual budget plan, impacting public savings, economic growth, and austerity directives.",
    placeholder: "Select budget stance",
    valid: validStances,
    fallback: "Balanced Budget Directive",
    details: stanceDetails,
  },
  {
    key: "audit",
    id: "auditLevel",
    label: "Auditing & transparency",
    help: "Defines the degree of access and oversight of national accounts, balancing anti-corruption measures against covert and strategic intelligence flexibility.",
    placeholder: "Select transparency level",
    valid: validAudits,
    fallback: ADVANCED_BUDGET_DEFAULTS.auditLevel,
    details: auditDetails,
  },
  {
    key: "reserve",
    id: "reserveTarget",
    label: "Emergency reserve target",
    help: "The portion of annual revenues systematically allocated to sovereign wealth or contingency reserve accounts to mitigate economic shocks.",
    placeholder: "Select reserve target",
    valid: validReserves,
    fallback: ADVANCED_BUDGET_DEFAULTS.reserveTarget,
    details: reserveDetails,
  },
  {
    key: "debt",
    id: "debtLimit",
    label: "Debt financing limit",
    help: "The statutory maximum limit for annual borrowing to finance capital projects or deficits, expressed as a percent of the total budget.",
    placeholder: "Select debt limit",
    valid: validDebts,
    fallback: ADVANCED_BUDGET_DEFAULTS.debtLimit,
    details: debtDetails,
  },
];

function parseFiscalYear(fiscalYear: string): Record<ConfigKey, string> {
  const parts = fiscalYear.split(" | ");
  const values = Object.fromEntries(CONFIG_FIELDS.map((f) => [f.key, f.fallback])) as Record<
    ConfigKey,
    string
  >;
  if (parts.length === 2 && !validStances.includes(parts[0]!) && validStances.includes(parts[1]!)) {
    return { ...values, stance: parts[1]! };
  }
  CONFIG_FIELDS.forEach((f, i) => {
    const part = parts[i];
    if (part && f.valid.includes(part)) values[f.key] = part;
  });
  return values;
}

/** Deficit bands as [upper bound (% of GDP), border/text classes, label]. */
const DEFICIT_BANDS: [number, string, string][] = [
  [0, "border-green/30 text-green", "Fully Funded"],
  [5, "border-yellow/30 text-yellow", "Mild Deficit"],
  [15, "border-orange/30 text-orange", "Moderate Deficit"],
  [Infinity, "border-destructive/30 text-destructive", "Critical Deficit"],
];

function ConfigSelect({
  field,
  value,
  disabled,
  onSelect,
}: {
  field: (typeof CONFIG_FIELDS)[number];
  value: string;
  disabled: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.id} className="text-label text-headline flex items-center gap-2">
        {field.label}
        <FieldHelpTooltip content={field.help} title={field.label} />
      </Label>
      <Select value={value} onValueChange={onSelect} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={field.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(field.details).map(([val, info]) => (
            <SelectItem key={val} value={val} title={info.tooltip} description={info.desc}>
              {info.label ?? val}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

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
  const config = parseFiscalYear(data.fiscalYear);

  const handleConfigChange = (field: ConfigKey, value: string) => {
    const next = { ...config, [field]: value };
    onChange("fiscalYear", CONFIG_FIELDS.map((f) => next[f.key]).join(" | "));
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

  const [, colorClass, bandLabel] = DEFICIT_BANDS.find(([max]) => deficitSurplus <= max)!;
  const statusText =
    deficitSurplus <= 0
      ? `${bandLabel} (Surplus: ${Math.abs(deficitSurplus).toFixed(1)}% of GDP)`
      : `${bandLabel} (+${deficitSurplus.toFixed(1)}% of GDP)`;

  const [stanceField, ...advancedFields] = CONFIG_FIELDS;
  const renderSelect = (field: (typeof CONFIG_FIELDS)[number]) => (
    <ConfigSelect
      key={field.key}
      field={field}
      value={config[field.key]}
      disabled={isReadOnly}
      onSelect={(value) => handleConfigChange(field.key, value)}
    />
  );

  const content = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <EnhancedNumberInput
            label="Total budget limit"
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
        {renderSelect(stanceField!)}
      </div>

      {/* Audit, reserve and debt limits (advanced tier in FIELD_IMPORTANCE.government) */}
      <AdvancedFieldsDisclosure
        section="government"
        id="budget"
        values={{
          auditLevel: config.audit,
          reserveTarget: config.reserve,
          debtLimit: config.debt,
        }}
        defaults={ADVANCED_BUDGET_DEFAULTS}
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {advancedFields.map(renderSelect)}
        </div>
      </AdvancedFieldsDisclosure>
    </div>
  );

  if (asGlassCard) {
    return (
      <Card>
        <CardHeader className="border-separator border-b px-6 py-4">
          <h2 className="text-label text-title-3 flex items-center gap-2">
            <Building2 aria-hidden="true" className="text-label-secondary h-5 w-5" />
            Budget configuration
          </h2>
        </CardHeader>
        <CardContent className="p-6">{content}</CardContent>
      </Card>
    );
  }

  return (
    <div className="border-separator rounded-control space-y-4 border p-4">
      <h4 className="text-label text-title-3 mb-3">Budget configuration</h4>
      {content}
    </div>
  );
}
