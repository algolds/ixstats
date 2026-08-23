// src/app/admin/_components/platform/SystemMetricsCard.tsx
"use client";

import { Database, Activity, Globe, Clock, Server, Refresh as RefreshCw } from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Separator } from "~/components/ui/separator";
import { api } from "~/trpc/react";
import { formatDistanceToNow } from "date-fns";

import { useVisibleRefetch } from "~/hooks/useVisibleRefetch";

export function SystemMetricsCard() {
  const statusInterval = useVisibleRefetch(30000);
  const healthInterval = useVisibleRefetch(60000);

  const { data: systemStatus, refetch: refetchSystemStatus } = api.admin.getSystemStatus.useQuery(
    undefined,
    { refetchInterval: statusInterval }
  );

  const { data: systemHealth } = api.admin.getSystemHealth.useQuery(undefined, {
    refetchInterval: healthInterval,
  });

  if (!systemStatus || !systemHealth) {
    return (
      <Card className="facet-surface border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-purple-500" />
            System Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="facet-surface border-border/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-purple-500" />
              System Metrics
            </CardTitle>
            <CardDescription>Real-time platform health and activity</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchSystemStatus()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Status Cards Grid */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatusCard
            label="Database"
            value={systemHealth.database.connected ? "Connected" : "Disconnected"}
            detail={`${systemHealth.database.countries} countries`}
            icon={
              <Database
                className={`h-5 w-5 ${systemHealth.database.connected ? "text-green-500" : "text-red-500"}`}
              />
            }
          />
          <StatusCard
            label="Countries"
            value={String(systemStatus.countryCount)}
            detail={`${systemStatus.activeStorytellerEffects} storyteller effects`}
            icon={<Activity className="h-5 w-5 text-blue-500" />}
          />
          <StatusCard
            label="Discord Bot"
            value={systemHealth.bot.available ? "Connected" : "Unavailable"}
            detail={systemHealth.bot.message || "No message"}
            icon={
              <Globe
                className={`h-5 w-5 ${systemHealth.bot.available ? "text-green-500" : "text-amber-500"}`}
              />
            }
          />
          <StatusCard
            label="Calculations"
            value={String(systemHealth.database.recentCalculations)}
            detail="Last 24 hours"
            icon={<Clock className="h-5 w-5 text-purple-500" />}
          />
        </div>

        <Separator />

        {/* Detailed Metrics - flat layout, no nested cards */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
          <MetricItem label="Current IxTime" value={systemHealth.ixTime.formatted} />
          <MetricItem label="Multiplier" value={`${systemHealth.ixTime.multiplier}x`} />
          <MetricItem
            label="IxTime Status"
            value={systemHealth.ixTime.isPaused ? "Paused" : "Running"}
            badge={systemHealth.ixTime.isPaused ? "destructive" : "default"}
          />
          <MetricItem
            label="Last Update"
            value={`${formatDistanceToNow(new Date(systemHealth.lastUpdate))} ago`}
          />
        </div>

        {/* Last Calculation Detail */}
        {systemStatus.lastCalculation && (
          <>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Last Calculation</p>
                <p className="text-foreground font-medium">
                  {systemStatus.lastCalculation.countriesUpdated} countries updated
                </p>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="text-xs tabular-nums">
                  {systemStatus.lastCalculation.executionTimeMs}ms
                </Badge>
                <p className="text-muted-foreground mt-1 text-xs">
                  {formatDistanceToNow(new Date(systemStatus.lastCalculation.timestamp))} ago
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatusCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="border-border/20 bg-card/10 hover:border-border/30 hover:bg-card/15 rounded-lg border p-3 transition-all duration-200">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">{label}</p>
        {icon}
      </div>
      <p className="text-foreground mt-1 text-base font-bold">{value}</p>
      <p className="text-muted-foreground/75 mt-0.5 text-[10px] leading-tight font-medium">
        {detail}
      </p>
    </div>
  );
}

function MetricItem({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: "default" | "destructive";
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      {badge ? (
        <Badge variant={badge} className="mt-0.5 text-xs">
          {value}
        </Badge>
      ) : (
        <p className="text-foreground mt-0.5 text-sm font-medium">{value}</p>
      )}
    </div>
  );
}
