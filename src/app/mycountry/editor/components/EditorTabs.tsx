import { motion } from "framer-motion";
import { useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { 
  BarChart3, 
  Briefcase, 
  Scale, 
  Building, 
  Building2, 
  Users, 
  Crown, 
  Target, 
  Activity, 
  TrendingUp 
} from "lucide-react";

// Import repurposed builder components for editing
import { CoreEconomicIndicatorsComponent } from "~/app/builder/components/CoreEconomicIndicators";
import { LaborEmploymentSection as LaborEmploymentComponent } from "~/app/builder/sections/LaborEmploymentSection";
import { FiscalSystemSection as FiscalSystemComponent } from "~/app/builder/sections/FiscalSystemSection";
import { GovernmentSpending } from "~/app/builder/components/GovernmentSpending";
import { DemographicsSection as Demographics } from "~/app/builder/sections/DemographicsSection";
import { GovernmentBuilder } from "~/components/government";
import type { GovernmentBuilderState } from "~/types/government";
import { createHybridSpendingData, shouldUseGovernmentStructureData } from "~/lib/government-spending-bridge";

interface EditorTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  economicInputs: any; // TODO: Define a proper type
  handleInputsChange: (inputs: any) => void;
  showAdvanced: boolean;
  governmentData: GovernmentBuilderState | null;
  governmentLoading: boolean;
  handleGovernmentSave: (data: GovernmentBuilderState) => void;
  setGovernmentData: (data: GovernmentBuilderState) => void;
  country: any; // TODO: Define a proper type
}

