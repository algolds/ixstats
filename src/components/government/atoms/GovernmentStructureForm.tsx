"use client";

import React, { useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Building2, Crown, Scale, Users, Briefcase, Link2, Link2Off } from "lucide-react";
import type { GovernmentStructureInput, GovernmentType } from "~/types/government";
import { safeFormatCurrency } from "~/lib/format-utils";
import { CurrencySelector } from "~/components/ui/currency-selector";
import { cn } from "~/lib/utils";
import { GlassCard, GlassCardContent } from "~/app/builder/components/glass/GlassCard";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { EnhancedNumberInput } from "~/app/builder/primitives/enhanced/EnhancedNumberInput";
import { FieldHelpTooltip } from "~/app/builder/components/help/GovernmentHelpSystem";

interface GovernmentStructureFormProps {
  data: GovernmentStructureInput;
  onChange: (data: GovernmentStructureInput) => void;
  isReadOnly?: boolean;
  gdpData?: {
    nominalGDP: number;
    countryName?: string;
    taxRevenue?: number;
    taxRevenuePercent?: number;
  };
  hideBudgetConfig?: boolean;
  showOnlyBudgetConfig?: boolean;
  noWrapper?: boolean;
  hideGovernmentType?: boolean;
}

const governmentTypes: GovernmentType[] = [
  "Constitutional Monarchy",
  "Federal Republic",
  "Parliamentary Democracy",
  "Presidential Republic",
  "Federal Constitutional Republic",
  "Unitary State",
  "Federation",
  "Confederation",
  "Empire",
  "City-State",
  "Other",
];

const validStances = [
  "Balanced Budget Directive",
  "Deficit Spending Strategy",
  "Sovereign Surplus Target",
  "Emergency Austerity Mode",
];

const validAudits = [
  "Public Oversight & Audit",
  "Standard Executive Audit",
  "Classified Strategic Budgeting",
];

const validReserves = ["0%", "5%", "10%", "20%"];
const validDebts = ["0%", "5%", "15%", "30%"];

const stanceDetails: Record<string, { desc: string; tooltip: string }> = {
  "Balanced Budget Directive": {
    desc: "Mandates matching revenues with outlays. Prevents structural debt expansion.",
    tooltip: "Statutory mandate to balance revenues and spending, limiting debt expansion.",
  },
  "Deficit Spending Strategy": {
    desc: "Finances infrastructure and public goods via debt to stimulate growth.",
    tooltip: "Leverages public debt to invest in strategic growth sectors and public services.",
  },
  "Sovereign Surplus Target": {
    desc: "Allocates excess revenue to sovereign wealth funds and savings.",
    tooltip:
      "Targets systemic savings to build national reserves and long-term financial security.",
  },
  "Emergency Austerity Mode": {
    desc: "Drastically cuts public spending to stabilize a critical debt crisis.",
    tooltip:
      "Implements aggressive spending cuts to restore investor confidence and resolve crises.",
  },
};

const auditDetails: Record<string, { desc: string; tooltip: string }> = {
  "Public Oversight & Audit": {
    desc: "Full public transparency and regular independent citizen audits.",
    tooltip: "Grants citizens and media full access to municipal and federal transaction records.",
  },
  "Standard Executive Audit": {
    desc: "Regular audits by executive agencies with normal legislative oversight.",
    tooltip: "Balanced model featuring professional administrative review and standard security.",
  },
  "Classified Strategic Budgeting": {
    desc: "Hidden strategic budgets to protect military and intelligence ops.",
    tooltip:
      "Shields national security, intelligence, and high-priority military expenditures from public view.",
  },
};

const reserveDetails: Record<string, { label: string; desc: string; tooltip: string }> = {
  "0%": {
    label: "0% (Fully Allocated)",
    desc: "No buffer. All incoming revenues are actively spent immediately.",
    tooltip: "High-efficiency, low-resilience model. Vulnerable to sudden revenue drops.",
  },
  "5%": {
    label: "5% (Sovereign Buffer)",
    desc: "Standard reserves to manage minor revenue fluctuations.",
    tooltip: "Moderate buffer protecting core operations against typical economic cycles.",
  },
  "10%": {
    label: "10% (High Resilience)",
    desc: "Robust savings to weather severe recessions or supply shocks.",
    tooltip: "Prepares the state treasury for major domestic and international crises.",
  },
  "20%": {
    label: "20% (Austerity Stash)",
    desc: "Maximum savings under strict budget controls for absolute safety.",
    tooltip: "High savings rate that secures national solvency during catastrophic events.",
  },
};

