// src/components/halo/wiki/WikiNarratorPlayer.tsx
// Kokoro TTS voice narrator player & article reading progress track.

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  User,
  Scroll,
  Trash2,
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { PlayPauseMorph } from "~/components/halo/PlayPauseMorph";
import { PreText } from "~/components/ui/pretext";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import {
  NARRATOR_ACCENT,
  NARRATOR_SPEEDS,
  NARRATOR_VOICE_LABELS,
} from "./types";

interface TOCEntry {
  id: string;
  text: string;
  level: number;
}

interface WikiNarratorPlayerProps {
  visibleToc: TOCEntry[];
  activeSectionId: string | null;
  themeColors?: { primary: string; secondary: string } | null;
  scrollPercent: number;
  sectionOffsets: Record<string, number>;
  narratorState: any;
  narratorActions: any;
}

export function WikiNarratorPlayer({
  visibleToc,
  activeSectionId,
  themeColors,
  scrollPercent,
  sectionOffsets,
  narratorState,
  narratorActions,
}: WikiNarratorPlayerProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const hasNarrator = !!(narratorState && narratorState.totalBlocks > 0 && narratorActions);
  const { data: voicesData } = api.onoma.getKokoroVoices.useQuery(undefined, {
    staleTime: 600000,
    enabled: hasNarrator,
  });
  const voiceOptions: string[] = voicesData?.voices ?? Object.keys(NARRATOR_VOICE_LABELS);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAutoScroll(localStorage.getItem("onoma-narrator-autoscroll") !== "false");
    }
  }, []);

  const handleToggleAutoScroll = () => {
    const next = !autoScroll;
    setAutoScroll(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("onoma-narrator-autoscroll", String(next));
    }
  };

  const isNarratorActive = !!(
    narratorState &&
    narratorState.totalBlocks > 0 &&
    (narratorState.isPlaying || narratorState.activeBlockIndex > 0)
  );

  const displayPercent = isNarratorActive
    ? (narratorState.activeBlockIndex / narratorState.totalBlocks) * 100
    : scrollPercent;

  const activeEntry = visibleToc.find((e) => e.id === activeSectionId);
  const activeSectionTitle = activeEntry?.text ?? "";

  const handleScrub = useCallback(
    (pct: number) => {
      if (isNarratorActive && narratorActions) {
        const targetIdx = Math.min(
          narratorState.totalBlocks - 1,
          Math.max(0, Math.round((pct / 100) * (narratorState.totalBlocks - 1)))
        );
        narratorActions.jumpToBlock(targetIdx);
      } else {
        const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (scrollHeight > 0) {
          window.scrollTo({
            top: (pct / 100) * scrollHeight,
            behavior: "smooth",
          });
        }
      }
    },
    [isNarratorActive, narratorActions, narratorState?.totalBlocks]
  );

  const updateScrollFromPointer = (e: React.PointerEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = (clickX / rect.width) * 100;
    const clampedPct = Math.min(100, Math.max(0, pct));

    if (isNarratorActive && narratorActions) {
      const targetIdx = Math.min(
        narratorState.totalBlocks - 1,
        Math.max(0, Math.round((clampedPct / 100) * (narratorState.totalBlocks - 1)))
      );
      narratorActions.jumpToBlock(targetIdx);
    } else {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        window.scrollTo({
          top: (clampedPct / 100) * scrollHeight,
          behavior: "auto",
        });
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateScrollFromPointer(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateScrollFromPointer(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <>
      {/* Progressive Scrubbing Track */}
      {visibleToc.length > 0 && (
        <div className="mb-4 px-1">
          <div className="text-muted-foreground mb-1.5 flex items-center justify-between text-[10px] font-semibold select-none">
            <span className="max-w-[200px] truncate">
              {isNarratorActive
                ? `Narrating: ${narratorState.activeSectionTitle || "Overview"}`
                : activeSectionTitle
                  ? `Reading: ${activeSectionTitle}`
                  : "Overview"}
            </span>
            <span className="tabular-nums">{Math.round(displayPercent)}%</span>
          </div>

          <div
            ref={trackRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="group relative flex h-3 w-full cursor-pointer touch-none items-center select-none"
            style={{ touchAction: "none" }}
          >
            {/* Background Track Line */}
            <div className="absolute left-0 h-1 w-full rounded-full bg-white/10" />

            {/* Active Progress Fill Line */}
            <div
              className="absolute left-0 h-1 rounded-full bg-blue-500"
              style={{
                width: `${displayPercent}%`,
                backgroundColor: themeColors?.primary ?? undefined,
              }}
            />

            {/* Section Ticks (Dots) */}
            {visibleToc.map((entry) => {
              const offset = sectionOffsets[entry.id] ?? 0;
              const isActive = activeSectionId === entry.id;
              return (
                <div
                  key={entry.id}
                  className="group/tick absolute top-1/2 z-20 flex h-3 w-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                  style={{ left: `${offset}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isNarratorActive && narratorActions) {
                      narratorActions.jumpToSection(entry.id);
                    } else {
                      handleScrub(offset);
                    }
                  }}
                >
                  <div
                    className={cn(
                      "h-1.5 w-1.5 rounded-full border transition-all duration-200",
                      isActive && !themeColors
                        ? "scale-125 border-blue-400 bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]"
                        : isActive
                          ? "scale-125"
                          : "border-white/20 bg-zinc-950 group-hover/tick:scale-110 group-hover/tick:border-white"
                    )}
                    style={
                      isActive && themeColors
                        ? {
                            borderColor: themeColors.secondary,
                            backgroundColor: themeColors.primary,
                            boxShadow: `0 0 8px ${themeColors.primary}`,
                          }
                        : undefined
                    }
                  />
                  {/* Tooltip */}
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 rounded border border-white/10 bg-zinc-950/95 px-2 py-1 text-[9px] font-bold whitespace-nowrap text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover/tick:opacity-100">
                    {entry.text}
                  </span>
                </div>
              );
            })}

            {/* Glowing Scrubber Playhead Handle */}
            <div
              className="absolute z-30 h-3 w-3 -translate-x-1/2 cursor-grab rounded-full border border-blue-500 bg-white shadow-[0_0_8px_rgba(59,130,246,0.6)] transition-transform hover:scale-115 active:cursor-grabbing"
              style={{
                left: `${displayPercent}%`,
                borderColor: themeColors?.primary ?? undefined,
                boxShadow: themeColors ? `0 0 8px ${themeColors.primary}` : undefined,
              }}
            />
          </div>
        </div>
      )}

      {/* Narrator player controls */}
      {hasNarrator && (
        <div className="mb-3">
          <div className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
            <PreText whiteSpace="nowrap">Narrator</PreText>
          </div>
          <div className="flex items-center justify-center gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-3">
            <button
              type="button"
              onClick={narratorActions.skipPrev}
              disabled={narratorState.activeBlockIndex <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-90 disabled:pointer-events-none disabled:opacity-30"
              title="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() =>
                narratorState.isPlaying ? narratorActions.pause() : narratorActions.play()
              }
              className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-md transition-all duration-200 hover:scale-105 active:scale-90"
              style={{ backgroundColor: NARRATOR_ACCENT }}
              title={narratorState.isPlaying ? "Pause" : "Play"}
            >
              <PlayPauseMorph
                isPlaying={narratorState.isPlaying}
                size={20}
                className="fill-current text-white"
              />
            </button>

            <button
              type="button"
              onClick={narratorActions.skipNext}
              disabled={narratorState.activeBlockIndex >= narratorState.totalBlocks}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-90 disabled:pointer-events-none disabled:opacity-30"
              title="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <Popover>
              <PopoverTrigger
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-90"
                title="Narrator settings"
              >
                <MoreHorizontal className="h-4 w-4" />
              </PopoverTrigger>
              <PopoverContent
                align="end"
                side="top"
                sideOffset={10}
                className="w-60 rounded-xl border border-white/10 bg-zinc-950/95 p-3 backdrop-blur-xl dark:bg-black/90"
              >
                {/* Speed */}
                <div className="mb-3">
                  <span className="text-muted-foreground mb-1.5 block text-[10px] font-semibold tracking-wide uppercase">
                    Speed
                  </span>
                  <div className="flex gap-1">
                    {NARRATOR_SPEEDS.map((s) => {
                      const active = Number(narratorState.speed) === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => narratorActions.setSpeed(s)}
                          className={cn(
                            "flex-1 rounded-lg py-1 text-[11px] font-semibold transition-all duration-200 active:scale-90",
                            active
                              ? "text-white"
                              : "text-muted-foreground hover:text-foreground bg-white/5"
                          )}
                          style={active ? { backgroundColor: NARRATOR_ACCENT } : undefined}
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
                    value={narratorState.voice || ""}
                    onChange={(e) => narratorActions.setVoice(e.target.value)}
                    className="text-foreground w-full cursor-pointer rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs transition-colors hover:border-white/20 focus:outline-none"
                  >
                    <option value="">Default voice</option>
                    {voiceOptions.map((id) => (
                      <option key={id} value={id}>
                        {NARRATOR_VOICE_LABELS[id] || id}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Follow scroll */}
                <button
                  type="button"
                  onClick={handleToggleAutoScroll}
                  className="mb-1 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-medium transition-colors hover:bg-white/5"
                >
                  <span className="flex items-center gap-2">
                    <Scroll className="h-3.5 w-3.5" /> Follow scroll
                  </span>
                  <span
                    className={cn(
                      "relative h-4 w-7 rounded-full transition-colors duration-200",
                      autoScroll ? "" : "bg-white/15"
                    )}
                    style={autoScroll ? { backgroundColor: NARRATOR_ACCENT } : undefined}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all duration-200",
                        autoScroll ? "left-3.5" : "left-0.5"
                      )}
                    />
                  </span>
                </button>

                {/* Clear cache */}
                {narratorActions.clearCache && (
                  <button
                    type="button"
                    onClick={narratorActions.clearCache}
                    className="text-muted-foreground flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Clear voice cache
                  </button>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
    </>
  );
}
