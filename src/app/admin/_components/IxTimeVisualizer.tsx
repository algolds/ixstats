"use client";
/**
 * IxTime Visualizer - Unified time visualization with IRL comparison tools
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Clock,
  Activity,
  WarningTriangle as AlertTriangle,
  CheckCircle,
  XmarkCircle as XCircle,
  Refresh as RefreshCw,
  Play,
  Pause,
  Flash as Zap,
  Archery as Target,
  ArrowSeparate as ArrowRightLeft,
  NavArrowDown as ChevronDown,
  NavArrowUp as ChevronUp,
  Timer,
} from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Progress } from "~/components/ui/progress";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { IxTime } from "~/lib/ixtime";
import { IxTimeAccuracyVerifier, type TimeSimulationResult } from "~/lib/ixtime";
import { IxTimeSyncManager, type MasterTimeState, type SyncStatus } from "~/lib/ixtime";

interface TimeVisualizationData {
  currentIxTime: number;
  currentRealTime: number;
  currentGameYear: number;
  multiplier: number;
  isPaused: boolean;
  formattedTime: string;
  equivalentRealDate: string;
  ixDaysPerRealDay: number;
  predictedIxTime24h: string;
}

// Reference milestones for the timeline table
const MILESTONES = [
  { label: "System Start", ixDate: "Oct 4, 2020", realDate: "Oct 4, 2020" },
  { label: "In-Game Epoch", ixDate: "Jan 1, 2028", realDate: "Oct 4, 2022" },
  { label: "Speed Change", ixDate: "Jan 1, 2040", realDate: "Jul 27, 2025" },
];

export function IxTimeVisualizer() {
  const [timeData, setTimeData] = useState<TimeVisualizationData | null>(null);
  const [accuracyStatus, setAccuracyStatus] = useState<any>(null);
  const [syncManager] = useState(() => IxTimeSyncManager.getInstance());
  const [_masterState, setMasterState] = useState<MasterTimeState | null>(null);
  const [syncStatuses, setSyncStatuses] = useState<SyncStatus[]>([]);
  const [isRunningSimulation, setIsRunningSimulation] = useState(false);
  const [simulationResults, setSimulationResults] = useState<TimeSimulationResult | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Converter state
  const [converterMode, setConverterMode] = useState<"irl-to-ix" | "ix-to-irl">("irl-to-ix");
  const [converterInput, setConverterInput] = useState("");
  const [converterResult, setConverterResult] = useState<string | null>(null);

  // Update time data
  const updateTimeData = useCallback(() => {
    try {
      const currentIxTime = IxTime.getCurrentIxTime();
      const currentRealTime = Date.now();
      const currentGameYear = IxTime.getCurrentGameYear();
      const multiplier = IxTime.getTimeMultiplier();
      const isPaused = IxTime.isPaused();
      const formattedTime = IxTime.formatIxTime(currentIxTime, true);

      // IRL equivalent of current IxTime
      const realEquiv = IxTime.convertFromIxTime(currentIxTime);
      const equivalentRealDate = new Date(realEquiv).toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      // Daily rate
      const ixDaysPerRealDay = IxTime.getIxDaysPerRealDay(multiplier);

      // Predicted IxTime in 24 real hours
      const predicted = IxTime.predictIxTimeAfterRealHours(24, multiplier);
      const predictedIxTime24h = IxTime.formatIxTime(predicted);

      setTimeData({
        currentIxTime,
        currentRealTime,
        currentGameYear,
        multiplier,
        isPaused,
        formattedTime,
        equivalentRealDate,
        ixDaysPerRealDay,
        predictedIxTime24h,
      });
    } catch (error) {
      console.error("Error updating time data:", error);
    }
  }, []);

  const updateAccuracyStatus = useCallback(() => {
    try {
      setAccuracyStatus(IxTimeAccuracyVerifier.getAccuracyStatus());
    } catch (error) {
      console.error("Error updating accuracy status:", error);
    }
  }, []);

  const updateSyncStatus = useCallback(() => {
    try {
      setMasterState(syncManager.getMasterState());
      setSyncStatuses(syncManager.getSyncStatuses());
    } catch (error) {
      console.error("Error updating sync status:", error);
    }
  }, [syncManager]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      updateTimeData();
      updateAccuracyStatus();
      updateSyncStatus();
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, updateTimeData, updateAccuracyStatus, updateSyncStatus]);

  // Initial load
  useEffect(() => {
    updateTimeData();
    updateAccuracyStatus();
    updateSyncStatus();
    syncManager.start().catch(console.error);
    return () => {
      syncManager.stop();
    };
  }, [syncManager, updateTimeData, updateAccuracyStatus, updateSyncStatus]);

  // Converter logic
  const handleConvert = useCallback(() => {
    if (!converterInput) return;
    try {
      const inputDate = new Date(converterInput);
      if (isNaN(inputDate.getTime())) {
        setConverterResult("Invalid date");
        return;
      }
      if (converterMode === "irl-to-ix") {
        // Real date → IxTime date
        const ixTime = IxTime.convertToIxTime(inputDate.getTime());
        setConverterResult(IxTime.formatIxTime(ixTime));
      } else {
        // IxTime date → Real date
        const realTime = IxTime.convertFromIxTime(inputDate.getTime());
        setConverterResult(
          new Date(realTime).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        );
      }
    } catch {
      setConverterResult("Conversion error");
    }
  }, [converterInput, converterMode]);

  // Dynamic milestones that include future projections
  const dynamicMilestones = useMemo(() => {
    const currentYear = timeData?.currentGameYear ?? 2040;
    const futures = [
      { label: "Current", year: currentYear },
      { label: "+1 Year", year: currentYear + 1 },
      { label: "+5 Years", year: currentYear + 5 },
      { label: "Year 2050", year: 2050 },
      { label: "Year 2060", year: 2060 },
    ].filter((f) => f.year > currentYear || f.label === "Current");

    return [
      ...MILESTONES,
      ...futures.map((f) => {
        const ixTs = IxTime.createGameTime(f.year, 1, 1);
        const realTs = IxTime.convertFromIxTime(ixTs);
        return {
          label: f.label,
          ixDate: `Jan 1, ${f.year}`,
          realDate: new Date(realTs).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
        };
      }),
    ];
  }, [timeData?.currentGameYear]);

  const runSimulation = useCallback(async () => {
    setIsRunningSimulation(true);
    try {
      setSimulationResults(await IxTimeAccuracyVerifier.runAllTests());
    } catch (error) {
      console.error("Error running simulation:", error);
    } finally {
      setIsRunningSimulation(false);
    }
  }, []);

  const getStatusBadgeVariant = useCallback(
    (status: string): "default" | "secondary" | "destructive" | "outline" => {
      switch (status) {
        case "excellent":
        case "good":
          return "default";
        case "warning":
          return "secondary";
        case "critical":
          return "destructive";
        default:
          return "outline";
      }
    },
    []
  );

  if (!timeData || !accuracyStatus) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="mr-2 h-6 w-6 animate-spin" />
        <span>Loading IxTime visualization...</span>
      </div>
    );
  }

  return (
    <Card className="facet-surface border-border/40">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-1.5 text-blue-500">
              <Clock className="h-4 w-4" />
            </div>
            IxTime Visualization
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="border-border/20 bg-card/20 flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5">
              <Label
                htmlFor="visualizer-advanced-mode"
                className="text-muted-foreground cursor-pointer text-[10px] font-bold tracking-wider uppercase select-none"
              >
                Advanced
              </Label>
              <Switch
                id="visualizer-advanced-mode"
                checked={showAdvanced}
                onCheckedChange={setShowAdvanced}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {autoRefresh ? "Pause" : "Resume"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                updateTimeData();
                updateAccuracyStatus();
                updateSyncStatus();
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* === TOP SECTION: Current Time Overview === */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Current IxTime */}
          <div className="rounded-lg border border-blue-500/10 bg-blue-500/5 p-4 transition-all duration-200 hover:border-blue-500/20">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-blue-400">
              <Clock className="h-3.5 w-3.5" /> Current IxTime
            </div>
            <div className="font-mono text-base leading-tight font-bold break-all text-blue-500">
              {timeData.formattedTime}
            </div>
            <div className="text-muted-foreground mt-1 text-[10px] font-medium">
              Game Year {timeData.currentGameYear}
            </div>
          </div>

          {/* Multiplier + Rate */}
          <div className="rounded-lg border border-green-500/10 bg-green-500/5 p-4 transition-all duration-200 hover:border-green-500/20">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-green-400">
              <Activity className="h-3.5 w-3.5" /> Speed & Rate
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-green-500">{timeData.multiplier}x</span>
              {timeData.isPaused && (
                <Badge variant="destructive" className="px-1.5 py-0 text-[9px]">
                  PAUSED
                </Badge>
              )}
            </div>
            <div className="text-muted-foreground mt-1 text-[10px] font-medium">
              1 real day = {timeData.ixDaysPerRealDay} IxTime days
            </div>
          </div>

          {/* System Health */}
          <div className="rounded-lg border border-purple-500/10 bg-purple-500/5 p-4 transition-all duration-200 hover:border-purple-500/20">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-purple-400">
              <Target className="h-3.5 w-3.5" /> System Health
            </div>
            <div className="flex items-center gap-2">
              {accuracyStatus.status === "excellent" ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : accuracyStatus.status === "critical" ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              )}
              <Badge
                variant={getStatusBadgeVariant(accuracyStatus.status)}
                className="px-1.5 py-0 text-[9px]"
              >
                {accuracyStatus.status.toUpperCase()}
              </Badge>
              <span className="font-mono text-xs font-bold">
                {accuracyStatus.accuracy.toFixed(4)}%
              </span>
            </div>
            <div className="text-muted-foreground mt-1 text-[10px] leading-tight font-medium">
              {accuracyStatus.message}
            </div>
          </div>
        </div>

        {/* Prediction row */}
        <div className="border-border/20 bg-card/20 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border px-4 py-2.5 text-xs font-medium">
          <div className="text-muted-foreground">
            <span className="text-foreground font-semibold">In 24 real hours:</span>{" "}
            <span className="font-mono">{timeData.predictedIxTime24h}</span>
          </div>
          <div className="text-muted-foreground">
            <span className="text-foreground font-semibold">IRL equivalent:</span>{" "}
            <span>{timeData.equivalentRealDate}</span>
          </div>
        </div>

        {showAdvanced && (
          <div className="animate-in fade-in slide-in-from-top-2 space-y-6 pt-1 duration-200">
            <Separator className="border-border/20 my-1" />

            {/* === MIDDLE SECTION: IRL <-> IxTime Converter === */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  IRL / IxTime Date Converter
                </span>
              </div>

              <div className="border-border/20 bg-card/20 rounded-lg border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  {/* Mode toggle */}
                  <div className="shrink-0 space-y-1.5">
                    <Label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                      Direction
                    </Label>
                    <div className="flex gap-1">
                      <Button
                        variant={converterMode === "irl-to-ix" ? "default" : "outline"}
                        size="sm"
                        className="h-8 px-3 text-xs font-semibold"
                        onClick={() => {
                          setConverterMode("irl-to-ix");
                          setConverterResult(null);
                        }}
                      >
                        IRL → IX
                      </Button>
                      <Button
                        variant={converterMode === "ix-to-irl" ? "default" : "outline"}
                        size="sm"
                        className="h-8 px-3 text-xs font-semibold"
                        onClick={() => {
                          setConverterMode("ix-to-irl");
                          setConverterResult(null);
                        }}
                      >
                        IX → IRL
                      </Button>
                    </div>
                  </div>

                  {/* Date input */}
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                      {converterMode === "irl-to-ix" ? "Enter IRL Date" : "Enter IxTime Date"}
                    </Label>
                    <Input
                      type="date"
                      value={converterInput}
                      onChange={(e) => setConverterInput(e.target.value)}
                      placeholder="YYYY-MM-DD"
                      className="bg-card/20 border-border/30 focus:border-primary/50 h-8 text-xs focus:ring-0"
                    />
                  </div>

                  <Button
                    onClick={handleConvert}
                    disabled={!converterInput}
                    size="sm"
                    className="h-8 shrink-0 text-xs font-semibold"
                  >
                    <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                    Convert
                  </Button>
                </div>

                {converterResult && (
                  <div className="animate-in fade-in slide-in-from-top-1 mt-3 rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2 duration-150">
                    <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                      {converterMode === "irl-to-ix" ? "IxTime Date:" : "IRL Date:"}
                    </span>
                    <div className="font-mono text-sm font-semibold text-blue-500">
                      {converterResult}
                    </div>
                  </div>
                )}
              </div>

              {/* Reference Milestone Table */}
              <div className="border-border/20 bg-card/10 overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-border/20 bg-muted/20 border-b">
                      <th className="text-muted-foreground px-3 py-2 text-left text-[10px] font-semibold tracking-wider uppercase">
                        Milestone
                      </th>
                      <th className="text-muted-foreground px-3 py-2 text-left text-[10px] font-semibold tracking-wider uppercase">
                        IxTime Date
                      </th>
                      <th className="text-muted-foreground px-3 py-2 text-left text-[10px] font-semibold tracking-wider uppercase">
                        IRL Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dynamicMilestones.map((m, i) => (
                      <tr
                        key={i}
                        className={`border-border/10 hover:bg-muted/5 border-b transition-colors last:border-b-0 ${m.label === "Current" ? "bg-blue-500/5 font-semibold text-blue-400" : ""}`}
                      >
                        <td className="px-3 py-2">
                          {m.label === "Current" && (
                            <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                          )}
                          {m.label}
                        </td>
                        <td className="px-3 py-2 font-mono">{m.ixDate}</td>
                        <td className="px-3 py-2 font-mono">{m.realDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Separator className="border-border/20 my-1" />

            {/* === VISUAL TIMELINE === */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                <div className="rounded-md border border-blue-500/10 bg-blue-500/5 px-2.5 py-2 text-center transition-all hover:border-blue-500/20">
                  <div className="font-semibold text-blue-400">Real World Epoch</div>
                  <div className="text-muted-foreground mt-0.5 font-mono">Oct 4, 2020</div>
                </div>
                <div className="rounded-md border border-green-500/10 bg-green-500/5 px-2.5 py-2 text-center transition-all hover:border-green-500/20">
                  <div className="font-semibold text-green-400">4x → 2x Transition</div>
                  <div className="text-muted-foreground mt-0.5 font-mono">Jul 27, 2025 IRL</div>
                  <div className="text-muted-foreground font-mono">Jan 1, 2040 IX</div>
                </div>
                <div className="rounded-md border border-purple-500/10 bg-purple-500/5 px-2.5 py-2 text-center transition-all hover:border-purple-500/20">
                  <div className="font-semibold text-purple-400">Now</div>
                  <div className="text-muted-foreground mt-0.5 font-semibold">
                    Year {timeData.currentGameYear}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="border-border/20 relative h-2.5 rounded-full border bg-gradient-to-r from-blue-500/10 via-green-500/10 to-purple-500/10 p-[1px]">
                {/* Pre-pivot progress (blue) - always full since we're past the pivot */}
                <div
                  className="absolute top-[1px] left-[1px] h-[8px] rounded-l-full bg-gradient-to-r from-blue-600 to-blue-500"
                  style={{ width: "calc(50% - 1px)" }}
                />
                {/* Post-pivot progress (green) */}
                {(() => {
                  const pivotReal = new Date("2025-07-27T00:00:00.000Z").getTime();
                  const now = Date.now();
                  if (now >= pivotReal) {
                    // Show relative progress in post-pivot era (50% = now, ~100% = far future)
                    const realElapsed = now - pivotReal;
                    const fiveYearsMs = 5 * 365.25 * 24 * 60 * 60 * 1000;
                    const pct = Math.min(50, (realElapsed / fiveYearsMs) * 50);
                    return (
                      <div
                        className="absolute top-[1px] left-1/2 h-[8px] bg-gradient-to-r from-green-500 to-purple-500"
                        style={{ width: `calc(${pct}% - 1px)`, borderRadius: "0 9999px 9999px 0" }}
                      />
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            <Separator className="border-border/20 my-1" />

            {/* === BOTTOM SECTION: Collapsible Diagnostics === */}
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className="hover:text-foreground group flex w-full items-center justify-between text-left transition-colors"
              >
                <span className="text-muted-foreground group-hover:text-foreground text-xs font-bold tracking-wider uppercase">
                  Diagnostics & Testing
                </span>
                {showDiagnostics ? (
                  <ChevronUp className="text-muted-foreground h-4 w-4" />
                ) : (
                  <ChevronDown className="text-muted-foreground h-4 w-4" />
                )}
              </button>

              {showDiagnostics && (
                <div className="animate-in fade-in slide-in-from-top-2 mt-2 grid grid-cols-1 gap-6 duration-200 md:grid-cols-3">
                  {/* Accuracy Section */}
                  <div className="border-border/20 bg-card/10 flex flex-col justify-between space-y-3 rounded-lg border p-4">
                    <div className="space-y-3">
                      <div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold">
                        <Activity className="h-3.5 w-3.5 text-blue-400" /> Accuracy Verification
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-mono text-xl font-bold">
                            {accuracyStatus.accuracy.toFixed(6)}%
                          </div>
                          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                            Target: ≥99.9998%
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={getStatusBadgeVariant(accuracyStatus.status)}
                            className="px-1.5 py-0 text-[9px]"
                          >
                            {accuracyStatus.status.toUpperCase()}
                          </Badge>
                          <div className="text-muted-foreground mt-1 text-[10px] font-bold">
                            {accuracyStatus.isAccurate ? "PASSING" : "FAILING"}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="pt-2">
                      <Progress
                        value={Math.min(100, accuracyStatus.accuracy)}
                        className="bg-muted/30 h-2"
                      />
                    </div>
                  </div>

                  {/* Sync Status Section */}
                  <div className="border-border/20 bg-card/10 flex flex-col justify-between space-y-3 rounded-lg border p-4">
                    <div className="space-y-3">
                      <div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold">
                        <RefreshCw className="h-3.5 w-3.5 text-green-400" /> Sync Targets
                      </div>
                      {syncStatuses.length === 0 ? (
                        <div className="text-muted-foreground flex flex-col items-center justify-center py-6 text-center text-xs">
                          <Timer className="mb-1.5 h-5 w-5 animate-pulse opacity-40" />
                          <span>No sync targets configured</span>
                        </div>
                      ) : (
                        <div className="max-h-[140px] space-y-2 overflow-y-auto pr-1">
                          {syncStatuses.map((status) => (
                            <div
                              key={status.target}
                              className="border-border/10 bg-muted/5 flex items-center justify-between rounded-md border px-2.5 py-1.5 text-[11px]"
                            >
                              <div className="flex min-w-0 items-center gap-1.5">
                                {status.status === "synced" ? (
                                  <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-500" />
                                ) : status.status === "drift" ? (
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                                )}
                                <span className="truncate font-semibold">{status.target}</span>
                              </div>
                              <div className="ml-2 shrink-0 text-right font-mono text-[10px] font-semibold">
                                <span
                                  className={
                                    status.drift > 50 ? "text-yellow-500" : "text-muted-foreground"
                                  }
                                >
                                  {status.drift > 0 ? "+" : ""}
                                  {status.drift}ms
                                </span>
                                <span className="ml-1.5 text-blue-400">
                                  {status.accuracy.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="pt-2">
                      <Button
                        onClick={() => syncManager.forceSyncAll()}
                        variant="outline"
                        size="sm"
                        className="h-8 w-full text-xs font-semibold"
                      >
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                        Force Sync All
                      </Button>
                    </div>
                  </div>

                  {/* Simulation Section */}
                  <div className="border-border/20 bg-card/10 flex flex-col justify-between space-y-3 rounded-lg border p-4">
                    <div className="space-y-3">
                      <div className="text-muted-foreground flex items-center gap-2 text-xs font-semibold">
                        <Zap className="h-3.5 w-3.5 text-purple-400" /> Test Suite
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={runSimulation}
                          disabled={isRunningSimulation}
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-semibold"
                        >
                          {isRunningSimulation ? (
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Zap className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Accuracy
                        </Button>
                        <Button
                          onClick={() => syncManager.runComprehensiveSync()}
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-semibold"
                        >
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                          Sync Verify
                        </Button>
                      </div>

                      {simulationResults && (
                        <div className="border-border/10 bg-card/30 animate-in fade-in slide-in-from-top-1 rounded-lg border p-2.5 duration-150">
                          <div className="grid grid-cols-4 gap-1 text-center text-[10px] font-semibold">
                            <div>
                              <div className="text-sm font-bold text-green-500">
                                {simulationResults.passedTests}
                              </div>
                              <div className="text-muted-foreground text-[8px] tracking-wider uppercase">
                                Passed
                              </div>
                            </div>
                            <div>
                              <div className="text-sm font-bold text-red-500">
                                {simulationResults.failedTests}
                              </div>
                              <div className="text-muted-foreground text-[8px] tracking-wider uppercase">
                                Failed
                              </div>
                            </div>
                            <div>
                              <div className="font-mono text-sm font-bold">
                                {simulationResults.overallAccuracy.toFixed(1)}%
                              </div>
                              <div className="text-muted-foreground text-[8px] tracking-wider uppercase">
                                Accuracy
                              </div>
                            </div>
                            <div>
                              <div className="font-mono text-sm font-bold">
                                {simulationResults.averageExecutionTime.toFixed(0)}ms
                              </div>
                              <div className="text-muted-foreground text-[8px] tracking-wider uppercase">
                                Avg Time
                              </div>
                            </div>
                          </div>
                          {simulationResults.criticalIssues.length > 0 && (
                            <div className="mt-2 max-h-[60px] overflow-y-auto rounded border border-red-500/10 bg-red-500/5 p-1.5 text-[10px] font-medium text-red-400">
                              {simulationResults.criticalIssues.map((issue, idx) => (
                                <div key={idx} className="flex items-start gap-1">
                                  <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
                                  <span className="truncate">{issue.details}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
