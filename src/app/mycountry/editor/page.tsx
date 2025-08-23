"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { createUrl } from "~/lib/url-utils";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { 
  Crown, 
  Edit, 
  Save, 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle,
  TrendingUp,
  Briefcase,
  Building,
  Scale,
  Users,
  BarChart3,
  Eye,
  ArrowLeft
} from "lucide-react";
import Link from "next/link";

// Import repurposed builder components for editing
import { CoreEconomicIndicatorsComponent } from "~/app/builder/components/CoreEconomicIndicators";
import { LaborEmploymentSection as LaborEmploymentComponent } from "~/app/builder/sections/LaborEmploymentSection";
import { FiscalSystemSection as FiscalSystemComponent } from "~/app/builder/sections/FiscalSystemSection";
import { GovernmentSpending } from "~/app/builder/components/GovernmentSpending";
import { DemographicsSection as Demographics } from "~/app/builder/sections/DemographicsSection";
import type { EconomicInputs } from "~/app/builder/lib/economy-data-service";
import { createDefaultEconomicInputs } from "~/app/builder/lib/economy-data-service";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export default function MyCountryEditor() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState("core");
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [economicInputs, setEconomicInputs] = useState<EconomicInputs | null>(null);

  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  const { data: country, isLoading: countryLoading, refetch: refetchCountry } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  const updateCountryMutation = api.countries.updateEconomicData.useMutation();

  // Initialize economic inputs when country data loads
  useEffect(() => {
    if (country && !economicInputs) {
      const inputs = createDefaultEconomicInputs();
      
      // Populate with existing country data
      inputs.countryName = country.name;
      inputs.coreIndicators = {
        totalPopulation: (country as any).currentPopulation || country.baselinePopulation || 0,
        gdpPerCapita: (country as any).currentGdpPerCapita || country.baselineGdpPerCapita || 0,
        nominalGDP: (country as any).currentTotalGdp || ((country as any).currentPopulation * (country as any).currentGdpPerCapita) || 0,
        realGDPGrowthRate: (country as any).realGDPGrowthRate || 3.0,
        inflationRate: (country as any).inflationRate || 2.0,
        currencyExchangeRate: 1.0,
      };
      
      if ((country as any).unemploymentRate !== undefined) {
        inputs.laborEmployment.unemploymentRate = (country as any).unemploymentRate;
      }
      
      setEconomicInputs(inputs);
    }
  }, [country, economicInputs]);

  // Authentication and permission checks
  if (!isLoaded || profileLoading) {
    return <LoadingState />;
  }

  if (!user) {
    return <UnauthorizedState />;
  }

  if (!userProfile?.countryId) {
    return <NoCountryState />;
  }

  if (countryLoading || !country) {
    return <LoadingState />;
  }

  if (!economicInputs || !economicInputs.coreIndicators || !economicInputs.laborEmployment || !economicInputs.fiscalSystem || !economicInputs.governmentSpending || !economicInputs.demographics) {
    return <LoadingState />;
  }

  const handleInputsChange = (newInputs: EconomicInputs) => {
    // Ensure all required objects exist
    if (!newInputs || !newInputs.coreIndicators || !newInputs.laborEmployment || !newInputs.fiscalSystem || !newInputs.governmentSpending || !newInputs.demographics) {
      console.error('Invalid economicInputs structure:', newInputs);
      return;
    }
    setEconomicInputs(newInputs);
    setHasChanges(true);
    validateInputs(newInputs);
  };

  const validateInputs = (inputs: EconomicInputs) => {
    const newErrors: ValidationError[] = [];
    
    // Basic validation
    if (!inputs.countryName.trim()) {
      newErrors.push({ field: 'countryName', message: 'Country name is required', severity: 'error' });
    }
    if (inputs.coreIndicators.totalPopulation <= 0) {
      newErrors.push({ field: 'totalPopulation', message: 'Population must be greater than 0', severity: 'error' });
    }
    if (inputs.coreIndicators.gdpPerCapita <= 0) {
      newErrors.push({ field: 'gdpPerCapita', message: 'GDP per capita must be greater than 0', severity: 'error' });
    }
    
    // Warning validations
    if (inputs.coreIndicators.realGDPGrowthRate < -10 || inputs.coreIndicators.realGDPGrowthRate > 15) {
      newErrors.push({ field: 'realGDPGrowthRate', message: 'GDP growth rate seems unrealistic', severity: 'warning' });
    }
    
    setErrors(newErrors);
  };

  const handleSave = async () => {
    if (errors.some(e => e.severity === 'error') || !economicInputs) {
      return;
    }

    setIsSaving(true);
    try {
      // Map EconomicInputs to the expected schema format
      const economicData = {
        // Core Economic Indicators
        nominalGDP: economicInputs.coreIndicators.nominalGDP,
        realGDPGrowthRate: economicInputs.coreIndicators.realGDPGrowthRate,
        inflationRate: economicInputs.coreIndicators.inflationRate,
        currencyExchangeRate: 1.0, // Default

        // Labor & Employment
        laborForceParticipationRate: economicInputs.laborEmployment.laborForceParticipationRate,
        employmentRate: 100 - economicInputs.laborEmployment.unemploymentRate,
        unemploymentRate: economicInputs.laborEmployment.unemploymentRate,
        totalWorkforce: Math.round(economicInputs.coreIndicators.totalPopulation * (economicInputs.laborEmployment.laborForceParticipationRate / 100)),
        averageWorkweekHours: economicInputs.laborEmployment.averageWorkweekHours,
        minimumWage: economicInputs.laborEmployment.minimumWage,
        averageAnnualIncome: (economicInputs.laborEmployment.minimumWage || 15) * (economicInputs.laborEmployment.averageWorkweekHours || 40) * 52,

        // Fiscal System
        taxRevenueGDPPercent: economicInputs.fiscalSystem.taxRevenueGDPPercent,
        governmentRevenueTotal: economicInputs.fiscalSystem.governmentRevenueTotal,
        taxRevenuePerCapita: economicInputs.fiscalSystem.governmentRevenueTotal / economicInputs.coreIndicators.totalPopulation,
        governmentBudgetGDPPercent: economicInputs.fiscalSystem.governmentBudgetGDPPercent,
        budgetDeficitSurplus: economicInputs.fiscalSystem.budgetDeficitSurplus,
        internalDebtGDPPercent: economicInputs.fiscalSystem.internalDebtGDPPercent,
        externalDebtGDPPercent: economicInputs.fiscalSystem.externalDebtGDPPercent,
        totalDebtGDPRatio: economicInputs.fiscalSystem.totalDebtGDPRatio,
        debtPerCapita: (economicInputs.fiscalSystem.totalDebtGDPRatio / 100) * economicInputs.coreIndicators.nominalGDP / economicInputs.coreIndicators.totalPopulation,
        interestRates: economicInputs.fiscalSystem.interestRates,
        debtServiceCosts: economicInputs.fiscalSystem.debtServiceCosts,

        // Income & Wealth
        povertyRate: economicInputs.incomeWealth.povertyRate,
        incomeInequalityGini: economicInputs.incomeWealth.incomeInequalityGini,
        socialMobilityIndex: economicInputs.incomeWealth.socialMobilityIndex,

        // Government Spending
        totalGovernmentSpending: economicInputs.governmentSpending.totalSpending,
        spendingGDPPercent: (economicInputs.governmentSpending.totalSpending / economicInputs.coreIndicators.nominalGDP) * 100,
        spendingPerCapita: economicInputs.governmentSpending.totalSpending / economicInputs.coreIndicators.totalPopulation,

        // Demographics
        lifeExpectancy: economicInputs.demographics.lifeExpectancy,
        urbanPopulationPercent: economicInputs.demographics.urbanRuralSplit?.urban || 50,
        ruralPopulationPercent: economicInputs.demographics.urbanRuralSplit?.rural || 50,
        literacyRate: economicInputs.demographics.literacyRate,
      };

      await updateCountryMutation.mutateAsync({
        countryId: country.id,
        economicData
      });
      
      setHasChanges(false);
      await refetchCountry();
    } catch (error) {
      console.error('Failed to save country data:', error);
      // Show error to user - you might want to add proper error handling UI
      alert('Failed to save country data. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (country) {
      const inputs = createDefaultEconomicInputs();
      inputs.countryName = country.name;
      // Reset to original values
      setEconomicInputs(inputs);
      setHasChanges(false);
      setErrors([]);
    }
  };

  const errorCount = errors.filter(e => e.severity === 'error').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href={createUrl("/mycountry")}>MyCountry</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Data Editor</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Crown className="h-8 w-8 text-yellow-500" />
          <div>
            <h1 className="text-3xl font-bold">Country Data Editor</h1>
            <p className="text-muted-foreground">Edit and manage {country.name}'s economic data</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href={createUrl(`/countries/${country.id}`)}>
            <Button variant="outline" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Public View
            </Button>
          </Link>
          <Link href={createUrl("/mycountry")}>
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Status Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant="outline">{(country as any).economicTier || 'Unknown'}</Badge>
              <Badge variant="outline">Tier {(country as any).populationTier || 'Unknown'}</Badge>
              {hasChanges && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Edit className="h-3 w-3" />
                  Unsaved Changes
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {errorCount > 0 && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {errorCount} Error{errorCount !== 1 ? 's' : ''}
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {warningCount} Warning{warningCount !== 1 ? 's' : ''}
                </Badge>
              )}
              {!hasChanges && errorCount === 0 && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  All Good
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {errors.length > 0 && (
        <Alert variant={errors.some(e => e.severity === 'error') ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {errors.slice(0, 3).map((error, index) => (
                <div key={index}>
                  <strong>{error.field}:</strong> {error.message}
                </div>
              ))}
              {errors.length > 3 && (
                <div className="text-sm text-muted-foreground">
                  ...and {errors.length - 3} more issue{errors.length - 3 !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Editor Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="core" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            Core Economy
          </TabsTrigger>
          <TabsTrigger value="labor" className="flex items-center gap-1">
            <Briefcase className="h-4 w-4" />
            Labor & Employment
          </TabsTrigger>
          <TabsTrigger value="fiscal" className="flex items-center gap-1">
            <Scale className="h-4 w-4" />
            Fiscal System
          </TabsTrigger>
          <TabsTrigger value="government" className="flex items-center gap-1">
            <Building className="h-4 w-4" />
            Government
          </TabsTrigger>
          <TabsTrigger value="demographics" className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            Demographics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="core" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="labor" className="space-y-6">
          <LaborEmploymentComponent
            inputs={economicInputs}
            onInputsChange={(newInputs: any) => {
              handleInputsChange(newInputs);
            }}
            showAdvanced={false}
          />
        </TabsContent>

        <TabsContent value="fiscal" className="space-y-6">
          <FiscalSystemComponent
            inputs={economicInputs}
            onInputsChange={(newInputs: any) => {
              handleInputsChange(newInputs);
            }}
            showAdvanced={false}
            referenceCountry={{
              name: "Reference",
              countryCode: "REF",
              gdp: economicInputs.coreIndicators.nominalGDP,  
              gdpPerCapita: economicInputs.coreIndicators.gdpPerCapita,
              taxRevenuePercent: economicInputs.fiscalSystem.taxRevenueGDPPercent,
              unemploymentRate: economicInputs.laborEmployment.unemploymentRate,
              population: economicInputs.coreIndicators.totalPopulation
            }}
            nominalGDP={economicInputs.coreIndicators.nominalGDP}
            totalPopulation={economicInputs.coreIndicators.totalPopulation}
          />
        </TabsContent>

        <TabsContent value="government" className="space-y-6">
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
            isReadOnly={false}
          />
        </TabsContent>

        <TabsContent value="demographics" className="space-y-6">
          <Demographics
            inputs={economicInputs}
            onInputsChange={(newInputs: any) => {
              handleInputsChange(newInputs);
            }}
            showAdvanced={false}
            totalPopulation={economicInputs.coreIndicators.totalPopulation}
          />
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                onClick={handleReset}
                variant="outline"
                disabled={!hasChanges}
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset Changes
              </Button>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={!hasChanges || errorCount > 0 || isSaving}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full" />
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

function UnauthorizedState() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <CardTitle className="text-2xl font-bold">Access Denied</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-6">
            You need to be signed in to access the country data editor.
          </p>
          <Link href={createUrl("/mycountry")}>
            <Button>Go to MyCountry</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function NoCountryState() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <Crown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <CardTitle className="text-2xl font-bold">No Country Assigned</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-6">
            You don't have a country assigned to your account. You need to own a country to use the data editor.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href={createUrl("/countries")}>
              <Button variant="outline">Browse Countries</Button>
            </Link>
            <Link href={createUrl("/mycountry")}>
              <Button>Go to MyCountry</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}