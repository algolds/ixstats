import { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  X,
  MapPin,
  Users,
  TrendingUp,
} from "lucide-react";
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
  const { data: countryData } = api.countries.getByNameWithAtomic.useQuery(
    { name: currentStepData?.name ?? "" },
    { enabled: !!currentStepData?.name, staleTime: 30 * 60_000 }
  );

  // 2. Fetch country stats by ID
  const { data: stats } = api.countries.getMapSummary.useQuery(
    { countryId: countryData?.id ?? "" },
    { enabled: !!countryData?.id, staleTime: 30 * 60_000 }
  );

  const capital = useMemo(() => {
    const rawCountry = countryData as any;
    return rawCountry?.nationalIdentity?.capitalCity || rawCountry?.capitalCity || currentStepData?.fallbackCapital || "—";
  }, [countryData, currentStepData]);

  if (!isVisible || !currentStepData) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-6 left-6 z-[40] w-full max-w-[380px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/85"
      >
        {/* Floating background gradient glow */}
        <div className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-cyan-500/10 blur-2xl" />

        {/* HUD Header */}
        <div className="relative border-b border-white/5 px-5 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {stats?.flagUrl ? (
                <img
                  src={stats.flagUrl}
                  alt={`${currentStepData.name} Flag`}
                  className="h-5 w-8 rounded object-cover shadow-md border border-white/10"
                />
              ) : (
                <div className="h-5 w-8 animate-pulse rounded bg-white/10" />
              )}
              <div>
                <h3 className="bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-base font-bold text-transparent">
                  {currentStepData.name}
                </h3>
                <span className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold">
                  Step {currentStepIndex + 1} of {totalSteps}
                </span>
              </div>
            </div>
            <button
              onClick={exitTour}
              className="rounded-full bg-white/5 p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* HUD Content / Lore */}
        <div className="relative px-5 py-4 space-y-4">
          <p className="text-[13px] leading-relaxed text-slate-300">
            {currentStepData.fallbackBlurb}
          </p>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-3">
            <div className="space-y-0.5 rounded-lg bg-white/5 p-2 text-center border border-white/5">
              <span className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider text-slate-400">
                <MapPin className="h-2.5 w-2.5 text-blue-400" />
                Capital
              </span>
              <p className="truncate text-xs font-semibold text-white">
                {capital}
              </p>
            </div>
            <div className="space-y-0.5 rounded-lg bg-white/5 p-2 text-center border border-white/5">
              <span className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider text-slate-400">
                <Users className="h-2.5 w-2.5 text-cyan-400" />
                Population
              </span>
              <p className="truncate text-xs font-semibold text-white">
                {formatPopulation(stats?.population)}
              </p>
            </div>
            <div className="space-y-0.5 rounded-lg bg-white/5 p-2 text-center border border-white/5">
              <span className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider text-slate-400">
                <TrendingUp className="h-2.5 w-2.5 text-emerald-400" />
                GDP (Total)
              </span>
              <p className="truncate text-xs font-semibold text-white">
                {formatGDP(stats?.totalGdp)}
              </p>
            </div>
          </div>
        </div>

        {/* Playback Controls & Skip button */}
        <div className="relative flex items-center justify-between border-t border-white/5 px-5 py-3.5 bg-slate-900/40">
          <div className="flex items-center gap-2">
            <button
              onClick={prevStep}
              disabled={currentStepIndex === 0}
              className="rounded-lg bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:hover:bg-white/5 disabled:hover:text-slate-300 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={togglePause}
              className="rounded-lg bg-blue-500 p-2 text-white hover:bg-blue-600 shadow-md shadow-blue-500/10 transition-colors"
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button
              onClick={nextStep}
              className="rounded-lg bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={exitTour}
            className="text-xs font-medium text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors border border-white/5"
          >
            Exit Tour
          </button>
        </div>

        {/* Progress Bar indicator */}
        <div className="relative h-1 w-full bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-400 transition-all duration-100"
            style={{ width: `${tourState === "paused_at_step" ? progress : 0}%` }}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
