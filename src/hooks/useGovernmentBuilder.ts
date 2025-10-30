/**
 * Government Builder State Management Hook
 *
 * Manages form state, validation, and handlers for the government builder.
 * Integrates with auto-sync functionality and provides a clean interface.
 *
 * @module useGovernmentBuilder
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { IxTime } from '~/lib/ixtime';
import {
  validateGovernmentBuilderState,
  generateBudgetSummary,
  generateGovernmentSummary,
  calculateTotalBudgetPercent,
  type ValidationResult,
  type BudgetSummary,
  type GovernmentSummary,
} from '~/lib/government-builder-validation';
import { useGovernmentBuilderAutoSync } from './useBuilderAutoSync';
import type {
  GovernmentBuilderState,
  GovernmentStructureInput,
  DepartmentInput,
  BudgetAllocationInput,
  RevenueSourceInput,
  GovernmentTemplate,
} from '~/types/government';
import type { TaxCategoryInput } from '~/types/tax-system';

// ==================== TYPES ====================

export interface UseGovernmentBuilderOptions {
  countryId?: string;
  enableAutoSync?: boolean;
  isReadOnly?: boolean;
  onSave?: (data: GovernmentBuilderState) => Promise<void>;
  onChange?: (data: GovernmentBuilderState) => void;
}

export interface UseGovernmentBuilderReturn {
  // State
  builderState: GovernmentBuilderState;
  validation: ValidationResult;
  budgetSummary: BudgetSummary;
  governmentSummary: GovernmentSummary;
  isSaving: boolean;
  currentStep: 'structure' | 'departments' | 'budget' | 'revenue';

  // Sync state (when auto-sync is enabled)
  syncState: {
    isSyncing: boolean;
    lastSyncTime: Date | null;
    pendingChanges: boolean;
    conflictWarnings: any[];
    syncError: Error | null;
  };

  // Structure handlers
  updateStructure: (structure: GovernmentStructureInput) => void;

  // Department handlers
  addDepartment: () => void;
  removeDepartment: (index: number) => void;
  updateDepartment: (index: number, department: DepartmentInput) => void;

  // Budget handlers
  updateBudgetAllocation: (index: number, allocation: BudgetAllocationInput) => void;
  fixBudgetAllocations: () => void;

  // Revenue handlers
  updateRevenue: (revenueSources: RevenueSourceInput[]) => void;
  importTaxData: (taxCategories: TaxCategoryInput[]) => void;

  // Navigation
  setCurrentStep: (step: 'structure' | 'departments' | 'budget' | 'revenue') => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;

  // Template handlers
  applyTemplate: (template: GovernmentTemplate) => void;

  // Save handlers
  handleSave: () => Promise<void>;
  triggerSync: () => void;
  clearConflicts: () => void;

  // UI state
  allCollapsed: boolean;
  setAllCollapsed: (collapsed: boolean) => void;
  budgetAllocationsCollapsed: Record<number, boolean>;
  toggleBudgetAllocationCollapse: (index: number) => void;
  collapseAllBudgetAllocations: () => void;
  expandAllBudgetAllocations: () => void;
}

// ==================== HOOK ====================

/**
 * Government builder state management hook
 */
