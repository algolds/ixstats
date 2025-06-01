// src/app/countries/_components/economy/CountryEconomicDataSection.tsx
"use client";

import { useState, useEffect } from "react";
import { 
  BarChart3, 
  Briefcase, 
  Building, 
  Scale, 
  Building2, 
  Users, 
  Edit3, 
  Save, 
  X,
  Loader2,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import { CoreEconomicIndicators } from "./CoreEconomicIndicators";
import { LaborEmployment } from "./LaborEmployment";
// Import other economic components as they're created
// import { FiscalSystem } from "./FiscalSystem";
// import { IncomeWealthDistribution } from "./IncomeWealthDistribution";
// import { GovernmentSpending } from "./GovernmentSpending";
// import { Demographics } from "./Demographics";

interface CountryEconomicDataSectionProps {
  countryId: string;
  countryName: string;
  isEditable?: boolean;
}

interface EconomicData {
  coreIndicators: {
    totalPopulation: number;
    nominalGDP: number;
    gdpPerCapita: number;
    realGDPGrowthRate: number;
    inflationRate: number;
    currencyExchangeRate: number;
  };
  laborEmployment: {
    laborForceParticipationRate: number;
    employmentRate: number;
    unemploymentRate: number;
    totalWorkforce: number;
    averageWorkweekHours: number;
    minimumWage: number;
    averageAnnualIncome: number;
  };
  // Add other economic data structures as components are created
}

const defaultEconomicData: EconomicData = {
  coreIndicators: {
    totalPopulation: 1000000,
    nominalGDP: 25000000000,
    gdpPerCapita: 25000,
    realGDPGrowthRate: 0.03,
    inflationRate: 0.02,
    currencyExchangeRate: 1.0,
  },
  laborEmployment: {
    laborForceParticipationRate: 65,
    employmentRate: 95,
    unemploymentRate: 5,
    totalWorkforce: 650000,
    averageWorkweekHours: 40,
    minimumWage: 12,
    averageAnnualIncome: 35000,
  },
};

export function CountryEconomicDataSection({ 
  countryId, 
  countryName,
  isEditable = false 
}: CountryEconomicDataSectionProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedTab, setSelectedTab] = useState("core");
  const [economicData, setEconomicData] = useState<EconomicData>(defaultEconomicData);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch country economic data
  const { 
    data: countryData, 
    isLoading, 
    error,
    refetch 
  } = api.countries.getByIdWithEconomicData.useQuery({
    id: countryId,
  });

  // Update economic data mutation
  const updateEconomicDataMutation = api.countries.updateEconomicData.useMutation({
    onSuccess: () => {
      setHasUnsavedChanges(false);
      setIsEditMode(false);
      void refetch();
    },
    onError: (error) => {
      console.error("Failed to update economic data:", error);
    },
  });

  // Load data when country data is fetched
  useEffect(() => {
    if (countryData) {
      const loadedData: EconomicData = {
        coreIndicators: {
          totalPopulation: countryData.baselinePopulation,
          nominalGDP: countryData.nominalGDP || (countryData.baselinePopulation * countryData.baselineGdpPerCapita),
          gdpPerCapita: countryData.baselineGdpPerCapita,
          realGDPGrowthRate: countryData.realGDPGrowthRate || countryData.adjustedGdpGrowth || 0.03,
          inflationRate: countryData.inflationRate || 0.02,
          currencyExchangeRate: countryData.currencyExchangeRate || 1.0,
        },
        laborEmployment: {
          laborForceParticipationRate: countryData.laborForceParticipationRate || 65,
          employmentRate: countryData.employmentRate || 95,
          unemploymentRate: countryData.unemploymentRate || 5,
          totalWorkforce: countryData.totalWorkforce || Math.round(countryData.baselinePopulation * 0.65),
          averageWorkweekHours: countryData.averageWorkweekHours || 40,
          minimumWage: countryData.minimumWage || 12,
          averageAnnualIncome: countryData.averageAnnualIncome || 35000,
        },
      };
      setEconomicData(loadedData);
    }
  }, [countryData]);

  const handleDataChange = (section: keyof EconomicData, newData: any) => {
    setEconomicData(prev => ({
      ...prev,
      [section]: newData
    }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    try {
      await updateEconomicDataMutation.mutateAsync({
        countryId,
        economicData: {
          // Core indicators
          nominalGDP: economicData.coreIndicators.nominalGDP,
          realGDPGrowthRate: economicData.coreIndicators.realGDPGrowthRate,
          inflationRate: economicData.coreIndicators.inflationRate,
          currencyExchangeRate: economicData.coreIndicators.currencyExchangeRate,
          
          // Labor & Employment
          laborForceParticipationRate: economicData.laborEmployment.laborForceParticipationRate,
          employmentRate: economicData.laborEmployment.employmentRate,
          unemploymentRate: economicData.laborEmployment.unemploymentRate,
          totalWorkforce: economicData.laborEmployment.totalWorkforce,
          averageWorkweekHours: economicData.laborEmployment.averageWorkweekHours,
          minimumWage: economicData.laborEmployment.minimumWage,
          averageAnnualIncome: economicData.laborEmployment.averageAnnualIncome,
          
          // Add other sections as they're implemented
        },
      });
    } catch (error) {
      console.error("Failed to save economic data:", error);
    }
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setHasUnsavedChanges(false);
    // Reset data to last saved state
    void refetch();
  };

  const economicSections = [
    {
      id: "core",
      label: "Core Indicators",
      icon: BarChart3,
      description: "GDP, population, growth rates",
    },
    {
      id: "labor",
      label: "Labor & Employment",
      icon: Briefcase,
      description: "Workforce, unemployment, wages",
    },
    {
      id: "fiscal",
      label: "Fiscal System",
      icon: Building,
      description: "Taxes, budget, debt",
      disabled: true, // Enable as components are created
    },
    {
      id: "income",
      label: "Income & Wealth",
      icon: Scale,
      description: "Distribution, inequality, mobility",
      disabled: true,
    },
    {
      id: "spending",
      label: "Gov. Spending",
      icon: Building2,
      description: "Budget allocation, priorities",
      disabled: true,
    },
    {
      id: "demographics",
      label: "Demographics",
      icon: Users,
      description: "Population structure, education",
      disabled: true,
    },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Economic Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading economic data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Economic Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load economic data: {error.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Economic Data
            </CardTitle>
            <CardDescription>
              Comprehensive economic profile for {countryName}
            </CardDescription>
          </div>
          
          {isEditable && (
            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-yellow-600">
                  Unsaved Changes
                </Badge>
              )}
              
              {isEditMode ? (
                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={updateEconomicDataMutation.isPending}
                    size="sm"
                  >
                    {updateEconomicDataMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleCancel}
                    variant="outline"
                    size="sm"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setIsEditMode(true)}
                  variant="outline"
                  size="sm"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-6">
            {economicSections.map((section) => {
              const Icon = section.icon;
              return (
                <TabsTrigger 
                  key={section.id} 
                  value={section.id}
                  disabled={section.disabled}
                  className="flex flex-col gap-1 p-2 h-auto"
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs">{section.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="mt-6">
            <TabsContent value="core" className="space-y-0">
              <CoreEconomicIndicators
                indicators={economicData.coreIndicators}
                onIndicatorsChange={(data) => handleDataChange('coreIndicators', data)}
                isReadOnly={!isEditMode}
                showComparison={false}
              />
            </TabsContent>

            <TabsContent value="labor" className="space-y-0">
              <LaborEmployment
                laborData={economicData.laborEmployment}
                totalPopulation={economicData.coreIndicators.totalPopulation}
                onLaborDataChange={(data) => handleDataChange('laborEmployment', data)}
                isReadOnly={!isEditMode}
                showComparison={false}
              />
            </TabsContent>

            <TabsContent value="fiscal" className="space-y-0">
              <div className="text-center py-8 text-muted-foreground">
                <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Fiscal System</h3>
                <p>Tax rates, government budget, and debt management</p>
                <p className="text-sm mt-2">Coming soon...</p>
              </div>
            </TabsContent>

            <TabsContent value="income" className="space-y-0">
              <div className="text-center py-8 text-muted-foreground">
                <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Income & Wealth Distribution</h3>
                <p>Economic classes, inequality metrics, and social mobility</p>
                <p className="text-sm mt-2">Coming soon...</p>
              </div>
            </TabsContent>

            <TabsContent value="spending" className="space-y-0">
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Government Spending</h3>
                <p>Budget allocation and spending priorities</p>
                <p className="text-sm mt-2">Coming soon...</p>
              </div>
            </TabsContent>

            <TabsContent value="demographics" className="space-y-0">
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Demographics</h3>
                <p>Population structure, education levels, and regional distribution</p>
                <p className="text-sm mt-2">Coming soon...</p>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}