"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Alert, AlertDescription } from '~/components/ui/alert';
import {
  Calculator,
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  Lightbulb,
  AlertCircle,
  CheckCircle2,
  Plus,
  Minus,
  Building,
  Info,
  Loader2,
  Zap
} from 'lucide-react';

import type {
  TaxSystem,
  TaxCategory,
  TaxBracket,
  TaxExemption,
  TaxDeduction,
  TaxCalculationRequest,
  TaxCalculationResult,
  TaxDeductionAmount,
  TaxExemptionAmount
} from '~/types/tax-system';
import type { CoreEconomicIndicatorsData } from '~/types/economics';
import type { GovernmentBuilderState } from '~/types/government';
import { TaxCalculatorEngine } from '~/lib/tax-calculator';
import { ComponentType } from '@prisma/client';
import { EconomicComponentType } from '~/components/economy/atoms/AtomicEconomicComponents';
import {
  calculateUnifiedAtomicModifiers,
  calculateClientAtomicEconomicImpact
} from '~/lib/atomic-client-calculations';
import { api } from '~/trpc/react';

interface TaxCalculatorProps {
  taxSystem: TaxSystem;
  categories: TaxCategory[];
  brackets: TaxBracket[];
  exemptions: TaxExemption[];
  deductions: TaxDeduction[];
  onCalculationChange?: (result: TaxCalculationResult | null) => void;
  economicData?: CoreEconomicIndicatorsData;
  governmentData?: GovernmentBuilderState;
  calculationMode?: 'individual' | 'corporate' | 'both';
  // Atomic component integration
  governmentComponents?: ComponentType[];
  economicComponents?: EconomicComponentType[];
  sectorData?: {
    id: string;
    name: string;
    gdpContribution: number;
    taxRate?: number;
  }[];
  // REQUIRED for live wiring
  countryId?: string;
  // Enable live calculation mode (default: false for backwards compatibility)
  enableLiveCalculation?: boolean;
}

