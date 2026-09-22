"use client";
// Government Step - Atomic components and structure for Atomic Builder
// Refactored to align with macOS/iOS design language and contextual Atomic Components

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";

// oxlint-disable-next-line eslint/no-unused-vars
import {
  InfoCircle as Info,
  Crown,
  Coins,
  WarningTriangle as AlertTriangle,
  Group as Users,
  Dollar as DollarSign,
} from "iconoir-react";
// oxlint-disable-next-line eslint/no-unused-vars
import { Checkbox } from "~/components/ui/checkbox";
import { GovernmentStructureForm } from "~/components/mycountry/domains/government/atoms/GovernmentStructureForm";
import { RevenueSourceForm } from "~/components/mycountry/domains/government/atoms/RevenueSourceForm";
import { DepartmentList } from "~/components/mycountry/domains/government/builder/DepartmentList";
import { BudgetAllocationList } from "~/components/mycountry/domains/government/builder/BudgetAllocationList";
import type { EconomicInputs, RealCountryData } from "~/app/builder/lib/economy-data-service";
import { ComponentType } from "@prisma/client";
import { FacetCard, FacetCardContent } from "~/components/ui/facet-container";
import { BuilderTabCard, type TabDefinition } from "../../../primitives/BuilderTabCard";
import { AtomicGovernmentComponents } from "~/components/mycountry/domains/government/atoms/AtomicGovernmentComponents";
import { ATOMIC_COMPONENTS } from "~/lib/government/atomic-data";
import { useBuilderGuide } from "../../builder-guide-context";
import { computeGovernmentWarnings } from "../government-preview/governmentWarnings";
import { useBuilderFilter } from "~/app/builder/components/builder-filter-context";
import { useBuilderContextOptional } from "../context/BuilderStateContext";
import type { GovernmentBuilderState, GovernmentType } from "~/types/government";

interface GovernmentStepProps {
  economicInputs: EconomicInputs;
  selectedCountry: RealCountryData | null;
  governmentComponents: ComponentType[];
  governmentStructure: GovernmentBuilderState | null;
  activeGovernmentTab: string;
  onGovernmentComponentsChange: (components: ComponentType[]) => void;
  onGovernmentStructureChange: (structure: GovernmentBuilderState) => void;
  onGovernmentStructureSave: (structure: GovernmentBuilderState) => Promise<void>;
  onEconomicInputsChange: (inputs: EconomicInputs) => void;
  onTabChange: (tab: string) => void;
  mode?: "create" | "edit";
}

