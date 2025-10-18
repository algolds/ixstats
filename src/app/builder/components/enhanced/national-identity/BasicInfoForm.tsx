"use client";

import React from 'react';
import { Globe, Crown, Building, MapPin, Users, Coins } from 'lucide-react';
import { EnhancedNumberInput, CurrencySymbolPicker } from '../../../primitives/enhanced';
import { Autocomplete } from '~/components/ui/autocomplete';
import type { NationalIdentityData } from '~/app/builder/lib/economy-data-service';

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
  IdentityAutocomplete: React.ComponentType<any>;
}

const GOVERNMENT_TYPES = [
  { value: 'republic', label: 'Republic', prefix: 'The Republic of' },
  { value: 'kingdom', label: 'Kingdom', prefix: 'The Kingdom of' },
  { value: 'federation', label: 'Federation', prefix: 'The Federation of' },
  { value: 'commonwealth', label: 'Commonwealth', prefix: 'The Commonwealth of' },
  { value: 'emirate', label: 'Emirate', prefix: 'The Emirate of' },
  { value: 'principality', label: 'Principality', prefix: 'The Principality of' },
  { value: 'holy', label: 'Holy State', prefix: 'The Holy' },
  { value: 'union', label: 'Union', prefix: 'The Union of' },
  { value: 'empire', label: 'Empire', prefix: 'The Empire of' },
  { value: 'sultanate', label: 'Sultanate', prefix: 'The Sultanate of' },
  { value: 'duchy', label: 'Duchy', prefix: 'The Duchy of' },
  { value: 'confederacy', label: 'Confederacy', prefix: 'The Confederacy of' },
  { value: 'alliance', label: 'Alliance', prefix: 'The Alliance of' },
  { value: 'coalition', label: 'Coalition', prefix: 'The Coalition of' },
  { value: 'dominion', label: 'Dominion', prefix: 'The Dominion of' },
  { value: 'territories', label: 'Territories', prefix: 'The Territories of' },
  { value: 'protectorate', label: 'Protectorate', prefix: 'The Protectorate of' },
  { value: 'mandate', label: 'Mandate', prefix: 'The Mandate of' },
  { value: 'city-state', label: 'City-State', prefix: 'The City-State of' },
  { value: 'free-state', label: 'Free State', prefix: 'The Free State of' },
  { value: 'socialist-republic', label: 'Socialist Republic', prefix: 'The Socialist Republic of' },
  { value: 'democratic-republic', label: 'Democratic Republic', prefix: 'The Democratic Republic of' },
  { value: 'people-republic', label: 'People\'s Republic', prefix: 'The People\'s Republic of' },
  { value: 'autonomous-region', label: 'Autonomous Region', prefix: 'The Autonomous Region of' },
  { value: 'sovereign-state', label: 'Sovereign State', prefix: 'The Sovereign State of' },
  { value: 'nation', label: 'Nation', prefix: 'The Nation of' },
  { value: 'country', label: 'Country', prefix: 'The Country of' },
  { value: 'state', label: 'State', prefix: 'The State of' },
  { value: 'custom', label: 'Custom', prefix: '' }
];

export function BasicInfoForm({
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
  IdentityAutocomplete,
}: BasicInfoFormProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <EnhancedNumberInput
        label="Country Name"
        value={String(identity.countryName || '')}
        onChange={(value) => onIdentityChange('countryName', String(value))}
        sectionId="symbols"
        icon={Globe}
        showButtons={false}
        placeholder="Enter country name"
        acceptText={true}
      />

      {/* Government Type Selector - inline to prevent remounting */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Crown className="h-4 w-4" />
          Government Type
        </label>
        <select
          value={selectedGovernmentType}
          onChange={(e) => onGovernmentTypeChange(e.target.value)}
          onFocus={() => setShouldFetchCustomTypes(true)}
          className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200 hover:bg-accent/5"
        >
          {GOVERNMENT_TYPES.map(type => (
            <option
              key={type.value}
              value={type.value}
              className="bg-background text-foreground"
            >
              {type.label}
            </option>
          ))}
          {customGovernmentTypes && customGovernmentTypes.length > 0 && (
            <optgroup label="Custom">
              {customGovernmentTypes.map(type => (
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
        {selectedGovernmentType === 'custom' && (
          <input
            type="text"
            value={customOfficialName}
            onFocus={onCustomOfficialNameFocus}
            onChange={(e) => onCustomOfficialNameChange(e.target.value)}
            onBlur={(e) => onCustomOfficialNameBlur(e.target.value)}
            placeholder="Enter custom official name..."
            className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200"
          />
        )}
      </div>

      <div className="lg:col-span-2">
        <EnhancedNumberInput
          label="Official Name"
          description="Full ceremonial name of the country"
          value={String(identity.officialName || '')}
          onChange={(value) => onIdentityChange('officialName', String(value))}
          sectionId="symbols"
          icon={Crown}
          showButtons={false}
          placeholder="The Republic of..."
          acceptText={true}
        />
      </div>

      <IdentityAutocomplete
        fieldName="capitalCity"
        value={String(identity.capitalCity || '')}
        onChange={(value: string) => onIdentityChange('capitalCity', value)}
        placeholder="Capital city name"
        icon={Building}
      />

      <IdentityAutocomplete
        fieldName="largestCity"
        value={String(identity.largestCity || '')}
        onChange={(value: string) => onIdentityChange('largestCity', value)}
        placeholder="Largest city name"
        icon={MapPin}
      />

      <IdentityAutocomplete
        fieldName="demonym"
        value={String(identity.demonym || '')}
        onChange={(value: string) => onIdentityChange('demonym', value)}
        placeholder="Demonym (e.g., American, French)"
        icon={Users}
      />

      <div className="space-y-4">
        <IdentityAutocomplete
          fieldName="currency"
          value={String(identity.currency || '')}
          onChange={(value: string) => onIdentityChange('currency', value)}
          placeholder="Dollar, Euro, etc."
          icon={Coins}
        />
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Coins className="h-4 w-4" />
            Currency Symbol
          </label>
          <CurrencySymbolPicker
            value={identity.currencySymbol || '$'}
            onSymbolSelect={(symbol) => onIdentityChange('currencySymbol', symbol)}
            sectionId="symbols"
          />
        </div>
      </div>
    </div>
  );
}