export function useGovernmentBuilder(
  initialData: Partial<GovernmentBuilderState> = {},
  options: UseGovernmentBuilderOptions = {}
): UseGovernmentBuilderReturn {
  const {
    countryId,
    enableAutoSync = false,
    isReadOnly = false,
    onSave,
    onChange,
  } = options;

  // ==================== LOCAL STATE ====================

  const [currentStep, setCurrentStep] = useState<
    'structure' | 'departments' | 'budget' | 'revenue'
  >('structure');
  const [isSaving, setIsSaving] = useState(false);
  const [allCollapsed, setAllCollapsed] = useState(true);
  const [budgetAllocationsCollapsed, setBudgetAllocationsCollapsed] = useState<
    Record<number, boolean>
  >({});

  const [localBuilderState, setLocalBuilderState] = useState<GovernmentBuilderState>({
    structure: {
      governmentName: '',
      governmentType: 'Constitutional Monarchy',
      totalBudget: 1000000000,
      fiscalYear: 'Calendar Year',
      budgetCurrency: 'USD',
      ...initialData?.structure,
    },
    departments: initialData?.departments || [],
    budgetAllocations: initialData?.budgetAllocations || [],
    revenueSources: initialData?.revenueSources || [],
    isValid: false,
    errors: {},
  });

  // ==================== AUTO-SYNC INTEGRATION ====================

  const {
    builderState: autoSyncState,
    setBuilderState: setAutoSyncState,
    syncState,
    triggerSync,
    clearConflicts,
  } = useGovernmentBuilderAutoSync(countryId, localBuilderState, {
    enabled: enableAutoSync && !!countryId,
    showConflictWarnings: true,
    onSyncSuccess: (result) => {
      toast.success('Government changes saved');
    },
    onSyncError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  // Use auto-sync state if enabled, otherwise use local state
  const builderState = enableAutoSync && countryId ? autoSyncState : localBuilderState;
  const setBuilderState = useCallback(
    (update: React.SetStateAction<GovernmentBuilderState>) => {
      if (enableAutoSync && countryId) {
        setAutoSyncState(update);
      } else {
        setLocalBuilderState(update);
      }
    },
    [enableAutoSync, countryId, setAutoSyncState]
  );

  // ==================== VALIDATION ====================

  const validation = useMemo(
    () => validateGovernmentBuilderState(builderState),
    [builderState]
  );

  const budgetSummary = useMemo(
    () => generateBudgetSummary(builderState.budgetAllocations, builderState.structure.totalBudget),
    [builderState.budgetAllocations, builderState.structure.totalBudget]
  );

  const governmentSummary = useMemo(
    () => generateGovernmentSummary(builderState),
    [builderState]
  );

  // ==================== CHANGE NOTIFICATION ====================

  useEffect(() => {
    if (onChange) {
      onChange(builderState);
    }
  }, [builderState, onChange]);

  // ==================== STRUCTURE HANDLERS ====================

  const updateStructure = useCallback(
    (structure: GovernmentStructureInput) => {
      setBuilderState((prev) => ({ ...prev, structure }));
    },
    [setBuilderState]
  );

  // ==================== DEPARTMENT HANDLERS ====================

  const addDepartment = useCallback(() => {
    const newDepartment: DepartmentInput = {
      name: '',
      category: 'Other',
      description: '',
      ministerTitle: 'Minister',
      organizationalLevel: 'Ministry',
      color: '#6366f1',
      priority: 50,
      functions: [],
    };
    setBuilderState((prev) => ({
      ...prev,
      departments: [...prev.departments, newDepartment],
    }));
  }, [setBuilderState]);

  const removeDepartment = useCallback(
    (index: number) => {
      setBuilderState((prev) => ({
        ...prev,
        departments: prev.departments.filter((_, i) => i !== index),
      }));
    },
    [setBuilderState]
  );

  const updateDepartment = useCallback(
    (index: number, updated: DepartmentInput) => {
      setBuilderState((prev) => {
        const newDepartments = [...prev.departments];
        newDepartments[index] = updated;
        return { ...prev, departments: newDepartments };
      });
    },
    [setBuilderState]
  );

  // ==================== BUDGET HANDLERS ====================

  const updateBudgetAllocation = useCallback(
    (index: number, updated: BudgetAllocationInput) => {
      setBuilderState((prev) => {
        const newAllocations = [...prev.budgetAllocations];
        const existingIndex = newAllocations.findIndex(
          (a) => a.departmentId === index.toString()
        );

        if (existingIndex >= 0) {
          newAllocations[existingIndex] = updated;
        } else {
          newAllocations.push(updated);
        }

        // Auto-fix any amount/percentage mismatches
        const fixedAllocations = newAllocations.map((alloc) => {
          const expectedAmount = Math.round(
            (prev.structure.totalBudget * (alloc.allocatedPercent || 0)) / 100
          );
          const actualAmount = alloc.allocatedAmount || 0;
          const tolerance = Math.max(1, prev.structure.totalBudget * 0.0001);

          if (
            Math.abs(actualAmount - expectedAmount) <= tolerance &&
            actualAmount !== expectedAmount
          ) {
            return { ...alloc, allocatedAmount: expectedAmount };
          }

          return alloc;
        });

        return { ...prev, budgetAllocations: fixedAllocations };
      });
    },
    [setBuilderState]
  );

  const fixBudgetAllocations = useCallback(() => {
    setBuilderState((prev) => {
      const totalBudget = prev.structure.totalBudget;
      const numDepartments = prev.departments.length;

      if (numDepartments === 0) {
        toast.error('No departments to allocate budget to');
        return prev;
      }

      // Ensure every department has an allocation entry
      const allocationMap = new Map<string, BudgetAllocationInput>();

      prev.budgetAllocations.forEach((alloc) => {
        allocationMap.set(alloc.departmentId, alloc);
      });

      prev.departments.forEach((dept, index) => {
        const deptId = index.toString();
        if (!allocationMap.has(deptId)) {
          allocationMap.set(deptId, {
            departmentId: deptId,
            budgetYear: new Date(IxTime.getCurrentIxTime()).getFullYear(),
            allocatedAmount: 0,
            allocatedPercent: 0,
            notes: '',
          });
        }
      });

      const orderedAllocations = prev.departments.map((dept, index) =>
        allocationMap.get(index.toString())!
      );

      const currentTotalPercent = orderedAllocations.reduce(
        (sum, alloc) => sum + (alloc.allocatedPercent || 0),
        0
      );

      let fixedAllocations: BudgetAllocationInput[];

      // If already at 100%, just fix amounts
      if (Math.abs(currentTotalPercent - 100) < 0.1) {
        fixedAllocations = orderedAllocations.map((alloc) => {
          const expectedAmount = Math.round(
            (totalBudget * (alloc.allocatedPercent || 0)) / 100
          );
          return { ...alloc, allocatedAmount: expectedAmount };
        });
        toast.success('Budget allocations synchronized');
      }
      // Scale existing percentages proportionally
      else if (currentTotalPercent > 0) {
        const scaleFactor = 100 / currentTotalPercent;
        let runningTotal = 0;
        fixedAllocations = orderedAllocations.map((alloc, index) => {
          let expectedPercent: number;
          if (index === orderedAllocations.length - 1) {
            expectedPercent = 100 - runningTotal;
          } else {
            expectedPercent = (alloc.allocatedPercent || 0) * scaleFactor;
            runningTotal += expectedPercent;
          }
          const expectedAmount = Math.round((totalBudget * expectedPercent) / 100);
          return {
            ...alloc,
            allocatedPercent: expectedPercent,
            allocatedAmount: expectedAmount,
          };
        });
        toast.success(`Budget balanced to 100% across ${numDepartments} departments`);
      }
      // Distribute evenly
      else {
        const evenPercent = 100 / numDepartments;
        fixedAllocations = orderedAllocations.map((alloc, index) => {
          const allocPercent =
            index === orderedAllocations.length - 1
              ? 100 - evenPercent * (numDepartments - 1)
              : evenPercent;
          const expectedAmount = Math.round((totalBudget * allocPercent) / 100);
          return {
            ...alloc,
            allocatedPercent: allocPercent,
            allocatedAmount: expectedAmount,
          };
        });
        toast.success(`Budget distributed evenly: ${evenPercent.toFixed(1)}% per department`);
      }

      return { ...prev, budgetAllocations: fixedAllocations };
    });
  }, [setBuilderState]);

  // ==================== REVENUE HANDLERS ====================

  const updateRevenue = useCallback(
    (revenueSources: RevenueSourceInput[]) => {
      setBuilderState((prev) => ({ ...prev, revenueSources }));
    },
    [setBuilderState]
  );

  const importTaxData = useCallback(
    (taxCategories: TaxCategoryInput[]) => {
      // Import tax categories as revenue sources
      // This is a placeholder - implement conversion logic as needed
      toast.info('Tax data import: implementation needed');
    },
    [setBuilderState]
  );

  // ==================== NAVIGATION ====================

  const steps: Array<'structure' | 'departments' | 'budget' | 'revenue'> = [
    'structure',
    'departments',
    'budget',
    'revenue',
  ];

  const goToNextStep = useCallback(() => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  }, [currentStep]);

  const goToPreviousStep = useCallback(() => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  }, [currentStep]);

  // ==================== TEMPLATE HANDLERS ====================

  const applyTemplate = useCallback(
    (template: GovernmentTemplate) => {
      setBuilderState((prev) => ({
        ...prev,
        structure: {
          ...prev.structure,
          governmentName: `${template.name} Government`,
          governmentType: template.governmentType,
          fiscalYear: template.fiscalYear,
        },
        departments: template.departments.map((dept) => ({
          ...dept,
          kpis:
            dept.kpis?.map((kpi, index) => ({
              ...kpi,
              id: `${dept.name}-kpi-${index}-${Date.now()}`,
              currentValue: 0,
            })) || [],
        })),
        budgetAllocations: template.departments.map((dept) => ({
          departmentId: `temp-${dept.name}`,
          budgetYear: new Date(IxTime.getCurrentIxTime()).getFullYear(),
          allocatedAmount: (prev.structure.totalBudget * dept.typicalBudgetPercent) / 100,
          allocatedPercent: dept.typicalBudgetPercent,
          notes: `Initial allocation for ${dept.name}`,
        })),
        revenueSources: template.typicalRevenueSources.map((source) => ({
          ...source,
          revenueAmount: prev.structure.totalBudget * 0.2,
        })),
      }));
      toast.success(`Applied template: ${template.name}`);
    },
    [setBuilderState]
  );

  // ==================== SAVE HANDLERS ====================

  const handleSave = useCallback(async () => {
    const currentValidation = validateGovernmentBuilderState(builderState);

    if (!currentValidation.isValid) {
      toast.error('Please fix validation errors before saving');
      return;
    }

    if (onSave) {
      setIsSaving(true);
      try {
        const submission: GovernmentBuilderState = {
          ...builderState,
          isValid: currentValidation.isValid,
          errors: currentValidation.errors,
        };
        await onSave(submission);
        toast.success('Government saved successfully');
      } catch (error) {
        console.error('Save failed:', error);
        toast.error('Failed to save government');
      } finally {
        setIsSaving(false);
      }
    }
  }, [builderState, onSave]);

  // ==================== UI STATE HANDLERS ====================

  const toggleBudgetAllocationCollapse = useCallback((index: number) => {
    setBudgetAllocationsCollapsed((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  }, []);

  const collapseAllBudgetAllocations = useCallback(() => {
    setBuilderState((prev) => {
      const collapsed: Record<number, boolean> = {};
      prev.departments.forEach((_, index) => {
        collapsed[index] = true;
      });
      setBudgetAllocationsCollapsed(collapsed);
      return prev;
    });
  }, [setBuilderState]);

  const expandAllBudgetAllocations = useCallback(() => {
    setBudgetAllocationsCollapsed({});
  }, []);

  // Auto-collapse budget allocations when department count changes
  useEffect(() => {
    if (builderState.departments.length > 3) {
      collapseAllBudgetAllocations();
    }
  }, [builderState.departments.length, collapseAllBudgetAllocations]);

  // ==================== RETURN ====================

  return {
    // State
    builderState,
    validation,
    budgetSummary,
    governmentSummary,
    isSaving,
    currentStep,

    // Sync state
    syncState,

    // Structure handlers
    updateStructure,

    // Department handlers
    addDepartment,
    removeDepartment,
    updateDepartment,

    // Budget handlers
    updateBudgetAllocation,
    fixBudgetAllocations,

    // Revenue handlers
    updateRevenue,
    importTaxData,

    // Navigation
    setCurrentStep,
    goToNextStep,
    goToPreviousStep,

    // Template handlers
    applyTemplate,

    // Save handlers
    handleSave,
    triggerSync,
    clearConflicts,

    // UI state
    allCollapsed,
    setAllCollapsed,
    budgetAllocationsCollapsed,
    toggleBudgetAllocationCollapse,
    collapseAllBudgetAllocations,
    expandAllBudgetAllocations,
  };
}