export function EditorTabs({
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
}: EditorTabsProps) {
  // Automatically sync government structure with spending data
  useEffect(() => {
    if (governmentData && !governmentLoading && economicInputs?.coreIndicators) {
      // Check if government structure should override spending data
      if (shouldUseGovernmentStructureData(governmentData)) {
        const hybridSpendingData = createHybridSpendingData(
          economicInputs.governmentSpending,
          governmentData,
          economicInputs.coreIndicators.nominalGDP,
          economicInputs.coreIndicators.totalPopulation
        );
        
        // Only update if the spending data is actually different
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 glass-hierarchy-child bg-white/80 dark:bg-gray-800/80 border border-gray-200/50 dark:border-gray-600/50 p-1 rounded-xl">
          <TabsTrigger value="core" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white rounded-lg">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Core Economy</span>
            <span className="sm:hidden">Core</span>
          </TabsTrigger>
          <TabsTrigger value="labor" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white rounded-lg">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Labor & Employment</span>
            <span className="sm:hidden">Labor</span>
          </TabsTrigger>
          <TabsTrigger value="fiscal" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-violet-500 data-[state=active]:text-white rounded-lg">
            <Scale className="h-4 w-4" />
            <span className="hidden sm:inline">Fiscal System</span>
            <span className="sm:hidden">Fiscal</span>
          </TabsTrigger>
          <TabsTrigger value="government" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-rose-500 data-[state=active]:text-white rounded-lg">
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">Government</span>
            <span className="sm:hidden">Gov</span>
          </TabsTrigger>
          <TabsTrigger value="structure" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-500 data-[state=active]:to-amber-500 data-[state=active]:text-white rounded-lg">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Gov Structure</span>
            <span className="sm:hidden">Structure</span>
          </TabsTrigger>
          <TabsTrigger value="demographics" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-amber-500 data-[state=active]:text-white rounded-lg">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Demographics</span>
            <span className="sm:hidden">Demo</span>
          </TabsTrigger>
        </TabsList>

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

        <TabsContent value="labor" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-hierarchy-child rounded-xl p-6 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200/50 dark:border-green-700/50"
          >
            <div className="flex items-center gap-3 mb-6">
              <Briefcase className="h-6 w-6 text-green-600" />
              <h3 className="text-xl font-semibold">Labor & Employment</h3>
              <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                <Activity className="h-3 w-3 mr-1" />
                WORKFORCE METRICS
              </Badge>
            </div>
            <LaborEmploymentComponent
              inputs={economicInputs}
              onInputsChange={(newInputs: any) => {
                handleInputsChange(newInputs);
              }}
              isReadOnly={false}
              showComparison={true}
              showAdvanced={showAdvanced}
              referenceCountry={undefined}
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="fiscal" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-hierarchy-child rounded-xl p-6 bg-gradient-to-br from-purple-50/50 to-violet-50/50 dark:from-purple-950/20 dark:to-violet-950/20 border border-purple-200/50 dark:border-purple-700/50"
          >
            <div className="flex items-center gap-3 mb-6">
              <Scale className="h-6 w-6 text-purple-600" />
              <h3 className="text-xl font-semibold">Fiscal System</h3>
              <Badge variant="outline" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                <TrendingUp className="h-3 w-3 mr-1" />
                TAX & BUDGET
              </Badge>
            </div>
            <FiscalSystemComponent
              inputs={economicInputs}
              onInputsChange={(newInputs: any) => {
                handleInputsChange(newInputs);
              }}
              isReadOnly={false}
              showComparison={true}
              showAdvanced={showAdvanced}
              referenceCountry={undefined}
              nominalGDP={economicInputs.coreIndicators.nominalGDP}
              totalPopulation={economicInputs.coreIndicators.totalPopulation}
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="government" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-hierarchy-child rounded-xl p-6 bg-gradient-to-br from-red-50/50 to-rose-50/50 dark:from-red-950/20 dark:to-rose-950/20 border border-red-200/50 dark:border-red-700/50"
          >
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <Building className="h-6 w-6 text-red-600" />
              <h3 className="text-xl font-semibold">Government Spending</h3>
              <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                <Building className="h-3 w-3 mr-1" />
                PUBLIC FINANCE
              </Badge>
              {shouldUseGovernmentStructureData(governmentData) && (
                <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                  <Building2 className="h-3 w-3 mr-1" />
                  AUTO-GENERATED FROM STRUCTURE
                </Badge>
              )}
            </div>
            {shouldUseGovernmentStructureData(governmentData) && (
              <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <Building2 className="h-4 w-4 inline mr-2" />
                  Spending data is automatically generated from your Government Structure. 
                  Modify departments and budget allocations in the "Gov Structure" tab to update spending.
                </p>
              </div>
            )}
            <GovernmentSpending
              spendingData={economicInputs.governmentSpending}
              nominalGDP={economicInputs.coreIndicators.nominalGDP}
              totalPopulation={economicInputs.coreIndicators.totalPopulation}
              onSpendingDataChangeAction={(newSpendingData) => {
                handleInputsChange({
                  ...economicInputs,
                  governmentSpending: newSpendingData
                });
              }}
              isReadOnly={shouldUseGovernmentStructureData(governmentData)}
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="structure" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-hierarchy-child rounded-xl p-6 bg-gradient-to-br from-yellow-50/50 to-amber-50/50 dark:from-yellow-950/20 dark:to-amber-950/20 border border-yellow-200/50 dark:border-yellow-700/50"
          >
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="h-6 w-6 text-yellow-600" />
              <h3 className="text-xl font-semibold">Government Structure</h3>
              <Badge variant="outline" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                <Crown className="h-3 w-3 mr-1" />
                DEPARTMENTS & BUDGETS
              </Badge>
            </div>
            {governmentData ? (
              <GovernmentBuilder
                initialData={governmentData}
                onSave={handleGovernmentSave}
                onPreview={(data) => {
                  console.log('Government preview:', data);
                  setGovernmentData(data);
                }}
                
              />
            ) : governmentLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <Card className="border-2 border-dashed border-yellow-300 dark:border-yellow-700">
                <CardContent className="p-8 text-center">
                  <Building2 className="h-16 w-16 mx-auto text-yellow-400 mb-4" />
                  <h4 className="text-lg font-semibold mb-2">No Government Structure</h4>
                  <p className="text-muted-foreground mb-4">
                    Set up your nation's government structure to manage departments and budgets.
                  </p>
                  <Button 
                    onClick={() => {
                      if (country && economicInputs) {
                        const defaultData: GovernmentBuilderState = {
                          structure: {
                            governmentName: `Government of ${country.name}`,
                            governmentType: 'Constitutional Monarchy',
                            totalBudget: economicInputs.coreIndicators.nominalGDP * 0.35,
                            fiscalYear: 'Calendar Year',
                            budgetCurrency: 'USD'
                          },
                          departments: [],
                          budgetAllocations: [],
                          revenueSources: [],
                          isValid: false,
                          errors: {}
                        };
                        setGovernmentData(defaultData);
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <Building2 className="h-4 w-4" />
                    Create Government Structure
                  </Button>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </TabsContent>

        <TabsContent value="demographics" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-hierarchy-child rounded-xl p-6 bg-gradient-to-br from-orange-50/50 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200/50 dark:border-orange-700/50"
          >
            <div className="flex items-center gap-3 mb-6">
              <Users className="h-6 w-6 text-orange-600" />
              <h3 className="text-xl font-semibold">Demographics</h3>
              <Badge variant="outline" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                <Users className="h-3 w-3 mr-1" />
                POPULATION DATA
              </Badge>
            </div>
            <Demographics
              inputs={economicInputs}
              onInputsChange={(newInputs: any) => {
                handleInputsChange(newInputs);
              }}
              isReadOnly={false}
              showComparison={true}
              showAdvanced={showAdvanced}
              referenceCountry={undefined}
            />
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
