"use client";

import { useEffect, useState } from "react";
import { Shield, Clock, WarningTriangle as AlertTriangle } from "iconoir-react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";

/** The console's live status: IxTime, bot connection and system health. */
function useSystemStatus() {
  const [liveFormattedTime, setLiveFormattedTime] = useState("");

  const { data: systemStatus } = api.admin.getSystemStatus.useQuery(undefined, {
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });

  const { data: botStatus } = api.admin.getBotStatus.useQuery(undefined, {
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
  });

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

/** The console's live status strip, shown above every admin page. */
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
          {s.systemStatus?.countryCount ?? "—"}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className="text-label-secondary">Storyteller events</span>
        <span className="text-label font-medium tabular-nums">
          {s.systemStatus?.activeStorytellerEffects ?? "—"}
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