const debtDetails: Record<string, { label: string; desc: string; tooltip: string }> = {
  "0%": {
    label: "0% (Balanced Directive)",
    desc: "Strict zero borrowing policy. The nation runs entirely on cash.",
    tooltip: "Zero debt tolerance. Eliminates interest service costs but limits rapid scaling.",
  },
  "5%": {
    label: "5% (Conservative Borrowing)",
    desc: "Small, controlled loans to fund critical infrastructure.",
    tooltip: "Low-risk leverage model designed to maintain excellent credit ratings.",
  },
  "15%": {
    label: "15% (Growth Deficit)",
    desc: "Standard leverage to support expansion and developmental projects.",
    tooltip: "Moderate debt levels targeted towards high-return economic investments.",
  },
  "30%": {
    label: "30% (Aggressive Leveraged)",
    desc: "High debt ceiling to fund rapid industrialization or wartime mobilization.",
    tooltip:
      "High-leverage, high-risk strategy that accelerates development at the cost of high debt servicing.",
  },
};

export function GovernmentStructureForm({
  data,
  onChange,
  isReadOnly = false,
  gdpData,
  hideBudgetConfig = false,
  showOnlyBudgetConfig = false,
  noWrapper = false,
  hideGovernmentType = false,
}: GovernmentStructureFormProps) {
  // Use a ref to access latest data without causing re-renders
  const dataRef = useRef(data);
  dataRef.current = data;

  const [isGovHeadLocked, setIsGovHeadLocked] = React.useState(() => {
    return data.headOfState === data.headOfGovernment && !!data.headOfState;
  });

  const toggleGovHeadLock = useCallback(() => {
    const next = !isGovHeadLocked;
    setIsGovHeadLocked(next);
    if (next) {
      onChange({
        ...dataRef.current,
        headOfGovernment: dataRef.current.headOfState || "",
      });
    }
  }, [isGovHeadLocked, onChange]);

  const handleHeadOfStateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      onChange({
        ...dataRef.current,
        headOfState: value,
        headOfGovernment: isGovHeadLocked ? value : dataRef.current.headOfGovernment || "",
      });
    },
    [isGovHeadLocked, onChange]
  );

  const handleChange = useCallback(
    (field: keyof GovernmentStructureInput, value: string | number) => {
      onChange({
        ...dataRef.current,
        [field]: value,
      });
    },
    [onChange]
  );

  const formatCurrency = (amount: number) => {
    return safeFormatCurrency(amount, data.budgetCurrency || "USD", false, "USD");
  };

  if (showOnlyBudgetConfig) {
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
      handleChange("fiscalYear", `${newStance} | ${newAudit} | ${newReserve} | ${newDebt}`);
    };

    return (
      <GlassCard
        depth="base"
        theme="teal"
        className="border-cyan-500/20"
        texture="chevron"
        textureOpacity={0.04}
      >
        <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
          <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
            <Building2 className="h-5 w-5 text-cyan-400" />
            Budget Configuration
          </h3>
        </div>
        <GlassCardContent className="p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Total Budget */}
            <div className="space-y-2">
              <EnhancedNumberInput
                label="Total Budget Limit"
                value={data.totalBudget}
                onChange={(val) =>
                  handleChange("totalBudget", typeof val === "string" ? parseFloat(val) || 0 : val)
                }
                min={0}
                step={1000000}
                disabled={isReadOnly}
                showButtons={true}
                dynamicStep={true}
                sectionId="spending"
                size="sm"
                format={(val) =>
                  new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: data.budgetCurrency || "USD",
                    minimumFractionDigits: 0,
                  }).format(Number(val))
                }
                placeholder="Enter budget limit..."
                className="animate-fade-in text-zinc-900 dark:text-white"
              />
              <div className="flex flex-col gap-1">
                {gdpData?.nominalGDP &&
                  gdpData.nominalGDP > 0 &&
                  (() => {
                    const ratio = data.totalBudget
                      ? (data.totalBudget / gdpData.nominalGDP) * 100
                      : 0;
                    const taxPercent =
                      gdpData.taxRevenuePercent ||
                      (gdpData.taxRevenue ? (gdpData.taxRevenue / gdpData.nominalGDP) * 100 : 20);
                    const deficitSurplus = ratio - taxPercent;
                    let colorClass = "";
                    let statusText = "";
                    if (deficitSurplus <= 0) {
                      colorClass =
                        "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20";
                      statusText = `Fully Funded (Surplus: ${Math.abs(deficitSurplus).toFixed(1)}% of GDP)`;
                    } else if (deficitSurplus <= 5) {
                      colorClass =
                        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
                      statusText = `Mild Deficit (+${deficitSurplus.toFixed(1)}% of GDP)`;
                    } else if (deficitSurplus <= 15) {
                      colorClass =
                        "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20";
                      statusText = `Moderate Deficit (+${deficitSurplus.toFixed(1)}% of GDP)`;
                    } else {
                      colorClass = "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
                      statusText = `Critical Deficit (+${deficitSurplus.toFixed(1)}% of GDP)`;
                    }
                    return (
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
                    );
                  })()}
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
        </GlassCardContent>
      </GlassCard>
    );
  }

  const fieldsContent = (
    <div className="space-y-6">
      {!showOnlyBudgetConfig && (
        <>
          {/* Basic Information */}
          {hideGovernmentType ? (
            <div className="space-y-2">
              <Label
                htmlFor="governmentName"
                className="text-sm font-medium text-[var(--color-text-secondary)]"
              >
                Government Name
              </Label>
              <Input
                id="governmentName"
                value={data.governmentName}
                onChange={(e) => handleChange("governmentName", e.target.value)}
                placeholder="e.g., Imperial Government of Caphiria"
                disabled={isReadOnly}
                className="w-full"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="governmentName"
                  className="text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  Government Name
                </Label>
                <Input
                  id="governmentName"
                  value={data.governmentName}
                  onChange={(e) => handleChange("governmentName", e.target.value)}
                  placeholder="e.g., Imperial Government of Caphiria"
                  disabled={isReadOnly}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="governmentType"
                  className="text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  Government Type
                </Label>
                <Select
                  value={data.governmentType}
                  onValueChange={(value: GovernmentType) => handleChange("governmentType", value)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select government type" />
                  </SelectTrigger>
                  <SelectContent>
                    {governmentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Leadership */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="headOfState"
                  className="flex items-center text-sm font-medium text-[var(--color-text-secondary)]"
                >
                  <Crown className="mr-1 h-4 w-4" />
                  Head of State
                </Label>
                <button
                  type="button"
                  onClick={toggleGovHeadLock}
                  className={cn(
                    "flex items-center gap-1 text-[10px] font-semibold transition-all duration-150 focus:outline-none",
                    isGovHeadLocked
                      ? "text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={
                    isGovHeadLocked
                      ? "Unlock Head of Government to set a different value"
                      : "Set Head of Government to match Head of State"
                  }
                >
                  {isGovHeadLocked ? (
                    <>
                      <Link2 className="h-3 w-3" />
                      <span>Linked as Gov. Head</span>
                    </>
                  ) : (
                    <>
                      <Link2Off className="text-muted-foreground/60 h-3 w-3" />
                      <span>Link Gov. Head</span>
                    </>
                  )}
                </button>
              </div>
              <Input
                id="headOfState"
                value={data.headOfState || ""}
                onChange={handleHeadOfStateChange}
                placeholder="e.g., Emperor, President"
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="headOfGovernment"
                className="flex items-center text-sm font-medium text-[var(--color-text-secondary)]"
              >
                <Briefcase className="mr-1 h-4 w-4" />
                Head of Government
              </Label>
              <Input
                id="headOfGovernment"
                value={isGovHeadLocked ? data.headOfState || "" : data.headOfGovernment || ""}
                onChange={(e) => handleChange("headOfGovernment", e.target.value)}
                placeholder={
                  isGovHeadLocked ? "Same as Head of State" : "e.g., Prime Minister, Chancellor"
                }
                disabled={isReadOnly || isGovHeadLocked}
              />
            </div>
          </div>

          {/* Branches of Government */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label
                htmlFor="legislatureName"
                className="flex items-center text-sm font-medium text-[var(--color-text-secondary)]"
              >
                <Users className="mr-1 h-4 w-4" />
                Legislature
              </Label>
              <Input
                id="legislatureName"
                value={data.legislatureName || ""}
                onChange={(e) => handleChange("legislatureName", e.target.value)}
                placeholder="e.g., Imperial Senate, Parliament"
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="executiveName"
                className="flex items-center text-sm font-medium text-[var(--color-text-secondary)]"
              >
                <Briefcase className="mr-1 h-4 w-4" />
                Executive
              </Label>
              <Input
                id="executiveName"
                value={data.executiveName || ""}
                onChange={(e) => handleChange("executiveName", e.target.value)}
                placeholder="e.g., Imperial Cabinet, Executive Council"
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="judicialName"
                className="flex items-center text-sm font-medium text-[var(--color-text-secondary)]"
              >
                <Scale className="mr-1 h-4 w-4" />
                Judiciary
              </Label>
              <Input
                id="judicialName"
                value={data.judicialName || ""}
                onChange={(e) => handleChange("judicialName", e.target.value)}
                placeholder="e.g., Supreme Court, High Court"
                disabled={isReadOnly}
              />
            </div>
          </div>
        </>
      )}

      {/* Budget Configuration */}
      {(!hideBudgetConfig || showOnlyBudgetConfig) &&
        (() => {
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

          const handleConfigChange = (
            field: "stance" | "audit" | "reserve" | "debt",
            value: string
          ) => {
            const newStance = field === "stance" ? value : fiscalStance;
            const newAudit = field === "audit" ? value : auditLevel;
            const newReserve = field === "reserve" ? value : reserveTarget;
            const newDebt = field === "debt" ? value : debtLimit;
            handleChange("fiscalYear", `${newStance} | ${newAudit} | ${newReserve} | ${newDebt}`);
          };

          return (
            <div className="space-y-4 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-tertiary)] p-4">
              <h4 className="mb-3 text-lg font-medium text-[var(--color-text-primary)]">
                Budget Configuration
              </h4>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Total Budget Limit */}
                <div className="space-y-2">
                  <EnhancedNumberInput
                    label="Total Budget Limit"
                    value={data.totalBudget}
                    onChange={(val) =>
                      handleChange(
                        "totalBudget",
                        typeof val === "string" ? parseFloat(val) || 0 : val
                      )
                    }
                    min={0}
                    step={1000000}
                    disabled={isReadOnly}
                    showButtons={true}
                    dynamicStep={true}
                    sectionId="spending"
                    size="sm"
                    format={(val) =>
                      new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: data.budgetCurrency || "USD",
                        minimumFractionDigits: 0,
                      }).format(Number(val))
                    }
                    placeholder="Enter budget limit..."
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-cyan-500">
                      Live: <NumberFlowDisplay value={data.totalBudget || 0} format="currency" />
                    </span>
                    {gdpData?.nominalGDP &&
                      gdpData.nominalGDP > 0 &&
                      (() => {
                        const ratio = data.totalBudget
                          ? (data.totalBudget / gdpData.nominalGDP) * 100
                          : 0;
                        const taxPercent =
                          gdpData.taxRevenuePercent ||
                          (gdpData.taxRevenue
                            ? (gdpData.taxRevenue / gdpData.nominalGDP) * 100
                            : 20);
                        const deficitSurplus = ratio - taxPercent;
                        let colorClass = "";
                        let statusText = "";
                        if (deficitSurplus <= 0) {
                          colorClass =
                            "bg-cyan-500/10 text-cyan-500 border-cyan-500/10 dark:text-cyan-400";
                          statusText = `Fully Funded (Surplus: ${Math.abs(deficitSurplus).toFixed(1)}% of GDP)`;
                        } else if (deficitSurplus <= 5) {
                          colorClass =
                            "bg-amber-500/10 text-amber-600 border-amber-500/10 dark:text-amber-400";
                          statusText = `Mild Deficit (+${deficitSurplus.toFixed(1)}% of GDP)`;
                        } else if (deficitSurplus <= 15) {
                          colorClass =
                            "bg-orange-500/10 text-orange-600 border-orange-500/10 dark:text-orange-400";
                          statusText = `Moderate Deficit (+${deficitSurplus.toFixed(1)}% of GDP)`;
                        } else {
                          colorClass =
                            "bg-red-500/10 text-red-600 border-red-500/10 dark:text-red-400";
                          statusText = `Critical Deficit (+${deficitSurplus.toFixed(1)}% of GDP)`;
                        }
                        return (
                          <>
                            <span
                              className={cn(
                                "mt-0.5 w-max rounded border px-2 py-0.5 text-xs font-semibold",
                                colorClass
                              )}
                            >
                              {ratio.toFixed(1)}% of GDP
                            </span>
                            <span className="text-muted-foreground/80 px-0.5 text-[10px] leading-relaxed font-medium">
                              Tax Revenue: {taxPercent.toFixed(1)}% • {statusText}
                            </span>
                          </>
                        );
                      })()}
                  </div>
                </div>

                {/* Fiscal Stance & Strategy */}
                <div className="space-y-2">
                  <Label
                    htmlFor="fiscalStance"
                    className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]"
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
                        <SelectItem
                          key={val}
                          value={val}
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
                    className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]"
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
                        <SelectItem
                          key={val}
                          value={val}
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
                    className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]"
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
                        <SelectItem
                          key={val}
                          value={val}
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
                    className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]"
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
                    <SelectTrigger>
                      <SelectValue placeholder="Select debt limit" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(debtDetails).map(([val, info]) => (
                        <SelectItem
                          key={val}
                          value={val}
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
            </div>
          );
        })()}
    </div>
  );

  if (noWrapper) {
    return fieldsContent;
  }

  return (
    <Card className="w-full">
      {!showOnlyBudgetConfig && (
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center text-xl font-semibold text-[var(--color-text-primary)]">
            <Building2 className="mr-2 h-6 w-6 text-[var(--color-brand-primary)]" />
            Government Structure
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-6">{fieldsContent}</CardContent>
    </Card>
  );
}
