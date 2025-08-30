"use client";

import { useCountryEditorData } from "./hooks/useCountryEditorData";

import { createUrl } from "~/lib/url-utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { motion } from "framer-motion";

// Imported extracted components
import { LoadingState } from "./components/LoadingState";
import { UnauthorizedState } from "./components/UnauthorizedState";
import { NoCountryState } from "./components/NoCountryState";
import { EditorHeader } from "./components/EditorHeader";
import { EditorStatusBar } from "./components/EditorStatusBar";
import { ErrorDisplay } from "./components/ErrorDisplay";
import { AtomicEditorTabs } from "./components/AtomicEditorTabs";
import { RealTimeFeedbackSidebar } from "./components/RealTimeFeedbackSidebar";
import { EditorActionPanel } from "./components/EditorActionPanel";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default function MyCountryEditor() {
  const { 
    user, isLoaded, activeTab, setActiveTab, hasChanges, setHasChanges, isSaving, setIsSaving,
    errors, setErrors, economicInputs, setEconomicInputs, realTimeValidation, setRealTimeValidation,
    originalInputs, setOriginalInputs, governmentData, setGovernmentData, showAdvanced, setShowAdvanced,
    feedback, isCalculating, userProfile, profileLoading, country, countryLoading, refetchCountry, flagUrl,
    updateCountryMutation, existingGovernment, governmentLoading, createGovernmentMutation, updateGovernmentMutation,
    handleInputsChange, validateInputs, handleSave, handleReset, handleGovernmentSave, errorCount, warningCount,
    populationTier // Add populationTier here
  } = useCountryEditorData();

  
  
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

      <EditorHeader countryName={country.name} countryId={country.id} />

      <EditorStatusBar
        flagUrl={flagUrl}
        country={country}
        hasChanges={hasChanges}
        economicInputs={economicInputs}
        realTimeValidation={realTimeValidation}
        showAdvanced={showAdvanced}
        setShowAdvanced={setShowAdvanced}
        errorCount={errorCount}
        warningCount={warningCount}
        realGDPGrowthRate={economicInputs.coreIndicators.realGDPGrowthRate}
        inflationRate={economicInputs.coreIndicators.inflationRate}
        gdpPerCapita={economicInputs.coreIndicators.gdpPerCapita} populationTier={""}      />

      <ErrorDisplay errors={errors} />

      <AtomicEditorTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        economicInputs={economicInputs}
        handleInputsChange={handleInputsChange}
        showAdvanced={showAdvanced}
        governmentData={governmentData}
        governmentLoading={governmentLoading}
        handleGovernmentSave={handleGovernmentSave}
        setGovernmentData={setGovernmentData}
        country={country}
      />

      <RealTimeFeedbackSidebar realTimeValidation={realTimeValidation} feedback={feedback} />

      <EditorActionPanel
        setRealTimeValidation={setRealTimeValidation}
        realTimeValidation={realTimeValidation}
        handleReset={handleReset}
        hasChanges={hasChanges}
        setShowAdvanced={setShowAdvanced}
        showAdvanced={showAdvanced}
        handleSave={handleSave}
        errorCount={errorCount}
        isSaving={isSaving}
        economicInputs={economicInputs}
      />
    </div>
  );
}