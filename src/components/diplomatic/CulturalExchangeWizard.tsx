"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { IxTime } from "~/lib/ixtime";
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiCheckLine,
  RiCloseLine,
  RiStarLine,
  RiBuildingLine,
  RiBookLine,
  RiRestaurantLine,
  RiPaletteLine,
  RiTrophyLine,
  RiGamepadLine,
  RiGlobalLine,
  RiCalendarLine,
  RiGroupLine,
  RiEyeLine,
  RiEyeOffLine,
  RiSearchLine,
  RiMusicLine,
  RiFilmLine,
  RiLeafLine,
  RiFlaskLine,
  RiShipLine,
  RiHandHeartLine,
  RiPlantLine,
  RiAncientGateLine,
  RiMedalLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
} from "react-icons/ri";

// Exchange type configurations
const EXCHANGE_TYPES = {
  festival: {
    icon: RiStarLine,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/40',
    label: 'Cultural Festival',
    description: 'Celebration of traditions and customs',
    primary: true
  },
  exhibition: {
    icon: RiBuildingLine,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/40',
    label: 'Cultural Exhibition',
    description: 'Showcase of cultural heritage',
    primary: true
  },
  education: {
    icon: RiBookLine,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/40',
    label: 'Educational Exchange',
    description: 'Knowledge and academic collaboration',
    primary: true
  },
  cuisine: {
    icon: RiRestaurantLine,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/40',
    label: 'Culinary Exchange',
    description: 'Food culture and traditions',
    primary: true
  },
  arts: {
    icon: RiPaletteLine,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/20',
    borderColor: 'border-pink-500/40',
    label: 'Arts Exchange',
    description: 'Visual arts and creative works',
    primary: true
  },
  sports: {
    icon: RiTrophyLine,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/40',
    label: 'Sports Exchange',
    description: 'Athletic competition and culture',
    primary: true
  },
  technology: {
    icon: RiGamepadLine,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/40',
    label: 'Tech Exchange',
    description: 'Innovation and technology',
    primary: true
  },
  diplomacy: {
    icon: RiGlobalLine,
    color: 'text-[--intel-gold]',
    bgColor: 'bg-[--intel-gold]/20',
    borderColor: 'border-[--intel-gold]/40',
    label: 'Diplomatic Summit',
    description: 'High-level dialogue',
    primary: true
  },
  // More options (hidden by default)
  music: {
    icon: RiMusicLine,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/20',
    borderColor: 'border-violet-500/40',
    label: 'Music Exchange',
    description: 'Musical traditions and performances',
    primary: false
  },
  film: {
    icon: RiFilmLine,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/20',
    borderColor: 'border-indigo-500/40',
    label: 'Film & Media',
    description: 'Cinema and media culture',
    primary: false
  },
  environmental: {
    icon: RiLeafLine,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/40',
    label: 'Environmental',
    description: 'Sustainability and conservation',
    primary: false
  },
  science: {
    icon: RiFlaskLine,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/20',
    borderColor: 'border-sky-500/40',
    label: 'Scientific Research',
    description: 'Scientific collaboration',
    primary: false
  },
  trade: {
    icon: RiShipLine,
    color: 'text-blue-500',
    bgColor: 'bg-blue-600/20',
    borderColor: 'border-blue-600/40',
    label: 'Trade Mission',
    description: 'Economic and commercial ties',
    primary: false
  },
  humanitarian: {
    icon: RiHandHeartLine,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/20',
    borderColor: 'border-rose-500/40',
    label: 'Humanitarian Aid',
    description: 'Relief and development programs',
    primary: false
  },
  agriculture: {
    icon: RiPlantLine,
    color: 'text-lime-400',
    bgColor: 'bg-lime-500/20',
    borderColor: 'border-lime-500/40',
    label: 'Agricultural',
    description: 'Farming and food security',
    primary: false
  },
  heritage: {
    icon: RiAncientGateLine,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/40',
    label: 'Heritage Preservation',
    description: 'Historical sites and artifacts',
    primary: false
  },
  youth: {
    icon: RiMedalLine,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/40',
    label: 'Youth Program',
    description: 'Young leaders development',
    primary: false
  }
} as const;

