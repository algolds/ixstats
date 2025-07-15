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
  Info,
  RefreshCw
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
import { FiscalSystemComponent } from "./FiscalSystemComponent";
import { IncomeWealthDistribution } from "./IncomeWealthDistribution";
import { GovernmentSpending } from "./GovernmentSpending";
import { Demographics } from "./Demographics";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { Skeleton } from "~/components/ui/skeleton";
import type { TRPCClientError } from "@trpc/client";
import type { 
  EconomyData, 
  CoreEconomicIndicatorsData, 
  LaborEmploymentData, 
  FiscalSystemData, 
  IncomeWealthDistributionData, 
  GovernmentSpendingData, 
  DemographicsData 
} from "~/types/economics";

// Helper function to convert DemographicsData to the format expected by Demographics component
const convertDemographicsData = (data: DemographicsData) => {
  return {
    ...data,
    ageDistribution: data.ageDistribution.map((group, index) => ({
      ...group,
      color: group.color || `hsl(${(index * 60) % 360}, 70%, 50%)` // Provide default colors
    })),
    regions: data.regions.map((region, index) => ({
      ...region,
      color: region.color || `hsl(${(index * 45) % 360}, 60%, 60%)`
    })),
    educationLevels: data.educationLevels.map((level, index) => ({
      ...level,
      color: level.color || `hsl(${(index * 90) % 360}, 55%, 65%)`
    })),
    citizenshipStatuses: data.citizenshipStatuses.map((status, index) => ({
      ...status,
      color: status.color || `hsl(${(index * 120) % 360}, 50%, 70%)`
    }))
  };
};

