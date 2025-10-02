"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { 
  Calculator, 
  Plus, 
  Save, 
  Eye, 
  AlertTriangle, 
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Settings,
  Receipt,
  DollarSign,
  Lightbulb,
  FileText,
  Zap
} from 'lucide-react';

// Import atomic components
import { TaxSystemForm } from './atoms/TaxSystemForm';
import { TaxCategoryForm } from './atoms/TaxCategoryForm';
import { TaxCalculator } from './atoms/TaxCalculator';
import { AtomicTaxEffectivenessPanel } from './AtomicTaxEffectivenessPanel';

// Import API integration
import { api } from '~/trpc/react';
import type { ComponentType } from '~/types/government';

import type { 
  TaxSystem,
  TaxSystemInput,
  TaxCategory,
  TaxCategoryInput,
  TaxBracket,
  TaxBracketInput,
  TaxExemption,
  TaxExemptionInput,
  TaxDeduction,
  TaxDeductionInput,
  TaxCalculationResult,
  TaxSystemTemplate
} from '~/types/tax-system';

export interface TaxBuilderState {
  taxSystem: TaxSystemInput;
  categories: TaxCategoryInput[];
  brackets: Record<string, TaxBracketInput[]>; // categoryIndex -> brackets
  exemptions: TaxExemptionInput[];
  deductions: Record<string, TaxDeductionInput[]>; // categoryIndex -> deductions
  isValid: boolean;
  errors: Record<string, any>;
}

interface TaxBuilderProps {
  initialData?: Partial<TaxBuilderState>;
  onSave: (data: TaxBuilderState) => Promise<void>;
  onPreview?: (data: TaxBuilderState) => void;
  isReadOnly?: boolean;
  countryId?: string;
  showAtomicIntegration?: boolean;
}

