"use client";

import React, { useMemo, useState } from "react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import {
  WIZARD_EXCHANGE_TYPES,
  WIZARD_STEP_COUNT,
  type ExchangeWizardData,
  type WizardExchangeType,
  type WizardHostCountry,
} from "./exchange-wizard-config";

/** Form state, country lookup and step navigation for the cultural exchange wizard. */
export function useExchangeWizardForm(hostCountry: WizardHostCountry) {
  const [currentStep, setCurrentStep] = useState(1);
  const [showMoreTypes, setShowMoreTypes] = useState(false);

  // Form data
  const [title, setTitle] = useState("");
  const [type, setType] = useState<WizardExchangeType>("festival");
  const [description, setDescription] = useState("");
  const [participantCountryId, setParticipantCountryId] = useState("");
  const [narrative, setNarrative] = useState("");
  const [objectives, setObjectives] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [maxParticipants, setMaxParticipants] = useState(100);

  // Country search
  const [countrySearch, setCountrySearch] = useState("");

  // Get current IxTime as a date string for the calendar
  const currentIxTimeDate = useMemo(() => {
    const ixTime = IxTime.getCurrentIxTime();
    const date = new Date(ixTime);
    return date.toISOString().split("T")[0]; // YYYY-MM-DD format
  }, []);

  // Initialize start date to current IxTime if empty
  React.useEffect(() => {
    if (!startDate) {
      // oxlint-disable-next-line
      setStartDate(currentIxTimeDate);
    }
  }, [currentIxTimeDate, startDate]);

  // Fetch countries for selection
  const { data: countriesData, isLoading: isLoadingCountries } = api.countries.getAll.useQuery({
    limit: 200,
    offset: 0,
    search: countrySearch || undefined,
  });

  // Auto-generate placeholder narrative
  const narrativePlaceholder = useMemo(() => {
    const selectedCountry = countriesData?.countries?.find((c) => c.id === participantCountryId);
    const selectedCountryName = selectedCountry?.name ?? "the participating country";
    const typeConfig = WIZARD_EXCHANGE_TYPES[type];

    return `This ${typeConfig.label.toLowerCase()} brings together ${hostCountry.name} and ${selectedCountryName} in a celebration of shared cultural heritage. Through ${typeConfig.description.toLowerCase()}, our nations will strengthen bonds and create lasting memories...`;
  }, [type, participantCountryId, countriesData, hostCountry.name]);

  // Get selected country data
  const selectedCountry = countriesData?.countries?.find((c) => c.id === participantCountryId);

  // Filter countries excluding host
  const availableCountries = useMemo(() => {
    return (countriesData?.countries ?? [])
      .filter((c) => c.id !== hostCountry.id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [countriesData, hostCountry.id]);

  // Toggle objective
  const toggleObjective = (objective: string) => {
    setObjectives((prev) =>
      prev.includes(objective) ? prev.filter((o) => o !== objective) : [...prev, objective]
    );
  };

  // Validation
  const canProceed: Record<number, boolean> = {
    1: !!(title.trim() && description.trim()),
    2: !!participantCountryId,
    3: !!(narrative.trim() && objectives.length > 0),
    4: !!(startDate && endDate && maxParticipants > 0),
  };
  const isNextDisabled = canProceed[currentStep] === false;

  const handleNext = () => {
    if (currentStep < WIZARD_STEP_COUNT) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const data: ExchangeWizardData = {
    title,
    type,
    description,
    participantCountryId,
    narrative,
    objectives,
    startDate,
    endDate,
    isPublic,
    maxParticipants,
  };

  return {
    currentStep,
    handleNext,
    handlePrevious,
    isNextDisabled,
    data,
    showMoreTypes,
    setShowMoreTypes,
    setTitle,
    type,
    setType,
    setDescription,
    setParticipantCountryId,
    setNarrative,
    toggleObjective,
    setStartDate,
    setEndDate,
    setIsPublic,
    setMaxParticipants,
    countrySearch,
    setCountrySearch,
    currentIxTimeDate,
    isLoadingCountries,
    narrativePlaceholder,
    selectedCountry,
    availableCountries,
  };
}
