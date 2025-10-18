"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { 
  Building2, 
  Plus, 
  Eye, 
  AlertTriangle, 
  CheckCircle,
  Users,
  DollarSign,
  Receipt,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useGovernmentBuilderAutoSync } from '~/hooks/useBuilderAutoSync';
import { ConflictWarningDialog, SyncStatusIndicator } from '~/components/builders/ConflictWarningDialog';
import { SuggestionsPanel, type SuggestionItem } from '~/components/builders/SuggestionsPanel';
import { computeGovernmentSuggestions } from '~/components/builders/suggestions/utils';
import { useIntelligenceWebSocket } from '~/hooks/useIntelligenceWebSocket';
import { IxTime } from '~/lib/ixtime';

// Import atomic components
import { GovernmentStructureForm } from './atoms/GovernmentStructureForm';
import { DepartmentForm } from './atoms/DepartmentForm';
import { BudgetAllocationForm } from './atoms/BudgetAllocationForm';
import { RevenueSourceForm } from './atoms/RevenueSourceForm';
import { SubBudgetManager } from './atoms/SubBudgetManager';
import { BudgetManagementDashboard } from './BudgetManagementDashboard';

import type { 
  GovernmentBuilderState,
  GovernmentStructureInput,
  DepartmentInput,
  BudgetAllocationInput,
  RevenueSourceInput,
  DepartmentTemplate,
  GovernmentTemplate
} from '~/types/government';
import { getGovernmentTemplates } from './templates/governmentTemplates';

interface GovernmentBuilderProps {
  initialData?: Partial<GovernmentBuilderState>;
  onSave?: (data: GovernmentBuilderState) => Promise<void>;
  onChange?: (data: GovernmentBuilderState) => void;
  onPreview?: (data: GovernmentBuilderState) => void;
  isReadOnly?: boolean;
  hideSaveButton?: boolean;
  countryId?: string;
  enableAutoSync?: boolean;
  gdpData?: {
    nominalGDP: number;
    countryName?: string;
  };
}


