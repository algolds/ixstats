"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  Globe,
  Crown,
  Building,
  MapPin,
  Group as Users,
  Link as Link2,
  LinkSlash as Link2Off,
  EditPencil as Edit3,
  Lock,
} from "iconoir-react";
import { GlassSelectBox } from "../../../primitives/enhanced";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Toggle } from "~/components/ui/toggle";
import { IdentityAutocomplete } from "./IdentityAutocomplete";
import { BasicInfoCoreIndicators } from "./BasicInfoCoreIndicators";
import { soundEffects } from "~/lib/sound/cuelume";
import { api } from "~/trpc/react";
import { MapPickerModal } from "~/components/maps/core/MapPickerModal";
import type {
  NationalIdentityData,
  EconomicInputs,
  RealCountryData,
} from "~/app/builder/lib/economy-data-service";
import type { ExtractedColors } from "~/lib/media";
import type { GovernmentBuilderState, GovernmentStructureInput } from "~/types/government";
import { GovernmentStructureForm } from "~/components/mycountry/domains/government/atoms/GovernmentStructureForm";
import { TemplateFieldIndicator } from "../../../primitives/TemplateFieldIndicator";
import { AdvancedFieldsDisclosure } from "../../../primitives/AdvancedFieldsDisclosure";
import { deriveDemonym, formatCeremonialName } from "./identityUtils";
import { Card, CardContent } from "~/components/ui/card";

interface BasicInfoFormProps {
  identity: NationalIdentityData;
  governmentStructure: GovernmentBuilderState | null;
  onGovernmentStructureChange: (structure: GovernmentBuilderState) => void;
  onIdentityChange: <K extends keyof NationalIdentityData>(
    fieldOrFields: K | Partial<NationalIdentityData>,
    value?: NationalIdentityData[K]
  ) => void;
  selectedGovernmentType: string;
  customOfficialName: string;
  isEditingCustomName?: boolean;
  onGovernmentTypeChange: (value: string) => void;
  onCustomOfficialNameChange: (value: string) => void;
  onCustomOfficialNameFocus?: () => void;
  onCustomOfficialNameBlur?: (value: string) => void;
  setShouldFetchCustomTypes?: (should: boolean) => void;
  customGovernmentTypes?: Array<{ id: string; customTypeName: string }>;
  onFieldSave?: (fieldName: string, value: string) => void;

  // Optional symbol props preserved for backward compatibility
  flagUrl?: string;
  coatOfArmsUrl?: string;
  foundationCountry?: {
    name: string;
    flagUrl?: string;
    coatOfArmsUrl?: string;
  } | null;
  onSelectFlag?: () => void;
  onSelectCoatOfArms?: () => void;
  onFlagUrlChange?: (url: string) => void;
  onCoatOfArmsUrlChange?: (url: string) => void;
  onColorsExtracted?: (colors: ExtractedColors) => void;

  // Core Indicator Props
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  referenceCountry?: RealCountryData | null;
  showAdvanced?: boolean;
  mode?: "create" | "edit";
  fieldLocks?: Record<string, boolean>;
  countryId?: string;
}

