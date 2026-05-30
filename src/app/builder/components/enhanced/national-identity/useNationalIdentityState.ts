"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { api } from "~/trpc/react";
import { useBuilderTheming } from "~/hooks/useBuilderTheming";
import { useCountryFlagRouteAware } from "~/hooks/useCountryFlagRouteAware";
import { useNationalIdentityAutoSync } from "~/hooks/useNationalIdentityAutoSync";
import type {
  EconomicInputs,
  RealCountryData,
  NationalIdentityData,
} from "~/app/builder/lib/economy-data-service";

export function useNationalIdentityState(
  inputs: EconomicInputs,
  onInputsChange: (inputs: EconomicInputs) => void,
  referenceCountry: RealCountryData | null | undefined,
  countryId?: string
) {
  // Use refs to avoid recreating callbacks when inputs/identity change
  const inputsRef = useRef(inputs);
  const onInputsChangeRef = useRef(onInputsChange);

  // Keep refs updated
  useEffect(() => {
    inputsRef.current = inputs;
  }, [inputs]);

  useEffect(() => {
    onInputsChangeRef.current = onInputsChange;
  }, [onInputsChange]);
  // State management
  const [showFlagImageModal, setShowFlagImageModal] = useState(false);
  const [showCoatOfArmsImageModal, setShowCoatOfArmsImageModal] = useState(false);
  const [selectedGovernmentType, setSelectedGovernmentType] = useState("republic");
  const [customOfficialName, setCustomOfficialName] = useState("");
  const [isEditingCustomName, setIsEditingCustomName] = useState(false);
  const [shouldFetchCustomTypes, setShouldFetchCustomTypes] = useState(false);
  const [foundationCoatOfArmsUrl, setFoundationCoatOfArmsUrl] = useState<string | undefined>(
    referenceCountry?.coatOfArms || referenceCountry?.coatOfArmsUrl || undefined
  );

  // Foundation country data
  const foundationCountryName =
    getFoundationCountryName(referenceCountry) || (countryId ? inputs.countryName : null);
  const { flag } = useCountryFlagRouteAware(foundationCountryName || "");
  const { handleColorsExtracted } = useBuilderTheming(foundationCountryName || "");

  // API queries
  const { data: customGovernmentTypes } = api.customTypes.getUserCustomGovernmentTypes.useQuery(
    undefined,
    {
      enabled: shouldFetchCustomTypes,
      staleTime: 5 * 60 * 1000,
    }
  );
  const upsertCustomGovernmentType = api.customTypes.upsertCustomGovernmentType.useMutation();
  const upsertFieldValue = api.customTypes.upsertFieldValue.useMutation();

  // Fetch wiki images (runs on backend via tRPC, avoiding client-side CORS/Failed to fetch issues)
  const { data: wikiImages } = api.countries.getWikiPageImages.useQuery(
    { countryName: foundationCountryName || "" },
    { enabled: !!foundationCountryName, staleTime: 24 * 60 * 60_000 }
  );

  // Initialize identity data - memoize to prevent unnecessary re-renders
  const identity = useMemo(
    () =>
      inputs.nationalIdentity ||
      ({
        countryName: String(inputs.countryName || ""),
        officialName: "",
        governmentType: "republic",
        motto: "",
        mottoNative: "",
        capitalCity: "",
        largestCity: "",
        demonym: "",
        currency: "",
        currencySymbol: "$",
        officialLanguages: "",
        nationalLanguage: "",
        nationalAnthem: "",
        nationalReligion: "",
        nationalDay: "",
        callingCode: "",
        internetTLD: "",
        drivingSide: "right" as "left" | "right",
        timeZone: "",
        isoCode: "",
        coordinatesLatitude: "",
        coordinatesLongitude: "",
        emergencyNumber: "",
        postalCodeFormat: "",
        nationalSport: "",
        nationalAnimal: "",
        nationalBird: "",
        nationalFish: "",
        founders: "",
        nationalFlower: "",
        nationalDish: "",
        nationalFruit: "",
        nationalDrink: "",
        nationalInstrument: "",
        nationalSymbol: "",
        nationalAnimalImage: "",
        nationalBirdImage: "",
        nationalFishImage: "",
        foundersImage: "",
        nationalFlowerImage: "",
        nationalDishImage: "",
        nationalFruitImage: "",
        nationalDrinkImage: "",
        nationalInstrumentImage: "",
        nationalSymbolImage: "",
        weekStartDay: "monday",
      } satisfies NationalIdentityData),
    [inputs.nationalIdentity, inputs.countryName]
  );

  // Auto-sync for national identity (edit mode only)
  const autoSync = useNationalIdentityAutoSync(countryId, identity, {
    enabled: !!countryId, // Only enable in edit mode
    debounceMs: 15000, // 15 seconds
    onSyncSuccess: () => {
      console.log("[NationalIdentity] Autosave successful");
    },
    onSyncError: (error) => {
      console.warn("[NationalIdentity] Autosave failed:", error);
    },
  });

  // Sync local state with loaded identity data
  useEffect(() => {
    if (inputs.nationalIdentity?.governmentType) {
      setSelectedGovernmentType(inputs.nationalIdentity.governmentType);
    }
    if (inputs.nationalIdentity?.officialName && !isEditingCustomName) {
      setCustomOfficialName(inputs.nationalIdentity.officialName);
    }
  }, [inputs.nationalIdentity, isEditingCustomName]);

  // Event handlers - use refs to prevent recreation when inputs change
  const handleIdentityChange = useCallback((field: string | number | symbol, value: any) => {
    const currentInputs = inputsRef.current;
    const currentIdentity = currentInputs.nationalIdentity || identity;
    const newIdentity: NationalIdentityData = {
      ...currentIdentity,
      [field]: value,
      drivingSide:
        field === "drivingSide"
          ? (value as "left" | "right")
          : (currentIdentity.drivingSide ?? ("right" as "left" | "right")),
    };

    if (field === "countryName" && value && !newIdentity.demonym) {
      let demonym = value.toString();
      if (demonym.endsWith("a")) demonym += "n";
      else if (demonym.endsWith("y")) demonym = demonym.slice(0, -1) + "ian";
      else demonym += "ian";
      newIdentity.demonym = demonym;
    }

    onInputsChangeRef.current({
      ...currentInputs,
      nationalIdentity: newIdentity,
      countryName: field === "countryName" ? value : currentInputs.countryName,
    });
  }, []); // No dependencies - uses refs

  const handleFlagUrlChange = useCallback((url: string) => {
    const currentInputs = inputsRef.current;
    onInputsChangeRef.current({
      ...currentInputs,
      flagUrl: url,
      coatOfArmsUrl: currentInputs.coatOfArmsUrl ?? "",
    });
  }, []); // No dependencies - uses refs

  const handleCoatOfArmsUrlChange = useCallback((url: string) => {
    const currentInputs = inputsRef.current;
    onInputsChangeRef.current({
      ...currentInputs,
      flagUrl: currentInputs.flagUrl ?? "",
      coatOfArmsUrl: url,
    });
  }, []); // No dependencies - uses refs

  const handleFieldValueSave = useCallback(
    (fieldName: string, value: string) => {
      upsertFieldValue.mutate({ fieldName, value });
    },
    [upsertFieldValue]
  );

  // Fetch coat of arms from foundation country/wiki images
  useEffect(() => {
    // First check if referenceCountry already has the coat of arms
    const refCoa = referenceCountry?.coatOfArms || referenceCountry?.coatOfArmsUrl;
    if (refCoa) {
      setFoundationCoatOfArmsUrl(refCoa);
      return;
    }

    if (wikiImages) {
      const parsedCoaUrl =
        wikiImages.find((img: { title: string; url: string }) =>
          /coat.?of.?arms|coa|seal|emblem|escudo|wappen/i.test(img.title)
        )?.url ?? null;

      if (parsedCoaUrl) {
        setFoundationCoatOfArmsUrl(parsedCoaUrl);
      }
    }
  }, [wikiImages, referenceCountry]);

  // Auto-fill flag and coat of arms from foundation country
  useEffect(() => {
    const refFlag = referenceCountry?.flag || referenceCountry?.flagUrl;
    const activeFlag = flag?.flagUrl || refFlag;
    if (activeFlag && !inputs.flagUrl) {
      handleFlagUrlChange(activeFlag);
    }

    const refCoa = referenceCountry?.coatOfArms || referenceCountry?.coatOfArmsUrl;
    const activeCoa = foundationCoatOfArmsUrl || refCoa;
    if (activeCoa && !inputs.coatOfArmsUrl) {
      handleCoatOfArmsUrlChange(activeCoa);
    }
  }, [
    flag?.flagUrl,
    foundationCoatOfArmsUrl,
    referenceCountry,
    inputs.flagUrl,
    inputs.coatOfArmsUrl,
    handleFlagUrlChange,
    handleCoatOfArmsUrlChange,
  ]);

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
    // Auto-sync
    autoSync,
  };
}

function getFoundationCountryName(
  referenceCountry: RealCountryData | null | undefined
): string | null {
  if (!referenceCountry) return null;
  if (referenceCountry.foundationCountryName) return referenceCountry.foundationCountryName;
  const name = referenceCountry.name;
  return name.startsWith("New ") ? name.substring(4) : name;
}
