"use client";

import React, { useCallback } from "react";
import { Globe, Crown, Building, MapPin, Users, Coins } from "lucide-react";
import { CurrencySymbolPicker, GlassSelectBox } from "../../../primitives/enhanced";
import { Input } from "~/components/ui/input";
import { GlassCard, GlassCardContent } from "../../glass/GlassCard";
import { CurrencyAutocomplete } from "./CurrencyAutocomplete";
import { IdentityAutocomplete } from "./IdentityAutocomplete";
import type { NationalIdentityData } from "~/app/builder/lib/economy-data-service";

import { CountrySymbolsUploader } from "../../CountrySymbolsUploader";

interface BasicInfoFormProps {
  identity: NationalIdentityData;
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

    const handleCapitalCityChange = useCallback((value: string) => {
      onIdentityChange("capitalCity", value);
    }, []);

    const handleLargestCityChange = useCallback((value: string) => {
      onIdentityChange("largestCity", value);
    }, []);

    const handleDemonymChange = useCallback((value: string) => {
      onIdentityChange("demonym", value);
    }, []);

    const handleCurrencyChange = useCallback((value: string) => {
      onIdentityChange("currency", value);
    }, []);

    const handleCurrencySymbolChange = useCallback((symbol: string) => {
      onIdentityChange("currencySymbol", symbol);
    }, []);

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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
              <div className="space-y-2">
                <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                  <Globe className="text-muted-foreground h-4 w-4" />
                  Country Name
                </label>
                <Input
                  value={identity.countryName ?? ""}
                  onChange={handleCountryNameChange}
                  placeholder="Enter country name"
                />
              </div>

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

              <div className="space-y-2">
                <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                  <Crown className="text-muted-foreground h-4 w-4" />
                  Official Name
                </label>
                <p className="text-muted-foreground text-xs">Full ceremonial name of the country</p>
                <Input
                  value={identity.officialName ?? ""}
                  onChange={handleOfficialNameChange}
                  placeholder="The Republic of..."
                />
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Civic & Financial Standards Card */}
          <GlassCard
            depth="base"
            theme="emerald"
            className="border-emerald-500/20"
            texture="chevron"
            textureOpacity={0.06}
          >
            <div className="border-border/40 border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
              <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
                <Coins className="h-5 w-5 text-emerald-400" />
                Civic & Financial Standards
              </h3>
            </div>
            <GlassCardContent className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <IdentityAutocomplete
                  fieldName="capitalCity"
                  value={String(identity.capitalCity || "")}
                  onChange={handleCapitalCityChange}
                  placeholder="Capital city name"
                  icon={Building}
                  onSave={onFieldSave}
                />

                <IdentityAutocomplete
                  fieldName="largestCity"
                  value={String(identity.largestCity || "")}
                  onChange={handleLargestCityChange}
                  placeholder="Largest city name"
                  icon={MapPin}
                  onSave={onFieldSave}
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

              <div className="border-border/20 grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
                <CurrencyAutocomplete
                  fieldName="currency"
                  value={String(identity.currency || "")}
                  onChange={handleCurrencyChange}
                  placeholder="Select or enter currency"
                />
                <div className="space-y-2">
                  <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                    <Coins className="text-muted-foreground h-4 w-4" />
                    Currency Symbol
                  </label>
                  <CurrencySymbolPicker
                    value={identity.currencySymbol || "$"}
                    onSymbolSelect={handleCurrencySymbolChange}
                    sectionId="symbols"
                  />
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison to prevent re-renders
    // Only re-render if the actual identity values or symbols we display have changed
    return (
      prevProps.identity.countryName === nextProps.identity.countryName &&
      prevProps.identity.officialName === nextProps.identity.officialName &&
      prevProps.identity.capitalCity === nextProps.identity.capitalCity &&
      prevProps.identity.largestCity === nextProps.identity.largestCity &&
      prevProps.identity.demonym === nextProps.identity.demonym &&
      prevProps.identity.currency === nextProps.identity.currency &&
      prevProps.identity.currencySymbol === nextProps.identity.currencySymbol &&
      prevProps.selectedGovernmentType === nextProps.selectedGovernmentType &&
      prevProps.customOfficialName === nextProps.customOfficialName &&
      prevProps.isEditingCustomName === nextProps.isEditingCustomName &&
      prevProps.flagUrl === nextProps.flagUrl &&
      prevProps.coatOfArmsUrl === nextProps.coatOfArmsUrl &&
      prevProps.foundationCountry?.name === nextProps.foundationCountry?.name &&
      prevProps.foundationCountry?.flagUrl === nextProps.foundationCountry?.flagUrl &&
      prevProps.foundationCountry?.coatOfArmsUrl === nextProps.foundationCountry?.coatOfArmsUrl
    );
  }
);
