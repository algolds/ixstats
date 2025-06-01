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
import { CoreEconomicIndicatorsComponent } from "~/app/economy/components/CoreEconomicIndicators";
import { LaborEmploymentComponent } from "~/app/economy/components/LaborEmployment";
import { FiscalSystemComponent } from "~/app/economy/components/FiscalSystem";
import { IncomeWealthDistribution } from "~/app/economy/components/IncomeWealthDistribution";
import { GovernmentSpending } from "~/app/economy/components/GovernmentSpending";
import { Demographics } from "~/app/economy/components/Demographics";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { Skeleton } from "~/components/ui/skeleton";
import type { TRPCClientError } from "@trpc/client";
import type { EconomyData, CoreEconomicIndicatorsData, LaborEmploymentData, FiscalSystemData, IncomeWealthDistributionData, GovernmentSpendingData, DemographicsData } from "~/types/economics";

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
    }
  }, [countryData?.economy]);

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
      if (!prev) return null; // Should not happen if data is loaded
      const updatedData = {
        ...prev,
        [section]: {
           ...(prev[section] as any),
           ...newData
        } as any
      };
      return updatedData;
    });
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    if (!economicData) return; // Cannot save if data is not loaded
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
      component: CoreEconomicIndicatorsComponent,
      disabled: false,
    },
    {
      id: "labor",
      label: "Labor & Employment",
      icon: Briefcase,
      description: "Workforce, unemployment, wages",
      component: LaborEmploymentComponent,
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

            {economicSections.map((section) => {
              const SectionComponent = section.component;
              if (!SectionComponent || section.disabled) return null; // Skip if no component or disabled

              return (
                <TabsContent key={section.id} value={section.id} className="mt-0">
                  {section.id === 'core' && economicData.core && (
                    <SectionComponent 
                      indicators={economicData.core} 
                      onIndicatorsChange={newData => handleDataChange('core', newData)} 
                      isReadOnly={!isEditMode}
                      showComparison={false}
                    />
                  )}
                  {section.id === 'labor' && economicData.labor && economicData.core?.totalPopulation !== undefined && (
                    <SectionComponent 
                      laborData={economicData.labor} 
                      onLaborDataChange={newData => handleDataChange('labor', newData)} 
                      totalPopulation={economicData.core.totalPopulation} 
                      isReadOnly={!isEditMode}
                      showComparison={false}
                    />
                  )}
                  {section.id === 'fiscal' && economicData.fiscal && economicData.core?.nominalGDP !== undefined && economicData.core?.totalPopulation !== undefined && (
                    <SectionComponent 
                      fiscalData={economicData.fiscal} 
                      onFiscalDataChange={newData => handleDataChange('fiscal', newData)} 
                      nominalGDP={economicData.core.nominalGDP}
                      totalPopulation={economicData.core.totalPopulation}
                      isReadOnly={!isEditMode}
                    />
                  )}
                  {section.id === 'income' && economicData.income && economicData.core?.totalPopulation !== undefined && economicData.core?.gdpPerCapita !== undefined && (
                    <SectionComponent 
                      incomeData={economicData.income} 
                      onIncomeDataChange={newData => handleDataChange('income', newData)} 
                      totalPopulation={economicData.core.totalPopulation}
                      gdpPerCapita={economicData.core.gdpPerCapita}
                      isReadOnly={!isEditMode}
                    />
                  )}
                  {section.id === 'spending' && economicData.spending && economicData.core?.nominalGDP !== undefined && economicData.core?.totalPopulation !== undefined && (
                    <SectionComponent 
                      spendingData={economicData.spending} 
                      onSpendingDataChange={newData => handleDataChange('spending', newData)} 
                      nominalGDP={economicData.core.nominalGDP}
                      totalPopulation={economicData.core.totalPopulation}
                      isReadOnly={!isEditMode}
                    />
                  )}
                  {section.id === 'demographics' && economicData.demographics && economicData.core?.totalPopulation !== undefined && (
                    <SectionComponent 
                      demographicData={{
                        ...economicData.demographics,
                        ageDistribution: economicData.demographics.ageDistribution.map(group => ({
                          ...group,
                          color: group.color || '#000000' // Provide default color if undefined
                        }))
                      }}
                      onDemographicDataChange={newData => handleDataChange('demographics', newData)} 
                      totalPopulation={economicData.core.totalPopulation}
                      isReadOnly={!isEditMode}
                    />
                  )}
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    );
  }

  // Default fallback (e.g., if mode is not 'full' or 'overview', or data is unexpectedly null after loading)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Economic Data</CardTitle>
        <CardDescription>Detailed economic data for {countryName}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 text-center">
        <Info className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Economic data display mode not configured or data is unavailable.</p>
      </CardContent>
    </Card>
  );
}