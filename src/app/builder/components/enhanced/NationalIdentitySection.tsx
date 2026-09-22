"use client";

import React, { useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { Globe, Bank as Landmark, Heart } from "iconoir-react";
import type {
  EconomicInputs,
  RealCountryData,
  NationalIdentityData,
} from "~/app/builder/lib/economy-data-service";
import { BuilderTabCard, type TabDefinition } from "~/app/builder/primitives/BuilderTabCard";
import {
  BasicInfoForm,
  GeographyForm,
  CultureForm,
  IdentityHeroBanner,
} from "./national-identity";
import { useNationalIdentityState } from "./national-identity/useNationalIdentityState";
import { useBuilderContext } from "./context/BuilderStateContext";
import type { GovernmentType, GovernmentBuilderState } from "~/types/government";

// Dynamic import for heavy media search modal
const MediaSearchModal = dynamic(
  () =>
    import("~/components/wiki-os/media-search/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);

interface NationalIdentitySectionProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  referenceCountry?: RealCountryData | null;
  countryId?: string;
}

export function NationalIdentitySection({
  inputs,
  onInputsChange,
  referenceCountry,
  countryId,
}: NationalIdentitySectionProps) {
  const { builderState, setBuilderState, mode } = useBuilderContext();

  const {
    showFlagImageModal,
    setShowFlagImageModal,
    showCoatOfArmsImageModal,
    setShowCoatOfArmsImageModal,
    selectedGovernmentType,
    setSelectedGovernmentType,
    customOfficialName,
    setCustomOfficialName,
    isEditingCustomName,
    setIsEditingCustomName,
    setShouldFetchCustomTypes,
    foundationCoatOfArmsUrl,
    foundationCountryName,
    flag,
    handleColorsExtracted,
    customGovernmentTypes,
    upsertCustomGovernmentType,
    identity,
    handleIdentityChange,
    handleFlagUrlChange,
    handleCoatOfArmsUrlChange,
    handleFieldValueSave,
  } = useNationalIdentityState(inputs, onInputsChange, referenceCountry, countryId);

  const handleGovernmentStructureChange = useCallback(
    (structure: GovernmentBuilderState) => {
      setBuilderState((prev) => ({
        ...prev,
        governmentStructure: structure,
      }));
    },
    [setBuilderState]
  );

  const handleGovernmentTypeChange = useCallback(
    (value: string) => {
      setSelectedGovernmentType(value);
      handleIdentityChange("governmentType", value);
      setBuilderState((prev) => {
        if (!prev.governmentStructure || !prev.governmentStructure.structure) return prev;
        return {
          ...prev,
          governmentStructure: {
            ...prev.governmentStructure,
            structure: {
              ...prev.governmentStructure.structure,
              governmentType: value as GovernmentType,
            },
          },
        };
      });
    },
    [setSelectedGovernmentType, handleIdentityChange, setBuilderState]
  );

  const handleCustomOfficialNameFocus = useCallback(() => {
    setIsEditingCustomName(true);
  }, [setIsEditingCustomName]);

  const handleCustomOfficialNameBlur = useCallback(
    (value: string) => {
      setIsEditingCustomName(false);
      handleIdentityChange("officialName", value);
      if (value.trim()) {
        upsertCustomGovernmentType.mutate({ customTypeName: value.trim() });
      }
    },
    [setIsEditingCustomName, handleIdentityChange, upsertCustomGovernmentType]
  );

  // Tab configuration from global builder state
  const activeTab =
    builderState.activeIdentitySubTab && builderState.activeIdentitySubTab !== "archetype"
      ? builderState.activeIdentitySubTab
      : "basic";

  const setActiveTab = useCallback(
    (tab: string) => {
      setBuilderState((prev) => ({ ...prev, activeIdentitySubTab: tab }));
    },
    [setBuilderState]
  );

  const tabs: TabDefinition[] = useMemo(() => {
    return [
      { id: "basic", label: "Basic Info", icon: Globe },
      { id: "culture", label: "Culture", icon: Heart },
      { id: "technical", label: "Civic Standards", icon: Landmark },
    ];
  }, []);

  // Guard against null inputs
  if (!inputs) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground">Loading national identity data...</p>
        </div>
      </div>
    );
  }

  const foundationCountryData = foundationCountryName
    ? {
        name: foundationCountryName,
        flagUrl: flag?.flagUrl ?? "",
        coatOfArmsUrl: foundationCoatOfArmsUrl,
      }
    : null;

  return (
    <>
      <div className="relative space-y-6">
        {/* Live Executive National Identity Hero Banner */}
        <IdentityHeroBanner
          countryName={String(identity.countryName || inputs.countryName || "")}
          officialName={String(identity.officialName || "")}
          motto={String(identity.motto || "")}
          demonym={String(identity.demonym || "")}
          capitalCity={String(identity.capitalCity || "")}
          governmentType={selectedGovernmentType}
          flagUrl={inputs.flagUrl ?? ""}
          coatOfArmsUrl={inputs.coatOfArmsUrl ?? ""}
          foundationCountry={foundationCountryData}
          onSelectFlag={() => setShowFlagImageModal(true)}
          onSelectCoatOfArms={() => setShowCoatOfArmsImageModal(true)}
          onFlagUrlChange={handleFlagUrlChange}
          onCoatOfArmsUrlChange={handleCoatOfArmsUrlChange}
        />

        {/* Sub-tab Navigation and Form Cards */}
        <BuilderTabCard
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          sectionTheme="identity"
        >
          {activeTab === "basic" && (
            <BasicInfoForm
              identity={identity as NationalIdentityData}
              governmentStructure={builderState.governmentStructure}
              onGovernmentStructureChange={handleGovernmentStructureChange}
              onIdentityChange={handleIdentityChange}
              selectedGovernmentType={selectedGovernmentType}
              customOfficialName={customOfficialName}
              isEditingCustomName={isEditingCustomName}
              onGovernmentTypeChange={handleGovernmentTypeChange}
              onCustomOfficialNameChange={setCustomOfficialName}
              onCustomOfficialNameFocus={handleCustomOfficialNameFocus}
              onCustomOfficialNameBlur={handleCustomOfficialNameBlur}
              setShouldFetchCustomTypes={setShouldFetchCustomTypes}
              customGovernmentTypes={customGovernmentTypes}
              onFieldSave={handleFieldValueSave}
              flagUrl={inputs.flagUrl ?? ""}
              coatOfArmsUrl={inputs.coatOfArmsUrl ?? ""}
              foundationCountry={foundationCountryData}
              onSelectFlag={() => setShowFlagImageModal(true)}
              onSelectCoatOfArms={() => setShowCoatOfArmsImageModal(true)}
              onFlagUrlChange={handleFlagUrlChange}
              onCoatOfArmsUrlChange={handleCoatOfArmsUrlChange}
              onColorsExtracted={handleColorsExtracted}
              inputs={inputs}
              onInputsChange={onInputsChange}
              referenceCountry={referenceCountry}
              showAdvanced={mode === "edit" || builderState.showAdvancedMode}
              mode={mode}
              countryId={countryId}
            />
          )}

          {activeTab === "culture" && (
            <CultureForm
              identity={identity as NationalIdentityData}
              onIdentityChange={handleIdentityChange}
              onFieldSave={handleFieldValueSave}
            />
          )}

          {activeTab === "technical" && (
            <GeographyForm
              identity={identity as NationalIdentityData}
              onIdentityChange={handleIdentityChange}
              countryId={countryId}
              onFieldSave={handleFieldValueSave}
            />
          )}
        </BuilderTabCard>
      </div>

      {/* Image selection modals */}
      {showFlagImageModal && (
        <MediaSearchModal
          isOpen={showFlagImageModal}
          onClose={() => setShowFlagImageModal(false)}
          onImageSelect={(url) => {
            handleFlagUrlChange(url);
            setShowFlagImageModal(false);
          }}
        />
      )}
      {showCoatOfArmsImageModal && (
        <MediaSearchModal
          isOpen={showCoatOfArmsImageModal}
          onClose={() => setShowCoatOfArmsImageModal(false)}
          onImageSelect={(url) => {
            handleCoatOfArmsUrlChange(url);
            setShowCoatOfArmsImageModal(false);
          }}
        />
      )}
    </>
  );
}
