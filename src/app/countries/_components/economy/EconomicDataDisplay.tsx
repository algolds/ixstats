// src/app/countries/_components/economy/EconomicDataDisplay.tsx
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
  AlertCircle,
  Eye,
  EyeOff,
  Calendar,
  BarChart2,
  PieChart
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";
import { CoreEconomicIndicators } from "./CoreEconomicIndicators";
import { LaborEmployment } from "./LaborEmployment";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { FiscalSystem } from "./FiscalSystem";
import { Demographics } from "./Demographics";
import { ComparativeAnalysis } from "./ComparativeAnalysis";
import { HistoricalEconomicTracker } from "./HistoricalEconomicTracker";

interface EconomicDataDisplayProps {
  countryId: string;
  countryName: string;
  isEditable?: boolean;
  mode?: "full" | "compact" | "overview";
  showTabs?: boolean;
  defaultTab?: string;
  onDataChange?: (data: any) => void;
}

interface EconomicSummary {
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
  fiscalSystem: {
    taxRevenueGDPPercent: number;
    governmentBudgetGDPPercent: number;
    totalDebtGDPRatio: number;
    budgetDeficitSurplus: number;
    governmentRevenueTotal: number;
    taxRevenuePerCapita: number;
    internalDebtGDPPercent: number;
    externalDebtGDPPercent: number;
    debtPerCapita: number;
    debtServiceCosts: number;
    interestRates: number;
    taxRates: any;
    governmentSpendingByCategory: any;
  };
  demographicData: {
    ageDistribution: Array<{ group: string; percent: number; color: string }>;
    lifeExpectancy: number;
    urbanPopulationPercent: number;
    ruralPopulationPercent: number;
    regions: Array<{ name: string; population: number; urbanPercent: number; color: string }>;
    educationLevels: Array<{ level: string; percent: number; color: string }>;
    literacyRate: number;
    citizenshipStatuses: Array<{ status: string; percent: number; color: string }>;
  };
  comparativeAnalysis: {
    userCountry: any;
    allCountries: any[];
  };
  historicalData: Array<{
    timestamp: number;
    population: number;
    gdpPerCapita: number;
    totalGdp: number;
    unemploymentRate: number;
    inflationRate: number;
    events: Array<any>;
  }>;
}

const defaultEconomicData: EconomicSummary = {
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
  fiscalSystem: {
    taxRevenueGDPPercent: 20,
    governmentBudgetGDPPercent: 22,
    totalDebtGDPRatio: 50,
    budgetDeficitSurplus: (20 - 22) / 100 * 25000000000,
    governmentRevenueTotal: 20 / 100 * 25000000000,
    taxRevenuePerCapita: (20 / 100 * 25000000000) / 1000000,
    internalDebtGDPPercent: 30,
    externalDebtGDPPercent: 20,
    debtPerCapita: (50 / 100 * 25000000000) / 1000000,
    debtServiceCosts: (50 / 100 * 25000000000 * 3) / 10000,
    interestRates: 3,
    taxRates: {
      personalIncomeTaxRates: [{ bracket: 50000, rate: 15 }, { bracket: 100000, rate: 25 }],
      corporateTaxRates: [{ size: 'Small', rate: 10 }, { size: 'Large', rate: 20 }],
      salesTaxRate: 5,
      propertyTaxRate: 1,
      payrollTaxRate: 15,
      wealthTaxRate: 0,
      exciseTaxRates: [{ type: 'Alcohol', rate: 10 }],
    },
    governmentSpendingByCategory: [
      { category: 'Defense', amount: 0, percent: 15 },
      { category: 'Education', amount: 0, percent: 20 },
      { category: 'Healthcare', amount: 0, percent: 20 },
      { category: 'Infrastructure', amount: 0, percent: 10 },
      { category: 'Social Security', amount: 0, percent: 15 },
      { category: 'Other', amount: 0, percent: 20 },
    ],
  },
  demographicData: {
    ageDistribution: [
      { group: '0-15', percent: 20, color: '#FF6B6B' },
      { group: '16-64', percent: 65, color: '#48BB78' },
      { group: '65+', percent: 15, color: '#4299E1' },
    ],
    lifeExpectancy: 75,
    urbanPopulationPercent: 60,
    ruralPopulationPercent: 40,
    regions: [],
    educationLevels: [
      { level: 'Primary', percent: 20, color: '#F6E05E' },
      { level: 'Secondary', percent: 40, color: '#ED8936' },
      { level: 'Higher Education', percent: 25, color: '#6B46C1' },
      { level: 'No Formal Education', percent: 15, color: '#718096' },
    ],
    literacyRate: 90,
    citizenshipStatuses: [],
  },
  comparativeAnalysis: {
    userCountry: null,
    allCountries: [],
  },
  historicalData: [],
};

