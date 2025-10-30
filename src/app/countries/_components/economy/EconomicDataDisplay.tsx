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
  RefreshCw,
} from "lucide-react";
import { GlassCard } from "~/components/ui/enhanced-card";
import {
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";
import { createDefaultGovernmentSpendingData } from "~/lib/government-spending-defaults";
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
  DemographicsData,
} from "~/types/economics";

// Define types for fiscal, social, and demographic data
interface FiscalData {
  taxRates?: Record<string, number>;
  spendingCategories?: Record<string, number>;
}
interface SocialData {
  economicClasses?: Record<string, number>;
}
interface DemographicData {
  ageDistribution?: Record<string, number>;
}

// Add type guards
function isFiscalData(obj: unknown): obj is FiscalData {
  return (
    typeof obj === "object" && obj !== null && ("taxRates" in obj || "spendingCategories" in obj)
  );
}
function isSocialData(obj: unknown): obj is SocialData {
  return typeof obj === "object" && obj !== null && "economicClasses" in obj;
}
function isDemographicData(obj: unknown): obj is DemographicData {
  return typeof obj === "object" && obj !== null && "ageDistribution" in obj;
}

// Helper function to convert DemographicsData to the format expected by Demographics component
const convertDemographicsData = (data: DemographicsData) => {
  return {
    ...data,
    ageDistribution: data.ageDistribution.map((group, index) => ({
      ...group,
      color: group.color || `hsl(${(index * 60) % 360}, 70%, 50%)`, // Provide default colors
    })),
    regions: data.regions.map((region, index) => ({
      ...region,
      color: region.color || `hsl(${(index * 45) % 360}, 60%, 60%)`,
    })),
    educationLevels: data.educationLevels.map((level, index) => ({
      ...level,
      color: level.color || `hsl(${(index * 90) % 360}, 55%, 65%)`,
    })),
    citizenshipStatuses: data.citizenshipStatuses.map((status, index) => ({
      ...status,
      color: status.color || `hsl(${(index * 120) % 360}, 50%, 70%)`,
    })),
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
  onDataChange,
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
    refetch,
  } = api.countries.getByIdWithEconomicData.useQuery({
    id: countryId,
  });

  // Initialize state with fetched data when available
  useEffect(() => {
    if (countryData) {
      // Construct economy data from individual properties on the countryData object
      // since the CountryWithEconomicData interface stores economic data as top-level fields
      const constructedEconomyData: EconomyData = {
        core: {
          totalPopulation: countryData.baselinePopulation,
          nominalGDP:
            countryData.nominalGDP ??
            countryData.baselinePopulation * countryData.baselineGdpPerCapita,
          gdpPerCapita: countryData.currentGdpPerCapita,
          realGDPGrowthRate: countryData.realGDPGrowthRate ?? countryData.adjustedGdpGrowth ?? 0.03,
          inflationRate: countryData.inflationRate ?? 0.02,
          currencyExchangeRate: countryData.currencyExchangeRate ?? 1.0,
        },
        labor: {
          laborForceParticipationRate: countryData.laborForceParticipationRate ?? 65,
          employmentRate: countryData.employmentRate ?? 95,
          unemploymentRate: countryData.unemploymentRate ?? 5,
          totalWorkforce:
            countryData.totalWorkforce ?? Math.round(countryData.baselinePopulation * 0.65),
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
          taxRevenueGDPPercent: 20, // Default value since property doesn't exist
          governmentRevenueTotal: (countryData.nominalGDP ?? 0) * 0.2,
          taxRevenuePerCapita:
            ((countryData.nominalGDP ?? 0) * 0.2) / countryData.baselinePopulation,
          governmentBudgetGDPPercent: 22, // Default value since property doesn't exist
          budgetDeficitSurplus: 0, // Default value since property doesn't exist
          internalDebtGDPPercent: 30, // Default value since property doesn't exist
          externalDebtGDPPercent: 20, // Default value since property doesn't exist
          totalDebtGDPRatio: 50, // Default value since property doesn't exist
          debtPerCapita: 0, // Default value since property doesn't exist
          interestRates: 0.03, // Default value since property doesn't exist
          debtServiceCosts: 0, // Default value since property doesn't exist
          taxRates: {
            personalIncomeTaxRates: [],
            corporateTaxRates: [],
            salesTaxRate: 0,
            propertyTaxRate: 0,
            payrollTaxRate: 0,
            exciseTaxRates: [],
            wealthTaxRate: 0,
          },
          governmentSpendingByCategory: [],
        },
        income: {
          economicClasses: [],
          povertyRate: 15, // Default value since property doesn't exist
          incomeInequalityGini: 0.35, // Default value since property doesn't exist
          socialMobilityIndex: 50, // Default value since property doesn't exist
        },
        spending: createDefaultGovernmentSpendingData({
          education: 0,
          healthcare: 0,
          socialSafety: 0,
          totalSpending: 0,
          spendingGDPPercent: 22,
          spendingPerCapita: 0,
          deficitSurplus: 0,
          spendingCategories: [],
        }),
        demographics: {
          lifeExpectancy: 75, // Default value since property doesn't exist
          literacyRate: 90, // Default value since property doesn't exist
          ageDistribution: [],
          urbanRuralSplit: {
            urban: 0,
            rural: 0,
          },
          regions: [],
          educationLevels: [],
          citizenshipStatuses: [],
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

  const handleDataChange = (section: keyof EconomyData, newData: unknown) => {
    setEconomicData((prev) => {
      if (!prev) return null;
      const updatedData = {
        ...prev,
        [section]: {
          ...(typeof prev[section] === "object" && prev[section] !== null
            ? { ...prev[section] }
            : {}),
          ...(typeof newData === "object" && newData !== null
            ? (newData as Record<string, any>)
            : {}),
        },
      };
      // Milestone logic: check for major changes in fiscal/government
      if (section === "fiscal") {
        const prevGdp = prev?.core?.nominalGDP ?? 0;
        const newGdp = updatedData.core?.nominalGDP ?? 0;
        if (prevGdp < 1_000_000_000_000 && newGdp >= 1_000_000_000_000) {
          setMilestones((m) => [
            ...m,
            { type: "milestone", message: "GDP surpassed $1T", date: new Date() },
          ]);
        }
        // Add more milestone checks as needed
      }
      if (
        section === "fiscal" &&
        (newData as { budgetDeficitSurplus?: number }).budgetDeficitSurplus !== undefined
      ) {
        if (
          (newData as { budgetDeficitSurplus?: number }).budgetDeficitSurplus! > 0 &&
          (prev?.fiscal?.budgetDeficitSurplus ?? 0) <= 0
        ) {
          setMilestones((m) => [
            ...m,
            { type: "milestone", message: "Budget turned to surplus", date: new Date() },
          ]);
        }
        if (
          (newData as { budgetDeficitSurplus?: number }).budgetDeficitSurplus! < 0 &&
          (prev?.fiscal?.budgetDeficitSurplus ?? 0) >= 0
        ) {
          setMilestones((m) => [
            ...m,
            { type: "milestone", message: "Budget turned to deficit", date: new Date() },
          ]);
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
    if (
      economicData.fiscal.taxRevenueGDPPercent < 0 ||
      economicData.fiscal.taxRevenueGDPPercent > 100
    ) {
      errors.push("Tax revenue % must be between 0 and 100.");
    }
    if (
      economicData.fiscal.governmentBudgetGDPPercent < 0 ||
      economicData.fiscal.governmentBudgetGDPPercent > 100
    ) {
      errors.push("Budget % must be between 0 and 100.");
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
        economicData: flattenedEconomicData,
      });
      setSuccessMessage("Economic data saved successfully.");
    } catch (error) {
      setValidationErrors(["Failed to save economic data."]);
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
      <GlassCard variant="glass">
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
              <Button onClick={() => setIsEditMode(!isEditMode)} variant="outline" size="sm">
                <Edit3 className="mr-2 h-4 w-4" />
                {isEditMode ? "Cancel" : "Edit"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <div className="text-muted-foreground text-sm">Population</div>
              <div className="text-lg font-semibold">
                {formatPopulation(economicData?.core?.totalPopulation || 0)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-sm">GDP per Capita</div>
              <div className="text-lg font-semibold">
                {formatCurrency(economicData?.core?.gdpPerCapita || 0)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-sm">Total GDP</div>
              <div className="text-lg font-semibold">
                {formatCurrency(economicData?.core?.nominalGDP || 0)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-sm">Unemployment</div>
              <div className="text-lg font-semibold">
                {economicData?.labor?.unemploymentRate !== undefined
                  ? economicData.labor.unemploymentRate.toFixed(1) + "%"
                  : "N/A"}
              </div>
            </div>
          </div>
        </CardContent>
      </GlassCard>
    );
  }

  // Loading state (for full mode before data is fetched)
  if (isLoading || (mode === "full" && showTabs && !economicData)) {
    return (
      <GlassCard variant="glass">
        <CardHeader>
          <Skeleton className="mb-2 h-6 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-primary mr-2 h-8 w-8 animate-spin" />
            Loading economic data...
          </div>
        </CardContent>
      </GlassCard>
    );
  }

  // Error state
  if (error) {
    const trpcError = error as TRPCClientError<any>; // Type assertion
    return (
      <GlassCard variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="text-destructive h-5 w-5" />
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
              <RefreshCw className="mr-2 h-4 w-4" /> Retry
            </Button>
          </div>
        </CardContent>
      </GlassCard>
    );
  }

  // Full mode with tabs (and data is loaded)
  if (mode === "full" && showTabs && economicData) {
    return (
      <GlassCard variant="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">Economic Data</CardTitle>
          {isEditable && (
            <div className="flex items-center space-x-2">
              {isEditMode && hasUnsavedChanges && (
                <Badge variant="secondary" className="flex items-center">
                  <AlertCircle className="mr-1 h-3 w-3" /> Unsaved Changes
                </Badge>
              )}
              {updateEconomicDataMutation.isPending && (
                <Badge variant="outline" className="flex items-center">
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Saving...
                </Badge>
              )}
              <Button
                onClick={() => setIsEditMode(!isEditMode)}
                variant="outline"
                size="sm"
                disabled={updateEconomicDataMutation.isPending}
              >
                <Edit3 className="mr-2 h-4 w-4" />
                {isEditMode ? "Cancel Edit" : "Edit Data"}
              </Button>
              {isEditMode && (
                <Button
                  onClick={handleSave}
                  size="sm"
                  disabled={!hasUnsavedChanges || updateEconomicDataMutation.isPending}
                >
                  <Save className="mr-2 h-4 w-4" /> Save
                </Button>
              )}
              {isEditMode && hasUnsavedChanges && (
                <Button
                  onClick={handleCancel}
                  size="sm"
                  variant="ghost"
                  disabled={updateEconomicDataMutation.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-6">
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="mb-4 grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              {economicSections.map((section) => (
                <TabsTrigger key={section.id} value={section.id} disabled={section.disabled}>
                  {section.icon && <section.icon className="mr-1 h-4 w-4" />} {section.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {validationErrors.length > 0 && (
              <div className="mb-4">
                {validationErrors.map((err, i) => (
                  <div key={i} className="text-sm text-red-600">
                    {err}
                  </div>
                ))}
              </div>
            )}
            {successMessage && <div className="mb-4 text-sm text-green-600">{successMessage}</div>}
            {economicSections.map((section) => {
              if (section.disabled) return null;

              return (
                <TabsContent key={section.id} value={section.id} className="mt-0">
                  {section.id === "core" && economicData.core && (
                    <CoreEconomicIndicators
                      indicators={economicData.core}
                      onIndicatorsChangeAction={(newData: CoreEconomicIndicatorsData) =>
                        handleDataChange("core", newData)
                      }
                      isReadOnly={!isEditMode}
                      showComparison={false}
                    />
                  )}
                  {section.id === "labor" &&
                    economicData.labor &&
                    economicData.core?.totalPopulation !== undefined && (
                      <LaborEmployment
                        laborData={economicData.labor}
                        onLaborDataChangeAction={(newData: LaborEmploymentData) =>
                          handleDataChange("labor", newData)
                        }
                        totalPopulation={economicData.core.totalPopulation}
                        isReadOnly={!isEditMode}
                        showComparison={false}
                      />
                    )}
                  {section.id === "fiscal" &&
                    economicData.fiscal &&
                    economicData.core?.nominalGDP !== undefined &&
                    economicData.core?.totalPopulation !== undefined && (
                      <FiscalSystemComponent
                        fiscalData={economicData.fiscal}
                        nominalGDP={economicData.core.nominalGDP}
                        totalPopulation={economicData.core.totalPopulation}
                        onFiscalDataChange={
                          isEditMode ? (data) => handleDataChange("fiscal", data) : undefined
                        }
                        isReadOnly={!isEditMode}
                        showAnalytics={true}
                      />
                    )}
                  {section.id === "income" &&
                    economicData.income &&
                    economicData.core?.totalPopulation !== undefined &&
                    economicData.core?.gdpPerCapita !== undefined && (
                      <IncomeWealthDistribution
                        incomeData={economicData.income}
                        onIncomeDataChangeAction={(newData: IncomeWealthDistributionData) =>
                          handleDataChange("income", newData)
                        }
                        totalPopulation={economicData.core.totalPopulation}
                        gdpPerCapita={economicData.core.gdpPerCapita}
                        isReadOnly={!isEditMode}
                        showComparison={false}
                      />
                    )}
                  {section.id === "spending" &&
                    economicData.spending &&
                    economicData.core?.nominalGDP !== undefined &&
                    economicData.core?.totalPopulation !== undefined && (
                      <GovernmentSpending
                        {...economicData.spending}
                        nominalGDP={economicData.core.nominalGDP}
                        totalPopulation={economicData.core.totalPopulation}
                        onSpendingDataChangeAction={(data) => {
                          if (isEditMode) {
                            handleDataChange("spending", data);
                          }
                        }}
                        isReadOnly={!isEditMode}
                      />
                    )}
                  {section.id === "demographics" &&
                    economicData.demographics &&
                    economicData.core?.totalPopulation !== undefined && (
                      <Demographics
                        demographicData={economicData.demographics}
                        onDemographicDataChangeAction={(newData: DemographicsData) =>
                          handleDataChange("demographics", newData)
                        }
                        totalPopulation={economicData.core.totalPopulation}
                        isReadOnly={!isEditMode}
                        showComparison={false}
                      />
                    )}
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </GlassCard>
    );
  }

  // Fallback for compact mode or if data isn't loaded after checks
  return (
    <GlassCard variant="glass">
      <CardHeader>
        <CardTitle>Economic Data</CardTitle>
        <CardDescription>Detailed economic data for {countryName}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 text-center">
        <Info className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
        <p className="text-muted-foreground text-sm">
          {isLoading
            ? "Loading data..."
            : "Economic data display mode not configured or data is unavailable."}
        </p>
      </CardContent>
    </GlassCard>
  );
}