interface EconomicDataDisplayProps {
  countryId: string;
  countryName: string;
  isEditable?: boolean;
  mode?: "full" | "compact" | "overview";
  showTabs?: boolean;
  defaultTab?: string;
  onDataChange?: (data: any) => void;
}

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
  const [economicData, setEconomicData] = useState<EconomyData | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [compactView, setCompactView] = useState(mode === "compact");
  // Add validation state for fiscal/government
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<any[]>([]); // For improved milestone logic

  // Fetch country economic data
  const { 
    data: countryData, 
    isLoading, 
    error,
    refetch 
  } = api.countries.getByIdWithEconomicData.useQuery({
    id: countryId,
  });

  // Initialize state with fetched data when available
  useEffect(() => {
    if (countryData?.economy) {
      setEconomicData(countryData.economy);
    } else if (countryData) {
        // If countryData.economy is missing, try to construct it from top-level fields
        // This provides a fallback if the 'economy' object isn't populated as expected
        // but the individual fields are on the countryData object.
        const constructedEconomyData: EconomyData = {
            core: {
                totalPopulation: countryData.baselinePopulation,
                nominalGDP: countryData.nominalGDP ?? (countryData.baselinePopulation * countryData.baselineGdpPerCapita),
                gdpPerCapita: countryData.currentGdpPerCapita,
                realGDPGrowthRate: countryData.realGDPGrowthRate ?? countryData.adjustedGdpGrowth ?? 0.03,
                inflationRate: countryData.inflationRate ?? 0.02,
                currencyExchangeRate: countryData.currencyExchangeRate ?? 1.0,
            },
            labor: {
                laborForceParticipationRate: countryData.laborForceParticipationRate ?? 65,
                employmentRate: countryData.employmentRate ?? 95,
                unemploymentRate: countryData.unemploymentRate ?? 5,
                totalWorkforce: countryData.totalWorkforce ?? Math.round(countryData.baselinePopulation * 0.65),
                averageWorkweekHours: countryData.averageWorkweekHours ?? 40,
                minimumWage: countryData.minimumWage ?? 12,
                averageAnnualIncome: countryData.averageAnnualIncome ?? 35000,
                employmentBySector: {
                  agriculture: 10,
                  industry: 25,
                  services: 65,
                },
                employmentByType: {
                  fullTime: 80,
                  partTime: 12,
                  temporary: 5,
                  selfEmployed: 10,
                  informal: 8,
                },
                skillsAndProductivity: {
                  averageEducationYears: 12,
                  tertiaryEducationRate: 30,
                  vocationalTrainingRate: 20,
                  skillsGapIndex: 60,
                  laborProductivityIndex: 100,
                  productivityGrowthRate: 2.5,
                },
                demographicsAndConditions: {
                  youthUnemploymentRate: 10,
                  femaleParticipationRate: 60,
                  genderPayGap: 15,
                  unionizationRate: 20,
                  workplaceSafetyIndex: 80,
                  averageCommutingTime: 30,
                },
                regionalEmployment: {
                  urban: {
                    participationRate: 70,
                    unemploymentRate: 4,
                    averageIncome: 40000,
                  },
                  rural: {
                    participationRate: 60,
                    unemploymentRate: 7,
                    averageIncome: 25000,
                  },
                },
                socialProtection: {
                  unemploymentBenefitCoverage: 60,
                  pensionCoverage: 70,
                  healthInsuranceCoverage: 80,
                  paidSickLeaveDays: 8,
                  paidVacationDays: 15,
                  parentalLeaveWeeks: 12,
                },
            },
            fiscal: {
                taxRevenueGDPPercent: countryData.taxRevenueGDPPercent ?? 20,
                governmentRevenueTotal: countryData.governmentRevenueTotal ?? ((countryData.nominalGDP ?? 0) * 0.20),
                taxRevenuePerCapita: countryData.taxRevenuePerCapita ?? (((countryData.nominalGDP ?? 0) * 0.20) / countryData.baselinePopulation),
                governmentBudgetGDPPercent: countryData.governmentBudgetGDPPercent ?? 22,
                budgetDeficitSurplus: countryData.budgetDeficitSurplus ?? 0,
                internalDebtGDPPercent: countryData.internalDebtGDPPercent ?? 30,
                externalDebtGDPPercent: countryData.externalDebtGDPPercent ?? 20,
                totalDebtGDPRatio: countryData.totalDebtGDPRatio ?? 50,
                debtPerCapita: countryData.debtPerCapita ?? 0,
                interestRates: countryData.interestRates ?? 0.03,
                debtServiceCosts: countryData.debtServiceCosts ?? 0,
                taxRates: (countryData.fiscalSystem as any)?.taxRates ?? { // Type assertion if fiscalSystem might be missing
                    personalIncomeTaxRates: [], corporateTaxRates: [], salesTaxRate: 0, propertyTaxRate: 0, payrollTaxRate: 0, exciseTaxRates: [], wealthTaxRate: 0
                },
                governmentSpendingByCategory: (countryData.governmentBudget as any)?.spendingCategories ?? [],
            },
            income: {
                economicClasses: (countryData.incomeDistribution as any)?.economicClasses ? JSON.parse((countryData.incomeDistribution as any).economicClasses as string) : [],
                povertyRate: countryData.povertyRate ?? 15,
                incomeInequalityGini: countryData.incomeInequalityGini ?? 0.35,
                socialMobilityIndex: countryData.socialMobilityIndex ?? 50,
            },
            spending: {
              spendingGDPPercent: countryData.spendingGDPPercent ?? 22,
              spendingPerCapita: countryData.spendingPerCapita ?? 0,
              deficitSurplus: countryData.budgetDeficitSurplus ?? 0,
              spendingCategories: (countryData.governmentBudget as any)?.spendingCategories ? JSON.parse((countryData.governmentBudget as any).spendingCategories as string) : [],
              totalSpending: 0
            },
            demographics: {
              lifeExpectancy: countryData.lifeExpectancy ?? 75,
              literacyRate: countryData.literacyRate ?? 90,
              ageDistribution: (countryData.demographics as any)?.ageDistribution ? JSON.parse((countryData.demographics as any).ageDistribution as string) : [],
              urbanRuralSplit: {
                urban: 0,
                rural: 0
              },
              regions: [],
              educationLevels: [],
              citizenshipStatuses: []
            },
        };
        setEconomicData(constructedEconomyData);
    }
  }, [countryData]);

  // Update economic data mutation
  const updateEconomicDataMutation = api.countries.updateEconomicData.useMutation({
    onSuccess: () => {
      setHasUnsavedChanges(false);
      setIsEditMode(false);
      void refetch();
      if (economicData) {
        onDataChange?.(economicData);
      }
    },
    onError: (error) => {
      console.error("Failed to update economic data:", error);
    },
  });

  const handleDataChange = (section: keyof EconomyData, newData: any) => {
    setEconomicData(prev => {
      if (!prev) return null; 
      const updatedData = {
        ...prev,
        [section]: {
           ...(prev[section] as any), // Cast to any to allow spread of potentially different structures
           ...newData
        } as any // Cast the specific section to any
      };
      // Milestone logic: check for major changes in fiscal/government
      if (section === 'fiscal') {
        const prevGdp = prev?.core?.nominalGDP || 0;
        const newGdp = updatedData.core?.nominalGDP || 0;
        if (prevGdp < 1_000_000_000_000 && newGdp >= 1_000_000_000_000) {
          setMilestones(m => [...m, { type: 'milestone', message: 'GDP surpassed $1T', date: new Date() }]);
        }
        // Add more milestone checks as needed
      }
      if (section === 'fiscal' && newData.budgetDeficitSurplus !== undefined) {
        if (newData.budgetDeficitSurplus > 0 && (prev?.fiscal?.budgetDeficitSurplus ?? 0) <= 0) {
          setMilestones(m => [...m, { type: 'milestone', message: 'Budget turned to surplus', date: new Date() }]);
        }
        if (newData.budgetDeficitSurplus < 0 && (prev?.fiscal?.budgetDeficitSurplus ?? 0) >= 0) {
          setMilestones(m => [...m, { type: 'milestone', message: 'Budget turned to deficit', date: new Date() }]);
        }
      }
      setHasUnsavedChanges(true);
      return updatedData;
    });
  };

  const handleSave = async () => {
    setValidationErrors([]);
    setSuccessMessage(null);
    if (!economicData) return; 
    // Simple validation example for fiscal
    const errors: string[] = [];
    if (economicData.fiscal.taxRevenueGDPPercent < 0 || economicData.fiscal.taxRevenueGDPPercent > 100) {
      errors.push('Tax revenue % must be between 0 and 100.');
    }
    if (economicData.fiscal.governmentBudgetGDPPercent < 0 || economicData.fiscal.governmentBudgetGDPPercent > 100) {
      errors.push('Budget % must be between 0 and 100.');
    }
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    const flattenedEconomicData = {
        ...economicData.core,
        ...economicData.labor,
        ...economicData.fiscal,
        ...economicData.income,
        ...economicData.spending,
        ...economicData.demographics,
    };

    try {
      await updateEconomicDataMutation.mutateAsync({
        countryId,
        economicData: flattenedEconomicData
      });
      setSuccessMessage('Economic data saved successfully.');
    } catch (error) {
      setValidationErrors(['Failed to save economic data.']);
      console.error("Failed to save economic data:", error);
    }
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setHasUnsavedChanges(false);
    void refetch();
  };

  const economicSections = [
    {
      id: "core",
      label: "Core Indicators",
      icon: BarChart3,
      description: "GDP, population, growth rates",
      component: CoreEconomicIndicators,
      disabled: false,
    },
    {
      id: "labor",
      label: "Labor & Employment",
      icon: Briefcase,
      description: "Workforce, unemployment, wages",
      component: LaborEmployment,
      disabled: false,
    },
    {
      id: "fiscal",
      label: "Fiscal System",
      icon: Building,
      description: "Taxes, budget, debt",
      component: FiscalSystemComponent,
      disabled: false,
    },
    {
      id: "income",
      label: "Income & Wealth",
      icon: Scale,
      description: "Distribution, inequality, mobility",
      component: IncomeWealthDistribution,
      disabled: false,
    },
    {
      id: "spending",
      label: "Gov. Spending",
      icon: Building2,
      description: "Budget allocation, priorities",
      component: GovernmentSpending,
      disabled: false,
    },
    {
      id: "demographics",
      label: "Demographics",
      icon: Users,
      description: "Population structure, education",
      component: Demographics,
      disabled: false,
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
                {formatPopulation(economicData?.core?.totalPopulation || 0)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">GDP per Capita</div>
              <div className="text-lg font-semibold">
                {formatCurrency(economicData?.core?.gdpPerCapita || 0)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Total GDP</div>
              <div className="text-lg font-semibold">
                {formatCurrency(economicData?.core?.nominalGDP || 0)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Unemployment</div>
              <div className="text-lg font-semibold">
                {economicData?.labor?.unemploymentRate !== undefined ? economicData.labor.unemploymentRate.toFixed(1) + '%' : "N/A"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state (for full mode before data is fetched)
  if (isLoading || (mode === "full" && showTabs && !economicData)) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/3 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
            Loading economic data...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    const trpcError = error as TRPCClientError<any>; // Type assertion
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
              Failed to load economic data: {trpcError.message || "An unknown error occurred."}
            </AlertDescription>
          </Alert>
          <div className="mt-4 text-center">
            <Button onClick={() => refetch()} className="mt-4" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" /> Retry
              </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full mode with tabs (and data is loaded)
  if (mode === "full" && showTabs && economicData) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">Economic Data</CardTitle>
          {isEditable && (
            <div className="flex items-center space-x-2">
              {isEditMode && hasUnsavedChanges && (
                <Badge variant="secondary" className="flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" /> Unsaved Changes
                </Badge>
              )}
              {updateEconomicDataMutation.isPending && (
                <Badge variant="outline" className="flex items-center">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving...
                </Badge>
              )}
              <Button
                onClick={() => setIsEditMode(!isEditMode)}
                variant="outline"
                size="sm"
                disabled={updateEconomicDataMutation.isPending}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                {isEditMode ? "Cancel Edit" : "Edit Data"}
              </Button>
              {isEditMode && (
                <Button onClick={handleSave} size="sm" disabled={!hasUnsavedChanges || updateEconomicDataMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" /> Save
                </Button>
              )}
              {isEditMode && hasUnsavedChanges && (
                <Button onClick={handleCancel} size="sm" variant="ghost" disabled={updateEconomicDataMutation.isPending}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-6">
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-4">
              {economicSections.map((section) => (
                <TabsTrigger key={section.id} value={section.id} disabled={section.disabled}>
                  {section.icon && <section.icon className="h-4 w-4 mr-1" />} {section.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {validationErrors.length > 0 && (
              <div className="mb-4">
                {validationErrors.map((err, i) => (
                  <div key={i} className="text-red-600 text-sm">{err}</div>
                ))}
              </div>
            )}
            {successMessage && (
              <div className="mb-4 text-green-600 text-sm">{successMessage}</div>
            )}
            {economicSections.map((section) => {
              if (section.disabled) return null;

              return (
                <TabsContent key={section.id} value={section.id} className="mt-0">
                  {section.id === 'core' && economicData.core && (
                    <CoreEconomicIndicators 
                      indicators={economicData.core}
                      onIndicatorsChangeAction={(newData: CoreEconomicIndicatorsData) => handleDataChange('core', newData)}
                      isReadOnly={!isEditMode}
                      showComparison={false}
                    />
                  )}
                  {section.id === 'labor' && economicData.labor && economicData.core?.totalPopulation !== undefined && (
                    <LaborEmployment 
                      laborData={economicData.labor}
                      onLaborDataChangeAction={(newData: LaborEmploymentData) => handleDataChange('labor', newData)}
                      totalPopulation={economicData.core.totalPopulation}
                      isReadOnly={!isEditMode}
                      showComparison={false}
                    />
                  )}
                  {section.id === 'fiscal' && economicData.fiscal && economicData.core?.nominalGDP !== undefined && economicData.core?.totalPopulation !== undefined && (
                    <FiscalSystemComponent
                      fiscalData={economicData.fiscal}
                      nominalGDP={economicData.core.nominalGDP}
                      totalPopulation={economicData.core.totalPopulation}
                      onFiscalDataChange={isEditMode ? (data) => handleDataChange('fiscal', data) : undefined}
                      isReadOnly={!isEditMode}
                      showAnalytics={true}
                    />
                  )}
                  {section.id === 'income' && economicData.income && economicData.core?.totalPopulation !== undefined && economicData.core?.gdpPerCapita !== undefined && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Income & Wealth Distribution</CardTitle>
                        <CardDescription>Economic classes and inequality metrics</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground">Income distribution component will be implemented.</p>
                      </CardContent>
                    </Card>
                  )}
                  {section.id === 'spending' && economicData.spending && economicData.core?.nominalGDP !== undefined && economicData.core?.totalPopulation !== undefined && (
                    <GovernmentSpending
                      spendingData={economicData.spending}
                      nominalGDP={economicData.core.nominalGDP}
                      totalPopulation={economicData.core.totalPopulation}
                      onSpendingDataChangeAction={(data) => { if (isEditMode) { handleDataChange('spending', data); } }}
                      isReadOnly={!isEditMode}
                    />
                  )}
                  {section.id === 'demographics' && economicData.demographics && economicData.core?.totalPopulation !== undefined && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Demographics</CardTitle>
                        <CardDescription>Population structure and education</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground">Demographics component will be implemented.</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    );
  }
  
  // Fallback for compact mode or if data isn't loaded after checks
  return (
    <Card>
      <CardHeader>
        <CardTitle>Economic Data</CardTitle>
        <CardDescription>Detailed economic data for {countryName}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 text-center">
        <Info className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading data..." : "Economic data display mode not configured or data is unavailable."}
        </p>
      </CardContent>
    </Card>
  );
}
