"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { 
  BarChart3, 
  Briefcase, 
  Scale, 
  Building, 
  Building2, 
  Users, 
  Crown, 
  Target, 
  Settings,
  Zap,
  DollarSign
} from "lucide-react";
import { useUser } from "@clerk/nextjs";

// Import components
import { CoreEconomicIndicatorsComponent } from "~/app/builder/components/CoreEconomicIndicators";
import { LaborEmploymentSection as LaborEmploymentComponent } from "~/app/builder/sections/LaborEmploymentSection";
import { FiscalSystemSection as FiscalSystemComponent } from "~/app/builder/sections/FiscalSystemSection";
import { GovernmentSpending } from "~/app/builder/components/GovernmentSpending";
import { DemographicsSection as Demographics } from "~/app/builder/sections/DemographicsSection";
import { GovernmentBuilder } from "~/components/government";
import { AtomicComponentSelector } from "~/components/government/atoms/AtomicGovernmentComponents";
import { AdvancedBudgetDashboard } from "~/components/government/AdvancedBudgetDashboard";
import { TaxBuilder } from "~/components/tax-system/TaxBuilder";
import { api } from "~/trpc/react";
import { ComponentType } from "~/components/government/atoms/AtomicGovernmentComponents";
import type { LaborEmploymentData, FiscalSystemData, DemographicData, EconomicInputs } from "~/app/builder/lib/economy-data-service";
import type { GovernmentBuilderState } from "~/types/government";
import { createHybridSpendingData, shouldUseGovernmentStructureData } from "~/lib/government-spending-bridge";

interface AtomicEditorTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  economicInputs: EconomicInputs;
  handleInputsChange: (inputs: EconomicInputs) => void;
  showAdvanced: boolean;
  governmentData: GovernmentBuilderState | null;
  governmentLoading: boolean;
  handleGovernmentSave: (data: GovernmentBuilderState) => void;
  setGovernmentData: (data: GovernmentBuilderState) => void;
  country: any;
}

// Mock budget categories
const mockBudgetCategories = [
  {
    id: 'defense',
    name: 'Defense & Security',
    type: 'MANDATORY' as const,
    allocatedAmount: 150000000,
    allocatedPercent: 15,
    spentAmount: 140000000,
    encumberedAmount: 8000000,
    availableAmount: 2000000,
    priority: 'CRITICAL' as const,
    department: 'Ministry of Defense',
    color: '#dc2626',
    icon: 'Shield',
    efficiency: 88,
    performance: 92,
    growthRate: 3.2
  },
  {
    id: 'education',
    name: 'Education & Research',
    type: 'MANDATORY' as const,
    allocatedAmount: 200000000,
    allocatedPercent: 20,
    spentAmount: 180000000,
    encumberedAmount: 15000000,
    availableAmount: 5000000,
    priority: 'HIGH' as const,
    department: 'Ministry of Education',
    color: '#059669',
    icon: 'GraduationCap',
    efficiency: 78,
    performance: 85,
    growthRate: 5.1
  },
];

