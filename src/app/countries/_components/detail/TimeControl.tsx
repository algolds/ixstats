// src/app/countries/_components/detail/TimeControl.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  Rewind,
  FastForward,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Info
} from "lucide-react";
import { IxTime } from "~/lib/ixtime";

interface TimeControlProps {
  onTimeChange: (ixTime: number) => void;
  onForecastChange: (years: number) => void;
  currentTime?: number;
  gameEpoch?: number;
  isLoading?: boolean;
}

export function TimeControl({
  onTimeChange,
  onForecastChange,
  currentTime,
  gameEpoch,
  isLoading = false
}: TimeControlProps) {
  const [timeOffset, setTimeOffset] = useState(0); // Years from current time
  const [forecastYears, setForecastYears] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 4x speed

  const actualCurrentTime = currentTime || IxTime.getCurrentIxTime();
  const actualGameEpoch = gameEpoch || IxTime.getInGameEpoch();
  
  // Calculate the target time based on offset
  const targetTime = IxTime.addYears(actualCurrentTime, timeOffset);
  
  // Calculate min/max bounds
  const maxPastYears = -(IxTime.getCurrentGameYear() - IxTime.getGameYear(actualGameEpoch));
  const maxFutureYears = 10;

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setTimeOffset(prev => {
        const newOffset = prev + (0.1 * playbackSpeed); // 0.1 years per tick
        if (newOffset > maxFutureYears) {
          setIsPlaying(false);
          return maxFutureYears;
        }
        return newOffset;
      });
    }, 100); // 100ms intervals

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, maxFutureYears]);

  // Notify parent of time changes
  useEffect(() => {
    onTimeChange(targetTime);
  }, [targetTime, onTimeChange]);

  // Notify parent of forecast changes
  useEffect(() => {
    onForecastChange(forecastYears);
  }, [forecastYears, onForecastChange]);

  const handleTimeOffsetChange = (newOffset: number) => {
    const clampedOffset = Math.max(maxPastYears, Math.min(maxFutureYears, newOffset));
    setTimeOffset(clampedOffset);
    if (isPlaying && clampedOffset >= maxFutureYears) {
      setIsPlaying(false);
    }
  };

  const handleReset = () => {
    setTimeOffset(0);
    setForecastYears(0);
    setIsPlaying(false);
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const getTimeDescription = () => {
    if (timeOffset === 0) return "Present Time";
    if (timeOffset < 0) return `${Math.abs(timeOffset).toFixed(1)} years ago`;
    return `${timeOffset.toFixed(1)} years in future`;
  };

  const isAtPresent = timeOffset === 0;
  const isAtFuture = timeOffset > 0;
  const isAtPast = timeOffset < 0;

  return (
    <div className="bg-[var(--color-bg-surface)] rounded-lg shadow-md p-6 border border-[var(--color-border-primary)]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] flex items-center">
          <Calendar className="h-5 w-5 mr-2" />
          Time Control
          {!isAtPresent && (
            <span className="ml-3 px-2 py-1 bg-[var(--color-brand-primary)]20 text-[var(--color-brand-primary)] text-sm rounded-full">
              Time Travel Active
            </span>
          )}
        </h2>
        
        <button
          onClick={handleReset}
          disabled={isLoading || (isAtPresent && forecastYears === 0)}
          className="btn-secondary"
          title="Reset to present time"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* Current Time Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
          <div className="text-sm text-[var(--color-text-muted)] mb-1">Viewing Time</div>
          <div className="text-lg font-semibold text-[var(--color-text-primary)]">
            {IxTime.formatIxTime(targetTime)}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {getTimeDescription()}
          </div>
        </div>
        
        <div className="text-center p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
          <div className="text-sm text-[var(--color-text-muted)] mb-1">Game Year</div>
          <div className="text-lg font-semibold text-[var(--color-text-primary)]">
            {IxTime.getGameYear(targetTime)}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">
            Year {IxTime.getGameYear(targetTime) - IxTime.getGameYear(actualGameEpoch)} of simulation
          </div>
        </div>
        
        <div className="text-center p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
          <div className="text-sm text-[var(--color-text-muted)] mb-1">Forecast</div>
          <div className="text-lg font-semibold text-[var(--color-text-primary)]">
            +{forecastYears.toFixed(1)} years
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {forecastYears > 0 ? IxTime.formatIxTime(IxTime.addYears(targetTime, forecastYears)) : 'None'}
          </div>
        </div>
      </div>

      {/* Time Navigation Controls */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-[var(--color-text-primary)]">
              Time Position
            </label>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleTimeOffsetChange(timeOffset - 1)}
                disabled={isLoading || timeOffset <= maxPastYears}
                className="p-1 text-[var(--color-brand-primary)] hover:text-[var(--color-brand-dark)] disabled:opacity-50"
              >
                <Rewind className="h-4 w-4" />
              </button>
              
              <button
                onClick={handlePlayPause}
                disabled={isLoading || timeOffset >= maxFutureYears}
                className="p-2 bg-[var(--color-brand-primary)] text-white rounded-md hover:bg-[var(--color-brand-dark)] disabled:opacity-50"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              
              <button
                onClick={() => handleTimeOffsetChange(timeOffset + 1)}
                disabled={isLoading || timeOffset >= maxFutureYears}
                className="p-1 text-[var(--color-brand-primary)] hover:text-[var(--color-brand-dark)] disabled:opacity-50"
              >
                <FastForward className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <div className="relative">
            <input
              type="range"
              min={maxPastYears}
              max={maxFutureYears}
              step={0.1}
              value={timeOffset}
              onChange={(e) => handleTimeOffsetChange(parseFloat(e.target.value))}
              disabled={isLoading}
              className="w-full h-2 bg-[var(--color-bg-accent)] rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
              <span>Game Start</span>
              <span>Present</span>
              <span>+10 Years</span>
            </div>
          </div>
        </div>

        {/* Forecast Control */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-[var(--color-text-primary)]">
              Forecast Period
            </label>
            <span className="text-sm text-[var(--color-text-muted)]">
              {forecastYears.toFixed(1)} years
            </span>
          </div>
          
          <input
            type="range"
            min={0}
            max={10}
            step={0.1}
            value={forecastYears}
            onChange={(e) => setForecastYears(parseFloat(e.target.value))}
            disabled={isLoading}
            className="w-full h-2 bg-[var(--color-bg-accent)] rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
            <span>No Forecast</span>
            <span>10 Years</span>
          </div>
        </div>

        {/* Playback Speed Control (when playing) */}
        {isPlaying && (
          <div>
            <label className="text-sm font-medium text-[var(--color-text-primary)] mb-2 block">
              Playback Speed
            </label>
            <div className="flex space-x-2">
              {[1, 2, 4].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-3 py-1 rounded text-sm ${
                    playbackSpeed === speed
                      ? 'bg-[var(--color-brand-primary)] text-white'
                      : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-accent)]'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="mt-6 p-4 bg-[var(--color-info)]10 border border-[var(--color-info)]30 rounded-lg">
        <div className="flex items-start">
          <Info className="h-4 w-4 text-[var(--color-info)] mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-sm text-[var(--color-text-muted)]">
            <p className="mb-1">
              <strong>Time Control:</strong> Navigate through historical data and forecast future scenarios.
            </p>
            <p>
              Use the slider or playback controls to explore different time periods. 
              Forecast shows projected data based on current growth rates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
