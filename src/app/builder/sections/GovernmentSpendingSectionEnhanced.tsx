"use client";

import React, { useState } from 'react';
import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import {
  EnhancedSlider,
  EnhancedToggle,
  EnhancedPieChart,
  EnhancedBarChart,
  MetricCard,
} from '../primitives/enhanced';
import type { EconomicInputs } from '../lib/economy-data-service';
import type { SectionContentProps } from '../types/builder';
import {
  Shield, Heart, GraduationCap, Building2, Trees, Briefcase,
  Users, TrendingUp, AlertCircle, Settings, Coins,
  CheckCircle2, XCircle, Info, Target, Zap, Lock,
  Globe, Wifi, Recycle, Baby, UserCheck, Home,
  Microscope, Landmark, Plane, DollarSign, Sparkles
} from 'lucide-react';

interface GovernmentSpendingSectionProps extends SectionContentProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
}

const SPENDING_CATEGORIES = [
  { id: 'Education', name: 'Education', icon: GraduationCap, color: 'blue', min: 5, max: 35, description: 'Primary, secondary, higher education, and research' },
  { id: 'Healthcare', name: 'Healthcare', icon: Heart, color: 'red', min: 5, max: 40, description: 'Hospitals, public health, medical research' },
  { id: 'Defense', name: 'Defense & Security', icon: Shield, color: 'slate', min: 0, max: 30, description: 'Military, police, intelligence services' },
  { id: 'Infrastructure', name: 'Infrastructure', icon: Building2, color: 'amber', min: 3, max: 25, description: 'Roads, bridges, utilities, public transport' },
  { id: 'Social Security', name: 'Social Security', icon: Users, color: 'purple', min: 5, max: 35, description: 'Pensions, unemployment benefits, disability' },
  { id: 'Environment', name: 'Environment', icon: Trees, color: 'green', min: 0, max: 15, description: 'Conservation, renewable energy, climate programs' },
  { id: 'Science', name: 'Science & Tech', icon: Microscope, color: 'cyan', min: 0, max: 10, description: 'R&D, space programs, innovation grants' },
  { id: 'Agriculture', name: 'Agriculture', icon: Trees, color: 'yellow', min: 0, max: 10, description: 'Farming subsidies, rural development' },
  { id: 'Housing', name: 'Housing & Urban', icon: Home, color: 'orange', min: 0, max: 15, description: 'Public housing, urban development' },
  { id: 'Administration', name: 'Administration', icon: Landmark, color: 'gray', min: 2, max: 10, description: 'Government operations, civil service' }
];

const SPENDING_POLICIES = [
  // Existing policies
  {
    id: 'performanceBasedBudgeting',
    name: 'Performance-Based Budgeting',
    description: 'Link budget allocations to measurable outcomes',
    icon: Target,
    impact: { efficiency: 15, transparency: 20 }
  },
  {
    id: 'universalBasicServices',
    name: 'Universal Basic Services',
    description: 'Provide free essential services to all citizens',
    icon: Heart,
    impact: { equality: 25, cost: 20 }
  },
  {
    id: 'greenInvestmentPriority',
    name: 'Green Investment Priority',
    description: 'Prioritize environmentally sustainable projects',
    icon: Recycle,
    impact: { environment: 30, growth: -5 }
  },
  {
    id: 'digitalGovernmentInitiative',
    name: 'Digital Government Initiative',
    description: 'Digitize all government services and processes',
    icon: Wifi,
    impact: { efficiency: 25, accessibility: 30 }
  },
  // New advanced policies
  {
    id: 'zeroBasedBudgeting',
    name: 'Zero-Based Budgeting',
    description: 'Rebuild budget from zero each fiscal year',
    icon: DollarSign,
    impact: { efficiency: 20, flexibility: -10 }
  },
  {
    id: 'publicPrivatePartnerships',
    name: 'Public-Private Partnerships',
    description: 'Collaborate with private sector for public projects',
    icon: Briefcase,
    impact: { efficiency: 15, privatization: 25 }
  },
  {
    id: 'participatoryBudgeting',
    name: 'Participatory Budgeting',
    description: 'Citizens directly decide on portions of budget',
    icon: Users,
    impact: { democracy: 30, efficiency: -10 }
  },
  {
    id: 'emergencyReserveFund',
    name: 'Emergency Reserve Fund',
    description: 'Maintain reserve fund for crisis response',
    icon: Shield,
    impact: { stability: 25, flexibility: 20 }
  },
  {
    id: 'socialImpactBonds',
    name: 'Social Impact Bonds',
    description: 'Private funding for social programs with outcome-based returns',
    icon: TrendingUp,
    impact: { innovation: 20, privatization: 15 }
  },
  {
    id: 'childWelfareFirstPolicy',
    name: 'Child Welfare First',
    description: 'Prioritize spending on children and family services',
    icon: Baby,
    impact: { education: 20, social: 25 }
  },
  {
    id: 'preventiveCareEmphasis',
    name: 'Preventive Care Emphasis',
    description: 'Focus healthcare spending on prevention',
    icon: Heart,
    impact: { health: 25, longTermSavings: 20 }
  },
  {
    id: 'infrastructureBankFund',
    name: 'Infrastructure Bank',
    description: 'Create dedicated infrastructure investment bank',
    icon: Landmark,
    impact: { infrastructure: 30, debt: 10 }
  }
];

