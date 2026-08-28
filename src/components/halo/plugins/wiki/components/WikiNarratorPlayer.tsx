"use client";
// src/components/halo/plugins/wiki/components/WikiNarratorPlayer.tsx
// Unified narrator audio player built with audio-ui.xyz components (ghost variant, Transport, Fader).
// Theme compliant with WikiOS accents, ambient animated background waveform, and inline Apple Design controls.

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  NavArrowLeft as ChevronLeft,
  NavArrowRight as ChevronRight,
  User,
  Trash as Trash2,
  SoundHigh as Volume2,
  SoundLow as Volume1,
  SoundOff as VolumeX,
  Check,
  Headset as Headphones,
  NavArrowDown as ChevronDown,
  Dashboard as Gauge,
} from "iconoir-react";
import { AudioPlayer, AudioPlayerControlBar, AudioPlayerButton } from "~/components/audio/player";
import { Transport } from "~/components/audio/elements/transport";
import { Fader } from "~/components/audio/elements/fader";
import { PlayPauseMorph } from "./PlayPauseMorph";
// oxlint-disable-next-line eslint/no-unused-vars
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { useAudioStore } from "~/lib/audio-store";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { NARRATOR_ACCENT, NARRATOR_SPEEDS, NARRATOR_VOICE_LABELS } from "../types";

interface TOCEntry {
  id: string;
  text: string;
  level: number;
}

interface WikiNarratorPlayerProps {
  visibleToc?: TOCEntry[];
  activeSectionId?: string | null;
  themeColors?: { primary: string; secondary: string } | null;
  scrollPercent?: number;
  sectionOffsets?: Record<string, number>;
  narratorState: any;
  narratorActions: any;
  showHeader?: boolean;
}

type ActiveInlineTray = "none" | "voice" | "speed" | "volume";

const BG_WAVEFORM_BARS = [
  15, 28, 38, 22, 45, 32, 50, 38, 26, 48, 42, 28, 36, 44, 24, 46, 38, 30, 44, 32, 22, 40, 28, 16,
];

