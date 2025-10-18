// SpendingAnalysis Component
// Refactored from GovernmentSpendingSectionEnhanced.tsx
// Visualization and analysis of spending patterns and priorities

"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import {
  EnhancedPieChart,
  EnhancedBarChart,
  MetricCard
} from '../../primitives/enhanced';
import { DollarSign, Heart, Building2, Settings } from 'lucide-react';

interface SpendingData {
  id: string;
  name: string;
  value: number;
  color: string;
}

interface SpendingAnalysisProps {
  spendingData: SpendingData[];
  totalSpendingPercent: number;
  selectedPoliciesCount: number;
  className?: string;
}

/**
 * SpendingAnalysis - Visualizes spending distribution and priorities
 * Includes pie charts, bar charts, and key metrics
 */
export function SpendingAnalysis({
  spendingData,
  totalSpendingPercent,
  selectedPoliciesCount,
  className
}: SpendingAnalysisProps) {
  // Calculate social spending (Education + Healthcare + Social Security)
  const socialSpending = [
    spendingData.find(c => c.id === 'Education')?.value || 0,
    spendingData.find(c => c.id === 'Healthcare')?.value || 0,
    spendingData.find(c => c.id === 'Social Security')?.value || 0
  ].reduce((sum, val) => sum + val, 0);

  const infrastructureSpending = spendingData.find(c => c.id === 'Infrastructure')?.value || 0;

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Visualization Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spending Distribution Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Spending Distribution</CardTitle>
              <CardDescription>
                Percentage allocation across government sectors
              </CardDescription>
            </CardHeader>
            <CardContent>
              {spendingData.length > 0 ? (
                <EnhancedPieChart
                  data={spendingData.map(cat => ({
                    name: cat.name,
                    value: cat.value,
                    color: cat.color
                  }))}
                  dataKey="value"
                  nameKey="name"
                  height={300}
                  sectionId="spending"
                />
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    No spending data available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Spending Priorities Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Spending Priorities</CardTitle>
              <CardDescription>
                Budget allocation by priority level
              </CardDescription>
            </CardHeader>
            <CardContent>
              {spendingData.length > 0 ? (
                <EnhancedBarChart
                  data={spendingData
                    .sort((a, b) => b.value - a.value)
                    .map(cat => ({
                      name: cat.name,
                      value: cat.value
                    }))}
                  xKey="name"
                  yKey="value"
                  height={300}
                  sectionId="spending"
                />
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    No spending data available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total Budget"
            value={`${totalSpendingPercent}%`}
            description="of GDP"
            icon={DollarSign}
            trend="up"
            sectionId="spending"
          />
          <MetricCard
            label="Social Spending"
            value={`${socialSpending.toFixed(1)}%`}
            description="Education, Health, Social"
            icon={Heart}
            sectionId="spending"
          />
          <MetricCard
            label="Infrastructure"
            value={`${infrastructureSpending.toFixed(1)}%`}
            description="Physical infrastructure"
            icon={Building2}
            sectionId="spending"
          />
          <MetricCard
            label="Active Policies"
            value={selectedPoliciesCount}
            description="spending policies"
            icon={Settings}
            sectionId="spending"
          />
        </div>

        {/* Spending Breakdown Table */}
        {spendingData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Detailed Breakdown</CardTitle>
              <CardDescription>
                Complete spending allocation by sector
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {spendingData
                  .sort((a, b) => b.value - a.value)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${item.value}%`,
                              backgroundColor: item.color
                            }}
                          />
                        </div>
                        <span className="text-sm font-semibold min-w-[3rem] text-right">
                          {item.value.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
