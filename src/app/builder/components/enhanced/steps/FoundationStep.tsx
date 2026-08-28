"use client";
// Foundation Step - Country and Faction selection for Atomic Builder

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Globe,
  ArrowLeft,
  Shield,
  Sparks as Sparkles,
  Check,
  Cpu,
  Bank as Landmark,
  FireFlame as Flame,
  UserBadgeCheck as UserCheck,
  Coins,
  Trophy as Award,
  HelpCircle as CircleHelp,
} from "iconoir-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { CountrySelector } from "../CountrySelector";
import type { RealCountryData } from "~/app/builder/lib/economy-data-service";
import { api } from "~/trpc/react";
import { useBuilderContext } from "../context/BuilderStateContext";
import { useBuilderFilter } from "../../builder-filter-context";
import {
  CutoutCard,
  CutoutCardContent,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "~/components/ui/tooltip";
import { useIntersectionObserver } from "../PerformanceOptimizer";

const HISTORICAL_ARCHETYPE_IDS = [
  "british-empire",
  "venetian-republic",
  "hanseatic-league",
  "dutch-golden-age",
  "industrial-revolution",
  "soviet-command",
  "american-gilded-age",
  "french-mercantilism",
  "ottoman-empire",
  "chinese-ming-dynasty",
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.23, 1, 0.32, 1] as any,
    },
  },
};

interface FoundationStepProps {
  countries: RealCountryData[];
  isLoadingCountries: boolean;
  countryLoadError: string | null;
  onCountrySelect: (country: RealCountryData) => void;
  onCreateFromScratch: () => void;
  onBackToIntro?: () => void;
}

