"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Progress } from '~/components/ui/progress';
import { Button } from '~/components/ui/button';
import {
  Building2,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
  DollarSign,
  BarChart3,
  PieChart,
  Scale,
  Zap,
  ArrowUpDown,
  Lightbulb,
  AlertCircle,
  Shield
} from 'lucide-react';

import type { TaxCategory, TaxSystem } from '~/types/tax-system';
import type { GovernmentDepartment, BudgetAllocation } from '~/types/government';

interface TaxGovernmentSyncProps {
  taxSystem?: TaxSystem;
  departments?: GovernmentDepartment[];
  budgetAllocations?: BudgetAllocation[];
  onSync?: () => void;
  className?: string;
}

interface DepartmentFunding {
  department: GovernmentDepartment;
  allocation: BudgetAllocation;
  fundedBy: {
    categoryName: string;
    amount: number;
    percent: number;
  }[];
  fundingGap: number;
  overallHealth: 'healthy' | 'warning' | 'critical';
}

export function TaxGovernmentSyncDisplay({
  taxSystem,
  departments = [],
  budgetAllocations = [],
  onSync = () => {},
  className = ""
}: TaxGovernmentSyncProps) {

  // Calculate total tax revenue
  const totalTaxRevenue = React.useMemo(() => {
    if (!taxSystem?.taxCategories) return 0;
    return taxSystem.taxCategories.reduce((sum, cat) => {
      const estimatedRevenue = (cat.baseRate || 0) * 1000000;
      return sum + estimatedRevenue;
    }, 0);
  }, [taxSystem]);

  // Calculate total budget requirement
  const totalBudgetRequired = React.useMemo(() => {
    return budgetAllocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0);
  }, [budgetAllocations]);

  // Calculate surplus/deficit
  const fiscalBalance = totalTaxRevenue - totalBudgetRequired;
  const fiscalBalancePercent = totalBudgetRequired > 0
    ? (fiscalBalance / totalBudgetRequired) * 100
    : 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Fiscal Balance */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/20">
                <ArrowUpDown className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <CardTitle className="text-xl font-semibold">Tax-Government Revenue Sync</CardTitle>
                <p className="text-sm text-muted-foreground">
                  How tax revenue funds government departments
                </p>
              </div>
            </div>

            <Button
              onClick={onSync}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Tax Revenue</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                ₡{totalTaxRevenue.toLocaleString()}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Budget Required</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                ₡{totalBudgetRequired.toLocaleString()}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Fiscal Balance</div>
              <div className={`text-2xl font-bold ${fiscalBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {fiscalBalance >= 0 ? '+' : ''}₡{fiscalBalance.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {fiscalBalance >= 0 ? 'Surplus' : 'Deficit'} ({fiscalBalancePercent.toFixed(1)}%)
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fiscal Balance Alert */}
      {fiscalBalance < 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Budget Deficit Warning:</strong> Tax revenue is insufficient to cover all department allocations.
            Consider increasing tax rates or reducing spending by ₡{Math.abs(fiscalBalance).toLocaleString()}.
          </AlertDescription>
        </Alert>
      )}

      {fiscalBalance > totalBudgetRequired * 0.2 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Large Surplus Detected:</strong> You have ₡{fiscalBalance.toLocaleString()} in surplus revenue.
            Consider reducing tax burden or increasing public services.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
