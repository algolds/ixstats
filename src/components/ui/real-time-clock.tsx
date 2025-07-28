"use client";

import { useState, useEffect } from 'react';
import { Clock, Zap, Pause } from 'lucide-react';
import { IxTime } from '~/lib/ixtime';

interface RealTimeClockProps {
  className?: string;
  showMultiplier?: boolean;
  showGameYear?: boolean;
  updateInterval?: number;
}

export function RealTimeClock({ 
  className = "", 
  showMultiplier = true, 
  showGameYear = true,
  updateInterval = 1000 
}: RealTimeClockProps) {
  const [currentTime, setCurrentTime] = useState({
    ixTime: Date.now(),
    formatted: '',
    multiplier: 2,
    gameYear: 2040,
    isNatural: true
  });

  useEffect(() => {
    const updateTime = () => {
      try {
        const ixTime = IxTime.getCurrentIxTime();
        const formatted = IxTime.formatIxTime(ixTime, true);
        const multiplier = IxTime.getTimeMultiplier();
        const gameYear = IxTime.getCurrentGameYear();
        const isNatural = IxTime.isMultiplierNatural();

        setCurrentTime({
          ixTime,
          formatted,
          multiplier,
          gameYear,
          isNatural
        });
      } catch (error) {
        console.error('Error updating real-time clock:', error);
      }
    };

    // Update immediately
    updateTime();

    // Set up interval
    const interval = setInterval(updateTime, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Clock className="h-4 w-4 text-blue-500" />
      <div className="flex flex-col">
        <div className="text-sm font-medium text-foreground">
          {currentTime.formatted}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {showGameYear && (
            <span>Year {currentTime.gameYear}</span>
          )}
          {showMultiplier && (
            <div className="flex items-center gap-1">
              {currentTime.multiplier === 0 ? (
                <Pause className="h-3 w-3" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              <span>
                {currentTime.multiplier}x 
                {currentTime.isNatural ? ' (natural)' : ' (override)'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}