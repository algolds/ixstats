"use client";

import React, { useState } from "react";
import { useIxMedia } from "~/hooks/useIxMedia";
import { FacetModal } from "~/components/ui/facet-container";
import {
  X,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  ListMusic,
  Gauge,
} from "lucide-react";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { QueuePanel } from "./QueuePanel";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
      <FacetModal className="w-full max-w-lg p-6 flex flex-col gap-6 relative border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center gap-4 text-center mt-2">
          {activeTrack.coverArt && (
            <div className="relative w-48 h-48 rounded-2xl overflow-hidden shadow-xl border border-black/5 dark:border-white/5">
              <img src={activeTrack.coverArt} className="w-full h-full object-cover" alt="Cover" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold tracking-tight">{activeTrack.title}</h2>
            <p className="text-sm text-muted-foreground">{activeTrack.subtitle}</p>
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
          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Player controls */}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={skipPrevious}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipBack className="h-5 w-5" />
          </button>
          {isPlaying ? (
            <button
              onClick={pauseTrack}
              className="p-3.5 bg-primary text-primary-foreground hover:scale-105 rounded-full transition-all shadow-md"
            >
              <Pause className="h-6 w-6 fill-current" />
            </button>
          ) : (
            <button
              onClick={resumeTrack}
              className="p-3.5 bg-primary text-primary-foreground hover:scale-105 rounded-full transition-all shadow-md"
            >
              <Play className="h-6 w-6 fill-current ml-0.5" />
            </button>
          )}
          <button
            onClick={skipNext}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipForward className="h-5 w-5" />
          </button>
        </div>

        {/* Sliders and utility buttons */}
        <div className="grid grid-cols-2 gap-4 border-t border-black/5 dark:border-white/5 pt-4">
          {/* Volume Control */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
              className="w-full h-1 bg-black/10 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          {/* Speed Control */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Gauge className="h-3.5 w-3.5" />
              <span>Speed</span>
            </div>
            <select
              value={speed}
              onChange={(e) => changeSpeed(Number(e.target.value))}
              className="w-full text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded p-1"
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

        {/* Queue Toggle Button */}
        <div className="border-t border-black/5 dark:border-white/5 pt-4 flex flex-col gap-3">
          <button
            onClick={() => setShowQueue(!showQueue)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium self-start"
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