export function GovernmentSpendingSectionEnhanced({
  inputs,
  onInputsChange
}: GovernmentSpendingSectionProps) {
  const [activeTab, setActiveTab] = useState('allocation');
  const [selectedPolicies, setSelectedPolicies] = useState<Set<string>>(new Set());
  const [presetsOpen, setPresetsOpen] = useState(false);

  // Initialize selected policies from inputs
  React.useEffect(() => {
    const policies = new Set<string>();
    if (inputs.governmentSpending.performanceBasedBudgeting) policies.add('performanceBasedBudgeting');
    if (inputs.governmentSpending.universalBasicServices) policies.add('universalBasicServices');
    if (inputs.governmentSpending.greenInvestmentPriority) policies.add('greenInvestmentPriority');
    if (inputs.governmentSpending.digitalGovernmentInitiative) policies.add('digitalGovernmentInitiative');
    setSelectedPolicies(policies);
  }, [inputs.governmentSpending]);

  // Calculate current spending allocation
  const spendingData = SPENDING_CATEGORIES.map(cat => {
    const categoryData = inputs.governmentSpending.spendingCategories.find(
      c => c.category === cat.id
    );
    return {
      ...cat,
      value: categoryData?.percent || 0,
      amount: categoryData?.amount || 0
    };
  });

  const totalSpending = spendingData.reduce((sum, cat) => sum + cat.value, 0);
  const isValidBudget = Math.abs(totalSpending - 100) <= 0.1;

  const updateSpending = (categoryId: string, value: number) => {
    const category = SPENDING_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return;

    // Clamp to min/max
    const clampedValue = Math.max(category.min, Math.min(category.max, value));

    onInputsChange({
      ...inputs,
      governmentSpending: {
        ...inputs.governmentSpending,
        spendingCategories: inputs.governmentSpending.spendingCategories.map(c =>
          c.category === categoryId
            ? { ...c, percent: clampedValue }
            : c
        )
      }
    });
  };

  const togglePolicy = (policyId: string) => {
    const newPolicies = new Set(selectedPolicies);
    if (newPolicies.has(policyId)) {
      newPolicies.delete(policyId);
    } else {
      newPolicies.add(policyId);
    }
    setSelectedPolicies(newPolicies);

    // Update the known policy fields
    const updatedSpending = { ...inputs.governmentSpending };
    if (policyId === 'performanceBasedBudgeting') {
      updatedSpending.performanceBasedBudgeting = newPolicies.has(policyId);
    } else if (policyId === 'universalBasicServices') {
      updatedSpending.universalBasicServices = newPolicies.has(policyId);
    } else if (policyId === 'greenInvestmentPriority') {
      updatedSpending.greenInvestmentPriority = newPolicies.has(policyId);
    } else if (policyId === 'digitalGovernmentInitiative') {
      updatedSpending.digitalGovernmentInitiative = newPolicies.has(policyId);
    }

    onInputsChange({
      ...inputs,
      governmentSpending: updatedSpending
    });
  };

  const autoBalance = () => {
    const targetTotal = 100;
    const currentTotal = totalSpending;

    if (Math.abs(currentTotal - targetTotal) < 0.1) return;

    const scaleFactor = targetTotal / currentTotal;

    const newCategories = inputs.governmentSpending.spendingCategories.map(cat => {
      const category = SPENDING_CATEGORIES.find(c => c.id === cat.category);
      if (!category) return cat;

      const newValue = cat.percent * scaleFactor;
      const clampedValue = Math.max(category.min, Math.min(category.max, newValue));

      return {
        ...cat,
        percent: Number(clampedValue.toFixed(1))
      };
    });

    onInputsChange({
      ...inputs,
      governmentSpending: {
        ...inputs.governmentSpending,
        spendingCategories: newCategories
      }
    });
  };

  const applyPreset = (preset: 'balanced' | 'social' | 'security' | 'growth') => {
    const presets = {
      balanced: {
        Education: 18,
        Healthcare: 20,
        Defense: 12,
        Infrastructure: 15,
        'Social Security': 20,
        Environment: 5,
        Science: 3,
        Agriculture: 2,
        Housing: 3,
        Administration: 2
      },
      social: {
        Education: 25,
        Healthcare: 30,
        Defense: 5,
        Infrastructure: 10,
        'Social Security': 18,
        Environment: 4,
        Science: 2,
        Agriculture: 2,
        Housing: 2,
        Administration: 2
      },
      security: {
        Education: 10,
        Healthcare: 15,
        Defense: 30,
        Infrastructure: 12,
        'Social Security': 15,
        Environment: 3,
        Science: 8,
        Agriculture: 2,
        Housing: 3,
        Administration: 2
      },
      growth: {
        Education: 22,
        Healthcare: 15,
        Defense: 8,
        Infrastructure: 25,
        'Social Security': 12,
        Environment: 8,
        Science: 5,
        Agriculture: 2,
        Housing: 2,
        Administration: 1
      }
    };

    const selectedPreset = presets[preset];
    const newCategories = SPENDING_CATEGORIES.map(cat => ({
      category: cat.id,
      percent: selectedPreset[cat.id as keyof typeof selectedPreset] || 0,
      amount: 0
    }));

    onInputsChange({
      ...inputs,
      governmentSpending: {
        ...inputs.governmentSpending,
        spendingCategories: newCategories
      }
    });

    setPresetsOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header with Budget Status */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Government Spending Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Allocate budget across government sectors and set spending policies
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={isValidBudget ? "default" : "destructive"}
            className="px-3 py-1"
          >
            {isValidBudget ? (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Budget Balanced
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                {totalSpending.toFixed(1)}% Allocated
              </>
            )}
          </Badge>

          {/* Preset Dialog */}
          <Dialog open={presetsOpen} onOpenChange={setPresetsOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Sparkles className="h-4 w-4 mr-2" />
                Presets
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Budget Presets</DialogTitle>
                <DialogDescription>
                  Select a preset budget allocation to quickly configure spending priorities
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Card
                  className="cursor-pointer hover:shadow-lg transition-all hover:border-blue-500"
                  onClick={() => applyPreset('balanced')}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Target className="h-5 w-5 text-blue-500" />
                      Balanced Budget
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Even distribution across all essential services
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Education</span>
                        <span className="font-medium">18%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Healthcare</span>
                        <span className="font-medium">20%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Infrastructure</span>
                        <span className="font-medium">15%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover:shadow-lg transition-all hover:border-blue-500"
                  onClick={() => applyPreset('social')}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Heart className="h-5 w-5 text-blue-500" />
                      Social Welfare Focus
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Prioritize health, education, and social services
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Education</span>
                        <span className="font-medium">25%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Healthcare</span>
                        <span className="font-medium">30%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Social Security</span>
                        <span className="font-medium">18%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover:shadow-lg transition-all hover:border-blue-500"
                  onClick={() => applyPreset('security')}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Shield className="h-5 w-5 text-blue-500" />
                      Security Priority
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Emphasis on defense and national security
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Defense</span>
                        <span className="font-medium">30%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Science & Tech</span>
                        <span className="font-medium">8%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Infrastructure</span>
                        <span className="font-medium">12%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover:shadow-lg transition-all hover:border-blue-500"
                  onClick={() => applyPreset('growth')}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-5 w-5 text-blue-500" />
                      Economic Growth
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Focus on infrastructure and education for growth
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Infrastructure</span>
                        <span className="font-medium">25%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Education</span>
                        <span className="font-medium">22%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Environment</span>
                        <span className="font-medium">8%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            onClick={autoBalance}
            disabled={isValidBudget}
            size="sm"
            variant="outline"
          >
            Auto-Balance
          </Button>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="allocation">
            <Coins className="h-4 w-4 mr-2" />
            Allocation
          </TabsTrigger>
          <TabsTrigger value="policies">
            <Settings className="h-4 w-4 mr-2" />
            Policies
          </TabsTrigger>
          <TabsTrigger value="visualization">
            <TrendingUp className="h-4 w-4 mr-2" />
            Analysis
          </TabsTrigger>
        </TabsList>

        {/* Budget Allocation Tab */}
        <TabsContent value="allocation" className="space-y-4 mt-6">
          <div className="grid gap-4">
            {spendingData.map((category) => {
              const Icon = category.icon;
              return (
                <Card key={category.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            `bg-${category.color}-500/10`
                          )}>
                            <Icon className={cn("h-5 w-5", `text-${category.color}-600`)} />
                          </div>
                          <div>
                            <h4 className="font-medium">{category.name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {category.description}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            {category.value.toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {category.min}% - {category.max}%
                          </div>
                        </div>
                      </div>
                      <EnhancedSlider
                        value={category.value}
                        onChange={(value) => updateSpending(category.id, value)}
                        min={category.min}
                        max={category.max}
                        step={0.1}
                        label=""
                        showValue={false}
                        sectionId="spending"
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Policies Tab */}
        <TabsContent value="policies" className="mt-6">
          <div className="grid gap-3">
            {SPENDING_POLICIES.map((policy) => {
              const Icon = policy.icon;
              const isSelected = selectedPolicies.has(policy.id);

              return (
                <Card
                  key={policy.id}
                  className={cn(
                    "cursor-pointer transition-all",
                    isSelected && "ring-2 ring-blue-500"
                  )}
                  onClick={() => togglePolicy(policy.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "p-2 rounded-lg transition-colors",
                          isSelected
                            ? "bg-blue-500/10"
                            : "bg-muted"
                        )}>
                          <Icon className={cn(
                            "h-5 w-5 transition-colors",
                            isSelected
                              ? "text-blue-600"
                              : "text-muted-foreground"
                          )} />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-medium">{policy.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {policy.description}
                          </p>
                          <div className="flex gap-2 mt-2">
                            {Object.entries(policy.impact).map(([key, value]) => (
                              <Badge
                                key={key}
                                variant="outline"
                                className="text-xs"
                              >
                                {key}: {value > 0 ? '+' : ''}{value}%
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="mt-1">
                        {isSelected ? (
                          <CheckCircle2 className="h-5 w-5 text-blue-500" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Visualization Tab */}
        <TabsContent value="visualization" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Spending Distribution</CardTitle>
                <CardDescription>
                  Percentage allocation across government sectors
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EnhancedPieChart
                  data={spendingData.map(cat => ({
                    name: cat.name,
                    value: cat.value,
                    color: cat.color
                  }))}
                  height={300}
                  sectionId="spending"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Spending Priorities</CardTitle>
                <CardDescription>
                  Budget allocation by priority level
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EnhancedBarChart
                  data={spendingData
                    .sort((a, b) => b.value - a.value)
                    .map(cat => ({
                      name: cat.name,
                      value: cat.value
                    }))}
                  height={300}
                  sectionId="spending"
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Budget"
              value={`${inputs.governmentSpending.totalSpending}%`}
              subtitle="of GDP"
              icon={DollarSign}
              trend={5}
              sectionId="spending"
            />
            <MetricCard
              title="Social Spending"
              value={`${(spendingData.find(c => c.id === 'Education')?.value || 0) +
                       (spendingData.find(c => c.id === 'Healthcare')?.value || 0) +
                       (spendingData.find(c => c.id === 'Social Security')?.value || 0)}%`}
              subtitle="Education, Health, Social"
              icon={Heart}
              sectionId="spending"
            />
            <MetricCard
              title="Infrastructure"
              value={`${spendingData.find(c => c.id === 'Infrastructure')?.value || 0}%`}
              subtitle="Physical infrastructure"
              icon={Building2}
              sectionId="spending"
            />
            <MetricCard
              title="Active Policies"
              value={selectedPolicies.size}
              subtitle="spending policies"
              icon={Settings}
              sectionId="spending"
            />
          </div>
        </TabsContent>

        {/* Presets Tab */}
        <TabsContent value="presets" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => applyPreset('balanced')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Balanced Budget
                </CardTitle>
                <CardDescription>
                  Even distribution across all essential services
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Education</span>
                    <span className="font-medium">18%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Healthcare</span>
                    <span className="font-medium">20%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Infrastructure</span>
                    <span className="font-medium">15%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => applyPreset('social')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Social Welfare Focus
                </CardTitle>
                <CardDescription>
                  Prioritize health, education, and social services
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Education</span>
                    <span className="font-medium">25%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Healthcare</span>
                    <span className="font-medium">30%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Social Security</span>
                    <span className="font-medium">18%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => applyPreset('security')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Priority
                </CardTitle>
                <CardDescription>
                  Emphasis on defense and national security
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Defense</span>
                    <span className="font-medium">30%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Science & Tech</span>
                    <span className="font-medium">8%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Infrastructure</span>
                    <span className="font-medium">12%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => applyPreset('growth')}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Economic Growth
                </CardTitle>
                <CardDescription>
                  Focus on infrastructure and education for growth
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Infrastructure</span>
                    <span className="font-medium">25%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Education</span>
                    <span className="font-medium">22%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Environment</span>
                    <span className="font-medium">8%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Presets provide starting points that you can further customize. All values will be adjusted to fit within allowed ranges.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}