export function AtomicEditorTabs({
  activeTab,
  setActiveTab,
  economicInputs,
  handleInputsChange,
  showAdvanced,
  governmentData,
  governmentLoading,
  handleGovernmentSave,
  setGovernmentData,
  country,
}: AtomicEditorTabsProps) {
  const { user } = useUser();
  const [selectedComponents, setSelectedComponents] = useState<ComponentType[]>([]);
  
  // Fetch existing government components
  const { data: existingComponents, refetch: refetchComponents } = api.atomicGovernment.getComponents.useQuery(
    { countryId: country?.id || '' },
    { enabled: !!country?.id }
  );

  // Create government component mutation
  const createComponentMutation = api.atomicGovernment.createComponent.useMutation({
    onSuccess: () => {
      void refetchComponents();
    }
  });

  // Government effectiveness analysis
  const { data: effectivenessAnalysis } = api.atomicGovernment.getEffectivenessAnalysis.useQuery(
    { countryId: country?.id || '' },
    { enabled: !!country?.id }
  );

  // Update components when data changes
  useEffect(() => {
    if (existingComponents) {
      setSelectedComponents(existingComponents.map(c => c.componentType as ComponentType));
    }
  }, [existingComponents]);

  // Handle component changes
  const handleComponentChange = async (components: ComponentType[]) => {
    setSelectedComponents(components);
    
    if (country?.id && user?.id) {
      // Find new components to add
      const newComponents = components.filter(c => 
        !existingComponents?.some(existing => existing.componentType === c)
      );
      
      // Create new components
      for (const componentType of newComponents) {
        try {
          await createComponentMutation.mutateAsync({
            countryId: country.id,
            componentType,
            effectivenessScore: 75,
            implementationCost: 100000,
            maintenanceCost: 10000,
            requiredCapacity: 60
          });
        } catch (error) {
          console.error('Failed to create component:', error);
        }
      }
    }
  };

  // Automatically sync government structure with spending data
  useEffect(() => {
    if (governmentData && !governmentLoading && economicInputs?.coreIndicators) {
      if (shouldUseGovernmentStructureData(governmentData)) {
        const hybridSpendingData = createHybridSpendingData(
          economicInputs.governmentSpending,
          governmentData,
          economicInputs.coreIndicators.nominalGDP,
          economicInputs.coreIndicators.totalPopulation
        );
        
        const currentSpending = economicInputs.governmentSpending;
        const hasChanged = 
          Math.abs(hybridSpendingData.totalSpending - currentSpending.totalSpending) > 1000 ||
          hybridSpendingData.spendingCategories.length !== currentSpending.spendingCategories.length;
          
        if (hasChanged) {
          handleInputsChange({
            ...economicInputs,
            governmentSpending: hybridSpendingData
          });
        }
      }
    }
  }, [governmentData, governmentLoading, economicInputs?.coreIndicators?.nominalGDP, economicInputs?.coreIndicators?.totalPopulation]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      {/* Atomic Government Status Alert */}
      {existingComponents && existingComponents.length > 0 && (
        <Alert className="mb-6 border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <Settings className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <strong>Atomic Government Active:</strong> {existingComponents.length} components with {
                  effectivenessAnalysis?.overallEffectiveness || 0
                }% effectiveness. Advanced editing enabled.
              </div>
              <Badge variant="secondary" className="ml-2">
                <Crown className="h-3 w-3 mr-1" />
                Enhanced
              </Badge>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 glass-hierarchy-child bg-white/80 dark:bg-gray-800/80 border border-gray-200/50 dark:border-gray-600/50 p-1 rounded-xl">
          <TabsTrigger value="core" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white rounded-lg">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Core</span>
          </TabsTrigger>
          <TabsTrigger value="labor" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white rounded-lg">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Labor</span>
          </TabsTrigger>
          <TabsTrigger value="fiscal" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-500 data-[state=active]:text-white rounded-lg">
            <Scale className="h-4 w-4" />
            <span className="hidden sm:inline">Fiscal</span>
          </TabsTrigger>
          <TabsTrigger value="government" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-rose-500 data-[state=active]:text-white rounded-lg">
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">Gov</span>
          </TabsTrigger>
          <TabsTrigger value="structure" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-500 data-[state=active]:to-amber-500 data-[state=active]:text-white rounded-lg">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Structure</span>
          </TabsTrigger>
          <TabsTrigger value="atomic" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white rounded-lg">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Atomic</span>
          </TabsTrigger>
          <TabsTrigger value="budget" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white rounded-lg">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Budget</span>
          </TabsTrigger>
          <TabsTrigger value="demographics" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white rounded-lg">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Demo</span>
          </TabsTrigger>
        </TabsList>

        {/* Core Economic Indicators */}
        <TabsContent value="core" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-hierarchy-child rounded-xl p-6 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200/50 dark:border-blue-700/50"
          >
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="h-6 w-6 text-blue-600" />
              <h3 className="text-xl font-semibold">Core Economic Indicators</h3>
              <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                <Target className="h-3 w-3 mr-1" />
                LIVE EDITING
              </Badge>
            </div>
            <CoreEconomicIndicatorsComponent
              indicators={economicInputs.coreIndicators}
              onIndicatorsChangeAction={(newIndicators) => {
                handleInputsChange({
                  ...economicInputs,
                  coreIndicators: newIndicators
                });
              }}
              isReadOnly={false}
              showComparison={false}
            />
          </motion.div>
        </TabsContent>

        {/* Labor & Employment */}
        <TabsContent value="labor" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-hierarchy-child rounded-xl p-6 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200/50 dark:border-green-700/50"
          >
            <div className="flex items-center gap-3 mb-6">
              <Briefcase className="h-6 w-6 text-green-600" />
              <h3 className="text-xl font-semibold">Labor & Employment</h3>
            </div>
            <LaborEmploymentComponent
              inputs={economicInputs}
              onInputsChange={(newEconomicInputs: EconomicInputs) => {
                handleInputsChange(newEconomicInputs);
              }}
              isReadOnly={false}
              showComparison={true}
              showAdvanced={false}
              referenceCountry={undefined}
            />
          </motion.div>
        </TabsContent>

        {/* Fiscal System */}
        <TabsContent value="fiscal" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-hierarchy-child rounded-xl p-6 bg-gradient-to-br from-purple-50/50 to-violet-50/50 dark:from-purple-950/20 dark:to-violet-950/20 border border-purple-200/50 dark:border-purple-700/50"
          >
            <div className="flex items-center gap-3 mb-6">
              <Scale className="h-6 w-6 text-purple-600" />
              <h3 className="text-xl font-semibold">Fiscal System</h3>
            </div>
            
            {/* Enhanced with Tax Builder */}
            <Tabs defaultValue="current" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="current">Current System</TabsTrigger>
                <TabsTrigger value="builder">Tax Builder</TabsTrigger>
              </TabsList>

              <TabsContent value="current">
                <FiscalSystemComponent
                  inputs={economicInputs}
                  onInputsChange={(newEconomicInputs: EconomicInputs) => {
                    handleInputsChange(newEconomicInputs);
                  }}
                  isReadOnly={false}
                  showComparison={false}
                  showAdvanced={false}
                  referenceCountry={undefined}
                  nominalGDP={economicInputs.coreIndicators?.nominalGDP || 1000000}
                  totalPopulation={economicInputs.coreIndicators?.totalPopulation || 100000}
                />
              </TabsContent>

              <TabsContent value="builder">
                <TaxBuilder
                  countryId={country?.id}
                  onSave={async (taxSystem) => {
                    console.log('Tax system saved:', taxSystem);
                  }}
                />
              </TabsContent>
            </Tabs>
          </motion.div>
        </TabsContent>

        {/* Government Spending */}
        <TabsContent value="government" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-hierarchy-child rounded-xl p-6 bg-gradient-to-br from-red-50/50 to-rose-50/50 dark:from-red-950/20 dark:to-rose-950/20 border border-red-200/50 dark:border-red-700/50"
          >
            <div className="flex items-center gap-3 mb-6">
              <Building className="h-6 w-6 text-red-600" />
              <h3 className="text-xl font-semibold">Government Spending</h3>
            </div>
            <GovernmentSpending
              {...economicInputs.governmentSpending}
              onSpendingDataChangeAction={(newData) => {
                handleInputsChange({
                  ...economicInputs,
                  governmentSpending: newData
                });
              }}
              isReadOnly={false}
              nominalGDP={economicInputs.coreIndicators.nominalGDP}
              totalPopulation={economicInputs.coreIndicators.totalPopulation}
            />
          </motion.div>
        </TabsContent>

        {/* Government Structure */}
        <TabsContent value="structure" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-hierarchy-child rounded-xl p-6 bg-gradient-to-br from-yellow-50/50 to-amber-50/50 dark:from-yellow-950/20 dark:to-amber-950/20 border border-yellow-200/50 dark:border-yellow-700/50"
          >
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="h-6 w-6 text-yellow-600" />
              <h3 className="text-xl font-semibold">Government Structure</h3>
            </div>
            <GovernmentBuilder
              initialData={governmentData || undefined}
              onSave={async (data) => handleGovernmentSave(data)}
              isReadOnly={false}
            />
          </motion.div>
        </TabsContent>

        {/* Atomic Government Components - NEW */}
        <TabsContent value="atomic" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-hierarchy-child rounded-xl p-6 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-200/50 dark:border-indigo-700/50"
          >
            <div className="flex items-center gap-3 mb-6">
              <Settings className="h-6 w-6 text-indigo-600" />
              <h3 className="text-xl font-semibold">Atomic Government Components</h3>
              <Badge variant="outline" className="bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 border-indigo-200">
                <Crown className="h-3 w-3 mr-1" />
                Advanced System
              </Badge>
            </div>
            
            <AtomicComponentSelector
              selectedComponents={selectedComponents}
              onComponentChange={handleComponentChange}
              maxComponents={10}
              isReadOnly={false}
            />

            {/* Effectiveness Analysis */}
            {effectivenessAnalysis && (
              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold mb-3">System Analysis</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {effectivenessAnalysis.overallEffectiveness}%
                    </div>
                    <div className="text-muted-foreground">Effectiveness</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {effectivenessAnalysis.totalComponents}
                    </div>
                    <div className="text-muted-foreground">Components</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      ${Math.round((typeof effectivenessAnalysis.totalCost === 'number' && !isNaN(effectivenessAnalysis.totalCost) ? effectivenessAnalysis.totalCost : 0) / 1000)}k
                    </div>
                    <div className="text-muted-foreground">Total Cost</div>
                  </div>
                </div>
                {effectivenessAnalysis.recommendations.length > 0 && (
                  <div className="mt-4">
                    <h5 className="font-medium mb-2">Recommendations:</h5>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {effectivenessAnalysis.recommendations.map((rec, index) => (
                        <li key={index}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </TabsContent>

        {/* Advanced Budget Dashboard - NEW */}
        <TabsContent value="budget" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-hierarchy-child rounded-xl p-6 bg-gradient-to-br from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200/50 dark:border-emerald-700/50"
          >
            <div className="flex items-center gap-3 mb-6">
              <DollarSign className="h-6 w-6 text-emerald-600" />
              <h3 className="text-xl font-semibold">Advanced Budget Management</h3>
              <Badge variant="outline" className="bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 border-emerald-200">
                <Zap className="h-3 w-3 mr-1" />
                Executive Tools
              </Badge>
            </div>
            
            <AdvancedBudgetDashboard
              totalBudget={economicInputs?.coreIndicators?.nominalGDP * 0.3 || 1000000000}
              currency="USD"
              fiscalYear={new Date().getFullYear()}
              budgetCategories={mockBudgetCategories}
              onBudgetChange={(categories) => {
                console.log('Budget categories updated:', categories);
              }}
            />
          </motion.div>
        </TabsContent>

        {/* Demographics */}
        <TabsContent value="demographics" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-hierarchy-child rounded-xl p-6 bg-gradient-to-br from-orange-50/50 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200/50 dark:border-orange-700/50"
          >
            <div className="flex items-center gap-3 mb-6">
              <Users className="h-6 w-6 text-orange-600" />
              <h3 className="text-xl font-semibold">Demographics</h3>
            </div>
            <Demographics
              inputs={economicInputs}
              onInputsChange={(newEconomicInputs: EconomicInputs) => {
                handleInputsChange(newEconomicInputs);
              }}
              isReadOnly={false}
              showComparison={false}
              showAdvanced={false}
            />
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}