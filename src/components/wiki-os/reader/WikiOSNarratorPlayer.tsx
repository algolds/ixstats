"use client";

// src/components/wiki-os/reader/WikiOSNarratorPlayer.tsx
// Floating Halo pill for the Onoma Voice full-article narrator in WikiOS.
// Facet glass, single Onoma accent, Apple-style micro-animations: mounts with a
// slide-up, controls expand horizontally on hover/play, buttons spring on press.
// Speed / voice / follow-scroll / clear-cache live in a "⋯" Facet popover.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { api } from "~/trpc/react";
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  User,
  Scroll,
  Trash2,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { FacetContainer } from "~/components/ui/facet-container";

// Onoma brand accent (matches the Onoma lab UI).
const ACCENT = "#0091ff";

// Friendly voice labels
const VOICE_LABELS: Record<string, string> = {
  af_heart: "Female US - Soft",
  af_bella: "Female US - Bright",
  af_nicole: "Female US - Whisper",
  af_sarah: "Female US - Warm",
  am_adam: "Male US - Clear",
  am_michael: "Male US - Deep",
  bf_emma: "Female UK - Noble",
  bf_isabella: "Female UK - Expressive",
  bm_george: "Male UK - Gravel",
  bm_lewis: "Male UK - Mellow",
};

const SPEEDS = [0.8, 1.0, 1.25, 1.5, 2.0];

// Apple-ish spring on press, shared by all icon buttons.
const iconBtn =
  "text-muted-foreground hover:text-foreground flex items-center justify-center rounded-full p-1.5 transition-all duration-200 hover:bg-black/5 active:scale-90 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-white/10";

