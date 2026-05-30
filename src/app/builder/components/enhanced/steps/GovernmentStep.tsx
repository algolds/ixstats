// Government Step - Atomic components and structure for Atomic Builder
// Refactored to align with macOS/iOS design language and contextual Atomic Components

"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield,
  Info,
  HelpCircle,
  Settings,
  Crown,
  Coins,
  Eye,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle,
  Users,
  DollarSign,
  Package,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Checkbox } from "~/components/ui/checkbox";
import { cn } from "~/lib/utils";
import { Label } from "~/components/ui/label";
import { GovernmentStructureForm } from "~/components/government/atoms/GovernmentStructureForm";
import { RevenueSourceForm } from "~/components/government/atoms/RevenueSourceForm";
import { DepartmentList } from "~/components/builder/government/DepartmentList";
import { BudgetAllocationList } from "~/components/builder/government/BudgetAllocationList";
import { GovernmentSpendingSection } from "~/app/builder/sections/GovernmentSpendingSection";
import { GovernmentStructurePreview } from "../GovernmentStructurePreview";
import type { EconomicInputs, RealCountryData } from "~/app/builder/lib/economy-data-service";
import { ComponentType } from "@prisma/client";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { GlassCard, GlassCardContent } from "../../glass/GlassCard";
import { BuilderTabCard, type TabDefinition } from "../../../primitives/BuilderTabCard";
import { AtomicGovernmentComponents } from "~/components/government/atoms/AtomicGovernmentComponents";
import { ATOMIC_COMPONENTS } from "~/lib/atomic-government-data";
import { SelectedComponentsList, AtomicWelcomeModal } from "~/components/government/atomic";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface GovernmentStepProps {
  economicInputs: EconomicInputs;
  selectedCountry: RealCountryData | null;
  governmentComponents: ComponentType[];
  governmentStructure: any;
  activeGovernmentTab: string;
  onGovernmentComponentsChange: (components: ComponentType[]) => void;
  onGovernmentStructureChange: (structure: any) => void;
  onGovernmentStructureSave: (structure: any) => Promise<void>;
  onEconomicInputsChange: (inputs: EconomicInputs) => void;
  onTabChange: (tab: string) => void;
}

