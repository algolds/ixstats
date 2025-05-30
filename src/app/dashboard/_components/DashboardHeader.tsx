// src/app/dashboard/_components/DashboardHeader.tsx
"use client";

import { useState, useEffect } from "react";
import { Clock, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { IxTime } from "~/lib/ixtime";
import { getButtonClasses } from "~/lib/theme-utils";
import { useStatusColors } from "~/context/theme-context";

interface DashboardHeaderProps {
  onRefresh: () => void;
  isLoading?: boolean;
}

export function DashboardHeader({ onRefresh, isLoading = false }: DashboardHeaderProps) {
  const [currentIxTime, setCurrentIxTime] = useState<string>("");
  const [botConnected, setBotConnected] = useState<boolean>(true);
  const statusColors = useStatusColors();

  // Update IxTime display with bot sync
  useEffect(() => {
    let isActive = true;
    
    const updateTime = async () => {
      try {
        // Try to get time from bot first
        const currentTime = await IxTime.getCurrentIxTimeFromBot();
        if (isActive) {
          setCurrentIxTime(IxTime.formatIxTime(currentTime, true));
          setBotConnected(true);
        }
      } catch (error) {
        // Fallback to local time calculation
        if (isActive) {
          const localTime = IxTime.getCurrentIxTime();
          setCurrentIxTime(IxTime.formatIxTime(localTime, true));
          setBotConnected(false);
          console.warn('[Dashboard] Using local time fallback:', error);
        }
      }
    };

    // Initial update
    updateTime();
    
    // Update every second
    const interval = setInterval(updateTime, 1000);
    
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="bg-[var(--color-bg-surface)] shadow-sm border-b border-[var(--color-border-primary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Dashboard</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Real-time economic statistics
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* IxTime Display */}
            <div className="flex items-center text-sm text-[var(--color-text-tertiary)]">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span className="font-medium">{currentIxTime}</span>
                {!botConnected ? (
                  <div className="flex items-center text-[var(--color-warning)]">
                    <WifiOff className="h-3 w-3 ml-1" />
                    <span className="text-xs ml-1">(Local)</span>
                  </div>
                ) : (
                  <Wifi className="h-3 w-3 ml-1" style={{ color: statusColors.online }} />
                )}
              </div>
            </div>
            
            {/* Main Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className={getButtonClasses('secondary', 'md', isLoading)}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "loading-spinner" : ""}`} />
              Refresh All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}