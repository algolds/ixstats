// Government Step - Atomic components and structure for Atomic Builder
// Refactored to align with macOS/iOS design language and contextual Atomic Components

"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";

import {
  // eslint-disable-next-line unused-imports/no-unused-imports
  Shield,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Info,
  HelpCircle,
  Settings,
  Crown,
  Coins,
  Eye,
  AlertTriangle,
  // eslint-disable-next-line unused-imports/no-unused-imports
  CheckCircle,
  Users,
  DollarSign,
} from "lucide-react";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Button } from "~/components/ui/button";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Checkbox } from "~/components/ui/checkbox";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Label } from "~/components/ui/label";
import { GovernmentStructureForm } from "~/components/government/atoms/GovernmentStructureForm";
import { RevenueSourceForm } from "~/components/government/atoms/RevenueSourceForm";
import { DepartmentList } from "~/components/builder/government/DepartmentList";
import { BudgetAllocationList } from "~/components/builder/government/BudgetAllocationList";
import { GovernmentSpendingSection } from "~/app/builder/sections/GovernmentSpendingSection";
import type { EconomicInputs, RealCountryData } from "~/app/builder/lib/economy-data-service";
import { ComponentType } from "@prisma/client";
import { GlassCard, GlassCardContent } from "../../glass/GlassCard";
import { BuilderTabCard, type TabDefinition } from "../../../primitives/BuilderTabCard";
import { AtomicGovernmentComponents } from "~/components/government/atoms/AtomicGovernmentComponents";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";
import { AtomicWelcomeModal } from "~/components/government/atomic";
import { computeGovernmentWarnings } from "../government-preview/governmentWarnings";
import { useBuilderFilter } from "~/app/builder/components/builder-filter-context";

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

  const [welcomeOpen, setWelcomeOpen] = useState(false);

  // Budget allocations collapsed state
  const [budgetAllocationsCollapsed, setBudgetAllocationsCollapsed] = useState<
    Record<number, boolean>
  >({});

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

  // Compute warnings using the shared helper
  const warnings = useMemo(() => {
    return computeGovernmentWarnings(
      governmentStructure,
      economicInputs?.coreIndicators?.nominalGDP || 0,
      initialBudget.current,
      initialCurrency.current
    );
  }, [governmentStructure, economicInputs]);

  const gdpCapWarning = warnings.gdpCapWarning;
  const { viewMode } = useBuilderFilter();

  // Auto-allocate standard departments if empty in standard mode
  useEffect(() => {
    if (
      viewMode === "standard" &&
      (!governmentStructure.departments || governmentStructure.departments.length === 0)
    ) {
      const totalBudget =
        governmentStructure.structure?.totalBudget ||
        (economicInputs?.coreIndicators?.nominalGDP || 1000000000) * 0.35;
      const defaultDepts = [
        {
          name: "Department of Finance",
          shortName: "Finance",
          category: "administrative",
          description: "Manages state treasury, revenue collection, and economic planning.",
          minister: "Finance Minister",
          ministerTitle: "Minister",
          headquarters: "Capital City",
          established: "2026",
          employeeCount: 1500,
          icon: "Coins",
          color: "#eab308",
          priority: 80,
          isActive: true,
          functions: ["Treasury", "Taxation", "Economic Planning"],
        },
        {
          name: "Department of Social Services",
          shortName: "Social Services",
          category: "social",
          description: "Administers social welfare, public pensions, and community support.",
          minister: "Minister of Social Services",
          ministerTitle: "Minister",
          headquarters: "Capital City",
          established: "2026",
          employeeCount: 3000,
          icon: "Users",
          color: "#3b82f6",
          priority: 70,
          isActive: true,
          functions: ["Social Security", "Pensions", "Welfare"],
        },
        {
          name: "Department of Health",
          shortName: "Health",
          category: "social",
          description: "Oversees public health, medical facilities, and sanitation.",
          minister: "Health Minister",
          ministerTitle: "Minister",
          headquarters: "Capital City",
          established: "2026",
          employeeCount: 5000,
          icon: "Activity",
          color: "#10b981",
          priority: 90,
          isActive: true,
          functions: ["Public Health", "Medical Care"],
        },
        {
          name: "Department of Education",
          shortName: "Education",
          category: "social",
          description: "Directs national education curriculum, schools, and research funding.",
          minister: "Education Minister",
          ministerTitle: "Minister",
          headquarters: "Capital City",
          established: "2026",
          employeeCount: 4500,
          icon: "BookOpen",
          color: "#a855f7",
          priority: 85,
          isActive: true,
          functions: ["Schools", "Curriculum", "Universities"],
        },
        {
          name: "Department of Infrastructure",
          shortName: "Infrastructure",
          category: "administrative",
          description: "Maintains national transit networks, utilities, and public works.",
          minister: "Infrastructure Minister",
          ministerTitle: "Minister",
          headquarters: "Capital City",
          established: "2026",
          employeeCount: 2500,
          icon: "Building2",
          color: "#f97316",
          priority: 60,
          isActive: true,
          functions: ["Transport", "Utilities", "Public Works"],
        },
      ];

      const defaultAllocations = [
        { departmentId: "0", allocatedPercent: 15, allocatedAmount: totalBudget * 0.15 },
        { departmentId: "1", allocatedPercent: 25, allocatedAmount: totalBudget * 0.25 },
        { departmentId: "2", allocatedPercent: 20, allocatedAmount: totalBudget * 0.2 },
        { departmentId: "3", allocatedPercent: 20, allocatedAmount: totalBudget * 0.2 },
        { departmentId: "4", allocatedPercent: 20, allocatedAmount: totalBudget * 0.2 },
      ];

      onGovernmentStructureChange({
        ...governmentStructure,
        departments: defaultDepts,
        budgetAllocations: defaultAllocations,
      });
    }
  }, [viewMode, governmentStructure, economicInputs, onGovernmentStructureChange]);

  // Selected component objects for the selected list sidebar
  const _selectedComponentObjects = useMemo(() => {
    return governmentComponents
      .map((type) => ATOMIC_COMPONENTS[type])
      .filter((comp) => comp !== undefined);
  }, [governmentComponents]);

  const tabs = useMemo<TabDefinition[]>(() => {
    const list = [{ id: "components", label: "Components", icon: Crown }];
    if (viewMode === "expert") {
      list.push(
        { id: "structure", label: "Departments", icon: Users },
        { id: "spending", label: "Budget", icon: Coins }
      );
    }
    list.push({ id: "preview", label: "Policies", icon: Eye });
    return list;
  }, [viewMode]);

  const activeTab = useMemo(() => {
    const rawTab = activeGovernmentTab || "components";
    if (viewMode === "standard" && (rawTab === "structure" || rawTab === "spending")) {
      return "components";
    }
    return rawTab;
  }, [activeGovernmentTab, viewMode]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <AtomicWelcomeModal open={welcomeOpen} onOpenChange={setWelcomeOpen} />
      <BuilderTabCard
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        sectionTheme="government"
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
                  Government Components
                  <button
                    onClick={() => setWelcomeOpen(true)}
                    className="cursor-pointer rounded-full p-0.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-cyan-400"
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
            {/* Departments list */}
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
                  Government Departments
                </h3>
              </div>
              <GlassCardContent className="p-6">
                <DepartmentList
                  departments={governmentStructure.departments}
                  onAddDepartment={() => {
                    const newDept = {
                      name: `Department ${((governmentStructure.departments || []).length || 0) + 1}`,
                      shortName: "",
                      category: "executive",
                      description: "",
                      minister: "",
                      ministerTitle: "",
                      headquarters: "",
                      established: "",
                      employeeCount: 0,
                      icon: "",
                      color: "#06b6d4",
                      priority: 50,
                      isActive: true,
                      parentDepartmentId: undefined,
                      organizationalLevel: "",
                      functions: [],
                      kpis: [],
                    };
                    onGovernmentStructureChange({
                      ...governmentStructure,
                      departments: [...(governmentStructure.departments || []), newDept],
                    });
                  }}
                  onUpdateDepartment={(idx, updated) => {
                    const newDepts = [...(governmentStructure.departments || [])];
                    newDepts[idx] = updated;
                    onGovernmentStructureChange({
                      ...governmentStructure,
                      departments: newDepts,
                    });
                  }}
                  onRemoveDepartment={(idx) => {
                    onGovernmentStructureChange({
                      ...governmentStructure,
                      departments: (governmentStructure.departments || []).filter(
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
          <div className="space-y-6">
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
        )}
      </BuilderTabCard>
    </div>
  );
}
