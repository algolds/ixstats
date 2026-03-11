/**
 * IxTime Visualizer - Unified time visualization with IRL comparison tools
 */

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Play,
  Pause,
  Zap,
  Target,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Timer,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Progress } from "~/components/ui/progress";
import { Separator } from "~/components/ui/separator";
import { IxTime } from "~/lib/ixtime";
import { IxTimeAccuracyVerifier, type TimeSimulationResult } from "~/lib/ixtime-accuracy";
import { IxTimeSyncManager, type MasterTimeState, type SyncStatus } from "~/lib/ixtime-sync";

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
    return () => { syncManager.stop(); };
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
    <Card className="glass-card-parent border-blue-500/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            IxTime Visualization
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAutoRefresh(!autoRefresh)}>
              {autoRefresh ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {autoRefresh ? "Pause" : "Resume"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { updateTimeData(); updateAccuracyStatus(); updateSyncStatus(); }}
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
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-blue-400">
              <Clock className="h-3.5 w-3.5" /> Current IxTime
            </div>
            <div className="font-mono text-lg font-bold text-blue-500">
              {timeData.formattedTime}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Game Year {timeData.currentGameYear}
            </div>
          </div>

          {/* Multiplier + Rate */}
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-green-400">
              <Activity className="h-3.5 w-3.5" /> Speed & Rate
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-green-500">{timeData.multiplier}x</span>
              {timeData.isPaused && <Badge variant="destructive" className="text-[10px]">PAUSED</Badge>}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              1 real day = {timeData.ixDaysPerRealDay} IxTime days
            </div>
          </div>

          {/* System Health */}
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-purple-400">
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
              <Badge variant={getStatusBadgeVariant(accuracyStatus.status)} className="text-[10px]">
                {accuracyStatus.status.toUpperCase()}
              </Badge>
              <span className="font-mono text-sm">{accuracyStatus.accuracy.toFixed(4)}%</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{accuracyStatus.message}</div>
          </div>
        </div>

        {/* Prediction row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border/50 bg-card/50 px-4 py-2.5 text-sm">
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">In 24 real hours:</span>{" "}
            {timeData.predictedIxTime24h}
          </div>
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">IRL equivalent:</span>{" "}
            {timeData.equivalentRealDate}
          </div>
        </div>

        <Separator />

        {/* === MIDDLE SECTION: IRL <-> IxTime Converter === */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">IRL / IxTime Date Converter</span>
          </div>

          <div className="rounded-lg border border-border/50 bg-card/50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              {/* Mode toggle */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Direction</Label>
                <div className="flex gap-1">
                  <Button
                    variant={converterMode === "irl-to-ix" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setConverterMode("irl-to-ix"); setConverterResult(null); }}
                  >
                    IRL → IX
                  </Button>
                  <Button
                    variant={converterMode === "ix-to-irl" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setConverterMode("ix-to-irl"); setConverterResult(null); }}
                  >
                    IX → IRL
                  </Button>
                </div>
              </div>

              {/* Date input */}
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {converterMode === "irl-to-ix" ? "Enter IRL Date" : "Enter IxTime Date"}
                </Label>
                <Input
                  type="date"
                  value={converterInput}
                  onChange={(e) => setConverterInput(e.target.value)}
                  placeholder="YYYY-MM-DD"
                />
              </div>

              <Button onClick={handleConvert} disabled={!converterInput}>
                <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                Convert
              </Button>
            </div>

            {converterResult && (
              <div className="mt-3 rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  {converterMode === "irl-to-ix" ? "IxTime Date:" : "IRL Date:"}
                </span>
                <div className="font-mono text-sm font-medium text-blue-500">{converterResult}</div>
              </div>
            )}
          </div>

          {/* Reference Milestone Table */}
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium">Milestone</th>
                  <th className="px-3 py-2 text-left font-medium">IxTime Date</th>
                  <th className="px-3 py-2 text-left font-medium">IRL Date</th>
                </tr>
              </thead>
              <tbody>
                {dynamicMilestones.map((m, i) => (
                  <tr
                    key={i}
                    className={`border-b border-border/30 ${m.label === "Current" ? "bg-blue-500/5 font-medium" : ""}`}
                  >
                    <td className="px-3 py-1.5">
                      {m.label === "Current" && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />}
                      {m.label}
                    </td>
                    <td className="px-3 py-1.5 font-mono">{m.ixDate}</td>
                    <td className="px-3 py-1.5 font-mono">{m.realDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* === VISUAL TIMELINE === */}
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-2.5 py-2 text-center">
              <div className="font-medium text-blue-500">Real World Epoch</div>
              <div className="text-muted-foreground">Oct 4, 2020</div>
            </div>
            <div className="rounded-md border border-green-500/20 bg-green-500/5 px-2.5 py-2 text-center">
              <div className="font-medium text-green-500">4x → 2x Transition</div>
              <div className="text-muted-foreground">Jul 27, 2025 IRL</div>
              <div className="text-muted-foreground">Jan 1, 2040 IX</div>
            </div>
            <div className="rounded-md border border-purple-500/20 bg-purple-500/5 px-2.5 py-2 text-center">
              <div className="font-medium text-purple-500">Now</div>
              <div className="text-muted-foreground">Year {timeData.currentGameYear}</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 rounded-full bg-gradient-to-r from-blue-200 via-green-200 to-purple-200">
            {/* Pre-pivot progress (blue) - always full since we're past the pivot */}
            <div className="absolute top-0 left-0 h-2 rounded-l-full bg-blue-500" style={{ width: "50%" }} />
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
                    className="absolute top-0 left-1/2 h-2 bg-green-500"
                    style={{ width: `${pct}%`, borderRadius: "0 4px 4px 0" }}
                  />
                );
              }
              return null;
            })()}
          </div>
        </div>

        <Separator />

        {/* === BOTTOM SECTION: Collapsible Diagnostics === */}
        <div>
          <button
            type="button"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-sm font-medium">Diagnostics & Testing</span>
            {showDiagnostics ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {showDiagnostics && (
            <div className="mt-4 space-y-6">
              {/* Accuracy Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Activity className="h-3.5 w-3.5" /> Accuracy Verification
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xl font-bold">{accuracyStatus.accuracy.toFixed(6)}%</div>
                    <div className="text-xs text-muted-foreground">Target: ≥99.9998%</div>
                  </div>
                  <div className="text-right">
                    <Badge variant={getStatusBadgeVariant(accuracyStatus.status)}>
                      {accuracyStatus.status.toUpperCase()}
                    </Badge>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {accuracyStatus.isAccurate ? "PASSING" : "FAILING"}
                    </div>
                  </div>
                </div>
                <Progress value={Math.min(100, accuracyStatus.accuracy)} className="h-2" />
              </div>

              <Separator />

              {/* Sync Status Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5" /> Sync Targets
                </div>
                {syncStatuses.length === 0 ? (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    <Timer className="mx-auto mb-1 h-5 w-5 opacity-50" />
                    No sync targets configured
                  </div>
                ) : (
                  <div className="space-y-2">
                    {syncStatuses.map((status) => (
                      <div
                        key={status.target}
                        className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          {status.status === "synced" ? (
                            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          ) : status.status === "drift" ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                          )}
                          <span className="font-medium">{status.target}</span>
                        </div>
                        <div className="text-right font-mono">
                          <span>{status.drift > 0 ? "+" : ""}{status.drift}ms</span>
                          <span className="ml-2 text-muted-foreground">{status.accuracy.toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  onClick={() => syncManager.forceSyncAll()}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Force Sync All
                </Button>
              </div>

              <Separator />

              {/* Simulation Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Zap className="h-3.5 w-3.5" /> Test Suite
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={runSimulation} disabled={isRunningSimulation} variant="outline" size="sm">
                    {isRunningSimulation ? (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Zap className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Accuracy Tests
                  </Button>
                  <Button onClick={() => syncManager.runComprehensiveSync()} variant="outline" size="sm">
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Sync Verification
                  </Button>
                </div>

                {simulationResults && (
                  <div className="rounded-lg border border-border/50 bg-card/50 p-3">
                    <div className="grid grid-cols-4 gap-3 text-center text-xs">
                      <div>
                        <div className="text-lg font-bold text-green-500">{simulationResults.passedTests}</div>
                        <div className="text-muted-foreground">Passed</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-red-500">{simulationResults.failedTests}</div>
                        <div className="text-muted-foreground">Failed</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold">{simulationResults.overallAccuracy.toFixed(1)}%</div>
                        <div className="text-muted-foreground">Accuracy</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold">{simulationResults.averageExecutionTime.toFixed(0)}ms</div>
                        <div className="text-muted-foreground">Avg Time</div>
                      </div>
                    </div>
                    {simulationResults.criticalIssues.length > 0 && (
                      <div className="mt-2 rounded-md border border-red-500/20 bg-red-500/5 p-2 text-xs text-red-500">
                        {simulationResults.criticalIssues.map((issue, idx) => (
                          <div key={idx} className="flex items-start gap-1.5">
                            <XCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                            {issue.details}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
