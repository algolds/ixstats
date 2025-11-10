"use client";

import React, { useCallback } from "react";
import { Globe, Crown, Building, MapPin, Users, Coins } from "lucide-react";
import { CurrencySymbolPicker } from "../../../primitives/enhanced";
import { Input } from "~/components/ui/input";
import { Autocomplete } from "~/components/ui/autocomplete";
import { CurrencyAutocomplete } from "./CurrencyAutocomplete";
import { IdentityAutocomplete } from "./IdentityAutocomplete";
import type { NationalIdentityData } from "~/app/builder/lib/economy-data-service";

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

export const BasicInfoForm = React.memo(function BasicInfoForm({
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
}: BasicInfoFormProps) {
  // Memoize input change handlers with empty deps since parent callback is stable
  const handleCountryNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onIdentityChange("countryName", event.target.value);
    },
    [] // Empty - parent onIdentityChange is stable via refs
  );

  const handleOfficialNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onIdentityChange("officialName", event.target.value);
    },
    []
  );

  const handleCapitalCityChange = useCallback(
    (value: string) => {
      onIdentityChange("capitalCity", value);
    },
    []
  );

  const handleLargestCityChange = useCallback(
    (value: string) => {
      onIdentityChange("largestCity", value);
    },
    []
  );

  const handleDemonymChange = useCallback(
    (value: string) => {
      onIdentityChange("demonym", value);
    },
    []
  );

  const handleCurrencyChange = useCallback(
    (value: string) => {
      onIdentityChange("currency", value);
    },
    []
  );

  const handleCurrencySymbolChange = useCallback(
    (symbol: string) => {
      onIdentityChange("currencySymbol", symbol);
    },
    []
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
      <div className="space-y-2">
        <label className="text-foreground flex items-center gap-2 text-sm font-medium">
          <Globe className="h-4 w-4" />
          Country Name
        </label>
        <Input
          value={identity.countryName ?? ""}
          onChange={handleCountryNameChange}
          placeholder="Enter country name"
        />
      </div>

      {/* Government Type Selector - inline to prevent remounting */}
      <div className="space-y-2">
        <label className="text-foreground flex items-center gap-2 text-sm font-medium">
          <Crown className="h-4 w-4" />
          Government Type
        </label>
        <select
          value={selectedGovernmentType}
          onChange={(e) => onGovernmentTypeChange(e.target.value)}
          onFocus={() => setShouldFetchCustomTypes(true)}
          className="border-input bg-background text-foreground focus:border-ring focus:ring-ring hover:bg-accent/5 w-full rounded-lg border px-4 py-3 transition-all duration-200 focus:ring-2 focus:outline-none"
        >
          {GOVERNMENT_TYPES.map((type) => (
            <option key={type.value} value={type.value} className="bg-background text-foreground">
              {type.label}
            </option>
          ))}
          {customGovernmentTypes && customGovernmentTypes.length > 0 && (
            <optgroup label="Custom">
              {customGovernmentTypes.map((type) => (
                <option
                  key={type.id}
                  value={type.customTypeName}
                  className="bg-background text-foreground"
                >
                  {type.customTypeName}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {selectedGovernmentType === "custom" && (
          <input
            type="text"
            value={customOfficialName}
            onFocus={onCustomOfficialNameFocus}
            onChange={(e) => onCustomOfficialNameChange(e.target.value)}
            onBlur={(e) => onCustomOfficialNameBlur(e.target.value)}
            placeholder="Enter custom official name..."
            className="border-input bg-background text-foreground focus:border-ring focus:ring-ring w-full rounded-lg border px-4 py-3 transition-all duration-200 focus:ring-2 focus:outline-none"
          />
        )}
      </div>

      <div className="space-y-2 lg:col-span-2">
        <label className="text-foreground flex items-center gap-2 text-sm font-medium">
          <Crown className="h-4 w-4" />
          Official Name
        </label>
        <p className="text-muted-foreground text-xs">Full ceremonial name of the country</p>
        <Input
          value={identity.officialName ?? ""}
          onChange={handleOfficialNameChange}
          placeholder="The Republic of..."
        />
      </div>

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

      <IdentityAutocomplete
        fieldName="demonym"
        value={String(identity.demonym || "")}
        onChange={handleDemonymChange}
        placeholder="Demonym (e.g., American, French)"
        icon={Users}
        onSave={onFieldSave}
      />

      <div className="space-y-4">
        <CurrencyAutocomplete
          fieldName="currency"
          value={String(identity.currency || "")}
          onChange={handleCurrencyChange}
          placeholder="Select or enter currency"
        />
        <div className="space-y-2">
          <label className="text-foreground flex items-center gap-2 text-sm font-medium">
            <Coins className="h-4 w-4" />
            Currency Symbol
          </label>
          <CurrencySymbolPicker
            value={identity.currencySymbol || "$"}
            onSymbolSelect={handleCurrencySymbolChange}
            sectionId="symbols"
          />
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent re-renders
  // Only re-render if the actual identity values we display have changed
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
    prevProps.isEditingCustomName === nextProps.isEditingCustomName
  );
});
