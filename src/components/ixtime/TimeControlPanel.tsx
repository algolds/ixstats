// src/components/ixtime/TimeControlPanel.tsx
import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Rewind,
  FastForward,
  Play,
  Pause,
  RotateCcw,
  Info,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  AlertTriangle,
  Settings,
} from "lucide-react";
import { IxTime } from "~/lib/ixtime";
import { useIxStats } from "~/context/ixstats-context";
import { Button } from "~/components/ui/button";
import { Slider } from "~/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

export interface TimeControlPanelProps {
  isLoading?: boolean;
  className?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export const TimeControlPanel: React.FC<TimeControlPanelProps> = ({
  isLoading = false,
  className = "",
  collapsed = false,
  onCollapsedChange,
}) => {
  const {
    currentIxTime,
    targetIxTime,
    setTargetIxTime,
    forecastYears,
    setForecastYears,
    isTimeTravel,
    resetToPresent,
    timeResolution,
    setTimeResolution,
    botSyncEnabled,
    botSyncStatus,
  } = useIxStats();

  const [isExpanded, setIsExpanded] = useState(!collapsed);
  const [timeOffset, setTimeOffset] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const gameEpoch = IxTime.getInGameEpoch();
  
  // Min/max bounds for timeOffset, relative to the current time
  const maxPastYears = -(IxTime.getCurrentGameYear(currentIxTime) - IxTime.getCurrentGameYear(gameEpoch)) - 5;
  const maxFutureYears = 50;

  useEffect(() => {
    if (onCollapsedChange) {
      onCollapsedChange(!isExpanded);
    }
  }, [isExpanded, onCollapsedChange]);

  // Calculate time offset when targetIxTime changes
  useEffect(() => {
    const calculatedOffset = IxTime.getYearsElapsed(currentIxTime, targetIxTime);
    setTimeOffset(calculatedOffset);
  }, [currentIxTime, targetIxTime]);

  // Handle playback
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
        
        // Update targetIxTime based on new offset
        setTargetIxTime(IxTime.addYears(currentIxTime, newOffset));
        return newOffset;
      });
    }, 100);
    
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, maxFutureYears, maxPastYears, currentIxTime, setTargetIxTime]);

  const handleTimeOffsetChange = (newOffsetArray: number[]) => {
    const newOffset = newOffsetArray[0];
    if (typeof newOffset === 'number') {
      const clampedOffset = Math.max(maxPastYears, Math.min(maxFutureYears, newOffset));
      setTimeOffset(clampedOffset);
      setTargetIxTime(IxTime.addYears(currentIxTime, clampedOffset));
      
      if (isPlaying && (clampedOffset >= maxFutureYears || clampedOffset <= maxPastYears)) {
        setIsPlaying(false);
      }
    }
  };
  
  const handleForecastYearsChange = (newForecastYearsArray: number[]) => {
    const newForecastYears = newForecastYearsArray[0];
    if (typeof newForecastYears === 'number') {
      setForecastYears(newForecastYears);
    }
  };

  const handleReset = () => {
    resetToPresent();
    setTimeOffset(0);
    setIsPlaying(false);
  };

  const handlePlayPause = () => {
    if (timeOffset >= maxFutureYears && !isPlaying) return;
    setIsPlaying(!isPlaying);
  };
  
  const stepTime = (years: number) => {
    const newOffset = timeOffset + years;
    const clampedOffset = Math.max(maxPastYears, Math.min(maxFutureYears, newOffset));
    setTimeOffset(clampedOffset);
    setTargetIxTime(IxTime.addYears(currentIxTime, clampedOffset));
  };

  const getTimeDescription = () => {
    if (Math.abs(timeOffset) < 0.05) return "Present Time";
    if (timeOffset < 0) return `${Math.abs(timeOffset).toFixed(1)} years ago`;
    return `${timeOffset.toFixed(1)} years in future`;
  };
  
  const formatTimestamp = (timestamp: number): string => {
    return IxTime.formatIxTime(timestamp);
  };

  const isAtPresent = Math.abs(timeOffset) < 0.05;

  // Compact mode
  if (!isExpanded) {
    return (
      <Card className={`overflow-hidden ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground flex items-center">
                <Clock className="h-4 w-4 mr-2 text-primary" />
                Viewing: {formatTimestamp(targetIxTime)} ({IxTime.getCurrentGameYear(targetIxTime)})
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {!isAtPresent && (
                  <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                    Time Travel: {getTimeDescription()}
                  </Badge>
                )}
                {forecastYears > 0 && (
                   <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
                    Forecast: +{forecastYears.toFixed(1)} yrs
                  </Badge>
                )}
                {botSyncStatus !== 'connected' && (
                  <Badge variant="outline" className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {botSyncStatus === 'syncing' ? 'Syncing...' : 'Offline Mode'}
                  </Badge>
                )}
              </div>
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
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center"><Calendar className="h-5 w-5 mr-2" />IxTime Control</CardTitle>
          <div className="flex items-center gap-2">
            {!isAtPresent && (
                <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleReset} disabled={isLoading} className="h-8 w-8">
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Reset to Present Time</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
            <Button variant="ghost" size="icon" onClick={() => setIsExpanded(false)} className="h-8 w-8">
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>
          {botSyncStatus === 'connected' ? (
            <>Connected to IxTime bot. {isAtPresent ? "Viewing present time." : "Time travel active."}</>
          ) : botSyncStatus === 'syncing' ? (
            <>Syncing with IxTime bot... Using local time calculations.</>
          ) : (
            <>Offline mode - using local time calculations.</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-muted/50 rounded-md">
              <Label className="text-xs text-muted-foreground block mb-1">Game Date</Label>
              <div className="text-base font-semibold text-foreground">{formatTimestamp(targetIxTime)}</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-md">
              <Label className="text-xs text-muted-foreground block mb-1">Game Year</Label>
              <div className="text-base font-semibold text-foreground">{IxTime.getCurrentGameYear(targetIxTime)}</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-md">
              <Label className="text-xs text-muted-foreground block mb-1">Relative to Present</Label>
              <div className="text-base font-semibold text-foreground">{getTimeDescription()}</div>
            </div>
        </div>
        <div className="space-y-3">
          <Label htmlFor="time-offset-slider">Time Position (Years from Present: {timeOffset.toFixed(1)})</Label>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => stepTime(-1)} 
              disabled={isLoading || timeOffset <= maxPastYears} 
              className="h-8 w-8">
                <Rewind className="h-4 w-4" />
            </Button>
            <Slider 
              id="time-offset-slider" 
              min={maxPastYears} 
              max={maxFutureYears} 
              step={0.1} 
              value={[timeOffset]} 
              onValueChange={handleTimeOffsetChange} 
              disabled={isLoading} 
              className="flex-grow"
            />
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => stepTime(1)} 
              disabled={isLoading || timeOffset >= maxFutureYears} 
              className="h-8 w-8">
                <FastForward className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center justify-center gap-2">
             <Button 
               variant={isPlaying ? "destructive" : "default"} 
               size="sm" 
               onClick={handlePlayPause} 
               disabled={isLoading || (timeOffset >= maxFutureYears && !isPlaying) || (timeOffset <= maxPastYears && !isPlaying)}>
                 {isPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                 {isPlaying ? "Pause" : "Play"}
             </Button>
              {isPlaying && (
                <div className="flex items-center gap-1">
                  {[1, 2, 4].map((speed) => (
                    <Button 
                      key={speed} 
                      variant={playbackSpeed === speed ? "secondary" : "ghost"} 
                      size="sm" 
                      onClick={() => setPlaybackSpeed(speed)}>
                        {speed}x
                    </Button>
                  ))}
                </div>
              )}
          </div>
        </div>
        <div className="space-y-3">
          <Label htmlFor="forecast-slider">Forecast Period (Years from selected time: {forecastYears.toFixed(1)})</Label>
           <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setForecastYears(Math.max(0, forecastYears - 1))} 
              disabled={isLoading || forecastYears <= 0} 
              className="h-8 w-8">
                <Minus className="h-4 w-4" />
            </Button>
            <Slider 
              id="forecast-slider" 
              min={0} 
              max={20} 
              step={0.5} 
              value={[forecastYears]} 
              onValueChange={handleForecastYearsChange} 
              disabled={isLoading} 
              className="flex-grow"
            />
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setForecastYears(Math.min(20, forecastYears + 1))} 
              disabled={isLoading || forecastYears >= 20} 
              className="h-8 w-8">
                <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Chart Resolution</Label>
          <Select
            value={timeResolution}
            onValueChange={(value: 'quarterly' | 'annual') => setTimeResolution(value)}
            disabled={isLoading}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Resolution" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <Settings className="h-4 w-4 mr-2" />
              Advanced Settings
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <h4 className="font-medium">IxTime Settings</h4>
              <div className="flex items-center justify-between">
                <Label htmlFor="bot-sync" className="cursor-pointer">Bot Synchronization</Label>
                <Switch 
                  id="bot-sync" 
                  checked={botSyncEnabled} 
                  // This is commented out because we're just showing the UI component.
                  // In a real implementation, this would update the botSyncEnabled state.
                  // onCheckedChange={setBotSyncEnabled} 
                />
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  IxTime synchronizes time calculations with your Discord bot. When disabled, 
                  calculations use local time with 4x multiplier.
                </p>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground pt-0">
        <div className="flex items-start">
          <Info className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
          <p>
            IxTime runs 4x faster than real time. All data is aligned with the game epoch (January 1, 2028). 
            Charts will automatically update as time progresses.
          </p>
        </div>
      </CardFooter>
    </Card>
  );
};