export function FoundationStep({
  countries,
  isLoadingCountries,
  countryLoadError,
  onCountrySelect,
  onCreateFromScratch,
  onBackToIntro,
}: FoundationStepProps) {
  const { builderState, updateArchetypeId } = useBuilderContext();
  const { selectedTemplate, setSelectedTemplate, setSoftSelectedCountry, setNewCountryName } =
    useBuilderFilter();
  const [localSelectedArchetype, setLocalSelectedArchetype] = useState<any | null>(null);
  const [activeEra, setActiveEra] = useState<"modern" | "historical">("modern");
  const [visibleCount, setVisibleCount] = useState(6);
  const hasInitializedRef = React.useRef(false);
  const hasRestoredArchetypeRef = React.useRef(false);

  // Query archetypes
  const { data: archetypesData, isLoading: isLoadingArchetypes } =
    api.economicArchetypes.getAllArchetypes.useQuery({
      era: activeEra,
    });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const archetypes = archetypesData?.archetypes || [];
  const visibleArchetypes = archetypes.slice(0, visibleCount);

  // Preserve selections on mount so navigating back to this step keeps the chosen template selected
  React.useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    if (builderState.selectedCountry) {
      setSelectedTemplate(builderState.selectedCountry);
      setSoftSelectedCountry(builderState.selectedCountry);
      setNewCountryName(builderState.selectedCountry.name);

      // Auto-set the active era if a historical archetype was previously chosen
      if (
        builderState.selectedArchetypeId &&
        HISTORICAL_ARCHETYPE_IDS.includes(builderState.selectedArchetypeId)
      ) {
        setActiveEra("historical");
      }
    } else {
      setSelectedTemplate(null);
    }
    setLocalSelectedArchetype(null);
  }, [
    setSelectedTemplate,
    setSoftSelectedCountry,
    setNewCountryName,
    builderState.selectedCountry,
    builderState.selectedArchetypeId,
  ]);

  // Restore selected archetype when archetypes data loads
  React.useEffect(() => {
    if (hasRestoredArchetypeRef.current) return;
    if (builderState.selectedArchetypeId && archetypes.length > 0) {
      const matched = archetypes.find((a) => a.id === builderState.selectedArchetypeId);
      if (matched) {
        setLocalSelectedArchetype(matched);
        hasRestoredArchetypeRef.current = true;
      }
    }
    // oxlint-disable-next-line
  }, [builderState.selectedArchetypeId, archetypes]);

  // Reset visibleCount when activeEra changes
  React.useEffect(() => {
    setVisibleCount(6);
  }, [activeEra]);

  const loaderRef = React.useRef<HTMLDivElement>(null);
  const observerOptions = React.useMemo(
    () => ({
      rootMargin: "50px",
    }),
    []
  );
  const isIntersecting = useIntersectionObserver(
    loaderRef as React.RefObject<Element>,
    observerOptions
  );

  React.useEffect(() => {
    if (isIntersecting && visibleCount < archetypes.length) {
      setVisibleCount((prev) => Math.min(prev + 6, archetypes.length));
    }
  }, [isIntersecting, archetypes.length, visibleCount]);

  if (isLoadingCountries) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="space-y-4 text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mx-auto h-16 w-16"
          >
            <Globe className="h-16 w-16 text-blue-500" />
          </motion.div>
          <div className="space-y-2">
            <p className="text-lg font-medium text-white/90">Loading nation templates...</p>
            <p className="text-sm text-zinc-400">Preparing your foundation options</p>
          </div>
        </div>
      </div>
    );
  }

  if (countryLoadError) {
    return (
      <Alert className="mx-auto max-w-2xl border-red-500/30 bg-red-950/20 backdrop-blur-md">
        <AlertDescription className="text-red-400">
          <strong>Error loading country templates:</strong> {countryLoadError}
          <br />
          Please refresh the page to try again.
        </AlertDescription>
      </Alert>
    );
  }

  // Part 1: Country template selection
  if (!selectedTemplate) {
    return (
      <div>
        <CountrySelector
          countries={countries}
          onCountrySelect={(country) => setSelectedTemplate(country)}
          onBackToIntro={onBackToIntro}
          onCreateFromScratch={onCreateFromScratch}
        />
      </div>
    );
  }

  const handleConfirmFaction = () => {
    if (!localSelectedArchetype) return;
    updateArchetypeId(localSelectedArchetype.id);
    onCountrySelect(selectedTemplate);
  };

  const handleSkipArchetype = () => {
    updateArchetypeId(null);
    onCountrySelect(selectedTemplate);
  };

  const getArchetypeIcon = (key: string) => {
    const keyLower = key.toLowerCase();
    if (keyLower.includes("nordic") || keyLower.includes("social")) return Sparkles;
    if (keyLower.includes("valley") || keyLower.includes("capital") || keyLower.includes("free"))
      return Cpu;
    if (keyLower.includes("command") || keyLower.includes("state") || keyLower.includes("plan"))
      return Shield;
    if (keyLower.includes("industrial") || keyLower.includes("export")) return Flame;
    if (keyLower.includes("resource") || keyLower.includes("rentier")) return Coins;
    return Landmark;
  };

  const getComplexityBadgeClass = (complexity: string) => {
    const comp = (complexity || "medium").toLowerCase();
    if (comp === "high") {
      return "text-rose-600 dark:text-rose-400 bg-rose-550/10 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/30 shadow-[0_0_8px_rgba(244,63,94,0.08)]";
    }
    if (comp === "low") {
      return "text-emerald-600 dark:text-emerald-400 bg-emerald-550/10 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/30 shadow-[0_0_8px_rgba(16,185,129,0.08)]";
    }
    return "text-blue-600 dark:text-blue-400 bg-blue-550/10 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/30 shadow-[0_0_8px_rgba(59,130,246,0.08)]";
  };

  const getArchetypeColorClass = (key: string) => {
    const keyLower = key.toLowerCase();
    if (keyLower.includes("nordic") || keyLower.includes("social"))
      return "text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/5 hover:border-emerald-500/40 shadow-emerald-950/20";
    if (keyLower.includes("valley") || keyLower.includes("capital") || keyLower.includes("free"))
      return "text-cyan-600 dark:text-cyan-400 border-cyan-500/20 bg-cyan-500/10 dark:bg-cyan-500/5 hover:border-cyan-500/40 shadow-cyan-950/20";
    if (keyLower.includes("command") || keyLower.includes("state") || keyLower.includes("plan"))
      return "text-rose-600 dark:text-rose-400 border-rose-500/20 bg-rose-500/10 dark:bg-rose-500/5 hover:border-rose-500/40 shadow-rose-950/20";
    if (keyLower.includes("industrial") || keyLower.includes("export"))
      return "text-blue-600 dark:text-blue-400 border-blue-500/20 bg-blue-500/10 dark:bg-blue-500/5 hover:border-blue-500/40 shadow-blue-950/20";
    if (keyLower.includes("resource") || keyLower.includes("rentier"))
      return "text-indigo-600 dark:text-indigo-400 border-indigo-500/20 bg-indigo-500/10 dark:bg-indigo-500/5 hover:border-indigo-500/40 shadow-indigo-950/20";
    return "text-blue-600 dark:text-blue-400 border-blue-500/20 bg-blue-500/10 dark:bg-blue-500/5 hover:border-blue-500/40 shadow-blue-950/20";
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-2">
      {/* Back Button & Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-800 pb-4 md:flex-row md:items-center">
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedTemplate(null);
              setLocalSelectedArchetype(null);
            }}
            className="mb-2 flex items-center gap-1.5 border-zinc-200 bg-zinc-50 text-xs text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80 dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Change Base Template ({selectedTemplate.name})
          </Button>
          <h2 className="bg-gradient-to-r from-blue-400 to-cyan-500 bg-clip-text text-2xl font-bold text-transparent">
            Choose Country Archetype
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Select an archetype to seed starting tax structures, budget policies, and government
            structures. You can change all of this later.
          </p>
        </div>

        {/* Actions & Filters Header Container */}
        <div className="flex shrink-0 items-center gap-3.5 self-start md:self-center">
          {/* Era Selector Tabs */}
          <div className="flex items-center rounded-lg border border-zinc-200 bg-zinc-100/80 p-1 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
            <button
              onClick={() => {
                setActiveEra("modern");
                setLocalSelectedArchetype(null);
              }}
              className={cn(
                "cursor-pointer rounded-md px-4 py-1.5 text-xs font-semibold transition-all duration-300",
                activeEra === "modern"
                  ? "bg-blue-500 font-bold text-white shadow-md dark:bg-blue-600"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}
            >
              Modern Archetypes
            </button>
            <button
              onClick={() => {
                setActiveEra("historical");
                setLocalSelectedArchetype(null);
              }}
              className={cn(
                "cursor-pointer rounded-md px-4 py-1.5 text-xs font-semibold transition-all duration-300",
                activeEra === "historical"
                  ? "bg-blue-500 font-bold text-white shadow-md dark:bg-blue-600"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}
            >
              Historical Archetypes
            </button>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800" />

          {/* Standalone Skip Button with standard outline styling */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSkipArchetype}
            className="border-zinc-200 bg-transparent text-xs text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50 dark:hover:text-white"
          >
            Skip Archetype
          </Button>
        </div>
      </div>

      {isLoadingArchetypes ? (
        <div className="flex flex-col items-center justify-center space-y-4 py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-sm text-zinc-400">Decoding faction templates...</p>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {visibleArchetypes.map((arch) => {
            const IconComponent = getArchetypeIcon(arch.id);
            const isSelected = localSelectedArchetype?.id === arch.id;
            const styleClasses = getArchetypeColorClass(arch.id);

            return (
              <motion.div
                key={arch.id}
                variants={itemVariants}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                onClick={() => setLocalSelectedArchetype(arch)}
                className="h-full cursor-pointer"
              >
                <CutoutCard
                  className={cn(
                    cutoutCardSurfaceClassName,
                    "flex h-full flex-col justify-between overflow-hidden border transition-all duration-300",
                    isSelected
                      ? "border-blue-500 bg-blue-500/5 shadow-[0_0_25px_rgba(59,130,246,0.25)] ring-1 ring-blue-500/50 dark:bg-blue-500/10"
                      : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700/80"
                  )}
                  texture="dots"
                  textureOpacity={isSelected ? 0.08 : 0.03}
                >
                  <CutoutCardContent className="flex h-full flex-col justify-between space-y-4 p-5">
                    {/* Header */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div
                          className={cn(
                            "rounded-lg border p-2",
                            styleClasses.split(" ")[1],
                            styleClasses.split(" ")[2]
                          )}
                        >
                          <IconComponent className={cn("h-5 w-5", styleClasses.split(" ")[0])} />
                        </div>
                        {isSelected && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 font-bold text-white">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-zinc-900 transition-colors duration-200 group-hover:text-blue-600 dark:text-zinc-100 dark:group-hover:text-blue-400">
                          {arch.name}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          <span className="rounded border border-zinc-200/80 bg-zinc-100/80 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-zinc-600 uppercase dark:border-zinc-700/50 dark:bg-zinc-800 dark:text-zinc-400">
                            {arch.region}
                          </span>
                          <span
                            className={cn(
                              "rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase",
                              getComplexityBadgeClass(arch.implementationComplexity)
                            )}
                          >
                            Complexity: {arch.implementationComplexity || "Medium"}
                          </span>
                        </div>
                      </div>
                      <p className="line-clamp-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {arch.description}
                      </p>
                    </div>

                    {/* Faction traits / characteristics */}
                    <div className="space-y-2.5">
                      <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800/60">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                            Traits & Modifiers
                          </span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={(e) => e.stopPropagation()}
                                  className="cursor-pointer text-zinc-400 hover:text-zinc-200 dark:text-zinc-500 dark:hover:text-zinc-300"
                                >
                                  <CircleHelp className="h-3 w-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-xs border border-zinc-200 bg-white/95 px-3 py-2 text-[10px] text-zinc-700 shadow-md backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/95 dark:text-zinc-300"
                              >
                                Traits & modifiers seed your nation's starting bonuses, penalties,
                                and operational characteristics in the simulation.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {(arch.characteristics || [])
                            .slice(0, 3)
                            .map((trait: string, idx: number) => (
                              <span
                                key={idx}
                                className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-700 dark:border-zinc-800/80 dark:bg-zinc-900 dark:text-zinc-300"
                              >
                                ✦ {trait}
                              </span>
                            ))}
                        </div>
                      </div>

                      {/* Stat Bars (Growth, Innovation, Stability) */}
                      {arch.growthMetrics && (
                        <div className="space-y-1.5 border-t border-zinc-200 pt-3 dark:border-zinc-800/60">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                              Alignment Profile
                            </span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={(e) => e.stopPropagation()}
                                    className="cursor-pointer text-zinc-400 hover:text-zinc-200 dark:text-zinc-500 dark:hover:text-zinc-300"
                                  >
                                    <CircleHelp className="h-3 w-3" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="top"
                                  className="max-w-xs border border-zinc-200 bg-white/95 px-3 py-2 text-[10px] text-zinc-700 shadow-md backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/95 dark:text-zinc-300"
                                >
                                  The starting position of your nation's values. Innovation
                                  represents reform/technology focus, while Stability represents
                                  order/institutions.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1.5">
                            <div className="space-y-0.5">
                              <div className="flex justify-between text-[9px] text-zinc-600 dark:text-zinc-400">
                                <span>Innovation</span>
                                <span>{arch.growthMetrics.innovationIndex || 50}%</span>
                              </div>
                              <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                                <div
                                  className="h-full rounded-full bg-cyan-400"
                                  style={{
                                    width: `${arch.growthMetrics.innovationIndex || 50}%`,
                                  }}
                                />
                              </div>
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex justify-between text-[9px] text-zinc-600 dark:text-zinc-400">
                                <span>Stability</span>
                                <span>{arch.growthMetrics.stability || 50}%</span>
                              </div>
                              <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                                <div
                                  className="h-full rounded-full bg-emerald-400"
                                  style={{ width: `${arch.growthMetrics.stability || 50}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CutoutCardContent>
                </CutoutCard>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Sentinel for infinite loading - always rendered so observer ref is attached, hidden visually when done/loading */}
      <div
        ref={loaderRef}
        className={cn(
          "flex justify-center py-8",
          (isLoadingArchetypes || visibleCount >= archetypes.length) && "hidden"
        )}
      >
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <div className="h-4 w-4 animate-spin rounded-full border border-blue-500 border-t-transparent" />
          Loading more archetypes...
        </div>
      </div>

      {/* Confirmation Actions */}
      <AnimatePresence>
        {localSelectedArchetype && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed right-0 bottom-6 left-0 z-50 flex justify-center px-4"
          >
            <div className="flex w-full max-w-2xl items-center justify-between gap-6 rounded-xl border border-zinc-200/80 bg-white/95 px-6 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-lg dark:border-zinc-800/80 dark:bg-zinc-950/95 dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Selected Archetype
                  </span>
                </div>
                <h4 className="text-sm leading-none font-bold text-zinc-900 dark:text-zinc-100">
                  {localSelectedArchetype.name}
                </h4>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setLocalSelectedArchetype(null)}
                  className="border-zinc-200 bg-transparent text-xs text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50 dark:hover:text-white"
                >
                  Clear Selection
                </Button>
                <Button
                  onClick={handleConfirmFaction}
                  className="bg-blue-600 text-xs font-bold text-white transition-colors duration-200 hover:bg-blue-500"
                >
                  <UserCheck className="mr-1.5 h-4 w-4 stroke-[2.5]" /> Use Archetype & Continue
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