function getRgbaColor(colorStr: string, opacity: number): string {
  if (colorStr.startsWith("#")) {
    const cleanHex = colorStr.replace("#", "");
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  if (colorStr.startsWith("hsl")) {
    return colorStr.replace("hsl(", "hsla(").replace(")", `, ${opacity})`);
  }
  return `rgba(59, 130, 246, ${opacity})`;
}

export function WikiNarratorPlayer({
  visibleToc = [],
  activeSectionId,
  themeColors,
  scrollPercent = 0,
  sectionOffsets = {},
  narratorState,
  narratorActions,
  showHeader = true,
}: WikiNarratorPlayerProps) {
  const [activeTray, setActiveTray] = useState<ActiveInlineTray>("none");
  const [lastNonZeroVol, setLastNonZeroVol] = useState(0.2);

  const hasNarrator = !!(narratorState && narratorState.totalBlocks > 0 && narratorActions);
  const { data: voicesData } = api.onoma.getKokoroVoices.useQuery(undefined, {
    staleTime: 600000,
    enabled: hasNarrator,
  });
  const voiceOptions: string[] = voicesData?.voices ?? Object.keys(NARRATOR_VOICE_LABELS);

  const currentVolume = typeof narratorState?.volume === "number" ? narratorState.volume : 0.2;
  const currentSpeed = typeof narratorState?.speed === "number" ? narratorState.speed : 1.0;
  const currentVoiceId = narratorState?.voice || "";
  const currentVoiceLabel =
    (currentVoiceId && NARRATOR_VOICE_LABELS[currentVoiceId]) || currentVoiceId || "Default Voice";
  const shortVoiceName =
    currentVoiceLabel.split(" - ")[1] ||
    currentVoiceLabel.replace("Female ", "").replace("Male ", "");

  const isNarratorActive = !!(
    narratorState &&
    narratorState.totalBlocks > 0 &&
    (narratorState.isPlaying || narratorState.activeBlockIndex > 0)
  );

  const isPlaying = !!narratorState?.isPlaying;

  const displayPercent = isNarratorActive
    ? ((narratorState.activeBlockIndex + 1) / narratorState.totalBlocks) * 100
    : scrollPercent;

  const activeEntry = visibleToc.find((e) => e.id === activeSectionId);
  const activeSectionTitle = activeEntry?.text ?? narratorState?.activeSectionTitle ?? "Overview";
  const accentColor = themeColors?.primary || NARRATOR_ACCENT;

  const narratorTracks = useMemo(
    () => [
      {
        id: activeSectionId || "wiki-narrator",
        title: narratorState?.activeSectionTitle || "Wiki Article",
        artist: "Wiki Narrator",
        url: "",
      },
    ],
    [activeSectionId, narratorState?.activeSectionTitle]
  );

  // Sync narrator state into audio-ui's centralized audio store
  useEffect(() => {
    // oxlint-disable-next-line
    if (!narratorState) return;

    useAudioStore.setState({
      isPlaying: !!narratorState.isPlaying,
      isLoading: false,
      isBuffering: false,
      currentTime: narratorState.activeBlockIndex ?? 0,
      duration: Math.max(1, narratorState.totalBlocks ?? 1),
      volume: currentVolume,
      playbackRate: currentSpeed,
      currentTrack: narratorTracks[0],
    });
  }, [
    narratorState?.isPlaying,
    narratorState?.activeBlockIndex,
    narratorState?.totalBlocks,
    currentVolume,
    currentSpeed,
    narratorTracks,
  ]);

  // Connect audio-ui playback, seek, and volume actions directly to the narrator engine
  useEffect(() => {
    if (!narratorActions) return;

    const originalTogglePlay = useAudioStore.getState().togglePlay;
    const originalSeek = useAudioStore.getState().seek;
    const originalSetVolume = useAudioStore.getState().setVolume;
    const originalSetPlaybackRate = useAudioStore.getState().setPlaybackRate;

    useAudioStore.setState({
      togglePlay: () => {
        if (narratorState?.isPlaying) {
          narratorActions.pause();
        } else {
          narratorActions.play();
        }
      },
      seek: (targetTime: number) => {
        narratorActions.jumpToBlock(Math.round(targetTime));
      },
      setVolume: ({ volume }: { volume: number }) => {
        narratorActions.setVolume(volume);
      },
      setPlaybackRate: (rate: number) => {
        narratorActions.setSpeed(rate);
        useAudioStore.setState({ playbackRate: rate });
      },
    });

    return () => {
      useAudioStore.setState({
        togglePlay: originalTogglePlay,
        seek: originalSeek,
        setVolume: originalSetVolume,
        setPlaybackRate: originalSetPlaybackRate,
      });
    };
  }, [narratorActions, narratorState?.isPlaying]);

  // Timeline & section scrubbing callback
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

  const toggleMute = () => {
    if (!narratorActions?.setVolume) return;
    if (currentVolume > 0) {
      setLastNonZeroVol(currentVolume);
      narratorActions.setVolume(0);
    } else {
      narratorActions.setVolume(lastNonZeroVol || 0.2);
    }
  };

  const toggleTray = (tray: ActiveInlineTray) => {
    setActiveTray((prev) => (prev === tray ? "none" : tray));
  };

  return (
    <div className="relative w-full space-y-2.5">
      {/* ── Ambient Background Audio Waveform (Apple Design Subtlety) ── */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-between gap-1 overflow-hidden rounded-xl px-3 py-1.5 select-none"
        aria-hidden="true"
      >
        {BG_WAVEFORM_BARS.map((heightPct, idx) => (
          <span
            key={idx}
            className={cn(
              "block max-w-[4px] min-w-[2px] flex-1 rounded-full transition-all duration-700 ease-out",
              isPlaying ? "animate-pulse" : "opacity-30"
            )}
            style={{
              height: isPlaying ? `${heightPct}%` : `${Math.max(8, heightPct * 0.25)}%`,
              backgroundColor: accentColor,
              opacity: isPlaying ? 0.14 : 0.03,
              animationDuration: `${1.1 + (idx % 5) * 0.2}s`,
              animationDelay: `${(idx * 60) % 400}ms`,
            }}
          />
        ))}
      </div>

      <AudioPlayer
        tracks={narratorTracks}
        variant="ghost"
        size="sm"
        className="relative z-10 w-full space-y-2.5 border-0 bg-transparent p-0 shadow-none before:hidden hover:bg-transparent"
        data-slot="wiki-narrator-player"
      >
        {/* ── 1. Top HUD Bar (Section Title + Reading Progress) ── */}
        {showHeader && (
          <div className="flex items-center justify-between gap-2 px-1 text-xs">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <Headphones className="h-3.5 w-3.5 shrink-0" style={{ color: accentColor }} />
              <span className="text-foreground max-w-[170px] truncate font-semibold">
                {activeSectionTitle}
              </span>
            </div>

            <div className="text-muted-foreground flex shrink-0 items-center gap-1 font-mono text-[11px] tabular-nums">
              {hasNarrator && (
                <span>
                  {narratorState.activeBlockIndex + 1}/{narratorState.totalBlocks}
                </span>
              )}
              <span className="text-foreground bg-accent/20 border-border/40 rounded-md border px-1.5 py-0.5 font-bold">
                {Math.round(displayPercent)}%
              </span>
            </div>
          </div>
        )}

        {/* ── 2. audio-ui Section Scrubber (Transport with Chapter Milestone Markers) ── */}
        <div className="relative w-full px-1 py-1">
          <Transport
            aria-label="Timeline Section Scrubber"
            value={displayPercent}
            onSeek={(val) => handleScrub(val)}
            size="sm"
            className="w-full"
          />

          {/* Section Chapter Dots Overlay */}
          <div className="pointer-events-none absolute inset-x-1 top-1/2 flex h-3 -translate-y-1/2 items-center">
            {visibleToc.map((entry) => {
              const offset = sectionOffsets[entry.id] ?? 0;
              const isActive = activeSectionId === entry.id;
              return (
                <div
                  key={entry.id}
                  className="group/tick pointer-events-auto absolute top-1/2 z-20 flex h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center"
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
                      "h-1.5 w-1.5 rounded-full border transition-all duration-150",
                      isActive
                        ? "scale-125 border-white shadow-[0_0_6px_rgba(96,165,250,0.9)]"
                        : "border-border/60 bg-muted group-hover/tick:border-foreground group-hover/tick:scale-125"
                    )}
                    style={
                      isActive
                        ? {
                            borderColor: "#ffffff",
                            backgroundColor: accentColor,
                            boxShadow: `0 0 6px ${accentColor}`,
                          }
                        : undefined
                    }
                  />
                  {/* Tooltip */}
                  <span className="border-border/50 bg-popover/95 text-popover-foreground pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 rounded-md border px-2 py-1 text-[9.5px] font-bold whitespace-nowrap opacity-0 shadow-2xl backdrop-blur-md transition-opacity duration-150 group-hover/tick:opacity-100">
                    {entry.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 3. Primary Audio-UI Controls Bar ── */}
        <AudioPlayerControlBar
          variant="compact"
          className="w-full items-center justify-between gap-1.5 px-0 py-0.5"
        >
          {/* Left: Playback & Section Skip Buttons */}
          <div className="flex shrink-0 items-center gap-1">
            {/* Direct Play/Pause Vector Morph Trigger (Zero Spinner Stall) */}
            <button
              type="button"
              onClick={() => {
                if (isPlaying) {
                  narratorActions?.pause?.();
                } else {
                  narratorActions?.play?.();
                }
              }}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-white shadow-md transition-all duration-150 hover:scale-105 active:scale-92"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 2px 8px ${getRgbaColor(accentColor, 0.35)}`,
              }}
              title={isPlaying ? "Pause narration" : "Play narration"}
            >
              <PlayPauseMorph isPlaying={isPlaying} size={16} className="fill-current text-white" />
            </button>

            <AudioPlayerButton
              aria-label="Previous Section"
              onClick={narratorActions?.skipPrev}
              disabled={!hasNarrator || narratorState.activeBlockIndex <= 0}
              size="icon"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground h-7 w-7 active:scale-92 disabled:opacity-30"
              tooltipLabel="Previous Section"
            >
              <ChevronLeft className="h-4 w-4" />
            </AudioPlayerButton>

            <AudioPlayerButton
              aria-label="Next Section"
              onClick={narratorActions?.skipNext}
              disabled={
                !hasNarrator || narratorState.activeBlockIndex >= narratorState.totalBlocks - 1
              }
              size="icon"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground h-7 w-7 active:scale-92 disabled:opacity-30"
              tooltipLabel="Next Section"
            >
              <ChevronRight className="h-4 w-4" />
            </AudioPlayerButton>
          </div>

          {/* Right: Inline Triggers for Voice, Speed, Volume */}
          <div className="flex shrink-0 items-center gap-1">
            {/* Voice Trigger (Inline) */}
            <button
              type="button"
              onClick={() => toggleTray("voice")}
              className={cn(
                "flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-all active:scale-95",
                activeTray === "voice"
                  ? "border font-bold shadow-xs"
                  : "bg-muted/40 hover:bg-muted/70 text-foreground border border-transparent"
              )}
              style={
                activeTray === "voice"
                  ? {
                      backgroundColor: getRgbaColor(accentColor, 0.15),
                      borderColor: getRgbaColor(accentColor, 0.35),
                      color: accentColor,
                    }
                  : undefined
              }
              title={`Voice: ${currentVoiceLabel}`}
            >
              <User className="h-3 w-3 shrink-0" style={{ color: accentColor }} />
              <span className="max-w-[55px] truncate sm:max-w-[75px]">{shortVoiceName}</span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 opacity-70 transition-transform duration-150",
                  activeTray === "voice" && "rotate-180 opacity-100"
                )}
              />
            </button>

            {/* Speed Trigger (Inline) */}
            <button
              type="button"
              onClick={() => toggleTray("speed")}
              className={cn(
                "flex h-7 cursor-pointer items-center gap-0.5 rounded-lg px-2 font-mono text-[11px] font-medium transition-all active:scale-95",
                activeTray === "speed"
                  ? "border font-bold shadow-xs"
                  : "bg-muted/40 hover:bg-muted/70 text-foreground border border-transparent"
              )}
              style={
                activeTray === "speed"
                  ? {
                      backgroundColor: getRgbaColor(accentColor, 0.15),
                      borderColor: getRgbaColor(accentColor, 0.35),
                      color: accentColor,
                    }
                  : undefined
              }
              title={`Speed: ${currentSpeed}×`}
            >
              <Gauge className="mr-0.5 h-3 w-3 shrink-0 opacity-70" />
              <span>{currentSpeed}×</span>
            </button>

            {/* Volume Trigger (Inline) */}
            <button
              type="button"
              onClick={() => toggleTray("volume")}
              className={cn(
                "flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-all active:scale-95",
                activeTray === "volume"
                  ? "border shadow-xs"
                  : "bg-muted/40 hover:bg-muted/70 text-foreground border border-transparent"
              )}
              style={
                activeTray === "volume"
                  ? {
                      backgroundColor: getRgbaColor(accentColor, 0.15),
                      borderColor: getRgbaColor(accentColor, 0.35),
                      color: accentColor,
                    }
                  : undefined
              }
              title={`Volume: ${Math.round(currentVolume * 100)}%`}
            >
              {currentVolume === 0 ? (
                <VolumeX className="text-destructive h-3.5 w-3.5" />
              ) : currentVolume < 0.5 ? (
                <Volume1 className="text-foreground h-3.5 w-3.5" />
              ) : (
                <Volume2 className="text-foreground h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </AudioPlayerControlBar>

        {/* ── 4. INLINE EXPANDABLE TRAYS (Guaranteed 0% clipping behind Halo) ── */}

        {/* 4A. Inline Voice Picker Tray */}
        {activeTray === "voice" && (
          <div className="border-border/50 bg-popover/90 text-popover-foreground animate-in fade-in slide-in-from-top-1 mt-2 space-y-1 rounded-xl border p-2 shadow-md backdrop-blur-xl duration-150 dark:bg-zinc-900/90">
            <div className="border-border/40 text-muted-foreground flex items-center justify-between border-b px-1 pb-1 text-[10.5px] font-bold tracking-wider uppercase">
              <span>Narrator Voice</span>
              <span className="text-[10px] font-normal opacity-70">Kokoro TTS</span>
            </div>

            <div className="scrollbar-thumb-muted max-h-36 scrollbar-thin space-y-0.5 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  narratorActions?.setVoice("");
                  setActiveTray("none");
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-all",
                  !currentVoiceId
                    ? "font-bold"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={
                  !currentVoiceId
                    ? {
                        backgroundColor: getRgbaColor(accentColor, 0.15),
                        color: accentColor,
                      }
                    : undefined
                }
              >
                <span>Default Voice</span>
                {!currentVoiceId && (
                  <Check className="h-3.5 w-3.5" style={{ color: accentColor }} />
                )}
              </button>

              {voiceOptions.map((id) => {
                const isSelected = currentVoiceId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      narratorActions?.setVoice(id);
                      setActiveTray("none");
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-all",
                      isSelected
                        ? "font-bold"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                    style={
                      isSelected
                        ? {
                            backgroundColor: getRgbaColor(accentColor, 0.15),
                            color: accentColor,
                          }
                        : undefined
                    }
                  >
                    <span className="truncate">{NARRATOR_VOICE_LABELS[id] || id}</span>
                    {isSelected && <Check className="h-3.5 w-3.5" style={{ color: accentColor }} />}
                  </button>
                );
              })}
            </div>

            {narratorActions?.clearCache && (
              <div className="border-border/40 border-t pt-1">
                <button
                  type="button"
                  onClick={() => {
                    narratorActions.clearCache();
                    setActiveTray("none");
                  }}
                  className="text-destructive hover:bg-destructive/10 flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Clear Voice Audio Cache</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 4B. Inline Playback Speed Tray */}
        {activeTray === "speed" && (
          <div className="border-border/50 bg-popover/90 text-popover-foreground animate-in fade-in slide-in-from-top-1 mt-2 space-y-2 rounded-xl border p-2.5 shadow-md backdrop-blur-xl duration-150 dark:bg-zinc-900/90">
            <div className="text-muted-foreground flex items-center justify-between text-[10.5px] font-bold tracking-wider uppercase">
              <span>Playback Speed</span>
              <span className="font-mono font-bold" style={{ color: accentColor }}>
                {currentSpeed}×
              </span>
            </div>

            <div className="flex items-center justify-between gap-1.5">
              {NARRATOR_SPEEDS.map((s) => {
                const isActive = currentSpeed === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      narratorActions?.setSpeed(s);
                      useAudioStore.getState().setPlaybackRate(s);
                      setActiveTray("none");
                    }}
                    className={cn(
                      "flex-1 cursor-pointer rounded-lg py-1 font-mono text-xs font-bold transition-all active:scale-92",
                      isActive
                        ? "border shadow-xs"
                        : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent"
                    )}
                    style={
                      isActive
                        ? {
                            backgroundColor: getRgbaColor(accentColor, 0.15),
                            borderColor: getRgbaColor(accentColor, 0.35),
                            color: accentColor,
                          }
                        : undefined
                    }
                  >
                    {s}×
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 4C. Inline Volume Slider Tray (audio-ui Fader) */}
        {activeTray === "volume" && (
          <div className="border-border/50 bg-popover/90 text-popover-foreground animate-in fade-in slide-in-from-top-1 mt-2 space-y-2 rounded-xl border p-2.5 shadow-md backdrop-blur-xl duration-150 dark:bg-zinc-900/90">
            <div className="text-muted-foreground flex items-center justify-between text-[10.5px] font-bold tracking-wider uppercase">
              <span>Volume Gain</span>
              <span className="font-mono font-bold tabular-nums" style={{ color: accentColor }}>
                {Math.round(currentVolume * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer rounded-md p-1 transition-colors active:scale-90"
                title={currentVolume === 0 ? "Unmute" : "Mute"}
              >
                {currentVolume === 0 ? (
                  <VolumeX className="text-destructive h-4 w-4" />
                ) : (
                  <Volume2 className="text-foreground h-4 w-4" />
                )}
              </button>

              <div className="flex-1">
                <Fader
                  orientation="horizontal"
                  size="sm"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(currentVolume * 100)}
                  onValueChange={(val: number | readonly number[]) => {
                    const num = Array.isArray(val) ? val[0] : (val as number);
                    if (typeof num === "number") {
                      narratorActions?.setVolume(num / 100);
                      if (num > 0) setLastNonZeroVol(num / 100);
                    }
                  }}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}
      </AudioPlayer>
    </div>
  );
}
