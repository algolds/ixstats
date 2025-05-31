// src/app/countries/_components/detail/TimeControl.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
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
  ChevronUp,
  Minus, Plus
} from "lucide-react";
import { IxTime } from "~/lib/ixtime";
import { Button } from "~/components/ui/button";
import { Slider } from "~/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

interface TimeControlProps {
  onTimeChange: (ixTime: number) => void;
  onForecastChange: (years: number) => void;
  currentTime: number;
  gameEpoch: number;
  isLoading?: boolean;
}

export function TimeControl({
  onTimeChange,
  onForecastChange,
  currentTime,
  gameEpoch,
  isLoading = false
}: TimeControlProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [timeOffset, setTimeOffset] = useState(0); // Years relative to the *actual current IxTime*
  const [forecastYearsInput, setForecastYearsInput] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // targetTime is the time that should be displayed and used for data fetching
  // It's derived from the parent's currentTime and the local timeOffset
  const targetTime = useMemo(() => IxTime.addYears(currentTime, timeOffset), [currentTime, timeOffset]);

  // Min/max bounds for timeOffset, relative to the *actual current IxTime*
  const maxPastYears = useMemo(() => -(IxTime.getCurrentGameYear(IxTime.getCurrentIxTime()) - IxTime.getCurrentGameYear(gameEpoch)), [gameEpoch]);
  const maxFutureYears = 10;

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setTimeOffset(prev => {
        const newOffset = prev + (0.1 * playbackSpeed);
        if (newOffset > maxFutureYears) {
          setIsPlaying(false);
          return maxFutureYears;
        }
        if (newOffset < maxPastYears) {
          setIsPlaying(false);
          return maxPastYears;
        }
        return newOffset;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, maxFutureYears, maxPastYears]);

  // Effect to call parent's onTimeChange when targetTime (derived from offset) changes
  useEffect(() => {
    onTimeChange(targetTime);
  }, [targetTime, onTimeChange]);

  // Effect to call parent's onForecastChange when forecastYearsInput changes
  useEffect(() => {
    onForecastChange(forecastYearsInput);
  }, [forecastYearsInput, onForecastChange]);

  // When parent's currentTime changes (e.g., reset to present), reset local offset
  useEffect(() => {
      // If the parent's currentTime is the actual present, and we have an offset,
      // it means we were time traveling and parent reset. So, reset local offset.
      if (currentTime === IxTime.getCurrentIxTime()) {
          setTimeOffset(0);
      }
      // No dependency on timeOffset here to avoid loops. This effect is purely
      // to react to external changes of `currentTime` prop.
  }, [currentTime]);


  const handleTimeOffsetChange = (newOffsetArray: number[]) => {
    const newOffset = newOffsetArray[0];
    if (typeof newOffset === 'number') {
      const clampedOffset = Math.max(maxPastYears, Math.min(maxFutureYears, newOffset));
      setTimeOffset(clampedOffset);
      if (isPlaying && (clampedOffset >= maxFutureYears || clampedOffset <= maxPastYears)) {
        setIsPlaying(false);
      }
    }
  };
  
  const handleForecastYearsInputChange = (newForecastYearsArray: number[]) => {
    const newForecastYears = newForecastYearsArray[0];
    if (typeof newForecastYears === 'number') {
      setForecastYearsInput(newForecastYears);
    }
  };


  const handleReset = () => {
    // This should trigger the parent to set its currentTime to actual present
    // And then the useEffect above will reset local timeOffset.
    onTimeChange(IxTime.getCurrentIxTime()); // Signal parent to reset to present
    setTimeOffset(0); // Also reset local offset immediately for responsiveness
    setForecastYearsInput(0);
    setIsPlaying(false);
  };

  const handlePlayPause = () => {
    if (timeOffset >= maxFutureYears && !isPlaying) return;
    setIsPlaying(!isPlaying);
  };
  
  const stepTime = (years: number) => {
    const currentTargetOffset = IxTime.getYearsBetween(IxTime.getCurrentIxTime(), targetTime);
    const newTargetOffset = currentTargetOffset + years;
    const newClampedTargetOffset = Math.max(maxPastYears, Math.min(maxFutureYears, newTargetOffset));
    // Calculate the new timeOffset based on the actual current IxTime
    const newTimeOffset = IxTime.getYearsBetween(IxTime.getCurrentIxTime(), IxTime.addYears(IxTime.getCurrentIxTime(), newClampedTargetOffset));
    setTimeOffset(newTimeOffset);
  };

  const getTimeDescription = () => {
    if (Math.abs(timeOffset) < 0.05) return "Present Time";
    if (timeOffset < 0) return `${Math.abs(timeOffset).toFixed(1)} years ago`;
    return `${timeOffset.toFixed(1)} years in future`;
  };

  const isAtPresent = Math.abs(timeOffset) < 0.05 && currentTime === IxTime.getCurrentIxTime();


  if (!isExpanded) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground flex items-center">
                <Clock className="h-4 w-4 mr-2 text-primary" />
                Viewing: {IxTime.formatIxTime(targetTime)} ({IxTime.getCurrentGameYear(targetTime)})
              </div>
              {!isAtPresent && (
                <Badge variant="outline" className="mt-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                  Time Travel: {getTimeDescription()}
                </Badge>
              )}
              {forecastYearsInput > 0 && (
                 <Badge variant="outline" className="mt-1 ml-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
                  Forecast: +{forecastYearsInput.toFixed(1)} yrs
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isAtPresent && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleReset} className="h-8 w-8">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Reset to Present</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Button variant="outline" size="sm" onClick={() => setIsExpanded(true)}>
                Controls <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center"><Calendar className="h-5 w-5 mr-2" />Time Control</CardTitle>
          <div className="flex items-center gap-2">
            {!isAtPresent && (
                <TooltipProvider>
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleReset} disabled={isLoading} className="h-8 w-8"><RotateCcw className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Reset to Present Time</p></TooltipContent></Tooltip>
                </TooltipProvider>
            )}
            <Button variant="ghost" size="icon" onClick={() => setIsExpanded(false)} className="h-8 w-8"><ChevronUp className="h-4 w-4" /></Button>
          </div>
        </div>
        {isAtPresent ? (
            <CardDescription>Currently viewing present time. Adjust to explore historical data or future forecasts.</CardDescription>
        ) : (
            <CardDescription className="text-blue-600 dark:text-blue-400">Time travel active: Viewing data for {getTimeDescription()}.</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-muted/50 rounded-md"><Label className="text-xs text-muted-foreground block mb-1">Viewing Time</Label><div className="text-base font-semibold text-foreground">{IxTime.formatIxTime(targetTime)}</div></div>
            <div className="p-3 bg-muted/50 rounded-md"><Label className="text-xs text-muted-foreground block mb-1">Game Year</Label><div className="text-base font-semibold text-foreground">{IxTime.getCurrentGameYear(targetTime)}</div></div>
            <div className="p-3 bg-muted/50 rounded-md"><Label className="text-xs text-muted-foreground block mb-1">Relative to Present</Label><div className="text-base font-semibold text-foreground">{getTimeDescription()}</div></div>
        </div>
        <div className="space-y-3">
          <Label htmlFor="time-offset-slider">Time Position (Years from Present: {timeOffset.toFixed(1)})</Label>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => stepTime(-1)} disabled={isLoading || timeOffset <= maxPastYears} className="h-8 w-8"><Rewind className="h-4 w-4" /></Button>
            <Slider id="time-offset-slider" min={maxPastYears} max={maxFutureYears} step={0.1} value={[timeOffset]} onValueChange={handleTimeOffsetChange} disabled={isLoading} className="flex-grow"/>
            <Button variant="outline" size="icon" onClick={() => stepTime(1)} disabled={isLoading || timeOffset >= maxFutureYears} className="h-8 w-8"><FastForward className="h-4 w-4" /></Button>
          </div>
          <div className="flex items-center justify-center gap-2">
             <Button variant={isPlaying ? "destructive" : "default"} size="sm" onClick={handlePlayPause} disabled={isLoading || (timeOffset >= maxFutureYears && !isPlaying) || (timeOffset <= maxPastYears && !isPlaying) }>{isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}{isPlaying ? "Pause" : "Play"}</Button>
              {isPlaying && (<div className="flex items-center gap-1">{[1, 2, 4].map((speed) => (<Button key={speed} variant={playbackSpeed === speed ? "secondary" : "ghost"} size="sm" onClick={() => setPlaybackSpeed(speed)}>{speed}x</Button>))}</div>)}
          </div>
        </div>
        <div className="space-y-3">
          <Label htmlFor="forecast-slider">Forecast Period (Years from selected time: {forecastYearsInput.toFixed(1)})</Label>
           <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setForecastYearsInput(prev => Math.max(0, prev - 1))} disabled={isLoading || forecastYearsInput <= 0} className="h-8 w-8"><Minus className="h-4 w-4" /></Button>
            <Slider id="forecast-slider" min={0} max={10} step={0.5} value={[forecastYearsInput]} onValueChange={handleForecastYearsInputChange} disabled={isLoading} className="flex-grow"/>
            <Button variant="outline" size="icon" onClick={() => setForecastYearsInput(prev => Math.min(10, prev + 1))} disabled={isLoading || forecastYearsInput >= 10} className="h-8 w-8"><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg text-xs">
          <div className="flex items-start"><Info className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" /><p className="text-muted-foreground">Adjust "Time Position" to view historical or future base data. "Forecast Period" extends projections from the selected time position.</p></div>
        </div>
      </CardContent>
    </Card>
  );
}
