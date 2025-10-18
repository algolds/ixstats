"use client";

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { 
  Building2, 
  Users,
  DollarSign,
  Receipt,
  Eye,
  Save,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { GovernmentBuilder } from '~/components/government';
import { BudgetManagementDashboard } from '~/components/government/BudgetManagementDashboard';
import { GovernmentStructurePreview } from './GovernmentStructurePreview';
import { IxTime } from '~/lib/ixtime';
import type { GovernmentBuilderState } from '~/types/government';

interface GovernmentBuilderWithPreviewProps {
  onSave?: (data: GovernmentBuilderState) => Promise<void>;
  governmentData?: GovernmentBuilderState | null;
  gdpData?: {
    nominalGDP: number;
    countryName?: string;
  };
}

export function GovernmentBuilderWithPreview({
  onSave,
  governmentData,
  gdpData
}: GovernmentBuilderWithPreviewProps) {
  const [activeTab, setActiveTab] = useState('builder');
  const [isSaving, setIsSaving] = useState(false);
  const [currentGovernmentData, setCurrentGovernmentData] = useState<GovernmentBuilderState | null>(governmentData || null);

  // Update local state when governmentData prop changes
  useEffect(() => {
    setCurrentGovernmentData(governmentData || null);
  }, [governmentData]);

  const handleGovernmentChange = (data: GovernmentBuilderState) => {
    setCurrentGovernmentData(data);
  };

  const handleSave = async () => {
    if (!currentGovernmentData || !onSave) return;
    
    setIsSaving(true);
    try {
      await onSave(currentGovernmentData);
      toast.success('Government structure saved successfully!');
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Failed to save government structure');
    } finally {
      setIsSaving(false);
    }
  };

  const validateGovernmentData = (data: GovernmentBuilderState | null | undefined): { isValid: boolean; errors: string[] } => {
    if (!data) {
      return { isValid: false, errors: ['No government data available'] };
    }

    const errors: string[] = [];

    // Check structure
    if (!data.structure.governmentName) {
      errors.push('Government name is required');
    }
    if (data.structure.totalBudget <= 0) {
      errors.push('Total budget must be greater than 0');
    }

    // Check departments
    if (data.departments.length === 0) {
      errors.push('At least one department is required');
    }

    // Check budget allocations
    const totalBudgetAllocated = data.budgetAllocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0);
    if (Math.abs(totalBudgetAllocated - data.structure.totalBudget) > 1000) {
      errors.push('Budget allocations must equal total budget');
    }

    // Check revenue sources
    if (data.revenueSources.length === 0) {
      errors.push('At least one revenue source is required');
    }

    const totalRevenue = data.revenueSources.reduce((sum, rev) => sum + rev.revenueAmount, 0);
    if (Math.abs(totalRevenue - data.structure.totalBudget) > 1000) {
      errors.push('Revenue sources must equal total budget');
    }

    return { isValid: errors.length === 0, errors };
  };

  const validation = validateGovernmentData(currentGovernmentData || null);
  const hasGovernmentData = !!currentGovernmentData && currentGovernmentData.departments.length > 0;

  const getBudgetTrendData = () => {
    if (!currentGovernmentData || !gdpData?.nominalGDP) return [];

    const currentYear = new Date(IxTime.getCurrentIxTime()).getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear + i - 2);
    
    return years.map(year => ({
      year: year.toString(),
      budget: currentGovernmentData.structure.totalBudget,
      revenue: currentGovernmentData.revenueSources.reduce((sum, r) => sum + r.revenueAmount, 0),
      gdp: gdpData.nominalGDP * Math.pow(1.03, year - currentYear), // 3% GDP growth assumption
      budgetAsPercentGDP: ((currentGovernmentData.structure.totalBudget / gdpData.nominalGDP) * 100).toFixed(1)
    }));
  };

  const getGovernmentOverview = () => {
    if (!currentGovernmentData) return null;

    return {
      name: currentGovernmentData.structure.governmentName,
      type: currentGovernmentData.structure.governmentType,
      fiscalYear: currentGovernmentData.structure.fiscalYear,
      budgetYear: new Date(IxTime.getCurrentIxTime()).getFullYear(),
      totalBudget: currentGovernmentData.structure.totalBudget,
      currency: currentGovernmentData.structure.budgetCurrency,
      departments: currentGovernmentData.departments.length,
      totalDepartments: currentGovernmentData.departments.length,
      budgetAllocations: currentGovernmentData.budgetAllocations.length,
      revenueSources: currentGovernmentData.revenueSources.length,
      budgetUtilization: currentGovernmentData.structure.totalBudget > 0 
        ? ((currentGovernmentData.budgetAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0) / currentGovernmentData.structure.totalBudget) * 100).toFixed(1)
        : '0.0'
    };
  };

  const overview = getGovernmentOverview();
  const trendData = getBudgetTrendData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Design Government Structure
          </h2>
          <p className="text-muted-foreground mt-1">
            Build your nation's government system and preview the results
          </p>
        </div>
        <div className="flex items-center gap-2">
          {validation.isValid && hasGovernmentData && (
            <Badge variant="default" className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Complete
            </Badge>
          )}
          {!validation.isValid && hasGovernmentData && (
            <Badge variant="destructive" className="bg-red-100 text-red-800">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Issues Found
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="builder">
            <Building2 className="h-4 w-4 mr-2" />
            Government Builder
          </TabsTrigger>
          <TabsTrigger value="preview" disabled={!hasGovernmentData}>
            <Eye className="h-4 w-4 mr-2" />
            Preview & Save
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="mt-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <GovernmentBuilder
              initialData={currentGovernmentData || undefined}
              onChange={handleGovernmentChange}
              onSave={async (structure) => {
                // This will be handled by the parent component
              }}
              hideSaveButton={true}
              gdpData={gdpData}
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            {/* Validation Errors */}
            {!validation.isValid && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader>
                  <CardTitle className="text-red-800 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Issues Found
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1 text-red-700">
                    {validation.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Comprehensive Government Structure Preview */}
            {hasGovernmentData && (
              <GovernmentStructurePreview 
                governmentStructure={currentGovernmentData}
                governmentComponents={[]} // This component doesn't track atomic components separately
              />
            )}

            {/* Budget vs Revenue Trend */}
            {trendData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Budget vs Revenue Trend (IxTime Years)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {trendData.map((data, index) => (
                        <div key={index} className="text-center">
                          <p className="text-sm text-muted-foreground">Year {data.year}</p>
                          <div className="space-y-1">
                            <p className="text-xs">Budget: {data.budget.toLocaleString()}</p>
                            <p className="text-xs">Revenue: {data.revenue.toLocaleString()}</p>
                            <p className="text-xs">GDP: {data.gdp.toLocaleString()}</p>
                            <p className="text-xs font-semibold">{data.budgetAsPercentGDP}% of GDP</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Detailed Budget Dashboard */}
            {hasGovernmentData && (
              <BudgetManagementDashboard
                governmentStructure={{
                  id: 'preview',
                  countryId: 'preview',
                  ...currentGovernmentData.structure,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  departments: [],
                  budgetAllocations: [],
                  revenueSources: []
                }}
                departments={currentGovernmentData.departments.map((d, i) => ({
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
                budgetAllocations={currentGovernmentData.budgetAllocations.map(a => ({
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
                  department: currentGovernmentData.departments.find((_, i) => i.toString() === a.departmentId)! as any
                }))}
                revenueSources={currentGovernmentData.revenueSources.map((r, i) => ({
                  id: i.toString(),
                  governmentStructureId: 'preview',
                  ...r,
                  isActive: true,
                  revenuePercent: currentGovernmentData.structure.totalBudget > 0 ? (r.revenueAmount / currentGovernmentData.structure.totalBudget) * 100 : 0,
                  createdAt: new Date(),
                  updatedAt: new Date()
                }))}
                isReadOnly={true}
              />
            )}

            {/* Save Button */}
            {hasGovernmentData && (
              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={!validation.isValid || isSaving}
                  className="min-w-32"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Government
                    </>
                  )}
                </Button>
              </div>
            )}
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
