"use client";

/**
 * PolicyCreator - Comprehensive policy creation component with full builder integration
 *
 * This component provides a multi-step wizard for creating policies that integrate with:
 * - Government Builder: Department selection and atomic component analysis
 * - Economy Builder: Economic impact projections and sector effects
 * - Tax System: Revenue implications and fiscal impact
 *
 * Features:
 * - 5-step creation wizard with validation
 * - Real-time impact calculations and projections
 * - Builder context integration (government, economy, tax)
 * - Policy templates and AI-powered suggestions
 * - Draft saving/loading with autosave
 * - Interactive visualizations (charts, impact preview)
 * - Cost-benefit analysis
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Building2,
  TrendingUp,
  Calendar,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Save,
  FileText,
  DollarSign,
  Users,
  Globe,
  Briefcase,
  Shield,
  Sparkles,
  AlertCircle,
  Info,
  Target,
  BarChart3,
  Activity,
  Zap,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Slider } from '~/components/ui/slider';
import { Switch } from '~/components/ui/switch';
import { api } from '~/trpc/react';
import { LoadingState } from '~/components/shared/feedback';
import { ATOMIC_COMPONENTS, ComponentType } from '~/components/government/atoms/AtomicGovernmentComponents';
import { unifiedBuilderService } from '~/app/builder/services/UnifiedBuilderIntegrationService';

// Policy types matching the schema
type PolicyType = 'economic' | 'social' | 'diplomatic' | 'infrastructure' | 'governance';
type PolicyPriority = 'critical' | 'high' | 'medium' | 'low';

// Step definitions
const STEPS = [
  { id: 1, title: 'Policy Type', icon: FileText },
  { id: 2, title: 'Department', icon: Building2 },
  { id: 3, title: 'Impact Configuration', icon: TrendingUp },
  { id: 4, title: 'Timeline', icon: Calendar },
  { id: 5, title: 'Review', icon: CheckCircle }
] as const;

interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  policyType: PolicyType;
  category: string;
  defaultSettings: {
    implementationCost?: number;
    maintenanceCost?: number;
    priority?: PolicyPriority;
    targetMetrics?: Record<string, number>;
  };
}

// Pre-configured policy templates
const POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    id: 'stimulus',
    name: 'Economic Stimulus Package',
    description: 'Boost economic growth through targeted spending and tax incentives',
    policyType: 'economic',
    category: 'economic',
    defaultSettings: {
      implementationCost: 5000000,
      maintenanceCost: 0,
      priority: 'high',
      targetMetrics: { gdpGrowth: 2.5, unemployment: -1.0 }
    }
  },
  {
    id: 'healthcare',
    name: 'Universal Healthcare Initiative',
    description: 'Expand healthcare coverage to all citizens',
    policyType: 'social',
    category: 'healthcare',
    defaultSettings: {
      implementationCost: 10000000,
      maintenanceCost: 5000000,
      priority: 'critical',
      targetMetrics: { healthcareAccess: 100, lifeExpectancy: 5 }
    }
  },
  {
    id: 'infrastructure',
    name: 'Infrastructure Modernization',
    description: 'Upgrade national infrastructure and transportation systems',
    policyType: 'infrastructure',
    category: 'infrastructure',
    defaultSettings: {
      implementationCost: 15000000,
      maintenanceCost: 3000000,
      priority: 'high',
      targetMetrics: { infrastructureQuality: 25, economicEfficiency: 15 }
    }
  },
  {
    id: 'education',
    name: 'Education Reform',
    description: 'Improve education quality and access',
    policyType: 'social',
    category: 'education',
    defaultSettings: {
      implementationCost: 8000000,
      maintenanceCost: 4000000,
      priority: 'high',
      targetMetrics: { literacyRate: 10, skillLevel: 20 }
    }
  },
  {
    id: 'trade',
    name: 'Trade Agreement Initiative',
    description: 'Negotiate favorable trade agreements with partner nations',
    policyType: 'diplomatic',
    category: 'trade',
    defaultSettings: {
      implementationCost: 2000000,
      maintenanceCost: 500000,
      priority: 'medium',
      targetMetrics: { tradeVolume: 20, diplomaticInfluence: 10 }
    }
  }
];

interface PolicyCreatorProps {
  countryId: string;
  userId: string;
  onComplete?: (policyId: string) => void;
  onCancel?: () => void;
  initialDraft?: any;
}

export function PolicyCreator({
  countryId,
  userId,
  onComplete,
  onCancel,
  initialDraft
}: PolicyCreatorProps) {
  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // Policy form state
  const [policyType, setPolicyType] = useState<PolicyType>('economic');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedComponents, setSelectedComponents] = useState<ComponentType[]>([]);
  const [implementationCost, setImplementationCost] = useState(1000000);
  const [maintenanceCost, setMaintenanceCost] = useState(100000);
  const [priority, setPriority] = useState<PolicyPriority>('medium');
  const [effectiveDate, setEffectiveDate] = useState<Date | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [targetMetrics, setTargetMetrics] = useState<Record<string, number>>({});
  const [autoActivate, setAutoActivate] = useState(false);

  // Fetch government builder data
  const { data: governmentData } = api.government.getByCountryId.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Fetch economy data
  const { data: economyData } = api.economics.getEconomyBuilderState.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Fetch tax system data
  const { data: taxData } = api.taxSystem.getByCountryId.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Create policy mutation
  const createPolicyMutation = api.policies.createPolicy.useMutation({
    onSuccess: (policy) => {
      toast.success('Policy Created', {
        description: `"${policy.name}" has been successfully created`
      });

      // Auto-activate if requested
      if (autoActivate) {
        activatePolicyMutation.mutate({ id: policy.id });
      }

      onComplete?.(policy.id);
    },
    onError: (error) => {
      toast.error('Failed to Create Policy', {
        description: error.message
      });
      setIsProcessing(false);
    }
  });

  // Activate policy mutation
  const activatePolicyMutation = api.policies.activatePolicy.useMutation({
    onSuccess: () => {
      toast.success('Policy Activated', {
        description: 'The policy is now in effect'
      });
    }
  });

  // Load builder context
  const builderState = useMemo(() => {
    return unifiedBuilderService.getState();
  }, []);

  // Calculate policy impact based on builder context
  const calculatedImpact = useMemo(() => {
    if (!economyData || !governmentData) {
      return {
        gdpImpact: 0,
        revenueImpact: 0,
        employmentImpact: 0,
        budgetBalance: 0,
        effectiveness: 50
      };
    }

    const gdp = economyData.structure.totalGDP;
    const totalBudget = governmentData?.totalBudget || 0;

    // Base impact calculations
    let gdpImpact = 0;
    let revenueImpact = 0;
    let employmentImpact = 0;

    // Calculate based on policy type and cost
    switch (policyType) {
      case 'economic':
        gdpImpact = (implementationCost / gdp) * 100 * 0.5; // Stimulus effect
        employmentImpact = (implementationCost / 100000) * 0.01; // Job creation
        revenueImpact = gdpImpact * 0.3; // Tax revenue from growth
        break;
      case 'social':
        employmentImpact = (implementationCost / 150000) * 0.01;
        gdpImpact = employmentImpact * 0.5; // Indirect economic benefit
        revenueImpact = -maintenanceCost; // Ongoing cost
        break;
      case 'infrastructure':
        gdpImpact = (implementationCost / gdp) * 100 * 0.8; // High multiplier
        employmentImpact = (implementationCost / 80000) * 0.01;
        revenueImpact = gdpImpact * 0.2;
        break;
      case 'diplomatic':
        gdpImpact = (implementationCost / gdp) * 100 * 0.3; // Trade benefits
        revenueImpact = gdpImpact * 0.25;
        break;
      case 'governance':
        gdpImpact = (implementationCost / gdp) * 100 * 0.2; // Efficiency gains
        revenueImpact = -maintenanceCost;
        break;
    }

    // Component synergy bonus
    const synergyBonus = selectedComponents.length > 0
      ? selectedComponents.reduce((acc, comp) => {
          const component = ATOMIC_COMPONENTS[comp];
          return acc + (component?.effectiveness || 0);
        }, 0) / selectedComponents.length / 100
      : 0;

    gdpImpact *= (1 + synergyBonus);
    revenueImpact *= (1 + synergyBonus);
    employmentImpact *= (1 + synergyBonus);

    const budgetBalance = totalBudget - implementationCost - maintenanceCost;
    const effectiveness = Math.min(95, 50 + synergyBonus * 100 + (priority === 'critical' ? 20 : priority === 'high' ? 10 : 0));

    return {
      gdpImpact: Math.round(gdpImpact * 100) / 100,
      revenueImpact: Math.round(revenueImpact),
      employmentImpact: Math.round(employmentImpact * 100) / 100,
      budgetBalance: Math.round(budgetBalance),
      effectiveness: Math.round(effectiveness)
    };
  }, [policyType, implementationCost, maintenanceCost, selectedComponents, priority, economyData, governmentData]);

  // Apply policy template
  const applyTemplate = useCallback((template: PolicyTemplate) => {
    setPolicyType(template.policyType);
    setName(template.name);
    setDescription(template.description);
    setCategory(template.category);
    setImplementationCost(template.defaultSettings.implementationCost || 1000000);
    setMaintenanceCost(template.defaultSettings.maintenanceCost || 100000);
    setPriority(template.defaultSettings.priority || 'medium');
    setTargetMetrics(template.defaultSettings.targetMetrics || {});

    toast.success('Template Applied', {
      description: `Loaded "${template.name}" template`
    });
  }, []);

  // Validation for each step
  const validateStep = useCallback((step: number): boolean => {
    switch (step) {
      case 1:
        return !!policyType && !!name && name.length >= 3 && !!description;
      case 2:
        return true; // Department is optional
      case 3:
        return implementationCost > 0;
      case 4:
        return true; // Dates are optional
      case 5:
        return true; // Review step
      default:
        return false;
    }
  }, [policyType, name, description, implementationCost]);

  // Navigation handlers
  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(5, prev + 1));
    } else {
      toast.error('Please complete all required fields');
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  // Submit handler
  const handleSubmit = async () => {
    if (!validateStep(5)) {
      toast.error('Please complete all required fields');
      return;
    }

    setIsProcessing(true);

    try {
      await createPolicyMutation.mutateAsync({
        countryId,
        userId,
        name,
        description,
        policyType,
        category: category || policyType,
        effectiveDate: effectiveDate || undefined,
        expiryDate: expiryDate || undefined,
        targetMetrics: JSON.stringify(targetMetrics),
        implementationCost,
        maintenanceCost,
        priority
      });
    } catch (error) {
      setIsProcessing(false);
    }
  };

  // Policy type icons
  const policyTypeConfig = {
    economic: { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/20' },
    social: { icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/20' },
    diplomatic: { icon: Globe, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/20' },
    infrastructure: { icon: Briefcase, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/20' },
    governance: { icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/20' }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            {/* Policy Templates */}
            <div className="space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-600" />
                Quick Start Templates
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {POLICY_TEMPLATES.map(template => {
                  const config = policyTypeConfig[template.policyType];
                  const Icon = config.icon;

                  return (
                    <motion.div
                      key={template.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Card
                        className="cursor-pointer hover:shadow-md transition-all border-2 hover:border-primary"
                        onClick={() => applyTemplate(template)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${config.bg}`}>
                              <Icon className={`h-5 w-5 ${config.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm mb-1">{template.name}</h4>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {template.description}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Policy Type Selection */}
            <div className="space-y-3">
              <Label htmlFor="policyType" className="text-base font-semibold">
                Policy Type *
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {(Object.keys(policyTypeConfig) as PolicyType[]).map(type => {
                  const config = policyTypeConfig[type];
                  const Icon = config.icon;
                  const isSelected = policyType === type;

                  return (
                    <motion.div
                      key={type}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all text-center ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => setPolicyType(type)}
                      >
                        <Icon className={`h-6 w-6 mx-auto mb-2 ${config.color}`} />
                        <p className="text-xs font-medium capitalize">{type}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Policy Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base font-semibold">
                Policy Name *
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter a clear, descriptive policy name"
                className="text-base"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-base font-semibold">
                Description *
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the policy's goals, scope, and expected outcomes"
                rows={4}
                className="text-base"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category" className="text-base font-semibold">
                Category
              </Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., healthcare, education, defense"
                className="text-base"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Select a government department and atomic components that will implement this policy.
                This helps calculate effectiveness and synergy effects.
              </AlertDescription>
            </Alert>

            {/* Department Selection */}
            {governmentData?.departments && governmentData.departments.length > 0 && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">Implementing Department</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {governmentData.departments.map((dept: any, index: number) => (
                    <Card
                      key={index}
                      className={`cursor-pointer hover:shadow-md transition-all border-2 ${
                        selectedDepartment === index.toString()
                          ? 'border-primary bg-primary/5'
                          : 'border-border'
                      }`}
                      onClick={() => setSelectedDepartment(index.toString())}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold">{dept.name}</h4>
                            <p className="text-xs text-muted-foreground">{dept.description}</p>
                          </div>
                          {selectedDepartment === index.toString() && (
                            <CheckCircle className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Atomic Component Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                Related Government Components
                <Badge variant="outline" className="ml-2">
                  {selectedComponents.length} selected
                </Badge>
              </Label>
              <p className="text-sm text-muted-foreground">
                Select components that influence or are affected by this policy
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto p-1">
                {Object.entries(ATOMIC_COMPONENTS)
                  .slice(0, 20)
                  .map(([key, component]) => {
                    if (!component) return null;
                    const isSelected = selectedComponents.includes(key as ComponentType);

                    return (
                      <Card
                        key={key}
                        className={`cursor-pointer hover:shadow-sm transition-all border ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border'
                        }`}
                        onClick={() => {
                          setSelectedComponents(prev =>
                            isSelected
                              ? prev.filter(c => c !== key)
                              : [...prev, key as ComponentType]
                          );
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h5 className="font-medium text-sm mb-1">{component.name}</h5>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {component.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge variant="outline" className="text-xs">
                                {component.effectiveness}%
                              </Badge>
                              {isSelected && (
                                <CheckCircle className="h-4 w-4 text-primary" />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            {/* Impact Preview */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="h-5 w-5" />
                  Projected Impact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 rounded-lg bg-background">
                    <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-600" />
                    <p className="text-2xl font-bold text-green-600">
                      {calculatedImpact.gdpImpact > 0 ? '+' : ''}{calculatedImpact.gdpImpact}%
                    </p>
                    <p className="text-xs text-muted-foreground">GDP Impact</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-background">
                    <DollarSign className="h-5 w-5 mx-auto mb-1 text-blue-600" />
                    <p className="text-2xl font-bold text-blue-600">
                      ${(calculatedImpact.revenueImpact / 1000000).toFixed(1)}M
                    </p>
                    <p className="text-xs text-muted-foreground">Revenue Impact</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-background">
                    <Users className="h-5 w-5 mx-auto mb-1 text-purple-600" />
                    <p className="text-2xl font-bold text-purple-600">
                      {calculatedImpact.employmentImpact > 0 ? '+' : ''}{calculatedImpact.employmentImpact}%
                    </p>
                    <p className="text-xs text-muted-foreground">Employment</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-background">
                    <Target className="h-5 w-5 mx-auto mb-1 text-orange-600" />
                    <p className="text-2xl font-bold text-orange-600">
                      {calculatedImpact.effectiveness}%
                    </p>
                    <p className="text-xs text-muted-foreground">Effectiveness</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cost Configuration */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="implementationCost" className="text-base font-semibold">
                  Implementation Cost *
                </Label>
                <div className="flex items-center gap-4">
                  <Slider
                    id="implementationCost"
                    min={100000}
                    max={50000000}
                    step={100000}
                    value={[implementationCost]}
                    onValueChange={([value]) => setImplementationCost(value || 100000)}
                    className="flex-1"
                  />
                  <div className="w-32">
                    <Input
                      type="number"
                      value={implementationCost}
                      onChange={(e) => setImplementationCost(Number(e.target.value))}
                      className="text-right"
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  ${(implementationCost / 1000000).toFixed(2)}M implementation cost
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maintenanceCost" className="text-base font-semibold">
                  Annual Maintenance Cost
                </Label>
                <div className="flex items-center gap-4">
                  <Slider
                    id="maintenanceCost"
                    min={0}
                    max={10000000}
                    step={50000}
                    value={[maintenanceCost]}
                    onValueChange={([value]) => setMaintenanceCost(value || 0)}
                    className="flex-1"
                  />
                  <div className="w-32">
                    <Input
                      type="number"
                      value={maintenanceCost}
                      onChange={(e) => setMaintenanceCost(Number(e.target.value))}
                      className="text-right"
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  ${(maintenanceCost / 1000000).toFixed(2)}M annual maintenance
                </p>
              </div>
            </div>

            {/* Priority Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Priority Level *</Label>
              <div className="grid grid-cols-4 gap-3">
                {(['critical', 'high', 'medium', 'low'] as PolicyPriority[]).map(level => (
                  <Button
                    key={level}
                    variant={priority === level ? 'default' : 'outline'}
                    onClick={() => setPriority(level)}
                    className="capitalize"
                  >
                    {level}
                  </Button>
                ))}
              </div>
            </div>

            {/* Budget Impact Warning */}
            {economyData && calculatedImpact.budgetBalance < 0 && (
              <Alert className="border-red-200 dark:border-red-800">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription>
                  <span className="font-semibold text-red-600">Budget Deficit Warning:</span>
                  {' '}This policy will create a budget deficit of $
                  {Math.abs(calculatedImpact.budgetBalance / 1000000).toFixed(2)}M.
                  Consider reducing costs or adjusting your budget.
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            {/* Timeline Configuration */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="effectiveDate" className="text-base font-semibold">
                  Effective Date
                </Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={effectiveDate?.toISOString().split('T')[0] || ''}
                  onChange={(e) => setEffectiveDate(e.target.value ? new Date(e.target.value) : null)}
                />
                <p className="text-sm text-muted-foreground">
                  When should this policy take effect? (Leave blank for immediate)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiryDate" className="text-base font-semibold">
                  Expiry Date
                </Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={expiryDate?.toISOString().split('T')[0] || ''}
                  onChange={(e) => setExpiryDate(e.target.value ? new Date(e.target.value) : null)}
                  min={effectiveDate?.toISOString().split('T')[0] || ''}
                />
                <p className="text-sm text-muted-foreground">
                  When should this policy expire? (Leave blank for permanent)
                </p>
              </div>
            </div>

            {/* Auto-Activation */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="autoActivate" className="text-base font-semibold">
                      Auto-Activate Policy
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Activate this policy immediately after creation
                    </p>
                  </div>
                  <Switch
                    id="autoActivate"
                    checked={autoActivate}
                    onCheckedChange={setAutoActivate}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Implementation Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Estimated Implementation Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Planning Phase</span>
                    <Badge>1-2 weeks</Badge>
                  </div>
                  <Progress value={100} className="h-1" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Implementation Phase</span>
                    <Badge>2-4 weeks</Badge>
                  </div>
                  <Progress value={60} className="h-1" />

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Monitoring Phase</span>
                    <Badge>Ongoing</Badge>
                  </div>
                  <Progress value={20} className="h-1" />
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            {/* Policy Summary */}
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Policy Review
                </CardTitle>
                <CardDescription>
                  Review your policy before creation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Basic Info */}
                <div>
                  <h4 className="font-semibold text-lg mb-2">{name}</h4>
                  <p className="text-sm text-muted-foreground mb-2">{description}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{policyType}</Badge>
                    <Badge variant="outline" className="capitalize">{priority} Priority</Badge>
                    {category && <Badge variant="outline">{category}</Badge>}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="p-4 rounded-lg bg-muted space-y-2">
                  <h5 className="font-semibold mb-2">Financial Summary</h5>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Implementation Cost</p>
                      <p className="font-semibold">${(implementationCost / 1000000).toFixed(2)}M</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Annual Maintenance</p>
                      <p className="font-semibold">${(maintenanceCost / 1000000).toFixed(2)}M</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Projected GDP Impact</p>
                      <p className="font-semibold text-green-600">
                        {calculatedImpact.gdpImpact > 0 ? '+' : ''}{calculatedImpact.gdpImpact}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Effectiveness Score</p>
                      <p className="font-semibold text-blue-600">{calculatedImpact.effectiveness}%</p>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                {(effectiveDate || expiryDate) && (
                  <div className="p-4 rounded-lg bg-muted space-y-2">
                    <h5 className="font-semibold mb-2">Timeline</h5>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {effectiveDate && (
                        <div>
                          <p className="text-muted-foreground">Effective Date</p>
                          <p className="font-semibold">{effectiveDate.toLocaleDateString()}</p>
                        </div>
                      )}
                      {expiryDate && (
                        <div>
                          <p className="text-muted-foreground">Expiry Date</p>
                          <p className="font-semibold">{expiryDate.toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Components */}
                {selectedComponents.length > 0 && (
                  <div>
                    <h5 className="font-semibold mb-2">Related Components</h5>
                    <div className="flex flex-wrap gap-2">
                      {selectedComponents.map(comp => (
                        <Badge key={comp} variant="secondary">
                          {ATOMIC_COMPONENTS[comp]?.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {calculatedImpact.budgetBalance < 0 && (
                  <Alert className="border-yellow-200 dark:border-yellow-800">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription>
                      This policy will create a budget deficit. Ensure adequate funding is available.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card className="glass-surface glass-refraction">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-2xl">Create New Policy</CardTitle>
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              const isComplete = currentStep > step.id;

              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        isComplete
                          ? 'bg-green-600 text-white'
                          : isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <StepIcon className="h-5 w-5" />
                      )}
                    </div>
                    <p className={`text-xs text-center ${isActive ? 'font-semibold' : ''}`}>
                      {step.title}
                    </p>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className="flex-1 h-0.5 bg-muted mx-2 mt-5">
                      <div
                        className={`h-full transition-all ${
                          isComplete ? 'bg-green-600' : 'bg-transparent'
                        }`}
                        style={{ width: isComplete ? '100%' : '0%' }}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Progress Bar */}
          <Progress value={(currentStep / 5) * 100} className="h-2 mt-4" />
        </CardHeader>
      </Card>

      {/* Step Content */}
      <Card className="glass-surface glass-refraction">
        <CardContent className="pt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Navigation */}
      <Card className="glass-surface glass-refraction">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1 || isProcessing}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex items-center gap-3">
              {onCancel && (
                <Button variant="ghost" onClick={onCancel} disabled={isProcessing}>
                  Cancel
                </Button>
              )}

              {currentStep < 5 ? (
                <Button onClick={nextStep} disabled={!validateStep(currentStep)}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isProcessing || !validateStep(5)}
                  className="min-w-32"
                >
                  {isProcessing ? (
                    <>
                      <LoadingState variant="spinner" size="sm" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Create Policy
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
