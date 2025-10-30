// src/app/dashboard/_components/DashboardHeader.tsx
"use client";

import { useState, useEffect } from "react";
import { Clock, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { IxTime } from "~/lib/ixtime";
import { Button } from "~/components/ui/button";
import { useStatusColors } from "~/context/theme-context";

interface DashboardHeaderProps {
  onRefreshAction: () => void; // renamed
  isLoading?: boolean;
}

export function DashboardHeader({ onRefreshAction, isLoading = false }: DashboardHeaderProps) {
  const [currentIxTime, setCurrentIxTime] = useState<string>("");
  const [botConnected, setBotConnected] = useState(true);
  const statusColors = useStatusColors();

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const now = await IxTime.getCurrentIxTimeFromBot();
        if (!active) return;
        setCurrentIxTime(IxTime.formatIxTime(now, true));
        setBotConnected(true);
      } catch {
        if (!active) return;
        const now = IxTime.getCurrentIxTime();
        setCurrentIxTime(IxTime.formatIxTime(now, true));
        setBotConnected(false);
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, []);

  return (
    <div className="bg-card text-card-foreground border-b">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">
          <div>
            <h1 className="text-primary text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1 text-sm">Real-time economic statistics</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-muted-foreground flex items-center text-sm">
              <Clock className="h-4 w-4" />
              <span className="font-medium">{currentIxTime}</span>
              {botConnected ? (
                <Wifi className="ml-1 h-3 w-3" style={{ color: statusColors.online }} />
              ) : (
                <div className="ml-1 flex items-center" style={{ color: statusColors.warning }}>
                  <WifiOff className="h-3 w-3" />
                  <span className="ml-1 text-xs">(Local)</span>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={onRefreshAction} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh All
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