export function TaxCalculator({
  taxSystem,
  categories,
  brackets,
  exemptions,
  deductions,
  onCalculationChange,
  economicData,
  governmentData,
  calculationMode: initialCalculationMode = 'individual',
  governmentComponents = [],
  economicComponents = [],
  sectorData = [],
  countryId,
  enableLiveCalculation = false
}: TaxCalculatorProps) {
  const [income, setIncome] = useState<string>('100000');
  const [corporateIncome, setCorporateIncome] = useState<string>('500000');
  const [taxYear, setTaxYear] = useState<number>(new Date().getFullYear());
  const [selectedDeductions, setSelectedDeductions] = useState<TaxDeductionAmount[]>([]);
  const [selectedExemptions, setSelectedExemptions] = useState<TaxExemptionAmount[]>([]);
  const [selectedCorporateDeductions, setSelectedCorporateDeductions] = useState<TaxDeductionAmount[]>([]);
  const [selectedCorporateExemptions, setSelectedCorporateExemptions] = useState<TaxExemptionAmount[]>([]);
  const [activeTab, setActiveTab] = useState<'calculator' | 'breakdown' | 'suggestions'>('calculator');
  const [calculatorMode, setCalculatorMode] = useState<'individual' | 'corporate' | 'both'>(initialCalculationMode);
  const [calculationTimestamp, setCalculationTimestamp] = useState<string | null>(null);
  const [liveCalculationResult, setLiveCalculationResult] = useState<any>(null);

  // tRPC mutation for live tax calculation
  const liveTaxCalculation = api.taxSystem.calculateLiveTax.useMutation({
    onSuccess: (data) => {
      setLiveCalculationResult(data);
      setCalculationTimestamp(data.timestamp);
      if (onCalculationChange) {
        onCalculationChange(data as any);
      }
    },
    onError: (error) => {
      console.error('Live tax calculation error:', error);
    }
  });

  // Create calculator engine
  const calculatorEngine = useMemo(() => {
    return new TaxCalculatorEngine(
      taxSystem,
      categories,
      brackets,
      exemptions,
      deductions
    );
  }, [taxSystem, categories, brackets, exemptions, deductions]);

  // Debounced live calculation trigger
  useEffect(() => {
    if (!enableLiveCalculation || !countryId) return;

    const incomeValue = parseFloat(income);
    if (!incomeValue || incomeValue <= 0) return;

    const timer = setTimeout(() => {
      liveTaxCalculation.mutate({
        taxSystemId: taxSystem.id,
        countryId: countryId,
        income: incomeValue,
        corporateIncome: parseFloat(corporateIncome) || undefined,
        deductions: selectedDeductions,
        exemptions: selectedExemptions,
        taxYear,
        sectorData
      });
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [income, corporateIncome, selectedDeductions, selectedExemptions, taxYear, enableLiveCalculation, countryId]);

  // Calculate dynamic atomic component modifiers
  const atomicModifiers = useMemo(() => {
    // If using live calculation, use the server response
    if (enableLiveCalculation && liveCalculationResult?.atomicModifiers) {
      const serverMods = liveCalculationResult.atomicModifiers;
      return {
        taxCollectionEfficiency: serverMods.taxCollectionEfficiency || 1.0,
        economicModifier: serverMods.economicBonus || 0,
        governmentModifier: serverMods.governmentBonus || 0,
        baseRateModifier: serverMods.economicTierMultiplier || 1.0,
        effectiveRateMultiplier: serverMods.taxCollectionEfficiency || 1.0,
        synergies: [],
        conflicts: []
      };
    }

    // Fallback to client-side calculation
    if (governmentComponents.length === 0 && economicComponents.length === 0) {
      return {
        taxCollectionEfficiency: 1.0,
        economicModifier: 0,
        governmentModifier: 0,
        baseRateModifier: 1.0,
        effectiveRateMultiplier: 1.0,
        synergies: [],
        conflicts: []
      };
    }

    // Calculate unified modifiers from all component types
    const unified = calculateUnifiedAtomicModifiers(
      governmentComponents,
      economicComponents,
      []  // Tax components would go here if needed
    );

    // Calculate economic modifier from economic components
    const economicModifier = economicComponents.reduce((sum, comp) => {
      // Use ATOMIC_ECONOMIC_COMPONENTS to get taxImpact.revenueEfficiency
      // This comes from the AtomicEconomicComponents file
      return sum + 0.05; // Default 5% boost per economic component
    }, 0) / Math.max(economicComponents.length, 1);

    // Calculate government modifier from government components
    const validGovernmentComponents = governmentComponents
      .filter((ct): ct is ComponentType => Object.values(ComponentType).includes(ct as ComponentType));

    const governmentModifier = validGovernmentComponents.reduce((sum, comp) => {
      // Government components that boost tax collection efficiency
      const taxBoostComponents: ComponentType[] = [
        ComponentType.PROFESSIONAL_BUREAUCRACY,
        ComponentType.RULE_OF_LAW,
        ComponentType.TECHNOCRATIC_AGENCIES,
        ComponentType.DIGITAL_GOVERNMENT
      ];

      if (taxBoostComponents.includes(comp)) {
        return sum + 0.08; // 8% boost for tax-efficient components
      }
      return sum + 0.02; // 2% baseline boost
    }, 0) / Math.max(validGovernmentComponents.length, 1);

    return {
      taxCollectionEfficiency: unified.taxCollectionMultiplier,
      economicModifier,
      governmentModifier,
      baseRateModifier: unified.gdpGrowthModifier,
      effectiveRateMultiplier: 1 + economicModifier + governmentModifier,
      synergies: [],
      conflicts: []
    };
  }, [governmentComponents, economicComponents, enableLiveCalculation, liveCalculationResult]);

  // Calculate tax result for individuals with atomic component modifiers
  const calculationResult = useMemo(() => {
    // If live calculation is enabled and we have results, use those
    if (enableLiveCalculation && liveCalculationResult) {
      return liveCalculationResult as TaxCalculationResult;
    }

    // Fallback to client-side calculation
    const incomeValue = parseFloat(income) || 0;
    if (incomeValue <= 0) return null;

    const request: TaxCalculationRequest = {
      taxSystemId: taxSystem.id,
      taxYear,
      income: incomeValue,
      deductions: selectedDeductions,
      exemptions: selectedExemptions
    };

    try {
      const baseResult = calculatorEngine.calculate(request);

      // Apply atomic component modifiers to effective rate
      if (atomicModifiers.taxCollectionEfficiency !== 1.0) {
        const modifiedTaxOwed = baseResult.taxOwed * atomicModifiers.taxCollectionEfficiency;
        const modifiedEffectiveRate = (modifiedTaxOwed / incomeValue) * 100;

        return {
          ...baseResult,
          taxOwed: modifiedTaxOwed,
          effectiveRate: modifiedEffectiveRate,
          breakdown: baseResult.breakdown.map(category => ({
            ...category,
            taxOwed: category.taxOwed * atomicModifiers.taxCollectionEfficiency
          }))
        };
      }

      return baseResult;
    } catch (error) {
      console.error('Tax calculation error:', error);
      return null;
    }
  }, [income, taxYear, selectedDeductions, selectedExemptions, calculatorEngine, taxSystem.id, atomicModifiers, enableLiveCalculation, liveCalculationResult]);

  // Calculate tax result for corporations with sector data integration
  const corporateCalculationResult = useMemo(() => {
    const corporateIncomeValue = parseFloat(corporateIncome) || 0;
    if (corporateIncomeValue <= 0) return null;

    const request: TaxCalculationRequest = {
      taxSystemId: taxSystem.id,
      taxYear,
      income: corporateIncomeValue,
      deductions: selectedCorporateDeductions,
      exemptions: selectedCorporateExemptions
    };

    try {
      const baseResult = calculatorEngine.calculate(request);

      // Apply sector-specific tax calculations if sector data is available
      if (sectorData.length > 0 && economicData?.nominalGDP) {
        // Calculate weighted tax based on sector distribution
        const sectorTaxContributions = sectorData.map(sector => {
          const sectorGDP = (economicData.nominalGDP * sector.gdpContribution) / 100;
          const sectorIncome = (corporateIncomeValue * sector.gdpContribution) / 100;
          const sectorTaxRate = sector.taxRate || baseResult.effectiveRate;

          return {
            sector: sector.name,
            income: sectorIncome,
            taxOwed: (sectorIncome * sectorTaxRate) / 100,
            effectiveRate: sectorTaxRate
          };
        });

        const totalSectorTax = sectorTaxContributions.reduce((sum, s) => sum + s.taxOwed, 0);
        const weightedEffectiveRate = (totalSectorTax / corporateIncomeValue) * 100;

        // Apply atomic component modifiers
        const modifiedTaxOwed = totalSectorTax * atomicModifiers.taxCollectionEfficiency;
        const modifiedEffectiveRate = (modifiedTaxOwed / corporateIncomeValue) * 100;

        return {
          ...baseResult,
          taxOwed: modifiedTaxOwed,
          effectiveRate: modifiedEffectiveRate,
          breakdown: baseResult.breakdown.map(category => ({
            ...category,
            taxOwed: category.taxOwed * atomicModifiers.taxCollectionEfficiency
          })),
          sectorBreakdown: sectorTaxContributions
        } as TaxCalculationResult & { sectorBreakdown?: typeof sectorTaxContributions };
      }

      // Apply atomic component modifiers to standard calculation
      if (atomicModifiers.taxCollectionEfficiency !== 1.0) {
        const modifiedTaxOwed = baseResult.taxOwed * atomicModifiers.taxCollectionEfficiency;
        const modifiedEffectiveRate = (modifiedTaxOwed / corporateIncomeValue) * 100;

        return {
          ...baseResult,
          taxOwed: modifiedTaxOwed,
          effectiveRate: modifiedEffectiveRate,
          breakdown: baseResult.breakdown.map(category => ({
            ...category,
            taxOwed: category.taxOwed * atomicModifiers.taxCollectionEfficiency
          }))
        };
      }

      return baseResult;
    } catch (error) {
      console.error('Corporate tax calculation error:', error);
      return null;
    }
  }, [corporateIncome, taxYear, selectedCorporateDeductions, selectedCorporateExemptions, calculatorEngine, taxSystem.id, sectorData, economicData, atomicModifiers]);

  useEffect(() => {
    if (onCalculationChange) {
      onCalculationChange(calculationResult);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculationResult]);

  // Validation
  const validation = useMemo(() => {
    const incomeValue = parseFloat(income) || 0;
    const request: TaxCalculationRequest = {
      taxSystemId: taxSystem.id,
      taxYear,
      income: incomeValue,
      deductions: selectedDeductions,
      exemptions: selectedExemptions
    };

    return calculatorEngine.validateCalculationRequest(request);
  }, [income, taxYear, selectedDeductions, selectedExemptions, calculatorEngine, taxSystem.id]);

  // Generate suggestions
  const suggestions = useMemo(() => {
    if (!calculationResult) return [];
    
    const incomeValue = parseFloat(income) || 0;
    const request: TaxCalculationRequest = {
      taxSystemId: taxSystem.id,
      taxYear,
      income: incomeValue,
      deductions: selectedDeductions,
      exemptions: selectedExemptions
    };

    return calculatorEngine.generateOptimizationSuggestions(request, calculationResult);
  }, [calculationResult, income, taxYear, selectedDeductions, selectedExemptions, calculatorEngine, taxSystem.id]);

  const addDeduction = (deductionId: string) => {
    const deduction = deductions.find(d => d.id === deductionId);
    if (!deduction) return;

    const existing = selectedDeductions.find(d => d.deductionId === deductionId);
    if (existing) return;

    setSelectedDeductions([
      ...selectedDeductions,
      {
        deductionId,
        amount: deduction.maximumAmount || 5000,
        description: deduction.deductionName
      }
    ]);
  };

  const removeDeduction = (deductionId: string) => {
    setSelectedDeductions(selectedDeductions.filter(d => d.deductionId !== deductionId));
  };

  const updateDeductionAmount = (deductionId: string, amount: number) => {
    setSelectedDeductions(selectedDeductions.map(d => 
      d.deductionId === deductionId ? { ...d, amount } : d
    ));
  };

  const addExemption = (exemptionId: string) => {
    const exemption = exemptions.find(e => e.id === exemptionId);
    if (!exemption) return;

    const existing = selectedExemptions.find(e => e.exemptionId === exemptionId);
    if (existing) return;

    setSelectedExemptions([
      ...selectedExemptions,
      {
        exemptionId,
        amount: exemption.exemptionAmount || 10000,
        description: exemption.exemptionName
      }
    ]);
  };

  const removeExemption = (exemptionId: string) => {
    setSelectedExemptions(selectedExemptions.filter(e => e.exemptionId !== exemptionId));
  };

  const updateExemptionAmount = (exemptionId: string, amount: number) => {
    setSelectedExemptions(selectedExemptions.map(e => 
      e.exemptionId === exemptionId ? { ...e, amount } : e
    ));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (rate: number) => {
    return `${rate.toFixed(2)}%`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="space-y-4">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calculator className="h-5 w-5 text-blue-600" />
            </div>
            Tax Calculator
            <Badge variant="outline">{taxSystem.taxSystemName}</Badge>
            {enableLiveCalculation && (
              <Badge variant="secondary" className="ml-auto bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                <Zap className="h-3 w-3 mr-1" />
                Live Calculation
              </Badge>
            )}
            {liveTaxCalculation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            )}
          </CardTitle>

          {/* Calculator Mode Selector */}
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Calculator Mode:</Label>
            <Tabs value={calculatorMode} onValueChange={(value) => setCalculatorMode(value as 'individual' | 'corporate')} className="w-auto">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="individual">Individual</TabsTrigger>
                <TabsTrigger value="corporate">Corporate</TabsTrigger>
              </TabsList>
            </Tabs>
            {economicData && (
              <Badge variant="secondary" className="ml-auto">
                GDP/capita: ${(economicData.gdpPerCapita || (economicData.nominalGDP / economicData.totalPopulation)).toFixed(0)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calculator">Calculator</TabsTrigger>
            <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
            <TabsTrigger value="suggestions">Optimization</TabsTrigger>
          </TabsList>

          {/* Calculator Tab */}
          <TabsContent value="calculator" className="space-y-6">
            {/* Input Section */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="income">
                    {calculatorMode === 'individual' ? 'Annual Income' : 'Corporate Revenue'}
                  </Label>
                  <Input
                    id="income"
                    type="number"
                    value={income}
                    onChange={(e) => setIncome(e.target.value)}
                    placeholder={calculatorMode === 'individual' ? 'Enter annual income' : 'Enter corporate revenue'}
                    className="text-lg"
                  />
                  {governmentData && (
                    <p className="text-xs text-muted-foreground">
                      Government revenue target: ${(governmentData.structure?.totalBudget || 0).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxYear">Tax Year</Label>
                  <Input
                    id="taxYear"
                    type="number"
                    value={taxYear}
                    onChange={(e) => setTaxYear(parseInt(e.target.value))}
                    min="2020"
                    max={new Date().getFullYear() + 10}
                  />
                </div>
              </div>

              {/* Deductions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Deductions</Label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addDeduction(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="">Add Deduction</option>
                    {deductions
                      .filter(d => !selectedDeductions.find(sd => sd.deductionId === d.id))
                      .map(d => (
                        <option key={d.id} value={d.id}>{d.deductionName}</option>
                      ))
                    }
                  </select>
                </div>

                <div className="space-y-3">
                  {selectedDeductions.map((deduction) => {
                    const deductionDef = deductions.find(d => d.id === deduction.deductionId);
                    return (
                      <div key={deduction.deductionId} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{deduction.description}</div>
                          {deductionDef?.maximumAmount && (
                            <div className="text-sm text-muted-foreground">
                              Max: {formatCurrency(deductionDef.maximumAmount)}
                            </div>
                          )}
                        </div>
                        <Input
                          type="number"
                          value={deduction.amount}
                          onChange={(e) => updateDeductionAmount(deduction.deductionId, parseFloat(e.target.value) || 0)}
                          className="w-32"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeDeduction(deduction.deductionId)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Exemptions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Exemptions</Label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addExemption(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value="">Add Exemption</option>
                    {exemptions
                      .filter(e => !selectedExemptions.find(se => se.exemptionId === e.id))
                      .map(e => (
                        <option key={e.id} value={e.id}>{e.exemptionName}</option>
                      ))
                    }
                  </select>
                </div>

                <div className="space-y-3">
                  {selectedExemptions.map((exemption) => {
                    const exemptionDef = exemptions.find(e => e.id === exemption.exemptionId);
                    return (
                      <div key={exemption.exemptionId} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{exemption.description}</div>
                          {exemptionDef?.exemptionAmount && (
                            <div className="text-sm text-muted-foreground">
                              Standard: {formatCurrency(exemptionDef.exemptionAmount)}
                            </div>
                          )}
                        </div>
                        <Input
                          type="number"
                          value={exemption.amount}
                          onChange={(e) => updateExemptionAmount(exemption.exemptionId, parseFloat(e.target.value) || 0)}
                          className="w-32"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeExemption(exemption.exemptionId)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Validation Errors */}
            {!validation.isValid && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {validation.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Live Calculation Status */}
            {enableLiveCalculation && liveCalculationResult && (
              <Alert className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
                <Zap className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Real-time server calculation active</span>
                    {calculationTimestamp && (
                      <span className="text-xs text-muted-foreground">
                        Updated: {new Date(calculationTimestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Calculations include live data from government components ({liveCalculationResult.atomicModifiers?.governmentComponents || 0}),
                    economic components ({liveCalculationResult.atomicModifiers?.economicComponents || 0}),
                    and real-time economic indicators.
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Atomic Component Impact Display */}
            {(governmentComponents.length > 0 || economicComponents.length > 0 || (liveCalculationResult?.atomicModifiers && enableLiveCalculation)) && (
              <Card className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-purple-600" />
                  Atomic Component Impact {enableLiveCalculation && '(Live)'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Tax Collection Efficiency</div>
                    <div className="text-lg font-semibold text-purple-700 dark:text-purple-300">
                      {(atomicModifiers.taxCollectionEfficiency * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {atomicModifiers.taxCollectionEfficiency > 1 ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          +{((atomicModifiers.taxCollectionEfficiency - 1) * 100).toFixed(1)}% boost
                        </span>
                      ) : atomicModifiers.taxCollectionEfficiency < 1 ? (
                        <span className="text-red-600 flex items-center gap-1">
                          <TrendingDown className="h-3 w-3" />
                          {((atomicModifiers.taxCollectionEfficiency - 1) * 100).toFixed(1)}% penalty
                        </span>
                      ) : (
                        <span className="text-gray-600">Neutral</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Economic Component Impact</div>
                    <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                      {(atomicModifiers.economicModifier * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {economicComponents.length} component{economicComponents.length !== 1 ? 's' : ''} active
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Government Component Impact</div>
                    <div className="text-lg font-semibold text-green-700 dark:text-green-300">
                      {(atomicModifiers.governmentModifier * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {governmentComponents.length} component{governmentComponents.length !== 1 ? 's' : ''} active
                    </div>
                  </div>
                </div>

                {economicComponents.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-800">
                    <div className="text-xs text-muted-foreground mb-2">Active Economic Components:</div>
                    <div className="flex flex-wrap gap-1">
                      {economicComponents.map((comp, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {comp.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {governmentComponents.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                    <div className="text-xs text-muted-foreground mb-2">Active Government Components:</div>
                    <div className="flex flex-wrap gap-1">
                      {governmentComponents.map((comp, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {comp.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Results */}
            {calculationResult && validation.isValid && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <div>
                        <div className="text-sm text-muted-foreground">Gross Income</div>
                        <div className="font-semibold text-lg">{formatCurrency(parseFloat(income))}</div>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <TrendingDown className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="text-sm text-muted-foreground">Taxable Income</div>
                        <div className="font-semibold text-lg">{formatCurrency(calculationResult.taxableIncome)}</div>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <Calculator className="h-5 w-5 text-red-600" />
                      <div>
                        <div className="text-sm text-muted-foreground">Tax Owed</div>
                        <div className="font-semibold text-lg text-red-600">{formatCurrency(calculationResult.taxOwed)}</div>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-5 w-5 text-purple-600" />
                      <div className="flex-1">
                        <div className="text-sm text-muted-foreground">Effective Rate</div>
                        <div className="font-semibold text-lg">{formatPercentage(calculationResult.effectiveRate)}</div>
                        {atomicModifiers.taxCollectionEfficiency !== 1.0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Base: {formatPercentage(calculationResult.effectiveRate / atomicModifiers.taxCollectionEfficiency)}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>

                <Card className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>After-Tax Income</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(parseFloat(income) - calculationResult.taxOwed)}
                      </span>
                    </div>
                    <Progress 
                      value={(1 - calculationResult.effectiveRate / 100) * 100} 
                      className="h-2" 
                    />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Tax: {formatPercentage(calculationResult.effectiveRate)}</span>
                      <span>Take-home: {formatPercentage(100 - calculationResult.effectiveRate)}</span>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Breakdown Tab */}
          <TabsContent value="breakdown" className="space-y-6">
            {calculationResult ? (
              <div className="space-y-6">
                {/* Category Breakdown */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Tax by Category
                  </h4>
                  
                  <div className="space-y-3">
                    {calculationResult.breakdown.map((category, index) => (
                      <Card key={category.categoryId} className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{category.categoryName}</div>
                            <div className="text-sm text-muted-foreground">
                              Rate: {formatPercentage(category.rate)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{formatCurrency(category.taxOwed)}</div>
                            <div className="text-sm text-muted-foreground">
                              on {formatCurrency(category.taxableAmount)}
                            </div>
                          </div>
                        </div>
                        {(category.exemptions > 0 || category.deductions > 0) && (
                          <div className="mt-2 pt-2 border-t text-sm text-muted-foreground">
                            {category.exemptions > 0 && (
                              <span>Exemptions: {formatCurrency(category.exemptions)} </span>
                            )}
                            {category.deductions > 0 && (
                              <span>Deductions: {formatCurrency(category.deductions)}</span>
                            )}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Bracket Breakdown */}
                {calculationResult.appliedBrackets.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-lg font-semibold flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Tax Brackets Applied
                    </h4>

                    <div className="space-y-3">
                      {calculationResult.appliedBrackets.map((bracket, index) => (
                        <Card key={bracket.bracketId} className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">
                                {bracket.bracketName || `Bracket ${index + 1}`}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {formatCurrency(bracket.minIncome)} - {
                                  bracket.maxIncome ? formatCurrency(bracket.maxIncome) : 'No Limit'
                                } • {formatPercentage(bracket.rate)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">{formatCurrency(bracket.taxOwed)}</div>
                              <div className="text-sm text-muted-foreground">
                                on {formatCurrency(bracket.taxableAmount)}
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sector Breakdown for Corporate Taxes */}
                {calculatorMode === 'corporate' && corporateCalculationResult &&
                 'sectorBreakdown' in corporateCalculationResult &&
                 (corporateCalculationResult as any).sectorBreakdown && (
                  <div className="space-y-4 mt-6">
                    <h4 className="text-lg font-semibold flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Corporate Tax by Sector
                    </h4>

                    <div className="space-y-3">
                      {(corporateCalculationResult as any).sectorBreakdown.map((sector: any, index: number) => (
                        <Card key={index} className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{sector.sector}</div>
                              <div className="text-sm text-muted-foreground">
                                Sector Income: {formatCurrency(sector.income)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">{formatCurrency(sector.taxOwed)}</div>
                              <div className="text-sm text-muted-foreground">
                                Rate: {formatPercentage(sector.effectiveRate)}
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>

                    <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-sm">
                        Corporate taxes are distributed across sectors based on their GDP contribution.
                        Each sector's tax rate reflects its specific economic characteristics and component modifiers.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Enter income in the Calculator tab to see breakdown
              </div>
            )}
          </TabsContent>

          {/* Suggestions Tab */}
          <TabsContent value="suggestions" className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-lg font-semibold flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Tax Optimization Suggestions
              </h4>

              {suggestions.length > 0 ? (
                <div className="space-y-3">
                  {suggestions.map((suggestion, index) => (
                    <Alert key={index}>
                      <Lightbulb className="h-4 w-4" />
                      <AlertDescription>{suggestion}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              ) : calculationResult ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Your tax situation looks optimized! No immediate suggestions available.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Complete the calculation to see optimization suggestions
                </div>
              )}

              {validation.warnings.length > 0 && (
                <div className="space-y-3">
                  <h5 className="font-medium">Warnings</h5>
                  {validation.warnings.map((warning, index) => (
                    <Alert key={index} variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{warning}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}