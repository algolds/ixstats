"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge as UIBadge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Separator } from "~/components/ui/separator";
import {
  Calculator,
  Plus,
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
  Zap,
  Info,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react";
import { useTaxBuilderAutoSync } from "~/hooks/useBuilderAutoSync";
import {
  ConflictWarningDialog,
  SyncStatusIndicator,
} from "~/components/builders/ConflictWarningDialog";
import {
  GlobalBuilderNavigation,
  type BuilderStep,
} from "~/components/builders/GlobalBuilderNavigation";
// Dev-only logger to avoid noisy logs in production
const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

// Import atomic components
import { TaxSystemForm } from "./atoms/TaxSystemForm";
import { TaxCategoryForm } from "./atoms/TaxCategoryForm";
import { TaxCalculator } from "./atoms/TaxCalculator";
import { AtomicTaxEffectivenessPanel } from "./AtomicTaxEffectivenessPanel";
import { SuggestionsPanel, type SuggestionItem } from "~/components/builders/SuggestionsPanel";
import { computeTaxSuggestions } from "~/components/builders/suggestions/utils";
import { useIntelligenceWebSocket } from "~/hooks/useIntelligenceWebSocket";
import { parseEconomicDataForTaxSystem } from "~/lib/tax-data-parser";
import { AtomicComponentSelector } from "~/components/government/atoms/AtomicGovernmentComponents";
import { AtomicTaxComponentSelector } from "./atoms/AtomicTaxComponents";
import { TaxEconomySyncDisplay } from "./TaxEconomySyncDisplay";
import { UnifiedTaxEffectivenessDisplay } from "./UnifiedTaxEffectivenessDisplay";

// Import API integration
import { api } from "~/trpc/react";
import { toast } from "sonner";
import type { ComponentType } from "~/types/government";
import { revenueTaxIntegrationService } from "~/app/builder/services/RevenueTaxIntegrationService";
import { bidirectionalTaxSyncService } from "~/app/builder/services/BidirectionalTaxSyncService";
import type { EconomyBuilderState } from "~/types/economy-builder";

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
  TaxSystemTemplate,
} from "~/types/tax-system";
import { CALCULATION_METHODS } from "~/types/tax-system";

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
  onSave?: (data: TaxBuilderState) => Promise<void>;
  onChange?: (data: TaxBuilderState) => void;
  onPreview?: (data: TaxBuilderState) => void;
  isReadOnly?: boolean;
  countryId?: string;
  showAtomicIntegration?: boolean;
  hideSaveButton?: boolean;
  enableAutoSync?: boolean;
  economicData?: {
    gdp: number;
    sectors: any;
    population: number;
  };
  governmentData?: any;
}

