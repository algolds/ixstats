"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  Crown,
  Building,
  MapPin,
  Group as Users,
  Link as Link2,
  LinkSlash as Link2Off,
} from "iconoir-react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
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
import {
  autoGovernmentName,
  deriveDemonym,
  formatCeremonialName,
  GOVERNMENT_FORM_SUGGESTIONS,
  isAutoValue,
  typedOrAuto,
} from "./identityUtils";
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
  onGovernmentTypeChange: (value: string) => void;
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

/**
 * A name input. A derived name (`autoValue`) shows its automatic value as the placeholder and stays automatic
 * while empty, so there is no toggle: type to override, clear to go back.
 */
function NameField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoValue,
  required,
  list,
  extra,
  wide,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoValue?: string;
  required?: boolean;
  list?: string;
  extra?: React.ReactNode;
  /** Spans both columns; for long derived names. */
  wide?: boolean;
}) {
  const isDerived = autoValue !== undefined;
  const shown = isDerived && isAutoValue(value, autoValue) ? "" : value;
  return (
    <div className={cn("space-y-2", wide && "sm:col-span-2")}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-label text-body font-medium whitespace-nowrap">
          {label}
          {required && (
            <span aria-hidden="true" className="bg-tint ml-2 inline-block h-1.5 w-1.5 rounded-full" />
          )}
        </Label>
        {extra}
      </div>
      <Input
        id={id}
        list={list}
        value={shown}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        placeholder={(isDerived && autoValue) || placeholder}
        aria-describedby={isDerived ? `${id}-hint` : undefined}
      />
      {isDerived && (
        <p id={`${id}-hint`} className="text-label-secondary text-footnote">
          {shown ? "Clear to use the automatic name." : "Automatic. Type to set your own."}
        </p>
      )}
    </div>
  );
}

export const BasicInfoForm = React.memo(
  function BasicInfoForm({
    identity,
    governmentStructure,
    onGovernmentStructureChange,
    onIdentityChange,
    selectedGovernmentType,
    onGovernmentTypeChange,
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

    // The form of government is free text; these are suggestions, the user's own earlier types included.
    const governmentFormSuggestions = useMemo(
      () => [
        ...new Set([
          ...GOVERNMENT_FORM_SUGGESTIONS,
          ...(customGovernmentTypes?.map((type) => type.customTypeName) ?? []),
        ]),
      ],
      [customGovernmentTypes]
    );

    const countryName = identity.countryName || "";
    const autoOfficialName = formatCeremonialName(countryName, selectedGovernmentType);
    const structure = governmentStructure?.structure;
    const autoGovName = autoGovernmentName(countryName);

    // Country name: derived names that are still automatic (demonym, official name, government name) follow it.
    const handleCountryNameChange = useCallback(
      (nextName: string) => {
        const updates: Partial<NationalIdentityData> = { countryName: nextName };
        if (isAutoValue(identity.demonym, deriveDemonym(countryName))) {
          updates.demonym = deriveDemonym(nextName);
        }
        if (isAutoValue(identity.officialName, autoOfficialName)) {
          updates.officialName = formatCeremonialName(nextName, selectedGovernmentType);
        }
        onIdentityChange(updates);
        if (structure && isAutoValue(structure.governmentName, autoGovName)) {
          handleStructureUpdate({ ...structure, governmentName: autoGovernmentName(nextName) });
        }
      },
      [
        countryName,
        identity.demonym,
        identity.officialName,
        autoOfficialName,
        autoGovName,
        structure,
        selectedGovernmentType,
        onIdentityChange,
        handleStructureUpdate,
      ]
    );

    // Form of government: the official name follows it while automatic.
    const handleGovFormChange = useCallback(
      (nextForm: string) => {
        onGovernmentTypeChange(nextForm);
        if (isAutoValue(identity.officialName, autoOfficialName)) {
          onIdentityChange("officialName", formatCeremonialName(countryName, nextForm));
        }
      },
      [countryName, identity.officialName, autoOfficialName, onGovernmentTypeChange, onIdentityChange]
    );

    const handleOfficialNameChange = useCallback(
      (typed: string) => onIdentityChange("officialName", typedOrAuto(typed, autoOfficialName)),
      [autoOfficialName, onIdentityChange]
    );

    const handleGovNameChange = useCallback(
      (typed: string) => {
        if (structure) handleStructureUpdate({ ...structure, governmentName: typedOrAuto(typed, autoGovName) });
      },
      [structure, autoGovName, handleStructureUpdate]
    );

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


    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 text-left lg:grid-cols-2">
          <Card className="z-10 overflow-visible">
            <div className="border-separator border-b px-6 py-4">
              <h3 className="text-label text-headline flex items-center gap-2">
                <Crown className="text-tint h-5 w-5" />
                Administrative profile
              </h3>
            </div>
            <CardContent className="space-y-4 p-6">
              {/* Names: what the country is called and how it is governed, with derived names that follow them */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <NameField
                  id="identity-country-name"
                  label="Country name"
                  required
                  value={countryName}
                  onChange={handleCountryNameChange}
                  placeholder="e.g. Eldoria"
                  extra={
                    Boolean(foundationCountry?.name && countryName === foundationCountry.name) && (
                      <TemplateFieldIndicator />
                    )
                  }
                />
                <NameField
                  id="identity-government-form"
                  label="Form of government"
                  list="identity-government-forms"
                  value={selectedGovernmentType}
                  onChange={handleGovFormChange}
                  placeholder="e.g. Republic, Kingdom, Federal Republic"
                />
                <datalist id="identity-government-forms">
                  {governmentFormSuggestions.map((form) => (
                    <option key={form} value={form} />
                  ))}
                </datalist>
                <NameField
                  id="identity-official-name"
                  label="Official name"
                  value={identity.officialName ?? ""}
                  onChange={handleOfficialNameChange}
                  autoValue={autoOfficialName}
                  wide
                />
                {structure && (
                  <NameField
                    id="identity-government-name"
                    label="Government name"
                    value={structure.governmentName ?? ""}
                    onChange={handleGovNameChange}
                    autoValue={autoGovName}
                    wide
                  />
                )}
              </div>

              {/* Civic geography & demonym */}
              <div className="rounded-row border-separator bg-surface space-y-3 border p-4">
                <div className="flex items-center justify-between">
                  <label className="text-label text-caption flex items-center gap-2 font-semibold">
                    <Building className="text-teal h-3.5 w-3.5" />
                    <span>Civic geography & demonym</span>
                  </label>
                  {isLargestLocked && (
                    <span className="text-caption text-teal/80">Largest City = Capital</span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <IdentityAutocomplete
                    fieldName="capitalCity"
                    label="Capital city"
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
                            title="Select capital location on map"
                          >
                            <MapPin aria-hidden />
                            <span>Pick on map</span>
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
                    label="Largest city"
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
                  Government structure
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
            title="Place capital on map"
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
      prevProps.customGovernmentTypes === nextProps.customGovernmentTypes &&
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
