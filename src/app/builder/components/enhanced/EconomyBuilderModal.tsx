"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { Progress } from '~/components/ui/progress';
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
  X,
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
  Activity
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
import { economyIntegrationService } from '../../services/EconomyIntegrationService';

// Tab Components
import { EconomySectorsTab } from './tabs/EconomySectorsTab';
import { LaborEmploymentTab } from './tabs/LaborEmploymentTab';
import { DemographicsPopulationTab } from './tabs/DemographicsPopulationTab';
import { EconomyPreviewTab } from './tabs/EconomyPreviewTab';

interface EconomyBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (economyBuilder: EconomyBuilderState) => void;
  initialData?: Partial<EconomyBuilderState>;
  economicInputs: EconomicInputs;
  countryId?: string;
  className?: string;
}

export function EconomyBuilderModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  economicInputs,
  countryId,
  className = ""
}: EconomyBuilderModalProps) {
  const [activeTab, setActiveTab] = useState<EconomyBuilderTab>('atomicComponents');
  const [economyBuilder, setEconomyBuilder] = useState<EconomyBuilderState | null>(null);
  const [selectedComponents, setSelectedComponents] = useState<EconomicComponentType[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValid, setIsValid] = useState(false);

  // Initialize economy builder from atomic components or initial data
  useEffect(() => {
    if (isOpen) {
      if (initialData?.selectedAtomicComponents) {
        setSelectedComponents(initialData.selectedAtomicComponents);
      }
      
      if (initialData) {
        setEconomyBuilder({
          structure: initialData.structure || {
            economicModel: 'Mixed Economy',
            primarySectors: [],
            secondarySectors: [],
            tertiarySectors: [],
            totalGDP: economicInputs.coreIndicators.nominalGDP,
            gdpCurrency: 'USD',
            economicTier: 'Developed',
            growthStrategy: 'Balanced'
          },
          sectors: initialData.sectors || [],
          laborMarket: initialData.laborMarket || generateDefaultLaborMarket(),
          demographics: initialData.demographics || generateDefaultDemographics(),
          selectedAtomicComponents: initialData.selectedAtomicComponents || [],
          isValid: true,
          errors: {},
          lastUpdated: new Date(),
          version: '1.0.0'
        });
      } else {
        // Generate from economic inputs
        generateInitialEconomyBuilder();
      }
    }
  }, [isOpen, initialData, economicInputs]);

  // Subscribe to economy integration service
  useEffect(() => {
    const unsubscribe = economyIntegrationService.subscribe((state) => {
      if (state.economyBuilder) {
        setEconomyBuilder(state.economyBuilder);
        setSelectedComponents(state.selectedAtomicComponents);
      }
      setValidationErrors(state.errors);
    });

    return unsubscribe;
  }, []);

  // Update economy integration service when components change
  useEffect(() => {
    if (selectedComponents.length > 0) {
      economyIntegrationService.updateEconomicComponents(selectedComponents);
    }
  }, [selectedComponents]);

  // Update economy integration service when builder changes
  useEffect(() => {
    if (economyBuilder && economyBuilder !== initialData) {
      economyIntegrationService.updateEconomyBuilder(economyBuilder);
    }
  }, [economyBuilder]);

  // Update economic inputs in service
  useEffect(() => {
    economyIntegrationService.updateEconomicInputs(economicInputs);
  }, [economicInputs]);

  const generateInitialEconomyBuilder = async () => {
    try {
      const defaultComponents: EconomicComponentType[] = [
        EconomicComponentType.MIXED_ECONOMY,
        EconomicComponentType.SERVICE_BASED,
        EconomicComponentType.BALANCED_TRADE
      ];
      
      setSelectedComponents(defaultComponents);
      await economyIntegrationService.updateEconomicComponents(defaultComponents);
    } catch (error) {
      console.error('Failed to generate initial economy builder:', error);
      toast.error('Failed to initialize economy builder');
    }
  };

  const generateDefaultLaborMarket = () => ({
    totalWorkforce: Math.round(economicInputs.coreIndicators.totalPopulation * 0.65),
    laborForceParticipationRate: 65,
    employmentRate: 95,
    unemploymentRate: 5,
    underemploymentRate: 3,
    youthUnemploymentRate: 11,
    seniorEmploymentRate: 55,
    femaleParticipationRate: 55,
    maleParticipationRate: 75,
    sectorDistribution: {
      agriculture: 3.5,
      mining: 0.8,
      manufacturing: 12.5,
      construction: 6.5,
      utilities: 1.2,
      wholesale: 5.5,
      retail: 11.0,
      transportation: 4.8,
      information: 3.2,
      finance: 5.5,
      professional: 13.5,
      education: 9.0,
      healthcare: 14.0,
      hospitality: 7.5,
      government: 15.0,
      other: 6.5
    },
    employmentType: {
      fullTime: 72.0,
      partTime: 18.5,
      temporary: 4.5,
      seasonal: 2.0,
      selfEmployed: 9.5,
      gig: 5.5,
      informal: 3.0
    },
    averageWorkweekHours: 38.5,
    averageOvertimeHours: 3.2,
    paidVacationDays: 15,
    paidSickLeaveDays: 8,
    parentalLeaveWeeks: 12,
    unionizationRate: 12.5,
    collectiveBargainingCoverage: 18.0,
    minimumWageHourly: 12.50,
    livingWageHourly: 18.75,
    workplaceSafetyIndex: 72,
    laborRightsScore: 68,
    workerProtections: {
      jobSecurity: 65,
      wageProtection: 70,
      healthSafety: 75,
      discriminationProtection: 80,
      collectiveRights: 60
    }
  });

  const generateDefaultDemographics = () => ({
    totalPopulation: economicInputs.coreIndicators.totalPopulation,
    populationGrowthRate: 0.5,
    ageDistribution: {
      under15: 18,
      age15to64: 65,
      over65: 17
    },
    urbanRuralSplit: {
      urban: 75,
      rural: 25
    },
    regions: [
      {
        name: 'Capital Region',
        population: Math.round(economicInputs.coreIndicators.totalPopulation * 0.3),
        populationPercent: 30,
        urbanPercent: 90,
        economicActivity: 40,
        developmentLevel: 'Advanced' as const
      },
      {
        name: 'Industrial Region',
        population: Math.round(economicInputs.coreIndicators.totalPopulation * 0.25),
        populationPercent: 25,
        urbanPercent: 80,
        economicActivity: 30,
        developmentLevel: 'Developed' as const
      },
      {
        name: 'Agricultural Region',
        population: Math.round(economicInputs.coreIndicators.totalPopulation * 0.45),
        populationPercent: 45,
        urbanPercent: 60,
        economicActivity: 30,
        developmentLevel: 'Developing' as const
      }
    ],
    lifeExpectancy: 78,
    literacyRate: 95,
    educationLevels: {
      noEducation: 2,
      primary: 25,
      secondary: 45,
      tertiary: 28
    },
    netMigrationRate: 2.5,
    immigrationRate: 5.0,
    emigrationRate: 2.5,
    infantMortalityRate: 5,
    maternalMortalityRate: 15,
    healthExpenditureGDP: 8.5,
    youthDependencyRatio: 28,
    elderlyDependencyRatio: 26,
    totalDependencyRatio: 54
  });

  // Calculate overall effectiveness
  const overallEffectiveness = useMemo(() => {
    if (selectedComponents.length === 0) return 0;
    
    const totalEffectiveness = selectedComponents.reduce(
      (sum, comp) => sum + (ATOMIC_ECONOMIC_COMPONENTS[comp]?.effectiveness || 0), 0
    );
    
    const baseEffectiveness = totalEffectiveness / selectedComponents.length;
    
    // Calculate synergy bonuses and conflict penalties
    let synergyBonus = 0;
    let conflictPenalty = 0;
    
    selectedComponents.forEach(comp1 => {
      selectedComponents.forEach(comp2 => {
        if (comp1 !== comp2) {
          const component1 = ATOMIC_ECONOMIC_COMPONENTS[comp1];
          if (component1?.synergies.includes(comp2)) {
            synergyBonus += 2;
          }
          if (component1?.conflicts.includes(comp2)) {
            conflictPenalty += 5;
          }
        }
      });
    });
    
    return Math.max(0, Math.min(100, baseEffectiveness + synergyBonus - conflictPenalty));
  }, [selectedComponents]);

  // Calculate economic health metrics
  const economicHealthMetrics = useMemo((): EconomicHealthMetrics => {
    if (!economyBuilder) {
      return {
        economicHealthScore: 0,
        sustainabilityScore: 0,
        resilienceScore: 0,
        competitivenessScore: 0,
        gdpGrowthRate: 0,
        potentialGrowthRate: 0,
        growthSustainability: 0,
        inflationRate: economicInputs.coreIndicators.inflationRate,
        inflationVolatility: 2,
        exchangeRateStability: 75,
        fiscalStability: 70,
        economicRiskLevel: 'Medium',
        externalVulnerability: 50,
        domesticVulnerability: 50,
        systemicRisk: 50
      };
    }

    // Calculate based on components and configuration
    const baseScore = overallEffectiveness;
    const sustainabilityBonus = selectedComponents.includes(EconomicComponentType.SUSTAINABLE_DEVELOPMENT) ? 15 : 0;
    const innovationBonus = selectedComponents.includes(EconomicComponentType.INNOVATION_ECONOMY) ? 20 : 0;
    const resilienceBonus = selectedComponents.includes(EconomicComponentType.MIXED_ECONOMY) ? 10 : 0;

    return {
      economicHealthScore: Math.min(100, baseScore + sustainabilityBonus + innovationBonus),
      sustainabilityScore: 70 + sustainabilityBonus,
      resilienceScore: 65 + resilienceBonus,
      competitivenessScore: baseScore + innovationBonus,
      gdpGrowthRate: economicInputs.coreIndicators.realGDPGrowthRate,
      potentialGrowthRate: economicInputs.coreIndicators.realGDPGrowthRate + (innovationBonus / 10),
      growthSustainability: 75 + sustainabilityBonus,
      inflationRate: economicInputs.coreIndicators.inflationRate,
      inflationVolatility: 2,
      exchangeRateStability: 75,
      fiscalStability: 70,
      economicRiskLevel: baseScore > 80 ? 'Low' : baseScore > 60 ? 'Medium' : 'High',
      externalVulnerability: 50,
      domesticVulnerability: 50,
      systemicRisk: 50
    };
  }, [economyBuilder, selectedComponents, overallEffectiveness, economicInputs]);

  const handleComponentChange = (components: EconomicComponentType[]) => {
    setSelectedComponents(components);
  };

  const handleEconomyBuilderChange = (newBuilder: EconomyBuilderState) => {
    setEconomyBuilder(newBuilder);
  };

  const handleSave = async () => {
    if (!economyBuilder || !isValid) {
      toast.error('Please fix validation errors before saving');
      return;
    }

    setIsSaving(true);
    try {
      const updatedBuilder = {
        ...economyBuilder,
        selectedAtomicComponents: selectedComponents,
        lastUpdated: new Date(),
        isValid: true
      };
      
      await onSave(updatedBuilder);
      toast.success('Economy configuration saved successfully!');
      onClose();
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Failed to save economy configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as EconomyBuilderTab);
  };

  const getTabIcon = (tab: EconomyBuilderTab) => {
    switch (tab) {
      case 'atomicComponents': return Zap;
      case 'sectors': return Factory;
      case 'labor': return Users;
      case 'demographics': return BarChart3;
      case 'preview': return Target;
      default: return Settings;
    }
  };

  const getTabLabel = (tab: EconomyBuilderTab) => {
    switch (tab) {
      case 'atomicComponents': return 'Atomic Components';
      case 'sectors': return 'Sectors';
      case 'labor': return 'Labor & Employment';
      case 'demographics': return 'Demographics';
      case 'preview': return 'Preview';
      default: return 'Unknown';
    }
  };

  if (!economyBuilder) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-muted-foreground">Initializing economy builder...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                  <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold">Economy Builder</DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    Configure your economic system with atomic components
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Effectiveness Display */}
                <div className="flex items-center space-x-2">
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">
                      {overallEffectiveness.toFixed(0)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Effectiveness</div>
                  </div>
                  <div className="w-12 h-12 relative">
                    <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        className="text-gray-200 dark:text-gray-700"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${overallEffectiveness * 2.51} 251`}
                        className="text-green-600 dark:text-green-400 transition-all duration-500"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2">
                  <Button variant="outline" onClick={onClose}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    disabled={!isValid || isSaving}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isSaving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Economy
                  </Button>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="px-6 py-2 bg-red-50 dark:bg-red-900/20 border-b">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    {validationErrors.map((error, index) => (
                      <div key={index} className="text-sm">{error}</div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full flex flex-col">
              {/* Tab Navigation */}
              <div className="px-6 py-3 border-b bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
                <TabsList className="grid w-full grid-cols-5">
                  {(['atomicComponents', 'sectors', 'labor', 'demographics', 'preview'] as EconomyBuilderTab[]).map((tab) => {
                    const Icon = getTabIcon(tab);
                    return (
                      <TabsTrigger key={tab} value={tab} className="flex items-center space-x-2">
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{getTabLabel(tab)}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-auto">
                <TabsContent value="atomicComponents" className="h-full m-0 p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                    {/* Component Selector */}
                    <div className="lg:col-span-2">
                      <Card className="h-full">
                        <CardHeader>
                          <CardTitle className="flex items-center space-x-2">
                            <Zap className="h-5 w-5" />
                            <span>Economic Atomic Components</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="h-full overflow-auto">
                          <AtomicEconomicComponentSelector
                            selectedComponents={selectedComponents}
                            onComponentChange={handleComponentChange}
                            maxComponents={12}
                          />
                        </CardContent>
                      </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                      <EconomicEffectiveness
                        selectedComponents={selectedComponents}
                        maxComponents={12}
                      />
                      
                      <EconomicImpactPreview
                        selectedComponents={selectedComponents}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="sectors" className="h-full m-0 p-6">
                  <EconomySectorsTab
                    economyBuilder={economyBuilder}
                    onEconomyBuilderChange={handleEconomyBuilderChange}
                    selectedComponents={selectedComponents}
                  />
                </TabsContent>

                <TabsContent value="labor" className="h-full m-0 p-6">
                  <LaborEmploymentTab
                    economyBuilder={economyBuilder}
                    onEconomyBuilderChange={handleEconomyBuilderChange}
                    selectedComponents={selectedComponents}
                  />
                </TabsContent>

                <TabsContent value="demographics" className="h-full m-0 p-6">
                  <DemographicsPopulationTab
                    economyBuilder={economyBuilder}
                    onEconomyBuilderChange={handleEconomyBuilderChange}
                    selectedComponents={selectedComponents}
                  />
                </TabsContent>

                <TabsContent value="preview" className="h-full m-0 p-6">
                  <EconomyPreviewTab
                    economyBuilder={economyBuilder}
                    economicHealthMetrics={economicHealthMetrics}
                    selectedComponents={selectedComponents}
                    economicInputs={economicInputs}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