export function WikiOSNarratorPlayer() {
  const { narratorState, narratorActions } = useWikiContext() as any;

  const isVisible = !!(narratorState && narratorState.totalBlocks > 0 && narratorActions);

  // Load Kokoro voice options (must be called unconditionally before early return)
  const { data: voicesData } = api.onoma.getKokoroVoices.useQuery(undefined, {
    staleTime: 600000,
    enabled: isVisible,
  });

  const [autoScroll, setAutoScroll] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Drives the slide-up entrance once on mount.
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAutoScroll(localStorage.getItem("onoma-narrator-autoscroll") !== "false");
    }
  }, []);

  if (!isVisible) return null;

  const { isPlaying, activeBlockIndex, totalBlocks, speed, voice } = narratorState;
  const { play, pause, stop, skipNext, skipPrev, setSpeed, setVoice, clearCache } = narratorActions;

  const voiceOptions: string[] = voicesData?.voices ?? Object.keys(VOICE_LABELS);
  const progressPct = totalBlocks > 0 ? (activeBlockIndex / totalBlocks) * 100 : 0;
  const expanded = isPlaying || hovered;

  const handleToggleAutoScroll = () => {
    const next = !autoScroll;
    setAutoScroll(next);
    localStorage.setItem("onoma-narrator-autoscroll", String(next));
  };

  // Portal to body: the WikiOS reader wraps content in a 3D `transform`, which would
  // otherwise capture this fixed-position pill and push it offscreen.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "fixed bottom-4 left-1/2 z-[100040] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 transition-all duration-500 ease-out select-none",
        mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      )}
    >
      <FacetContainer
        variant="base"
        depth={3}
        interactive="none"
        className="relative flex items-center gap-2 overflow-hidden rounded-full border border-black/10 py-2 pr-2 pl-3 shadow-xl backdrop-blur-xl dark:border-white/10"
      >
        {/* Speaker glyph — pulses while reading */}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-300"
          style={{
            backgroundColor: isPlaying ? `${ACCENT}1a` : undefined,
            color: isPlaying ? ACCENT : undefined,
          }}
        >
          {isPlaying ? (
            <Volume2 className="h-4.5 w-4.5 animate-pulse" />
          ) : (
            <VolumeX className="text-muted-foreground h-4.5 w-4.5" />
          )}
        </div>

        {/* Status */}
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-foreground truncate text-xs font-semibold">
            {isPlaying ? narratorState.activeSectionTitle || "Overview" : "Onoma Voice"}
          </span>
          <span className="text-muted-foreground truncate text-[10px]">
            {isPlaying
              ? `Reading ${activeBlockIndex} of ${totalBlocks}`
              : "Listen to this article"}
          </span>
        </div>

        {/* Skip prev — part of the expanding cluster */}
        <div
          className={cn(
            "flex items-center overflow-hidden transition-all duration-300 ease-out",
            expanded ? "max-w-10 opacity-100" : "max-w-0 opacity-0"
          )}
        >
          <button onClick={skipPrev} disabled={activeBlockIndex <= 1} className={iconBtn} title="Previous section">
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Play / Pause — primary, always visible */}
        {isPlaying ? (
          <button
            onClick={pause}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-all duration-200 hover:scale-105 active:scale-90"
            style={{ backgroundColor: ACCENT }}
            title="Pause"
          >
            <Pause className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            onClick={play}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:scale-105 active:scale-90"
            style={{ backgroundColor: ACCENT }}
            title="Listen to article"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Listen</span>
          </button>
        )}

        {/* Stop + skip-next + overflow — expanding cluster */}
        <div
          className={cn(
            "flex items-center overflow-hidden transition-all duration-300 ease-out",
            expanded ? "max-w-32 opacity-100" : "max-w-0 opacity-0"
          )}
        >
          <button onClick={stop} disabled={activeBlockIndex === 0} className={iconBtn} title="Stop">
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
          <button onClick={skipNext} disabled={activeBlockIndex >= totalBlocks} className={iconBtn} title="Next section">
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* ⋯ — speed / voice / follow-scroll / clear-cache */}
          <Popover>
            <PopoverTrigger className={iconBtn} title="Narrator settings">
              <MoreHorizontal className="h-4 w-4" />
            </PopoverTrigger>
            <PopoverContent align="end" side="top" sideOffset={10} className="w-60">
              {/* Speed — segmented pills */}
              <div className="mb-3">
                <span className="text-muted-foreground mb-1.5 block text-[10px] font-semibold tracking-wide uppercase">
                  Speed
                </span>
                <div className="flex gap-1">
                  {SPEEDS.map((s) => {
                    const active = Number(speed) === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setSpeed(s)}
                        className={cn(
                          "flex-1 rounded-lg py-1 text-[11px] font-semibold transition-all duration-200 active:scale-90",
                          active
                            ? "text-white"
                            : "text-muted-foreground hover:text-foreground bg-black/5 dark:bg-white/5"
                        )}
                        style={active ? { backgroundColor: ACCENT } : undefined}
                      >
                        {s}×
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Voice */}
              <div className="mb-3">
                <span className="text-muted-foreground mb-1.5 flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase">
                  <User className="h-3 w-3" /> Voice
                </span>
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="bg-background/80 text-foreground w-full cursor-pointer rounded-lg border border-black/10 px-2 py-1.5 text-xs transition-colors hover:border-black/20 focus:outline-none dark:border-white/10 dark:hover:border-white/20"
                >
                  <option value="">Default voice</option>
                  {voiceOptions.map((id) => (
                    <option key={id} value={id}>
                      {VOICE_LABELS[id] || id}
                    </option>
                  ))}
                </select>
              </div>

              {/* Follow scroll + clear cache */}
              <button
                onClick={handleToggleAutoScroll}
                className="mb-1.5 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              >
                <span className="flex items-center gap-2">
                  <Scroll className="h-3.5 w-3.5" /> Follow scroll
                </span>
                <span
                  className={cn(
                    "relative h-4 w-7 rounded-full transition-colors duration-200",
                    autoScroll ? "" : "bg-black/15 dark:bg-white/15"
                  )}
                  style={autoScroll ? { backgroundColor: ACCENT } : undefined}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all duration-200",
                      autoScroll ? "left-3.5" : "left-0.5"
                    )}
                  />
                </span>
              </button>
              {clearCache && (
                <button
                  onClick={clearCache}
                  className="text-muted-foreground flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors hover:bg-red-500/10 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear voice cache
                </button>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Progress line — inset so the rounded ends don't clip it */}
        <div className="pointer-events-none absolute right-6 bottom-1 left-6 h-[2px] rounded-full bg-black/5 dark:bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%`, backgroundColor: ACCENT }}
          />
        </div>
      </FacetContainer>
    </div>,
    document.body
  );
}
