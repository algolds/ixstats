"use client";

import React from 'react';
import { MediaSearchModal } from '~/components/MediaSearchModal';
import { Flag, Globe, Landmark, Heart, ChevronDown, ChevronUp, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible';
import type { EconomicInputs, RealCountryData } from '~/app/builder/lib/economy-data-service';
import {
  BasicInfoForm,
  SymbolsUpload,
  GeographyForm,
  CultureForm,
  IdentityAutocomplete
} from './national-identity';
import { useNationalIdentityState } from './national-identity/useNationalIdentityState';

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
  // Guard against null inputs
  if (!inputs) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading national identity data...</p>
        </div>
      </div>
    );
  }

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
    shouldFetchCustomTypes,
    setShouldFetchCustomTypes,
    foundationCoatOfArmsUrl,
    isSymbolsOpen,
    setIsSymbolsOpen,
    isBasicInfoOpen,
    setIsBasicInfoOpen,
    isCultureOpen,
    setIsCultureOpen,
    isGeographyOpen,
    setIsGeographyOpen,
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
          <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Pending</span>
        </div>
      );
    }
    
    return null;
  };

  return (
    <>
      <div className="space-y-8">
        {/* National Symbols */}
        <Collapsible open={isSymbolsOpen} onOpenChange={setIsSymbolsOpen}>
          <div className="rounded-lg border border-border bg-card">
            <CollapsibleTrigger className="w-full p-6 flex items-center justify-between hover:bg-accent/5 transition-colors">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Flag className="h-5 w-5" />
                National Symbols
              </h3>
              {isSymbolsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-6 pb-6">
              <SymbolsUpload
                flagUrl={inputs.flagUrl ?? ''}
                coatOfArmsUrl={inputs.coatOfArmsUrl ?? ''}
                foundationCountry={foundationCountryName ? {
                  name: foundationCountryName,
                  flagUrl: flag?.flagUrl ?? '',
                  coatOfArmsUrl: foundationCoatOfArmsUrl
                } : undefined}
                onSelectFlag={() => setShowFlagImageModal(true)}
                onSelectCoatOfArms={() => setShowCoatOfArmsImageModal(true)}
                onFlagUrlChange={handleFlagUrlChange}
                onCoatOfArmsUrlChange={handleCoatOfArmsUrlChange}
                onColorsExtracted={handleColorsExtracted}
              />
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Basic Identity Information */}
        <Collapsible open={isBasicInfoOpen} onOpenChange={setIsBasicInfoOpen}>
          <div className="rounded-lg border border-border bg-card">
            <CollapsibleTrigger className="w-full p-6 flex items-center justify-between hover:bg-accent/5 transition-colors">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Basic Identity Information
                </h3>
                {renderAutosaveStatus()}
              </div>
              {isBasicInfoOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="p-6">
              <BasicInfoForm
                identity={identity}
                onIdentityChange={handleIdentityChange as any}
                selectedGovernmentType={selectedGovernmentType}
                customOfficialName={customOfficialName}
                isEditingCustomName={isEditingCustomName}
                onGovernmentTypeChange={(value) => {
                  setSelectedGovernmentType(value);
                  handleIdentityChange('governmentType', value);
                }}
                onCustomOfficialNameChange={setCustomOfficialName}
                onCustomOfficialNameFocus={() => setIsEditingCustomName(true)}
                onCustomOfficialNameBlur={(value) => {
                  setIsEditingCustomName(false);
                  handleIdentityChange('officialName', value);
                  if (value.trim()) {
                    upsertCustomGovernmentType.mutate({ customTypeName: value.trim() });
                  }
                }}
                setShouldFetchCustomTypes={setShouldFetchCustomTypes}
                customGovernmentTypes={customGovernmentTypes}
                IdentityAutocomplete={(props) => (
                  <IdentityAutocomplete {...props} onSave={handleFieldValueSave} />
                )}
              />
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Culture & Language */}
        <Collapsible open={isCultureOpen} onOpenChange={setIsCultureOpen}>
          <div className="rounded-lg border border-border bg-card">
            <CollapsibleTrigger className="w-full p-6 flex items-center justify-between hover:bg-accent/5 transition-colors">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Culture & Language
                </h3>
                {renderAutosaveStatus()}
              </div>
              {isCultureOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="p-6">
              <CultureForm
                identity={identity}
                onIdentityChange={handleIdentityChange as any}
                IdentityAutocomplete={(props) => (
                  <IdentityAutocomplete {...props} onSave={handleFieldValueSave} />
                )}
              />
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Technical Details & Geography */}
        <Collapsible open={isGeographyOpen} onOpenChange={setIsGeographyOpen}>
          <div className="rounded-lg border border-border bg-card">
            <CollapsibleTrigger className="w-full p-6 flex items-center justify-between hover:bg-accent/5 transition-colors">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Landmark className="h-5 w-5" />
                  Technical Details & Geography
                </h3>
                {renderAutosaveStatus()}
              </div>
              {isGeographyOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="p-6">
              <GeographyForm
                identity={identity}
                onIdentityChange={handleIdentityChange as any}
              />
            </CollapsibleContent>
          </div>
        </Collapsible>
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