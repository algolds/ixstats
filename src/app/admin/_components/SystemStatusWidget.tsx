"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  Clock,
  Cpu as Bot,
  Activity,
  WarningTriangle as AlertTriangle,
  NavArrowDown as ChevronDown,
  NavArrowUp as ChevronUp,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { cn } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { CutoutCard, CutoutCorner } from "~/components/ui/cutout-card";
import { Card } from "~/components/ui/card";

/** The console's live status: IxTime, bot connection and system health. */
function useSystemStatus() {
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

  return {
    systemStatus,
    statusLoading,
    botStatusLoading,
    configData,
    liveFormattedTime,
    botAvailable: botStatus?.botHealth?.available ?? false,
    warningCount: systemStatus?.warnings?.length ?? 0,
  };
}

function StatusDot({ tone }: { tone: "green" | "red" | "yellow" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        tone === "green" ? "bg-green" : tone === "red" ? "bg-red" : "bg-yellow"
      )}
    />
  );
}

function formatLastRecalc(timestamp: string | number | Date | undefined | null) {
  return timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "N/A";
}

/**
 * The status strip shown above the console under the new navigation shell, where the admin rail
 * (and the rail's `SystemStatusWidget`) is hidden in favour of the AppSidebar.
 */
export function SystemStatusStrip({ className }: { className?: string }) {
  const s = useSystemStatus();
  return (
    <Card
      role="status"
      aria-label="System console"
      className={cn(
        "text-footnote flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 tabular-nums",
        className
      )}
    >
      <span className="text-headline text-label flex items-center gap-2">
        <Shield aria-hidden className="text-tint size-4" />
        System console
      </span>
      <span className="flex items-center gap-2" title="Current IxTime">
        <Clock aria-hidden className="text-label-secondary size-3.5" />
        <span className="text-label font-medium">
          {s.liveFormattedTime || s.systemStatus?.ixTime?.formattedIxTime || "N/A"}
        </span>
        {s.configData?.timeMultiplier !== undefined && (
          <span className="text-label-secondary">({s.configData.timeMultiplier.toFixed(1)}x)</span>
        )}
      </span>
      <span className="flex items-center gap-2">
        <StatusDot tone={s.botAvailable ? "green" : "red"} />
        <span className="text-label-secondary">Discord bot</span>
        <span className="text-label">{s.botAvailable ? "Connected" : "Disconnected"}</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="text-label-secondary">Countries</span>
        <span className="text-label font-medium tabular-nums">
          {s.systemStatus?.countryCount ?? 0}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className="text-label-secondary">Storyteller events</span>
        <span className="text-label font-medium tabular-nums">
          {s.systemStatus?.activeStorytellerEffects ?? 0}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className="text-label-secondary">Last recalc</span>
        <span className="text-label font-medium">
          {formatLastRecalc(s.systemStatus?.lastCalculation?.timestamp)}
        </span>
      </span>
      {s.warningCount > 0 ? (
        <Badge variant="warning">
          <AlertTriangle aria-hidden />
          {s.warningCount} warnings
        </Badge>
      ) : (
        <Badge variant="success">Healthy</Badge>
      )}
    </Card>
  );
}

