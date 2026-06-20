"use client";

import React, { useState, useMemo, memo } from "react";
import {
  TrendingDown,
  DollarSign,
  Building,
  Building2,
  CreditCard,
  Shield,
  PieChart,
  Zap,
} from "lucide-react";
import { AtomicEconomicEffectivenessPanel } from "~/components/economics/AtomicEconomicEffectivenessPanel";
import { api } from "~/trpc/react";
import type { ComponentType } from "~/types/government";
import {
  EnhancedNumberInput,
  EnhancedBarChart,
  EnhancedPieChart,
  MetricCard,
  SliderWithDirectInput,
} from "../primitives/enhanced";
import {
  SectionBase,
  SectionLayout,
  sectionConfigs,
  sectionUtils,
  type ExtendedSectionProps,
} from "../components/glass/SectionBase";

// Help System
import { EconomicsHelpSystem } from "../components/help/GovernmentHelpSystem";

import { TaxBuilder } from "~/components/tax-system/TaxBuilder";
import type { TaxBuilderState } from "~/hooks/useTaxBuilderState";

interface FiscalSystemSectionProps extends ExtendedSectionProps {
  nominalGDP: number;
  totalPopulation: number;
  countryId?: string;
  showAtomicIntegration?: boolean;
  mode?: "create" | "edit";
  fieldLocks?: Record<string, import("../components/enhanced/builderConfig").FieldLockConfig>;
}

