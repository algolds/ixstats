"use client";

import React, { useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

// Dynamic import for heavy media search modal
const MediaSearchModal = dynamic(
  () => import("~/components/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);
import { Globe, Landmark, Heart, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import type {
  EconomicInputs,
  RealCountryData,
  NationalIdentityData,
} from "~/app/builder/lib/economy-data-service";
import { BuilderTabCard, type TabDefinition } from "~/app/builder/primitives/BuilderTabCard";
import { BasicInfoForm, GeographyForm, CultureForm } from "./national-identity";
import { useNationalIdentityState } from "./national-identity/useNationalIdentityState";
import { useBuilderContext } from "./context/BuilderStateContext";
import type { GovernmentType } from "~/types/government";
import { EconomicArchetypeDisplay } from "./EconomicArchetypeDisplay";
import { useNotify } from "~/hooks/useNotify";
import { mapLegacyGovernmentComponents } from "~/hooks/useArchetypes";

/**
 * Props for the NationalIdentitySection component
 *
 * @interface NationalIdentitySectionProps
 * @property {EconomicInputs} inputs - Current economic inputs containing national identity data
 * @property {function} onInputsChange - Callback to update economic inputs when identity values change
 * @property {RealCountryData | null} [referenceCountry] - Optional reference country for importing symbols/data
 */
interface NationalIdentitySectionProps {
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  referenceCountry?: RealCountryData | null;
  countryId?: string;
}

/**
 * NationalIdentitySection - Comprehensive national identity configuration interface
 *
 * This component provides a collapsible, multi-section form for configuring all aspects of a nation's
 * identity including symbols (flag, coat of arms), basic information (country name, capital, government type),
 * culture and language (official languages, anthem, motto), and technical details (TLD, ISO codes, time zones).
 *
 * The section is organized into four collapsible panels:
 * - National Symbols: Flag and coat of arms upload with color extraction and foundation country inheritance
 * - Basic Identity Information: Country name, official name, capital city, government type with custom types
 * - Culture & Language: Official languages, national anthem, motto, and cultural identity markers
 * - Technical Details & Geography: Domain TLD, ISO codes, calling codes, time zones, and coordinates
 *
 * Key features:
 * - MediaSearchModal integration for flag and coat of arms selection from IxWiki
 * - Automatic color palette extraction from flag images
 * - Foundation country data inheritance for symbols and basic info
 * - Custom government type creation and autocomplete suggestions
 * - Identity autocomplete for common values (languages, currencies, time zones)
 * - Collapsible sections with persistent open/close state
 * - Validation and field-level save functionality
 *
 * @component
 * @param {NationalIdentitySectionProps} props - Component props
 * @param {EconomicInputs} props.inputs - Economic inputs object containing all national identity fields
 * @param {function} props.onInputsChange - Callback to update inputs when any field changes
 * @param {RealCountryData | null} [props.referenceCountry] - Optional reference country for data inheritance
 *
 * @returns {JSX.Element} Rendered national identity configuration interface with collapsible sections
 *
 * @example
 * ```tsx
 * <NationalIdentitySection
 *   inputs={economicInputsData}
 *   onInputsChange={handleInputsChange}
 *   referenceCountry={selectedFoundationCountry}
 * />
 * ```
 */
export function NationalIdentitySection({
  inputs,
  onInputsChange,
  referenceCountry,
  countryId,
}: NationalIdentitySectionProps) {
  // Get builder context for autosync registration and state management
  const {
    registerAutoSync,
    unregisterAutoSync,
    builderState,
    setBuilderState,
    mode,
    updateArchetypeId,
  } = useBuilderContext();
  const notify = useNotify();

  // All hooks must be called unconditionally (Rules of Hooks)
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
    // eslint-disable-next-line unused-imports/no-unused-vars
    shouldFetchCustomTypes,
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
    autoSync,
  } = useNationalIdentityState(inputs, onInputsChange, referenceCountry, countryId);

  // Register autosync function with the builder context
  useEffect(() => {
    if (countryId && autoSync.syncNow) {
      registerAutoSync("nationalIdentity", autoSync.syncNow);

      // Cleanup on unmount
      return () => {
        unregisterAutoSync("nationalIdentity");
      };
    }
    return;
  }, [countryId, autoSync.syncNow, registerAutoSync, unregisterAutoSync]);

  // Helper function to render autosave status
  const renderAutosaveStatus = () => {
    if (!countryId) return null; // Only show in edit mode

    const { syncState } = autoSync;

    if (syncState.isSyncing) {
      return (
        <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Saving...</span>
        </div>
      );
    }

    if (syncState.syncError) {
      return (
        <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
          <AlertCircle className="h-3 w-3" />
          <span>Save failed</span>
        </div>
      );
    }

    if (syncState.lastSyncTime) {
      return (
        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
          <CheckCircle className="h-3 w-3" />
          <span>Saved</span>
        </div>
      );
    }

    if (syncState.pendingChanges) {
      return (
        <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          <span>Pending</span>
        </div>
      );
    }

    return null;
  };

  const handleGovernmentStructureChange = useCallback(
    (structure: any) => {
      setBuilderState((prev) => ({
        ...prev,
        governmentStructure: structure,
      }));
    },
    [setBuilderState]
  );

  // Memoize callbacks to prevent unnecessary re-renders
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
  const activeTab = builderState.activeIdentitySubTab || "archetype";
  const setActiveTab = React.useCallback(
    (tab: string) => {
      setBuilderState((prev) => ({ ...prev, activeIdentitySubTab: tab }));
    },
    [setBuilderState]
  );

  const tabs: TabDefinition[] = React.useMemo(() => {
    return [
      { id: "archetype", label: "Archetype/Preset", icon: Globe },
      { id: "basic", label: "Basic Info", icon: Globe },
      { id: "culture", label: "Culture", icon: Heart },
      { id: "technical", label: "Technical", icon: Landmark },
    ];
  }, []);

  // Guard against null inputs (after all hooks)
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

  return (
    <>
      <div className="relative space-y-4">
        {/* Autosave Status (Top right) */}
        <div className="absolute -top-10 right-0 z-10 flex h-8 items-center pr-2">
          {renderAutosaveStatus()}
        </div>

        <BuilderTabCard
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          sectionTheme="identity"
          hideTabList
        >
          {activeTab === "archetype" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-1.5 px-1 pb-2">
                <h3 className="text-foreground flex items-center gap-2 text-lg font-bold">
                  <Globe className="h-5 w-5 text-teal-400" />
                  Archetypes & Presets
                </h3>
                <p className="text-muted-foreground text-xs">
                  Select an archetype to set your nation's overall character and development path.
                </p>
              </div>
              <div className="bg-card/10 rounded-xl border border-white/10 p-5 backdrop-blur-md">
                <EconomicArchetypeDisplay
                  era="all"
                  onArchetypeApplied={(_fallbackState, archetypeId, archetype) => {
                    if (archetypeId && archetype) {
                      updateArchetypeId(archetypeId);
                      setBuilderState((prev) => {
                        const nextState = { ...prev, selectedArchetypeId: archetypeId };

                        // 1. Update government components
                        if (archetype.governmentComponents) {
                          nextState.governmentComponents = mapLegacyGovernmentComponents(
                            archetype.governmentComponents as string[]
                          );
                        }

                        // 2. Update economic components in economyBuilderState
                        if (archetype.economicComponents) {
                          if (nextState.economyBuilderState) {
                            nextState.economyBuilderState = {
                              ...nextState.economyBuilderState,
                              selectedAtomicComponents: archetype.economicComponents,
                              lastUpdated: new Date(),
                            };
                          } else {
                            nextState.economyBuilderState = {
                              selectedAtomicComponents: archetype.economicComponents,
                              structure: {} as any,
                              sectors: [],
                              laborMarket: {} as any,
                              demographics: {} as any,
                              isValid: true,
                              errors: {},
                              lastUpdated: new Date(),
                              version: "1.0.0",
                            };
                          }
                        }

                        // 3. Update government structure type
                        if (archetype.name && nextState.governmentStructure?.structure) {
                          nextState.governmentStructure = {
                            ...nextState.governmentStructure,
                            structure: {
                              ...nextState.governmentStructure.structure,
                              governmentType: archetype.name as any,
                            },
                          };
                        }

                        // 4. Update tax system corporate Rate, income Rate, consumption Rate
                        if (archetype.taxProfile && nextState.taxSystemData) {
                          const updatedCategories = nextState.taxSystemData.categories.map(
                            (cat: any) => {
                              if (cat.categoryName.toLowerCase().includes("corporate")) {
                                return { ...cat, baseRate: archetype.taxProfile.corporateRate };
                              }
                              if (
                                cat.categoryName.toLowerCase().includes("personal") ||
                                cat.categoryName.toLowerCase().includes("income")
                              ) {
                                return { ...cat, baseRate: archetype.taxProfile.incomeRate };
                              }
                              if (
                                cat.categoryName.toLowerCase().includes("consumption") ||
                                cat.categoryName.toLowerCase().includes("sales") ||
                                cat.categoryName.toLowerCase().includes("value added")
                              ) {
                                return { ...cat, baseRate: archetype.taxProfile.consumptionRate };
                              }
                              return cat;
                            }
                          );
                          nextState.taxSystemData = {
                            ...nextState.taxSystemData,
                            categories: updatedCategories,
                          };
                        }

                        // 5. Update economic inputs (unemployment, GDP growth, etc.)
                        if (nextState.economicInputs) {
                          const core = nextState.economicInputs.coreIndicators || {};
                          const labor = nextState.economicInputs.laborEmployment || {};

                          nextState.economicInputs = {
                            ...nextState.economicInputs,
                            coreIndicators: {
                              ...core,
                              realGDPGrowthRate:
                                archetype.growthMetrics?.gdpGrowth ?? core.realGDPGrowthRate,
                            },
                            laborEmployment: {
                              ...labor,
                              unemploymentRate:
                                archetype.employmentProfile?.unemploymentRate ??
                                labor.unemploymentRate,
                              laborForceParticipationRate:
                                archetype.employmentProfile?.laborParticipation ??
                                labor.laborForceParticipationRate,
                            },
                          };
                        }

                        return nextState;
                      });

                      notify.success(
                        `Applied ${archetype.name} presets (Government & Economy)! Click Save to apply changes.`
                      );
                    }
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === "basic" && (
            <div className="space-y-8">
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
                // Symbols merging
                flagUrl={inputs.flagUrl ?? ""}
                coatOfArmsUrl={inputs.coatOfArmsUrl ?? ""}
                foundationCountry={
                  foundationCountryName
                    ? {
                        name: foundationCountryName,
                        flagUrl: flag?.flagUrl ?? "",
                        coatOfArmsUrl: foundationCoatOfArmsUrl,
                      }
                    : undefined
                }
                onSelectFlag={() => setShowFlagImageModal(true)}
                onSelectCoatOfArms={() => setShowCoatOfArmsImageModal(true)}
                onFlagUrlChange={handleFlagUrlChange}
                onCoatOfArmsUrlChange={handleCoatOfArmsUrlChange}
                onColorsExtracted={handleColorsExtracted}
                // Core Indicators props
                inputs={inputs}
                onInputsChange={onInputsChange}
                referenceCountry={referenceCountry}
                showAdvanced={builderState.showAdvancedMode}
                mode={mode}
                countryId={countryId}
              />
            </div>
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
