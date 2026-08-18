import { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, ChevronRight, ChevronLeft, X, MapPin, Users, TrendingUp } from "lucide-react";
import { api } from "~/trpc/react";
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

function formatPopulation(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  return value.toLocaleString();
}

function formatGDP(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  return `$${value.toLocaleString()}`;
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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-6 left-6 z-[40] w-full max-w-[380px] overflow-hidden rounded-2xl border border-slate-200 bg-white/90 text-slate-800 shadow-2xl backdrop-blur-xl dark:border-border dark:bg-popover/90 dark:text-foreground dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
      >
        {/* Floating background gradient glow */}
        <div className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />
        <div className="pointer-events-none absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-cyan-500/10 blur-2xl" />

        {/* HUD Header */}
        <div className="relative border-b border-slate-100 px-5 py-4 dark:border-border/60">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {isCountryLoading || isStatsLoading ? (
                <div className="h-5 w-8 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
              ) : stats?.flagUrl ? (
                <img
                  src={stats.flagUrl}
                  alt={`${currentStepData.name} Flag`}
                  className="h-5 w-8 rounded border border-slate-200 object-cover shadow-md dark:border-border"
                />
              ) : (
                <div className="h-5 w-8 rounded border border-slate-200 bg-slate-100 dark:border-border dark:bg-secondary" />
              )}
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-foreground">
                  {currentStepData.name}
                </h3>
                <span className="text-[10px] font-semibold tracking-wider text-blue-600 uppercase dark:text-blue-400">
                  Step {currentStepIndex + 1} of {totalSteps}
                </span>
              </div>
            </div>
            <button
              onClick={exitTour}
              className="rounded-full bg-slate-100 p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 dark:bg-secondary dark:text-muted-foreground dark:hover:bg-white/10 dark:hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* HUD Content / Lore */}
        <div className="relative space-y-4 px-5 py-4">
          {isWikiLoading ? (
            <div className="animate-pulse space-y-2 py-1">
              <div className="h-3 w-full rounded bg-slate-200 dark:bg-white/10" />
              <div className="h-3 w-5/6 rounded bg-slate-200 dark:bg-white/10" />
              <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-white/10" />
            </div>
          ) : (
            <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
              {condensedIntro || currentStepData.fallbackBlurb}
            </p>
          )}

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 dark:border-border/60">
            <div className="space-y-0.5 rounded-lg border border-slate-100 bg-slate-50/50 p-2 text-center dark:border-border/40 dark:bg-secondary/40">
              <span className="flex items-center justify-center gap-1 text-[9px] tracking-wider text-slate-500 uppercase dark:text-muted-foreground">
                <MapPin className="h-2.5 w-2.5 text-blue-500 dark:text-blue-400" />
                Capital
              </span>
              {isCountryLoading || isStatsLoading ? (
                <div className="mx-auto mt-1 h-3 w-16 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
              ) : (
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-foreground">
                  {capital || "—"}
                </p>
              )}
            </div>
            <div className="space-y-0.5 rounded-lg border border-slate-100 bg-slate-50/50 p-2 text-center dark:border-border/40 dark:bg-secondary/40">
              <span className="flex items-center justify-center gap-1 text-[9px] tracking-wider text-slate-500 uppercase dark:text-muted-foreground">
                <Users className="h-2.5 w-2.5 text-cyan-500 dark:text-cyan-400" />
                Population
              </span>
              {isCountryLoading || isStatsLoading ? (
                <div className="mx-auto mt-1 h-3 w-16 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
              ) : (
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-foreground">
                  {formatPopulation(stats?.population)}
                </p>
              )}
            </div>
            <div className="space-y-0.5 rounded-lg border border-slate-100 bg-slate-50/50 p-2 text-center dark:border-border/40 dark:bg-secondary/40">
              <span className="flex items-center justify-center gap-1 text-[9px] tracking-wider text-slate-500 uppercase dark:text-muted-foreground">
                <TrendingUp className="h-2.5 w-2.5 text-emerald-500 dark:text-emerald-400" />
                GDP (Total)
              </span>
              {isCountryLoading || isStatsLoading ? (
                <div className="mx-auto mt-1 h-3 w-16 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
              ) : (
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-foreground">
                  {formatGDP(stats?.totalGdp)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Playback Controls & Skip button */}
        <div className="relative flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3.5 dark:border-border/60 dark:bg-secondary/50">
          <div className="flex items-center gap-2">
            <button
              onClick={prevStep}
              disabled={currentStepIndex === 0}
              className="rounded-lg bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-slate-100 disabled:hover:text-slate-600 dark:bg-secondary dark:text-slate-300 dark:hover:bg-secondary/80 dark:hover:text-white dark:disabled:hover:bg-secondary dark:disabled:hover:text-slate-300"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={togglePause}
              className="rounded-lg bg-blue-600 p-2 text-white shadow-md shadow-blue-500/10 transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button
              onClick={nextStep}
              className="rounded-lg bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={exitTour}
            className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:border-white/5 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            Exit Tour
          </button>
        </div>

        {/* Progress Bar indicator */}
        <div className="relative h-1 w-full bg-slate-100 dark:bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-400 transition-all duration-100"
            style={{ width: `${tourState === "paused_at_step" ? progress : 0}%` }}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