// Enhanced Tax System Templates with Atomic Components
const taxSystemTemplates: TaxSystemTemplate[] = [
  {
    name: "Caphirian Imperial Tax System",
    description: "Complex multi-tiered system based on Imperial administrative structure",
    fiscalYear: "calendar",
    progressiveTax: true,
    categories: [
      {
        categoryName: "Imperial Income Tax",
        categoryType: "Direct Tax",
        description: "Progressive tax on individual income with imperial service benefits",
        baseRate: 5,
        calculationMethod: CALCULATION_METHODS.PROGRESSIVE,
        brackets: [
          { minIncome: 0, maxIncome: 15000, rate: 0, marginalRate: true },
          { minIncome: 15000, maxIncome: 40000, rate: 8, marginalRate: true },
          { minIncome: 40000, maxIncome: 85000, rate: 18, marginalRate: true },
          { minIncome: 85000, maxIncome: 200000, rate: 28, marginalRate: true },
          { minIncome: 200000, maxIncome: 500000, rate: 38, marginalRate: true },
          { minIncome: 500000, rate: 45, marginalRate: true },
        ],
        exemptions: [
          {
            exemptionName: "Imperial Service Exemption",
            exemptionType: "Individual",
            description: "Tax reduction for military/civil service",
            exemptionAmount: 8000,
          },
          {
            exemptionName: "Provincial Resident Exemption",
            exemptionType: "Geographic",
            description: "Regional development incentive",
            exemptionAmount: 5000,
          },
        ],
        deductions: [
          {
            deductionName: "Professional Development",
            deductionType: "Itemized",
            description: "Education and professional training expenses",
            maximumAmount: 12000,
          },
          {
            deductionName: "Family Support",
            deductionType: "Standard",
            description: "Dependents and family care expenses",
            maximumAmount: 18000,
          },
        ],
      },
      {
        categoryName: "Corporate Profits Tax",
        categoryType: "Direct Tax",
        description: "Tiered corporate tax with sector-specific rates",
        baseRate: 22,
        calculationMethod: CALCULATION_METHODS.TIERED,
        brackets: [
          { minIncome: 0, maxIncome: 100000, rate: 15, marginalRate: false },
          { minIncome: 100000, maxIncome: 1000000, rate: 22, marginalRate: false },
          { minIncome: 1000000, rate: 28, marginalRate: false },
        ],
        exemptions: [
          {
            exemptionName: "Strategic Industry Incentive",
            exemptionType: "Sector",
            description: "Reduced rates for key industries",
            exemptionRate: 30,
          },
          {
            exemptionName: "Research & Development Credit",
            exemptionType: "Corporate",
            description: "R&D investment tax credit",
            exemptionRate: 25,
          },
        ],
      },
      {
        categoryName: "Imperial Commerce Tax",
        categoryType: "Indirect Tax",
        description: "Comprehensive VAT with luxury surcharges",
        baseRate: 18,
        calculationMethod: CALCULATION_METHODS.PERCENTAGE,
        brackets: [
          { minIncome: 0, maxIncome: 1000, rate: 8, marginalRate: false }, // Essential goods
          { minIncome: 1000, maxIncome: 10000, rate: 18, marginalRate: false }, // Standard goods
          { minIncome: 10000, rate: 35, marginalRate: false }, // Luxury goods
        ],
      },
      {
        categoryName: "Imperial Estate Tax",
        categoryType: "Direct Tax",
        description: "Progressive wealth transfer tax",
        baseRate: 25,
        calculationMethod: CALCULATION_METHODS.PROGRESSIVE,
        brackets: [
          { minIncome: 0, maxIncome: 500000, rate: 0, marginalRate: true },
          { minIncome: 500000, maxIncome: 2000000, rate: 25, marginalRate: true },
          { minIncome: 2000000, maxIncome: 10000000, rate: 40, marginalRate: true },
          { minIncome: 10000000, rate: 55, marginalRate: true },
        ],
      },
      {
        categoryName: "Provincial Development Tax",
        categoryType: "Direct Tax",
        description: "Regional infrastructure and development funding",
        baseRate: 2,
        calculationMethod: CALCULATION_METHODS.PERCENTAGE,
      },
    ],
  },
  {
    name: "Progressive Tax System",
    description: "Multi-bracket progressive system with standard deductions",
    fiscalYear: "calendar",
    progressiveTax: true,
    categories: [
      {
        categoryName: "Personal Income Tax",
        categoryType: "Direct Tax",
        description: "Tax on individual income",
        baseRate: 10,
        calculationMethod: CALCULATION_METHODS.PROGRESSIVE,
        brackets: [
          { minIncome: 0, maxIncome: 25000, rate: 10, marginalRate: true },
          { minIncome: 25000, maxIncome: 75000, rate: 22, marginalRate: true },
          { minIncome: 75000, maxIncome: 200000, rate: 32, marginalRate: true },
          { minIncome: 200000, rate: 37, marginalRate: true },
        ],
        exemptions: [
          {
            exemptionName: "Standard Exemption",
            exemptionType: "Individual",
            description: "Standard personal exemption",
            exemptionAmount: 12000,
          },
        ],
        deductions: [
          {
            deductionName: "Standard Deduction",
            deductionType: "Standard",
            description: "Standard deduction for all taxpayers",
            maximumAmount: 25000,
          },
        ],
      },
      {
        categoryName: "Corporate Income Tax",
        categoryType: "Direct Tax",
        description: "Tax on corporate profits",
        baseRate: 21,
        calculationMethod: CALCULATION_METHODS.PERCENTAGE,
        exemptions: [
          {
            exemptionName: "Small Business Exemption",
            exemptionType: "Corporate",
            description: "Exemption for small businesses",
            exemptionAmount: 50000,
          },
        ],
      },
      {
        categoryName: "Value Added Tax",
        categoryType: "Indirect Tax",
        description: "Tax on goods and services",
        baseRate: 15,
        calculationMethod: CALCULATION_METHODS.PERCENTAGE,
      },
    ],
  },
  {
    name: "Flat Tax System",
    description: "Simple flat rate tax system",
    fiscalYear: "calendar",
    progressiveTax: false,
    categories: [
      {
        categoryName: "Personal Income Tax",
        categoryType: "Direct Tax",
        description: "Flat rate tax on all income",
        baseRate: 17,
        calculationMethod: CALCULATION_METHODS.PERCENTAGE,
        exemptions: [
          {
            exemptionName: "Personal Exemption",
            exemptionType: "Individual",
            description: "Basic personal exemption",
            exemptionAmount: 15000,
          },
        ],
      },
      {
        categoryName: "Corporate Income Tax",
        categoryType: "Direct Tax",
        description: "Flat rate corporate tax",
        baseRate: 17,
        calculationMethod: CALCULATION_METHODS.PERCENTAGE,
      },
    ],
  },
  {
    name: "Nordic Social Democratic Model",
    description: "High-tax, high-service comprehensive welfare state model",
    fiscalYear: "calendar",
    progressiveTax: true,
    categories: [
      {
        categoryName: "Personal Income Tax",
        categoryType: "Direct Tax",
        description: "Highly progressive with extensive social benefits",
        baseRate: 15,
        calculationMethod: CALCULATION_METHODS.PROGRESSIVE,
        brackets: [
          { minIncome: 0, maxIncome: 20000, rate: 15, marginalRate: true },
          { minIncome: 20000, maxIncome: 50000, rate: 28, marginalRate: true },
          { minIncome: 50000, maxIncome: 100000, rate: 42, marginalRate: true },
          { minIncome: 100000, rate: 55, marginalRate: true },
        ],
      },
      {
        categoryName: "Social Security Tax",
        categoryType: "Direct Tax",
        description: "Comprehensive social insurance contributions",
        baseRate: 25,
        calculationMethod: CALCULATION_METHODS.PERCENTAGE,
      },
      {
        categoryName: "Value Added Tax",
        categoryType: "Indirect Tax",
        description: "High VAT with reduced rates for necessities",
        baseRate: 25,
        calculationMethod: CALCULATION_METHODS.TIERED,
        brackets: [
          { minIncome: 0, maxIncome: 1000, rate: 6, marginalRate: false }, // Food, books
          { minIncome: 1000, maxIncome: 5000, rate: 12, marginalRate: false }, // Public transport
          { minIncome: 5000, rate: 25, marginalRate: false }, // Standard rate
        ],
      },
    ],
  },
  {
    name: "East Asian Developmental Model",
    description: "Business-friendly system promoting economic growth",
    fiscalYear: "calendar",
    progressiveTax: true,
    categories: [
      {
        categoryName: "Personal Income Tax",
        categoryType: "Direct Tax",
        description: "Moderate progressive rates with high thresholds",
        baseRate: 8,
        calculationMethod: CALCULATION_METHODS.PROGRESSIVE,
        brackets: [
          { minIncome: 0, maxIncome: 30000, rate: 8, marginalRate: true },
          { minIncome: 30000, maxIncome: 80000, rate: 18, marginalRate: true },
          { minIncome: 80000, maxIncome: 200000, rate: 28, marginalRate: true },
          { minIncome: 200000, rate: 35, marginalRate: true },
        ],
      },
      {
        categoryName: "Corporate Income Tax",
        categoryType: "Direct Tax",
        description: "Low corporate rates with generous incentives",
        baseRate: 17,
        calculationMethod: CALCULATION_METHODS.PERCENTAGE,
        exemptions: [
          {
            exemptionName: "High-Tech Industry Incentive",
            exemptionType: "Sector",
            description: "Reduced rates for technology companies",
            exemptionRate: 50,
          },
          {
            exemptionName: "Export Business Credit",
            exemptionType: "Corporate",
            description: "Credits for export-oriented businesses",
            exemptionRate: 25,
          },
        ],
      },
      {
        categoryName: "Consumption Tax",
        categoryType: "Indirect Tax",
        description: "Moderate consumption tax to encourage savings",
        baseRate: 10,
        calculationMethod: CALCULATION_METHODS.PERCENTAGE,
      },
    ],
  },
];

