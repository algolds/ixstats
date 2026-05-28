"use client";

import { useEffect, useState } from "react";
import { Shield, Clock, Bot, Activity, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { cn } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { PreText } from "~/components/ui/pretext";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";

export function SystemStatusWidget() {
  const [liveFormattedTime, setLiveFormattedTime] = useState("");

  const { data: systemStatus, isLoading: statusLoading } = api.admin.getSystemStatus.useQuery(
    undefined,
    { refetchInterval: 30000, refetchOnWindowFocus: false }
  );

  const { data: botStatus, isLoading: botStatusLoading } = api.admin.getBotStatus.useQuery(
    undefined,
    { refetchInterval: 15000, refetchOnWindowFocus: false }
  );

  const { data: configData } = api.admin.getConfig.useQuery();

  // Poll local IxTime calculations to match server progress
  useEffect(() => {
    const update = () => {
      const ix = IxTime.getCurrentIxTime();
      setLiveFormattedTime(IxTime.formatIxTime(ix, true));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const botAvailable = botStatus?.botHealth?.available ?? false;
  const warningCount = systemStatus?.warnings?.length ?? 0;

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin-system-status-collapsed") === "true";
    }
    return false;
  });

  const toggleCollapsed = () => {
    const nextVal = !isCollapsed;
    setIsCollapsed(nextVal);
    localStorage.setItem("admin-system-status-collapsed", String(nextVal));
  };

  return (
    <CutoutCard
      className={cn(
        cutoutCardSurfaceClassName,
        "border-border/30 bg-card/40 w-full overflow-hidden rounded-xl border shadow-sm backdrop-blur-md"
      )}
      trackPointerHover={false}
    >
      {/* Cutout Header Tab (clickable to toggle collapse) */}
      <div
        className="relative cursor-pointer bg-indigo-500/10 px-4 pt-3 pb-5 transition-colors select-none hover:bg-indigo-500/15"
        onClick={toggleCollapsed}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-indigo-500/15 p-1 text-indigo-500">
              <Shield className="h-4 w-4" />
            </div>
            <PreText className="text-foreground text-xs font-bold tracking-wider uppercase">
              System Console
            </PreText>
          </div>
          <div className="text-muted-foreground hover:text-foreground mr-1 rounded p-0.5 transition-colors">
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </div>
        </div>
        <CutoutCorner className="text-card absolute -bottom-px left-0" size={16} />
        <CutoutCorner className="text-card absolute right-0 -bottom-px -scale-x-100" size={16} />
      </div>

      {isCollapsed ? (
        <div className="border-border/10 flex items-center justify-between gap-1.5 overflow-hidden border-t bg-black/10 px-3 py-2 text-[10px]">
          {/* IxTime */}
          <span
            className="max-w-[100px] shrink-0 truncate font-mono font-bold whitespace-nowrap text-blue-600 dark:text-blue-400"
            title="Current IxTime"
          >
            {liveFormattedTime || systemStatus?.ixTime?.formattedIxTime || "Time"}
          </span>
          {/* Bot Connection */}
          <span
            className="flex shrink-0 items-center gap-1 overflow-hidden"
            title={botAvailable ? "Bot Connected" : "Bot Offline"}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                botAvailable ? "animate-pulse bg-green-500" : "bg-red-500"
              )}
            />
            <span className="text-muted-foreground truncate font-semibold whitespace-nowrap">
              Bot
            </span>
          </span>
          {/* System Status (warnings count) */}
          <span
            className="flex shrink-0 items-center gap-1 overflow-hidden"
            title={warningCount > 0 ? `${warningCount} warnings active` : "System Health Ok"}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                warningCount > 0 ? "bg-amber-500" : "bg-green-500"
              )}
            />
            <span className="text-muted-foreground truncate font-semibold whitespace-nowrap">
              {warningCount > 0 ? `${warningCount} Alert` : "Healthy"}
            </span>
          </span>
        </div>
      ) : (
        <CutoutCardContent className="space-y-3 p-4 pt-1">
          {/* Live IxTime Display */}
          <div className="space-y-1">
            <div className="text-muted-foreground flex items-center gap-1.5 text-[9px] font-medium tracking-wider uppercase">
              <Clock className="h-3 w-3 text-blue-400" />
              IxTime
            </div>
            {statusLoading ? (
              <Skeleton className="h-5 w-full" />
            ) : (
              <div className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                {liveFormattedTime || systemStatus?.ixTime?.formattedIxTime || "N/A"}
                {configData?.timeMultiplier !== undefined && (
                  <span className="text-muted-foreground ml-1.5 text-[10px] font-normal">
                    ({configData.timeMultiplier.toFixed(1)}x)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Discord Bot Status */}
          <div className="space-y-1">
            <div className="text-muted-foreground flex items-center gap-1.5 text-[9px] font-medium tracking-wider uppercase">
              <Bot className="h-3 w-3 text-green-400" />
              Discord Bot
            </div>
            {botStatusLoading ? (
              <Skeleton className="h-5 w-full" />
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    botAvailable ? "animate-pulse bg-green-500" : "bg-red-500"
                  )}
                />
                <span className="text-xs font-medium">
                  {botAvailable ? "Connected" : "Disconnected"}
                </span>
              </div>
            )}
          </div>

          {/* Quick System Indicators */}
          <div className="border-border/30 space-y-1.5 border-t pt-2.5">
            {/* Countries */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-emerald-400" />
                Countries
              </span>
              <span className="font-bold">
                {statusLoading ? (
                  <Skeleton className="h-3 w-8" />
                ) : (
                  (systemStatus?.countryCount ?? 0)
                )}
              </span>
            </div>

            {/* Active Storyteller Effects */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Storyteller Events</span>
              <span className="font-bold">
                {statusLoading ? (
                  <Skeleton className="h-3 w-8" />
                ) : (
                  (systemStatus?.activeStorytellerEffects ?? 0)
                )}
              </span>
            </div>

            {/* Last Calculation Time */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Last Recalc</span>
              <span className="text-muted-foreground font-mono font-semibold">
                {statusLoading ? (
                  <Skeleton className="h-3 w-12" />
                ) : systemStatus?.lastCalculation?.timestamp ? (
                  new Date(systemStatus.lastCalculation.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                ) : (
                  "N/A"
                )}
              </span>
            </div>

            {/* Warnings */}
            {warningCount > 0 && (
              <div className="mt-1 flex items-center justify-between rounded-md border border-amber-500/15 bg-amber-500/5 px-2 py-1 text-[11px]">
                <span className="flex items-center gap-1.5 text-amber-500">
                  <AlertTriangle className="h-3 w-3" />
                  Warnings
                </span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{warningCount}</span>
              </div>
            )}
          </div>
        </CutoutCardContent>
      )}
    </CutoutCard>
  );
}
