"use client";

import React, { useCallback } from "react";
import {
  Globe,
  Crown,
  Building,
  MapPin,
  Users,
  BarChart3,
  DollarSign,
  Percent,
  Link2,
  Link2Off,
} from "lucide-react";
import {
  CurrencySymbolPicker,
  GlassSelectBox,
  SliderWithDirectInput,
} from "../../../primitives/enhanced";
import { Input } from "~/components/ui/input";
import { GlassCard, GlassCardContent } from "../../glass/GlassCard";
import { IdentityAutocomplete } from "./IdentityAutocomplete";
import { cn } from "~/lib/utils";
import type {
  NationalIdentityData,
  EconomicInputs,
  RealCountryData,
} from "~/app/builder/lib/economy-data-service";
import { getEconomicTier } from "~/app/builder/lib/economy-data-service";
import { EDIT_MODE_FIELD_LOCKS } from "~/app/builder/components/enhanced/builderConfig";
import { Badge } from "~/components/ui/badge";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { Switch } from "~/components/ui/switch";
import { getPopulationTierFromPopulation } from "~/types/ixstats";

import { CountrySymbolsUploader } from "../../CountrySymbolsUploader";
import { GovernmentStructureForm } from "~/components/government/atoms/GovernmentStructureForm";

interface BasicInfoFormProps {
  identity: NationalIdentityData;
  governmentStructure: any;
  onGovernmentStructureChange: (structure: any) => void;
  onIdentityChange: (field: keyof NationalIdentityData, value: any) => void;
  selectedGovernmentType: string;
  customOfficialName: string;
  isEditingCustomName: boolean;
  onGovernmentTypeChange: (value: string) => void;
  onCustomOfficialNameChange: (value: string) => void;
  onCustomOfficialNameFocus: () => void;
  onCustomOfficialNameBlur: (value: string) => void;
  setShouldFetchCustomTypes: (should: boolean) => void;
  customGovernmentTypes?: Array<{ id: string; customTypeName: string }>;
  onFieldSave: (fieldName: string, value: string) => void;

  // Symbol Props
  flagUrl: string;
  coatOfArmsUrl: string;
  foundationCountry?: {
    name: string;
    flagUrl?: string;
    coatOfArmsUrl?: string;
  } | null;
  onSelectFlag: () => void;
  onSelectCoatOfArms: () => void;
  onFlagUrlChange: (url: string) => void;
  onCoatOfArmsUrlChange: (url: string) => void;
  onColorsExtracted: (colors: any) => void;

  // Core Indicator Props
  inputs: EconomicInputs;
  onInputsChange: (inputs: EconomicInputs) => void;
  referenceCountry?: RealCountryData | null;
  showAdvanced?: boolean;
  mode?: "create" | "edit";
  fieldLocks?: Record<string, any>;
}

