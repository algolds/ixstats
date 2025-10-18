"use client";

import { useState, useEffect } from 'react';
import { api } from '~/trpc/react';
import { useBuilderTheming } from '~/hooks/useBuilderTheming';
import { useCountryFlagRouteAware } from '~/hooks/useCountryFlagRouteAware';
import { wikiCommonsFlagService } from '~/lib/wiki-commons-flag-service';
import type { EconomicInputs, RealCountryData } from '~/app/builder/lib/economy-data-service';

export function useNationalIdentityState(
  inputs: EconomicInputs,
  onInputsChange: (inputs: EconomicInputs) => void,
  referenceCountry: RealCountryData | null | undefined
) {
  // State management
  const [showFlagImageModal, setShowFlagImageModal] = useState(false);
  const [showCoatOfArmsImageModal, setShowCoatOfArmsImageModal] = useState(false);
  const [selectedGovernmentType, setSelectedGovernmentType] = useState('republic');
  const [customOfficialName, setCustomOfficialName] = useState('');
  const [isEditingCustomName, setIsEditingCustomName] = useState(false);
  const [shouldFetchCustomTypes, setShouldFetchCustomTypes] = useState(false);
  const [foundationCoatOfArmsUrl, setFoundationCoatOfArmsUrl] = useState<string | undefined>(undefined);

  // Collapsible section state
  const [isSymbolsOpen, setIsSymbolsOpen] = useState(true);
  const [isBasicInfoOpen, setIsBasicInfoOpen] = useState(true);
  const [isCultureOpen, setIsCultureOpen] = useState(true);
  const [isGeographyOpen, setIsGeographyOpen] = useState(true);

  // Foundation country data
  const foundationCountryName = getFoundationCountryName(referenceCountry);
  const { flag } = useCountryFlagRouteAware(foundationCountryName || '');
  const { handleColorsExtracted } = useBuilderTheming(foundationCountryName || '');

  // API queries
  const { data: customGovernmentTypes } = api.customTypes.getUserCustomGovernmentTypes.useQuery(
    undefined,
    { enabled: shouldFetchCustomTypes }
  );
  const upsertCustomGovernmentType = api.customTypes.upsertCustomGovernmentType.useMutation();
  const upsertFieldValue = api.customTypes.upsertFieldValue.useMutation();

  // Initialize identity data
  const identity = inputs.nationalIdentity || {
    countryName: String(inputs.countryName || ''),
    officialName: '',
    governmentType: 'republic',
    motto: '',
    mottoNative: '',
    capitalCity: '',
    largestCity: '',
    demonym: '',
    currency: '',
    currencySymbol: '$',
    officialLanguages: '',
    nationalLanguage: '',
    nationalAnthem: '',
    nationalReligion: '',
    nationalDay: '',
    callingCode: '',
    internetTLD: '',
    drivingSide: 'right',
    timeZone: '',
    isoCode: '',
    coordinatesLatitude: '',
    coordinatesLongitude: '',
    emergencyNumber: '',
    postalCodeFormat: '',
    nationalSport: '',
    weekStartDay: 'monday'
  };

  // Sync local state with loaded identity data
  useEffect(() => {
    if (inputs.nationalIdentity?.governmentType) {
      setSelectedGovernmentType(inputs.nationalIdentity.governmentType);
    }
    if (inputs.nationalIdentity?.officialName && !isEditingCustomName) {
      setCustomOfficialName(inputs.nationalIdentity.officialName);
    }
  }, [inputs.nationalIdentity, isEditingCustomName]);

  // Fetch coat of arms from foundation country
  useEffect(() => {
    const fetchCoatOfArms = async () => {
      if (foundationCountryName) {
        try {
          const coatOfArmsResult = await wikiCommonsFlagService.getCoatOfArmsUrl(foundationCountryName);
          if (coatOfArmsResult) setFoundationCoatOfArmsUrl(coatOfArmsResult);
        } catch (error) {
          console.error('Error fetching coat of arms:', error);
        }
      }
    };
    fetchCoatOfArms();
  }, [foundationCountryName]);

  // Auto-fill flag and coat of arms from foundation country
  useEffect(() => {
    if (flag?.flagUrl && !inputs.flagUrl) {
      handleFlagUrlChange(flag.flagUrl);
    }
    if (foundationCoatOfArmsUrl && !inputs.coatOfArmsUrl) {
      handleCoatOfArmsUrlChange(foundationCoatOfArmsUrl);
    }
  }, [flag?.flagUrl, foundationCoatOfArmsUrl, inputs.flagUrl, inputs.coatOfArmsUrl]);

  // Event handlers
  const handleIdentityChange = (field: string | number | symbol, value: any) => {
    const newIdentity = { ...identity, [field]: value };

    if (field === 'countryName' && value && !newIdentity.demonym) {
      let demonym = value.toString();
      if (demonym.endsWith('a')) demonym += 'n';
      else if (demonym.endsWith('y')) demonym = demonym.slice(0, -1) + 'ian';
      else demonym += 'ian';
      newIdentity.demonym = demonym;
    }

    onInputsChange({
      ...inputs,
      nationalIdentity: newIdentity,
      countryName: field === 'countryName' ? value : inputs.countryName
    });
  };

  const handleFlagUrlChange = (url: string) => {
    onInputsChange({ ...inputs, flagUrl: url, coatOfArmsUrl: inputs.coatOfArmsUrl ?? '' });
  };

  const handleCoatOfArmsUrlChange = (url: string) => {
    onInputsChange({ ...inputs, flagUrl: inputs.flagUrl ?? '', coatOfArmsUrl: url });
  };

  const handleFieldValueSave = (fieldName: string, value: string) => {
    upsertFieldValue.mutate({ fieldName, value });
  };

  return {
    // State
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
    // Data
    foundationCountryName,
    flag,
    handleColorsExtracted,
    customGovernmentTypes,
    upsertCustomGovernmentType,
    identity,
    // Handlers
    handleIdentityChange,
    handleFlagUrlChange,
    handleCoatOfArmsUrlChange,
    handleFieldValueSave,
  };
}

function getFoundationCountryName(referenceCountry: RealCountryData | null | undefined): string | null {
  if (!referenceCountry) return null;
  if (referenceCountry.foundationCountryName) return referenceCountry.foundationCountryName;
  const name = referenceCountry.name;
  return name.startsWith('New ') ? name.substring(4) : name;
}
