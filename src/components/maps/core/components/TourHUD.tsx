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
import { FacetMaterial } from "~/components/ui/facet";
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
import { Card } from "~/components/ui/card";

const STALE_TIME = { staleTime: 30 * 60_000 };

/** First two sentences of the wiki intro's first paragraph, with link markup stripped. */
const condenseIntro = (paragraphs: string[] | undefined) =>
  paragraphs?.[0]
    ?.replace(/<[^>]+>/g, "")
    .split(/(?<=[.!?])\s+/)
    .slice(0, 2)
    .join(" ") || null;

/** Country record, summary stats and wiki intro for the current tour stop. */
function useTourStepData(name: string | undefined) {
  const { data: countryData, isLoading: isCountryLoading } =
    api.countries.getByNameWithAtomic.useQuery(
      { name: name ?? "" },
      { enabled: !!name, ...STALE_TIME }
    );
  const { data: stats, isLoading: isStatsLoading } = api.countries.getMapSummary.useQuery(
    { countryId: countryData?.id ?? "" },
    { enabled: !!countryData?.id, ...STALE_TIME }
  );
  const { data: wikiIntro, isLoading: isWikiLoading } = api.countries.getWikiRichIntro.useQuery(
    { countryName: name ?? "" },
    { enabled: !!name, ...STALE_TIME }
  );

  return {
    stats,
    statsLoading: isCountryLoading || isStatsLoading,
    isWikiLoading,
    condensedIntro: condenseIntro(wikiIntro?.paragraphs),
    capital: stats?.capitalCity || countryData?.nationalIdentity?.capitalCity || null,
  };
}

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
  const { stats, statsLoading, isWikiLoading, condensedIntro, capital } = useTourStepData(
    currentStepData?.name
  );
  const isVisible = tourState !== "idle" && tourState !== "completed" && currentStepData;
  if (!isVisible || !currentStepData) return null;

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
        <FacetMaterial layer="chrome" className="rounded-card overflow-hidden">
          <div className="border-separator flex items-start justify-between border-b px-5 py-4">
            <div className="flex items-center gap-3">
              {statsLoading ? (
                <Skeleton className="rounded-control-sm h-5 w-8" />
              ) : stats?.flagUrl ? (
                <img
                  src={stats.flagUrl}
                  alt={`${currentStepData.name} Flag`}
                  className="border-separator rounded-control-sm h-5 w-8 border object-cover"
                />
              ) : (
                <div className="border-separator bg-fill-3 rounded-control-sm h-5 w-8 border" />
              )}
              <div>
                <h3 className="text-label text-title-3">{currentStepData.name}</h3>
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
              className="text-label-secondary -mt-1 -mr-2 h-8 w-8 rounded-full"
            >
              <X aria-hidden />
            </Button>
          </div>

          <div className="space-y-4 px-5 py-4">
            {isWikiLoading ? (
              <div className="space-y-2 py-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ) : (
              <p className="text-label-secondary text-body leading-relaxed">
                {condensedIntro || currentStepData.fallbackBlurb}
              </p>
            )}

            <dl className="border-separator grid grid-cols-3 gap-2 border-t pt-3">
              {quickStats.map(({ icon: Icon, label, value }) => (
                <Card variant="inset" key={label} className="space-y-1 p-2 text-center">
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
                      <p className="text-label text-caption truncate font-semibold">{value}</p>
                    )}
                  </dd>
                </Card>
              ))}
            </dl>
          </div>

          <div className="border-separator flex items-center justify-between border-t px-5 py-3">
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
                className="bg-blue text-on-blue hover:bg-blue/90"
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

          <div className="bg-fill-3 h-1 w-full">
            <div
              className="bg-blue h-full origin-left transition-transform duration-100"
              style={{
                transform: `scaleX(${tourState === "paused_at_step" ? progress / 100 : 0})`,
              }}
            />
          </div>
        </FacetMaterial>
      </motion.div>
    </AnimatePresence>
  );
}
