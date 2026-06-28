"use client";

// src/components/wiki-os/reader/WikiOSNarratorPlayer.tsx
// Front-end UI player bar component for Onoma Voice full-article narrator in WikiOS.
// Frosted glass UI featuring play/pause state controls, speed slider,
// voice select overrides, progress tracking, and animation overlays.

import { useEffect, useState } from "react";
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
  ChevronDown,
  Gauge,
  User,
  Scroll,
  Trash2,
} from "lucide-react";
import { cn } from "~/lib/utils";

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

export function WikiOSNarratorPlayer() {
  const { narratorState, narratorActions, themeColors } = useWikiContext() as any;

  const isVisible = !!(narratorState && narratorState.totalBlocks > 0 && narratorActions);

  // Load Kokoro voice options (must be called unconditionally before early return)
  const { data: voicesData } = api.onoma.getKokoroVoices.useQuery(undefined, {
    staleTime: 600000,
    enabled: isVisible,
  });

  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("onoma-narrator-autoscroll");
      setAutoScroll(stored !== "false");
    }
  }, []);

  // If no narrator hooks are active or no blocks are parsed, don't show the player
  if (!isVisible) {
    return null;
  }

  const { isPlaying, activeBlockIndex, totalBlocks, speed, voice } = narratorState;
  const { play, pause, stop, skipNext, skipPrev, setSpeed, setVoice, clearCache } = narratorActions;

  const voiceOptions = voicesData?.voices ?? Object.keys(VOICE_LABELS);

  const handleToggleAutoScroll = () => {
    const next = !autoScroll;
    setAutoScroll(next);
    localStorage.setItem("onoma-narrator-autoscroll", String(next));
  };

  const progressPct = totalBlocks > 0 ? (activeBlockIndex / totalBlocks) * 100 : 0;

  return (
    <div
      className="wikios-narrator-player glass-hierarchy-child relative mb-6 flex flex-col items-center justify-between gap-4 overflow-hidden rounded-xl border border-black/10 p-3.5 text-left shadow-md backdrop-blur-md transition-all duration-300 select-none md:flex-row dark:border-white/10"
      style={{
        borderColor: isPlaying && themeColors?.secondary ? `${themeColors.secondary}30` : undefined,
        boxShadow:
          isPlaying && themeColors?.primary
            ? `0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 0 12px 1px ${themeColors.primary}05`
            : undefined,
      }}
    >
      {/* Decorative gradient overlay when playing */}
      {isPlaying && (
        <div
          className="pointer-events-none absolute -inset-1 animate-pulse opacity-[0.03]"
          style={{
            background: `radial-gradient(circle, ${themeColors?.primary || "#0091ff"} 0%, transparent 70%)`,
          }}
        />
      )}

      {/* Title & Reading progress */}
      <div className="relative z-10 flex w-full items-center gap-3 md:w-auto">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300",
            isPlaying
              ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
              : "text-muted-foreground bg-black/5 dark:bg-white/5"
          )}
          style={{
            backgroundColor:
              isPlaying && themeColors?.primary ? `${themeColors.primary}15` : undefined,
            color: isPlaying && themeColors?.primary ? themeColors.primary : undefined,
          }}
        >
          {isPlaying ? (
            <Volume2 className="h-4.5 w-4.5 animate-bounce" />
          ) : (
            <VolumeX className="h-4.5 w-4.5" />
          )}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-foreground text-xs font-bold tracking-wide">
            Onoma Natural Voice Narrator
          </span>
          <span className="text-muted-foreground max-w-[280px] truncate text-[10px]">
            {isPlaying
              ? `Reading: ${narratorState.activeSectionTitle || "Overview"} (${activeBlockIndex}/${totalBlocks})`
              : "Narrator Idle — Click Play to listen to this article"}
          </span>
        </div>
      </div>

      {/* Central Playback Controls */}
      <div className="relative z-10 flex items-center gap-2">
        {/* Skip Prev */}
        <button
          onClick={skipPrev}
          disabled={activeBlockIndex <= 1}
          className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-all hover:bg-black/5 active:scale-95 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-white/5"
          title="Previous section"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Play/Pause */}
        {isPlaying ? (
          <button
            onClick={pause}
            className="text-foreground flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-black/5 bg-black/5 px-4 text-xs font-bold transition-all hover:bg-black/10 active:scale-95 dark:border-white/5 dark:bg-white/10 dark:hover:bg-white/15"
            title="Pause narration"
          >
            <Pause className="h-3.5 w-3.5 fill-current" />
            <span>Pause</span>
          </button>
        ) : (
          <button
            onClick={play}
            className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-bold text-white transition-all active:scale-95"
            style={{
              backgroundColor: themeColors?.primary || "#0091ff",
            }}
            title="Listen to article"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Listen</span>
          </button>
        )}

        {/* Stop */}
        <button
          onClick={stop}
          disabled={activeBlockIndex === 0}
          className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-all hover:bg-black/5 active:scale-95 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-white/5"
          title="Stop reading"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </button>

        {/* Skip Next */}
        <button
          onClick={skipNext}
          disabled={activeBlockIndex >= totalBlocks}
          className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-all hover:bg-black/5 active:scale-95 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-white/5"
          title="Next section"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Voice, Speed, & Auto-Scroll Preferences */}
      <div className="relative z-10 flex w-full flex-wrap items-center justify-end gap-3 text-[11px] font-semibold md:w-auto">
        {/* Speed Adjustment */}
        <div className="flex items-center gap-1.5">
          <Gauge className="text-muted-foreground h-3.5 w-3.5" />
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="bg-background/80 text-foreground cursor-pointer rounded border border-black/10 px-1.5 py-1 font-mono text-[11px] transition-colors hover:border-black/20 focus:outline-none dark:border-white/10 dark:bg-zinc-950 dark:hover:border-white/20"
          >
            <option value="0.8">0.8x</option>
            <option value="1.0">1.0x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2.0">2.0x</option>
          </select>
        </div>

        {/* Voice Selector Override */}
        <div className="flex items-center gap-1.5">
          <User className="text-muted-foreground h-3.5 w-3.5" />
          <select
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className="bg-background/80 text-foreground max-w-[130px] cursor-pointer truncate rounded border border-black/10 px-1.5 py-1 text-[11px] transition-colors hover:border-black/20 focus:outline-none dark:border-white/10 dark:bg-zinc-950 dark:hover:border-white/20"
          >
            <option value="">Default voice</option>
            {voiceOptions.map((id) => (
              <option key={id} value={id}>
                {VOICE_LABELS[id] || id}
              </option>
            ))}
          </select>
        </div>

        {/* Auto-Scroll Toggle */}
        <button
          onClick={handleToggleAutoScroll}
          className={cn(
            "flex items-center gap-1 rounded border px-2 py-1 transition-all active:scale-95",
            autoScroll
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
              : "bg-background/80 text-muted-foreground border-black/10 hover:border-black/20 dark:border-white/10 dark:bg-zinc-950 dark:hover:border-white/20"
          )}
          title="Auto-scroll window to follow currently spoken block"
        >
          <Scroll className="h-3 w-3" />
          <span>Follow Scroll</span>
        </button>

        {/* Clear Cache */}
        {clearCache && (
          <button
            onClick={clearCache}
            className={cn(
              "flex items-center gap-1 rounded border px-2 py-1 transition-all active:scale-95",
              "bg-background/80 text-muted-foreground border-black/10 hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-500 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-red-500/15"
            )}
            title="Clear saved voice audio cache"
          >
            <Trash2 className="h-3 w-3" />
            <span>Clear Cache</span>
          </button>
        )}
      </div>

      {/* Progress track background underlay */}
      <div className="pointer-events-none absolute bottom-0 left-0 h-[3px] w-full bg-black/5 dark:bg-white/5">
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{
            width: `${progressPct}%`,
            backgroundColor: themeColors?.primary || undefined,
          }}
        />
      </div>
    </div>
  );
}
