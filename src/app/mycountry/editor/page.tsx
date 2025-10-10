"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import {
  Flag,
  BarChart3,
  Building2,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Save,
  Calendar,
  Settings2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "~/components/ui/breadcrumb";
import { createUrl } from "~/lib/url-utils";

// Builder sections - exact same as builder
import {
  NationalIdentitySection,
  CoreIndicatorsSection,
  DemographicsSection,
} from "~/app/builder/sections";
import { GovernmentSpendingSectionEnhanced } from "~/app/builder/sections/GovernmentSpendingSectionEnhanced";
import { GovernmentBuilder } from "~/components/government";

// Enhanced editor sections
import { LaborEmploymentSectionEnhanced } from "./sections/LaborEmploymentSectionEnhanced";
import { FiscalSystemSectionEnhanced } from "./sections/FiscalSystemSectionEnhanced";
import { GeographySection } from "./sections/GeographySection";

// Editor components
import { LoadingState } from "./components/LoadingState";
import { UnauthorizedState } from "./components/UnauthorizedState";
import { NoCountryState } from "./components/NoCountryState";
import { ScheduledChangesPanel } from "./components/ScheduledChangesPanel";
import { ChangePreviewDialog } from "./components/ChangePreviewDialog";

// Hooks
import { useCountryEditorData } from "./hooks/useCountryEditorData";
import { useChangeTracking, getFieldMetadata } from "./hooks/useChangeTracking";
import { calculateScheduledDate } from "~/lib/change-impact-calculator";

// API
import { api } from "~/trpc/react";
import type { Country } from "@prisma/client";
import { cn } from "~/lib/utils";

export const dynamic = "force-dynamic";

type EditorStep = 'identity' | 'core' | 'government' | 'economics' | 'preview';

const stepConfig = {
  identity: {
    title: 'National Identity',
    description: 'Country details',
    icon: Flag,
    color: 'from-amber-500 to-yellow-600',
  },
  core: {
    title: 'Core Indicators',
    description: 'Economic metrics',
    icon: BarChart3,
    color: 'from-blue-500 to-indigo-600',
  },
  government: {
    title: 'Government',
    description: 'Structure & spending',
    icon: Building2,
    color: 'from-purple-500 to-violet-600',
  },
  economics: {
    title: 'Economics',
    description: 'Labor & fiscal',
    icon: TrendingUp,
    color: 'from-green-500 to-emerald-600',
  },
  preview: {
    title: 'Review',
    description: 'Save changes',
    icon: CheckCircle,
    color: 'from-green-500 to-green-600',
  },
};