// Enhanced Tax System Templates with Atomic Components
const taxSystemTemplates: TaxSystemTemplate[] = [
  {
    name: 'Caphirian Imperial Tax System',
    description: 'Complex multi-tiered system based on Imperial administrative structure',
    fiscalYear: 'calendar',
    progressiveTax: true,
    categories: [
      {
        categoryName: 'Imperial Income Tax',
        categoryType: 'Direct Tax',
        description: 'Progressive tax on individual income with imperial service benefits',
        baseRate: 5,
        calculationMethod: 'progressive',
        brackets: [
          { minIncome: 0, maxIncome: 15000, rate: 0, marginalRate: true },
          { minIncome: 15000, maxIncome: 40000, rate: 8, marginalRate: true },
          { minIncome: 40000, maxIncome: 85000, rate: 18, marginalRate: true },
          { minIncome: 85000, maxIncome: 200000, rate: 28, marginalRate: true },
          { minIncome: 200000, maxIncome: 500000, rate: 38, marginalRate: true },
          { minIncome: 500000, rate: 45, marginalRate: true }
        ],
        exemptions: [
          { exemptionName: 'Imperial Service Exemption', exemptionType: 'Individual', description: 'Tax reduction for military/civil service', exemptionAmount: 8000 },
          { exemptionName: 'Provincial Resident Exemption', exemptionType: 'Geographic', description: 'Regional development incentive', exemptionAmount: 5000 }
        ],
        deductions: [
          { deductionName: 'Professional Development', deductionType: 'Itemized', description: 'Education and professional training expenses', maximumAmount: 12000 },
          { deductionName: 'Family Support', deductionType: 'Standard', description: 'Dependents and family care expenses', maximumAmount: 18000 }
        ]
      },
      {
        categoryName: 'Corporate Profits Tax',
        categoryType: 'Direct Tax',
        description: 'Tiered corporate tax with sector-specific rates',
        baseRate: 22,
        calculationMethod: 'tiered',
        brackets: [
          { minIncome: 0, maxIncome: 100000, rate: 15, marginalRate: false },
          { minIncome: 100000, maxIncome: 1000000, rate: 22, marginalRate: false },
          { minIncome: 1000000, rate: 28, marginalRate: false }
        ],
        exemptions: [
          { exemptionName: 'Strategic Industry Incentive', exemptionType: 'Sector', description: 'Reduced rates for key industries', exemptionRate: 30 },
          { exemptionName: 'Research & Development Credit', exemptionType: 'Corporate', description: 'R&D investment tax credit', exemptionRate: 25 }
        ]
      },
      {
        categoryName: 'Imperial Commerce Tax',
        categoryType: 'Indirect Tax',
        description: 'Comprehensive VAT with luxury surcharges',
        baseRate: 18,
        calculationMethod: 'percentage',
        brackets: [
          { minIncome: 0, maxIncome: 1000, rate: 8, marginalRate: false }, // Essential goods
          { minIncome: 1000, maxIncome: 10000, rate: 18, marginalRate: false }, // Standard goods
          { minIncome: 10000, rate: 35, marginalRate: false } // Luxury goods
        ]
      },
      {
        categoryName: 'Imperial Estate Tax',
        categoryType: 'Direct Tax',
        description: 'Progressive wealth transfer tax',
        baseRate: 25,
        calculationMethod: 'progressive',
        brackets: [
          { minIncome: 0, maxIncome: 500000, rate: 0, marginalRate: true },
          { minIncome: 500000, maxIncome: 2000000, rate: 25, marginalRate: true },
          { minIncome: 2000000, maxIncome: 10000000, rate: 40, marginalRate: true },
          { minIncome: 10000000, rate: 55, marginalRate: true }
        ]
      },
      {
        categoryName: 'Provincial Development Tax',
        categoryType: 'Direct Tax',
        description: 'Regional infrastructure and development funding',
        baseRate: 2,
        calculationMethod: 'percentage'
      }
    ]
  },
  {
    name: 'Progressive Tax System',
    description: 'Multi-bracket progressive system with standard deductions',
    fiscalYear: 'calendar',
    progressiveTax: true,
    categories: [
      {
        categoryName: 'Personal Income Tax',
        categoryType: 'Direct Tax',
        description: 'Tax on individual income',
        baseRate: 10,
        calculationMethod: 'progressive',
        brackets: [
          { minIncome: 0, maxIncome: 25000, rate: 10, marginalRate: true },
          { minIncome: 25000, maxIncome: 75000, rate: 22, marginalRate: true },
          { minIncome: 75000, maxIncome: 200000, rate: 32, marginalRate: true },
          { minIncome: 200000, rate: 37, marginalRate: true }
        ],
        exemptions: [
          { exemptionName: 'Standard Exemption', exemptionType: 'Individual', description: 'Standard personal exemption', exemptionAmount: 12000 }
        ],
        deductions: [
          { deductionName: 'Standard Deduction', deductionType: 'Standard', description: 'Standard deduction for all taxpayers', maximumAmount: 25000 }
        ]
      },
      {
        categoryName: 'Corporate Income Tax',
        categoryType: 'Direct Tax',
        description: 'Tax on corporate profits',
        baseRate: 21,
        calculationMethod: 'percentage',
        exemptions: [
          { exemptionName: 'Small Business Exemption', exemptionType: 'Corporate', description: 'Exemption for small businesses', exemptionAmount: 50000 }
        ]
      },
      {
        categoryName: 'Value Added Tax',
        categoryType: 'Indirect Tax',
        description: 'Tax on goods and services',
        baseRate: 15,
        calculationMethod: 'percentage'
      }
    ]
  },
  {
    name: 'Flat Tax System',
    description: 'Simple flat rate tax system',
    fiscalYear: 'calendar',
    progressiveTax: false,
    categories: [
      {
        categoryName: 'Personal Income Tax',
        categoryType: 'Direct Tax',
        description: 'Flat rate tax on all income',
        baseRate: 17,
        calculationMethod: 'percentage',
        exemptions: [
          { exemptionName: 'Personal Exemption', exemptionType: 'Individual', description: 'Basic personal exemption', exemptionAmount: 15000 }
        ]
      },
      {
        categoryName: 'Corporate Income Tax',
        categoryType: 'Direct Tax',
        description: 'Flat rate corporate tax',
        baseRate: 17,
        calculationMethod: 'percentage'
      }
    ]
  },
  {
    name: 'Nordic Social Democratic Model',
    description: 'High-tax, high-service comprehensive welfare state model',
    fiscalYear: 'calendar',
    progressiveTax: true,
    categories: [
      {
        categoryName: 'Personal Income Tax',
        categoryType: 'Direct Tax',
        description: 'Highly progressive with extensive social benefits',
        baseRate: 15,
        calculationMethod: 'progressive',
        brackets: [
          { minIncome: 0, maxIncome: 20000, rate: 15, marginalRate: true },
          { minIncome: 20000, maxIncome: 50000, rate: 28, marginalRate: true },
          { minIncome: 50000, maxIncome: 100000, rate: 42, marginalRate: true },
          { minIncome: 100000, rate: 55, marginalRate: true }
        ]
      },
      {
        categoryName: 'Social Security Tax',
        categoryType: 'Direct Tax',
        description: 'Comprehensive social insurance contributions',
        baseRate: 25,
        calculationMethod: 'percentage'
      },
      {
        categoryName: 'Value Added Tax',
        categoryType: 'Indirect Tax',
        description: 'High VAT with reduced rates for necessities',
        baseRate: 25,
        calculationMethod: 'tiered',
        brackets: [
          { minIncome: 0, maxIncome: 1000, rate: 6, marginalRate: false }, // Food, books
          { minIncome: 1000, maxIncome: 5000, rate: 12, marginalRate: false }, // Public transport
          { minIncome: 5000, rate: 25, marginalRate: false } // Standard rate
        ]
      }
    ]
  },
  {
    name: 'East Asian Developmental Model',
    description: 'Business-friendly system promoting economic growth',
    fiscalYear: 'calendar',
    progressiveTax: true,
    categories: [
      {
        categoryName: 'Personal Income Tax',
        categoryType: 'Direct Tax',
        description: 'Moderate progressive rates with high thresholds',
        baseRate: 8,
        calculationMethod: 'progressive',
        brackets: [
          { minIncome: 0, maxIncome: 30000, rate: 8, marginalRate: true },
          { minIncome: 30000, maxIncome: 80000, rate: 18, marginalRate: true },
          { minIncome: 80000, maxIncome: 200000, rate: 28, marginalRate: true },
          { minIncome: 200000, rate: 35, marginalRate: true }
        ]
      },
      {
        categoryName: 'Corporate Income Tax',
        categoryType: 'Direct Tax',
        description: 'Low corporate rates with generous incentives',
        baseRate: 17,
        calculationMethod: 'percentage',
        exemptions: [
          { exemptionName: 'High-Tech Industry Incentive', exemptionType: 'Sector', description: 'Reduced rates for technology companies', exemptionRate: 50 },
          { exemptionName: 'Export Business Credit', exemptionType: 'Corporate', description: 'Credits for export-oriented businesses', exemptionRate: 25 }
        ]
      },
      {
        categoryName: 'Consumption Tax',
        categoryType: 'Indirect Tax',
        description: 'Moderate consumption tax to encourage savings',
        baseRate: 10,
        calculationMethod: 'percentage'
      }
    ]
  }
];