const GOVERNMENT_TYPES = [
  { value: "republic", label: "Republic", prefix: "The Republic of" },
  { value: "kingdom", label: "Kingdom", prefix: "The Kingdom of" },
  { value: "federation", label: "Federation", prefix: "The Federation of" },
  { value: "commonwealth", label: "Commonwealth", prefix: "The Commonwealth of" },
  { value: "emirate", label: "Emirate", prefix: "The Emirate of" },
  { value: "principality", label: "Principality", prefix: "The Principality of" },
  { value: "holy", label: "Holy State", prefix: "The Holy" },
  { value: "union", label: "Union", prefix: "The Union of" },
  { value: "empire", label: "Empire", prefix: "The Empire of" },
  { value: "sultanate", label: "Sultanate", prefix: "The Sultanate of" },
  { value: "duchy", label: "Duchy", prefix: "The Duchy of" },
  { value: "confederacy", label: "Confederacy", prefix: "The Confederacy of" },
  { value: "alliance", label: "Alliance", prefix: "The Alliance of" },
  { value: "coalition", label: "Coalition", prefix: "The Coalition of" },
  { value: "dominion", label: "Dominion", prefix: "The Dominion of" },
  { value: "territories", label: "Territories", prefix: "The Territories of" },
  { value: "protectorate", label: "Protectorate", prefix: "The Protectorate of" },
  { value: "mandate", label: "Mandate", prefix: "The Mandate of" },
  { value: "city-state", label: "City-State", prefix: "The City-State of" },
  { value: "free-state", label: "Free State", prefix: "The Free State of" },
  { value: "socialist-republic", label: "Socialist Republic", prefix: "The Socialist Republic of" },
  {
    value: "democratic-republic",
    label: "Democratic Republic",
    prefix: "The Democratic Republic of",
  },
  { value: "people-republic", label: "People's Republic", prefix: "The People's Republic of" },
  { value: "autonomous-region", label: "Autonomous Region", prefix: "The Autonomous Region of" },
  { value: "sovereign-state", label: "Sovereign State", prefix: "The Sovereign State of" },
  { value: "nation", label: "Nation", prefix: "The Nation of" },
  { value: "country", label: "Country", prefix: "The Country of" },
  { value: "state", label: "State", prefix: "The State of" },
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
    isEditingCustomName,
    onGovernmentTypeChange,
    onCustomOfficialNameChange,
    onCustomOfficialNameFocus,
    onCustomOfficialNameBlur,
    setShouldFetchCustomTypes,
    customGovernmentTypes,
    onFieldSave,

    // Symbols props
    flagUrl,
    coatOfArmsUrl,
    foundationCountry,
    onSelectFlag,
    onSelectCoatOfArms,
    onFlagUrlChange,
    onCoatOfArmsUrlChange,
    onColorsExtracted,

    // Core Indicator Props
    inputs,
    onInputsChange,
    referenceCountry,
    showAdvanced = false,
    mode = "create",
    fieldLocks,
  }: BasicInfoFormProps) {
    // Fetch custom government types on mount
    React.useEffect(() => {
      setShouldFetchCustomTypes(true);
    }, [setShouldFetchCustomTypes]);

    // Map government types for GlassSelectBox
    const govtOptions = React.useMemo(() => {
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

    // Memoize input change handlers with empty deps since parent callback is stable
    const handleCountryNameChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        onIdentityChange("countryName", event.target.value);
      },
      [] // Empty - parent onIdentityChange is stable via refs
    );

    const handleOfficialNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      onIdentityChange("officialName", event.target.value);
    }, []);

    const [isLargestLocked, setIsLargestLocked] = React.useState(() => {
      return identity.capitalCity === identity.largestCity && !!identity.capitalCity;
    });

    const toggleLargestLock = useCallback(() => {
      const next = !isLargestLocked;
      setIsLargestLocked(next);
      if (next) {
        onIdentityChange("largestCity", identity.capitalCity || "");
        if (identity.capitalCity && onFieldSave) {
          onFieldSave("largestCity", identity.capitalCity);
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

    const handleDemonymChange = useCallback((value: string) => {
      onIdentityChange("demonym", value);
    }, []);

    // ─── Core Indicators Logic ───
    const isEditMode = mode === "edit";
    const locks = fieldLocks || (isEditMode ? EDIT_MODE_FIELD_LOCKS : {});

    // Safe defaults
    const safeInputs = inputs || {
      coreIndicators: {
        totalPopulation: 10000000,
        nominalGDP: 250000000000,
        gdpPerCapita: 25000,
        realGDPGrowthRate: 3.0,
        inflationRate: 2.0,
        currencyExchangeRate: 1.0,
      },
    };

    const coreIndicators = safeInputs.coreIndicators || {
      totalPopulation: 10000000,
      nominalGDP: 250000000000,
      gdpPerCapita: 25000,
      realGDPGrowthRate: 3.0,
      inflationRate: 2.0,
      currencyExchangeRate: 1.0,
    };

    const sanitizeNumber = (value: any, defaultValue: number): number => {
      const numValue = Number(value);
      return !isNaN(numValue) && isFinite(numValue) ? numValue : defaultValue;
    };

    const sanitizedCoreIndicators = {
      totalPopulation: sanitizeNumber(coreIndicators.totalPopulation, 10000000),
      nominalGDP: sanitizeNumber(coreIndicators.nominalGDP, 250000000000),
      gdpPerCapita: sanitizeNumber(coreIndicators.gdpPerCapita, 25000),
      realGDPGrowthRate: sanitizeNumber(coreIndicators.realGDPGrowthRate, 3.0),
      inflationRate: sanitizeNumber(coreIndicators.inflationRate, 2.0),
      currencyExchangeRate: sanitizeNumber(coreIndicators.currencyExchangeRate, 1.0),
    };

    const economicTier = getEconomicTier(sanitizedCoreIndicators.gdpPerCapita);
    const populationTier = getPopulationTierFromPopulation(sanitizedCoreIndicators.totalPopulation);

    const defaultTaxRate = referenceCountry?.taxRevenuePercent || 20;
    const [isTaxCustom, setIsTaxCustom] = React.useState(
      () => {
        const currentTax = inputs.fiscalSystem?.taxRevenueGDPPercent;
        return currentTax !== undefined && Math.abs(currentTax - defaultTaxRate) > 0.01;
      }
    );

    React.useEffect(() => {
      const currentTax = inputs.fiscalSystem?.taxRevenueGDPPercent;
      const isCustom = currentTax !== undefined && Math.abs(currentTax - defaultTaxRate) > 0.01;
      setIsTaxCustom(isCustom);
    }, [inputs.fiscalSystem?.taxRevenueGDPPercent, defaultTaxRate]);

    const calculateExpectedGrowthRate = (gdpPerCapita: number, population: number): number => {
      const incomeFactor = Math.max(0.5, Math.min(8, 8 - gdpPerCapita / 10000));
      const sizeFactor =
        population >= 100000000
          ? 0.8
          : population >= 10000000
            ? 0.9
            : population >= 1000000
              ? 1.0
              : 1.1;
      return Math.round(incomeFactor * sizeFactor * 10) / 10;
    };

    const expectedGrowthRate = calculateExpectedGrowthRate(
      sanitizedCoreIndicators.gdpPerCapita,
      sanitizedCoreIndicators.totalPopulation
    );

    const formatCurrency = (value: number | string) => {
      const numValue = Number(value);
      if (numValue >= 1e12) return `$${(numValue / 1e12).toFixed(1)}T`;
      if (numValue >= 1e9) return `$${(numValue / 1e9).toFixed(1)}B`;
      if (numValue >= 1e6) return `$${(numValue / 1e6).toFixed(1)}M`;
      if (numValue >= 1e3) return `$${(numValue / 1e3).toFixed(1)}K`;
      return `$${numValue.toLocaleString()}`;
    };

    const computedGDP =
      sanitizedCoreIndicators.totalPopulation * sanitizedCoreIndicators.gdpPerCapita;

    return (
      <div className="space-y-6">
        {/* Symbols Uploader card merged here */}
        <div className="-mt-4">
          <CountrySymbolsUploader
            flagUrl={flagUrl}
            coatOfArmsUrl={coatOfArmsUrl}
            foundationCountry={foundationCountry}
            onSelectFlag={onSelectFlag}
            onSelectCoatOfArms={onSelectCoatOfArms}
            onFlagUrlChange={onFlagUrlChange}
            onCoatOfArmsUrlChange={onCoatOfArmsUrlChange}
            onColorsExtracted={onColorsExtracted}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 text-left lg:grid-cols-2">
          {/* Administrative Profile Card */}
          <GlassCard
            depth="base"
            theme="gold"
            className="border-amber-500/20"
            texture="chevron"
            textureOpacity={0.06}
          >
            <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
              <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                <Crown className="h-5 w-5 text-amber-400" />
                Administrative Profile
              </h3>
            </div>
            <GlassCardContent className="space-y-4 p-6">
              {/* 1. Official Name */}
              <div className="space-y-2">
                <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                  <Crown className="text-muted-foreground h-4 w-4" />
                  Official Name
                </label>
                <p className="text-muted-foreground text-[11px] leading-tight">
                  Full ceremonial name of the country
                </p>
                <Input
                  value={identity.officialName ?? ""}
                  onChange={handleOfficialNameChange}
                  placeholder="The Republic of..."
                />
              </div>

              {/* 2. Country Name */}
              <div className="space-y-2">
                <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                  <Globe className="text-muted-foreground h-4 w-4" />
                  Country Name
                </label>
                <p className="text-muted-foreground text-[11px] leading-tight">
                  Short form name of the country
                </p>
                <Input
                  value={identity.countryName ?? ""}
                  onChange={handleCountryNameChange}
                  placeholder="Enter country name"
                />
              </div>

              {/* 3. Government Type */}
              <div className="space-y-2">
                <GlassSelectBox
                  label="Government Type"
                  icon={Crown}
                  value={selectedGovernmentType}
                  onChange={onGovernmentTypeChange}
                  options={govtOptions}
                  placeholder="Select government type"
                  sectionId="symbols"
                  theme="default"
                  size="sm"
                />
                {selectedGovernmentType === "custom" && (
                  <div className="pt-1">
                    <Input
                      value={customOfficialName}
                      onFocus={onCustomOfficialNameFocus}
                      onChange={(e) => onCustomOfficialNameChange(e.target.value)}
                      onBlur={(e) => onCustomOfficialNameBlur(e.target.value)}
                      placeholder="Enter custom official name..."
                    />
                  </div>
                )}
              </div>

              {/* Government Structure Fields (hidden in edit mode - rendered in its own card) */}
              {!isEditMode && (
                <div className="border-border/10 my-4 space-y-4 border-t pt-4">
                  <div className="text-foreground text-[10px] font-black tracking-wider text-zinc-400 uppercase">
                    Government Structure
                  </div>
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
                    onChange={(structure) => {
                      onGovernmentStructureChange({
                        ...governmentStructure,
                        structure,
                      });
                    }}
                    isReadOnly={false}
                    gdpData={{
                      nominalGDP: inputs.coreIndicators?.nominalGDP || 0,
                      countryName: identity.countryName,
                    }}
                    hideBudgetConfig={true}
                    noWrapper={true}
                    hideGovernmentType={true}
                  />
                </div>
              )}

              {/* Divider and Civic Standards */}
              <div className="border-border/10 my-4 border-t pt-4" />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <IdentityAutocomplete
                  fieldName="capitalCity"
                  value={String(identity.capitalCity || "")}
                  onChange={handleCapitalCityChange}
                  placeholder="Capital city name"
                  icon={Building}
                  onSave={handleCapitalCitySave}
                  extraLabelElement={
                    <button
                      type="button"
                      onClick={toggleLargestLock}
                      className={cn(
                        "flex items-center gap-1 text-[10px] font-semibold transition-all duration-150 focus:outline-none",
                        isLargestLocked
                          ? "text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title={
                        isLargestLocked
                          ? "Unlock Largest City to set a different value"
                          : "Set Largest City to match Capital City"
                      }
                    >
                      {isLargestLocked ? (
                        <>
                          <Link2 className="h-3 w-3" />
                          <span>Linked as Largest</span>
                        </>
                      ) : (
                        <>
                          <Link2Off className="text-muted-foreground/60 h-3 w-3" />
                          <span>Link Largest</span>
                        </>
                      )}
                    </button>
                  }
                />

                <IdentityAutocomplete
                  fieldName="largestCity"
                  value={
                    isLargestLocked
                      ? String(identity.capitalCity || "")
                      : String(identity.largestCity || "")
                  }
                  onChange={handleLargestCityChange}
                  placeholder={isLargestLocked ? "Same as Capital City" : "Largest city name"}
                  icon={MapPin}
                  onSave={onFieldSave}
                  disabled={isLargestLocked}
                />
              </div>

              <IdentityAutocomplete
                fieldName="demonym"
                value={String(identity.demonym || "")}
                onChange={handleDemonymChange}
                placeholder="Demonym (e.g., American, French)"
                icon={Users}
                onSave={onFieldSave}
              />
            </GlassCardContent>
          </GlassCard>

          {isEditMode ? (
            /* Edit Mode: Government Structure card replaces Core Indicators */
            <GlassCard
              depth="base"
              theme="indigo"
              className="border-indigo-500/20"
              texture="chevron"
              textureOpacity={0.06}
            >
              <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                  <Crown className="h-5 w-5 text-indigo-400" />
                  Government Structure
                </h3>
              </div>
              <GlassCardContent className="space-y-4 p-6">
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
                  onChange={(structure) => {
                    onGovernmentStructureChange({
                      ...governmentStructure,
                      structure,
                    });
                  }}
                  isReadOnly={false}
                  gdpData={{
                    nominalGDP: inputs.coreIndicators?.nominalGDP || 0,
                    countryName: identity.countryName,
                  }}
                  hideBudgetConfig={true}
                  noWrapper={true}
                  hideGovernmentType={true}
                />
              </GlassCardContent>
            </GlassCard>
          ) : (
            /* Create Mode: Core Indicators (unchanged) */
            <GlassCard
              depth="base"
              theme="emerald"
              className="border-emerald-500/20"
              texture="chevron"
              textureOpacity={0.06}
            >
              <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
                <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                  <BarChart3 className="h-5 w-5 text-emerald-400" />
                  Core Indicators
                </h3>
              </div>
              <GlassCardContent className="space-y-4 p-6">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                      <Users className="text-muted-foreground h-4 w-4" />
                      Starting Population
                    </label>
                    <p className="text-muted-foreground text-[11px] leading-tight">
                      Set the initial population of your country. This is before any
                      modifications from events, policies, or other factors.
                    </p>
                    <SliderWithDirectInput
                      label=""
                      value={sanitizedCoreIndicators.totalPopulation}
                      onChange={(value) => {
                        const population = sanitizeNumber(
                          value,
                          sanitizedCoreIndicators.totalPopulation
                        );
                        const clamped = Math.max(100000, Math.min(200000000, population));
                        onInputsChange({
                          ...safeInputs,
                          coreIndicators: {
                            ...coreIndicators,
                            totalPopulation: clamped,
                            nominalGDP: clamped * sanitizedCoreIndicators.gdpPerCapita,
                          },
                        });
                      }}
                      min={100000}
                      max={150000000}
                      step={100000}
                      unit=" citizens"
                      precision={0}
                      sectionId="core"
                      showValue={true}
                      defaultMode="slider"
                      allowModeToggle={true}
                    />
                    <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
                      <span>Min: 100K</span>
                      <span>
                        Selected: {sanitizedCoreIndicators.totalPopulation.toLocaleString()}
                      </span>
                      <span>Max: 150M</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                      <DollarSign className="text-muted-foreground h-4 w-4" />
                       GDP per Capita
                    </label>
                    <p className="text-muted-foreground text-[11px] leading-tight">
                      Average economic production per citizen. This is before any
                      modifications from events, policies, or other factors.
                    </p>
                    <SliderWithDirectInput
                      label=""
                      value={sanitizedCoreIndicators.gdpPerCapita}
                      onChange={(value) => {
                        const gdpPerCapita = sanitizeNumber(
                          value,
                          sanitizedCoreIndicators.gdpPerCapita
                        );
                        const clamped = Math.max(1000, Math.min(100000, gdpPerCapita));
                        onInputsChange({
                          ...safeInputs,
                          coreIndicators: {
                            ...coreIndicators,
                            gdpPerCapita: clamped,
                            nominalGDP: sanitizedCoreIndicators.totalPopulation * clamped,
                          },
                        });
                      }}
                      min={1000}
                      max={100000}
                      step={500}
                      unit=" USD"
                      sectionId="core"
                      showValue={true}
                      defaultMode="slider"
                      allowModeToggle={true}
                    />
                    <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
                      <span>Min: $1,000</span>
                      <span>Expected Tier: {economicTier}</span>
                      <span>Max: $100,000</span>
                    </div>
                  </div>

                  {/* Tax Revenue Opt-In / Slider */}
                  <div className="space-y-4 border-t border-border/20 pt-4">
                    <div className="flex items-center justify-between">
                      <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                        <Percent className="text-muted-foreground h-4 w-4" />
                         Tax Revenue
                      </label>
                      <Switch
                        checked={isTaxCustom}
                        onCheckedChange={(checked) => {
                          setIsTaxCustom(checked);
                          if (!checked) {
                            onInputsChange({
                              ...safeInputs,
                              fiscalSystem: {
                                ...(safeInputs.fiscalSystem || {}),
                                taxRevenueGDPPercent: defaultTaxRate,
                                governmentRevenueTotal: (sanitizedCoreIndicators.totalPopulation * sanitizedCoreIndicators.gdpPerCapita * defaultTaxRate) / 100,
                                taxRevenuePerCapita: (sanitizedCoreIndicators.gdpPerCapita * defaultTaxRate) / 100,
                              },
                            });
                          }
                        }}
                      />
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-tight">
                      Toggle to customize the target tax revenue projection for your nation.
                    </p>

                    {isTaxCustom ? (
                      <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <SliderWithDirectInput
                          label=""
                          value={inputs.fiscalSystem?.taxRevenueGDPPercent ?? 20}
                          onChange={(value) => {
                            const taxRate = sanitizeNumber(
                              value,
                              inputs.fiscalSystem?.taxRevenueGDPPercent ?? 20
                            );
                            const clamped = Math.max(5, Math.min(50, taxRate));
                            onInputsChange({
                              ...safeInputs,
                              fiscalSystem: {
                                ...(safeInputs.fiscalSystem || {}),
                                taxRevenueGDPPercent: clamped,
                                governmentRevenueTotal: (sanitizedCoreIndicators.totalPopulation * sanitizedCoreIndicators.gdpPerCapita * clamped) / 100,
                                taxRevenuePerCapita: (sanitizedCoreIndicators.gdpPerCapita * clamped) / 100,
                              },
                            });
                          }}
                          min={5}
                          max={50}
                          step={0.5}
                          unit="%"
                          sectionId="core"
                          showValue={true}
                          defaultMode="slider"
                          allowModeToggle={true}
                        />
                        <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
                          <span>Min: 5%</span>
                          <span>Selected: {(inputs.fiscalSystem?.taxRevenueGDPPercent ?? 20).toFixed(1)}%</span>
                          <span>Max: 50%</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-500 italic mt-1">
                        Using default flat tax revenue projection of {defaultTaxRate.toFixed(1)}% of GDP.
                      </p>
                    )}
                  </div>

                  {/* Emergent Outcomes */}
                  <div className="space-y-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h5 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                          Total GDP
                        </h5>
                        <div className="mt-1 text-xl font-black text-amber-400">
                          <NumberFlowDisplay
                            value={computedGDP}
                            format="currency"
                            decimalPlaces={0}
                          />
                        </div>
                        <p className="text-muted-foreground mt-0.5 text-[9px] leading-tight">
                          Population × GDP per Capita
                        </p>
                      </div>

                      <div>
                        <h5 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                          Tax Revenue
                        </h5>
                        <div className="mt-1 text-xl font-black text-emerald-400">
                          <NumberFlowDisplay
                            value={computedGDP * ((inputs.fiscalSystem?.taxRevenueGDPPercent ?? 20) / 100)}
                            format="currency"
                            decimalPlaces={0}
                          />
                        </div>
                        <p className="text-muted-foreground mt-0.5 text-[9px] leading-tight">
                          {(inputs.fiscalSystem?.taxRevenueGDPPercent ?? 20).toFixed(1)}% of GDP
                        </p>
                      </div>
                    </div>

                    <div className="border-border/20 border-t pt-3 flex flex-wrap gap-x-6 gap-y-3">
                      <div>
                        <h5 className="text-muted-foreground mb-1.5 text-[10px] font-bold tracking-wider uppercase">
                          Economic Classification
                        </h5>
                        <Badge
                          variant="secondary"
                          className="border-yellow-400/50 bg-yellow-500/20 px-2.5 py-0.5 text-xs font-semibold text-yellow-800 dark:text-yellow-200"
                        >
                          {economicTier}
                        </Badge>
                      </div>
                      <div>
                        <h5 className="text-muted-foreground mb-1.5 text-[10px] font-bold tracking-wider uppercase">
                          Population Tier
                        </h5>
                        <Badge
                          variant="secondary"
                          className="border-blue-400/50 bg-blue-500/20 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:text-blue-200"
                        >
                          Tier {populationTier}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCardContent>
            </GlassCard>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison to prevent re-renders
    // Only re-render if the actual identity values or symbols or core indicators we display have changed
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
