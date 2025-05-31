// src/components/charts/time-control-bar.tsx
import { useState, useEffect } from "react";
import { IxTime } from "~/lib/ixtime";
import { Button } from "~/components/ui/button";
import { Slider } from "~/components/ui/slider";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "~/components/ui/tooltip";
import { useChartContext } from "~/context/chart-context";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  FastForward, 
  Rewind,
  Calendar
} from "lucide-react";

interface TimeControlBarProps {
  minTime?: number; // Earliest available data
  maxTime?: number; // Latest available data (or forecast)
  showPlayControls?: boolean;
  onTimeChange?: (time: number) => void;
}

export function TimeControlBar({
  minTime,
  maxTime,
  showPlayControls = true,
  onTimeChange
}: TimeControlBarProps) {
  const { currentTime, setCurrentTime } = useChartContext();
  
  // Local state for playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  // Set default min/max if not provided
  const effectiveMinTime = minTime || IxTime.getInGameEpoch() - (5 * 365 * 24 * 60 * 60 * 1000); // 5 years before epoch
  const effectiveMaxTime = maxTime || IxTime.addYears(IxTime.getCurrentIxTime(), 5); // 5 years in future
  
  // Format current time for display
  const formattedTime = IxTime.formatIxTime(currentTime, true);
  const gameYear = IxTime.getCurrentGameYear(currentTime);
  
  // Handle time slider change
  const handleSliderChange = (value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    onTimeChange?.(newTime);
  };
  
  // Jump to specific points
  const jumpToEpoch = () => {
    setCurrentTime(IxTime.getInGameEpoch());
    onTimeChange?.(IxTime.getInGameEpoch());
  };
  
  const jumpToPresent = () => {
    setCurrentTime(IxTime.getCurrentIxTime());
    onTimeChange?.(IxTime.getCurrentIxTime());
  };
  
  // Time navigation
  const moveTime = (years: number) => {
    const newTime = IxTime.addYears(currentTime, years);
    
    // Ensure we stay within bounds
    if (newTime >= effectiveMinTime && newTime <= effectiveMaxTime) {
      setCurrentTime(newTime);
      onTimeChange?.(newTime);
    }
  };
  
  // Playback controls
  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };
  
  const resetPlayback = () => {
    setIsPlaying(false);
    jumpToEpoch();
  };
  
  // Auto-advance time when playing
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      const newTime = IxTime.addYears(currentTime, 0.25 * playbackSpeed);
      
      if (newTime <= effectiveMaxTime) {
        setCurrentTime(newTime);
        onTimeChange?.(newTime);
      } else {
        setIsPlaying(false);
      }
    }, 500);
    
    return () => clearInterval(interval);
  }, [isPlaying, currentTime, playbackSpeed, effectiveMaxTime, onTimeChange, setCurrentTime]);
  
  return (
    <div className="flex flex-col space-y-2 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Time Control</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={jumpToEpoch}>
                  <Calendar className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Jump to Game Epoch (2028)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <div className="text-sm font-semibold">
          {gameYear} • {formattedTime}
        </div>
      </div>
      
      <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center">
        <span className="text-xs">{IxTime.getCurrentGameYear(effectiveMinTime)}</span>
        
        <Slider
          value={[currentTime]}
          min={effectiveMinTime}
          max={effectiveMaxTime}
          step={(effectiveMaxTime - effectiveMinTime) / 1000}
          onValueChange={handleSliderChange}
        />
        
        <span className="text-xs">{IxTime.getCurrentGameYear(effectiveMaxTime)}</span>
      </div>
      
      {showPlayControls && (
        <div className="flex items-center justify-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => moveTime(-1)}>
            <Rewind className="h-4 w-4 mr-1" />
            1 Year
          </Button>
          
          <Button variant="outline" size="sm" onClick={resetPlayback}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          
          <Button variant="outline" size="sm" onClick={togglePlayback}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          
          <Button variant="outline" size="sm" onClick={() => moveTime(1)}>
            <FastForward className="h-4 w-4 mr-1" />
            1 Year
          </Button>
          
          <Button variant="outline" size="sm" onClick={jumpToPresent}>
            Current
          </Button>
        </div>
      )}
    </div>
  );
}