const GOVERNMENT_TYPES = [
  { value: "Republic", label: "Republic", prefix: "The Republic of" },
  { value: "Kingdom", label: "Kingdom", prefix: "The Kingdom of" },
  { value: "Federation", label: "Federation", prefix: "The Federation of" },
  { value: "Commonwealth", label: "Commonwealth", prefix: "The Commonwealth of" },
  { value: "Emirate", label: "Emirate", prefix: "The Emirate of" },
  { value: "Principality", label: "Principality", prefix: "The Principality of" },
  { value: "Holy State", label: "Holy State", prefix: "The Holy State of" },
  { value: "Union", label: "Union", prefix: "The Union of" },
  { value: "Empire", label: "Empire", prefix: "The Empire of" },
  { value: "Sultanate", label: "Sultanate", prefix: "The Sultanate of" },
  { value: "Duchy", label: "Duchy", prefix: "The Duchy of" },
  { value: "Confederacy", label: "Confederacy", prefix: "The Confederacy of" },
  { value: "Alliance", label: "Alliance", prefix: "The Alliance of" },
  { value: "Coalition", label: "Coalition", prefix: "The Coalition of" },
  { value: "Dominion", label: "Dominion", prefix: "The Dominion of" },
  { value: "Territories", label: "Territories", prefix: "The Territories of" },
  { value: "Protectorate", label: "Protectorate", prefix: "The Protectorate of" },
  { value: "Mandate", label: "Mandate", prefix: "The Mandate of" },
  { value: "City-State", label: "City-State", prefix: "The City-State of" },
  { value: "Free State", label: "Free State", prefix: "The Free State of" },
  { value: "Socialist Republic", label: "Socialist Republic", prefix: "The Socialist Republic of" },
  {
    value: "Democratic Republic",
    label: "Democratic Republic",
    prefix: "The Democratic Republic of",
  },
  { value: "People's Republic", label: "People's Republic", prefix: "The People's Republic of" },
  { value: "Autonomous Region", label: "Autonomous Region", prefix: "The Autonomous Region of" },
  { value: "Sovereign State", label: "Sovereign State", prefix: "The Sovereign State of" },
  { value: "Nation", label: "Nation", prefix: "The Nation of" },
  { value: "Country", label: "Country", prefix: "The Country of" },
  { value: "State", label: "State", prefix: "The State of" },
  { value: "custom", label: "Custom", prefix: "" },
];

