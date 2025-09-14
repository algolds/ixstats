"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  PieChart as PieChartIcon,
  Calculator,
  Target,
  Clock,
  Users,
  Building2
} from 'lucide-react';
import type { 
  GovernmentStructure, 
  GovernmentDepartment, 
  BudgetAllocation,
  RevenueSource,
  BudgetSummary,
  RevenueSummary 
} from '~/types/government';

interface BudgetManagementDashboardProps {
  governmentStructure: GovernmentStructure;
  departments: GovernmentDepartment[];
  budgetAllocations: BudgetAllocation[];
  revenueSources: RevenueSource[];
  onUpdateBudget?: (departmentId: string, allocation: Partial<BudgetAllocation>) => void;
  isReadOnly?: boolean;
}

export function BudgetManagementDashboard({
  governmentStructure,
  departments,
  budgetAllocations,
  revenueSources,
  onUpdateBudget,
  isReadOnly = false
}: BudgetManagementDashboardProps) {
  const [selectedView, setSelectedView] = useState<'overview' | 'departments' | 'revenue' | 'analysis'>('overview');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Calculate budget summary
  const budgetSummary: BudgetSummary = useMemo(() => {
    const currentYearAllocations = budgetAllocations.filter(a => a.budgetYear === selectedYear);
    const totalAllocated = currentYearAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
    const totalSpent = currentYearAllocations.reduce((sum, a) => sum + a.spentAmount, 0);
    const totalAvailable = totalAllocated - totalSpent;
    const utilizationRate = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

    const topSpendingDepartments = currentYearAllocations
      .map(allocation => ({
        department: departments.find(d => d.id === allocation.departmentId)!,
        allocation
      }))
      .filter(item => item.department)
      .sort((a, b) => b.allocation.allocatedAmount - a.allocation.allocatedAmount)
      .slice(0, 5);

    return {
      totalBudget: governmentStructure.totalBudget,
      totalAllocated,
      totalSpent,
      totalAvailable,
      utilizationRate,
      departmentCount: departments.length,
      topSpendingDepartments
    };
  }, [budgetAllocations, departments, governmentStructure.totalBudget, selectedYear]);

  // Calculate revenue summary
  const revenueSummary: RevenueSummary = useMemo(() => {
    const totalRevenue = revenueSources.reduce((sum, r) => sum + r.revenueAmount, 0);
    const totalTaxRevenue = revenueSources
      .filter(r => r.category.includes('Tax'))
      .reduce((sum, r) => sum + r.revenueAmount, 0);
    const totalNonTaxRevenue = totalRevenue - totalTaxRevenue;

    const revenueCategories = ['Direct Tax', 'Indirect Tax', 'Non-Tax Revenue', 'Fees and Fines', 'Other'] as const;
    const revenueBreakdown = revenueCategories.map(category => {
      const amount = revenueSources
        .filter(r => r.category === category)
        .reduce((sum, r) => sum + r.revenueAmount, 0);
      return {
        category,
        amount,
        percent: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0
      };
    }).filter(item => item.amount > 0);

    const topRevenueSources = revenueSources
      .sort((a, b) => b.revenueAmount - a.revenueAmount)
      .slice(0, 5);

    return {
      totalRevenue,
      totalTaxRevenue,
      totalNonTaxRevenue,
      revenueBreakdown,
      topRevenueSources
    };
  }, [revenueSources]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: governmentStructure.budgetCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toFixed(0);
  };

  // Prepare chart data
  const departmentChartData = budgetAllocations
    .filter(a => a.budgetYear === selectedYear)
    .map(allocation => {
      const department = departments.find(d => d.id === allocation.departmentId);
      return {
        name: department?.shortName || department?.name || 'Unknown',
        allocated: allocation.allocatedAmount,
        spent: allocation.spentAmount,
        available: allocation.availableAmount,
        percent: allocation.allocatedPercent,
        color: department?.color || '#6b7280'
      };
    })
    .sort((a, b) => b.allocated - a.allocated);

  const revenueChartData = revenueSummary.revenueBreakdown.map(item => ({
    name: item.category,
    value: item.amount,
    percent: item.percent
  }));

  const budgetTrendData = [2020, 2021, 2022, 2023, 2024].map(year => ({
    year: year.toString(),
    budget: governmentStructure.totalBudget * (0.95 + Math.random() * 0.1), // Mock trend data
    spent: governmentStructure.totalBudget * (0.85 + Math.random() * 0.1),
    revenue: revenueSummary.totalRevenue * (0.9 + Math.random() * 0.2)
  }));

  const getBudgetHealthStatus = () => {
    const deficit = revenueSummary.totalRevenue - budgetSummary.totalSpent;
    const deficitPercent = revenueSummary.totalRevenue > 0 ? (deficit / revenueSummary.totalRevenue) * 100 : 0;
    
    if (deficitPercent > 5) return { status: 'surplus', color: 'text-green-600', label: 'Surplus' };
    if (deficitPercent > -3) return { status: 'balanced', color: 'text-blue-600', label: 'Balanced' };
    if (deficitPercent > -10) return { status: 'moderate', color: 'text-yellow-600', label: 'Moderate Deficit' };
    return { status: 'deficit', color: 'text-red-600', label: 'High Deficit' };
  };

  const budgetHealth = getBudgetHealthStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
            {governmentStructure.governmentName} Budget
          </h1>
          <p className="text-[var(--color-text-muted)] mt-1">
            {governmentStructure.governmentType} • {selectedYear} {governmentStructure.fiscalYear}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-[var(--color-border-primary)] rounded-md bg-[var(--color-bg-primary)]"
          >
            {[2024, 2023, 2022, 2021, 2020].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <Badge className={budgetHealth.color}>
            {budgetHealth.label}
          </Badge>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-muted)]">Total Budget</p>
                <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {formatNumber(budgetSummary.totalBudget)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-[var(--color-brand-primary)]" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-[var(--color-text-muted)]">
                {formatCurrency(budgetSummary.totalBudget)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-muted)]">Allocated</p>
                <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {formatNumber(budgetSummary.totalAllocated)}
                </p>
              </div>
              <Target className="h-8 w-8 text-blue-600" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-[var(--color-text-muted)]">
                {budgetSummary.totalBudget > 0 ? ((budgetSummary.totalAllocated / budgetSummary.totalBudget) * 100).toFixed(1) : 0}% of total
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-muted)]">Utilized</p>
                <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {formatNumber(budgetSummary.totalSpent)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-[var(--color-text-muted)]">
                {budgetSummary.utilizationRate.toFixed(1)}% utilization
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-muted)]">Revenue</p>
                <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {formatNumber(revenueSummary.totalRevenue)}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-600" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-[var(--color-text-muted)]">
                {revenueSummary.totalTaxRevenue > 0 ? ((revenueSummary.totalTaxRevenue / revenueSummary.totalRevenue) * 100).toFixed(1) : 0}% from taxes
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={selectedView} onValueChange={(value: any) => setSelectedView(value)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Budget Allocation Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Budget Allocation by Department</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={departmentChartData.slice(0, 8)}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="allocated"
                        label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}
                      >
                        {departmentChartData.slice(0, 8).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Revenue Sources Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      <Bar dataKey="value" fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Budget vs Revenue Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Budget vs Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={budgetTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Legend />
                    <Line type="monotone" dataKey="budget" stroke="#6366f1" name="Budget" strokeWidth={2} />
                    <Line type="monotone" dataKey="spent" stroke="#ef4444" name="Spending" strokeWidth={2} />
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" name="Revenue" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments" className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {budgetSummary.topSpendingDepartments.map(({ department, allocation }) => (
              <Card key={department.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: department.color }}
                      />
                      <div>
                        <h3 className="font-semibold text-[var(--color-text-primary)]">
                          {department.name}
                        </h3>
                        <p className="text-sm text-[var(--color-text-muted)]">
                          {department.category} • {department.ministerTitle}: {department.minister || 'Vacant'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-[var(--color-text-primary)]">
                        {formatNumber(allocation.allocatedAmount)}
                      </p>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {allocation.allocatedPercent.toFixed(1)}% of budget
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--color-text-muted)]">Budget Utilization</span>
                      <span className="font-medium">
                        {allocation.allocatedAmount > 0 ? ((allocation.spentAmount / allocation.allocatedAmount) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <Progress 
                      value={allocation.allocatedAmount > 0 ? (allocation.spentAmount / allocation.allocatedAmount) * 100 : 0}
                      className="h-2"
                    />
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-[var(--color-text-muted)]">Allocated</p>
                        <p className="font-semibold">{formatNumber(allocation.allocatedAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[var(--color-text-muted)]">Spent</p>
                        <p className="font-semibold">{formatNumber(allocation.spentAmount)}</p>
                      </div>
                      <div>
                        <p className="text-[var(--color-text-muted)]">Remaining</p>
                        <p className="font-semibold">{formatNumber(allocation.availableAmount)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tax vs Non-Tax Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">Tax Revenue</p>
                      <p className="text-sm text-[var(--color-text-muted)]">Direct & Indirect Taxes</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
                        {formatNumber(revenueSummary.totalTaxRevenue)}
                      </p>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {revenueSummary.totalRevenue > 0 ? ((revenueSummary.totalTaxRevenue / revenueSummary.totalRevenue) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
                    <div>
                      <p className="font-semibold text-[var(--color-text-primary)]">Non-Tax Revenue</p>
                      <p className="text-sm text-[var(--color-text-muted)]">Fees, Fines & Other Sources</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-600">
                        {formatNumber(revenueSummary.totalNonTaxRevenue)}
                      </p>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {revenueSummary.totalRevenue > 0 ? ((revenueSummary.totalNonTaxRevenue / revenueSummary.totalRevenue) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Revenue Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {revenueSummary.topRevenueSources.map((source, index) => (
                    <div key={source.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-[var(--color-brand-primary)] text-white rounded-full flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-[var(--color-text-primary)]">{source.name}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">{source.category}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-[var(--color-text-primary)]">
                          {formatNumber(source.revenueAmount)}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {source.revenuePercent.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Budget Health Indicators</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
                  <span className="text-sm font-medium">Fiscal Balance</span>
                  <Badge className={budgetHealth.color}>
                    {budgetHealth.label}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
                  <span className="text-sm font-medium">Budget Utilization</span>
                  <span className={`font-bold ${budgetSummary.utilizationRate > 90 ? 'text-green-600' : budgetSummary.utilizationRate > 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {budgetSummary.utilizationRate.toFixed(1)}%
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
                  <span className="text-sm font-medium">Revenue Adequacy</span>
                  <span className={`font-bold ${revenueSummary.totalRevenue > budgetSummary.totalAllocated ? 'text-green-600' : 'text-red-600'}`}>
                    {revenueSummary.totalRevenue > budgetSummary.totalAllocated ? 'Adequate' : 'Insufficient'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
                  <span className="text-sm font-medium">Departments</span>
                  <span className="font-bold text-[var(--color-text-primary)]">
                    {budgetSummary.departmentCount} Active
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Budget Efficiency Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-4">
                  <div className="text-4xl font-bold text-[var(--color-brand-primary)]">
                    {Math.min(100, Math.round((budgetSummary.utilizationRate + (revenueSummary.totalRevenue > budgetSummary.totalSpent ? 20 : -20) + (budgetSummary.departmentCount > 5 ? 10 : 0)) * 0.8))}
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)]">Overall Efficiency Score</p>
                  <div className="space-y-2 text-left">
                    <div className="flex items-center justify-between text-xs">
                      <span>Utilization Rate</span>
                      <span>{budgetSummary.utilizationRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>Fiscal Health</span>
                      <span>{budgetHealth.label}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>Department Coverage</span>
                      <span>{budgetSummary.departmentCount} depts</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}