"use client";

import React, { useState, useMemo, useEffect } from 'react';
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
  Minus
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
import { TaxCalculatorEngine } from '~/lib/tax-calculator';

interface TaxCalculatorProps {
  taxSystem: TaxSystem;
  categories: TaxCategory[];
  brackets: TaxBracket[];
  exemptions: TaxExemption[];
  deductions: TaxDeduction[];
  onCalculationChange?: (result: TaxCalculationResult | null) => void;
}

export function TaxCalculator({
  taxSystem,
  categories,
  brackets,
  exemptions,
  deductions,
  onCalculationChange
}: TaxCalculatorProps) {
  const [income, setIncome] = useState<string>('100000');
  const [taxYear, setTaxYear] = useState<number>(new Date().getFullYear());
  const [selectedDeductions, setSelectedDeductions] = useState<TaxDeductionAmount[]>([]);
  const [selectedExemptions, setSelectedExemptions] = useState<TaxExemptionAmount[]>([]);
  const [activeTab, setActiveTab] = useState<'calculator' | 'breakdown' | 'suggestions'>('calculator');

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

  // Calculate tax result
  const calculationResult = useMemo(() => {
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
      return calculatorEngine.calculate(request);
    } catch (error) {
      console.error('Tax calculation error:', error);
      return null;
    }
  }, [income, taxYear, selectedDeductions, selectedExemptions, calculatorEngine, taxSystem.id]);

  useEffect(() => {
    onCalculationChange?.(calculationResult);
  }, [calculationResult, onCalculationChange]);

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
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Calculator className="h-5 w-5 text-blue-600" />
          </div>
          Tax Calculator
          <Badge variant="outline">{taxSystem.taxSystemName}</Badge>
        </CardTitle>
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
                  <Label htmlFor="income">Annual Income</Label>
                  <Input
                    id="income"
                    type="number"
                    value={income}
                    onChange={(e) => setIncome(e.target.value)}
                    placeholder="Enter annual income"
                    className="text-lg"
                  />
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
                      <div>
                        <div className="text-sm text-muted-foreground">Effective Rate</div>
                        <div className="font-semibold text-lg">{formatPercentage(calculationResult.effectiveRate)}</div>
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