export function SystemStatusWidget() {
  const {
    systemStatus,
    statusLoading,
    botStatusLoading,
    configData,
    liveFormattedTime,
    botAvailable,
    warningCount,
  } = useSystemStatus();

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
    // A CutoutCard whose tinted header tab toggles the collapse.
    <CutoutCard variant="card" trackPointerHover={false} className="w-full rounded-xl">
      {/* Cutout header tab (toggles collapse) */}
      <Button
        variant="ghost"
        onClick={toggleCollapsed}
        aria-expanded={!isCollapsed}
        className="bg-tint-fill hover:bg-tint/15 relative h-auto w-full justify-between rounded-none px-4 pt-3 pb-5 text-left focus-visible:-outline-offset-2"
      >
        <CutoutCorner className="text-surface absolute -bottom-px left-0" size={16} />
        <CutoutCorner className="text-surface absolute right-0 -bottom-px -scale-x-100" size={16} />
        <span className="flex items-center gap-2">
          <span className="bg-tint-fill text-tint rounded-control-sm p-1">
            <Shield aria-hidden className="size-4" />
          </span>
          <span className="text-headline text-label">System console</span>
        </span>
        <span className="text-label-secondary">
          {isCollapsed ? (
            <ChevronDown aria-hidden className="size-4" />
          ) : (
            <ChevronUp aria-hidden className="size-4" />
          )}
          <span className="sr-only">{isCollapsed ? "Expand" : "Collapse"}</span>
        </span>
      </Button>

      {isCollapsed ? (
        <div className="text-footnote flex items-center justify-between gap-2 overflow-hidden px-3 py-2 tabular-nums">
          {/* IxTime */}
          <span
            className="text-label max-w-[100px] shrink-0 truncate font-medium whitespace-nowrap"
            title="Current IxTime"
          >
            {liveFormattedTime || systemStatus?.ixTime?.formattedIxTime || "Time"}
          </span>
          {/* Bot Connection */}
          <span
            className="flex shrink-0 items-center gap-1 overflow-hidden"
            title={botAvailable ? "Bot Connected" : "Bot Offline"}
          >
            <StatusDot tone={botAvailable ? "green" : "red"} />
            <span className="text-label-secondary truncate whitespace-nowrap">Bot</span>
          </span>
          {/* System Status (warnings count) */}
          <span
            className="flex shrink-0 items-center gap-1 overflow-hidden"
            title={warningCount > 0 ? `${warningCount} warnings active` : "System Health Ok"}
          >
            <StatusDot tone={warningCount > 0 ? "yellow" : "green"} />
            <span className="text-label-secondary truncate whitespace-nowrap">
              {warningCount > 0 ? `${warningCount} Alert` : "Healthy"}
            </span>
          </span>
        </div>
      ) : (
        <div className="space-y-3 p-4 pt-1 tabular-nums">
          {/* Live IxTime Display */}
          <div className="space-y-1">
            <div className="text-eyebrow text-label-secondary flex items-center gap-2">
              <Clock aria-hidden className="size-3.5" />
              IxTime
            </div>
            {statusLoading ? (
              <Skeleton className="h-5 w-full" />
            ) : (
              <div className="text-headline text-label">
                {liveFormattedTime || systemStatus?.ixTime?.formattedIxTime || "N/A"}
                {configData?.timeMultiplier !== undefined && (
                  <span className="text-footnote text-label-secondary ml-2 font-normal">
                    ({configData.timeMultiplier.toFixed(1)}x)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Discord Bot Status */}
          <div className="space-y-1">
            <div className="text-eyebrow text-label-secondary flex items-center gap-2">
              <Bot aria-hidden className="size-3.5" />
              Discord bot
            </div>
            {botStatusLoading ? (
              <Skeleton className="h-5 w-full" />
            ) : (
              <div className="flex items-center gap-2">
                <StatusDot tone={botAvailable ? "green" : "red"} />
                <span className="text-callout text-label">
                  {botAvailable ? "Connected" : "Disconnected"}
                </span>
              </div>
            )}
          </div>

          {/* Quick System Indicators */}
          <dl className="border-separator text-footnote space-y-2 border-t pt-3">
            <div className="flex items-center justify-between">
              <dt className="text-label-secondary flex items-center gap-2">
                <Activity aria-hidden className="size-3.5" />
                Countries
              </dt>
              <dd className="text-label font-medium">
                {statusLoading ? (
                  <Skeleton className="h-3 w-8" />
                ) : (
                  (systemStatus?.countryCount ?? 0)
                )}
              </dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="text-label-secondary">Storyteller events</dt>
              <dd className="text-label font-medium">
                {statusLoading ? (
                  <Skeleton className="h-3 w-8" />
                ) : (
                  (systemStatus?.activeStorytellerEffects ?? 0)
                )}
              </dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="text-label-secondary">Last recalc</dt>
              <dd className="text-label font-medium">
                {statusLoading ? (
                  <Skeleton className="h-3 w-12" />
                ) : (
                  formatLastRecalc(systemStatus?.lastCalculation?.timestamp)
                )}
              </dd>
            </div>

            {warningCount > 0 && (
              <div className="bg-warning/10 rounded-control-sm mt-1 flex items-center justify-between px-2 py-1">
                <dt className="text-warning flex items-center gap-2">
                  <AlertTriangle aria-hidden className="size-3.5" />
                  Warnings
                </dt>
                <dd className="text-warning font-semibold">{warningCount}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </CutoutCard>
  );
}
