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
  Info,
  ChevronDown,
  ChevronUp
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
  const [expanded, setExpanded] = useState(false);
  const [timeOffset, setTimeOffset] = useState(0); // Years from current time
  const [forecastYears, setForecastYears] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 4x speed

  const actualCurrentTime = currentTime || IxTime.getCurrentIxTime();
  const actualGameEpoch = gameEpoch || IxTime.getInGameEpoch();
  
  // Calculate the target time based on offset
  const targetTime = IxTime.addYears(actualCurrentTime, timeOffset);
  
  // Calculate min/max bounds
  const maxPastYears = -(IxTime.getCurrentGameYear(actualCurrentTime) - IxTime.getCurrentGameYear(actualGameEpoch));
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

  // Collapsed view
  if (!expanded) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              Viewing: {IxTime.formatIxTime(targetTime)} ({IxTime.getCurrentGameYear(targetTime)})
            </h3>
            {!isAtPresent && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Time travel active: {getTimeDescription()}
              </p>
            )}
            {forecastYears > 0 && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Forecast: +{forecastYears.toFixed(1)} years
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isAtPresent && (
              <button
                onClick={handleReset}
                className="p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                title="Reset to present time"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            <button 
              onClick={() => setExpanded(true)}
              className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 flex items-center font-medium"
            >
              <span className="mr-1">Time Controls</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Expanded view
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
          <Calendar className="h-5 w-5 mr-2" />
          Time Control
          {!isAtPresent && (
            <span className="ml-3 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-sm rounded-full">
              Time Travel Active
            </span>
          )}
        </h2>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={isLoading || (isAtPresent && forecastYears === 0)}
            className={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 ${
              isAtPresent && forecastYears === 0
                ? 'text-gray-400 dark:text-gray-600'
                : 'text-gray-700 dark:text-gray-300'
            }`}
            title="Reset to present time"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setExpanded(false)}
            className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Current Time Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Viewing Time</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {IxTime.formatIxTime(targetTime)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {getTimeDescription()}
          </div>
        </div>
        
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Game Year</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {IxTime.getCurrentGameYear(targetTime)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Year {IxTime.getCurrentGameYear(targetTime) - IxTime.getCurrentGameYear(actualGameEpoch)} of simulation
          </div>
        </div>
        
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Forecast</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            +{forecastYears.toFixed(1)} years
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {forecastYears > 0 ? IxTime.formatIxTime(IxTime.addYears(targetTime, forecastYears)) : 'None'}
          </div>
        </div>
      </div>

      {/* Time Navigation Controls */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-900 dark:text-white">
              Time Position
            </label>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleTimeOffsetChange(timeOffset - 1)}
                disabled={isLoading || timeOffset <= maxPastYears}
                className="p-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 disabled:opacity-50"
              >
                <Rewind className="h-4 w-4" />
              </button>
              
              <button
                onClick={handlePlayPause}
                disabled={isLoading || timeOffset >= maxFutureYears}
                className="p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              
              <button
                onClick={() => handleTimeOffsetChange(timeOffset + 1)}
                disabled={isLoading || timeOffset >= maxFutureYears}
                className="p-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 disabled:opacity-50"
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
              className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>Game Start</span>
              <span>Present</span>
              <span>+10 Years</span>
            </div>
          </div>
        </div>

        {/* Forecast Control */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-900 dark:text-white">
              Forecast Period
            </label>
            <span className="text-sm text-gray-500 dark:text-gray-400">
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
            className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>No Forecast</span>
            <span>10 Years</span>
          </div>
        </div>

        {/* Playback Speed Control (when playing) */}
        {isPlaying && (
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
              Playback Speed
            </label>
            <div className="flex space-x-2">
              {[1, 2, 4].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-3 py-1 rounded text-sm ${
                    playbackSpeed === speed
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
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
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-lg">
        <div className="flex items-start">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-sm text-gray-600 dark:text-gray-400">
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