// Phase 2 optimization: Wrap with React.memo to prevent unnecessary re-renders
export const FiscalSystemSection = memo(function FiscalSystemSection({
  inputs,
  onInputsChange,
  showAdvanced = false,
  onToggleAdvanced,
  referenceCountry,
  nominalGDP,
  totalPopulation,
  className,
  countryId,
  showAtomicIntegration = false,
  mode = "create",
}: FiscalSystemSectionProps) {
  const isEditMode = mode === "edit";

  const [selectedView, setSelectedView] = useState<
    "overview" | "revenue" | "spending" | "debt" | "atomic" | "builder"
  >("overview");

  const [taxBuilderState, setTaxBuilderState] = useState<TaxBuilderState>(() => ({
    taxSystem: {
      taxSystemName: "Fiscal System",
      fiscalYear: "calendar",
      progressiveTax: true,
      alternativeMinTax: false,
      complianceRate: 85,
      collectionEfficiency: 90,
    },
    categories: [
      {
        categoryName: "Personal Income",
        categoryType: "income",
        isActive: true,
        baseRate: 25,
        calculationMethod: "percentage" as const,
        deductionAllowed: true,
        priority: 1,
      },
      {
        categoryName: "Corporate",
        categoryType: "corporate",
        isActive: true,
        baseRate: 20,
        calculationMethod: "percentage" as const,
        deductionAllowed: true,
        priority: 2,
      },
      {
        categoryName: "Sales",
        categoryType: "sales",
        isActive: true,
        baseRate: 10,
        calculationMethod: "percentage" as const,
        deductionAllowed: false,
        priority: 3,
      },
    ],
    brackets: {},
    exemptions: [],
    deductions: {},
    isValid: true,
    errors: {},
  }));

  // Atomic component integration
  const { data: atomicComponents } = api.government.getComponents.useQuery(
    { countryId: countryId || "" },
    {
      enabled: !!countryId && showAtomicIntegration,
      staleTime: 30000,
    }
  );

  const activeComponents =
    atomicComponents?.filter((c) => c.isActive).map((c) => c.componentType as ComponentType) || [];

  // Use fiscalSystem from inputs with safe fallback for hooks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fiscalSystem = inputs.fiscalSystem ?? {
    taxRevenueGDPPercent: 20,
    governmentBudgetGDPPercent: 25,
    totalDebtGDPRatio: 60,
    budgetDeficitSurplus: 0,
    debtServiceCosts: 0,
    governmentRevenueTotal: 0,
    internalDebtGDPPercent: 30,
    externalDebtGDPPercent: 20,
    taxRates: {
      personalIncomeTaxRates: [],
      corporateTaxRates: [],
      salesTaxRate: 0,
      propertyTaxRate: 0,
    },
  };

  const handleFiscalChange = (key: string, value: any) => {
    const keys = key.split(".");
    const updatedFiscal = { ...fiscalSystem };

    if (keys.length === 1) {
      (updatedFiscal as any)[key] = value;
    } else if (keys.length === 2) {
      (updatedFiscal as any)[keys[0]] = {
        ...(updatedFiscal as any)[keys[0]],
        [keys[1]]: value,
      };
    }

    onInputsChange({
      ...inputs,
      fiscalSystem: updatedFiscal,
    });
  };

  // Live metrics from fiscal system - NO FALLBACKS
  const metrics = useMemo(() => {
    // Use actual values with NaN protection
    const taxRevenue = Number(fiscalSystem.taxRevenueGDPPercent);
    const budgetBalance = Number(fiscalSystem.budgetDeficitSurplus);
    const totalDebt = Number(fiscalSystem.totalDebtGDPRatio);
    const govRevenue = Number(fiscalSystem.governmentRevenueTotal);

    // If ANY value is NaN, force defaults
    const safeTaxRevenue = isNaN(taxRevenue) ? 20 : taxRevenue;
    const safeBudgetBalance = isNaN(budgetBalance) ? -50000000000 : budgetBalance;
    const safeTotalDebt = isNaN(totalDebt) ? 60 : totalDebt;
    const safeGovRevenue = isNaN(govRevenue) ? 200000000000 : govRevenue;

    return [
      {
        label: "Tax Revenue",
        title: "Tax Revenue",
        value: `${safeTaxRevenue.toFixed(1)}%`,
        subtitle: "of GDP",
        trend:
          safeTaxRevenue >= 20
            ? ("up" as const)
            : safeTaxRevenue >= 15
              ? ("neutral" as const)
              : ("down" as const),
        color:
          safeTaxRevenue >= 20
            ? ("green" as const)
            : safeTaxRevenue >= 15
              ? ("blue" as const)
              : ("red" as const),
      },
      {
        label: "Budget Balance",
        title: "Budget Balance",
        value:
          safeBudgetBalance >= 0
            ? sectionUtils.formatCurrency(safeBudgetBalance, "$", 1)
            : `-${sectionUtils.formatCurrency(Math.abs(safeBudgetBalance), "$", 1)}`,
        subtitle: safeBudgetBalance >= 0 ? "Surplus" : "Deficit",
        trend: safeBudgetBalance >= 0 ? ("up" as const) : ("down" as const),
        color: safeBudgetBalance >= 0 ? ("green" as const) : ("red" as const),
      },
      {
        label: "Public Debt",
        title: "Public Debt",
        value: `${safeTotalDebt.toFixed(1)}%`,
        subtitle: "of GDP",
        trend:
          safeTotalDebt <= 60
            ? ("up" as const)
            : safeTotalDebt <= 90
              ? ("neutral" as const)
              : ("down" as const),
        color:
          safeTotalDebt <= 60
            ? ("green" as const)
            : safeTotalDebt <= 90
              ? ("blue" as const)
              : ("red" as const),
      },
      {
        label: "Government Revenue",
        title: "Gov Revenue",
        value: sectionUtils.formatCurrency(safeGovRevenue, "$", 1),
        subtitle: "Total Annual",
        trend: "neutral" as const,
        color: "blue" as const,
      },
    ];
  }, [fiscalSystem]);

  // Calculate fiscal health score
  const fiscalHealthScore = useMemo(() => {
    const safeTaxRev = Number(fiscalSystem.taxRevenueGDPPercent);
    const safeDebtRatio = Number(fiscalSystem.totalDebtGDPRatio);
    const safeBudgetBalance = Number(fiscalSystem.budgetDeficitSurplus || 0);
    if (isNaN(safeTaxRev) || isNaN(safeDebtRatio)) return 0;

    let score = 100;

    // Tax burden assessment
    if (safeTaxRev < 15) score -= 20;
    else if (safeTaxRev > 40) score -= 15;

    // Debt assessment
    if (safeDebtRatio > 90) score -= 30;
    else if (safeDebtRatio > 60) score -= 20;

    // Budget balance assessment
    const deficitPercent = Math.abs(safeBudgetBalance / (nominalGDP || 1)) * 100;
    if (deficitPercent > 3) score -= 25;
    else if (deficitPercent > 1) score -= 10;

    return Math.max(0, score);
  }, [fiscalSystem, nominalGDP]);

  // Live tax rates from fiscal system
  const taxData = useMemo(() => {
    const rates = fiscalSystem.taxRates;
    if (!rates) {
      return [];
    }

    const personalRates = rates.personalIncomeTaxRates || rates.income || [];
    const corporateRates = rates.corporateTaxRates || rates.corporate || [];

    // Get actual rates, validate numbers
    const incomeRate =
      personalRates.length > 0 ? Number(personalRates[personalRates.length - 1]?.rate) : 0;
    const corporateRate =
      corporateRates.length > 0 ? Number(corporateRates[corporateRates.length - 1]?.rate) : 0;
    const salesRate = Number(rates.salesTaxRate || rates.sales);
    const propertyRate = Number(rates.propertyTaxRate);

    return [
      { name: "Income Tax", rate: isNaN(incomeRate) ? 0 : incomeRate },
      { name: "Corporate Tax", rate: isNaN(corporateRate) ? 0 : corporateRate },
      { name: "Sales Tax", rate: isNaN(salesRate) ? 0 : salesRate },
      { name: "Property Tax", rate: isNaN(propertyRate) ? 0 : propertyRate },
    ].filter((item) => item.rate > 0); // Only show taxes that have rates
  }, [fiscalSystem]);

  const taxBredownData = useMemo(() => {
    const totalRevenue = Number(fiscalSystem.governmentRevenueTotal);
    const taxRevenuePercent = Number(fiscalSystem.taxRevenueGDPPercent);

    if (isNaN(totalRevenue) && isNaN(taxRevenuePercent)) {
      return [];
    }

    // Calculate actual total revenue
    const actualRevenue = !isNaN(totalRevenue)
      ? totalRevenue
      : !isNaN(taxRevenuePercent)
        ? (nominalGDP * taxRevenuePercent) / 100
        : 0;

    if (actualRevenue === 0) {
      return [];
    }

    // Convert to billions for display, use proportional breakdown based on tax rates
    const rates = fiscalSystem.taxRates;
    const incomeRate = Number(
      rates?.personalIncomeTaxRates?.[rates.personalIncomeTaxRates.length - 1]?.rate || 0
    );
    const corporateRate = Number(
      rates?.corporateTaxRates?.[rates.corporateTaxRates.length - 1]?.rate || 0
    );
    const salesRate = Number(rates?.salesTaxRate || 0);
    const propertyRate = Number(rates?.propertyTaxRate || 0);

    const totalRate = incomeRate + corporateRate + salesRate + propertyRate;

    if (totalRate === 0) {
      return [];
    }

    return [
      {
        category: "Income Tax",
        value: actualRevenue * (incomeRate / totalRate),
      },
      {
        category: "Corporate Tax",
        value: actualRevenue * (corporateRate / totalRate),
      },
      {
        category: "Sales Tax",
        value: actualRevenue * (salesRate / totalRate),
      },
      {
        category: "Property Tax",
        value: actualRevenue * (propertyRate / totalRate),
      },
    ].filter((item) => item.value > 0);
  }, [fiscalSystem, nominalGDP]);

  const spendingCategories = useMemo(() => {
    // Use government spending data from inputs
    const govSpending = inputs.governmentSpending;
    if (!govSpending || !govSpending.spendingCategories) {
      return [];
    }

    return govSpending.spendingCategories
      .filter((cat: any) => cat && (cat.amount > 0 || cat.value > 0))
      .map((cat: any) => ({
        name: cat.category || cat.name || "Unknown",
        value: Number(cat.amount || cat.value || 0),
        icon: Shield,
      }))
      .filter((item) => !isNaN(item.value) && item.value > 0);
  }, [inputs.governmentSpending]);

  // Ensure fiscal system data is usable
  const hasFiscalData = fiscalSystem && typeof fiscalSystem.taxRevenueGDPPercent === "number";
  if (!hasFiscalData) {
    return (
      <div className="p-4 text-red-600 dark:text-red-400">
        Error: No fiscal system data available
      </div>
    );
  }

  // Main content with sub-tabs
  const basicContent = (
    <>
      {/* View Selector - Always visible at top */}
      <div className="mb-6 md:col-span-2">
        <div
          className={`grid ${showAtomicIntegration ? "grid-cols-6" : "grid-cols-5"} bg-card border-border gap-1 rounded-lg border p-1`}
        >
          {(
            [
              "overview",
              "revenue",
              "spending",
              "debt",
              ...(showAtomicIntegration ? ["atomic"] : []),
              "builder",
            ] as const
          ).map((view) => (
            <button
              key={view}
              onClick={() =>
                setSelectedView(
                  view as "overview" | "revenue" | "spending" | "debt" | "atomic" | "builder"
                )
              }
              className={`rounded-md px-3 py-2 text-sm font-medium capitalize transition-all duration-200 ${
                selectedView === view
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
              }`}
            >
              {view === "overview"
                ? "Overview"
                : view === "revenue"
                  ? "Tax Revenue"
                  : view === "spending"
                    ? "Gov Spending"
                    : view === "debt"
                      ? "Debt Mgmt"
                      : view === "atomic"
                        ? "Atomic Effects"
                        : "Tax Builder"}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Section */}
      {selectedView === "overview" && (
        <>
          {/* Overview Metrics */}
          <div className="mb-6 md:col-span-2">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {metrics.map((metric, index) => (
                <MetricCard key={index} {...metric} sectionId="fiscal" className="h-full" />
              ))}
            </div>
          </div>

          {/* Fiscal Overview Controls */}
          <SliderWithDirectInput
            label="Tax Revenue (% of GDP)"
            description="Government revenue from all taxes as percentage of GDP"
            value={
              isNaN(Number(fiscalSystem.taxRevenueGDPPercent))
                ? 20
                : Number(fiscalSystem.taxRevenueGDPPercent)
            }
            onChange={(value) => handleFiscalChange("taxRevenueGDPPercent", value)}
            min={5}
            max={50}
            step={0.5}
            precision={1}
            unit="% of GDP"
            sectionId="fiscal"
            icon={DollarSign}
            showTicks={true}
            tickCount={6}
            showValue={true}
            showRange={true}
            referenceValue={referenceCountry?.taxRevenuePercent}
            referenceLabel={referenceCountry?.name}
            showComparison={!!referenceCountry}
            defaultMode="input"
            allowModeToggle={true}
          />

          <SliderWithDirectInput
            label="Government Spending (% of GDP)"
            description="Total government expenditure as percentage of GDP"
            value={
              isNaN(Number(fiscalSystem.governmentBudgetGDPPercent))
                ? 25
                : Number(fiscalSystem.governmentBudgetGDPPercent)
            }
            onChange={(value) => handleFiscalChange("governmentBudgetGDPPercent", value)}
            min={10}
            max={60}
            step={0.5}
            precision={1}
            unit="% of GDP"
            sectionId="fiscal"
            icon={Building}
            showTicks={true}
            tickCount={6}
            showValue={true}
            showRange={true}
            referenceValue={referenceCountry?.governmentSpending}
            referenceLabel={referenceCountry?.name}
            showComparison={!!referenceCountry}
            defaultMode="input"
            allowModeToggle={true}
          />

          <SliderWithDirectInput
            label="Public Debt (% of GDP)"
            description="Total government debt as percentage of GDP"
            value={
              isNaN(Number(fiscalSystem.totalDebtGDPRatio))
                ? 60
                : Number(fiscalSystem.totalDebtGDPRatio)
            }
            onChange={(value) => handleFiscalChange("totalDebtGDPRatio", value)}
            min={0}
            max={200}
            step={1}
            precision={1}
            unit="% of GDP"
            sectionId="fiscal"
            icon={CreditCard}
            showTicks={true}
            tickCount={5}
            showValue={true}
            showRange={true}
            defaultMode="input"
            allowModeToggle={true}
          />

          {/* Live Revenue Breakdown */}
          <div className="md:col-span-2">
            {taxBredownData.length > 0 ? (
              <EnhancedPieChart
                data={taxBredownData}
                dataKey="value"
                nameKey="category"
                title="Tax Revenue Sources"
                description="Live breakdown of government revenue streams"
                height={250}
                sectionId="fiscal"
                showLegend={true}
                showLabels={true}
                showPercentage={true}
                formatValue={(value) => sectionUtils.formatCurrency(value, "$", 1)}
                minSlicePercentage={3}
                loading={false}
                error={undefined}
              />
            ) : (
              <div className="border-border bg-card flex h-[250px] items-center justify-center rounded-lg border">
                <div className="text-muted-foreground text-center">
                  <PieChart className="mx-auto mb-2 h-8 w-8" />
                  <p>No tax revenue data available</p>
                  <p className="text-xs">Configure tax rates to see breakdown</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Tax Revenue System */}
      {selectedView === "revenue" && (
        <>
          <div className="md:col-span-2">
            <EnhancedBarChart
              data={taxData}
              xKey="name"
              yKey="rate"
              title="Tax Rates vs Revenue Generation"
              description="Tax policy effectiveness"
              height={300}
              sectionId="fiscal"
              showValues={true}
              formatValue={(value) => `${value.toFixed(1)}%`}
              loading={false}
              error={undefined}
            />
          </div>

          {/* Tax Rate Controls */}
          {Object.entries(fiscalSystem.taxRates || {}).map(([key, value]) => (
            <SliderWithDirectInput
              key={key}
              label={key
                .replace(/([A-Z])/g, " $1")
                .replace(/^./, (str) => str.toUpperCase())
                .replace(/Tax Rate$/, " Tax Rate")}
              value={value}
              onChange={(newValue) => handleFiscalChange(`taxRates.${key}`, newValue)}
              min={0}
              max={key === "vatRate" ? 25 : 50}
              step={0.5}
              precision={1}
              unit="%"
              sectionId="fiscal"
              icon={Building}
              showTicks={true}
              tickCount={5}
              defaultMode="input"
              allowModeToggle={true}
            />
          ))}
        </>
      )}

      {/* Government Spending */}
      {selectedView === "spending" && (
        <>
          {spendingCategories.map((category, index) => (
            <SliderWithDirectInput
              key={category.name}
              label={category.name}
              value={category.value}
              onChange={(value) => {
                // This would update spending data in inputs.governmentSpending
                const newCategories = [...spendingCategories];
                newCategories[index] = { ...newCategories[index], value };

                const totalSpending = newCategories.reduce((sum, cat) => sum + cat.value, 0);
                const spendingGDPPercent = nominalGDP > 0 ? (totalSpending / nominalGDP) * 100 : 0;

                onInputsChange({
                  ...inputs,
                  governmentSpending: {
                    ...inputs.governmentSpending,
                    totalSpending,
                    spendingGDPPercent,
                    spendingCategories: newCategories.map((cat) => ({
                      category: cat.name,
                      amount: cat.value,
                      percent: totalSpending > 0 ? (cat.value / totalSpending) * 100 : 0,
                    })),
                  },
                });
              }}
              min={0}
              max={nominalGDP * 0.2}
              step={nominalGDP * 0.001}
              precision={0}
              unit="USD"
              sectionId="fiscal"
              icon={category.icon}
              showTicks={true}
              tickCount={5}
              defaultMode="input"
              allowModeToggle={true}
            />
          ))}
        </>
      )}

      {/* Debt Management */}
      {selectedView === "debt" && (
        <>
          <div className="md:col-span-2">
            <EnhancedBarChart
              data={(() => {
                const internalDebt = Math.max(0, Number(fiscalSystem.internalDebtGDPPercent) || 0);
                const externalDebt = Math.max(0, Number(fiscalSystem.externalDebtGDPPercent) || 0);
                return [
                  { name: "Internal Debt", value: internalDebt },
                  { name: "External Debt", value: externalDebt },
                  { name: "Total Debt", value: internalDebt + externalDebt },
                ];
              })()}
              xKey="name"
              yKey="value"
              title="Government Debt Breakdown"
              description="Debt composition as % of GDP"
              height={300}
              sectionId="fiscal"
              showValues={true}
              formatValue={(value) => `${value.toFixed(1)}%`}
              loading={false}
              error={undefined}
            />
          </div>

          <SliderWithDirectInput
            label="Internal Debt (% of GDP)"
            value={Number(fiscalSystem.internalDebtGDPPercent) || 0}
            onChange={(value) => handleFiscalChange("internalDebtGDPPercent", Number(value))}
            min={0}
            max={150}
            step={1}
            unit="%"
            sectionId="fiscal"
            icon={CreditCard}
            showTicks={true}
            tickCount={6}
            defaultMode="input"
            allowModeToggle={true}
          />

          <SliderWithDirectInput
            label="External Debt (% of GDP)"
            value={Number(fiscalSystem.externalDebtGDPPercent) || 0}
            onChange={(value) => handleFiscalChange("externalDebtGDPPercent", Number(value))}
            min={0}
            max={100}
            step={1}
            unit="%"
            sectionId="fiscal"
            icon={TrendingDown}
            showTicks={true}
            tickCount={6}
            defaultMode="input"
            allowModeToggle={true}
          />

          <EnhancedNumberInput
            label="Debt Service Costs"
            value={fiscalSystem.debtServiceCosts}
            onChange={(value) => handleFiscalChange("debtServiceCosts", value)}
            min={0}
            max={nominalGDP * 0.1}
            step={1000}
            precision={0}
            unit="USD"
            description="Annual cost of servicing government debt"
            sectionId="fiscal"
            icon={CreditCard}
          />
        </>
      )}

      {/* Atomic Integration */}
      {selectedView === "atomic" && showAtomicIntegration && (
        <div className="md:col-span-2">
          <AtomicEconomicEffectivenessPanel
            components={activeComponents}
            baseEconomicData={{
              gdpGrowthRate: inputs.coreIndicators.realGDPGrowthRate || 2.5,
              inflationRate: inputs.coreIndicators.inflationRate || 2.0,
              gdpPerCapita: inputs.coreIndicators.gdpPerCapita || 50000,
              economicStability: 70,
              policyEffectiveness: 60,
            }}
            showDetailedBreakdown={true}
          />

          {activeComponents.length === 0 && countryId && (
            <div className="mt-6 rounded-lg border border-yellow-200/50 bg-gradient-to-br from-yellow-50/50 to-amber-50/50 p-6 dark:border-yellow-700/50 dark:from-yellow-950/20 dark:to-amber-950/20">
              <div className="space-y-4 text-center">
                <Zap className="mx-auto h-12 w-12 text-yellow-500 dark:text-yellow-400" />
                <h4 className="text-foreground text-lg font-bold">No Government Components</h4>
                <p className="text-muted-foreground mx-auto max-w-md text-sm">
                  Add atomic government components to see their impact on economic effectiveness and
                  policy implementation.
                </p>
                <button
                  onClick={() => window.open("/mycountry/editor#government", "_blank")}
                  className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700"
                >
                  Configure Government Components
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tax Builder */}
      {selectedView === "builder" && (
        <div className="md:col-span-2">
          <TaxBuilder
            countryId={countryId || ""}
            initialData={taxBuilderState}
            onChange={setTaxBuilderState}
            economicData={{
              gdp: nominalGDP || 0,
              sectors: [],
              population: totalPopulation || 1000000,
            }}
            enableAutoSync={!!countryId}
            hideSaveButton={true}
          />
        </div>
      )}
    </>
  );

  // Advanced view content - simplified
  const advancedContent = (
    <>
      <div className="md:col-span-2">
        <div className="bg-muted/50 rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">
            Advanced fiscal analytics and detailed reporting features will be available here.
          </p>
        </div>
      </div>
    </>
  );

  // Generate fiscal insights
  const generateInsights = () => {
    const insights: string[] = [];
    const safeTaxRev = Number(fiscalSystem.taxRevenueGDPPercent);
    const safeDebtRatio = Number(fiscalSystem.totalDebtGDPRatio);
    const safeBudgetBalance = Number(fiscalSystem.budgetDeficitSurplus || 0);
    if (isNaN(safeTaxRev) || isNaN(safeDebtRatio)) return insights;

    const deficitPercent = Math.abs(safeBudgetBalance / (nominalGDP || 1)) * 100;

    if (deficitPercent > 5) {
      insights.push("High budget deficit may require fiscal consolidation measures");
    }

    if (safeDebtRatio > 90) {
      insights.push("Public debt exceeds 90% of GDP - consider debt reduction strategies");
    } else if (safeDebtRatio > 60) {
      insights.push("Public debt approaching concerning levels - monitor carefully");
    }

    if (safeTaxRev < 15) {
      insights.push("Low tax revenue may limit government's ability to provide public services");
    } else if (safeTaxRev > 40) {
      insights.push("High tax burden may impact economic competitiveness");
    }

    return insights;
  };

  const insights = generateInsights();

  return (
    <SectionBase
      config={
        sectionConfigs.fiscal || {
          id: "fiscal",
          title: "Fiscal System",
          icon: Building2,
          theme: "blue" as const,
        }
      }
      inputs={inputs}
      onInputsChange={onInputsChange}
      isReadOnly={false}
      showComparison={true}
      showAdvanced={showAdvanced}
      onToggleAdvanced={onToggleAdvanced}
      referenceCountry={referenceCountry}
      metrics={metrics}
      validation={{
        errors: [],
        warnings: insights,
        info: [
          `Fiscal Health Score: ${fiscalHealthScore.toFixed(0)}/100`,
          `Debt Service Cost: ${sectionUtils.formatCurrency(fiscalSystem.debtServiceCosts)}/year`,
        ],
      }}
      className={className}
      helpContent={<EconomicsHelpSystem />}
    >
      <SectionLayout
        basicContent={basicContent}
        advancedContent={advancedContent}
        showAdvanced={showAdvanced}
        basicColumns={2}
        advancedColumns={2}
      />
    </SectionBase>
  );
});

// Display name for debugging
FiscalSystemSection.displayName = "FiscalSystemSection";
