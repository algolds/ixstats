"use client";

import React, { useState } from "react";
import { useIxMedia } from "./MediaContext";
import { FacetModal } from "~/components/ui/facet-container";
import { X, Play, Pause, SkipForward, SkipBack, Volume2, ListMusic, Gauge } from "lucide-react";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { QueuePanel } from "./QueuePanel";
import { ChapterNavigator } from "./ChapterNavigator";
import { TranscriptViewer } from "./TranscriptViewer";

export function FullPlayer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const {
    activeTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    speed,
    pauseTrack,
    resumeTrack,
    skipNext,
    skipPrevious,
    seekTrack,
    changeVolume,
    changeSpeed,
  } = useIxMedia();

  const [showQueue, setShowQueue] = useState(false);

  if (!isOpen || !activeTrack) return null;

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds === null) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md">
      <FacetModal className="relative flex max-h-[90vh] w-full max-w-lg flex-col gap-6 overflow-hidden overflow-y-auto border border-black/10 p-6 shadow-2xl dark:border-white/10">
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground absolute top-4 right-4 rounded-full p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mt-2 flex flex-col items-center gap-4 text-center">
          {activeTrack.coverArt && (
            <div className="relative h-48 w-48 overflow-hidden rounded-2xl border border-black/5 shadow-xl dark:border-white/5">
              <img src={activeTrack.coverArt} className="h-full w-full object-cover" alt="Cover" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold tracking-tight">{activeTrack.title}</h2>
            <p className="text-muted-foreground text-sm">{activeTrack.subtitle}</p>
          </div>
        </div>

        {/* Waveform Visualizer & Seek */}
        <div className="flex flex-col gap-2">
          <WaveformVisualizer
            peaks={activeTrack.peaks}
            currentTime={currentTime}
            duration={duration}
            onSeek={seekTrack}
          />
          <div className="text-muted-foreground flex items-center justify-between font-mono text-[10px]">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Player controls */}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={skipPrevious}
            className="text-muted-foreground hover:text-foreground p-2 transition-colors"
          >
            <SkipBack className="h-5 w-5" />
          </button>
          {isPlaying ? (
            <button
              onClick={pauseTrack}
              className="bg-primary text-primary-foreground rounded-full p-3.5 shadow-md transition-all hover:scale-105"
            >
              <Pause className="h-6 w-6 fill-current" />
            </button>
          ) : (
            <button
              onClick={resumeTrack}
              className="bg-primary text-primary-foreground rounded-full p-3.5 shadow-md transition-all hover:scale-105"
            >
              <Play className="ml-0.5 h-6 w-6 fill-current" />
            </button>
          )}
          <button
            onClick={skipNext}
            className="text-muted-foreground hover:text-foreground p-2 transition-colors"
          >
            <SkipForward className="h-5 w-5" />
          </button>
        </div>

        {/* Sliders and utility buttons */}
        <div className="grid grid-cols-2 gap-4 border-t border-black/5 pt-4 dark:border-white/5">
          {/* Volume Control */}
          <div className="flex flex-col gap-1.5">
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Volume2 className="h-3.5 w-3.5" />
              <span>Volume</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              className="accent-primary h-1 w-full cursor-pointer appearance-none rounded-lg bg-black/10 dark:bg-white/10"
            />
          </div>

          {/* Speed Control */}
          <div className="flex flex-col gap-1.5">
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Gauge className="h-3.5 w-3.5" />
              <span>Speed</span>
            </div>
            <select
              value={speed}
              onChange={(e) => changeSpeed(Number(e.target.value))}
              className="w-full rounded border border-black/10 bg-black/5 p-1 text-xs dark:border-white/10 dark:bg-white/5"
            >
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1.0">1.0x (Normal)</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2.0">2.0x</option>
            </select>
          </div>
        </div>

        <ChapterNavigator />
        <TranscriptViewer />

        {/* Queue Toggle Button */}
        <div className="flex flex-col gap-3 border-t border-black/5 pt-4 dark:border-white/5">
          <button
            onClick={() => setShowQueue(!showQueue)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 self-start text-xs font-medium transition-colors"
          >
            <ListMusic className="h-4 w-4" />
            <span>{showQueue ? "Hide Queue" : "Show Queue"}</span>
          </button>

          {showQueue && <QueuePanel />}
        </div>
      </FacetModal>
    </div>
  );
}