export function TaxBuilder({ 
  initialData, 
  onSave, 
  onPreview, 
  isReadOnly = false,
  countryId,
  showAtomicIntegration = true
}: TaxBuilderProps) {
  const [currentStep, setCurrentStep] = useState<'system' | 'categories' | 'atomic' | 'calculator' | 'preview'>('system');
  const [builderState, setBuilderState] = useState<TaxBuilderState>({
    taxSystem: {
      taxSystemName: '',
      fiscalYear: 'calendar',
      progressiveTax: true,
      alternativeMinTax: false,
      complianceRate: 85,
      collectionEfficiency: 90,
      ...initialData?.taxSystem
    },
    categories: initialData?.categories || [],
    brackets: initialData?.brackets || {},
    exemptions: initialData?.exemptions || [],
    deductions: initialData?.deductions || {},
    isValid: false,
    errors: {}
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [calculationResult, setCalculationResult] = useState<TaxCalculationResult | null>(null);

  // Atomic component integration
  const { data: atomicComponents } = api.government.getComponents.useQuery(
    { countryId: countryId || '' },
    { 
      enabled: !!countryId && showAtomicIntegration,
      staleTime: 30000 
    }
  );

  const activeComponents = atomicComponents?.filter(c => c.isActive).map(c => c.componentType as ComponentType) || [];

  // Validation
  const validateState = useCallback((): { isValid: boolean; errors: any } => {
    const errors: any = {};

    // Validate tax system
    if (!builderState.taxSystem.taxSystemName.trim()) {
      errors.taxSystem = errors.taxSystem || [];
      errors.taxSystem.push('Tax system name is required');
    }

    if (!builderState.taxSystem.progressiveTax && !builderState.taxSystem.flatTaxRate) {
      errors.taxSystem = errors.taxSystem || [];
      errors.taxSystem.push('Flat tax rate is required when not using progressive taxation');
    }

    // Validate categories
    builderState.categories.forEach((category, index) => {
      if (!category.categoryName.trim()) {
        errors.categories = errors.categories || {};
        errors.categories[index] = errors.categories[index] || [];
        errors.categories[index].push('Category name is required');
      }

      if (!category.categoryType) {
        errors.categories = errors.categories || {};
        errors.categories[index] = errors.categories[index] || [];
        errors.categories[index].push('Category type is required');
      }

      if (category.calculationMethod === 'progressive') {
        const brackets = builderState.brackets[index.toString()] || [];
        if (brackets.length === 0) {
          errors.categories = errors.categories || {};
          errors.categories[index] = errors.categories[index] || [];
          errors.categories[index].push('Progressive categories need at least one bracket');
        }
      }
    });

    // Validate brackets
    Object.entries(builderState.brackets).forEach(([categoryIndex, brackets]) => {
      brackets.forEach((bracket, bracketIndex) => {
        if (bracket.rate < 0 || bracket.rate > 100) {
          errors.brackets = errors.brackets || {};
          errors.brackets[categoryIndex] = errors.brackets[categoryIndex] || {};
          errors.brackets[categoryIndex][bracketIndex] = errors.brackets[categoryIndex][bracketIndex] || [];
          errors.brackets[categoryIndex][bracketIndex].push('Tax rate must be between 0 and 100');
        }

        if (bracket.maxIncome && bracket.minIncome >= bracket.maxIncome) {
          errors.brackets = errors.brackets || {};
          errors.brackets[categoryIndex] = errors.brackets[categoryIndex] || {};
          errors.brackets[categoryIndex][bracketIndex] = errors.brackets[categoryIndex][bracketIndex] || [];
          errors.brackets[categoryIndex][bracketIndex].push('Maximum income must be greater than minimum income');
        }
      });
    });

    const isValid = Object.keys(errors).length === 0;
    return { isValid, errors };
  }, [builderState]);

  const handleTaxSystemChange = (taxSystem: TaxSystemInput) => {
    setBuilderState(prev => ({ ...prev, taxSystem }));
  };

  const handleCategoriesChange = (categories: TaxCategoryInput[]) => {
    setBuilderState(prev => ({ ...prev, categories }));
  };

  const handleBracketsChange = (categoryIndex: string, brackets: TaxBracketInput[]) => {
    setBuilderState(prev => ({
      ...prev,
      brackets: { ...prev.brackets, [categoryIndex]: brackets }
    }));
  };

  const handleExemptionsChange = (exemptions: TaxExemptionInput[]) => {
    setBuilderState(prev => ({ ...prev, exemptions }));
  };

  const handleDeductionsChange = (categoryIndex: string, deductions: TaxDeductionInput[]) => {
    setBuilderState(prev => ({
      ...prev,
      deductions: { ...prev.deductions, [categoryIndex]: deductions }
    }));
  };

  const addCategory = () => {
    const newCategory: TaxCategoryInput = {
      categoryName: 'Personal Income Tax',
      categoryType: 'Direct Tax',
      description: '',
      isActive: true,
      calculationMethod: 'percentage',
      baseRate: 10,
      deductionAllowed: true,
      priority: 50,
      color: '#3b82f6'
    };

    setBuilderState(prev => ({
      ...prev,
      categories: [...prev.categories, newCategory]
    }));
  };

  const removeCategory = (index: number) => {
    setBuilderState(prev => {
      const newCategories = prev.categories.filter((_, i) => i !== index);
      const newBrackets = { ...prev.brackets };
      const newDeductions = { ...prev.deductions };
      
      // Remove associated brackets and deductions
      delete newBrackets[index.toString()];
      delete newDeductions[index.toString()];
      
      // Reindex remaining brackets and deductions
      const reindexedBrackets: Record<string, TaxBracketInput[]> = {};
      const reindexedDeductions: Record<string, TaxDeductionInput[]> = {};
      
      Object.entries(newBrackets).forEach(([oldIndex, brackets]) => {
        const numIndex = parseInt(oldIndex);
        if (numIndex > index) {
          reindexedBrackets[(numIndex - 1).toString()] = brackets;
        } else if (numIndex < index) {
          reindexedBrackets[oldIndex] = brackets;
        }
      });

      Object.entries(newDeductions).forEach(([oldIndex, deductions]) => {
        const numIndex = parseInt(oldIndex);
        if (numIndex > index) {
          reindexedDeductions[(numIndex - 1).toString()] = deductions;
        } else if (numIndex < index) {
          reindexedDeductions[oldIndex] = deductions;
        }
      });

      return {
        ...prev,
        categories: newCategories,
        brackets: reindexedBrackets,
        deductions: reindexedDeductions
      };
    });
  };

  const applyTemplate = (template: TaxSystemTemplate) => {
    const newState: Partial<TaxBuilderState> = {
      taxSystem: {
        taxSystemName: `${template.name} for ${countryId || 'Country'}`,
        fiscalYear: template.fiscalYear,
        progressiveTax: template.progressiveTax,
        alternativeMinTax: false,
        complianceRate: 85,
        collectionEfficiency: 90
      },
      categories: template.categories.map(cat => ({
        categoryName: cat.categoryName,
        categoryType: cat.categoryType,
        description: cat.description,
        isActive: true,
        baseRate: cat.baseRate,
        calculationMethod: cat.calculationMethod,
        deductionAllowed: true,
        priority: 50,
        color: '#3b82f6'
      })),
      brackets: {},
      exemptions: [],
      deductions: {}
    };

    // Set up brackets
    template.categories.forEach((cat, catIndex) => {
      if (cat.brackets) {
        newState.brackets![catIndex.toString()] = cat.brackets.map(bracket => ({
          bracketName: bracket.bracketName,
          minIncome: bracket.minIncome,
          maxIncome: bracket.maxIncome,
          rate: bracket.rate,
          marginalRate: bracket.marginalRate,
          isActive: true,
          priority: 50
        }));
      }
    });

    setBuilderState(prev => ({ ...prev, ...newState }));
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

  // Convert builder state to calculator format
  const mockTaxSystem: TaxSystem = useMemo(() => ({
    id: 'builder-preview',
    countryId: countryId || 'preview',
    ...builderState.taxSystem,
    createdAt: new Date(),
    updatedAt: new Date()
  }), [builderState.taxSystem, countryId]);

  const mockCategories: TaxCategory[] = useMemo(() => 
    builderState.categories.map((cat, index) => ({
      id: `category-${index}`,
      taxSystemId: 'builder-preview',
      ...cat,
      createdAt: new Date(),
      updatedAt: new Date()
    }))
  , [builderState.categories]);

  const mockBrackets: TaxBracket[] = useMemo(() => {
    const brackets: TaxBracket[] = [];
    Object.entries(builderState.brackets).forEach(([categoryIndex, categoryBrackets]) => {
      categoryBrackets.forEach((bracket, bracketIndex) => {
        brackets.push({
          id: `bracket-${categoryIndex}-${bracketIndex}`,
          taxSystemId: 'builder-preview',
          categoryId: `category-${categoryIndex}`,
          ...bracket,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      });
    });
    return brackets;
  }, [builderState.brackets]);

  const steps = [
    { id: 'system', label: 'Tax System', icon: Settings },
    { id: 'categories', label: 'Tax Categories', icon: Receipt },
    ...(showAtomicIntegration ? [{ id: 'atomic', label: 'Atomic Integration', icon: Zap }] : []),
    { id: 'calculator', label: 'Calculator', icon: Calculator },
    { id: 'preview', label: 'Preview & Save', icon: Eye }
  ];

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);
  const validation = validateState();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Tax System Builder
          </h1>
          <p className="text-muted-foreground mt-1">
            Design and configure your country's taxation system
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
            disabled={builderState.categories.length === 0}
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
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
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
                    ? 'bg-primary text-primary-foreground'
                    : isCompleted
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                      : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                <StepIcon className="h-4 w-4" />
                <span className="text-sm font-medium">{step.label}</span>
                {isCompleted && <CheckCircle className="h-4 w-4" />}
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
              {Object.entries(validation.errors).map(([key, errors]) => (
                Array.isArray(errors) ? errors.map((error, index) => (
                  <li key={`${key}-${index}`} className="text-sm">{error}</li>
                )) : Object.entries(errors as Record<string, unknown>).map(([subKey, subErrors]) => (
                  <li key={`${key}-${subKey}`} className="text-sm">
                    {key === 'categories' ? `Category ${parseInt(subKey) + 1}: ` : ''}
                    {Array.isArray(subErrors) ? subErrors.join(', ') : (subErrors as string)}
                  </li>
                ))
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Step Content */}
      <div className="space-y-6">
        {currentStep === 'system' && (
          <TaxSystemForm
            data={builderState.taxSystem}
            onChange={handleTaxSystemChange}
            isReadOnly={isReadOnly}
            errors={validation.errors.taxSystem ? { taxSystem: validation.errors.taxSystem } : {}}
          />
        )}

        {currentStep === 'categories' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-foreground">
                Tax Categories
              </h2>
              {!isReadOnly && (
                <Button onClick={addCategory}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              )}
            </div>

            <div className="space-y-4">
              {builderState.categories.map((category, index) => (
                <TaxCategoryForm
                  key={index}
                  data={category}
                  onChange={(updated) => {
                    const newCategories = [...builderState.categories];
                    newCategories[index] = updated;
                    handleCategoriesChange(newCategories);
                  }}
                  onDelete={() => removeCategory(index)}
                  isReadOnly={isReadOnly}
                  showBrackets={true}
                  brackets={builderState.brackets[index.toString()] || []}
                  onBracketsChange={(brackets) => handleBracketsChange(index.toString(), brackets)}
                  categoryIndex={index}
                  errors={validation.errors.categories?.[index] ? { category: validation.errors.categories[index] } : {}}
                />
              ))}

              {builderState.categories.length === 0 && (
                <Card className="border-2 border-dashed">
                  <CardContent className="p-8 text-center">
                    <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      No Tax Categories Yet
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Add tax categories to define how different types of income are taxed
                    </p>
                    {!isReadOnly && (
                      <Button onClick={addCategory}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Category
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {currentStep === 'atomic' && showAtomicIntegration && (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">Atomic Tax Effectiveness</h2>
              <p className="text-muted-foreground">
                See how your government's atomic components influence tax collection and compliance
              </p>
            </div>

            <AtomicTaxEffectivenessPanel
              components={activeComponents}
              baseTaxSystem={{
                collectionEfficiency: builderState.taxSystem.collectionEfficiency || 90,
                complianceRate: builderState.taxSystem.complianceRate || 85,
                auditCapacity: 60
              }}
              showDetailedBreakdown={true}
            />

            {activeComponents.length === 0 && countryId && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="p-6 text-center">
                  <AlertTriangle className="h-12 w-12 mx-auto text-yellow-600 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Government Components</h3>
                  <p className="text-muted-foreground mb-4">
                    Add atomic government components to see their impact on tax effectiveness.
                  </p>
                  <Button variant="outline" onClick={() => window.open('/mycountry/editor#government', '_blank')}>
                    Configure Government Components
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {currentStep === 'calculator' && (
          <TaxCalculator
            taxSystem={mockTaxSystem}
            categories={mockCategories}
            brackets={mockBrackets}
            exemptions={[]}
            deductions={[]}
            onCalculationChange={setCalculationResult}
          />
        )}

        {currentStep === 'preview' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">Tax System Preview</h2>
            
            {/* System Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  {builderState.taxSystem.taxSystemName || 'Untitled Tax System'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">System Type</div>
                    <div className="font-medium">
                      {builderState.taxSystem.progressiveTax ? 'Progressive' : 'Flat'} Tax System
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Fiscal Year</div>
                    <div className="font-medium capitalize">
                      {builderState.taxSystem.fiscalYear.replace('-', ' - ')}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Categories</div>
                    <div className="font-medium">{builderState.categories.length}</div>
                  </div>
                </div>

                {builderState.taxSystem.alternativeMinTax && (
                  <Alert>
                    <Lightbulb className="h-4 w-4" />
                    <AlertDescription>
                      Alternative Minimum Tax is enabled at {builderState.taxSystem.alternativeMinRate}%
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Categories Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Tax Categories Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {builderState.categories.map((category, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <div className="font-medium">{category.categoryName}</div>
                        <div className="text-sm text-muted-foreground">
                          {category.categoryType} • {category.calculationMethod}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">
                          {category.baseRate}% base rate
                        </Badge>
                        {builderState.brackets[index.toString()]?.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {builderState.brackets[index.toString()].length} brackets
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tax Calculator Preview */}
            {calculationResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Sample Calculation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Effective Rate</div>
                      <div className="text-2xl font-semibold">
                        {calculationResult.effectiveRate.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Marginal Rate</div>
                      <div className="text-2xl font-semibold">
                        {calculationResult.marginalRate.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Tax Categories</div>
                      <div className="text-2xl font-semibold">
                        {calculationResult.breakdown.length}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Template Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-foreground">
                Tax System Templates
              </h2>
              <Button variant="outline" onClick={() => setShowTemplates(false)}>
                Close
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {taxSystemTemplates.map((template, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle>{template.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <Badge variant="secondary">
                          {template.progressiveTax ? 'Progressive' : 'Flat'} Tax
                        </Badge>
                        <Badge variant="outline" className="ml-2">
                          {template.categories.length} Categories
                        </Badge>
                      </div>
                      <div className="text-sm">
                        <strong>Categories:</strong>
                        <ul className="mt-1 text-muted-foreground">
                          {template.categories.slice(0, 3).map(cat => (
                            <li key={cat.categoryName}>• {cat.categoryName} ({cat.baseRate}%)</li>
                          ))}
                          {template.categories.length > 3 && (
                            <li>• +{template.categories.length - 3} more...</li>
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