export function EconomicDataDisplay({ 
  countryId, 
  countryName,
  isEditable = false,
  mode = "full",
  showTabs = true,
  defaultTab = "core",
  onDataChange
}: EconomicDataDisplayProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedTab, setSelectedTab] = useState(defaultTab);
  const [economicData, setEconomicData] = useState<EconomicSummary>(defaultEconomicData);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [compactView, setCompactView] = useState(mode === "compact");

  // Fetch country economic data
  const { 
    data: countryData, 
    isLoading, 
    error,
    refetch 
  } = api.countries.getByIdWithEconomicData.useQuery({
    id: countryId,
  });

  // Update economic data state when countryData is loaded
  useEffect(() => {
    if (countryData) {
      setEconomicData(countryData);
    }
  }, [countryData]);

  // Update economic data mutation
  const updateEconomicDataMutation = api.countries.updateEconomicData.useMutation({
    onSuccess: () => {
      setHasUnsavedChanges(false);
      setIsEditMode(false);
      void refetch();
      onDataChange?.(economicData);
    },
    onError: (error) => {
      console.error("Failed to update economic data:", error);
    },
  });

  // Add event mutation for HistoricalEconomicTracker
  const addEconomicEventMutation = api.countries.addEconomicEvent.useMutation({
    onSuccess: () => {
      void refetch();
    },
    onError: (error: Error) => {
      console.error("Failed to add economic event:", error);
    },
  });

  // Edit event mutation for HistoricalEconomicTracker
  const editEconomicEventMutation = api.countries.editEconomicEvent.useMutation({
    onSuccess: () => {
      void refetch();
    },
    onError: (error) => {
      console.error("Failed to edit economic event:", error);
    },
  });

  // Delete event mutation for HistoricalEconomicTracker
  const deleteEconomicEventMutation = api.countries.deleteEconomicEvent.useMutation({
    onSuccess: () => {
      void refetch();
    },
    onError: (error) => {
      console.error("Failed to delete economic event:", error);
    },
  });

  const handleDataChange = (section: keyof EconomicSummary, newData: any) => {
    setEconomicData(prev => ({
      ...prev,
      [section]: newData
    }));
    setHasUnsavedChanges(true);
    onDataChange?.(economicData);
  };

  const handleSave = async () => {
    try {
      await updateEconomicDataMutation.mutateAsync({
        countryId,
        economicData: economicData,
      });
    } catch (error) {
      console.error("Failed to save economic data:", error);
    }
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setHasUnsavedChanges(false);
    void refetch();
  };

  const handleAddEvent = (event: any) => {
    addEconomicEventMutation.mutate({ countryId, event });
  };

  const handleEditEvent = (eventId: string, event: any) => {
    editEconomicEventMutation.mutate({ eventId, event });
  };

  const handleDeleteEvent = (eventId: string) => {
    deleteEconomicEventMutation.mutate({ eventId });
  };

  const economicSections = [
    {
      id: "core",
      label: "Core Indicators",
      icon: BarChart3,
      description: "GDP, population, growth rates",
      component: CoreEconomicIndicators,
    },
    {
      id: "labor",
      label: "Labor & Employment",
      icon: Briefcase,
      description: "Workforce, unemployment, wages",
      component: LaborEmployment,
    },
    {
      id: "fiscal",
      label: "Fiscal System",
      icon: Building,
      description: "Taxes, budget, debt",
      component: FiscalSystem,
    },
    {
      id: "demographics",
      label: "Demographics",
      icon: Users,
      description: "Population structure, education",
      component: Demographics,
    },
    {
      id: "comparative",
      label: "Comparative",
      icon: BarChart2,
      description: "Compare with other countries/regions",
      component: ComparativeAnalysis,
    },
    {
      id: "history",
      label: "History",
      icon: Calendar,
      description: "Historical data and events",
      component: HistoricalEconomicTracker,
    },
  ];

  // Overview mode - compact summary
  if (mode === "overview") {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Economic Overview
              </CardTitle>
              <CardDescription>Key economic indicators for {countryName}</CardDescription>
            </div>
            {isEditable && (
              <Button
                onClick={() => setIsEditMode(!isEditMode)}
                variant="outline"
                size="sm"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                {isEditMode ? "Cancel" : "Edit"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Population</div>
              <div className="text-lg font-semibold">
                {formatPopulation(economicData.coreIndicators.totalPopulation)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">GDP per Capita</div>
              <div className="text-lg font-semibold">
                {formatCurrency(economicData.coreIndicators.gdpPerCapita)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Total GDP</div>
              <div className="text-lg font-semibold">
                {formatCurrency(economicData.coreIndicators.nominalGDP)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Unemployment</div>
              <div className="text-lg font-semibold">
                {economicData.laborEmployment.unemploymentRate.toFixed(1)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
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

  // Error state
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

  // Full mode with tabs
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
          
          <div className="flex items-center gap-2">
            {mode === "full" && (
              <div className="flex items-center space-x-2">
                <Switch 
                  id="compact-view" 
                  checked={compactView}
                  onCheckedChange={setCompactView}
                />
                <Label htmlFor="compact-view" className="text-sm">
                  {compactView ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Label>
              </div>
            )}
            
            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-yellow-600">
                Unsaved Changes
              </Badge>
            )}
            
            {isEditable && (
              <div className="flex gap-2">
                {isEditMode ? (
                  <>
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
                  </>
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
        </div>
      </CardHeader>
      
      <CardContent>
        {showTabs ? (
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className={`grid w-full ${compactView ? 'grid-cols-3' : 'grid-cols-6'}`}>
              {economicSections
                .filter(section => compactView ? (section.id === 'core' || section.id === 'labor' || section.id === 'fiscal') : true)
                .map((section) => {
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
                  onIndicatorsChangeAction={(data) => handleDataChange('coreIndicators', data)}
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
                {economicData.fiscalSystem && (
                  <FiscalSystem
                    fiscalData={economicData.fiscalSystem}
                    nominalGDP={economicData.coreIndicators.nominalGDP}
                    totalPopulation={economicData.coreIndicators.totalPopulation}
                    onFiscalDataChange={(data) => handleDataChange('fiscalSystem', data)}
                    isReadOnly={!isEditMode}
                    showComparison={false}
                  />
                )}
              </TabsContent>

              <TabsContent value="demographics" className="space-y-0">
                {economicData.demographicData && (
                  <Demographics
                    demographicData={economicData.demographicData}
                    totalPopulation={economicData.coreIndicators.totalPopulation}
                    onDemographicDataChangeAction={(data) => handleDataChange('demographicData', data)}
                    isReadOnly={!isEditMode}
                    showComparison={false}
                  />
                )}
              </TabsContent>

              <TabsContent value="comparative" className="space-y-0">
                {economicData.comparativeAnalysis && economicData.comparativeAnalysis.userCountry && economicData.comparativeAnalysis.allCountries && (
                  <ComparativeAnalysis
                    userCountry={economicData.comparativeAnalysis.userCountry}
                    allCountries={economicData.comparativeAnalysis.allCountries}
                  />
                )}
                {(!economicData.comparativeAnalysis || !economicData.comparativeAnalysis.userCountry || !economicData.comparativeAnalysis.allCountries) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">Comparative Analysis Data Missing</h3>
                    <p>Cannot display comparative analysis. Data might not be available for this country or in the current dataset.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-0">
                {economicData.historicalData && (
                  <HistoricalEconomicTracker
                    countryId={countryId}
                    countryName={countryName}
                    historicalData={economicData.historicalData}
                    onAddEvent={handleAddEvent}
                    onEditEvent={handleEditEvent}
                    onDeleteEvent={handleDeleteEvent}
                    isEditable={isEditable}
                  />
                )}
                {!economicData.historicalData && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">Historical Data Missing</h3>
                    <p>Cannot display historical economic data and events.</p>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          // No tabs mode - single section display
          <div className="space-y-6">
            <CoreEconomicIndicators
              indicators={economicData.coreIndicators}
              onIndicatorsChangeAction={(data) => handleDataChange('coreIndicators', data)}
              isReadOnly={!isEditMode}
              showComparison={false}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}