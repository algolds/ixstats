"use client";

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '~/components/ui/card';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Progress } from '~/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '~/components/ui/dialog';
import {
  Building2,
  Factory,
  Users,
  TrendingUp,
  Target,
  Settings,
  AlertTriangle,
  CheckCircle,
  Info,
  Save,
  ArrowLeft,
  ArrowRight,
  Zap,
  BarChart3,
  Globe,
  Brain,
  Leaf,
  DollarSign,
  PieChart,
  Gauge,
  Eye,
  RefreshCw,
  HelpCircle,
  Atom,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

// Economy Builder Components
import { AtomicEconomicComponentSelector } from '~/components/economy/atoms/AtomicEconomicComponents';
import {
  EconomicEffectiveness,
  EconomicImpactPreview
} from '~/components/economy/atoms/AtomicEconomicUI';
import {
  EconomicComponentType,
  ATOMIC_ECONOMIC_COMPONENTS
} from '~/components/economy/atoms/AtomicEconomicComponents';

// Types and Services
import type {
  EconomyBuilderState,
  EconomyBuilderTab,
  EconomicHealthMetrics,
  CrossBuilderIntegration
} from '~/types/economy-builder';
import type { EconomicInputs } from '../../lib/economy-data-service';
import type { TaxBuilderState } from '~/components/tax-system/TaxBuilder';
import { economyIntegrationService } from '../../services/EconomyIntegrationService';

// Tab Components
import { EconomySectorsTab } from './tabs/EconomySectorsTab';
import { LaborEmploymentTab } from './tabs/LaborEmploymentTab';
import { DemographicsPopulationTab } from './tabs/DemographicsPopulationTab';

// Step Components
import { ComponentSelectionStep } from './steps/ComponentSelectionStep';
import { TaxSystemStep } from './steps/TaxSystemStep';
import { PreviewStep } from './steps/PreviewStep';

// Cross-Builder Integration Components
import { BuilderIntegrationSidebar } from './BuilderIntegrationSidebar';
import { CrossBuilderSynergyDisplay } from './CrossBuilderSynergyDisplay';
import { BidirectionalTaxSyncDisplay } from './BidirectionalTaxSyncDisplay';
import { BidirectionalGovernmentSyncDisplay } from './BidirectionalGovernmentSyncDisplay';
import { UnifiedEffectivenessDisplay } from './UnifiedEffectivenessDisplay';
import { SynergyValidationDisplay } from './SynergyValidationDisplay';
import { EconomicArchetypeModal } from './EconomicArchetypeModal';
import { UnifiedValidationDisplay } from './UnifiedValidationDisplay';
import { IntegrationTestingDisplay } from './IntegrationTestingDisplay';

// tRPC API
import { api } from '~/trpc/react';

interface EconomyBuilderPageProps {
  economicInputs: EconomicInputs;
  onEconomicInputsChange: (inputs: EconomicInputs) => void;
  governmentComponents?: any[];
  governmentBuilderData?: any;
  taxSystemData?: any;
  countryId?: string;
  className?: string;
  onSelectedComponentsChange?: (components: EconomicComponentType[]) => void;
  showAdvanced?: boolean;
  selectedComponents?: EconomicComponentType[];
  economicHealthMetrics?: EconomicHealthMetrics;
}

export function EconomyBuilderPage({
  economicInputs,
  onEconomicInputsChange,
  governmentComponents = [],
  governmentBuilderData,
  taxSystemData,
  countryId,
  className = "",
  onSelectedComponentsChange,
  showAdvanced = false,
  selectedComponents: propsSelectedComponents = [],
  economicHealthMetrics
}: EconomyBuilderPageProps) {

  // State Management - Memoized to prevent unnecessary re-renders
  const [economyBuilder, setEconomyBuilder] = useState<EconomyBuilderState>(() => ({
    structure: {
      economicModel: 'Mixed Economy',
      primarySectors: [],
      secondarySectors: [],
      tertiarySectors: [],
      totalGDP: 0,
      gdpCurrency: economicInputs.nationalIdentity?.currency || 'USD',
      economicTier: 'Developing',
      growthStrategy: 'Balanced'
    },
    sectors: [],
    laborMarket: {
      totalWorkforce: 0,
      laborForceParticipationRate: 65,
      employmentRate: 95,
      unemploymentRate: 5,
      underemploymentRate: 3,
      youthUnemploymentRate: 10,
      seniorEmploymentRate: 30,
      femaleParticipationRate: 60,
      maleParticipationRate: 70,
      sectorDistribution: {
        agriculture: 5,
        mining: 2,
        manufacturing: 15,
        construction: 8,
        utilities: 2,
        wholesale: 5,
        retail: 12,
        transportation: 6,
        information: 5,
        finance: 8,
        professional: 10,
        education: 8,
        healthcare: 10,
        hospitality: 6,
        government: 8,
        other: 5
      },
      employmentType: {
        fullTime: 70,
        partTime: 15,
        temporary: 5,
        seasonal: 3,
        selfEmployed: 10,
        gig: 3,
        informal: 4
      },
      averageWorkweekHours: 40,
      averageOvertimeHours: 3,
      paidVacationDays: 15,
      paidSickLeaveDays: 10,
      parentalLeaveWeeks: 12,
      unionizationRate: 20,
      collectiveBargainingCoverage: 25,
      minimumWageHourly: 12,
      livingWageHourly: 18,
      workplaceSafetyIndex: 70,
      laborRightsScore: 65,
      workerProtections: {
        jobSecurity: 60,
        wageProtection: 65,
        healthSafety: 70,
        discriminationProtection: 75,
        collectiveRights: 55
      }
    },
    demographics: {
      totalPopulation: economicInputs.coreIndicators?.totalPopulation || 0,
      populationGrowthRate: 0,
      ageDistribution: {
        under15: 20,
        age15to64: 65,
        over65: 15
      },
      urbanRuralSplit: {
        urban: 50,
        rural: 50
      },
      regions: [],
      lifeExpectancy: 75,
      literacyRate: 90,
      educationLevels: {
        noEducation: 5,
        primary: 25,
        secondary: 45,
        tertiary: 25
      },
      netMigrationRate: 0,
      immigrationRate: 0,
      emigrationRate: 0,
      infantMortalityRate: 10,
      maternalMortalityRate: 50,
      healthExpenditureGDP: 5,
      youthDependencyRatio: 30,
      elderlyDependencyRatio: 23,
      totalDependencyRatio: 53
    },
    selectedAtomicComponents: [],
    isValid: true,
    errors: {
      structure: [],
      sectors: {},
      labor: [],
      demographics: [],
      atomicComponents: [],
      validation: []
    },
    lastUpdated: new Date(),
    version: '1.0.0'
  }));

  const [selectedComponents, setSelectedComponents] = useState<EconomicComponentType[]>(propsSelectedComponents);
  const [currentStep, setCurrentStep] = useState<'components' | 'sectors' | 'labor' | 'demographics' | 'taxes' | 'preview'>('components');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);

  // Tax System tRPC Queries
  const { data: fetchedTaxSystemData, refetch: refetchTaxSystem } = api.taxSystem.getByCountryId.useQuery(
    { countryId: countryId || '' },
    {
      enabled: !!countryId,
      staleTime: 30000
    }
  );

  const createTaxSystemMutation = api.taxSystem.create.useMutation();
  const updateTaxSystemMutation = api.taxSystem.update.useMutation();

  // Use fetched tax data or prop tax data
  const activeTaxSystemData = fetchedTaxSystemData || taxSystemData;

  // Auto-select economic components based on government components
  useEffect(() => {
    if (governmentComponents && governmentComponents.length > 0) {
      import('../../services/UnifiedBuilderIntegrationService').then(({ unifiedBuilderService }) => {
        const suggested = unifiedBuilderService.getSuggestedEconomicComponents();

        if (suggested.length > 0) {
          const merged = Array.from(new Set([...selectedComponents, ...suggested]));
          setSelectedComponents(merged);
          console.log(`[EconomyBuilder] Auto-selected ${suggested.length} components based on government configuration`);
        }
      });
    }
  }, [governmentComponents]);

  // Initialize Economy Integration Service
  useEffect(() => {
    if (economicInputs) {
      economyIntegrationService.updateEconomicInputs(economicInputs);
    }
    if (governmentBuilderData) {
      economyIntegrationService.updateGovernmentBuilder(governmentBuilderData);
    }

    const unsubscribe = economyIntegrationService.subscribe((state) => {
      if (state.economyBuilder && state.economyBuilder !== economyBuilder) {
        setEconomyBuilder(state.economyBuilder);
      }

      if (state.economicInputs && state.economicInputs !== economicInputs) {
        onEconomicInputsChange(state.economicInputs);
      }
    });

    return () => unsubscribe();
  }, [economicInputs, governmentBuilderData, taxSystemData, onEconomicInputsChange]);

  // Component Change Handler - Memoized
  const handleComponentChange = useCallback((components: EconomicComponentType[]) => {
    setSelectedComponents(components);
    economyIntegrationService.updateEconomicComponents(components);
    // Notify parent component
    onSelectedComponentsChange?.(components);
  }, [onSelectedComponentsChange]);

  // Economy Builder Change Handler - Memoized
  const handleEconomyBuilderChange = useCallback((builder: EconomyBuilderState) => {
    setEconomyBuilder(builder);
    economyIntegrationService.updateEconomyBuilder(builder);
  }, []);

  // Save Handler - Memoized
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const result = await economyIntegrationService.saveEconomyConfiguration();
      if (result.success) {
        setLastSaved(new Date());
        toast.success("Economy configuration saved successfully!");
      } else {
        toast.error(result.error || "Failed to save economy configuration");
      }
    } catch (error) {
      console.error('Error saving economy configuration:', error);
      toast.error("An error occurred while saving");
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Validation Status - Memoized
  const validationStatus = useMemo(() => {
    const errors = economyBuilder.validation?.errors || [];
    const warnings = economyBuilder.validation?.warnings || [];

    return {
      isValid: economyBuilder.isValid && errors.length === 0,
      hasWarnings: warnings.length > 0,
      errorCount: errors.length,
      warningCount: warnings.length
    };
  }, [economyBuilder.isValid, economyBuilder.validation]);

  // Use prop economicHealthMetrics or create fallback
  const healthMetrics: EconomicHealthMetrics = useMemo(() => {
    if (economicHealthMetrics) return economicHealthMetrics;

    return {
      // Overall Health
      economicHealthScore: 75,
      sustainabilityScore: 70,
      resilienceScore: 72,
      competitivenessScore: 78,

      // Growth Indicators
      gdpGrowthRate: 3.2,
      potentialGrowthRate: 3.5,
      growthSustainability: 68,

      // Stability Indicators
      inflationRate: 2.1,
      inflationVolatility: 0.8,
      exchangeRateStability: 82,
      fiscalStability: 75,

      // Risk Assessment
      economicRiskLevel: 'Medium' as const,
      externalVulnerability: 25,
      domesticVulnerability: 35,
      systemicRisk: 30
    };
  }, [economicHealthMetrics, economyBuilder.laborMarket]);

  // Steps Configuration - Following GovernmentBuilder pattern
  const steps = [
    { id: 'components', label: 'Atomic Components', icon: Zap },
    { id: 'sectors', label: 'Economic Sectors', icon: Factory },
    { id: 'labor', label: 'Labor & Employment', icon: Users },
    { id: 'demographics', label: 'Demographics', icon: Globe },
    { id: 'taxes', label: 'Tax System', icon: DollarSign },
    { id: 'preview', label: 'Preview', icon: Eye }
  ] as const;

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Content Area */}
      <div className="space-y-6">
        {/* Header - Matching GovernmentBuilder style */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Economy Builder
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure your nation's economic systems and atomic components
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Help Dialog Button */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <HelpCircle className="h-4 w-4" />
                  Help
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <HelpCircle className="h-6 w-6 text-blue-600" />
                    Economy Builder Guide
                  </DialogTitle>
                  <DialogDescription>
                    Complete guide to building and managing your nation's economy
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 text-sm">
                  <div>
                    <h3 className="font-semibold text-base mb-2 flex items-center gap-2">
                      <Target className="h-5 w-5 text-blue-600" />
                      Getting Started
                    </h3>
                    <p className="text-muted-foreground mb-2">
                      The Economy Builder follows a 6-step process to create a complete economic profile for your nation:
                    </p>
                    <ol className="space-y-2 text-muted-foreground list-decimal list-inside ml-2">
                      <li><strong>Economic Components:</strong> Select atomic components that define your economic philosophy (Free Market, Planned, etc.)</li>
                      <li><strong>Economic Sectors:</strong> Set up your primary industries (Agriculture, Manufacturing, Services, etc.)</li>
                      <li><strong>Labor & Employment:</strong> Configure workforce distribution, unemployment, and labor rights</li>
                      <li><strong>Demographics:</strong> Define population characteristics, age distribution, and growth rates</li>
                      <li><strong>Tax System:</strong> Build your taxation structure with brackets, categories, and policies</li>
                      <li><strong>Preview:</strong> Review all settings and save your complete economic configuration</li>
                    </ol>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base mb-2 flex items-center gap-2">
                      <Atom className="h-5 w-5 text-green-600" />
                      Atomic Economic Components
                    </h3>
                    <p className="text-muted-foreground mb-2">
                      Components are modular building blocks that define your economic system. Each represents a specific philosophy or policy.
                    </p>
                    <ul className="space-y-2 text-muted-foreground list-disc list-inside ml-2">
                      <li><strong>Select up to 12 components</strong> that best represent your economic vision</li>
                      <li><strong>Green badges (synergies):</strong> Components that work well together and boost effectiveness</li>
                      <li><strong>Red badges (conflicts):</strong> Components that contradict and reduce efficiency</li>
                      <li><strong>★ Star:</strong> Active synergy (both components selected)</li>
                      <li><strong>⚠ Warning:</strong> Active conflict (creates inefficiency)</li>
                      <li><strong>Use Presets button</strong> to quick-start with common economic archetypes</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base mb-2 flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-purple-600" />
                      Economic Sectors
                    </h3>
                    <p className="text-muted-foreground">
                      Define your primary, secondary, and tertiary industries. Your sector distribution affects GDP composition,
                      employment patterns, and economic development tier (Developing → Emerging → Developed → Advanced).
                      Balanced sectors create economic stability, while specialized economies excel in specific areas.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base mb-2 flex items-center gap-2">
                      <Users className="h-5 w-5 text-emerald-600" />
                      Labor & Employment
                    </h3>
                    <p className="text-muted-foreground">
                      Set employment rates, workforce distribution across sectors, minimum wage, and working conditions.
                      These settings interact with your economic components - for example, "Strong Labor Unions" increases worker protections
                      but may reduce business flexibility. Balance employment metrics with your economic philosophy.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base mb-2 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-amber-600" />
                      Demographics & Population
                    </h3>
                    <p className="text-muted-foreground">
                      Configure total population, age distribution, growth rates, and urbanization levels.
                      Demographics directly influence labor supply, consumer markets, and social program costs.
                      Aging populations require different policies than young, growing populations.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base mb-2 flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-red-600" />
                      Tax System Integration
                    </h3>
                    <p className="text-muted-foreground">
                      The tax builder auto-populates based on your economic data (GDP, sectors, employment).
                      It recommends progressive/flat taxation based on your components, suggests brackets by income distribution,
                      and links to government departments. Tax policy affects economic growth, inequality, and business investment.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-base mb-2 flex items-center gap-2">
                      <Gauge className="h-5 w-5 text-blue-600" />
                      Effectiveness & Synergies
                    </h3>
                    <p className="text-muted-foreground mb-2">
                      Your overall economic effectiveness is calculated from:
                    </p>
                    <ul className="space-y-1 text-muted-foreground list-disc list-inside ml-4">
                      <li>Average effectiveness of selected components</li>
                      <li>Internal synergies (+10 pts each)</li>
                      <li>Government cross-builder synergies (+15 pts each)</li>
                      <li>Internal conflicts (-10 pts each)</li>
                      <li>Government conflicts (-15 pts each)</li>
                    </ul>
                    <p className="text-muted-foreground mt-2">
                      Higher effectiveness means more efficient economic policies with fewer contradictions.
                    </p>
                  </div>

                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h3 className="font-semibold text-base mb-2 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-blue-600" />
                      Pro Tips
                    </h3>
                    <ul className="space-y-2 text-muted-foreground text-xs">
                      <li><strong>Start with Presets:</strong> Use economic archetypes (Capitalist, Socialist, Mixed Economy) as templates, then customize</li>
                      <li><strong>Balance vs. Specialization:</strong> Diverse sectors = stability, focused sectors = competitive advantages</li>
                      <li><strong>Watch Conflicts:</strong> Small conflicts are okay if components align with your vision, but avoid major contradictions</li>
                      <li><strong>Economic Tiers Matter:</strong> Your GDP per capita determines development tier, which affects recommended tax rates</li>
                      <li><strong>Government Integration:</strong> Economic components sync with government structures for compound effectiveness</li>
                      <li><strong>Preview Before Saving:</strong> Always review the complete configuration in Preview tab before finalizing</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <h3 className="font-semibold text-base mb-2 flex items-center gap-2">
                      <Info className="h-5 w-5 text-emerald-600" />
                      Navigation Tips
                    </h3>
                    <ul className="space-y-1 text-muted-foreground text-xs">
                      <li>Use the step indicators at the top to jump between sections</li>
                      <li>Green checkmarks show completed steps</li>
                      <li>The Preview tab shows collapsible sections - click headers to expand/collapse</li>
                      <li>Changes auto-save when enabled, or use the Save button manually</li>
                      <li>Click "Expand All" in Preview to see full economic configuration at once</li>
                    </ul>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Presets Modal Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPresetsOpen(true)}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Presets
            </Button>
          </div>
        </div>

        {/* Progress Steps - Matching GovernmentBuilder pattern */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border overflow-x-auto">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = index < currentStepIndex;

            return (
              <div key={step.id} className="flex items-center flex-shrink-0">
                <button
                  onClick={() => setCurrentStep(step.id as any)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors relative ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                        : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <StepIcon className="h-4 w-4" />
                  <span className="text-sm font-medium whitespace-nowrap">{step.label}</span>
                  {isCompleted && <CheckCircle className="h-4 w-4" />}
                </button>
                {index < steps.length - 1 && (
                  <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Validation Errors - Matching GovernmentBuilder pattern */}
        {!validationStatus.isValid && economyBuilder.validation?.errors && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Please fix the following issues:
              <ul className="mt-2 list-disc list-inside space-y-1">
                {economyBuilder.validation.errors.map((error, index) => (
                  <li key={index} className="text-sm">{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Step Content - Matching GovernmentBuilder pattern */}
        <div className="space-y-6">
          {currentStep === 'components' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-foreground">
                  Economic Atomic Components
                </h2>
                <Badge variant="outline">
                  {selectedComponents.length} / 12 selected
                </Badge>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Select Components
                  </CardTitle>
                  <CardDescription>
                    Choose atomic components that define your economic model. Each component adds unique characteristics and behaviors.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AtomicEconomicComponentSelector
                    selectedComponents={selectedComponents}
                    onComponentChange={handleComponentChange}
                    maxComponents={12}
                    governmentComponents={governmentComponents?.map(c => c.type || c.id) || []}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === 'sectors' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-foreground">
                  Economic Sectors
                </h2>
              </div>
              <EconomySectorsTab
                economyBuilder={economyBuilder}
                onEconomyBuilderChange={handleEconomyBuilderChange}
                selectedComponents={selectedComponents}
                showAdvanced={showAdvanced}
              />
            </div>
          )}

          {currentStep === 'labor' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-foreground">
                  Labor & Employment
                </h2>
              </div>
              <LaborEmploymentTab
                economyBuilder={economyBuilder}
                onEconomyBuilderChange={handleEconomyBuilderChange}
                selectedComponents={selectedComponents}
              />
            </div>
          )}

          {currentStep === 'demographics' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-foreground">
                  Demographics & Population
                </h2>
              </div>
              <DemographicsPopulationTab
                economyBuilder={economyBuilder}
                onEconomyBuilderChange={handleEconomyBuilderChange}
                selectedComponents={selectedComponents}
                showAdvanced={showAdvanced}
              />
            </div>
          )}

          {currentStep === 'taxes' && (
            <TaxSystemStep
              countryId={countryId}
              activeTaxSystemData={activeTaxSystemData}
              economicInputs={economicInputs}
              economyBuilder={economyBuilder}
              selectedComponents={selectedComponents}
              onUpdate={async (taxSystem) => {
                await updateTaxSystemMutation.mutateAsync({
                  countryId: countryId!,
                  data: taxSystem,
                  skipConflictCheck: false
                });
              }}
              onCreate={async (taxSystem) => {
                await createTaxSystemMutation.mutateAsync({
                  countryId: countryId!,
                  data: taxSystem,
                  skipConflictCheck: false
                });
              }}
              onRefetch={refetchTaxSystem}
            />
          )}

          {currentStep === 'preview' && (
            <PreviewStep
              economyBuilder={economyBuilder}
              economicInputs={economicInputs}
              selectedComponents={selectedComponents}
              economicHealthMetrics={healthMetrics}
            />
          )}
        </div>

        {/* Navigation - Matching GovernmentBuilder pattern */}
        <div className="flex items-center justify-between pt-6 border-t border-border">
          <Button
            variant="outline"
            onClick={() => {
              const prevIndex = Math.max(0, currentStepIndex - 1);
              setCurrentStep(steps[prevIndex].id as any);
            }}
            disabled={currentStepIndex === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {validationStatus.isValid ? (
              <Badge variant="default" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                <CheckCircle className="h-3 w-3 mr-1" />
                Valid Configuration
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {validationStatus.errorCount} Issues
              </Badge>
            )}
          </div>

          <Button
            onClick={() => {
              const nextIndex = Math.min(steps.length - 1, currentStepIndex + 1);
              setCurrentStep(steps[nextIndex].id as any);
            }}
            disabled={currentStepIndex === steps.length - 1}
          >
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Presets Modal (Economic Archetypes) */}
      <EconomicArchetypeModal
        open={isPresetsOpen}
        onOpenChange={setIsPresetsOpen}
        currentState={economyBuilder}
        onArchetypeApplied={(newState) => {
          // Apply the archetype state to the economy builder
          console.log('[EconomyBuilder] Archetype applied:', newState);
          // TODO: Implement state application logic
        }}
      />
    </div>
  );
}

// Export sidebar separately so parent can control layout
export function EconomyBuilderSidebar({
  selectedComponents,
  economicHealthMetrics,
  maxComponents = 12
}: {
  selectedComponents: EconomicComponentType[];
  economicHealthMetrics?: EconomicHealthMetrics;
  maxComponents?: number;
}) {
  return (
    <div className="w-80 flex-shrink-0 sticky top-4 self-start">
      <BuilderIntegrationSidebar
        selectedComponents={selectedComponents}
        maxComponents={maxComponents}
        economicHealthMetrics={economicHealthMetrics}
      />
    </div>
  );
}