export function GovernmentStep({
  economicInputs,
  selectedCountry,
  governmentComponents,
  governmentStructure: propGovernmentStructure,
  activeGovernmentTab,
  onGovernmentComponentsChange,
  onGovernmentStructureChange,
  onGovernmentStructureSave,
  onEconomicInputsChange,
  onTabChange,
}: GovernmentStepProps) {
  // Local fallback to prevent null pointer exceptions
  const governmentStructure = useMemo(() => {
    if (propGovernmentStructure) return propGovernmentStructure;
    return {
      structure: {
        governmentName: `Government of ${selectedCountry?.name || "the Nation"}`,
        governmentType: (economicInputs?.nationalIdentity?.governmentType || "Other") as any,
        headOfState: "",
        headOfGovernment: "",
        legislatureName: "",
        executiveName: "",
        judicialName: "",
        totalBudget: (economicInputs?.coreIndicators?.nominalGDP || 1000000000) * 0.35,
        fiscalYear: "Calendar Year",
        budgetCurrency: economicInputs?.nationalIdentity?.currency || "USD",
      },
      departments: [],
      budgetAllocations: [],
      revenueSources: [],
      isValid: true,
      errors: { structure: [], departments: {}, budget: [], revenue: [] },
    };
  }, [propGovernmentStructure, selectedCountry, economicInputs]);

  // Verification checkpoint state
  const [isVerified, setIsVerified] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  // Budget allocations collapsed state
  const [budgetAllocationsCollapsed, setBudgetAllocationsCollapsed] = useState<Record<number, boolean>>({});

  const handleToggleCollapse = useCallback((idx: number) => {
    setBudgetAllocationsCollapsed((prev) => ({
      ...prev,
      [idx]: prev[idx] === false ? true : false,
    }));
  }, []);

  const handleExpandAll = useCallback(() => {
    const newState: Record<number, boolean> = {};
    governmentStructure.departments.forEach((_: any, idx: number) => {
      newState[idx] = false;
    });
    setBudgetAllocationsCollapsed(newState);
  }, [governmentStructure.departments]);

  const handleCollapseAll = useCallback(() => {
    const newState: Record<number, boolean> = {};
    governmentStructure.departments.forEach((_: any, idx: number) => {
      newState[idx] = true;
    });
    setBudgetAllocationsCollapsed(newState);
  }, [governmentStructure.departments]);

  // Capture initial budget values on mount to detect changes
  const initialBudget = useRef<number | null>(null);
  const initialCurrency = useRef<string | null>(null);

  useEffect(() => {
    if (governmentStructure?.structure?.totalBudget && initialBudget.current === null) {
      initialBudget.current = governmentStructure.structure.totalBudget;
    }
    if (governmentStructure?.structure?.budgetCurrency && initialCurrency.current === null) {
      initialCurrency.current = governmentStructure.structure.budgetCurrency;
    }
  }, [governmentStructure]);

  // Warnings / Critical Changes Check
  const deltaWarning = useMemo(() => {
    if (!governmentStructure?.structure?.totalBudget || !initialBudget.current) return null;
    const current = governmentStructure.structure.totalBudget;
    const deltaPct = Math.abs((current - initialBudget.current) / initialBudget.current) * 100;
    if (deltaPct > 25) {
      return `Budget Delta Alert: The proposed budget of ${current.toLocaleString()} has changed by ${deltaPct.toFixed(1)}% compared to the country's baseline. Ensure revenue channels are sufficient to avoid instability.`;
    }
    return null;
  }, [governmentStructure]);

  const currencyChangeWarning = useMemo(() => {
    if (!governmentStructure?.structure?.budgetCurrency || !initialCurrency.current) return null;
    if (governmentStructure.structure.budgetCurrency !== initialCurrency.current) {
      return `Currency Conversion: Budget currency has changed from "${initialCurrency.current}" to "${governmentStructure.structure.budgetCurrency}". Ensure this aligns with trade partners.`;
    }
    return null;
  }, [governmentStructure]);

  // Selected component objects for the selected list sidebar
  const selectedComponentObjects = useMemo(() => {
    return governmentComponents
      .map((type) => ATOMIC_COMPONENTS[type])
      .filter((comp) => comp !== undefined);
  }, [governmentComponents]);

  // GDP cap warning
  const gdpCapWarning = useMemo(() => {
    const budget = governmentStructure?.structure?.totalBudget || 0;
    const gdp = economicInputs?.coreIndicators?.nominalGDP || 0;
    if (budget > gdp && gdp > 0) {
      return `GDP Threshold Violated: Total budget cannot exceed your country's nominal GDP (${gdp.toLocaleString()}). Please adjust the budget allocation or structure.`;
    }
    return null;
  }, [governmentStructure, economicInputs]);

  const tabs: TabDefinition[] = [
    { id: "components", label: "Components", icon: Crown },
    { id: "structure", label: "Departments", icon: Users },
    { id: "spending", label: "Budget", icon: Coins },
    { id: "preview", label: "Policies", icon: Eye },
  ];

  const activeTab = activeGovernmentTab || "components";

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <AtomicWelcomeModal open={welcomeOpen} onOpenChange={setWelcomeOpen} />
      <BuilderTabCard
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        sectionTheme="government"
        hideTabList
      >
        {activeTab === "components" && (
          <div className="space-y-6">
            <GlassCard
              depth="base"
              theme="teal"
              className="border-cyan-500/20"
              texture="chevron"
              textureOpacity={0.04}
            >
              <div className="border-border/40 flex items-center justify-between border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                  <Settings className="h-5 w-5 text-cyan-400" />
                  MyGovernment Components Builder
                  <button
                    onClick={() => setWelcomeOpen(true)}
                    className="text-zinc-400 hover:text-cyan-400 cursor-pointer transition-colors p-0.5 rounded-full hover:bg-white/5"
                    title="Open Help Guide"
                    type="button"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </h3>
              </div>
              <GlassCardContent className="p-6">
                <AtomicGovernmentComponents
                  initialComponents={governmentComponents}
                  onChange={onGovernmentComponentsChange}
                  isReadOnly={false}
                  maxComponents={15}
                  standalone={true}
                  defaultCategoryFilter="governance"
                  hideSelectedList={true}
                />
              </GlassCardContent>
            </GlassCard>
          </div>
        )}

        {activeTab === "structure" && (
          <div className="space-y-6">
            <GlassCard
              depth="base"
              theme="teal"
              className="border-cyan-500/20"
              texture="chevron"
              textureOpacity={0.04}
            >
              <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                  <Users className="h-5 w-5 text-cyan-400" />
                  Departments & Ministries
                </h3>
              </div>
              <GlassCardContent className="p-6">
                <DepartmentList
                  departments={governmentStructure.departments}
                  onAddDepartment={() => {
                    const newDept = {
                      name: "",
                      category: "Other" as const,
                      description: "",
                      ministerTitle: "Minister",
                      organizationalLevel: "Ministry" as const,
                      color: "#06b6d4",
                      priority: 50,
                      functions: [],
                    };
                    onGovernmentStructureChange({
                      ...governmentStructure,
                      departments: [...governmentStructure.departments, newDept],
                    });
                  }}
                  onUpdateDepartment={(idx, updated) => {
                    const newDepts = [...governmentStructure.departments];
                    newDepts[idx] = updated;
                    onGovernmentStructureChange({
                      ...governmentStructure,
                      departments: newDepts,
                    });
                  }}
                  onRemoveDepartment={(idx) => {
                    onGovernmentStructureChange({
                      ...governmentStructure,
                      departments: governmentStructure.departments.filter(
                        (_: any, i: number) => i !== idx
                      ),
                    });
                  }}
                  isReadOnly={false}
                  governmentComponents={governmentComponents}
                  onGovernmentComponentsChange={onGovernmentComponentsChange}
                />
              </GlassCardContent>
            </GlassCard>

            {/* Budget Allocations list */}
            <GlassCard
              depth="base"
              theme="teal"
              className="border-cyan-500/20"
              texture="chevron"
              textureOpacity={0.04}
            >
              <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                  <DollarSign className="h-5 w-5 text-cyan-400" />
                  Budget Allocations
                </h3>
              </div>
              <GlassCardContent className="p-6">
                <BudgetAllocationList
                  departments={governmentStructure.departments}
                  budgetAllocations={governmentStructure.budgetAllocations}
                  budgetSummary={{
                    totalAllocated:
                      governmentStructure.budgetAllocations?.reduce(
                        (sum: number, a: any) => sum + (a.allocatedAmount || 0),
                        0
                      ) || 0,
                    totalAllocatedPercent: governmentStructure.budgetAllocations
                      ? governmentStructure.budgetAllocations.reduce(
                          (sum: number, a: any) => sum + (a.allocatedPercent || 0),
                          0
                        )
                      : 0,
                    remaining:
                      (governmentStructure.structure?.totalBudget || 0) -
                      (governmentStructure.budgetAllocations?.reduce(
                        (sum: number, a: any) => sum + (a.allocatedAmount || 0),
                        0
                      ) || 0),
                    remainingPercent:
                      100 -
                      (governmentStructure.budgetAllocations
                        ? governmentStructure.budgetAllocations.reduce(
                            (sum: number, a: any) => sum + (a.allocatedPercent || 0),
                            0
                          )
                        : 0),
                    isOverBudget:
                      (governmentStructure.budgetAllocations
                        ? governmentStructure.budgetAllocations.reduce(
                            (sum: number, a: any) => sum + (a.allocatedPercent || 0),
                            0
                          )
                        : 0) > 100,
                    isUnderBudget:
                      (governmentStructure.budgetAllocations
                        ? governmentStructure.budgetAllocations.reduce(
                            (sum: number, a: any) => sum + (a.allocatedPercent || 0),
                            0
                          )
                        : 0) < 100,
                  }}
                  totalBudget={governmentStructure.structure.totalBudget}
                  currency={governmentStructure.structure.budgetCurrency || "USD"}
                  onUpdateAllocation={(idx, updated) => {
                    const newAllocations = [...(governmentStructure.budgetAllocations || [])];
                    const existingIndex = newAllocations.findIndex(
                      (a) => a.departmentId === idx.toString()
                    );
                    if (existingIndex >= 0) {
                      newAllocations[existingIndex] = updated;
                    } else {
                      newAllocations.push(updated);
                    }
                    onGovernmentStructureChange({
                      ...governmentStructure,
                      budgetAllocations: newAllocations,
                    });
                  }}
                  onFixAllocations={() => {
                    // Auto distribute allocations evenly
                    const totalBudgetVal = governmentStructure.structure.totalBudget;
                    const numDepts = governmentStructure.departments.length;
                    if (numDepts === 0) return;
                    const evenPercent = 100 / numDepts;
                    const fixedAllocations = governmentStructure.departments.map(
                      (_: any, idx: number) => ({
                        departmentId: idx.toString(),
                        budgetYear: new Date().getFullYear(),
                        allocatedPercent: evenPercent,
                        allocatedAmount: Math.round((totalBudgetVal * evenPercent) / 100),
                        notes: "Even redistribution",
                      })
                    );
                    onGovernmentStructureChange({
                      ...governmentStructure,
                      budgetAllocations: fixedAllocations,
                    });
                  }}
                  isReadOnly={false}
                  budgetAllocationsCollapsed={budgetAllocationsCollapsed}
                  onToggleCollapse={handleToggleCollapse}
                  onExpandAll={handleExpandAll}
                  onCollapseAll={handleCollapseAll}
                />
              </GlassCardContent>
            </GlassCard>

          </div>
        )}

        {activeTab === "spending" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-1">
            <div className="space-y-6">
              {/* GDP Cap Alert Banner */}
              {gdpCapWarning && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-500/25 bg-red-500/5 p-3.5 text-xs text-red-200">
                  <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-red-400" />
                  <div className="leading-relaxed">{gdpCapWarning}</div>
                </div>
              )}

              {/* Budget Configuration */}
              <GovernmentStructureForm
                data={governmentStructure.structure}
                onChange={(structure) => {
                  onGovernmentStructureChange({
                    ...governmentStructure,
                    structure,
                  });
                }}
                isReadOnly={false}
                gdpData={{
                  nominalGDP: economicInputs?.coreIndicators?.nominalGDP || 0,
                  countryName: selectedCountry?.name,
                  taxRevenue: economicInputs?.fiscalSystem?.governmentRevenueTotal || 0,
                  taxRevenuePercent: economicInputs?.fiscalSystem?.taxRevenueGDPPercent || 0,
                }}
                showOnlyBudgetConfig={true}
              />



              {/* Revenue Sources form */}
              <RevenueSourceForm
                data={governmentStructure.revenueSources}
                onChange={(revenueSources) => {
                  onGovernmentStructureChange({
                    ...governmentStructure,
                    revenueSources,
                  });
                }}
                totalRevenue={governmentStructure.structure.totalBudget}
                currency={governmentStructure.structure.budgetCurrency || "USD"}
                isReadOnly={false}
                availableDepartments={governmentStructure.departments.map(
                  (d: any, idx: number) => ({
                    id: idx.toString(),
                    name: d.name,
                  })
                )}
              />

            </div>
          </div>
        )}

        {activeTab === "preview" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              {/* Policies spending section */}
              <GlassCard
                depth="base"
                theme="teal"
                className="border-cyan-500/20"
                texture="chevron"
                textureOpacity={0.04}
              >
                <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                  <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                    <Settings className="h-5 w-5 text-cyan-400" />
                    Governance Spending Policies
                  </h3>
                </div>
                <GlassCardContent className="p-6">
                  <GovernmentSpendingSection
                    inputs={economicInputs}
                    onInputsChange={onEconomicInputsChange}
                    selectedAtomicComponents={governmentComponents}
                    governmentBuilderData={governmentStructure}
                    countryId={selectedCountry?.countryCode || undefined}
                  />
                </GlassCardContent>
              </GlassCard>

            </div>

            <div className="space-y-6 lg:col-span-5">
              {/* Safety Rails Checkpoint and Verification Box */}
              <GlassCard
                depth="base"
                theme="teal"
                className="border-cyan-500/20 shadow-xl"
                texture="chevron"
                textureOpacity={0.04}
              >
                <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                  <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                    <Shield className="h-5 w-5 text-cyan-400" />
                    Verification Checkpoint
                  </h3>
                </div>
                <GlassCardContent className="space-y-4 p-6">
                  <p className="text-[11px] text-zinc-400">
                    Review critical adjustments compared to initial setup before authorization
                  </p>

                  <div className="space-y-2.5">
                    {deltaWarning && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-200">
                        <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-400" />
                        <span>{deltaWarning}</span>
                      </div>
                    )}

                    {currencyChangeWarning && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-200">
                        <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-400" />
                        <span>{currencyChangeWarning}</span>
                      </div>
                    )}

                    {!deltaWarning && !currencyChangeWarning && (
                      <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] text-emerald-200">
                        <CheckCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-400" />
                        <span>
                          No high-risk adjustments detected. Structural variables are within safe
                          boundaries.
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-start gap-2.5 pt-2 select-none">
                    <Checkbox
                      id="verify-checkbox"
                      checked={isVerified}
                      onCheckedChange={(checked) => setIsVerified(checked === true)}
                      className="mt-0.5 border-zinc-700 data-[state=checked]:border-cyan-500 data-[state=checked]:bg-cyan-500"
                    />
                    <Label
                      htmlFor="verify-checkbox"
                      className="cursor-pointer text-xs leading-normal text-zinc-400"
                    >
                      I verify these governance adjustments are intentional and authorization should
                      be finalized.
                    </Label>
                  </div>

                  <div className="pt-2">
                    <Button
                      onClick={async () => {
                        if (!isVerified || gdpCapWarning) return;
                        await onGovernmentStructureSave(governmentStructure);
                      }}
                      disabled={!isVerified || !!gdpCapWarning}
                      className="h-9 w-full rounded-lg bg-cyan-500 text-xs font-semibold text-black hover:bg-cyan-600 disabled:bg-zinc-800 disabled:text-zinc-500"
                    >
                      Save & Finalize Governance
                    </Button>
                  </div>
                </GlassCardContent>
              </GlassCard>

              {/* Government Structure Preview */}
              <GlassCard
                depth="base"
                theme="teal"
                className="border-cyan-500/20"
                texture="chevron"
                textureOpacity={0.04}
              >
                <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                  <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                    <Eye className="h-5 w-5 text-cyan-400" />
                    Government Visual Tree
                  </h3>
                </div>
                <GlassCardContent className="p-6">
                  <GovernmentStructurePreview
                    governmentStructure={governmentStructure}
                    governmentComponents={governmentComponents}
                  />
                </GlassCardContent>
              </GlassCard>
            </div>
          </div>
        )}
      </BuilderTabCard>
    </div>
  );
}
