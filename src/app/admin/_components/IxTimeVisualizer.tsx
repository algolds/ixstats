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
import { Eyebrow } from "~/components/ui/eyebrow";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";

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
  { label: "System start", ixDate: "Oct 4, 2020", realDate: "Oct 4, 2020" },
  { label: "In-Game Epoch", ixDate: "Jan 1, 2028", realDate: "Oct 4, 2022" },
  { label: "Speed change", ixDate: "Jan 1, 2040", realDate: "Jul 27, 2025" },
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
    const currentYear = timeData?.currentGameYear;
    const futures =
      currentYear === undefined
        ? []
        : [
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
    (status: string): "secondary" | "default" | "destructive" | "outline" => {
      switch (status) {
        case "excellent":
        case "good":
          return "secondary";
        case "warning":
          return "default";
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
    <Card className="flex flex-col gap-6 py-6">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle className="text-headline flex items-center gap-2">
            <div className="rounded-control border-blue/20 bg-blue/10 text-blue border p-2">
              <Clock className="h-4 w-4" />
            </div>
            IxTime Visualization
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="border-separator bg-surface rounded-control flex shrink-0 items-center gap-2 border px-3 py-2">
              <Label
                htmlFor="visualizer-advanced-mode"
                className="text-label-secondary text-subhead cursor-pointer select-none"
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

              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {autoRefresh ? "Pause" : "Resume"}
            </Button>
            <Button
              variant="outline"
              size="sm"

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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-control border-blue/10 bg-blue/5 hover:border-blue/20 duration-fast border p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform]">
            <div className="text-caption text-blue mb-1 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" /> Current IxTime
            </div>
            <div className="text-headline text-blue leading-tight break-all tabular-nums">
              {timeData.formattedTime}
            </div>
            <div className="text-label-secondary text-caption mt-1">
              Game Year {timeData.currentGameYear}
            </div>
          </div>

          {/* Multiplier + Rate */}
          <div className="rounded-control border-green/10 bg-green/5 hover:border-green/20 duration-fast border p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform]">
            <div className="text-caption text-green mb-1 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" /> Speed & rate
            </div>
            <div className="flex items-center gap-2">
              <span className="text-headline text-green">{timeData.multiplier}x</span>
              {timeData.isPaused && (
                <Badge variant="destructive" className="px-2 py-0">
                  PAUSED
                </Badge>
              )}
            </div>
            <div className="text-label-secondary text-caption mt-1">
              1 real day = {timeData.ixDaysPerRealDay} IxTime days
            </div>
          </div>

          <div className="rounded-control border-purple/10 bg-purple/5 hover:border-purple/20 duration-fast border p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform]">
            <div className="text-caption text-purple mb-1 flex items-center gap-2">
              <Target className="h-3.5 w-3.5" /> System health
            </div>
            <div className="flex items-center gap-2">
              {accuracyStatus.status === "excellent" ? (
                <CheckCircle className="text-green h-4 w-4" />
              ) : accuracyStatus.status === "critical" ? (
                <XCircle className="text-red h-4 w-4" />
              ) : (
                <AlertTriangle className="text-yellow h-4 w-4" />
              )}
              <Badge variant={getStatusBadgeVariant(accuracyStatus.status)} className="px-2 py-0">
                {accuracyStatus.status.toUpperCase()}
              </Badge>
              <span className="text-caption tabular-nums">
                {accuracyStatus.accuracy.toFixed(4)}%
              </span>
            </div>
            <div className="text-label-secondary text-caption mt-1 leading-tight">
              {accuracyStatus.message}
            </div>
          </div>
        </div>

        <div className="border-separator bg-surface rounded-control text-caption flex flex-wrap items-center gap-x-6 gap-y-2 border px-4 py-2">
          <div className="text-label-secondary">
            <span className="text-label font-semibold">In 24 real hours:</span>{" "}
            <span className="tabular-nums">{timeData.predictedIxTime24h}</span>
          </div>
          <div className="text-label-secondary">
            <span className="text-label font-semibold">IRL equivalent:</span>{" "}
            <span>{timeData.equivalentRealDate}</span>
          </div>
        </div>

        {showAdvanced && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-fast space-y-6 pt-1">
            <Separator className="border-separator my-1" />

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="text-blue h-4 w-4" />
                <span className="text-label-secondary text-eyebrow">
                  IRL / IxTime Date Converter
                </span>
              </div>

              <div className="border-separator bg-surface rounded-control border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="shrink-0 space-y-2">
                    <Label className="text-label-secondary text-subhead">Direction</Label>
                    <div className="flex gap-1">
                      <Button
                        variant={converterMode === "irl-to-ix" ? "default" : "outline"}
                        size="sm"

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

                        onClick={() => {
                          setConverterMode("ix-to-irl");
                          setConverterResult(null);
                        }}
                      >
                        IX → IRL
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2">
                    <Label className="text-label-secondary text-subhead">
                      {converterMode === "irl-to-ix" ? "Enter IRL Date" : "Enter IxTime Date"}
                    </Label>
                    <Input
                      type="date"
                      value={converterInput}
                      onChange={(e) => setConverterInput(e.target.value)}
                      placeholder="YYYY-MM-DD"
                      className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                    />
                  </div>

                  <Button
                    onClick={handleConvert}
                    disabled={!converterInput}
                    size="sm"
                    className="shrink-0"
                  >
                    <ArrowRightLeft className="mr-2 h-3.5 w-3.5" />
                    Convert
                  </Button>
                </div>

                {converterResult && (
                  <div className="animate-in fade-in slide-in-from-top-1 rounded-control-sm border-blue/20 bg-blue/5 mt-3 border px-3 py-2 duration-150">
                    <span className="text-label-secondary text-eyebrow">
                      {converterMode === "irl-to-ix" ? "IxTime Date:" : "IRL Date:"}
                    </span>
                    <div className="text-headline text-blue tabular-nums">{converterResult}</div>
                  </div>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-3">Milestone</TableHead>
                    <TableHead className="px-3">IxTime Date</TableHead>
                    <TableHead className="px-3">IRL Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dynamicMilestones.map((m, i) => (
                    <TableRow
                      key={i}
                      className={`border-separator hover:bg-fill-4 border-b transition-colors last:border-b-0 ${m.label === "Current" ? "bg-blue/5 text-blue font-semibold" : ""}`}
                    >
                      <TableCell className="px-3">
                        {m.label === "Current" && (
                          <span className="bg-blue mr-2 inline-block h-1.5 w-1.5 rounded-full" />
                        )}
                        {m.label}
                      </TableCell>
                      <TableCell className="px-3">{m.ixDate}</TableCell>
                      <TableCell className="px-3">{m.realDate}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Separator className="border-separator my-1" />

            <div className="space-y-3">
              <div className="text-footnote grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-control-sm border-blue/10 bg-blue/5 hover:border-blue/20 border px-3 py-2 text-center transition-[color,background-color,border-color,box-shadow,opacity,transform]">
                  <div className="text-blue font-semibold">Real world epoch</div>
                  <div className="text-label-secondary mt-0.5 tabular-nums">Oct 4, 2020</div>
                </div>
                <div className="rounded-control-sm border-green/10 bg-green/5 hover:border-green/20 border px-3 py-2 text-center transition-[color,background-color,border-color,box-shadow,opacity,transform]">
                  <div className="text-green font-semibold">4x → 2x Transition</div>
                  <div className="text-label-secondary mt-0.5 tabular-nums">Jul 27, 2025 IRL</div>
                  <div className="text-label-secondary tabular-nums">Jan 1, 2040 IX</div>
                </div>
                <div className="rounded-control-sm border-purple/10 bg-purple/5 hover:border-purple/20 border px-3 py-2 text-center transition-[color,background-color,border-color,box-shadow,opacity,transform]">
                  <div className="text-purple font-semibold">Now</div>
                  <div className="text-label-secondary mt-0.5 font-semibold">
                    Year {timeData.currentGameYear}
                  </div>
                </div>
              </div>

              <div className="border-separator bg-blue/10 relative h-2.5 rounded-full border p-[1px]">
                {/* Pre-pivot progress (blue) - always full since we're past the pivot */}
                <div
                  className="bg-blue absolute top-[1px] left-[1px] h-[8px] rounded-l-full"
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
                        className="bg-green absolute top-[1px] left-1/2 h-[8px]"
                        style={{ width: `calc(${pct}% - 1px)`, borderRadius: "0 9999px 9999px 0" }}
                      />
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            <Separator className="border-separator my-1" />

            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                aria-expanded={showDiagnostics}
                className="text-label-secondary hover:text-label w-full justify-between px-2 text-left"
              >
                <span className="text-eyebrow">Diagnostics & testing</span>
                {showDiagnostics ? (
                  <ChevronUp aria-hidden className="h-4 w-4" />
                ) : (
                  <ChevronDown aria-hidden className="h-4 w-4" />
                )}
              </Button>

              {showDiagnostics && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-fast mt-2 grid grid-cols-1 gap-6 md:grid-cols-3">
                  <div className="border-separator bg-surface rounded-control flex flex-col justify-between space-y-3 border p-4">
                    <div className="space-y-3">
                      <div className="text-label-secondary text-caption flex items-center gap-2">
                        <Activity className="text-blue h-3.5 w-3.5" /> Accuracy verification
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-title-2 tabular-nums">
                            {accuracyStatus.accuracy.toFixed(6)}%
                          </div>
                          <div className="text-label-secondary text-eyebrow">Target: ≥99.9998%</div>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant={getStatusBadgeVariant(accuracyStatus.status)}
                            className="px-2 py-0"
                          >
                            {accuracyStatus.status.toUpperCase()}
                          </Badge>
                          <div className="text-label-secondary text-caption mt-1">
                            {accuracyStatus.isAccurate ? "PASSING" : "FAILING"}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="pt-2">
                      <Progress
                        value={Math.min(100, accuracyStatus.accuracy)}
                        className="bg-fill-4 h-2"
                      />
                    </div>
                  </div>

                  <div className="border-separator bg-surface rounded-control flex flex-col justify-between space-y-3 border p-4">
                    <div className="space-y-3">
                      <div className="text-label-secondary text-caption flex items-center gap-2">
                        <RefreshCw className="text-green h-3.5 w-3.5" /> Sync targets
                      </div>
                      {syncStatuses.length === 0 ? (
                        <div className="text-label-secondary text-footnote flex flex-col items-center justify-center py-6 text-center">
                          <Timer className="mb-2 h-5 w-5 opacity-40" />
                          <span>No sync targets configured</span>
                        </div>
                      ) : (
                        <div className="max-h-[140px] space-y-2 overflow-y-auto pr-1">
                          {syncStatuses.map((status) => (
                            <div
                              key={status.target}
                              className="border-separator bg-fill-4 rounded-control-sm text-footnote flex items-center justify-between border px-3 py-2"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                {status.status === "synced" ? (
                                  <CheckCircle className="text-green h-3.5 w-3.5 shrink-0" />
                                ) : status.status === "drift" ? (
                                  <AlertTriangle className="text-yellow h-3.5 w-3.5 shrink-0" />
                                ) : (
                                  <XCircle className="text-red h-3.5 w-3.5 shrink-0" />
                                )}
                                <span className="truncate font-semibold">{status.target}</span>
                              </div>
                              <div className="text-caption ml-2 shrink-0 text-right font-mono">
                                <span
                                  className={
                                    status.drift > 50 ? "text-yellow" : "text-label-secondary"
                                  }
                                >
                                  {status.drift > 0 ? "+" : ""}
                                  {status.drift}ms
                                </span>
                                <span className="text-blue ml-2">
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
                        className="w-full"
                      >
                        <RefreshCw className="mr-2 h-3.5 w-3.5" />
                        Force sync all
                      </Button>
                    </div>
                  </div>

                  <div className="border-separator bg-surface rounded-control flex flex-col justify-between space-y-3 border p-4">
                    <div className="space-y-3">
                      <div className="text-label-secondary text-caption flex items-center gap-2">
                        <Zap className="text-purple h-3.5 w-3.5" /> Test suite
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={runSimulation}
                          disabled={isRunningSimulation}
                          variant="outline"
                          size="sm"
                        >
                          {isRunningSimulation ? (
                            <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Zap className="mr-2 h-3.5 w-3.5" />
                          )}
                          Accuracy
                        </Button>
                        <Button
                          onClick={() => syncManager.runComprehensiveSync()}
                          variant="outline"
                          size="sm"
                        >
                          <RefreshCw className="mr-2 h-3.5 w-3.5" />
                          Sync verify
                        </Button>
                      </div>

                      {simulationResults && (
                        <div className="border-separator bg-surface animate-in fade-in slide-in-from-top-1 rounded-control border p-3 duration-150">
                          <div className="text-caption grid grid-cols-4 gap-1 text-center">
                            <div>
                              <div className="text-headline text-green">
                                {simulationResults.passedTests}
                              </div>
                              <Eyebrow className="block">Passed</Eyebrow>
                            </div>
                            <div>
                              <div className="text-headline text-red">
                                {simulationResults.failedTests}
                              </div>
                              <Eyebrow className="block">Failed</Eyebrow>
                            </div>
                            <div>
                              <div className="text-headline tabular-nums">
                                {simulationResults.overallAccuracy.toFixed(1)}%
                              </div>
                              <Eyebrow className="block">Accuracy</Eyebrow>
                            </div>
                            <div>
                              <div className="text-headline tabular-nums">
                                {simulationResults.averageExecutionTime.toFixed(0)}ms
                              </div>
                              <Eyebrow className="block">Avg time</Eyebrow>
                            </div>
                          </div>
                          {simulationResults.criticalIssues.length > 0 && (
                            <div className="rounded-control-sm border-red/10 bg-red/5 text-caption text-red mt-2 max-h-[60px] overflow-y-auto border p-2">
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
