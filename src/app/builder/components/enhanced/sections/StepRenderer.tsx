"use client";

import React, { memo, useCallback } from "react";
import { motion } from "motion/react";
import { Globe } from "iconoir-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { useBuilderContext } from "../context/BuilderStateContext";
import { useBuilderActions } from "../../../hooks/useBuilderActions";
import { FoundationStep } from "../steps/FoundationStep";
import { GovernmentStep } from "../steps/GovernmentStep";
import { NationalIdentitySection } from "../NationalIdentitySection";
import { EconomyBuilderPage } from "../index";
import { BuilderPreviewStep } from "./BuilderPreviewStep";
import type { RealCountryData, EconomicInputs } from "../../../lib/economy-data-service";
import type { GovernmentBuilderState } from "~/types/government";
import type { EconomyBuilderState } from "~/types/economy-builder";
import type { ComponentType } from "@prisma/client";

interface StepRendererProps {
  countries: RealCountryData[];
  isLoadingCountries: boolean;
  countryLoadError: string | null;
  onBackToIntro?: () => void;
  onGovernmentStructureChange: (structure: GovernmentBuilderState) => void;
  onGovernmentStructureSave: (structure: GovernmentBuilderState) => Promise<void>;
}

export const StepRenderer = memo(function StepRenderer({
  countries,
  isLoadingCountries,
  countryLoadError,
  onBackToIntro,
  onGovernmentStructureChange,
  onGovernmentStructureSave,
}: StepRendererProps) {
  const { builderState, setBuilderState, updateStep, countryId, mode, updateEconomicInputs } =
    useBuilderContext();
  const { handleTabChange } = useBuilderActions({ builderState, setBuilderState, mode });

  const handleEconomicInputsChange = useCallback(
    (inputs: EconomicInputs) => {
      updateEconomicInputs(inputs);
    },
    [updateEconomicInputs]
  );

  const handleGovernmentComponentsChange = useCallback(
    (components: ComponentType[]) => {
      setBuilderState((prev) => ({
        ...prev,
        governmentComponents: components,
      }));
    },
    [setBuilderState]
  );

  const handleGovernmentTabChange = useCallback(
    (tab: string) => {
      handleTabChange("government", tab);
    },
    [handleTabChange]
  );

  const handleEconomicsTabChange = useCallback(
    (tab: string) => {
      handleTabChange("economics", tab);
    },
    [handleTabChange]
  );

  const handlePersistEconomyBuilder = useCallback(
    (economyBuilderState: EconomyBuilderState) => {
      setBuilderState((prev) => ({ ...prev, economyBuilderState }));
    },
    [setBuilderState]
  );

  const handleFoundationComplete = useCallback(
    (country: RealCountryData) => {
      updateStep("foundation", country);
    },
    [updateStep]
  );

  const handleCreateFromScratch = useCallback(() => {
    const scratchCountry: RealCountryData = {
      name: "Custom Nation",
      countryCode: "custom",
      gdp: 250000000000,
      gdpPerCapita: 25000,
      unemploymentRate: 5,
      population: 10000000,
      foundationCountryName: undefined,
      growthRate: 3,
      continent: "Custom",
      region: "Custom",
      governmentSpending: 55000000000,
    };

    setBuilderState((prev) => ({
      ...prev,
      creationOrigin: "scratch",
    }));
    updateStep("foundation", scratchCountry);
  }, [updateStep, setBuilderState]);


  // Foundation Step
  if (builderState.step === "foundation" && mode !== "edit") {
    if (isLoadingCountries) {
      return (
        <div className="flex items-center justify-center py-24">
          <div className="space-y-4 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="mx-auto h-16 w-16"
            >
              <Globe className="h-16 w-16 text-amber-500" />
            </motion.div>
            <div className="space-y-2">
              <p className="text-lg font-medium">Loading nations data...</p>
              <p className="text-muted-foreground text-sm">Preparing your foundation options</p>
            </div>
          </div>
        </div>
      );
    }

    if (countryLoadError) {
      return (
        <Alert className="border-red-200 bg-red-50/50">
          <AlertDescription>
            <strong>Error loading countries:</strong> {countryLoadError}
            <br />
            Please refresh the page to try again.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <FoundationStep
        countries={countries}
        isLoadingCountries={isLoadingCountries}
        countryLoadError={countryLoadError}
        onCountrySelect={handleFoundationComplete}
        onCreateFromScratch={handleCreateFromScratch}
        onBackToIntro={onBackToIntro}
      />
    );
  }

  // Core Step
  if (builderState.step === "core") {
    if (!builderState.economicInputs) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
            <p className="text-muted-foreground">Initializing core foundation...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <NationalIdentitySection
          inputs={builderState.economicInputs}
          onInputsChange={updateEconomicInputs}
          referenceCountry={builderState.selectedCountry}
          countryId={countryId}
        />
      </div>
    );
  }

  // Government Step
  if (builderState.step === "government" && builderState.economicInputs) {
    return (
      <GovernmentStep
        mode={mode}
        economicInputs={builderState.economicInputs}
        selectedCountry={builderState.selectedCountry}
        governmentComponents={builderState.governmentComponents}
        governmentStructure={builderState.governmentStructure}
        activeGovernmentTab={builderState.activeGovernmentTab}
        onGovernmentComponentsChange={handleGovernmentComponentsChange}
        onGovernmentStructureChange={onGovernmentStructureChange}
        onGovernmentStructureSave={onGovernmentStructureSave}
        onEconomicInputsChange={updateEconomicInputs}
        onTabChange={handleGovernmentTabChange}
      />
    );
  }

  // Economics Step (eagerly-loaded)
  if (builderState.step === "economics" && builderState.economicInputs) {
    return (
      <EconomyBuilderPage
        mode={mode}
        economicInputs={builderState.economicInputs}
        onEconomicInputsChange={handleEconomicInputsChange}
        governmentComponents={builderState.governmentComponents}
        governmentBuilderData={builderState.governmentStructure}
        countryId={countryId ?? builderState.selectedCountry?.countryCode}
        showAdvanced={mode === "edit" || builderState.showAdvancedMode}
        persistedEconomyBuilder={builderState.economyBuilderState}
        onPersistEconomyBuilder={handlePersistEconomyBuilder}
        activeTab={builderState.activeEconomicsTab}
        onTabChange={handleEconomicsTabChange}
        selectedArchetypeId={builderState.selectedArchetypeId}
      />
    );
  }

  // Preview Step - render preview content
  if (builderState.step === "preview") {
    return <BuilderPreviewStep />;
  }

  // Safety net: never render a blank page. In create mode, fall back to the
  // Foundation step (the safe starting point) so a step/section desync or an
  // unexpected step value can't leave the user staring at nothing.
  if (mode !== "edit") {
    return (
      <FoundationStep
        countries={countries}
        isLoadingCountries={isLoadingCountries}
        countryLoadError={countryLoadError}
        onCountrySelect={handleFoundationComplete}
        onCreateFromScratch={handleCreateFromScratch}
        onBackToIntro={onBackToIntro}
      />
    );
  }

  // Edit mode: fall back to the identity section when possible (foundation is
  // not a valid edit step), otherwise render nothing.
  if (builderState.economicInputs) {
    return (
      <div className="space-y-6">
        <NationalIdentitySection
          inputs={builderState.economicInputs}
          onInputsChange={updateEconomicInputs}
          referenceCountry={builderState.selectedCountry}
          countryId={countryId}
        />
      </div>
    );
  }

  return null;
});
