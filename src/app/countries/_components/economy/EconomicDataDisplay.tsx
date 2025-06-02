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
import { formatCurrency, formatPopulation } from "./utils";
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
      // Construct economy data from individual fields if economy object is missing
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
          taxRates: {
            personalIncomeTaxRates: [],
            corporateTaxRates: [],
            salesTaxRate: 0,
            propertyTaxRate: 0,
            payrollTaxRate: 0,
            exciseTaxRates: [],
            wealthTaxRate: 0
          },
          governmentSpendingByCategory: [],
        },
        income: {
          economicClasses: [],
          povertyRate: countryData.povertyRate ?? 15,
          incomeInequalityGini: countryData.incomeInequalityGini ?? 0.35,
          socialMobilityIndex: countryData.socialMobilityIndex ?? 50,
        },
        spending: {
          totalSpending: countryData.totalGovernmentSpending ?? 0,
          spendingGDPPercent: countryData.spendingGDPPercent ?? 22,
          spendingPerCapita: countryData.spendingPerCapita ?? 0,
          deficitSurplus: countryData.budgetDeficitSurplus ?? 0,
          spendingCategories: []
        },
        demographics: {
          lifeExpectancy: countryData.lifeExpectancy ?? 75,
          urbanRuralSplit: {
            urban: countryData.urbanPopulationPercent ?? 60,
            rural: countryData.ruralPopulationPercent ?? 40
          },
          ageDistribution: [],
          regions: [],
          educationLevels: [],
          literacyRate: countryData.literacyRate ?? 90,
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
        [section]: newData
      };
      return updatedData;
    });
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (!economicData) return; 
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
    } catch (error) {
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

  // Loading state
  if (isLoading || !economicData) {
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
    const trpcError = error as TRPCClientError<any>;
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

  // Full mode with tabs
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
                <section.icon className="h-4 w-4 mr-1" /> {section.label}
              </TabsTrigger>
            ))}
          </TabsList>

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
                    onFiscalDataChange={(newData: FiscalSystemData) => handleDataChange('fiscal', newData)}
                    isReadOnly={!isEditMode}
                    showAnalytics={true}
                  />
                )}
                {section.id === 'income' && economicData.income && economicData.core?.totalPopulation !== undefined && economicData.core?.gdpPerCapita !== undefined && (
                  <IncomeWealthDistribution
                    incomeData={economicData.income}
                    totalPopulation={economicData.core.totalPopulation}
                    gdpPerCapita={economicData.core.gdpPerCapita}
                    onIncomeDataChange={(newData: IncomeWealthDistributionData) => handleDataChange('income', newData)}
                    isReadOnly={!isEditMode}
                    showAnalytics={true}
                  />
                )}
                {section.id === 'spending' && economicData.spending && economicData.core?.nominalGDP !== undefined && economicData.core?.totalPopulation !== undefined && (
                  <GovernmentSpending
                    spendingData={economicData.spending}
                    nominalGDP={economicData.core.nominalGDP}
                    totalPopulation={economicData.core.totalPopulation}
                    onSpendingDataChangeAction={(newData: GovernmentSpendingData) => handleDataChange('spending', newData)}
                    isReadOnly={!isEditMode}
                    showAnalytics={true}
                  />
                )}
                {section.id === 'demographics' && economicData.demographics && economicData.core?.totalPopulation !== undefined && (
                  <Demographics
                    demographicData={economicData.demographics}
                    totalPopulation={economicData.core.totalPopulation}
                    onDemographicDataChange={(newData: DemographicsData) => handleDataChange('demographics', newData)}
                    isReadOnly={!isEditMode}
                    showAnalytics={true}
                  />
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}