// Common objectives
const COMMON_OBJECTIVES = [
  "Strengthen cultural understanding",
  "Promote artistic collaboration",
  "Enhance educational ties",
  "Foster economic partnerships",
  "Build diplomatic goodwill",
  "Share technological innovations",
  "Preserve cultural heritage",
  "Develop youth programs"
];

const getCountryFlagUrl = (country: any) =>
  country?.flagUrl ?? country?.flag ?? undefined;

interface CulturalExchangeWizardProps {
  hostCountry: {
    id: string;
    name: string;
    flagUrl?: string | null;
    economicTier?: string;
  };
  onComplete: (data: {
    title: string;
    type: string;
    description: string;
    participantCountryId: string;
    narrative: string;
    objectives: string[];
    startDate: string;
    endDate: string;
    isPublic: boolean;
    maxParticipants: number;
  }) => void;
  onCancel: () => void;
}

export function CulturalExchangeWizard({
  hostCountry,
  onComplete,
  onCancel
}: CulturalExchangeWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [showMoreTypes, setShowMoreTypes] = useState(false);

  // Form data
  const [title, setTitle] = useState("");
  const [type, setType] = useState<keyof typeof EXCHANGE_TYPES>("festival");
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
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }, []);

  // Initialize start date to current IxTime if empty
  React.useEffect(() => {
    if (!startDate) {
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
    const selectedCountry = countriesData?.countries?.find((c: any) => c.id === participantCountryId);
    const selectedCountryName = selectedCountry?.name ?? "the participating country";
    const typeConfig = EXCHANGE_TYPES[type];

    return `This ${typeConfig.label.toLowerCase()} brings together ${hostCountry.name} and ${selectedCountryName} in a celebration of shared cultural heritage. Through ${typeConfig.description.toLowerCase()}, our nations will strengthen bonds and create lasting memories...`;
  }, [type, participantCountryId, countriesData, hostCountry.name]);

  // Get selected country data
  const selectedCountry = countriesData?.countries?.find((c: any) => c.id === participantCountryId);

  // Filter countries excluding host
  const availableCountries = useMemo(() => {
    return (countriesData?.countries ?? [])
      .filter((c: any) => c.id !== hostCountry.id)
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [countriesData, hostCountry.id]);

  // Toggle objective
  const toggleObjective = (objective: string) => {
    setObjectives(prev =>
      prev.includes(objective)
        ? prev.filter(o => o !== objective)
        : [...prev, objective]
    );
  };

  // Validation
  const canProceedFromStep1 = title.trim() && description.trim();
  const canProceedFromStep2 = !!participantCountryId;
  const canProceedFromStep3 = narrative.trim() && objectives.length > 0;
  const canProceedFromStep4 = startDate && endDate && maxParticipants > 0;

  // Handle next step
  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  // Handle previous step
  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Handle submit
  const handleSubmit = () => {
    onComplete({
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
    });
  };

  // Step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-foreground mb-2">Exchange Type & Information</h3>
              <p className="text-muted-foreground text-sm">Define the type and basic details of your cultural exchange.</p>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-foreground">Exchange Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Annual Cultural Festival 2025"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-input border-[--intel-gold]/20 focus:border-[--intel-gold]/50"
              />
            </div>

            {/* Type Dropdown */}
            <div className="space-y-2">
              <Label className="text-foreground">Exchange Type *</Label>

              {/* Primary Types */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(EXCHANGE_TYPES).filter(([, config]) => config.primary).map(([key, config]) => {
                  const Icon = config.icon;
                  const isSelected = type === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setType(key as keyof typeof EXCHANGE_TYPES);
                      }}
                      className={cn(
                        "glass-hierarchy-child rounded-lg p-2.5 transition-all duration-200",
                        "border hover:border-[rgb(202,138,4)]/40 cursor-pointer pointer-events-auto",
                        isSelected
                          ? "ring-2 ring-[rgb(202,138,4)] border-[rgb(202,138,4)] bg-[rgb(202,138,4)]/10"
                          : "border-border/50"
                      )}
                      style={isSelected ? { borderColor: 'rgb(202,138,4)', boxShadow: '0 0 0 2px rgba(202,138,4,0.5)' } : undefined}
                    >
                      <div className="flex flex-col items-center gap-1 text-center pointer-events-none">
                        <Icon className={cn("h-4 w-4", config.color)} />
                        <span className="text-[10px] font-medium text-foreground leading-tight">{config.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* More Types (Expandable) */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowMoreTypes(!showMoreTypes)}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  {showMoreTypes ? <RiArrowUpSLine className="h-4 w-4" /> : <RiArrowDownSLine className="h-4 w-4" />}
                  {showMoreTypes ? 'Show Less' : 'Show More Types'}
                </button>

                <AnimatePresence>
                  {showMoreTypes && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-visible"
                    >
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
                        {Object.entries(EXCHANGE_TYPES).filter(([, config]) => !config.primary).map(([key, config]) => {
                          const Icon = config.icon;
                          const isSelected = type === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setType(key as keyof typeof EXCHANGE_TYPES);
                              }}
                              className={cn(
                                "glass-hierarchy-child rounded-lg p-2.5 transition-all duration-200",
                                "border hover:border-[rgb(202,138,4)]/40 cursor-pointer pointer-events-auto",
                                isSelected
                                  ? "ring-2 ring-[rgb(202,138,4)] border-[rgb(202,138,4)] bg-[rgb(202,138,4)]/10"
                                  : "border-border/50"
                              )}
                              style={isSelected ? { borderColor: 'rgb(202,138,4)', boxShadow: '0 0 0 2px rgba(202,138,4,0.5)' } : undefined}
                            >
                              <div className="flex flex-col items-center gap-1 text-center pointer-events-none">
                                <Icon className={cn("h-4 w-4", config.color)} />
                                <span className="text-[10px] font-medium text-foreground leading-tight">{config.label}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-foreground">Description *</Label>
              <Textarea
                id="description"
                placeholder="Provide a brief overview of this cultural exchange..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-input border-[--intel-gold]/20 focus:border-[--intel-gold]/50 min-h-24"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-foreground mb-2">Select Participant Country</h3>
              <p className="text-muted-foreground text-sm">Choose the country that will participate in this exchange.</p>
            </div>

            {/* Search */}
            <div className="relative">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search countries..."
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                className="pl-10 bg-input border-[--intel-gold]/20 focus:border-[--intel-gold]/50"
              />
            </div>

            {/* Country List */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {isLoadingCountries ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="glass-hierarchy-child rounded-lg p-3 h-16 animate-pulse bg-muted/50" />
                  ))}
                </div>
              ) : availableCountries.length === 0 ? (
                <div className="glass-hierarchy-child rounded-lg p-6 text-center">
                  <p className="text-sm text-muted-foreground">No countries found</p>
                </div>
              ) : (
                availableCountries.map((country: any) => {
                  const isSelected = participantCountryId === country.id;
                  return (
                    <div
                      key={country.id}
                      onClick={() => setParticipantCountryId(country.id)}
                      className={cn(
                        "w-full glass-hierarchy-child rounded-lg p-3 transition-all duration-200",
                        "border hover:border-[--intel-gold]/40 cursor-pointer text-left",
                        isSelected
                          ? "ring-2 ring-[--intel-gold]/50 border-[--intel-gold]/50"
                          : "border-[--intel-gold]/20"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Checkbox
                          checked={isSelected}
                          className="pointer-events-none"
                        />
                        <UnifiedCountryFlag
                          countryName={country.name}
                          size="sm"
                          className="rounded shadow-sm"
                          flagUrl={country.flag}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{country.name}</p>
                          <p className="text-xs text-muted-foreground">{country.economicTier} Economy</p>
                        </div>
                        {isSelected && <RiCheckLine className="text-[--intel-gold] h-4 w-4 flex-shrink-0" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-foreground mb-2">Exchange Narrative & Objectives</h3>
              <p className="text-muted-foreground text-sm">Craft the story and goals of this cultural exchange.</p>
            </div>

            {/* Narrative */}
            <div className="space-y-2">
              <Label htmlFor="narrative" className="text-foreground">Exchange Narrative *</Label>
              <Textarea
                id="narrative"
                placeholder={narrativePlaceholder}
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                className="bg-input border-[--intel-gold]/20 focus:border-[--intel-gold]/50 min-h-32"
              />
              <p className="text-xs text-muted-foreground">
                Describe the purpose, activities, and expected outcomes of this exchange.
              </p>
            </div>

            {/* Objectives */}
            <div className="space-y-2">
              <Label className="text-foreground">Objectives * (select at least one)</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {COMMON_OBJECTIVES.map((objective) => {
                  const isSelected = objectives.includes(objective);
                  return (
                    <div
                      key={objective}
                      onClick={() => toggleObjective(objective)}
                      className={cn(
                        "glass-hierarchy-child rounded-lg p-3 transition-all duration-200",
                        "border hover:border-[--intel-gold]/40 cursor-pointer text-left",
                        isSelected
                          ? "ring-2 ring-[--intel-gold]/50 border-[--intel-gold]/50"
                          : "border-[--intel-gold]/20"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox checked={isSelected} className="pointer-events-none" />
                        <span className="text-sm text-foreground">{objective}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Selected: {objectives.length} objective{objectives.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-foreground mb-2">Configuration & Settings</h3>
              <p className="text-muted-foreground text-sm">Set the schedule, capacity, and visibility of your exchange.</p>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-foreground flex items-center gap-2">
                  <RiCalendarLine className="h-4 w-4" />
                  Start Date (IxTime) *
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  min={currentIxTimeDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-input border-[--intel-gold]/20 focus:border-[--intel-gold]/50"
                />
                <p className="text-xs text-muted-foreground">
                  Today in IxTime: {new Date(currentIxTimeDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    timeZone: 'UTC'
                  })}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate" className="text-foreground flex items-center gap-2">
                  <RiCalendarLine className="h-4 w-4" />
                  End Date (IxTime) *
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  min={startDate || currentIxTimeDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-input border-[--intel-gold]/20 focus:border-[--intel-gold]/50"
                />
                <p className="text-xs text-muted-foreground">
                  Must be after start date
                </p>
              </div>
            </div>

            {/* Max Participants */}
            <div className="space-y-2">
              <Label htmlFor="maxParticipants" className="text-foreground flex items-center gap-2">
                <RiGroupLine className="h-4 w-4" />
                Maximum Participants *
              </Label>
              <Input
                id="maxParticipants"
                type="number"
                min="1"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Math.max(1, parseInt(e.target.value) || 1))}
                className="bg-input border-[--intel-gold]/20 focus:border-[--intel-gold]/50"
              />
              <p className="text-xs text-muted-foreground">
                Number of people who can participate in this exchange.
              </p>
            </div>

            {/* Public/Private */}
            <div className="glass-hierarchy-child rounded-lg p-4">
              <div
                onClick={() => setIsPublic(!isPublic)}
                className="w-full flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Checkbox checked={isPublic} className="pointer-events-none" />
                  <div className="text-left">
                    <p className="font-medium text-foreground flex items-center gap-2">
                      {isPublic ? <RiEyeLine className="h-4 w-4" /> : <RiEyeOffLine className="h-4 w-4" />}
                      Public Exchange
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isPublic
                        ? "Visible to all countries and can accept participants"
                        : "Restricted to invited participants only"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-foreground mb-2">Review & Submit</h3>
              <p className="text-muted-foreground text-sm">Review your exchange details before creating it.</p>
            </div>

            <div className="space-y-5">
              {/* Type & Title */}
              <div className="glass-hierarchy-child rounded-lg p-4">
                <div className="flex items-start gap-3">
                  {React.createElement(EXCHANGE_TYPES[type].icon, {
                    className: cn("h-6 w-6 mt-1", EXCHANGE_TYPES[type].color)
                  })}
                  <div className="flex-1">
                    <h4 className="font-bold text-foreground text-lg">{title}</h4>
                    <p className="text-sm text-muted-foreground">{EXCHANGE_TYPES[type].label}</p>
                    <p className="text-sm text-gray-300 mt-2">{description}</p>
                  </div>
                </div>
              </div>

              {/* Countries */}
              <div className="glass-hierarchy-child rounded-lg p-4">
                <h5 className="text-sm font-semibold text-muted-foreground mb-3">Participating Countries</h5>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                  <UnifiedCountryFlag
                    countryName={hostCountry.name}
                    size="sm"
                    className="rounded shadow-sm"
                    flagUrl={getCountryFlagUrl(hostCountry)}
                  />
                    <div>
                      <p className="font-bold text-foreground">{hostCountry.name}</p>
                      <p className="text-xs text-muted-foreground">Host Country</p>
                    </div>
                  </div>
                  {selectedCountry && (
                    <div className="flex items-center gap-3">
                      <UnifiedCountryFlag
                        countryName={selectedCountry.name}
                        size="sm"
                        className="rounded shadow-sm"
                        flagUrl={getCountryFlagUrl(selectedCountry)}
                      />
                      <div>
                        <p className="font-bold text-foreground">{selectedCountry.name}</p>
                        <p className="text-xs text-muted-foreground">Participant Country</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Narrative */}
              <div className="glass-hierarchy-child rounded-lg p-4">
                <h5 className="text-sm font-semibold text-muted-foreground mb-2">Narrative</h5>
                <p className="text-sm text-gray-300">{narrative}</p>
              </div>

              {/* Objectives */}
              <div className="glass-hierarchy-child rounded-lg p-4">
                <h5 className="text-sm font-semibold text-muted-foreground mb-3">Objectives</h5>
                <div className="flex flex-wrap gap-2">
                  {objectives.map((obj) => (
                    <span
                      key={obj}
                      className="px-3 py-1 rounded-full bg-[--intel-gold]/20 text-[--intel-gold] text-xs border border-[--intel-gold]/30"
                    >
                      {obj}
                    </span>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div className="glass-hierarchy-child rounded-lg p-4">
                <h5 className="text-sm font-semibold text-muted-foreground mb-3">Details</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Start Date</p>
                    <p className="text-sm text-foreground font-medium">{new Date(startDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">End Date</p>
                    <p className="text-sm text-foreground font-medium">{new Date(endDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Max Participants</p>
                    <p className="text-sm text-foreground font-medium">{maxParticipants}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Visibility</p>
                    <p className="text-sm text-foreground font-medium">{isPublic ? "Public" : "Private"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-border flex items-center justify-between bg-muted/30">
        <div>
          <h2 className="text-xl font-bold text-foreground">Create Cultural Exchange</h2>
          <p className="text-xs text-muted-foreground mt-1">Step {currentStep} of 5</p>
        </div>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-accent rounded-lg transition-colors"
        >
          <RiCloseLine className="h-5 w-5 text-foreground" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="flex-shrink-0 px-4 py-3">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((step) => (
            <div
              key={step}
              className={cn(
                "flex-1 h-2 rounded-full transition-all duration-300",
                step <= currentStep ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        <div className="pb-12">
          {renderStepContent()}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 p-4 border-t border-border bg-muted/30 flex justify-between gap-4">
        <Button
          variant="outline"
          onClick={currentStep === 1 ? onCancel : handlePrevious}
        >
          <RiArrowLeftLine className="mr-2" />
          {currentStep === 1 ? "Cancel" : "Previous"}
        </Button>

        {currentStep < 5 ? (
          <Button
            onClick={handleNext}
            disabled={
              (currentStep === 1 && !canProceedFromStep1) ||
              (currentStep === 2 && !canProceedFromStep2) ||
              (currentStep === 3 && !canProceedFromStep3) ||
              (currentStep === 4 && !canProceedFromStep4)
            }
          >
            Next
            <RiArrowRightLine className="ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit}>
            <RiCheckLine className="mr-2" />
            Create Exchange
          </Button>
        )}
      </div>
    </div>
  );
}
