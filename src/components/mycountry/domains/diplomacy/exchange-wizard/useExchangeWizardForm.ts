"use client";

import React, { useMemo, useState } from "react";
import { api } from "~/trpc/react";
import { useNationClock } from "~/hooks/useNationClock";
import { useActingRealmId } from "~/hooks/useActingRealmId";
import { nationsInRealm } from "~/lib/realms/same-realm";
import { realmDayStart } from "~/components/realms/RealmDayInput";
import { toWireDate } from "./exchange-wizard-dates";
import {
  WIZARD_EXCHANGE_TYPES,
  WIZARD_STEP_COUNT,
  type ExchangeWizardData,
  type WizardCountry,
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
  // Kept as rows so a nation picked under one search stays picked (and named) under another.
  const [participants, setParticipants] = useState<WizardCountry[]>([]);
  const participantCountryIds = useMemo(() => participants.map((c) => c.id), [participants]);
  const [narrative, setNarrative] = useState("");
  const [objectives, setObjectives] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [maxParticipants, setMaxParticipants] = useState(100);

  // Country search
  const [countrySearch, setCountrySearch] = useState("");

  // Today on the host nation's realm clock, as the server's YYYY-MM-DD ("" while the clock loads).
  const clock = useNationClock();
  const todayDate = useMemo(
    () => (clock ? toWireDate(realmDayStart(clock.now(), clock.calendar)) : ""),
    [clock]
  );

  // Initialize start date to today if empty
  React.useEffect(() => {
    if (!startDate && todayDate) {
      // oxlint-disable-next-line
      setStartDate(todayDate);
    }
  }, [todayDate, startDate]);

  // Fetch countries for selection
  const { data: countriesData, isLoading: isLoadingCountries } = api.countries.getAll.useQuery({
    limit: 200,
    offset: 0,
    search: countrySearch || undefined,
  });

  // Auto-generate placeholder narrative
  const narrativePlaceholder = useMemo(() => {
    const names = participants.map((c) => c.name);
    const selectedCountryName =
      names.length === 0
        ? "the participating country"
        : names.length === 1
          ? names[0]
          : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    const typeConfig = WIZARD_EXCHANGE_TYPES[type];

    return `This ${typeConfig.label.toLowerCase()} brings together ${hostCountry.name} and ${selectedCountryName} in a celebration of shared cultural heritage. Through ${typeConfig.description.toLowerCase()}, our nations will strengthen bonds and create lasting memories...`;
  }, [type, participants, hostCountry.name]);

  // Pick or unpick a participant nation
  const toggleParticipant = (countryId: string) => {
    setParticipants((prev) => {
      if (prev.some((c) => c.id === countryId)) return prev.filter((c) => c.id !== countryId);
      const country = countriesData?.countries?.find((c) => c.id === countryId);
      return country ? [...prev, country] : prev;
    });
  };

  // Nations of the host's realm, excluding the host
  const realmId = useActingRealmId();
  const availableCountries = useMemo(() => {
    return nationsInRealm(countriesData?.countries ?? [], realmId)
      .filter((c) => c.id !== hostCountry.id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [countriesData, hostCountry.id, realmId]);

  // Toggle objective
  const toggleObjective = (objective: string) => {
    setObjectives((prev) =>
      prev.includes(objective) ? prev.filter((o) => o !== objective) : [...prev, objective]
    );
  };

  // Validation
  const canProceed: Record<number, boolean> = {
    1: !!(title.trim() && description.trim()),
    2: participants.length > 0,
    3: !!(narrative.trim() && objectives.length > 0),
    4: !!(startDate && endDate && maxParticipants >= Math.max(1, participants.length)),
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
    participantCountryIds,
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
    toggleParticipant,
    setNarrative,
    toggleObjective,
    setStartDate,
    setEndDate,
    setIsPublic,
    setMaxParticipants,
    countrySearch,
    setCountrySearch,
    todayDate,
    calendar: clock?.calendar ?? null,
    isLoadingCountries,
    narrativePlaceholder,
    selectedCountries: participants,
    availableCountries,
  };
}