export function TaxBuilder({
  initialData,
  onSave,
  onChange,
  onPreview,
  isReadOnly = false,
  countryId,
  showAtomicIntegration = true,
  hideSaveButton = false,
  enableAutoSync = false,
  economicData,
  governmentData,
}: TaxBuilderProps) {
  const [currentStep, setCurrentStep] = useState<
    "atomic" | "configuration" | "exemptions" | "calculator"
  >("atomic");
  const [localBuilderState, setLocalBuilderState] = useState<TaxBuilderState>({
    taxSystem: {
      taxSystemName: "",
      fiscalYear: "calendar",
      progressiveTax: true,
      alternativeMinTax: false,
      complianceRate: 85,
      collectionEfficiency: 90,
      ...initialData?.taxSystem,
    },
    categories: initialData?.categories || [],
    brackets: initialData?.brackets || {},
    exemptions: initialData?.exemptions || [],
    deductions: initialData?.deductions || {},
    isValid: false,
    errors: {},
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [calculationResult, setCalculationResult] = useState<TaxCalculationResult | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [pendingSaveCallback, setPendingSaveCallback] = useState<(() => void) | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [selectedTaxComponents, setSelectedTaxComponents] = useState<ComponentType[]>([]);
  const [selectedAtomicTaxComponents, setSelectedAtomicTaxComponents] = useState<string[]>([]);
  const [parsedDataApplied, setParsedDataApplied] = useState(false);
  const [revenueAutoPopulated, setRevenueAutoPopulated] = useState(false);
  const [syncedCategoryIndices, setSyncedCategoryIndices] = useState<Set<number>>(new Set());

  // Collapsible state for preview sections
  const [isSystemDetailsOpen, setIsSystemDetailsOpen] = useState(true);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(true);
  const [isCalculationOpen, setIsCalculationOpen] = useState(false);
  const [openCategoryDetails, setOpenCategoryDetails] = useState<Record<string, boolean>>({});

  // Local save mutations (fallback when onSave is not provided)
  const createMutation = api.taxSystem.create.useMutation();
  const updateMutation = api.taxSystem.update.useMutation();

  // Use auto-sync hook if enabled
  const {
    builderState: autoSyncState,
    setBuilderState: setAutoSyncState,
    syncState,
    triggerSync,
    clearConflicts,
  } = useTaxBuilderAutoSync(countryId, localBuilderState, {
    enabled: enableAutoSync && !!countryId,
    showConflictWarnings: true,
    onConflictDetected: (warnings) => {
      if (warnings.some((w) => w.severity === "critical" || w.severity === "warning")) {
        setShowConflictDialog(true);
      }
    },
    onSyncSuccess: (result) => {
      devLog("Auto-sync successful:", result);
    },
    onSyncError: (error) => {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.error("Auto-sync error:", error);
      }
    },
  });

  // Use auto-sync state if enabled, otherwise use local state
  const builderState = enableAutoSync && countryId ? autoSyncState : localBuilderState;
  const setBuilderState = useCallback(
    (update: React.SetStateAction<TaxBuilderState>) => {
      if (enableAutoSync && countryId) {
        setAutoSyncState(update);
      } else {
        setLocalBuilderState(update);
      }
    },
    [enableAutoSync, countryId, setAutoSyncState, setLocalBuilderState]
  );

  // Atomic component integration
  const { data: atomicComponents } = api.government.getComponents.useQuery(
    { countryId: countryId || "" },
    {
      enabled: !!countryId && showAtomicIntegration,
      staleTime: 30000,
    }
  );

  const activeComponents =
    atomicComponents?.filter((c) => c.isActive).map((c) => c.componentType) || [];

  // Validation (expanded)
  const validateState = useCallback((): { isValid: boolean; errors: any } => {
    const errors: any = {};
    const taxSystemFieldErrors: Record<string, string[]> = {};

    // Tax system
    if (!builderState.taxSystem.taxSystemName?.trim()) {
      taxSystemFieldErrors.taxSystemName = ["Tax system name is required"];
    }
    if (!builderState.taxSystem.fiscalYear) {
      taxSystemFieldErrors.fiscalYear = ["Fiscal year is required"];
    }
    if (
      !builderState.taxSystem.progressiveTax &&
      (builderState.taxSystem.flatTaxRate === undefined ||
        builderState.taxSystem.flatTaxRate === null)
    ) {
      taxSystemFieldErrors.flatTaxRate = [
        "Flat tax rate is required when not using progressive taxation",
      ];
    }
    if (
      builderState.taxSystem.flatTaxRate !== undefined &&
      (builderState.taxSystem.flatTaxRate < 0 || builderState.taxSystem.flatTaxRate > 100)
    ) {
      taxSystemFieldErrors.flatTaxRate = ["Flat tax rate must be between 0 and 100"];
    }
    if (
      builderState.taxSystem.alternativeMinTax &&
      (builderState.taxSystem.alternativeMinRate === undefined ||
        builderState.taxSystem.alternativeMinRate === null)
    ) {
      taxSystemFieldErrors.alternativeMinRate = ["AMT rate is required when AMT is enabled"];
    }
    if (Object.keys(taxSystemFieldErrors).length > 0) {
      errors.taxSystem = taxSystemFieldErrors;
    }

    // Categories
    builderState.categories.forEach((category, index) => {
      const catErrors: string[] = [];
      if (!category.categoryName?.trim()) catErrors.push("Category name is required");
      if (!category.categoryType) catErrors.push("Category type is required");
      if (!category.calculationMethod) catErrors.push("Calculation method is required");
      if (category.baseRate !== undefined && (category.baseRate < 0 || category.baseRate > 100))
        catErrors.push("Base rate must be between 0 and 100");
      if (category.calculationMethod === "progressive") {
        const brackets = builderState.brackets[index.toString()] || [];
        if (brackets.length === 0)
          catErrors.push("Progressive categories need at least one bracket");
      }
      if (catErrors.length > 0) {
        errors.categories = errors.categories || {};
        errors.categories[index] = catErrors;
      }
    });

    // Brackets
    Object.entries(builderState.brackets).forEach(([categoryIndex, brackets]) => {
      const sorted = [...brackets].sort((a, b) => a.minIncome - b.minIncome);
      for (let i = 0; i < sorted.length; i++) {
        const bracket = sorted[i]!;
        if (bracket.rate < 0 || bracket.rate > 100) {
          errors.brackets = errors.brackets || {};
          errors.brackets[categoryIndex] = errors.brackets[categoryIndex] || {};
          errors.brackets[categoryIndex][i] = errors.brackets[categoryIndex][i] || [];
          errors.brackets[categoryIndex][i].push("Tax rate must be between 0 and 100");
        }
        if (bracket.maxIncome !== undefined && bracket.minIncome >= bracket.maxIncome) {
          errors.brackets = errors.brackets || {};
          errors.brackets[categoryIndex] = errors.brackets[categoryIndex] || {};
          errors.brackets[categoryIndex][i] = errors.brackets[categoryIndex][i] || [];
          errors.brackets[categoryIndex][i].push(
            "Maximum income must be greater than minimum income"
          );
        }
        if (i > 0) {
          const prev = sorted[i - 1]!;
          const prevEnd = prev.maxIncome ?? Number.POSITIVE_INFINITY;
          if (bracket.minIncome < prevEnd) {
            errors.brackets = errors.brackets || {};
            errors.brackets[categoryIndex] = errors.brackets[categoryIndex] || {};
            errors.brackets[categoryIndex][i] = errors.brackets[categoryIndex][i] || [];
            errors.brackets[categoryIndex][i].push("Bracket overlaps previous bracket");
          }
        }
      }
    });

    const isValid = Object.keys(errors).length === 0;
    return { isValid, errors };
  }, [builderState]);

  const handleTaxSystemChange = (taxSystem: TaxSystemInput) => {
    setBuilderState((prev: TaxBuilderState) => ({ ...prev, taxSystem }));
  };

  const handleCategoriesChange = (categories: TaxCategoryInput[]) => {
    setBuilderState((prev: TaxBuilderState) => ({ ...prev, categories }));
  };

  const handleBracketsChange = (categoryIndex: string, brackets: TaxBracketInput[]) => {
    setBuilderState((prev: TaxBuilderState) => ({
      ...prev,
      brackets: { ...prev.brackets, [categoryIndex]: brackets },
    }));
  };

  const handleExemptionsChange = (exemptions: TaxExemptionInput[]) => {
    setBuilderState((prev: TaxBuilderState) => ({ ...prev, exemptions }));
  };

  const handleDeductionsChange = (categoryIndex: string, deductions: TaxDeductionInput[]) => {
    setBuilderState((prev: TaxBuilderState) => ({
      ...prev,
      deductions: { ...prev.deductions, [categoryIndex]: deductions },
    }));
  };

  const addCategory = () => {
    const newCategory: TaxCategoryInput = {
      categoryName: "Personal Income Tax",
      categoryType: "Direct Tax",
      description: "",
      isActive: true,
      calculationMethod: CALCULATION_METHODS.PERCENTAGE,
      baseRate: 10,
      deductionAllowed: true,
      priority: 50,
      color: "#3b82f6",
    };

    setBuilderState((prev: TaxBuilderState) => ({
      ...prev,
      categories: [...prev.categories, newCategory],
    }));
  };

  const removeCategory = (index: number) => {
    setBuilderState((prev: TaxBuilderState) => {
      const newCategories = prev.categories.filter((_: TaxCategoryInput, i: number) => i !== index);
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
          reindexedBrackets[(numIndex - 1).toString()] = brackets as TaxBracketInput[];
        } else if (numIndex < index) {
          reindexedBrackets[oldIndex] = brackets as TaxBracketInput[];
        }
      });

      Object.entries(newDeductions).forEach(([oldIndex, deductions]) => {
        const numIndex = parseInt(oldIndex);
        if (numIndex > index) {
          reindexedDeductions[(numIndex - 1).toString()] = deductions as TaxDeductionInput[];
        } else if (numIndex < index) {
          reindexedDeductions[oldIndex] = deductions as TaxDeductionInput[];
        }
      });

      return {
        ...prev,
        categories: newCategories,
        brackets: reindexedBrackets,
        deductions: reindexedDeductions,
      };
    });
  };

  // Call onChange whenever builderState changes
  React.useEffect(() => {
    if (onChange) {
      onChange(builderState);
    }
  }, [builderState, onChange]);

  const applyTemplate = (template: TaxSystemTemplate) => {
    const newState: Partial<TaxBuilderState> = {
      taxSystem: {
        taxSystemName: `${template.name} for ${countryId || "Country"}`,
        fiscalYear: template.fiscalYear,
        progressiveTax: template.progressiveTax,
        alternativeMinTax: false,
        complianceRate: 85,
        collectionEfficiency: 90,
      },
      categories: template.categories.map((cat) => ({
        categoryName: cat.categoryName,
        categoryType: cat.categoryType,
        description: cat.description,
        isActive: true,
        baseRate: cat.baseRate,
        calculationMethod: cat.calculationMethod,
        deductionAllowed: true,
        priority: 50,
        color: "#3b82f6",
      })),
      brackets: {},
      exemptions: [],
      deductions: {},
    };

    // Set up brackets
    template.categories.forEach((cat, catIndex) => {
      if (cat.brackets) {
        newState.brackets![catIndex.toString()] = cat.brackets.map((bracket) => ({
          bracketName: bracket.bracketName,
          minIncome: bracket.minIncome,
          maxIncome: bracket.maxIncome,
          rate: bracket.rate,
          marginalRate: bracket.marginalRate,
          isActive: true,
          priority: 50,
        }));
      }
    });

    setBuilderState((prev: TaxBuilderState) => ({ ...prev, ...newState }));
    setShowTemplates(false);
  };

  const handleSave = async () => {
    const validation = validateState();
    setBuilderState((prev: TaxBuilderState) => ({ ...prev, ...validation }));

    if (validation.isValid) {
      // Normalize payload to server schema (omit UI flags; fix literal unions)
      type ServerCalculationMethod = "percentage" | "fixed" | "tiered" | "progressive";
      const normalizedCategories = builderState.categories.map((cat) => ({
        ...cat,
        calculationMethod: cat.calculationMethod as ServerCalculationMethod,
      }));
      const submitState = {
        taxSystem: builderState.taxSystem,
        categories: normalizedCategories,
        brackets: builderState.brackets,
        exemptions: builderState.exemptions,
        deductions: builderState.deductions,
        atomicComponents: selectedAtomicTaxComponents,
      };
      // Check for conflicts if auto-sync is enabled
      if (enableAutoSync && countryId && syncState.conflictWarnings.length > 0) {
        setPendingSaveCallback(() => async () => {
          if (onSave) {
            setIsSaving(true);
            try {
              await onSave(submitState as any);
              clearConflicts();
            } catch (error) {
              console.error("Save failed:", error);
            } finally {
              setIsSaving(false);
            }
          }
        });
        setShowConflictDialog(true);
      } else if (onSave) {
        setIsSaving(true);
        try {
          const result = await onSave(submitState as any);
          // If server returned structured bracket validation errors, surface them inline
          if ((result as any)?.errors && Array.isArray((result as any).errors)) {
            const serverErrors = (result as any).errors as Array<{
              categoryIndex: number;
              message: string;
            }>;
            const errorMap: any = { ...validation.errors };
            serverErrors.forEach(({ categoryIndex, message }) => {
              errorMap.categories = errorMap.categories || {};
              errorMap.categories[categoryIndex] = errorMap.categories[categoryIndex] || [];
              errorMap.categories[categoryIndex].push(message);
            });
            setBuilderState((prev: TaxBuilderState) => ({
              ...prev,
              isValid: false,
              errors: errorMap,
            }));
            return;
          }
          toast.success("Tax system saved");
        } catch (error) {
          console.error("Save failed:", error);
          toast.error("Failed to save tax system");
        } finally {
          setIsSaving(false);
        }
      } else if (countryId) {
        // Fallback: direct API save (update-first, then create)
        setIsSaving(true);
        try {
          let result: any;
          try {
            result = await updateMutation.mutateAsync({
              countryId,
              data: submitState as any,
              skipConflictCheck: true,
            });
          } catch (updateErr) {
            const msg = updateErr instanceof Error ? updateErr.message : String(updateErr);
            const notFound = msg.includes("No record was found") || msg.includes("P2025");
            if (notFound) {
              result = await createMutation.mutateAsync({
                countryId,
                data: submitState as any,
                skipConflictCheck: true,
              });
            } else {
              throw updateErr;
            }
          }

          if (result?.errors && Array.isArray(result.errors)) {
            const errorMap: any = { ...validation.errors };
            (result.errors as Array<{ categoryIndex: number; message: string }>).forEach(
              ({ categoryIndex, message }) => {
                errorMap.categories = errorMap.categories || {};
                errorMap.categories[categoryIndex] = errorMap.categories[categoryIndex] || [];
                errorMap.categories[categoryIndex].push(message);
              }
            );
            setBuilderState((prev: TaxBuilderState) => ({
              ...prev,
              isValid: false,
              errors: errorMap,
            }));
            toast.error("Please fix bracket errors");
            return;
          }

          toast.success("Tax system saved");
        } catch (err) {
          console.error("Save failed:", err);
          toast.error("Failed to save tax system");
        } finally {
          setIsSaving(false);
        }
      }
    }
  };

  const handlePreview = () => {
    const validation = validateState();
    setBuilderState((prev: TaxBuilderState) => ({ ...prev, ...validation }));

    if (onPreview) {
      onPreview({ ...builderState, ...validation });
    }
  };

  // Convert builder state to calculator format
  const previewTaxSystem: TaxSystem = useMemo(
    () => ({
      id: "builder-preview",
      countryId: countryId || "preview",
      ...builderState.taxSystem,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    [builderState.taxSystem, countryId]
  );

  const previewCategories: TaxCategory[] = useMemo(
    () =>
      builderState.categories.map((cat, index) => ({
        id: `category-${index}`,
        taxSystemId: "builder-preview",
        ...cat,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    [builderState.categories]
  );

  const previewBrackets: TaxBracket[] = useMemo(() => {
    const brackets: TaxBracket[] = [];
    Object.entries(builderState.brackets).forEach(([categoryIndex, categoryBrackets]) => {
      categoryBrackets.forEach((bracket, bracketIndex) => {
        brackets.push({
          id: `bracket-${categoryIndex}-${bracketIndex}`,
          taxSystemId: "builder-preview",
          categoryId: `category-${categoryIndex}`,
          ...bracket,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });
    });
    return brackets;
  }, [builderState.brackets]);

  const steps = [
    { id: "atomic", label: "Atomic Components", icon: Zap },
    { id: "configuration", label: "Tax System Configuration", icon: Settings },
    { id: "exemptions", label: "Exemptions & Deductions", icon: FileText },
    { id: "calculator", label: "Calculator & Preview", icon: Calculator },
  ];

  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);
  const validation = validateState();

  // Basic, non-destructive suggestions (behind flag)
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS !== "true") return;
    setSuggestions(computeTaxSuggestions(builderState as any));
  }, [builderState]);

  const intel = useIntelligenceWebSocket({ countryId });
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS !== "true") return;
    if (!intel.latestUpdate) return;
    setSuggestions(computeTaxSuggestions(builderState as any));
  }, [intel.latestUpdate, builderState]);

  // Parse and pre-populate economic/government data on mount
  useEffect(() => {
    if (parsedDataApplied || !economicData || !governmentData) return;
    if (builderState.categories.length > 0) return; // Don't overwrite existing data

    try {
      const parsedData = parseEconomicDataForTaxSystem(economicData as any, governmentData, {
        useAggressiveParsing: true,
        includeGovernmentPolicies: true,
        autoGenerateBrackets: true,
        targetRevenueMatch: true,
      });

      setBuilderState((prev: TaxBuilderState) => ({
        ...prev,
        taxSystem: { ...prev.taxSystem, ...parsedData.taxSystem },
        categories: parsedData.categories,
        brackets: parsedData.brackets,
        exemptions: parsedData.exemptions,
        deductions: parsedData.deductions,
      }));

      setParsedDataApplied(true);
      toast.success("Tax data pre-populated from economic indicators");
    } catch (error) {
      console.error("Failed to parse economic data:", error);
    }
  }, [
    economicData,
    governmentData,
    parsedDataApplied,
    builderState.categories.length,
    setBuilderState,
  ]);

  // Auto-populate tax categories from government revenue sources
  useEffect(() => {
    // Only apply once, when government data is available with revenue sources
    if (revenueAutoPopulated) return;
    if (!governmentData?.revenueSources) return;
    if (builderState.categories.length > 0) return; // Don't overwrite existing data

    try {
      devLog("Auto-populating tax categories from government revenue sources...");

      // Convert revenue sources to tax categories
      const taxCategories = revenueTaxIntegrationService.revenueSourcesToTaxCategories(
        governmentData.revenueSources
      );

      if (taxCategories.length === 0) {
        devLog("No tax categories generated from revenue sources");
        return;
      }

      // Create brackets mapping based on categories
      const bracketsMapping: Record<string, TaxBracketInput[]> = {};
      taxCategories.forEach((category, index) => {
        // Get default brackets for the revenue source
        const matchingRevenue = governmentData.revenueSources.find(
          (rs: any) => rs.name === category.categoryName
        );
        if (matchingRevenue) {
          const defaultBrackets =
            revenueTaxIntegrationService.getTaxBracketsForRevenueSource(matchingRevenue);
          if (defaultBrackets.length > 0) {
            bracketsMapping[index.toString()] = defaultBrackets;
          }
        }
      });

      // Track which category indices are synced from government
      const syncedIndices = new Set<number>();
      taxCategories.forEach((_, index) => {
        syncedIndices.add(index);
      });
      setSyncedCategoryIndices(syncedIndices);

      // Apply the mapped data to builder state
      setBuilderState((prev: TaxBuilderState) => ({
        ...prev,
        categories: taxCategories,
        brackets: bracketsMapping,
        exemptions: [],
        deductions: {},
        taxSystem: {
          ...prev.taxSystem,
          taxSystemName: prev.taxSystem.taxSystemName || `${countryId || "Country"} Tax System`,
          collectionEfficiency: prev.taxSystem.collectionEfficiency || 90,
          complianceRate: prev.taxSystem.complianceRate || 85,
        },
      }));

      setRevenueAutoPopulated(true);

      toast.success(
        `Auto-populated ${taxCategories.length} tax categories from government revenue sources`,
        {
          description: "Review and adjust the pre-populated tax structure as needed",
        }
      );

      devLog("Successfully auto-populated tax categories:", {
        categoriesCount: taxCategories.length,
        bracketsCount: Object.keys(bracketsMapping).length,
        categories: taxCategories.map((c) => c.categoryName),
      });
    } catch (error) {
      console.error("Failed to auto-populate from revenue sources:", error);
      toast.error("Failed to auto-populate tax categories", {
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  }, [
    governmentData,
    revenueAutoPopulated,
    builderState.categories.length,
    setBuilderState,
    countryId,
  ]);

  // Subscribe to bidirectional tax sync service for recommendations
  useEffect(() => {
    const unsubscribe = bidirectionalTaxSyncService.subscribe((state) => {
      if (state.taxRecommendations.length > 0 && !revenueAutoPopulated) {
        // Convert tax recommendations to suggestions
        const newSuggestions: SuggestionItem[] = state.taxRecommendations.map((rec) => ({
          id: `tax-rec-${rec.taxType}-${Date.now()}`,
          type: "tax_recommendation",
          title: `Optimize ${rec.taxType} tax rate`,
          description: rec.rationale,
          severity: rec.implementationPriority === 'high' ? 'warning' : 'info',
          impact: rec.implementationPriority,
          action: () => {
            // Find matching category and update rate
            const categoryIndex = builderState.categories.findIndex((c) =>
              c.categoryName.toLowerCase().includes(rec.taxType.toLowerCase())
            );
            if (categoryIndex >= 0) {
              const updatedCategories = [...builderState.categories];
              updatedCategories[categoryIndex] = {
                ...updatedCategories[categoryIndex],
                baseRate: rec.recommendedRate,
              };
              setBuilderState((prev) => ({
                ...prev,
                categories: updatedCategories,
              }));
              toast.success(`Applied ${rec.taxType} tax recommendation: ${rec.recommendedRate}%`);
            }
          },
        }));

        setSuggestions((prev) => [...prev, ...newSuggestions]);
      }

      if (state.economicImpacts.length > 0) {
        devLog("Economic impacts from tax changes:", state.economicImpacts);
      }

      if (state.errors.length > 0) {
        toast.error(`Tax sync error: ${state.errors[state.errors.length - 1]}`);
      }
    });

    return unsubscribe;
  }, [builderState.categories, setBuilderState, revenueAutoPopulated]);

  // Update bidirectional sync service when tax system changes
  useEffect(() => {
    if (builderState.categories.length > 0) {
      const taxSystemData = {
        id: countryId || "draft",
        countryId: countryId || "draft",
        taxSystemName: builderState.taxSystem.taxSystemName,
        fiscalYear: builderState.taxSystem.fiscalYear,
        progressiveTax: builderState.taxSystem.progressiveTax,
        alternativeMinTax: builderState.taxSystem.alternativeMinTax,
        collectionEfficiency: builderState.taxSystem.collectionEfficiency,
        complianceRate: builderState.taxSystem.complianceRate,
        taxCategories: builderState.categories.map((cat, idx) => ({
          id: `cat-${idx}`,
          taxSystemId: countryId || "draft",
          categoryId: `cat-${idx}`,
          categoryName: cat.categoryName,
          categoryType: cat.categoryType,
          description: cat.description,
          baseRate: cat.baseRate,
          calculationMethod: cat.calculationMethod,
          minimumAmount: cat.minimumAmount,
          maximumAmount: cat.maximumAmount,
          exemptionAmount: cat.exemptionAmount,
          deductionAllowed: cat.deductionAllowed,
          standardDeduction: cat.standardDeduction,
          priority: cat.priority || idx + 1,
          color: cat.color,
          icon: cat.icon,
          isActive: cat.isActive,
          taxBrackets: (builderState.brackets[idx] || []).map((bracket, bIdx) => ({
            id: `bracket-${idx}-${bIdx}`,
            taxSystemId: countryId || "draft",
            categoryId: `cat-${idx}`,
            bracketName: bracket.bracketName,
            minIncome: bracket.minIncome,
            maxIncome: bracket.maxIncome,
            rate: bracket.rate,
            flatAmount: bracket.flatAmount,
            marginalRate: bracket.marginalRate,
            isActive: bracket.isActive,
            priority: bracket.priority,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
          taxExemptions: [],
          taxDeductions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as TaxSystem;

      bidirectionalTaxSyncService.updateTaxSystem(taxSystemData).catch((err) => {
        devLog("Failed to update bidirectional tax sync:", err);
      });
    }
  }, [builderState.categories, builderState.brackets, builderState.taxSystem, countryId]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-3xl font-bold">Tax System Builder</h1>
          <p className="text-muted-foreground mt-1">
            Design and configure your country's taxation system
          </p>
        </div>
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
          {!enableAutoSync && (
            <UIBadge variant="secondary" className="text-xs">
              Manual mode
            </UIBadge>
          )}
          <Button variant="outline" onClick={() => setShowTemplates(true)} disabled={isReadOnly}>
            Use Template
          </Button>
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={builderState.categories.length === 0}
          >
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
        </div>
      </div>

      {/* Step-Based Navigation */}
      <div className="bg-muted/50 border-border flex items-center justify-between rounded-lg border p-4">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = index < currentStepIndex;

          // Calculate step-specific errors
          let hasErrors = false;
          if (step.id === "atomic") {
            // No specific validation errors for atomic components
            hasErrors = false;
          } else if (step.id === "configuration") {
            hasErrors = !!(validation.errors.taxSystem || validation.errors.categories);
          } else if (step.id === "exemptions") {
            // Exemptions don't have specific validation currently
            hasErrors = false;
          } else if (step.id === "calculator") {
            hasErrors = !validation.isValid;
          }

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => setCurrentStep(step.id as any)}
                disabled={isReadOnly}
                className={`relative flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isCompleted && !hasErrors
                      ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                      : hasErrors
                        ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                        : "hover:bg-muted text-muted-foreground"
                }`}
              >
                <StepIcon className="h-4 w-4" />
                <span className="text-sm font-medium">{step.label}</span>
                {isCompleted && !hasErrors && <CheckCircle className="h-4 w-4" />}
                {hasErrors && <AlertTriangle className="h-4 w-4" />}
              </button>
              {index < steps.length - 1 && (
                <ArrowRight className="text-muted-foreground mx-2 h-4 w-4" />
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
            <ul className="mt-2 list-inside list-disc space-y-1">
              {Object.entries(validation.errors).map(([key, errors]) =>
                Array.isArray(errors)
                  ? errors.map((error, index) => (
                      <li key={`${key}-${index}`} className="text-sm">
                        {error}
                      </li>
                    ))
                  : Object.entries(errors as Record<string, unknown>).map(([subKey, subErrors]) => (
                      <li key={`${key}-${subKey}`} className="text-sm">
                        {key === "categories" ? `Category ${parseInt(subKey) + 1}: ` : ""}
                        {Array.isArray(subErrors) ? subErrors.join(", ") : (subErrors as string)}
                      </li>
                    ))
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {process.env.NEXT_PUBLIC_ENABLE_INTEL_SUGGESTIONS === "true" && suggestions.length > 0 && (
        <SuggestionsPanel
          suggestions={suggestions}
          onApply={(s) => {
            if (s.id === "income-amt-nudge") {
              const idx = builderState.categories.findIndex((c) =>
                c.categoryType.toLowerCase().includes("income")
              );
              if (idx >= 0) {
                const updated = [...builderState.categories];
                updated[idx] = {
                  ...updated[idx],
                  baseRate: Math.max(updated[idx].baseRate || 0, 5),
                };
                handleCategoriesChange(updated);
              }
            }
            if (s.id === "corp-amt-nudge") {
              const idx = builderState.categories.findIndex((c) =>
                c.categoryType.toLowerCase().includes("corporate")
              );
              if (idx >= 0) {
                const updated = [...builderState.categories];
                updated[idx] = {
                  ...updated[idx],
                  baseRate: Math.max(updated[idx].baseRate || 0, 10),
                };
                handleCategoriesChange(updated);
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
        {/* Step 1: Atomic Components */}
        {currentStep === "atomic" && (
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Settings</TabsTrigger>
              <TabsTrigger value="atomic">Atomic Components</TabsTrigger>
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="mt-6 space-y-6">
              <TaxSystemForm
                data={builderState.taxSystem}
                onChange={handleTaxSystemChange}
                isReadOnly={isReadOnly}
                errors={validation.errors.taxSystem || {}}
                countryId={countryId}
              />
            </TabsContent>

            <TabsContent value="atomic" className="mt-6 space-y-6">
              {showAtomicIntegration ? (
                <>
                  <div className="space-y-4 text-center">
                    <h2 className="text-foreground text-2xl font-semibold">
                      Atomic Tax Components
                    </h2>
                    <p className="text-muted-foreground">
                      Build your tax system using modular components with synergies and conflicts
                    </p>
                  </div>

                  <AtomicTaxComponentSelector
                    selectedComponents={selectedAtomicTaxComponents}
                    onComponentChange={setSelectedAtomicTaxComponents}
                    maxComponents={15}
                    isReadOnly={isReadOnly}
                  />

                  {selectedAtomicTaxComponents.length > 0 && economicData && governmentData && (
                    <div className="space-y-6">
                      <UnifiedTaxEffectivenessDisplay
                        taxComponents={selectedAtomicTaxComponents.map((id) => ({
                          id,
                          type: id,
                          name: id,
                          effectiveness: 80,
                        }))}
                        governmentComponents={activeComponents.map((type) => ({
                          id: type,
                          type,
                          name: type,
                          effectiveness: 80,
                          countryId: countryId || "",
                          effectivenessScore: 80,
                          implementationDate: new Date(),
                          implementationCost: 0,
                          maintenanceCost: 0,
                          requiredCapacity: 50,
                          isActive: true,
                          notes: null,
                          createdAt: new Date(),
                          updatedAt: new Date(),
                        }))}
                        economicData={economicData as any}
                        taxSystem={previewTaxSystem}
                      />
                    </div>
                  )}
                </>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Atomic integration is disabled. Enable it to access modular tax components.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="analysis" className="mt-6 space-y-6">
              {economicData && (
                <TaxEconomySyncDisplay
                  taxSystem={previewTaxSystem}
                  economicData={{ core: economicData as any }}
                  onOptimize={() => {
                    toast.info("Tax optimization recommendations applied");
                  }}
                />
              )}

              {!economicData && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Economic data is required to show tax system analysis. Configure your economy
                    builder first.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        )}

        {currentStep === "configuration" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-foreground text-2xl font-semibold">Tax System Configuration</h2>
            </div>
            <TaxSystemForm
              data={builderState.taxSystem}
              onChange={handleTaxSystemChange}
              isReadOnly={isReadOnly}
              errors={validation.errors.taxSystem || {}}
              countryId={countryId}
            />
          </div>
        )}

        {currentStep === "exemptions" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-foreground text-2xl font-semibold">Exemptions & Deductions</h2>
            </div>
            <Card className="border-2 border-dashed">
              <CardContent className="p-8 text-center">
                <FileText className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <h3 className="mb-2 text-lg font-semibold">Exemptions & Deductions</h3>
                <p className="text-muted-foreground mb-4">
                  Configure tax exemptions and deductions in the category forms above
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* LEGACY: categories step (removed but kept for reference) */}
        {/* @ts-expect-error - Dead code kept for reference, currentStep will never be "categories" */}
        {false && currentStep === "categories" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-foreground text-2xl font-semibold">Tax Categories</h2>
              {!isReadOnly && (
                <Button onClick={addCategory}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Category
                </Button>
              )}
            </div>

            {/* Auto-sync status indicator */}
            {governmentData?.revenueSources && revenueAutoPopulated && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Tax categories auto-populated from government revenue sources. You can modify or
                  add additional categories as needed.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              {builderState.categories.map((category, index) => (
                <div key={index} className="relative">
                  {syncedCategoryIndices.has(index) && (
                    <div className="absolute top-2 right-2 z-10">
                      <UIBadge variant="secondary" className="text-xs">
                        <Zap className="mr-1 h-3 w-3" />
                        Auto-synced
                      </UIBadge>
                    </div>
                  )}
                  <TaxCategoryForm
                    data={category}
                    onChange={(updated) => {
                      const newCategories = [...builderState.categories];
                      newCategories[index] = updated;
                      handleCategoriesChange(newCategories);
                      // Remove sync indicator when manually modified
                      setSyncedCategoryIndices((prev) => {
                        const newSet = new Set(prev);
                        newSet.delete(index);
                        return newSet;
                      });
                    }}
                    onDelete={() => removeCategory(index)}
                    isReadOnly={isReadOnly}
                    showBrackets={true}
                    brackets={builderState.brackets[index.toString()] || []}
                    onBracketsChange={(brackets) =>
                      handleBracketsChange(index.toString(), brackets)
                    }
                    categoryIndex={index}
                    errors={
                      validation.errors.categories?.[index]
                        ? { category: validation.errors.categories[index] }
                        : {}
                    }
                  />
                </div>
              ))}

              {builderState.categories.length === 0 && (
                <Card className="border-2 border-dashed">
                  <CardContent className="p-8 text-center">
                    <Receipt className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                    <h3 className="mb-2 text-lg font-semibold">No Tax Categories Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Add tax categories to define how different types of income are taxed
                    </p>
                    {!isReadOnly && (
                      <Button onClick={addCategory}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add First Category
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {currentStep === "calculator" && (
          <div className="space-y-6">
            <h2 className="text-foreground text-2xl font-semibold">Tax Calculator</h2>
          <TaxCalculator
            taxSystem={previewTaxSystem}
            categories={previewCategories}
            brackets={previewBrackets}
            exemptions={[]}
            deductions={[]}
            onCalculationChange={setCalculationResult}
            economicData={
              economicData
                ? {
                    totalPopulation: economicData.population,
                    nominalGDP: economicData.gdp,
                    gdpPerCapita: economicData.gdp / economicData.population,
                    realGDPGrowthRate: 0.03, // Default value
                    inflationRate: 0.02, // Default value
                    currencyExchangeRate: 1.0, // Default value
                  }
                : undefined
            }
            governmentData={governmentData}
          />
          </div>
        )}

        {/* LEGACY: preview step (removed but kept for reference) */}
        {/* @ts-expect-error - Dead code kept for reference, currentStep will never be "preview" */}
        {false && currentStep === "preview" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-foreground text-2xl font-semibold">Tax System Preview</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const allOpen = isSystemDetailsOpen && isCategoriesOpen && isCalculationOpen;
                  setIsSystemDetailsOpen(!allOpen);
                  setIsCategoriesOpen(!allOpen);
                  setIsCalculationOpen(!allOpen);
                  setOpenCategoryDetails({});
                }}
              >
                <ChevronsUpDown className="mr-2 h-4 w-4" />
                {isSystemDetailsOpen && isCategoriesOpen && isCalculationOpen
                  ? "Collapse All"
                  : "Expand All"}
              </Button>
            </div>

            {/* System Overview - Collapsible */}
            <Collapsible open={isSystemDetailsOpen} onOpenChange={setIsSystemDetailsOpen}>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="hover:bg-muted/50 cursor-pointer transition-colors">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        {builderState.taxSystem.taxSystemName || "Untitled Tax System"}
                      </div>
                      {isSystemDetailsOpen ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <div className="text-muted-foreground text-sm">System Type</div>
                        <div className="font-medium">
                          {builderState.taxSystem.progressiveTax ? "Progressive" : "Flat"} Tax
                          System
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-sm">Fiscal Year</div>
                        <div className="font-medium capitalize">
                          {builderState.taxSystem.fiscalYear.replace("-", " - ")}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-sm">Categories</div>
                        <div className="font-medium">{builderState.categories.length}</div>
                      </div>
                    </div>

                    {builderState.taxSystem.alternativeMinTax && (
                      <Alert>
                        <Lightbulb className="h-4 w-4" />
                        <AlertDescription>
                          Alternative Minimum Tax is enabled at{" "}
                          {builderState.taxSystem.alternativeMinRate}%
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Categories Overview - Collapsible */}
            <Collapsible open={isCategoriesOpen} onOpenChange={setIsCategoriesOpen}>
              <Card>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="hover:bg-muted/50 cursor-pointer transition-colors">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-5 w-5" />
                        Tax Categories Overview ({builderState.categories.length})
                      </div>
                      {isCategoriesOpen ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="space-y-3">
                      {builderState.categories.map((category, index) => (
                        <Collapsible
                          key={index}
                          open={openCategoryDetails[index.toString()]}
                          onOpenChange={(open) =>
                            setOpenCategoryDetails((prev) => ({
                              ...prev,
                              [index.toString()]: open,
                            }))
                          }
                        >
                          <Card className="border">
                            <CollapsibleTrigger className="w-full">
                              <div className="hover:bg-muted/30 flex cursor-pointer items-center justify-between p-3 transition-colors">
                                <div>
                                  <div className="flex items-center gap-2 font-medium">
                                    {category.categoryName}
                                    {openCategoryDetails[index.toString()] ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </div>
                                  <div className="text-muted-foreground text-sm">
                                    {category.categoryType} • {category.calculationMethod}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <UIBadge variant="outline">
                                    {category.baseRate}% base rate
                                  </UIBadge>
                                  {builderState.brackets[index.toString()]?.length > 0 && (
                                    <div className="text-muted-foreground mt-1 text-xs">
                                      {builderState.brackets[index.toString()].length} brackets
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <Separator />
                              <div className="space-y-3 p-3">
                                {category.description && (
                                  <div>
                                    <div className="text-muted-foreground text-xs">Description</div>
                                    <div className="text-sm">{category.description}</div>
                                  </div>
                                )}
                                {builderState.brackets[index.toString()]?.length > 0 && (
                                  <div>
                                    <div className="text-muted-foreground mb-2 text-xs">
                                      Tax Brackets
                                    </div>
                                    <div className="space-y-2">
                                      {builderState.brackets[index.toString()].map(
                                        (bracket, bIndex) => (
                                          <div
                                            key={bIndex}
                                            className="bg-muted/50 flex items-center justify-between rounded p-2 text-sm"
                                          >
                                            <span>
                                              ${bracket.minIncome.toLocaleString()} -{" "}
                                              {bracket.maxIncome
                                                ? `$${bracket.maxIncome.toLocaleString()}`
                                                : "and above"}
                                            </span>
                                            <UIBadge variant="secondary">{bracket.rate}%</UIBadge>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Card>
                        </Collapsible>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Tax Calculator Preview - Collapsible */}
            {calculationResult && (
              <Collapsible open={isCalculationOpen} onOpenChange={setIsCalculationOpen}>
                <Card>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="hover:bg-muted/50 cursor-pointer transition-colors">
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calculator className="h-5 w-5" />
                          Sample Calculation
                        </div>
                        {isCalculationOpen ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div>
                          <div className="text-muted-foreground text-sm">Effective Rate</div>
                          <div className="text-2xl font-semibold">
                            {calculationResult?.effectiveRate.toFixed(2)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-sm">Marginal Rate</div>
                          <div className="text-2xl font-semibold">
                            {calculationResult?.marginalRate.toFixed(2)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-sm">Tax Categories</div>
                          <div className="text-2xl font-semibold">
                            {calculationResult?.breakdown.length}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}
          </div>
        )}
      </div>

      {/* Template Modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
          <div className="bg-background border-border mx-4 max-h-[80vh] w-full max-w-4xl overflow-y-auto rounded-lg border p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-foreground text-2xl font-semibold">Tax System Templates</h2>
              <Button variant="outline" onClick={() => setShowTemplates(false)}>
                Close
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {taxSystemTemplates.map((template, index) => (
                <Card key={index} className="cursor-pointer transition-shadow hover:shadow-lg">
                  <CardHeader>
                    <CardTitle>{template.name}</CardTitle>
                    <p className="text-muted-foreground text-sm">{template.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <UIBadge variant="secondary">
                          {template.progressiveTax ? "Progressive" : "Flat"} Tax
                        </UIBadge>
                        <UIBadge variant="outline" className="ml-2">
                          {template.categories.length} Categories
                        </UIBadge>
                      </div>
                      <div className="text-sm">
                        <strong>Categories:</strong>
                        <ul className="text-muted-foreground mt-1">
                          {template.categories.slice(0, 3).map((cat) => (
                            <li key={cat.categoryName}>
                              • {cat.categoryName} ({cat.baseRate}%)
                            </li>
                          ))}
                          {template.categories.length > 3 && (
                            <li>• +{template.categories.length - 3} more...</li>
                          )}
                        </ul>
                      </div>
                      <Button onClick={() => applyTemplate(template)} className="w-full">
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
    </div>
  );
}
