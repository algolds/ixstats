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
  const { play, pause, stop, skipNext, skipPrev, setSpeed, setVoice } = narratorActions;

  const voiceOptions = voicesData?.voices ?? Object.keys(VOICE_LABELS);

  const handleToggleAutoScroll = () => {
    const next = !autoScroll;
    setAutoScroll(next);
    localStorage.setItem("onoma-narrator-autoscroll", String(next));
  };

  const progressPct = totalBlocks > 0 ? (activeBlockIndex / totalBlocks) * 100 : 0;

  return (
    <div
      className="wikios-narrator-player glass-hierarchy-child border border-black/10 dark:border-white/10 rounded-xl p-3.5 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 text-left select-none shadow-md backdrop-blur-md relative overflow-hidden transition-all duration-300"
      style={{
        borderColor: isPlaying && themeColors?.secondary ? `${themeColors.secondary}30` : undefined,
        boxShadow: isPlaying && themeColors?.primary ? `0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 0 12px 1px ${themeColors.primary}05` : undefined,
      }}
    >
      {/* Decorative gradient overlay when playing */}
      {isPlaying && (
        <div
          className="absolute -inset-1 opacity-[0.03] pointer-events-none animate-pulse"
          style={{
            background: `radial-gradient(circle, ${themeColors?.primary || "#0091ff"} 0%, transparent 70%)`,
          }}
        />
      )}

      {/* Title & Reading progress */}
      <div className="flex items-center gap-3 w-full md:w-auto relative z-10">
        <div
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-300",
            isPlaying ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400" : "bg-black/5 dark:bg-white/5 text-muted-foreground"
          )}
          style={{
            backgroundColor: isPlaying && themeColors?.primary ? `${themeColors.primary}15` : undefined,
            color: isPlaying && themeColors?.primary ? themeColors.primary : undefined,
          }}
        >
          {isPlaying ? (
            <Volume2 className="h-4.5 w-4.5 animate-bounce" />
          ) : (
            <VolumeX className="h-4.5 w-4.5" />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-foreground text-xs font-bold tracking-wide">
            Onoma Natural Voice Narrator
          </span>
          <span className="text-muted-foreground text-[10px] truncate max-w-[280px]">
            {isPlaying
              ? `Reading: ${narratorState.activeSectionTitle || "Overview"} (${activeBlockIndex}/${totalBlocks})`
              : "Narrator Idle — Click Play to listen to this article"}
          </span>
        </div>
      </div>

      {/* Central Playback Controls */}
      <div className="flex items-center gap-2 relative z-10">
        {/* Skip Prev */}
        <button
          onClick={skipPrev}
          disabled={activeBlockIndex <= 1}
          className="text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 p-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
          title="Previous section"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Play/Pause */}
        {isPlaying ? (
          <button
            onClick={pause}
            className="h-9 px-4 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-foreground flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer border border-black/5 dark:border-white/5"
            title="Pause narration"
          >
            <Pause className="h-3.5 w-3.5 fill-current" />
            <span>Pause</span>
          </button>
        ) : (
          <button
            onClick={play}
            className="h-9 px-4 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold text-white transition-all active:scale-95 cursor-pointer"
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
          className="text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 p-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
          title="Stop reading"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </button>

        {/* Skip Next */}
        <button
          onClick={skipNext}
          disabled={activeBlockIndex >= totalBlocks}
          className="text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 p-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
          title="Next section"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Voice, Speed, & Auto-Scroll Preferences */}
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end relative z-10 text-[11px] font-semibold">
        {/* Speed Adjustment */}
        <div className="flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="bg-background/80 dark:bg-zinc-950 border border-black/10 dark:border-white/10 rounded px-1.5 py-1 text-[11px] focus:outline-none font-mono text-foreground hover:border-black/20 dark:hover:border-white/20 transition-colors cursor-pointer"
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
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className="bg-background/80 dark:bg-zinc-950 border border-black/10 dark:border-white/10 rounded px-1.5 py-1 text-[11px] max-w-[130px] truncate focus:outline-none text-foreground hover:border-black/20 dark:hover:border-white/20 transition-colors cursor-pointer"
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
            "flex items-center gap-1 border rounded px-2 py-1 transition-all active:scale-95",
            autoScroll
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
              : "border-black/10 dark:border-white/10 bg-background/80 dark:bg-zinc-950 text-muted-foreground hover:border-black/20 dark:hover:border-white/20"
          )}
          title="Auto-scroll window to follow currently spoken block"
        >
          <Scroll className="h-3 w-3" />
          <span>Follow Scroll</span>
        </button>
      </div>

      {/* Progress track background underlay */}
      <div className="absolute bottom-0 left-0 w-full h-[3px] bg-black/5 dark:bg-white/5 pointer-events-none">
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