export default function MyCountryEditor() {
  const { user, isLoaded } = useUser();
  const {
    economicInputs,
    setEconomicInputs,
    originalInputs,
    governmentData,
    setGovernmentData,
    showAdvanced,
    setShowAdvanced,
    userProfile,
    profileLoading,
    country,
    countryLoading,
    refetchCountry,
    existingGovernment,
    governmentLoading,
    handleGovernmentSave,
  } = useCountryEditorData();

  const [currentStep, setCurrentStep] = useState<EditorStep>('identity');
  const [activeTab, setActiveTab] = useState<string>('national-identity');
  const changeTracking = useChangeTracking(country || {});
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const utils = api.useUtils();
  const updateCountryMutation = api.countries.update.useMutation();
  const updateNationalIdentityMutation = api.countries.updateNationalIdentity.useMutation();
  const createScheduledChangeMutation = api.scheduledChanges.createScheduledChange.useMutation();
  const updateGovernmentMutation = api.government.update.useMutation();
  const createGovernmentMutation = api.government.create.useMutation();

  const [hasGovernmentChanges, setHasGovernmentChanges] = useState(false);
  const [pendingGovernmentData, setPendingGovernmentData] = useState<any>(null);

  function handleCountryFieldChange(field: keyof Country, value: unknown) {
    const metadata = getFieldMetadata(field);
    changeTracking.trackChange(field, value, metadata.label, metadata.category);
  }

  function handleEconomicInputsChange(newInputs: typeof economicInputs) {
    setEconomicInputs(newInputs);

    // Track changes in economic inputs as Country field changes
    if (originalInputs && newInputs && newInputs.nationalIdentity && originalInputs.nationalIdentity) {
      console.log('Tracking changes - Original:', originalInputs.nationalIdentity);
      console.log('Tracking changes - New:', newInputs.nationalIdentity);

      // National Identity changes
      if (newInputs.nationalIdentity.countryName !== originalInputs.nationalIdentity.countryName) {
        console.log('Country name changed:', originalInputs.nationalIdentity.countryName, '->', newInputs.nationalIdentity.countryName);
        changeTracking.trackChange('name' as keyof Country, newInputs.nationalIdentity.countryName, 'Country Name', 'National Identity');
      }
      if (newInputs.nationalIdentity.officialName !== originalInputs.nationalIdentity.officialName) {
        changeTracking.trackChange('officialName' as keyof Country, newInputs.nationalIdentity.officialName, 'Official Name', 'National Identity');
      }
      if (newInputs.nationalIdentity.motto !== originalInputs.nationalIdentity.motto) {
        changeTracking.trackChange('motto' as keyof Country, newInputs.nationalIdentity.motto, 'National Motto', 'National Identity');
      }
      if (newInputs.nationalIdentity.nationalAnthem !== originalInputs.nationalIdentity.nationalAnthem) {
        changeTracking.trackChange('nationalAnthem' as keyof Country, newInputs.nationalIdentity.nationalAnthem, 'National Anthem', 'National Identity');
      }
      if (newInputs.nationalIdentity.capitalCity !== originalInputs.nationalIdentity.capitalCity) {
        changeTracking.trackChange('capitalCity' as keyof Country, newInputs.nationalIdentity.capitalCity, 'Capital City', 'National Identity');
      }
      if (newInputs.nationalIdentity.officialLanguages !== originalInputs.nationalIdentity.officialLanguages) {
        changeTracking.trackChange('officialLanguages' as keyof Country, newInputs.nationalIdentity.officialLanguages, 'Official Languages', 'National Identity');
      }
      if (newInputs.nationalIdentity.currency !== originalInputs.nationalIdentity.currency) {
        changeTracking.trackChange('currencyName' as keyof Country, newInputs.nationalIdentity.currency, 'Currency Name', 'National Identity');
      }
      if (newInputs.nationalIdentity.currencySymbol !== originalInputs.nationalIdentity.currencySymbol) {
        changeTracking.trackChange('currencySymbol' as keyof Country, newInputs.nationalIdentity.currencySymbol, 'Currency Symbol', 'National Identity');
      }
      if (newInputs.nationalIdentity.governmentType !== originalInputs.nationalIdentity.governmentType) {
        changeTracking.trackChange('governmentType' as keyof Country, newInputs.nationalIdentity.governmentType, 'Government Type', 'National Identity');
      }
      if (newInputs.nationalIdentity.demonym !== originalInputs.nationalIdentity.demonym) {
        changeTracking.trackChange('demonym' as keyof Country, newInputs.nationalIdentity.demonym, 'Demonym', 'National Identity');
      }
      if (newInputs.nationalIdentity.nationalReligion !== originalInputs.nationalIdentity.nationalReligion) {
        changeTracking.trackChange('religion' as keyof Country, newInputs.nationalIdentity.nationalReligion, 'National Religion', 'National Identity');
      }
    }

    // Core Indicators changes
    if (originalInputs && newInputs && newInputs.coreIndicators && originalInputs.coreIndicators) {
      if (newInputs.coreIndicators.totalPopulation !== originalInputs.coreIndicators.totalPopulation) {
        changeTracking.trackChange('totalPopulation' as keyof Country, newInputs.coreIndicators.totalPopulation, 'Total Population', 'Core Indicators');
      }
      if (newInputs.coreIndicators.nominalGDP !== originalInputs.coreIndicators.nominalGDP) {
        changeTracking.trackChange('nominalGDP' as keyof Country, newInputs.coreIndicators.nominalGDP, 'Nominal GDP', 'Core Indicators');
      }
      if (newInputs.coreIndicators.gdpPerCapita !== originalInputs.coreIndicators.gdpPerCapita) {
        changeTracking.trackChange('gdpPerCapita' as keyof Country, newInputs.coreIndicators.gdpPerCapita, 'GDP per Capita', 'Core Indicators');
      }
    }
  }

  async function handleSaveWithPreview() {
    // Check if there are ANY changes (country fields or government)
    const hasAnyChanges = changeTracking.changes.length > 0 || hasGovernmentChanges;

    if (!hasAnyChanges) {
      alert("No changes to save");
      return;
    }
    setShowPreviewDialog(true);
  }

  async function handleConfirmChanges() {
    if (!country?.id || !user) return;

    setIsSaving(true);
    setShowPreviewDialog(false);

    try {
      const instantChanges = changeTracking.changes.filter(c => c.impact?.changeType === "instant");
      const delayedChanges = changeTracking.changes.filter(c => c.impact?.changeType !== "instant");

      console.log('Saving changes:', {
        total: changeTracking.changes.length,
        instant: instantChanges.length,
        delayed: delayedChanges.length,
        changes: changeTracking.changes
      });

      // Save instant country field changes
      if (instantChanges.length > 0) {
        // Separate national identity fields from country fields
        const nationalIdentityFields = new Set(['officialName', 'motto', 'nationalAnthem', 'capitalCity', 'officialLanguages', 'currencyName', 'currencySymbol', 'demonym', 'governmentType']);

        const countryUpdates: Record<string, unknown> = {};
        const nationalIdentityUpdates: Record<string, unknown> = { countryId: country.id };

        instantChanges.forEach((change) => {
          if (nationalIdentityFields.has(change.fieldPath)) {
            // Map field names
            const fieldName = change.fieldPath === 'currencyName' ? 'currency' : change.fieldPath;
            nationalIdentityUpdates[fieldName] = change.newValue;
          } else {
            countryUpdates[change.fieldPath] = change.newValue;
          }
        });

        console.log('Country updates:', countryUpdates);
        console.log('National identity updates:', nationalIdentityUpdates);

        // Update country fields if any
        if (Object.keys(countryUpdates).length > 0) {
          await updateCountryMutation.mutateAsync({ id: country.id, ...countryUpdates });
        }

        // Update national identity fields if any
        if (Object.keys(nationalIdentityUpdates).length > 1) { // More than just countryId
          await updateNationalIdentityMutation.mutateAsync(nationalIdentityUpdates as any);
        }
      }

      // Schedule delayed changes
      for (const change of delayedChanges) {
        const scheduledFor = calculateScheduledDate(change.impact!.changeType, new Date());
        await createScheduledChangeMutation.mutateAsync({
          countryId: country.id,
          changeType: change.impact!.changeType,
          impactLevel: change.impact!.impactLevel,
          fieldPath: change.fieldPath,
          oldValue: JSON.stringify(change.oldValue),
          newValue: JSON.stringify(change.newValue),
          scheduledFor,
          warnings: change.impact!.warnings,
          metadata: { fieldLabel: change.fieldLabel, category: change.category },
        });
      }

      // Save government structure if changed
      if (hasGovernmentChanges && pendingGovernmentData) {
        if (existingGovernment) {
          await updateGovernmentMutation.mutateAsync({
            countryId: country.id,
            data: pendingGovernmentData
          });
        } else {
          await createGovernmentMutation.mutateAsync({
            countryId: country.id,
            data: pendingGovernmentData
          });
        }
        setHasGovernmentChanges(false);
        setPendingGovernmentData(null);
      }

      changeTracking.clearChanges();
      await refetchCountry();

      // Invalidate all country-related queries to ensure fresh data everywhere
      await utils.countries.invalidate();
      await utils.government.invalidate();
      await utils.taxSystem.invalidate();

      const totalChanges = instantChanges.length + delayedChanges.length + (hasGovernmentChanges ? 1 : 0);
      alert(`Success! ${totalChanges} change${totalChanges !== 1 ? 's' : ''} saved (${instantChanges.length} instant, ${delayedChanges.length} scheduled).`);
    } catch (error) {
      console.error("Save failed:", error);
      alert("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isLoaded || profileLoading) return <LoadingState />;
  if (!user) return <UnauthorizedState />;
  if (!userProfile?.countryId) return <NoCountryState />;
  if (countryLoading || !country || !economicInputs) return <LoadingState />;

  const summary = changeTracking.getSummary();
  const steps = Object.entries(stepConfig) as [EditorStep, typeof stepConfig[EditorStep]][];
  const currentStepIndex = steps.findIndex(([step]) => step === currentStep);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/30 via-background to-background dark:from-amber-950/10">
      <div className="container mx-auto px-4 py-8 space-y-6">

        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href={createUrl("/mycountry")}>MyCountry</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Editor</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <Card className="glass-hierarchy-parent border-amber-200 dark:border-amber-800">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex-1">
                <CardTitle className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  MyCountry Editor: {country.name}
                </CardTitle>
                <CardDescription>Configure your country's settings</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {changeTracking.hasChanges && (
                  <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                    {summary.total} Change{summary.total !== 1 ? 's' : ''}
                  </Badge>
                )}
                <Button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  variant="outline"
                  size="default"
                >
                  <Settings2 className="h-4 w-4 mr-2" />
                  {showAdvanced ? 'Simple' : 'Advanced'}
                </Button>
                <Button
                  onClick={handleSaveWithPreview}
                  disabled={!changeTracking.hasChanges || isSaving}
                  size="default"
                  className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Step Indicator */}
        <div className="flex justify-between items-center mb-8">
          {steps.map(([step, config], index) => {
            const Icon = config.icon;
            const isCurrent = currentStep === step;
            const isPast = index < currentStepIndex;

            return (
              <div key={step} className="flex items-center flex-1">
                <button
                  onClick={() => setCurrentStep(step)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-lg transition-all",
                    isCurrent && "bg-amber-100 dark:bg-amber-900/20",
                    "hover:bg-muted"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all",
                    isCurrent && `bg-gradient-to-r ${config.color} text-white border-transparent`,
                    isPast && "bg-green-100 border-green-500 text-green-600",
                    !isCurrent && !isPast && "border-muted-foreground/30 text-muted-foreground"
                  )}>
                    {isPast ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <div className="text-center">
                    <div className={cn(
                      "text-xs font-semibold",
                      isCurrent && "text-amber-600",
                      isPast && "text-green-600"
                    )}>
                      {config.title}
                    </div>
                    <div className="text-xs text-muted-foreground hidden sm:block">
                      {config.description}
                    </div>
                  </div>
                </button>
                {index < steps.length - 1 && (
                  <div className="flex-1 h-0.5 bg-muted mx-2" />
                )}
              </div>
            );
          })}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">

            {/* Identity Step */}
            {currentStep === 'identity' && (
              <Card>
                <CardHeader>
                  <CardTitle>National Identity</CardTitle>
                  <CardDescription>Configure your nation's identity and symbols</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="national-identity">National Identity</TabsTrigger>
                      <TabsTrigger value="geography">Geography</TabsTrigger>
                    </TabsList>
                    <TabsContent value="national-identity">
                      <NationalIdentitySection
                        inputs={economicInputs}
                        onInputsChange={handleEconomicInputsChange}
                      />
                    </TabsContent>
                    <TabsContent value="geography">
                      <GeographySection
                        inputs={economicInputs}
                        onInputsChange={handleEconomicInputsChange}
                        countryId={country.id}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {/* Core Step */}
            {currentStep === 'core' && (
              <Card>
                <CardHeader>
                  <CardTitle>Core Economic Indicators</CardTitle>
                  <CardDescription>Base economic metrics and demographics</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="core-indicators">Core Indicators</TabsTrigger>
                      <TabsTrigger value="demographics">Demographics</TabsTrigger>
                    </TabsList>
                    <TabsContent value="core-indicators">
                      <CoreIndicatorsSection
                        inputs={economicInputs}
                        onInputsChange={handleEconomicInputsChange}
                      />
                    </TabsContent>
                    <TabsContent value="demographics">
                      <DemographicsSection
                        inputs={economicInputs}
                        onInputsChange={handleEconomicInputsChange}
                        showAdvanced={showAdvanced}
                        isReadOnly={false}
                        showComparison={false}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {/* Government Step */}
            {currentStep === 'government' && (
              <Card>
                <CardHeader>
                  <CardTitle>Government Structure</CardTitle>
                  <CardDescription>Departments and budget allocation</CardDescription>
                </CardHeader>
                <CardContent>
                  {governmentData ? (
                    <GovernmentBuilder
                      initialData={governmentData}
                      onChange={(data) => {
                        setGovernmentData(data);
                        setPendingGovernmentData(data);
                        setHasGovernmentChanges(true);
                      }}
                      hideSaveButton={true}
                      isReadOnly={false}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No government structure configured</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Economics Step */}
            {currentStep === 'economics' && (
              <Card>
                <CardHeader>
                  <CardTitle>Economic Systems</CardTitle>
                  <CardDescription>Labor, fiscal policy, and spending</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="labor">Labor</TabsTrigger>
                      <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
                      <TabsTrigger value="spending">Spending</TabsTrigger>
                    </TabsList>
                    <TabsContent value="labor">
                      <LaborEmploymentSectionEnhanced
                        inputs={economicInputs}
                        onInputsChange={handleEconomicInputsChange}
                        showAdvanced={showAdvanced}
                      />
                    </TabsContent>
                    <TabsContent value="fiscal">
                      {country?.id && (
                        <FiscalSystemSectionEnhanced
                          inputs={economicInputs}
                          onInputsChange={handleEconomicInputsChange}
                          showAdvanced={showAdvanced}
                          countryId={country.id}
                          onTaxSystemChange={(taxData) => {
                            // Tax data is tracked but saved via TaxBuilder's internal mutation
                            console.log('Tax system changed:', taxData);
                          }}
                          onTaxSystemSave={(taxData) => {
                            console.log('Tax system saved:', taxData);
                            // Tax data is saved via TaxBuilder's internal mutation
                          }}
                        />
                      )}
                    </TabsContent>
                    <TabsContent value="spending">
                      <GovernmentSpendingSectionEnhanced
                        inputs={economicInputs}
                        onInputsChange={handleEconomicInputsChange}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {/* Preview Step */}
            {currentStep === 'preview' && (
              <Card>
                <CardHeader>
                  <CardTitle>Review Changes</CardTitle>
                  <CardDescription>Review and save your changes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {changeTracking.hasChanges ? (
                    <>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-semibold text-lg mb-3">Summary</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-3 border rounded-lg">
                              <div className="text-2xl font-bold">{summary.instant}</div>
                              <div className="text-sm text-muted-foreground">Instant</div>
                            </div>
                            <div className="p-3 border rounded-lg">
                              <div className="text-2xl font-bold">{summary.nextDay}</div>
                              <div className="text-sm text-muted-foreground">Next Day</div>
                            </div>
                            <div className="p-3 border rounded-lg">
                              <div className="text-2xl font-bold">{summary.shortTerm}</div>
                              <div className="text-sm text-muted-foreground">Short-term</div>
                            </div>
                            <div className="p-3 border rounded-lg">
                              <div className="text-2xl font-bold text-red-600">{summary.longTerm}</div>
                              <div className="text-sm text-muted-foreground">Long-term</div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold text-lg mb-3">Changes ({changeTracking.changes.length})</h4>
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {changeTracking.changes.map((change, idx) => (
                              <div key={idx} className="p-3 border rounded-lg bg-muted/30">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="font-medium">{change.fieldLabel}</div>
                                    <div className="text-sm text-muted-foreground">{change.category}</div>
                                    <div className="mt-2 text-sm">
                                      <span className="text-red-600 line-through">{String(change.oldValue)}</span>
                                      {' → '}
                                      <span className="text-green-600 font-medium">{String(change.newValue)}</span>
                                    </div>
                                  </div>
                                  <Badge variant={change.impact?.changeType === 'instant' ? 'default' : 'secondary'}>
                                    {change.impact?.changeType || 'pending'}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={handleSaveWithPreview}
                        size="lg"
                        className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700"
                        disabled={isSaving}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save All Changes
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No changes to save</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  const prevIndex = Math.max(0, currentStepIndex - 1);
                  setCurrentStep(steps[prevIndex][0]);
                }}
                disabled={currentStepIndex === 0}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <Button
                onClick={() => {
                  const nextIndex = Math.min(steps.length - 1, currentStepIndex + 1);
                  setCurrentStep(steps[nextIndex][0]);
                }}
                disabled={currentStepIndex === steps.length - 1}
                className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <ScheduledChangesPanel countryId={country.id} />
          </div>
        </div>
      </div>

      <ChangePreviewDialog
        open={showPreviewDialog}
        onOpenChange={setShowPreviewDialog}
        changes={changeTracking.changes}
        onConfirm={handleConfirmChanges}
        onCancel={() => setShowPreviewDialog(false)}
        isLoading={isSaving}
      />
    </div>
  );
}
