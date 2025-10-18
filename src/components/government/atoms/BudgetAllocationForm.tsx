"use client";

import React, { useState, useRef, useCallback } from 'react';
import { usePendingLocks } from '~/app/mycountry/editor/hooks/usePendingLocks';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Slider } from '~/components/ui/slider';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Button } from '~/components/ui/button';
import { IxTime } from '~/lib/ixtime';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Calculator,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import type { BudgetAllocationInput, BudgetStatus } from '~/types/government';

interface BudgetAllocationFormProps {
  data: BudgetAllocationInput;
  onChange: (data: BudgetAllocationInput) => void;
  departmentName: string;
  departmentColor: string;
  totalBudget: number;
  currency: string;
  isReadOnly?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const budgetStatusConfig = {
  'Allocated': { color: 'bg-blue-500', icon: Clock, label: 'Allocated' },
  'In Use': { color: 'bg-green-500', icon: TrendingUp, label: 'In Use' },
  'Overspent': { color: 'bg-red-500', icon: AlertTriangle, label: 'Overspent' },
  'Underutilized': { color: 'bg-yellow-500', icon: TrendingDown, label: 'Underutilized' },
  'Completed': { color: 'bg-gray-500', icon: CheckCircle, label: 'Completed' }
};

export function BudgetAllocationForm({ 
  data, 
  onChange, 
  departmentName,
  departmentColor,
  totalBudget,
  currency = 'USD',
  isReadOnly = false,
  isCollapsed = false,
  onToggleCollapse
}: BudgetAllocationFormProps) {
  const { isLocked } = usePendingLocks();

  // Use a ref to access latest data without causing re-renders
  const dataRef = useRef(data);
  dataRef.current = data;
  const totalBudgetRef = useRef(totalBudget);
  totalBudgetRef.current = totalBudget;

  const handleChange = useCallback((field: keyof BudgetAllocationInput, value: any) => {
    let updatedData = {
      ...dataRef.current,
      [field]: value
    };

    // Auto-calculate percentage when amount changes
    if (field === 'allocatedAmount' && totalBudgetRef.current > 0) {
      updatedData.allocatedPercent = Math.round((value / totalBudgetRef.current) * 100 * 1000) / 1000; // Round to 3 decimal places
    }

    // Auto-calculate amount when percentage changes
    if (field === 'allocatedPercent') {
      updatedData.allocatedAmount = Math.round((totalBudgetRef.current * value) / 100); // Round to nearest dollar
    }

    onChange(updatedData);
  }, [onChange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const utilizationRate = data.allocatedAmount > 0 
    ? ((data.allocatedAmount - (data.allocatedAmount * 0.1)) / data.allocatedAmount) * 100 // Mock utilization
    : 0;

  const getBudgetStatus = (): BudgetStatus => {
    if (utilizationRate > 100) return 'Overspent';
    if (utilizationRate < 50) return 'Underutilized';
    if (utilizationRate > 0) return 'In Use';
    return 'Allocated';
  };

  const currentStatus = getBudgetStatus();
  const statusConfig = budgetStatusConfig[currentStatus];
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onToggleCollapse && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleCollapse}
                className="p-1 h-6 w-6 hover:bg-muted"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
            <CardTitle className="flex items-center text-lg font-semibold text-[var(--color-text-primary)]">
              <DollarSign className="h-5 w-5 mr-2" style={{ color: departmentColor }} />
              {departmentName} - Budget {data.budgetYear}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              className={`${statusConfig.color} text-white`}
            >
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
            {!isCollapsed && (
              <div className="text-sm text-[var(--color-text-muted)]">
                {formatCurrency(data.allocatedAmount)}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="space-y-6">
        {/* Budget Year */}
        <div className="space-y-2">
          <Label htmlFor="budgetYear" className="text-sm font-medium text-[var(--color-text-secondary)]">
            Budget Year
          </Label>
          <Input
            id="budgetYear"
            type="number"
            value={data.budgetYear}
            onChange={(e) => handleChange('budgetYear', parseInt(e.target.value) || new Date(IxTime.getCurrentIxTime()).getFullYear())}
            disabled={isReadOnly}
            min="2020"
            max="2030"
          />
        </div>

        {/* Budget Allocation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="allocatedAmount" className="text-sm font-medium text-[var(--color-text-secondary)]">
              Allocated Amount
            </Label>
            <Input
              id="allocatedAmount"
              type="number"
              value={data.allocatedAmount}
              onChange={(e) => handleChange('allocatedAmount', parseFloat(e.target.value) || 0)}
              disabled={isReadOnly || isLocked('budgetAllocations')}
              min="0"
              step="1000000"
            />
            <p className="text-xs text-[var(--color-text-muted)]">
              {formatCurrency(data.allocatedAmount)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="allocatedPercent" className="text-sm font-medium text-[var(--color-text-secondary)]">
              Percentage of Total Budget
            </Label>
            <div className="space-y-3">
              <Slider
                id="allocatedPercent"
                value={[data.allocatedPercent]}
                onValueChange={(value) => handleChange('allocatedPercent', value[0])}
                min={0}
                max={50}
                step={0.1}
                disabled={isReadOnly || isLocked('budgetAllocations')}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                <span>0%</span>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {data.allocatedPercent.toFixed(1)}%
                </span>
                <span>50%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Budget Utilization Visual */}
        <div className="space-y-3 p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-primary)]">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-[var(--color-text-primary)]">Budget Utilization</h4>
            <span className="text-sm font-medium" style={{ color: departmentColor }}>
              {utilizationRate.toFixed(1)}%
            </span>
          </div>
          
          <Progress 
            value={utilizationRate} 
            className="w-full h-3"
            style={{ 
              '--progress-background': departmentColor,
            } as React.CSSProperties}
          />
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium text-[var(--color-text-primary)]">
                {formatNumber(data.allocatedAmount)}
              </div>
              <div className="text-[var(--color-text-muted)]">Allocated</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-[var(--color-text-primary)]">
                {formatNumber(data.allocatedAmount * 0.9)} {/* Mock spent amount */}
              </div>
              <div className="text-[var(--color-text-muted)]">Utilized</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-[var(--color-text-primary)]">
                {formatNumber(data.allocatedAmount * 0.1)} {/* Mock available amount */}
              </div>
              <div className="text-[var(--color-text-muted)]">Remaining</div>
            </div>
          </div>
        </div>

        {/* Budget Breakdown Visualization */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-[var(--color-text-primary)]">Budget Context</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <Calculator className="h-4 w-4 text-[var(--color-text-muted)]" />
                <span className="text-xs text-[var(--color-text-muted)]">vs Total</span>
              </div>
              <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                {data.allocatedPercent.toFixed(1)}%
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                of {formatNumber(totalBudget)} total budget
              </div>
            </div>

            <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="h-4 w-4 text-[var(--color-text-muted)]" />
                <span className="text-xs text-[var(--color-text-muted)]">Per Citizen</span>
              </div>
              <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                {formatNumber(data.allocatedAmount / 100000)} {/* Mock per capita */}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                estimated spending per citizen
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes" className="text-sm font-medium text-[var(--color-text-secondary)]">
            Notes
          </Label>
          <textarea
            id="notes"
            value={data.notes || ''}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Additional notes about this budget allocation..."
            disabled={isReadOnly}
            rows={3}
            className="w-full px-3 py-2 border border-[var(--color-border-primary)] rounded-md bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)] focus:border-transparent resize-none"
          />
        </div>

        {/* Auto-Balance Helper */}
        {!isReadOnly && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleChange('allocatedPercent', 5)}
              className="text-xs"
            >
              Set to 5%
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleChange('allocatedPercent', 10)}
              className="text-xs"
            >
              Set to 10%
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleChange('allocatedPercent', 15)}
              className="text-xs"
            >
              Set to 15%
            </Button>
          </div>
        )}
      </CardContent>
      )}
    </Card>
  );
}