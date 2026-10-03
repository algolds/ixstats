"use client";

import { useState } from "react";
import { useIxMedia } from "./MediaContext";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import { Slider } from "~/components/ui/slider";
import {
  Play,
  Pause,
  FastArrowRight as SkipForward,
  FastArrowLeft as SkipBack,
  SoundHigh as Volume2,
  Playlist as ListMusic,
  Dashboard as Gauge,
} from "iconoir-react";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { QueuePanel } from "./QueuePanel";
import { ChapterNavigator } from "./ChapterNavigator";
import { TranscriptViewer } from "./TranscriptViewer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

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
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        aria-describedby={undefined}
        className="flex flex-col gap-6 overflow-y-auto sm:max-w-md"
      >
        <div className="mt-2 flex flex-col items-center gap-4 text-center">
          {activeTrack.coverArt && (
            <div className="rounded-card border-separator shadow-card relative size-48 overflow-hidden border">
              <img src={activeTrack.coverArt} className="h-full w-full object-cover" alt="Cover" />
            </div>
          )}
          <div>
            <SheetTitle className="text-title-3">{activeTrack.title}</SheetTitle>
            <p className="text-body text-label-secondary">{activeTrack.subtitle}</p>
          </div>
        </div>

        {/* Waveform visualizer & seek */}
        <div className="flex flex-col gap-2">
          <WaveformVisualizer
            peaks={activeTrack.peaks}
            currentTime={currentTime}
            duration={duration}
            onSeek={seekTrack}
          />
          <div className="text-footnote text-label-secondary flex items-center justify-between tabular-nums">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Player controls */}
        <div className="flex items-center justify-center gap-6">
          <Button variant="ghost" size="icon-lg" onClick={skipPrevious} aria-label="Previous">
            <SkipBack className="size-5" aria-hidden="true" />
          </Button>
          <Button
            size="icon-lg"
            className="size-14 rounded-full"
            onClick={isPlaying ? pauseTrack : resumeTrack}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="size-6 fill-current" aria-hidden="true" />
            ) : (
              <Play className="ml-0.5 size-6 fill-current" aria-hidden="true" />
            )}
          </Button>
          <Button variant="ghost" size="icon-lg" onClick={skipNext} aria-label="Next">
            <SkipForward className="size-5" aria-hidden="true" />
          </Button>
        </div>

        {/* Volume and speed */}
        <div className="border-separator grid grid-cols-2 gap-4 border-t pt-4">
          <div className="flex flex-col gap-2">
            <span className="text-footnote text-label-secondary flex items-center gap-2">
              <Volume2 className="size-3.5" aria-hidden="true" />
              Volume
            </span>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[volume]}
              onValueChange={(v) => changeVolume(v[0] ?? volume)}
              aria-label="Volume"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span
              id="media-player-speed"
              className="text-footnote text-label-secondary flex items-center gap-2"
            >
              <Gauge className="size-3.5" aria-hidden="true" />
              Speed
            </span>
            <Select value={String(speed)} onValueChange={(v) => changeSpeed(Number(v))}>
              <SelectTrigger size="sm" aria-labelledby="media-player-speed" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">0.5x</SelectItem>
                <SelectItem value="0.75">0.75x</SelectItem>
                <SelectItem value="1">1.0x (Normal)</SelectItem>
                <SelectItem value="1.25">1.25x</SelectItem>
                <SelectItem value="1.5">1.5x</SelectItem>
                <SelectItem value="2">2.0x</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ChapterNavigator />
        <TranscriptViewer />

        {/* Queue */}
        <div className="border-separator flex flex-col gap-3 border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setShowQueue(!showQueue)}
          >
            <ListMusic aria-hidden="true" />
            {showQueue ? "Hide queue" : "Show queue"}
          </Button>

          {showQueue && <QueuePanel />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