export const BasicInfoForm = React.memo(
  function BasicInfoForm({
    identity,
    governmentStructure,
    onGovernmentStructureChange,
    onIdentityChange,
    selectedGovernmentType,
    customOfficialName,
    onGovernmentTypeChange,
    onCustomOfficialNameChange,
    onCustomOfficialNameFocus,
    onCustomOfficialNameBlur,
    setShouldFetchCustomTypes,
    customGovernmentTypes,
    onFieldSave,
    foundationCountry,
    inputs,
    onInputsChange,
    referenceCountry,
    showAdvanced = false,
    mode = "create",
    countryId,
  }: BasicInfoFormProps) {
    const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);

    // Smart auto vs custom ceremonial name tracking
    const [isCustomOfficialName, setIsCustomOfficialName] = useState(() => {
      if (!identity.officialName) return false;
      const expected = formatCeremonialName(identity.countryName || "", selectedGovernmentType);
      return identity.officialName.trim() !== expected.trim();
    });

    const upsertCityMutation = api.countryGeo.upsertCity.useMutation({
      onSuccess: (city) => {
        onIdentityChange("capitalCity", city.name);
        onFieldSave?.("capitalCity", city.name);
      },
    });

    const handleConfirmMapPicker = useCallback(
      async (coords: [number, number]) => {
        if (!countryId) return;
        try {
          await upsertCityMutation.mutateAsync({
            countryId,
            id: identity.capitalCityId || undefined,
            name: identity.capitalCity || "Capital City",
            type: "capital",
            coordinates: coords,
            isNationalCapital: true,
          });
        } catch (err) {
          console.error("Failed to upsert capital city from map picker:", err);
          alert(err instanceof Error ? err.message : "Failed to place capital on map");
        }
      },
      [countryId, identity.capitalCityId, identity.capitalCity, upsertCityMutation]
    );

    // Fetch custom government types on mount
    React.useEffect(() => {
      setShouldFetchCustomTypes?.(true);
    }, [setShouldFetchCustomTypes]);

    // Map government types for GlassSelectBox
    const govtOptions = useMemo(() => {
      const standard = GOVERNMENT_TYPES.map((type) => ({
        value: type.value,
        label: type.label,
        description: type.prefix || undefined,
      }));
      const custom =
        customGovernmentTypes?.map((type) => ({
          value: type.customTypeName,
          label: type.customTypeName,
          description: "Custom government type",
        })) || [];
      return [...standard, ...custom];
    }, [customGovernmentTypes]);

    // Country name handler with auto-demonym and auto-official name synthesis
    const handleCountryNameChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const nextName = event.target.value;
        const updates: Partial<NationalIdentityData> = { countryName: nextName };

        // If demonym is empty or default, auto-derive
        if (!identity.demonym || identity.demonym === deriveDemonym(identity.countryName || "")) {
          updates.demonym = deriveDemonym(nextName);
        }

        // If official name is in auto mode, synthesize live
        if (!isCustomOfficialName) {
          const autoName = formatCeremonialName(nextName, selectedGovernmentType);
          updates.officialName = autoName;
          onCustomOfficialNameChange(autoName);
        }

        onIdentityChange(updates);
      },
      [
        identity.countryName,
        identity.demonym,
        isCustomOfficialName,
        selectedGovernmentType,
        onIdentityChange,
        onCustomOfficialNameChange,
      ]
    );

    // Government type change handler
    const handleGovTypeChange = useCallback(
      (val: string) => {
        onGovernmentTypeChange(val);
        if (!isCustomOfficialName) {
          const autoName = formatCeremonialName(identity.countryName || "", val);
          onIdentityChange("officialName", autoName);
          onCustomOfficialNameChange(autoName);
        }
      },
      [
        identity.countryName,
        isCustomOfficialName,
        onGovernmentTypeChange,
        onIdentityChange,
        onCustomOfficialNameChange,
      ]
    );

    const handleOfficialNameChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        onIdentityChange("officialName", event.target.value);
      },
      [onIdentityChange]
    );

    const toggleCustomOfficialName = useCallback(() => {
      soundEffects.toggle();
      const next = !isCustomOfficialName;
      setIsCustomOfficialName(next);
      if (!next) {
        const autoName = formatCeremonialName(identity.countryName || "", selectedGovernmentType);
        onIdentityChange("officialName", autoName);
        onCustomOfficialNameChange(autoName);
      }
    }, [
      isCustomOfficialName,
      identity.countryName,
      selectedGovernmentType,
      onIdentityChange,
      onCustomOfficialNameChange,
    ]);

    const [isLargestLocked, setIsLargestLocked] = useState(() => {
      return identity.capitalCity === identity.largestCity && !!identity.capitalCity;
    });

    const toggleLargestLock = useCallback(() => {
      soundEffects.toggle();
      const next = !isLargestLocked;
      setIsLargestLocked(next);
      if (next) {
        const nextCity = identity.capitalCity || "";
        onIdentityChange("largestCity", nextCity);
        if (nextCity && onFieldSave) {
          onFieldSave("largestCity", nextCity);
        }
      }
    }, [isLargestLocked, identity.capitalCity, onIdentityChange, onFieldSave]);

    const handleCapitalCityChange = useCallback(
      (value: string) => {
        onIdentityChange("capitalCity", value);
        if (isLargestLocked) {
          onIdentityChange("largestCity", value);
        }
      },
      [isLargestLocked, onIdentityChange]
    );

    const handleCapitalCitySave = useCallback(
      (fieldName: string, value: string) => {
        if (onFieldSave) {
          onFieldSave("capitalCity", value);
          if (isLargestLocked) {
            onFieldSave("largestCity", value);
          }
        }
      },
      [isLargestLocked, onFieldSave]
    );

    const handleLargestCityChange = useCallback(
      (value: string) => {
        onIdentityChange("largestCity", value);
      },
      [onIdentityChange]
    );

    const handleDemonymChange = useCallback(
      (value: string) => {
        onIdentityChange("demonym", value);
      },
      [onIdentityChange]
    );

    const isEditMode = mode === "edit";

    const handleStructureUpdate = useCallback(
      (structure: GovernmentStructureInput) => {
        onGovernmentStructureChange({
          structure,
          departments: governmentStructure?.departments ?? [],
          budgetAllocations: governmentStructure?.budgetAllocations ?? [],
          revenueSources: governmentStructure?.revenueSources ?? [],
          selectedComponents: governmentStructure?.selectedComponents ?? [],
          isValid: governmentStructure?.isValid ?? true,
          errors: governmentStructure?.errors ?? {},
          atomicComponentCosts: governmentStructure?.atomicComponentCosts,
        });
      },
      [governmentStructure, onGovernmentStructureChange]
    );

    const displayedCeremonialName =
      identity.officialName ||
      formatCeremonialName(identity.countryName || "", selectedGovernmentType);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 text-left lg:grid-cols-2">
          {/* Administrative Profile Card */}
          <Card className="z-10 overflow-visible">
            <div className="border-separator border-b px-6 py-4">
              <h3 className="text-label text-headline flex items-center gap-2">
                <Crown className="text-tint h-5 w-5" />
                Administrative Profile
              </h3>
            </div>
            <CardContent className="space-y-4 p-6">
              {/* 1. Country Name (Primary Sovereign Form) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-label text-body flex items-center gap-2 font-medium">
                    <Globe className="text-label-secondary h-4 w-4" />
                    <span>Country Name</span>
                    <span
                      className="bg-tint inline-block h-1.5 w-1.5 rounded-full"
                      title="Required primary field"
                    />
                  </label>
                  {Boolean(
                    foundationCountry?.name && identity.countryName === foundationCountry.name
                  ) && <TemplateFieldIndicator />}
                </div>
                <p className="text-label-secondary text-footnote leading-tight">
                  Short form name of your sovereign nation
                </p>
                <Input
                  value={identity.countryName ?? ""}
                  onChange={handleCountryNameChange}
                  placeholder="e.g. Eldoria, Vesperia, Solaria"
                  className="font-medium"
                />
              </div>

              {/* 2. Unified Constitutional Governance (Government Type + Ceremonial Official Name) */}
              <div className="rounded-row border-separator bg-surface space-y-3 border p-4">
                <div className="flex items-center justify-between">
                  <label className="text-label text-caption flex items-center gap-2 font-semibold">
                    <Crown className="text-tint h-3.5 w-3.5" />
                    <span>Constitutional Form & Ceremonial Title</span>
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant={isCustomOfficialName ? "secondary" : "ghost"}
                    onClick={toggleCustomOfficialName}
                  >
                    {isCustomOfficialName ? (
                      <>
                        <Lock aria-hidden />
                        <span>Reset to Auto</span>
                      </>
                    ) : (
                      <>
                        <Edit3 aria-hidden />
                        <span>Customize Title</span>
                      </>
                    )}
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-label-secondary text-caption block">Government Type</span>
                    <GlassSelectBox
                      label=""
                      icon={Crown}
                      value={selectedGovernmentType}
                      onChange={handleGovTypeChange}
                      options={govtOptions}
                      placeholder="Select government type"
                      sectionId="symbols"
                      theme="default"
                      size="sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-label-secondary text-caption block">
                      Ceremonial Official Name
                    </span>
                    {isCustomOfficialName ? (
                      <Input
                        value={identity.officialName ?? ""}
                        onChange={handleOfficialNameChange}
                        placeholder="The Republic of..."
                        className="text-caption h-9"
                      />
                    ) : (
                      <div
                        className="rounded-control border-separator bg-fill-4 text-caption text-label/90 flex h-9 items-center border px-3 select-none"
                        title="Auto-formatted based on Country Name and Government Type"
                      >
                        <span className="truncate">{displayedCeremonialName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {selectedGovernmentType === "custom" && (
                  <div className="pt-1">
                    <Input
                      value={customOfficialName}
                      onFocus={onCustomOfficialNameFocus}
                      onChange={(e) => onCustomOfficialNameChange(e.target.value)}
                      onBlur={(e) => onCustomOfficialNameBlur?.(e.target.value)}
                      placeholder="Enter custom official name..."
                      className="text-footnote h-9"
                    />
                  </div>
                )}
              </div>

              {/* 3. Civic Geography & Demonym */}
              <div className="rounded-row border-separator bg-surface space-y-3 border p-4">
                <div className="flex items-center justify-between">
                  <label className="text-label text-caption flex items-center gap-2 font-semibold">
                    <Building className="text-teal h-3.5 w-3.5" />
                    <span>Civic Geography & Demonym</span>
                  </label>
                  {isLargestLocked && (
                    <span className="text-caption text-teal/80">Largest City = Capital</span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <IdentityAutocomplete
                    fieldName="capitalCity"
                    label="Capital City"
                    value={String(identity.capitalCity || "")}
                    onChange={handleCapitalCityChange}
                    placeholder="Capital city name"
                    icon={Building}
                    iconClassName="text-teal"
                    onSave={handleCapitalCitySave}
                    extraLabelElement={
                      <div className="flex items-center gap-2">
                        {countryId && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              soundEffects.press();
                              setIsMapPickerOpen(true);
                            }}
                            title="Select Capital location on map"
                          >
                            <MapPin aria-hidden />
                            <span>Pick on Map</span>
                          </Button>
                        )}
                        <Toggle
                          size="sm"
                          pressed={isLargestLocked}
                          onPressedChange={() => toggleLargestLock()}
                          title={
                            isLargestLocked
                              ? "Unlock Largest City to set a different value"
                              : "Set Largest City to match Capital City"
                          }
                        >
                          {isLargestLocked ? (
                            <>
                              <Link2 aria-hidden />
                              <span>Linked</span>
                            </>
                          ) : (
                            <>
                              <Link2Off aria-hidden className="text-label-tertiary" />
                              <span>Unlinked</span>
                            </>
                          )}
                        </Toggle>
                      </div>
                    }
                  />

                  <IdentityAutocomplete
                    fieldName="demonym"
                    label="Demonym"
                    value={String(identity.demonym || "")}
                    onChange={handleDemonymChange}
                    placeholder="Demonym (e.g. American, Eldorian)"
                    icon={Users}
                    iconClassName="text-teal"
                    onSave={onFieldSave}
                  />
                </div>

                {/* Advanced tier in FIELD_IMPORTANCE.identity; linked-to-capital counts as default */}
                <AdvancedFieldsDisclosure
                  section="identity"
                  id="basic-info"
                  values={{ largestCity: identity.largestCity }}
                  defaults={{ largestCity: identity.capitalCity }}
                  defaultOpen={showAdvanced}
                  className="pt-1"
                >
                  <IdentityAutocomplete
                    fieldName="largestCity"
                    label="Largest City"
                    value={
                      isLargestLocked
                        ? String(identity.capitalCity || "")
                        : String(identity.largestCity || "")
                    }
                    onChange={handleLargestCityChange}
                    placeholder={isLargestLocked ? "Same as Capital City" : "Largest city name"}
                    icon={MapPin}
                    iconClassName="text-teal"
                    onSave={onFieldSave}
                    disabled={isLargestLocked}
                  />
                </AdvancedFieldsDisclosure>
              </div>
            </CardContent>
          </Card>

          {isEditMode ? (
            /* Edit Mode: Government Structure card replaces Core Indicators */
            <Card>
              <div className="border-separator border-b px-6 py-4">
                <h3 className="text-label text-headline flex items-center gap-2">
                  <Crown className="text-indigo h-5 w-5" />
                  Government Structure
                </h3>
              </div>
              <CardContent className="space-y-4 p-6">
                <GovernmentStructureForm
                  data={
                    governmentStructure?.structure || {
                      governmentName: "",
                      governmentType: "Other",
                      headOfState: "",
                      headOfGovernment: "",
                      legislatureName: "",
                      executiveName: "",
                      judicialName: "",
                      totalBudget: 0,
                      fiscalYear: "Calendar Year",
                      budgetCurrency: "USD",
                    }
                  }
                  onChange={handleStructureUpdate}
                  isReadOnly={false}
                  gdpData={{
                    nominalGDP: inputs.coreIndicators?.nominalGDP || 0,
                    countryName: identity.countryName,
                  }}
                  hideBudgetConfig={true}
                  noWrapper={true}
                  hideGovernmentType={true}
                />
              </CardContent>
            </Card>
          ) : (
            <BasicInfoCoreIndicators
              inputs={inputs}
              onInputsChange={onInputsChange}
              referenceCountry={referenceCountry}
            />
          )}
        </div>

        {countryId && (
          <MapPickerModal
            isOpen={isMapPickerOpen}
            onClose={() => setIsMapPickerOpen(false)}
            onConfirm={handleConfirmMapPicker}
            countryId={countryId}
            title="Place Capital on Map"
          />
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.identity.countryName === nextProps.identity.countryName &&
      prevProps.identity.officialName === nextProps.identity.officialName &&
      prevProps.identity.capitalCity === nextProps.identity.capitalCity &&
      prevProps.identity.largestCity === nextProps.identity.largestCity &&
      prevProps.identity.demonym === nextProps.identity.demonym &&
      prevProps.selectedGovernmentType === nextProps.selectedGovernmentType &&
      prevProps.customOfficialName === nextProps.customOfficialName &&
      prevProps.isEditingCustomName === nextProps.isEditingCustomName &&
      prevProps.flagUrl === nextProps.flagUrl &&
      prevProps.coatOfArmsUrl === nextProps.coatOfArmsUrl &&
      prevProps.foundationCountry?.name === nextProps.foundationCountry?.name &&
      prevProps.foundationCountry?.flagUrl === nextProps.foundationCountry?.flagUrl &&
      prevProps.foundationCountry?.coatOfArmsUrl === nextProps.foundationCountry?.coatOfArmsUrl &&
      prevProps.inputs.coreIndicators?.totalPopulation ===
        nextProps.inputs.coreIndicators?.totalPopulation &&
      prevProps.inputs.coreIndicators?.gdpPerCapita ===
        nextProps.inputs.coreIndicators?.gdpPerCapita &&
      prevProps.inputs.coreIndicators?.realGDPGrowthRate ===
        nextProps.inputs.coreIndicators?.realGDPGrowthRate &&
      prevProps.inputs.coreIndicators?.inflationRate ===
        nextProps.inputs.coreIndicators?.inflationRate &&
      prevProps.inputs.fiscalSystem?.taxRevenueGDPPercent ===
        nextProps.inputs.fiscalSystem?.taxRevenueGDPPercent &&
      prevProps.mode === nextProps.mode &&
      prevProps.showAdvanced === nextProps.showAdvanced &&
      prevProps.governmentStructure?.structure?.governmentName ===
        nextProps.governmentStructure?.structure?.governmentName &&
      prevProps.governmentStructure?.structure?.governmentType ===
        nextProps.governmentStructure?.structure?.governmentType &&
      prevProps.governmentStructure?.structure?.headOfState ===
        nextProps.governmentStructure?.structure?.headOfState &&
      prevProps.governmentStructure?.structure?.headOfGovernment ===
        nextProps.governmentStructure?.structure?.headOfGovernment &&
      prevProps.governmentStructure?.structure?.legislatureName ===
        nextProps.governmentStructure?.structure?.legislatureName &&
      prevProps.governmentStructure?.structure?.executiveName ===
        nextProps.governmentStructure?.structure?.executiveName &&
      prevProps.governmentStructure?.structure?.judicialName ===
        nextProps.governmentStructure?.structure?.judicialName
    );
  }
);
