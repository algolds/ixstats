import { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Pause,
  NavArrowRight as ChevronRight,
  NavArrowLeft as ChevronLeft,
  Xmark as X,
  MapPin,
  Group as Users,
  StatUp as TrendingUp,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetCard, FacetContainer } from "~/components/ui/facet-container";
import { Skeleton } from "~/components/ui/skeleton";
import type { TourStep, TourState } from "../hooks/useMapTour";

interface TourHUDProps {
  tourState: TourState;
  currentStepIndex: number;
  isPaused: boolean;
  progress: number;
  exitTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  togglePause: () => void;
  currentStepData: TourStep | null;
  totalSteps: number;
}

import { formatPopulation, formatCurrency } from "~/lib/utils/format-utils";

export function TourHUD({
  tourState,
  currentStepIndex,
  isPaused,
  progress,
  exitTour,
  nextStep,
  prevStep,
  togglePause,
  currentStepData,
  totalSteps,
}: TourHUDProps) {
  const isVisible = tourState !== "idle" && tourState !== "completed" && currentStepData;

  // 1. Fetch country ID by name
  const { data: countryData, isLoading: isCountryLoading } =
    api.countries.getByNameWithAtomic.useQuery(
      { name: currentStepData?.name ?? "" },
      { enabled: !!currentStepData?.name, staleTime: 30 * 60_000 }
    );

  // 2. Fetch country stats by ID
  const { data: stats, isLoading: isStatsLoading } = api.countries.getMapSummary.useQuery(
    { countryId: countryData?.id ?? "" },
    { enabled: !!countryData?.id, staleTime: 30 * 60_000 }
  );

  // 3. Fetch wiki intro by name
  const { data: wikiIntro, isLoading: isWikiLoading } = api.countries.getWikiRichIntro.useQuery(
    { countryName: currentStepData?.name ?? "" },
    { enabled: !!currentStepData?.name, staleTime: 30 * 60_000 }
  );

  const capital = useMemo(() => {
    return stats?.capitalCity || countryData?.nationalIdentity?.capitalCity || null;
  }, [stats, countryData]);

  const wikiParagraphs = wikiIntro?.paragraphs;
  const condensedIntro = useMemo(() => {
    if (!wikiParagraphs || wikiParagraphs.length === 0) return null;
    const firstParagraph = wikiParagraphs[0];

    // Strip HTML links tags to extract clean text sentences
    const cleanText = firstParagraph.replace(/<[^>]+>/g, "");

    const sentences = cleanText.split(/(?<=[.!?])\s+/);
    const plainCondensed = sentences.slice(0, 2).join(" ");
    return plainCondensed;
  }, [wikiParagraphs]);

  if (!isVisible || !currentStepData) return null;

  const statsLoading = isCountryLoading || isStatsLoading;
  const quickStats = [
    { icon: MapPin, label: "Capital", value: capital || "—" },
    { icon: Users, label: "Population", value: formatPopulation(stats?.population) },
    { icon: TrendingUp, label: "GDP (total)", value: formatCurrency(stats?.totalGdp ?? 0) },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.95 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-6 left-6 z-40 w-[calc(100%-3rem)] max-w-[380px]"
      >
        <FacetContainer depth={2} className="overflow-hidden rounded-2xl">
          {/* HUD Header */}
          <div className="border-border flex items-start justify-between border-b px-5 py-4">
            <div className="flex items-center gap-3">
              {statsLoading ? (
                <Skeleton className="h-5 w-8 rounded" />
              ) : stats?.flagUrl ? (
                <img
                  src={stats.flagUrl}
                  alt={`${currentStepData.name} Flag`}
                  className="border-border h-5 w-8 rounded border object-cover"
                />
              ) : (
                <div className="border-border bg-muted h-5 w-8 rounded border" />
              )}
              <div>
                <h3 className="text-foreground text-base font-semibold">{currentStepData.name}</h3>
                <Eyebrow className="block">
                  Step {currentStepIndex + 1} of {totalSteps}
                </Eyebrow>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={exitTour}
              aria-label="Exit tour"
              className="text-muted-foreground -mt-1 -mr-2 h-8 w-8 rounded-full"
            >
              <X aria-hidden />
            </Button>
          </div>

          {/* HUD Content / Lore */}
          <div className="space-y-4 px-5 py-4">
            {isWikiLoading ? (
              <div className="space-y-2 py-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ) : (
              <p className="text-muted-foreground text-sm leading-relaxed">
                {condensedIntro || currentStepData.fallbackBlurb}
              </p>
            )}

            {/* Quick stats */}
            <dl className="border-border grid grid-cols-3 gap-2 border-t pt-3">
              {quickStats.map(({ icon: Icon, label, value }) => (
                <FacetCard
                  key={label}
                  surface="solid"
                  className="space-y-1 rounded-lg p-2 text-center"
                >
                  <dt>
                    <Eyebrow className="flex items-center justify-center gap-1">
                      <Icon className="h-3 w-3" aria-hidden />
                      {label}
                    </Eyebrow>
                  </dt>
                  <dd>
                    {statsLoading ? (
                      <Skeleton className="mx-auto h-3 w-16" />
                    ) : (
                      <p className="text-foreground truncate text-xs font-semibold">{value}</p>
                    )}
                  </dd>
                </FacetCard>
              ))}
            </dl>
          </div>

          {/* Playback controls */}
          <div className="border-border flex items-center justify-between border-t px-5 py-3">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={prevStep}
                disabled={currentStepIndex === 0}
                aria-label="Previous stop"
              >
                <ChevronLeft aria-hidden />
              </Button>
              <Button
                size="icon"
                onClick={togglePause}
                aria-label={isPaused ? "Resume tour" : "Pause tour"}
                className="bg-blue-600 text-white hover:bg-blue-600/90"
              >
                {isPaused ? <Play aria-hidden /> : <Pause aria-hidden />}
              </Button>
              <Button variant="secondary" size="icon" onClick={nextStep} aria-label="Next stop">
                <ChevronRight aria-hidden />
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={exitTour}>
              Exit tour
            </Button>
          </div>

          {/* Progress */}
          <div className="bg-muted h-1 w-full">
            <div
              className="h-full origin-left bg-blue-500 transition-transform duration-100"
              style={{
                transform: `scaleX(${tourState === "paused_at_step" ? progress / 100 : 0})`,
              }}
            />
          </div>
        </FacetContainer>
      </motion.div>
    </AnimatePresence>
  );
}