export function GovernmentBuilder({
  initialData,
  onSave,
  onChange,
  onPreview,
  isReadOnly = false,
  hideSaveButton = false,
  countryId,
  enableAutoSync = false,
  gdpData
}: GovernmentBuilderProps) {
  const [currentStep, setCurrentStep] = useState<'structure' | 'departments' | 'budget' | 'revenue'>('structure');
  const [localBuilderState, setLocalBuilderState] = useState<GovernmentBuilderState>({
    structure: {
      governmentName: '',
      governmentType: 'Constitutional Monarchy',
      totalBudget: 1000000000,
      fiscalYear: 'Calendar Year',
      budgetCurrency: 'USD',
      ...initialData?.structure
    },
    departments: initialData?.departments || [],
    budgetAllocations: initialData?.budgetAllocations || [],
    revenueSources: initialData?.revenueSources || [],
    isValid: false,
    errors: {}
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [pendingSaveCallback, setPendingSaveCallback] = useState<(() => void) | null>(null);
  const [allCollapsed, setAllCollapsed] = useState(true); // default collapsed
  const [budgetAllocationsCollapsed, setBudgetAllocationsCollapsed] = useState<Record<number, boolean>>({});
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);

  // Use auto-sync hook if enabled
  const {
    builderState: autoSyncState,
    setBuilderState: setAutoSyncState,
    syncState,
    triggerSync,
    clearConflicts
  } = useGovernmentBuilderAutoSync(
    countryId,
    localBuilderState,
    {
      enabled: enableAutoSync && !!countryId,
      showConflictWarnings: true,
      onConflictDetected: (warnings) => {
        if (warnings.some(w => w.severity === 'critical' || w.severity === 'warning')) {
          setShowConflictDialog(true);
          toast.warning('Government builder warnings detected');
        }
      },
      onSyncSuccess: (result) => {
        toast.success('Government changes saved');
      },
      onSyncError: (error) => {
        toast.error(`Failed to save government changes: ${error.message}`);
      }
    }
  );

  // Use auto-sync state if enabled, otherwise use local state
  const builderState = enableAutoSync && countryId ? autoSyncState : localBuilderState;
  const setBuilderState = useCallback((update: React.SetStateAction<GovernmentBuilderState>) => {
    if (enableAutoSync && countryId) {
      setAutoSyncState(update);
    } else {
      setLocalBuilderState(update);
    }
  }, [enableAutoSync, countryId, setAutoSyncState, setLocalBuilderState]);

  // Validation (expanded)
  const validateState = useCallback((): { isValid: boolean; errors: any } => {
    const errors: any = {};

    // Structure
    if (!builderState.structure.governmentName?.trim()) {
      errors.structure = errors.structure || [];
      errors.structure.push('Government name is required');
    }
    if ((builderState.structure.totalBudget ?? 0) <= 0) {
      errors.structure = errors.structure || [];
      errors.structure.push('Total budget must be greater than 0');
    }
    if (!builderState.structure.budgetCurrency) {
      errors.structure = errors.structure || [];
      errors.structure.push('Currency is required');
    }
    if (!builderState.structure.fiscalYear) {
      errors.structure = errors.structure || [];
      errors.structure.push('Fiscal year is required');
    }

    // Departments
    builderState.departments.forEach((dept, index) => {
      const deptErrors: string[] = [];
      if (!dept.name?.trim()) deptErrors.push('Department name is required');
      if (!dept.category) deptErrors.push('Department category is required');
      if (!dept.organizationalLevel) deptErrors.push('Organizational level is required');
      if (dept.color && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(dept.color)) deptErrors.push('Color must be a valid hex');
      if (dept.priority !== undefined && (dept.priority < 1 || dept.priority > 100)) deptErrors.push('Priority must be 1-100');
      if (deptErrors.length > 0) {
        errors.departments = errors.departments || {};
        errors.departments[index] = deptErrors;
      }
    });

    // Parent cycles (basic self-check)
    builderState.departments.forEach((dept, index) => {
      if (dept.parentDepartmentId && parseInt(dept.parentDepartmentId) === index) {
        errors.departments = errors.departments || {};
        errors.departments[index] = errors.departments[index] || [];
        errors.departments[index].push('Department cannot be its own parent');
      }
    });

    // Budget allocations: totals and coherence
    const totalAllocatedPercent = builderState.budgetAllocations.reduce((sum, alloc) => sum + (alloc.allocatedPercent || 0), 0);
    if (totalAllocatedPercent > 100 + 1e-6) {
      errors.budget = errors.budget || [];
      errors.budget.push('Total budget allocation exceeds 100%');
    }
    // Ensure amounts and percents coherent with totalBudget
    for (const alloc of builderState.budgetAllocations) {
      const expectedAmount = (builderState.structure.totalBudget * (alloc.allocatedPercent || 0)) / 100;
      const actualAmount = alloc.allocatedAmount || 0;
      const tolerance = Math.max(1, builderState.structure.totalBudget * 0.0001); // More tolerant tolerance
      
      if (Number.isFinite(expectedAmount) && Math.abs(actualAmount - expectedAmount) > tolerance) {
        errors.budget = errors.budget || [];
        errors.budget.push('Allocation amount should match percentage of total budget');
        break;
      }
    }

    // Revenue sources must be non-negative; percent computed later in preview
    builderState.revenueSources.forEach((r, i) => {
      const rErrors: string[] = [];
      if (!r.name?.trim()) rErrors.push('Revenue name is required');
      if (!r.category) rErrors.push('Revenue category is required');
      if ((r.revenueAmount ?? 0) < 0) rErrors.push('Revenue amount cannot be negative');
      if (r.rate !== undefined && (r.rate < 0 || r.rate > 100)) rErrors.push('Tax rate must be between 0 and 100');
      if (rErrors.length > 0) {
        errors.revenue = errors.revenue || {};
        errors.revenue[i] = rErrors;
      }
    });

    const isValid = Object.keys(errors).length === 0;
    return { isValid, errors };
  }, [builderState]);

  // Call onChange whenever builderState changes
  React.useEffect(() => {
    if (onChange) {
      onChange(builderState);
    }
  }, [builderState, onChange]);

  const handleStructureChange = React.useCallback((structure: GovernmentStructureInput) => {
    setBuilderState((prev: GovernmentBuilderState) => ({ ...prev, structure }));
  }, []);

  const handleDepartmentsChange = React.useCallback((departments: DepartmentInput[]) => {
    setBuilderState((prev: GovernmentBuilderState) => ({ ...prev, departments }));
  }, []);

  const handleBudgetChange = React.useCallback((budgetAllocations: BudgetAllocationInput[]) => {
    setBuilderState((prev: GovernmentBuilderState) => {
      // Auto-fix any amount/percentage mismatches due to rounding
      const fixedAllocations = budgetAllocations.map(alloc => {
        const expectedAmount = Math.round((prev.structure.totalBudget * (alloc.allocatedPercent || 0)) / 100);
        const actualAmount = alloc.allocatedAmount || 0;
        const tolerance = Math.max(1, prev.structure.totalBudget * 0.0001);

        // If there's a small mismatch, fix it by updating the amount to match the percentage
        if (Math.abs(actualAmount - expectedAmount) <= tolerance && actualAmount !== expectedAmount) {
          return { ...alloc, allocatedAmount: expectedAmount };
        }

        return alloc;
      });

      return { ...prev, budgetAllocations: fixedAllocations };
    });
  }, []);

  const handleRevenueChange = React.useCallback((revenueSources: RevenueSourceInput[]) => {
    setBuilderState((prev: GovernmentBuilderState) => ({ ...prev, revenueSources }));
  }, []);

  // Budget allocation collapse functions
  const toggleBudgetAllocationCollapse = React.useCallback((index: number) => {
    setBudgetAllocationsCollapsed(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  }, []);

  const collapseAllBudgetAllocations = React.useCallback(() => {
    setBuilderState((prev: GovernmentBuilderState) => {
      const collapsed: Record<number, boolean> = {};
      prev.departments.forEach((_, index) => {
        collapsed[index] = true;
      });
      setBudgetAllocationsCollapsed(collapsed);
      return prev;
    });
  }, []);

  const expandAllBudgetAllocations = React.useCallback(() => {
    setBudgetAllocationsCollapsed({});
  }, []);

  const fixBudgetAllocations = React.useCallback(() => {
    setBuilderState((prev: GovernmentBuilderState) => {
      const totalBudget = prev.structure.totalBudget;
      const numDepartments = prev.departments.length;

      if (numDepartments === 0) {
        toast.error('No departments to allocate budget to');
        return prev;
      }

      // Create or update budget allocations for ALL departments
      // This ensures every department has an allocation entry
      const allocationMap = new Map<string, BudgetAllocationInput>();

      // First, map existing allocations by departmentId
      prev.budgetAllocations.forEach(alloc => {
        allocationMap.set(alloc.departmentId, alloc);
      });

      // Ensure every department has an allocation entry
      prev.departments.forEach((dept, index) => {
        const deptId = index.toString();
        if (!allocationMap.has(deptId)) {
          allocationMap.set(deptId, {
            departmentId: deptId,
            budgetYear: new Date(IxTime.getCurrentIxTime()).getFullYear(),
            allocatedAmount: 0,
            allocatedPercent: 0,
            notes: ''
          });
        }
      });

      // Convert map back to array, maintaining department order
      const orderedAllocations = prev.departments.map((dept, index) =>
        allocationMap.get(index.toString())!
      );

      // Calculate total current allocation
      const currentTotalPercent = orderedAllocations.reduce(
        (sum, alloc) => sum + (alloc.allocatedPercent || 0),
        0
      );

      let fixedAllocations: BudgetAllocationInput[];

      // If already at or near 100%, just fix the amounts
      if (Math.abs(currentTotalPercent - 100) < 0.1) {
        fixedAllocations = orderedAllocations.map(alloc => {
          const expectedAmount = Math.round((totalBudget * (alloc.allocatedPercent || 0)) / 100);
          return { ...alloc, allocatedAmount: expectedAmount };
        });
        toast.success('Budget allocations synchronized');
      }
      // Auto-balance: distribute percentages to total 100%
      // If there are existing percentages, scale them proportionally
      else if (currentTotalPercent > 0) {
        const scaleFactor = 100 / currentTotalPercent;
        let runningTotal = 0;
        fixedAllocations = orderedAllocations.map((alloc, index) => {
          let expectedPercent: number;
          if (index === orderedAllocations.length - 1) {
            // Last department gets remainder to ensure exact 100%
            expectedPercent = 100 - runningTotal;
          } else {
            expectedPercent = (alloc.allocatedPercent || 0) * scaleFactor;
            runningTotal += expectedPercent;
          }
          const expectedAmount = Math.round((totalBudget * expectedPercent) / 100);
          return {
            ...alloc,
            allocatedPercent: expectedPercent,
            allocatedAmount: expectedAmount
          };
        });
        toast.success(`Budget balanced to 100% across ${numDepartments} departments`);
      } else {
        // No existing percentages - distribute evenly
        const evenPercent = 100 / numDepartments;
        fixedAllocations = orderedAllocations.map((alloc, index) => {
          const allocPercent = index === orderedAllocations.length - 1
            ? 100 - (evenPercent * (numDepartments - 1)) // Last department gets remainder
            : evenPercent;
          const expectedAmount = Math.round((totalBudget * allocPercent) / 100);
          return {
            ...alloc,
            allocatedPercent: allocPercent,
            allocatedAmount: expectedAmount
          };
        });
        toast.success(`Budget distributed evenly: ${evenPercent.toFixed(1)}% per department`);
      }

      return { ...prev, budgetAllocations: fixedAllocations };
    });
  }, []);

  // Auto-collapse budget allocations when departments change
  React.useEffect(() => {
    if (builderState.departments.length > 3) {
      // Auto-collapse if more than 3 departments
      collapseAllBudgetAllocations();
    }
  }, [builderState.departments.length]);

  const addDepartment = React.useCallback(() => {
    const newDepartment: DepartmentInput = {
      name: '',
      category: 'Other',
      description: '',
      ministerTitle: 'Minister',
      organizationalLevel: 'Ministry',
      color: '#6366f1',
      priority: 50,
      functions: []
    };
    setBuilderState((prev: GovernmentBuilderState) => ({
      ...prev,
      departments: [...prev.departments, newDepartment]
    }));
  }, []);

  const removeDepartment = React.useCallback((index: number) => {
    setBuilderState((prev: GovernmentBuilderState) => ({
      ...prev,
      departments: prev.departments.filter((_: DepartmentInput, i: number) => i !== index)
    }));
  }, []);

  // Memoized handler for updating a single department
  const updateDepartment = React.useCallback((index: number, updated: DepartmentInput) => {
    setBuilderState((prev: GovernmentBuilderState) => {
      const newDepartments = [...prev.departments];
      newDepartments[index] = updated;
      return { ...prev, departments: newDepartments };
    });
  }, []);

  // Memoized handler for updating a single budget allocation
  const updateBudgetAllocation = React.useCallback((index: number, updated: BudgetAllocationInput) => {
    setBuilderState((prev: GovernmentBuilderState) => {
      const newAllocations = [...prev.budgetAllocations];
      const existingIndex = newAllocations.findIndex(
        a => a.departmentId === index.toString()
      );

      if (existingIndex >= 0) {
        newAllocations[existingIndex] = updated;
      } else {
        newAllocations.push(updated);
      }

      // Auto-fix any amount/percentage mismatches due to rounding
      const fixedAllocations = newAllocations.map(alloc => {
        const expectedAmount = Math.round((prev.structure.totalBudget * (alloc.allocatedPercent || 0)) / 100);
        const actualAmount = alloc.allocatedAmount || 0;
        const tolerance = Math.max(1, prev.structure.totalBudget * 0.0001);

        if (Math.abs(actualAmount - expectedAmount) <= tolerance && actualAmount !== expectedAmount) {
          return { ...alloc, allocatedAmount: expectedAmount };
        }

        return alloc;
      });

      return { ...prev, budgetAllocations: fixedAllocations };
    });
  }, []);

  const applyTemplate = (template: GovernmentTemplate) => {
    setBuilderState((prev: GovernmentBuilderState) => ({
      ...prev,
      structure: {
        ...prev.structure,
        governmentName: `${template.name} Government`,
        governmentType: template.governmentType,
        fiscalYear: template.fiscalYear
      },
      departments: template.departments.map(dept => ({
        ...dept,
        kpis: dept.kpis?.map((kpi, index) => ({ 
          ...kpi, 
          id: `${dept.name}-kpi-${index}-${Date.now()}`,
          currentValue: 0 
        })) || []
      })),
      budgetAllocations: template.departments.map(dept => ({
        departmentId: `temp-${dept.name}`,
        budgetYear: new Date(IxTime.getCurrentIxTime()).getFullYear(),
        allocatedAmount: (prev.structure.totalBudget * dept.typicalBudgetPercent) / 100,
        allocatedPercent: dept.typicalBudgetPercent,
        notes: `Initial allocation for ${dept.name}`
      })),
      revenueSources: template.typicalRevenueSources.map(source => ({
        ...source,
        revenueAmount: prev.structure.totalBudget * 0.2 // Default to 20% of budget per source
      }))
    }));
    setShowTemplates(false);
  };

  const handleSave = async () => {
    const validation = validateState();
    setBuilderState((prev: GovernmentBuilderState) => ({ ...prev, ...validation }));
    
    if (validation.isValid) {
      // Check for conflicts if auto-sync is enabled
      if (enableAutoSync && countryId && syncState.conflictWarnings.length > 0) {
        setPendingSaveCallback(() => async () => {
          if (onSave) {
            setIsSaving(true);
            try {
              await onSave({ ...builderState, ...validation });
              clearConflicts();
            } catch (error) {
              console.error('Save failed:', error);
            } finally {
              setIsSaving(false);
            }
          }
        });
        setShowConflictDialog(true);
      } else if (onSave) {
        setIsSaving(true);
        try {
          await onSave({ ...builderState, ...validation });
        } catch (error) {
          console.error('Save failed:', error);
        } finally {
          setIsSaving(false);
        }
      }
    }
  };

  const handleConfirmConflicts = () => {
    setShowConflictDialog(false);
    if (pendingSaveCallback) {
      pendingSaveCallback();
      setPendingSaveCallback(null);
    }
    clearConflicts();
  };

  const handleCancelConflicts = () => {
    setShowConflictDialog(false);
    setPendingSaveCallback(null);
  };


  const steps = [
    { id: 'structure', label: 'Government Structure', icon: Building2 },
    { id: 'departments', label: 'Departments', icon: Users },
    { id: 'budget', label: 'Budget Allocation', icon: DollarSign },
    { id: 'revenue', label: 'Revenue Sources', icon: Receipt }
  ];

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);
  const validation = validateState();

  // Basic, non-destructive suggestions (behind flag)
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS !== 'true') return;
    setSuggestions(computeGovernmentSuggestions(builderState as any));
  }, [builderState]);

  // Recompute suggestions on intelligence updates
  const intel = useIntelligenceWebSocket({ countryId });
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS !== 'true') return;
    if (!intel.latestUpdate) return;
    setSuggestions(computeGovernmentSuggestions(builderState as any));
  }, [intel.latestUpdate, builderState]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Conflict Warning Dialog */}
      <ConflictWarningDialog
        open={showConflictDialog}
        onOpenChange={setShowConflictDialog}
        warnings={syncState.conflictWarnings}
        onConfirm={handleConfirmConflicts}
        onCancel={handleCancelConflicts}
        builderType="government"
      />

      {/* Header */}
      <div className="flex items-center justify-between">
       
        <div className="flex items-center gap-3">
          {enableAutoSync && countryId && (
            <SyncStatusIndicator
              isSyncing={syncState.isSyncing}
              lastSyncTime={syncState.lastSyncTime}
              pendingChanges={syncState.pendingChanges}
              hasError={!!syncState.syncError}
              errorMessage={syncState.syncError?.message}
            />
          )}
          <Button
            variant="outline"
            onClick={() => setShowTemplates(true)}
            disabled={isReadOnly}
          >
            Use Template
          </Button>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = index < currentStepIndex;
          const hasErrors = validation.errors[step.id] && validation.errors[step.id].length > 0;
          const hasStepErrors = step.id === 'departments' && validation.errors.departments && Object.keys(validation.errors.departments).length > 0;

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => setCurrentStep(step.id as any)}
                disabled={isReadOnly}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors relative ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isCompleted && !hasErrors && !hasStepErrors
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                      : hasErrors || hasStepErrors
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                        : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                <StepIcon className="h-4 w-4" />
                <span className="text-sm font-medium">{step.label}</span>
                {isCompleted && !hasErrors && !hasStepErrors && <CheckCircle className="h-4 w-4" />}
                {(hasErrors || hasStepErrors) && <AlertTriangle className="h-4 w-4" />}
              </button>
              {index < steps.length - 1 && (
                <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>

      {/* Validation Errors */}
      {!validation.isValid && Object.keys(validation.errors).length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please fix the following issues:
            <ul className="mt-2 list-disc list-inside space-y-1">
              {Object.entries(validation.errors as Record<string, any>).map(([key, errors]) => (
                Array.isArray(errors) ? errors.map((error, index) => (
                  <li key={`${key}-${index}`} className="text-sm">{error}</li>
                )) : Object.entries(errors).map(([subKey, subErrors]) => (
                  <li key={`${key}-${subKey}`} className="text-sm">
                    Department {parseInt(subKey) + 1}: {Array.isArray(subErrors) ? subErrors.join(', ') : String(subErrors)}
                  </li>
                ))
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Intelligent Suggestions */}
      {process.env.NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS === 'true' && suggestions.length > 0 && (
        <SuggestionsPanel
          suggestions={suggestions}
          onApply={(s) => {
            if (s.id === 'budget-cap') {
              // Simple apply: scale down the largest allocation by the overage amount
              const over = builderState.budgetAllocations.reduce((sum, a) => sum + (a.allocatedPercent || 0), 0) - 100;
              if (over > 0) {
                const idx = builderState.budgetAllocations.reduce((maxIdx, a, i, arr) => (a.allocatedPercent > arr[maxIdx].allocatedPercent ? i : maxIdx), 0);
                const updated = [...builderState.budgetAllocations];
                const target = { ...updated[idx] } as any;
                target.allocatedPercent = Math.max(0, (target.allocatedPercent || 0) - over);
                target.allocatedAmount = (builderState.structure.totalBudget * target.allocatedPercent) / 100;
                updated[idx] = target;
                handleBudgetChange(updated);
              }
            }
            setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
          }}
          onDismiss={(id) => setSuggestions((prev) => prev.filter((x) => x.id !== id))}
          isReadOnly={isReadOnly}
        />
      )}

      {/* Step Content */}
      <div className="space-y-6">
        {currentStep === 'structure' && (
          <GovernmentStructureForm
            data={builderState.structure}
            onChange={handleStructureChange}
            isReadOnly={isReadOnly}
            gdpData={gdpData}
          />
        )}

        {currentStep === 'departments' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-foreground">
                Government Departments
              </h2>
              {!isReadOnly && (
                <Button onClick={addDepartment}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Department
                </Button>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setAllCollapsed(true)}>
                  Collapse all
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAllCollapsed(false)}>
                  Expand all
                </Button>
              </div>
              {builderState.departments.map((department, index) => (
                <details key={index} open={!allCollapsed} className="rounded-lg border">
                  <summary className="cursor-pointer px-4 py-2 flex items-center justify-between">
                    <span className="font-medium">{department.name || `Department ${index + 1}`}</span>
                    <span className="text-xs text-muted-foreground">Click to {allCollapsed ? 'expand' : 'collapse'}</span>
                  </summary>
                  <div className="p-4">
                    <DepartmentForm
                      data={department}
                      onChange={(updated) => updateDepartment(index, updated)}
                      onDelete={() => removeDepartment(index)}
                      isReadOnly={isReadOnly}
                      availableParents={builderState.departments
                        .map((d, i) => ({ id: i.toString(), name: d.name }))
                        .filter((d, i) => i !== index)}
                      errors={validation.errors.departments?.[index] ? { name: validation.errors.departments[index] } : {}}
                    />
                  </div>
                </details>
              ))}

              {builderState.departments.length === 0 && (
                <Card className="border-2 border-dashed border-border">
                  <CardContent className="p-8 text-center">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      No Departments Yet
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Add government departments to structure your administration
                    </p>
                    {!isReadOnly && (
                      <Button onClick={addDepartment}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Department
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {currentStep === 'budget' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-foreground">
                Budget Allocation
              </h2>
              {builderState.departments.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={expandAllBudgetAllocations}
                    className="text-xs"
                  >
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Expand All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={collapseAllBudgetAllocations}
                    className="text-xs"
                  >
                    <ChevronRight className="h-3 w-3 mr-1" />
                    Collapse All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fixBudgetAllocations}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Fix Allocations
                  </Button>
                </div>
              )}
            </div>

            {builderState.departments.length === 0 ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Add departments first before setting up budget allocations.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {/* Budget remaining meter */}
                {(() => {
                  const totalPercent = builderState.budgetAllocations.reduce((s, a) => s + (a.allocatedPercent || 0), 0);
                  const remaining = 100 - totalPercent;
                  const over = totalPercent > 100;
                  return (
                    <div className="p-4 rounded-lg border bg-muted/40">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="font-medium">Allocation</span>
                        <span className={over ? 'text-red-600' : 'text-muted-foreground'}>
                          {totalPercent.toFixed(1)}% allocated • {remaining.toFixed(1)}% remaining
                        </span>
                      </div>
                      <div className="w-full h-2 rounded bg-muted overflow-hidden">
                        <div
                          className={`h-2 ${over ? 'bg-red-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(100, Math.max(0, totalPercent))}%` }}
                        />
                      </div>
                      {over && (
                        <div className="mt-2 text-xs text-red-600">Total exceeds 100%. Reduce allocations to proceed.</div>
                      )}
                    </div>
                  );
                })()}
                {builderState.departments.map((department, index) => {
                  const existingAllocation = builderState.budgetAllocations.find(
                    a => a.departmentId === index.toString()
                  );
                  const allocation: BudgetAllocationInput = existingAllocation || {
                    departmentId: index.toString(),
                    budgetYear: new Date(IxTime.getCurrentIxTime()).getFullYear(),
                    allocatedAmount: 0,
                    allocatedPercent: 0,
                    notes: ''
                  };

                  return (
                    <BudgetAllocationForm
                      key={index}
                      data={allocation}
                      onChange={(updated) => updateBudgetAllocation(index, updated)}
                      departmentName={department.name}
                      departmentColor={department.color}
                      totalBudget={builderState.structure.totalBudget}
                      currency={builderState.structure.budgetCurrency}
                      isReadOnly={isReadOnly}
                      isCollapsed={budgetAllocationsCollapsed[index] || false}
                      onToggleCollapse={() => toggleBudgetAllocationCollapse(index)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {currentStep === 'revenue' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">
              Revenue Sources
            </h2>

            <RevenueSourceForm
              data={builderState.revenueSources}
              onChange={handleRevenueChange}
              totalRevenue={builderState.structure.totalBudget}
              currency={builderState.structure.budgetCurrency}
              isReadOnly={isReadOnly}
              availableDepartments={builderState.departments.map((d, i) => ({ id: i.toString(), name: d.name }))}
            />
          </div>
        )}

      </div>

      {/* Template Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-foreground">
                Government Templates
              </h2>
              <Button variant="outline" onClick={() => setShowTemplates(false)}>
                Close
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getGovernmentTemplates().map((template, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle>{template.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <Badge variant="secondary">{template.governmentType}</Badge>
                        <Badge variant="outline" className="ml-2">{template.departments.length} Departments</Badge>
                      </div>
                      <div className="text-sm">
                        <strong>Departments:</strong>
                        <ul className="mt-1 text-muted-foreground">
                          {template.departments.slice(0, 3).map(dept => (
                            <li key={dept.name}>• {dept.name}</li>
                          ))}
                          {template.departments.length > 3 && (
                            <li>• +{template.departments.length - 3} more...</li>
                          )}
                        </ul>
                      </div>
                      <Button 
                        onClick={() => applyTemplate(template)}
                        className="w-full"
                      >
                        Use This Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-6 border-t border-border">
        <Button
          variant="outline"
          onClick={() => {
            const prevIndex = Math.max(0, currentStepIndex - 1);
            setCurrentStep(steps[prevIndex].id as any);
          }}
          disabled={currentStepIndex === 0 || isReadOnly}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <div className="flex items-center gap-2">
          {validation.isValid ? (
            <Badge variant="default" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
              <CheckCircle className="h-3 w-3 mr-1" />
              Valid Configuration
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {Object.keys(validation.errors).length} Issues
            </Badge>
          )}
        </div>

        <Button
          onClick={() => {
            const nextIndex = Math.min(steps.length - 1, currentStepIndex + 1);
            setCurrentStep(steps[nextIndex].id as any);
          }}
          disabled={currentStepIndex === steps.length - 1 || isReadOnly}
        >
          Next
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}