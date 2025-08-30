"use client";

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { 
  Building2, 
  Plus, 
  Save, 
  Eye, 
  AlertTriangle, 
  CheckCircle,
  Users,
  DollarSign,
  Receipt,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';

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

interface GovernmentBuilderProps {
  initialData?: Partial<GovernmentBuilderState>;
  onSave: (data: GovernmentBuilderState) => Promise<void>;
  onPreview?: (data: GovernmentBuilderState) => void;
  isReadOnly?: boolean;
}

// Enhanced Government Templates with Atomic Components
const governmentTemplates: GovernmentTemplate[] = [
  {
    name: 'Caphirian Imperial Administration',
    governmentType: 'Imperial Constitutional System',
    description: 'Complex administrative structure with Imperial oversight and provincial autonomy',
    fiscalYear: 'Calendar Year',
    departments: [
      {
        name: 'Imperial Ministry of State',
        shortName: 'IMS',
        category: 'Executive',
        description: 'Central coordination of imperial policy and provincial oversight',
        ministerTitle: 'Imperial Chancellor',
        organizationalLevel: 'Supreme Ministry',
        icon: 'Crown',
        color: '#7c2d12',
        priority: 100,
        functions: ['Imperial Policy Coordination', 'Provincial Relations', 'Constitutional Affairs', 'Imperial Ceremonies'],
        typicalBudgetPercent: 8,
        subBudgets: [
          { name: 'Imperial Court', budgetType: 'Operations', percent: 25, isRecurring: true, priority: 'Critical' },
          { name: 'Provincial Liaison', budgetType: 'Personnel', percent: 35, isRecurring: true, priority: 'High' },
          { name: 'Policy Development', budgetType: 'Operations', percent: 40, isRecurring: true, priority: 'High' }
        ],
        kpis: [
          { name: 'Imperial Unity Index', description: 'Measure of provincial cooperation and imperial cohesion', targetValue: 85, unit: '%', frequency: 'Quarterly', trend: 'Up', category: 'Political' }
        ]
      },
      {
        name: 'Ministry of Defense',
        shortName: 'MoD',
        category: 'Defense',
        description: 'Imperial military forces and territorial defense',
        ministerTitle: 'Minister of Defense',
        organizationalLevel: 'Ministry',
        icon: 'Shield',
        color: '#dc2626',
        priority: 95,
        functions: ['Military Operations', 'Defense Policy', 'National Security', 'Veterans Affairs'],
        typicalBudgetPercent: 18,
        subBudgets: [
          { name: 'Active Forces', budgetType: 'Personnel', percent: 45, isRecurring: true, priority: 'Critical' },
          { name: 'Equipment & Procurement', budgetType: 'Capital', percent: 30, isRecurring: false, priority: 'High' },
          { name: 'Operations & Training', budgetType: 'Operations', percent: 20, isRecurring: true, priority: 'High' },
          { name: 'Veterans Support', budgetType: 'Personnel', percent: 5, isRecurring: true, priority: 'Medium' }
        ],
        kpis: [
          { name: 'Defense Readiness', description: 'Overall military readiness and capability', targetValue: 90, unit: '%', frequency: 'Monthly', trend: 'Up', category: 'Performance' },
          { name: 'Recruitment Rate', description: 'Success rate in meeting recruitment targets', targetValue: 95, unit: '%', frequency: 'Monthly', trend: 'Stable', category: 'Personnel' }
        ]
      },
      {
        name: 'Ministry of Imperial Finance',
        shortName: 'MIF',
        category: 'Finance',
        description: 'Economic policy, taxation, and imperial treasury management',
        ministerTitle: 'Chancellor of the Imperial Treasury',
        organizationalLevel: 'Ministry',
        icon: 'Coins',
        color: '#7c3aed',
        priority: 98,
        functions: ['Tax Policy', 'Budget Management', 'Economic Planning', 'Currency Management', 'Trade Policy'],
        typicalBudgetPercent: 6,
        subBudgets: [
          { name: 'Tax Administration', budgetType: 'Personnel', percent: 40, isRecurring: true, priority: 'Critical' },
          { name: 'Economic Analysis', budgetType: 'Operations', percent: 25, isRecurring: true, priority: 'High' },
          { name: 'Financial Systems', budgetType: 'Capital', percent: 20, isRecurring: false, priority: 'High' },
          { name: 'International Relations', budgetType: 'Operations', percent: 15, isRecurring: true, priority: 'Medium' }
        ],
        kpis: [
          { name: 'Tax Collection Efficiency', description: 'Percentage of assessed taxes collected', targetValue: 92, unit: '%', frequency: 'Monthly', trend: 'Up', category: 'Financial' },
          { name: 'Budget Variance', description: 'Deviation from planned budget allocations', targetValue: 5, unit: '%', frequency: 'Quarterly', trend: 'Down', category: 'Financial' }
        ]
      },
      {
        name: 'Ministry of Education',
        shortName: 'MoE',
        category: 'Education',
        description: 'Educational policy and administration',
        ministerTitle: 'Minister of Education',
        organizationalLevel: 'Ministry',
        icon: 'GraduationCap',
        color: '#2563eb',
        priority: 95,
        functions: ['Educational Policy', 'School Administration', 'Higher Education'],
        typicalBudgetPercent: 18,
        subBudgets: [
          { name: 'Teacher Salaries', budgetType: 'Personnel', percent: 55, isRecurring: true, priority: 'Critical' },
          { name: 'Infrastructure', budgetType: 'Capital', percent: 25, isRecurring: false, priority: 'High' },
          { name: 'Programs', budgetType: 'Operations', percent: 20, isRecurring: true, priority: 'High' }
        ],
        kpis: [
          { name: 'Literacy Rate', description: 'National literacy rate', targetValue: 98, unit: '%', frequency: 'Annually', trend: 'Up', category: 'Performance' }
        ]
      },
      {
        name: 'Ministry of Health',
        shortName: 'MoH',
        category: 'Health',
        description: 'Public health services and policy',
        ministerTitle: 'Minister of Health',
        organizationalLevel: 'Ministry',
        icon: 'Heart',
        color: '#059669',
        priority: 92,
        functions: ['Healthcare Policy', 'Public Health', 'Medical Services'],
        typicalBudgetPercent: 16,
        subBudgets: [
          { name: 'Medical Staff', budgetType: 'Personnel', percent: 50, isRecurring: true, priority: 'Critical' },
          { name: 'Medical Equipment', budgetType: 'Capital', percent: 30, isRecurring: false, priority: 'High' },
          { name: 'Public Health Programs', budgetType: 'Operations', percent: 20, isRecurring: true, priority: 'High' }
        ],
        kpis: [
          { name: 'Life Expectancy', description: 'Average life expectancy', targetValue: 82, unit: 'years', frequency: 'Annually', trend: 'Up', category: 'Performance' }
        ]
      },
      {
        name: 'Ministry of Finance',
        shortName: 'MoF',
        category: 'Finance',
        description: 'Economic policy and fiscal management',
        ministerTitle: 'Chancellor of the Exchequer',
        organizationalLevel: 'Ministry',
        icon: 'Briefcase',
        color: '#7c3aed',
        priority: 98,
        functions: ['Budget Management', 'Tax Policy', 'Economic Policy'],
        typicalBudgetPercent: 8,
        subBudgets: [
          { name: 'Administration', budgetType: 'Personnel', percent: 40, isRecurring: true, priority: 'High' },
          { name: 'Economic Programs', budgetType: 'Operations', percent: 35, isRecurring: true, priority: 'High' },
          { name: 'Infrastructure', budgetType: 'Capital', percent: 25, isRecurring: false, priority: 'Medium' }
        ],
        kpis: [
          { name: 'Fiscal Balance', description: 'Budget surplus/deficit ratio', targetValue: 2, unit: '% GDP', frequency: 'Quarterly', trend: 'Up', category: 'Financial' }
        ]
      }
    ],
    typicalRevenueSources: [
      { name: 'Personal Income Tax', category: 'Direct Tax', rate: 25, collectionMethod: 'Payroll Deduction' },
      { name: 'Corporate Income Tax', category: 'Direct Tax', rate: 20, collectionMethod: 'Annual Filing' },
      { name: 'Value Added Tax', category: 'Indirect Tax', rate: 15, collectionMethod: 'Point of Sale' },
      { name: 'Property Tax', category: 'Direct Tax', rate: 1.5, collectionMethod: 'Annual Assessment' }
    ]
  }
];

export function GovernmentBuilder({ 
  initialData, 
  onSave, 
  onPreview, 
  isReadOnly = false 
}: GovernmentBuilderProps) {
  const [currentStep, setCurrentStep] = useState<'structure' | 'departments' | 'budget' | 'revenue' | 'preview'>('structure');
  const [builderState, setBuilderState] = useState<GovernmentBuilderState>({
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

  // Validation
  const validateState = useCallback((): { isValid: boolean; errors: any } => {
    const errors: any = {};

    // Validate structure
    if (!builderState.structure.governmentName.trim()) {
      errors.structure = errors.structure || [];
      errors.structure.push('Government name is required');
    }
    if (builderState.structure.totalBudget <= 0) {
      errors.structure = errors.structure || [];
      errors.structure.push('Total budget must be greater than 0');
    }

    // Validate departments
    builderState.departments.forEach((dept, index) => {
      if (!dept.name.trim()) {
        errors.departments = errors.departments || {};
        errors.departments[index] = errors.departments[index] || [];
        errors.departments[index].push('Department name is required');
      }
    });

    // Validate budget allocations
    const totalAllocatedPercent = builderState.budgetAllocations.reduce((sum, alloc) => sum + alloc.allocatedPercent, 0);
    if (totalAllocatedPercent > 100) {
      errors.budget = errors.budget || [];
      errors.budget.push('Total budget allocation exceeds 100%');
    }

    const isValid = Object.keys(errors).length === 0;
    return { isValid, errors };
  }, [builderState]);

  const handleStructureChange = (structure: GovernmentStructureInput) => {
    setBuilderState(prev => ({ ...prev, structure }));
  };

  const handleDepartmentsChange = (departments: DepartmentInput[]) => {
    setBuilderState(prev => ({ ...prev, departments }));
  };

  const handleBudgetChange = (budgetAllocations: BudgetAllocationInput[]) => {
    setBuilderState(prev => ({ ...prev, budgetAllocations }));
  };

  const handleRevenueChange = (revenueSources: RevenueSourceInput[]) => {
    setBuilderState(prev => ({ ...prev, revenueSources }));
  };

  const addDepartment = () => {
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
    setBuilderState(prev => ({
      ...prev,
      departments: [...prev.departments, newDepartment]
    }));
  };

  const removeDepartment = (index: number) => {
    setBuilderState(prev => ({
      ...prev,
      departments: prev.departments.filter((_, i) => i !== index)
    }));
  };

  const applyTemplate = (template: GovernmentTemplate) => {
    setBuilderState(prev => ({
      ...prev,
      structure: {
        ...prev.structure,
        governmentName: `${template.name} Government`,
        governmentType: template.governmentType,
        fiscalYear: template.fiscalYear
      },
      departments: template.departments.map(dept => ({
        ...dept,
        kpis: dept.kpis?.map(kpi => ({ ...kpi, currentValue: 0 })) || []
      })),
      budgetAllocations: template.departments.map(dept => ({
        departmentId: `temp-${dept.name}`,
        budgetYear: new Date().getFullYear(),
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
    setBuilderState(prev => ({ ...prev, ...validation }));
    
    if (validation.isValid) {
      setIsSaving(true);
      try {
        await onSave({ ...builderState, ...validation });
      } catch (error) {
        console.error('Save failed:', error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handlePreview = () => {
    const validation = validateState();
    setBuilderState(prev => ({ ...prev, ...validation }));
    
    if (onPreview) {
      onPreview({ ...builderState, ...validation });
    }
    setCurrentStep('preview');
  };

  const steps = [
    { id: 'structure', label: 'Government Structure', icon: Building2 },
    { id: 'departments', label: 'Departments', icon: Users },
    { id: 'budget', label: 'Budget Allocation', icon: DollarSign },
    { id: 'revenue', label: 'Revenue Sources', icon: Receipt },
    { id: 'preview', label: 'Preview & Save', icon: Eye }
  ];

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);
  const validation = validateState();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
            Government Builder
          </h1>
          <p className="text-[var(--color-text-muted)] mt-1">
            Design and configure your government structure, departments, and budget
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setShowTemplates(true)}
            disabled={isReadOnly}
          >
            Use Template
          </Button>
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={builderState.departments.length === 0}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button
            onClick={handleSave}
            disabled={!validation.isValid || isSaving || isReadOnly}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = index < currentStepIndex;
          
          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => setCurrentStep(step.id as any)}
                disabled={isReadOnly}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-[var(--color-brand-primary)] text-white'
                    : isCompleted
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                <StepIcon className="h-4 w-4" />
                <span className="text-sm font-medium">{step.label}</span>
                {isCompleted && <CheckCircle className="h-4 w-4" />}
              </button>
              {index < steps.length - 1 && (
                <ArrowRight className="h-4 w-4 mx-2 text-[var(--color-text-muted)]" />
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
              {Object.entries(validation.errors).map(([key, errors]) => (
                Array.isArray(errors) ? errors.map((error, index) => (
                  <li key={`${key}-${index}`} className="text-sm">{error}</li>
                )) : Object.entries(errors).map(([subKey, subErrors]) => (
                  <li key={`${key}-${subKey}`} className="text-sm">
                    Department {parseInt(subKey) + 1}: {Array.isArray(subErrors) ? subErrors.join(', ') : subErrors}
                  </li>
                ))
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Step Content */}
      <div className="space-y-6">
        {currentStep === 'structure' && (
          <GovernmentStructureForm
            data={builderState.structure}
            onChange={handleStructureChange}
            isReadOnly={isReadOnly}
          />
        )}

        {currentStep === 'departments' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
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
              {builderState.departments.map((department, index) => (
                <DepartmentForm
                  key={index}
                  data={department}
                  onChange={(updated) => {
                    const newDepartments = [...builderState.departments];
                    newDepartments[index] = updated;
                    handleDepartmentsChange(newDepartments);
                  }}
                  onDelete={() => removeDepartment(index)}
                  isReadOnly={isReadOnly}
                  availableParents={builderState.departments
                    .map((d, i) => ({ id: i.toString(), name: d.name }))
                    .filter((d, i) => i !== index)}
                />
              ))}

              {builderState.departments.length === 0 && (
                <Card className="border-2 border-dashed border-[var(--color-border-primary)]">
                  <CardContent className="p-8 text-center">
                    <Users className="h-12 w-12 mx-auto text-[var(--color-text-muted)] mb-4" />
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                      No Departments Yet
                    </h3>
                    <p className="text-[var(--color-text-muted)] mb-4">
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
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
              Budget Allocation
            </h2>

            {builderState.departments.length === 0 ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Add departments first before setting up budget allocations.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {builderState.departments.map((department, index) => {
                  const existingAllocation = builderState.budgetAllocations.find(
                    a => a.departmentId === index.toString()
                  );
                  const allocation: BudgetAllocationInput = existingAllocation || {
                    departmentId: index.toString(),
                    budgetYear: new Date().getFullYear(),
                    allocatedAmount: 0,
                    allocatedPercent: 0,
                    notes: ''
                  };

                  return (
                    <BudgetAllocationForm
                      key={index}
                      data={allocation}
                      onChange={(updated) => {
                        const newAllocations = [...builderState.budgetAllocations];
                        const existingIndex = newAllocations.findIndex(
                          a => a.departmentId === index.toString()
                        );
                        
                        if (existingIndex >= 0) {
                          newAllocations[existingIndex] = updated;
                        } else {
                          newAllocations.push(updated);
                        }
                        
                        handleBudgetChange(newAllocations);
                      }}
                      departmentName={department.name}
                      departmentColor={department.color}
                      totalBudget={builderState.structure.totalBudget}
                      currency={builderState.structure.budgetCurrency}
                      isReadOnly={isReadOnly}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {currentStep === 'revenue' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
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

        {currentStep === 'preview' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
              Government Overview
            </h2>

            {/* Mock preview with budget dashboard */}
            <BudgetManagementDashboard
              governmentStructure={{
                id: 'preview',
                countryId: 'preview',
                ...builderState.structure,
                createdAt: new Date(),
                updatedAt: new Date(),
                departments: [],
                budgetAllocations: [],
                revenueSources: []
              }}
              departments={builderState.departments.map((d, i) => ({
                id: i.toString(),
                governmentStructureId: 'preview',
                ...d,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                subDepartments: [],
                budgetAllocations: [],
                subBudgets: []
              }))}
              budgetAllocations={builderState.budgetAllocations.map(a => ({
                id: a.departmentId,
                governmentStructureId: 'preview',
                ...a,
                spentAmount: a.allocatedAmount * 0.8, // Mock spent amount
                encumberedAmount: a.allocatedAmount * 0.1,
                availableAmount: a.allocatedAmount * 0.1,
                budgetStatus: 'In Use' as const,
                lastReviewed: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                department: builderState.departments.find((_, i) => i.toString() === a.departmentId)! as any
              }))}
              revenueSources={builderState.revenueSources.map((r, i) => ({
                id: i.toString(),
                governmentStructureId: 'preview',
                ...r,
                isActive: true,
                revenuePercent: builderState.structure.totalBudget > 0 ? (r.revenueAmount / builderState.structure.totalBudget) * 100 : 0,
                createdAt: new Date(),
                updatedAt: new Date()
              }))}
              isReadOnly={true}
            />
          </div>
        )}
      </div>

      {/* Template Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-bg-primary)] rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
                Government Templates
              </h2>
              <Button variant="outline" onClick={() => setShowTemplates(false)}>
                Close
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {governmentTemplates.map((template, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle>{template.name}</CardTitle>
                    <p className="text-sm text-[var(--color-text-muted)]">{template.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <Badge variant="secondary">{template.governmentType}</Badge>
                        <Badge variant="outline" className="ml-2">{template.departments.length} Departments</Badge>
                      </div>
                      <div className="text-sm">
                        <strong>Departments:</strong>
                        <ul className="mt-1 text-[var(--color-text-muted)]">
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
      <div className="flex items-center justify-between pt-6 border-t border-[var(--color-border-primary)]">
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
            <Badge variant="default" className="bg-green-100 text-green-700">
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