export function GovernmentStep({
  economicInputs,
  selectedCountry,
  governmentComponents,
  governmentStructure: propGovernmentStructure,
  activeGovernmentTab,
  onGovernmentComponentsChange,
  onGovernmentStructureChange,
  // oxlint-disable-next-line eslint/no-unused-vars
  onGovernmentStructureSave,
  onEconomicInputsChange,
  onTabChange,
  mode: propMode,
}: GovernmentStepProps) {
  const builderCtx = useBuilderContextOptional();
  const effectiveMode = propMode ?? builderCtx?.mode ?? "create";
  // Local fallback to prevent null pointer exceptions
  const governmentStructure = useMemo((): GovernmentBuilderState => {
    if (propGovernmentStructure) return propGovernmentStructure;
    return {
      structure: {
        governmentName: `Government of ${selectedCountry?.name || "the Nation"}`,
        governmentType: (economicInputs?.nationalIdentity?.governmentType || "Other") as GovernmentType,
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

  const { openGuide, isSectionSeen } = useBuilderGuide();

  // Auto-slide open the Companion Sheet on first visit in create mode only
  useEffect(() => {
    if (effectiveMode === "create" && !isSectionSeen("government")) {
      openGuide({ tab: "rules", section: "government" });
    }
  }, [effectiveMode, isSectionSeen, openGuide]);

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
    governmentStructure.departments.forEach((_, idx) => {
      newState[idx] = false;
    });
    setBudgetAllocationsCollapsed(newState);
  }, [governmentStructure.departments]);

  const handleCollapseAll = useCallback(() => {
    const newState: Record<number, boolean> = {};
    governmentStructure.departments.forEach((_, idx) => {
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
  const isExpertOrEdit = effectiveMode === "edit" || viewMode === "expert";

  // Auto-allocate standard departments if empty in standard mode (create mode only)
  useEffect(() => {
    if (
      effectiveMode !== "edit" &&
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
          category: "Finance" as const,
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
          organizationalLevel: "Ministry" as const,
          functions: ["Treasury", "Taxation", "Economic Planning"],
        },
        {
          name: "Department of Social Services",
          shortName: "Social Services",
          category: "Social Services" as const,
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
          organizationalLevel: "Ministry" as const,
          functions: ["Social Security", "Pensions", "Welfare"],
        },
        {
          name: "Department of Health",
          shortName: "Health",
          category: "Health" as const,
          description: "Oversees public health, medical facilities, and sanitation.",
          minister: "Health Minister",
          ministerTitle: "Minister",
          headquarters: "Capital City",
          established: "2026",
          employeeCount: 2000,
          icon: "Activity",
          color: "#10b981",
          priority: 90,
          isActive: true,
          organizationalLevel: "Ministry" as const,
          functions: ["Public Health", "Medical Care"],
        },
        {
          name: "Department of Education",
          shortName: "Education",
          category: "Education" as const,
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
          organizationalLevel: "Ministry" as const,
          functions: ["Schools", "Curriculum", "Universities"],
        },
        {
          name: "Department of Infrastructure",
          shortName: "Infrastructure",
          category: "Transportation" as const,
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
          organizationalLevel: "Ministry" as const,
          functions: ["Transport", "Utilities", "Public Works"],
        },
      ];

      const defaultAllocations = [
        { departmentId: "0", budgetYear: 2026, allocatedPercent: 15, allocatedAmount: totalBudget * 0.15 },
        { departmentId: "1", budgetYear: 2026, allocatedPercent: 25, allocatedAmount: totalBudget * 0.25 },
        { departmentId: "2", budgetYear: 2026, allocatedPercent: 20, allocatedAmount: totalBudget * 0.2 },
        { departmentId: "3", budgetYear: 2026, allocatedPercent: 20, allocatedAmount: totalBudget * 0.2 },
        { departmentId: "4", budgetYear: 2026, allocatedPercent: 20, allocatedAmount: totalBudget * 0.2 },
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
    return list;
  }, [viewMode]);

  const activeTab = useMemo(() => {
    const rawTab = activeGovernmentTab || "components";
    if (viewMode === "standard" && (rawTab === "structure" || rawTab === "spending")) {
      return "components";
    }
    if (rawTab === "preview") {
      return "components";
    }
    return rawTab;
  }, [activeGovernmentTab, viewMode]);

  const budgetSummary = useMemo(() => {
    if (!governmentStructure) {
      return {
        totalAllocated: 0,
        totalAllocatedPercent: 0,
        remaining: 0,
        remainingPercent: 100,
        isOverBudget: false,
        isUnderBudget: false,
      };
    }
    const totalBudgetVal = governmentStructure.structure?.totalBudget || 0;
    const totalAllocated =
      governmentStructure.budgetAllocations?.reduce(
        (sum, a) => sum + (a.allocatedAmount || 0),
        0
      ) || 0;
    const totalAllocatedPercent =
      governmentStructure.budgetAllocations?.reduce(
        (sum, a) => sum + (a.allocatedPercent || 0),
        0
      ) || 0;
    return {
      totalAllocated,
      totalAllocatedPercent,
      remaining: totalBudgetVal - totalAllocated,
      remainingPercent: 100 - totalAllocatedPercent,
      isOverBudget: totalAllocated > totalBudgetVal,
      isUnderBudget: totalAllocated < totalBudgetVal,
    };
  }, [governmentStructure]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <BuilderTabCard
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        sectionTheme="government"
        hideTabList={tabs.length <= 1}
      >
        {activeTab === "components" && (
          <div className="space-y-6">
            <FacetCard
              depth="base"
              theme="gold"
              className="border-amber-500/20"
              texture="chevron"
              textureOpacity={0.04}
              interactive="none"
            >
              <FacetCardContent className="p-6">
                <AtomicGovernmentComponents
                  initialComponents={governmentComponents}
                  onChange={onGovernmentComponentsChange}
                  isReadOnly={false}
                  maxComponents={15}
                  standalone={true}
                  hideSelectedList={true}
                />
              </FacetCardContent>
            </FacetCard>
          </div>
        )}

        {activeTab === "structure" && (
          <div className="space-y-6">
            {/* Departments list */}
            <FacetCard
              depth="base"
              theme="gold"
              className="border-amber-500/20"
              texture="chevron"
              textureOpacity={0.04}
            >
              <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                  <Users className="h-5 w-5 text-amber-400" />
                  Government Departments
                </h3>
              </div>
              <FacetCardContent className="p-6">
                <DepartmentList
                  departments={governmentStructure.departments}
                  onAddDepartment={() => {
                    const newDept = {
                      name: "New Department",
                      shortName: "New",
                      category: "Other" as const,
                      description: "",
                      minister: "",
                      ministerTitle: "",
                      headquarters: "",
                      established: "",
                      employeeCount: 0,
                      icon: "",
                      color: "#f59e0b",
                      priority: 50,
                      isActive: true,
                      parentDepartmentId: undefined,
                      organizationalLevel: "Ministry" as const,
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
                        (_dept: unknown, i: number) => i !== idx
                      ),
                    });
                  }}
                  isReadOnly={false}
                  governmentComponents={governmentComponents}
                  onGovernmentComponentsChange={onGovernmentComponentsChange}
                />
              </FacetCardContent>
            </FacetCard>

            {/* Budget Allocations list */}
            <FacetCard
              depth="base"
              theme="gold"
              className="border-amber-500/20"
              texture="chevron"
              textureOpacity={0.04}
            >
              <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                  <DollarSign className="h-5 w-5 text-amber-400" />
                  Budget Allocations
                </h3>
              </div>
              <FacetCardContent className="p-6">
                <BudgetAllocationList
                  departments={governmentStructure.departments}
                  budgetAllocations={governmentStructure.budgetAllocations}
                  budgetSummary={budgetSummary}
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
                      (_dept, idx) => ({
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
              </FacetCardContent>
            </FacetCard>
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
                  (d, idx) => ({
                    id: idx.toString(),
                    name: d.name,
                  })
                )}
              />
            </div>
          </div>
        )}

      </BuilderTabCard>
    </div>
  );
}
