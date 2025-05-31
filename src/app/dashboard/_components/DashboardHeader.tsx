// src/app/dashboard/_components/DashboardHeader.tsx
"use client";

import { useState, useEffect } from "react";
import { Clock, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { IxTime } from "~/lib/ixtime";
import { Button } from "~/components/ui/button"; // Import shadcn/ui Button
import { useStatusColors } from "~/context/theme-context"; // Assuming this provides CSS variables

interface DashboardHeaderProps {
  onRefresh: () => void;
  isLoading?: boolean;
}

export function DashboardHeader({ onRefresh, isLoading = false }: DashboardHeaderProps) {
  const [currentIxTime, setCurrentIxTime] = useState<string>("");
  const [botConnected, setBotConnected] = useState<boolean>(true);
  const statusColors = useStatusColors(); // This seems to provide CSS variable names

  useEffect(() => {
    let isActive = true;
    const updateTime = async () => {
      try {
        const currentTime = await IxTime.getCurrentIxTimeFromBot();
        if (isActive) {
          setCurrentIxTime(IxTime.formatIxTime(currentTime, true));
          setBotConnected(true);
        }
      } catch (error) {
        if (isActive) {
          const localTime = IxTime.getCurrentIxTime();
          setCurrentIxTime(IxTime.formatIxTime(localTime, true));
          setBotConnected(false);
          console.warn('[Dashboard] Using local time fallback:', error);
        }
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="border-b bg-card text-card-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center py-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Real-time economic statistics
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4" />
                <span className="font-medium">{currentIxTime}</span>
                {!botConnected ? (
                  <div className="flex items-center" style={{ color: statusColors.warning }}>
                    <WifiOff className="h-3 w-3 ml-1" />
                    <span className="text-xs ml-1">(Local)</span>
                  </div>
                ) : (
                  <Wifi className="h-3 w-3 ml-1" style={{ color: statusColors.online }} />
                )}
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh All
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}