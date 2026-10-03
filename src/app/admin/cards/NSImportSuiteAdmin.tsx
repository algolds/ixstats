"use client";
// src/app/admin/cards/NSImportSuiteAdmin.tsx
// Dedicated NationStates Import Suite Admin Module

import { useState, useMemo } from "react";
import {
  Refresh as RefreshCw,
  Database,
  Globe,
  MapPin,
  Search,
  Group as Users,
  Play,
  Pause,
  Square,
  WarningTriangle as AlertTriangle,
  Filter,
  Xmark as X,
  Component as Layers,
  Clock,
  ArrowRight,
  Sparks as Sparkles,
  Page as FileText,
} from "iconoir-react";

import { api } from "~/trpc/react";
import { LogViewerFilterable, type LogEntry, type LogLevel } from "~/components/admin/log-viewer";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useNotify } from "~/hooks/useNotify";
import { useVisibleRefetch } from "~/hooks/useVisibleRefetch";
import { SegmentedControl } from "~/components/ui/segmented-control";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { RarityBadge } from "~/components/cards/display/RarityBadge";
import type { CardRarity } from "@prisma/client";
import { formatDurationMs as formatDuration } from "~/lib/admin/admin-formatters";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Card } from "~/components/ui/card";

/** Badge variant for a sync job status (colour paired with the status text). */
function statusBadgeVariant(status: string) {
  switch (status.toUpperCase()) {
    case "COMPLETED":
    case "SUCCESS":
      return "success" as const;
    case "IN_PROGRESS":
    case "RUNNING":
      return "info" as const;
    case "PAUSED":
    case "WARNING":
      return "warning" as const;
    case "FAILED":
    case "ERROR":
      return "destructive" as const;
    default:
      return "default" as const;
  }
}

export function NSImportSuiteAdmin() {
  const notify = useNotify();
  const [refreshInterval, _setRefreshInterval] = useState<number | null>(10000);
  const [regionNames, setRegionNames] = useState("greater_ixnay");
  const [syncTypeFilter, setSyncTypeFilter] = useState<"all" | "region">("all");
  const [discoveredRegions, setDiscoveredRegions] = useState<
    { id: string; name: string; numnations: number }[] | null
  >(null);
  const [discoveryTag, setDiscoveryTag] = useState("gargantuan");

  // Per-import filter state
  const [selectedSyncLogId, setSelectedSyncLogId] = useState<string | null>(null);
  const [cardSearchQuery, setCardSearchQuery] = useState("");
  const [activeLogTab, setActiveLogTab] = useState<"logs" | "cards">("logs");
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Modal confirmation states
  const [confirmFetchRegions, setConfirmFetchRegions] = useState<string | null>(null);
  const [fetchSeasons, setFetchSeasons] = useState("1-13");
  const [confirmStopJobId, setConfirmStopJobId] = useState<string | null>(null);

  const {
    data: _healthStats,
    isLoading: _loadingHealth,
    refetch: refetchHealth,
  } = api.nsImport.getSyncHealth.useQuery(undefined, {
    refetchInterval: refreshInterval ?? false,
  });

  const { data: rawLogsData, refetch: refetchLogs } = api.nsImport.getSyncLogs.useQuery(
    {
      limit: 50,
      syncTypeFilter: syncTypeFilter === "all" ? "all" : "region",
    },
    {
      refetchInterval: refreshInterval ?? false,
    }
  );

  const { data: syncLogCardsData, isLoading: loadingSyncCards } =
    api.nsImport.getSyncLogCards.useQuery(
      {
        syncLogId: selectedSyncLogId!,
        search: cardSearchQuery,
        limit: 50,
      },
      {
        enabled: Boolean(selectedSyncLogId),
        refetchInterval: refreshInterval ?? false,
      }
    );

  const { data: activeJobs, refetch: refetchActiveJobs } = api.nsImport.getActiveJobs.useQuery(
    undefined,
    {
      refetchInterval: refreshInterval ?? false,
    }
  );

  useVisibleRefetch(refreshInterval ?? 10000);

  const selectedSyncLog = useMemo(
    () => rawLogsData?.find((l) => l.id === selectedSyncLogId) ?? null,
    [rawLogsData, selectedSyncLogId]
  );

  const parsedErrors = useMemo(() => {
    if (!selectedSyncLog?.errorMessage) return null;
    const raw = selectedSyncLog.errorMessage;
    const items = raw
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    const isRateLimit = items.some((item) => item.toUpperCase().includes("RATE_LIMIT"));
    const nations = items.map((item) => {
      const match = item.match(/Nation\s+([^:]+):\s*(.*)/i);
      return match
        ? { nation: match[1].trim(), reason: match[2].trim() }
        : { nation: item, reason: "" };
    });

    return {
      raw,
      items,
      isRateLimit,
      nations,
      count: items.length,
    };
  }, [selectedSyncLog?.errorMessage]);

  const filteredLogs = useMemo(() => {
    if (!rawLogsData) return [];
    if (selectedSyncLogId) {
      return rawLogsData.filter((l) => l.id === selectedSyncLogId);
    }
    return rawLogsData;
  }, [rawLogsData, selectedSyncLogId]);

  const fetchRegionMutation = api.nsImport.fetchRegionCards.useMutation({
    onSuccess: (data: {
      message: string;
      results: { regionName: string; syncLogId: string }[];
    }) => {
      notify.success("Fetch Started", data.message);
      setConfirmFetchRegions(null);
      void refetchActiveJobs();
      void refetchLogs();
    },
    onError: (err: { message: string }) => notify.error("Fetch Error", err.message),
  });

  const discoverRegionsMutation = api.nsImport.discoverTopRegions.useMutation({
    onSuccess: (data: {
      regions: { id: string; name: string; numnations: number }[];
      totalScanned: number;
    }) => {
      setDiscoveredRegions(data.regions);
      notify.success(
        "Discovery Complete",
        `Found ${data.regions.length} regions with tag "${discoveryTag}"`
      );
    },
    onError: (err: { message: string }) => notify.error("Discovery Error", err.message),
  });

  const pauseJobMutation = api.nsImport.pauseRegionFetch.useMutation({
    onSuccess: () => {
      notify.success("Job Paused");
      void refetchActiveJobs();
      void refetchLogs();
    },
    onError: (err: { message: string }) => notify.error("Pause Failed", err.message),
  });

  const resumeJobMutation = api.nsImport.resumeRegionFetch.useMutation({
    onSuccess: () => {
      notify.success("Job Resumed");
      void refetchActiveJobs();
      void refetchLogs();
    },
    onError: (err: { message: string }) => notify.error("Resume Failed", err.message),
  });

  const stopJobMutation = api.nsImport.stopRegionFetch.useMutation({
    onSuccess: () => {
      notify.success("Job Stopped");
      setConfirmStopJobId(null);
      void refetchActiveJobs();
      void refetchLogs();
    },
    onError: (err: { message: string }) => notify.error("Stop Failed", err.message),
  });

  const filterCTENationsMutation = api.nsImport.filterCTECards.useMutation({
    onSuccess: (data: {
      totalProcessed: number;
      cteCount: number;
      activeCount: number;
      message: string;
    }) => {
      notify.success("CTE Filter Complete", data.message);
      void refetchHealth();
    },
    onError: (err: { message: string }) => notify.error("CTE Filter Failed", err.message),
  });

  const parseSeasonsInput = (str: string): number[] => {
    const parts = str.split(",");
    const result: number[] = [];
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.includes("-")) {
        const [start, end] = trimmed.split("-").map(Number);
        if (start && end && start <= end) {
          for (let i = start; i <= end; i++) result.push(i);
        }
      } else {
        const num = Number(trimmed);
        if (num) result.push(num);
      }
    }
    return result.length > 0 ? result : [1, 2, 3];
  };

  const syncLogEntries: LogEntry[] = useMemo(() => {
    return filteredLogs.map((log) => {
      let level: LogLevel = "info";
      if (log.status === "FAILED") level = "error";
      else if (log.status === "PAUSED") level = "warn";

      return {
        timestamp: log.completedAt
          ? new Date(log.completedAt).toISOString()
          : new Date(log.startedAt).toISOString(),
        message: `[${log.syncType}]: ${log.status} | Processed: ${log.cardsProcessed ?? 0} (Created: +${log.cardsCreated ?? 0}, Updated: +${log.cardsUpdated ?? 0}) ${log.errorMessage ? `| Error: ${log.errorMessage}` : ""}`,
        level,
      };
    });
  }, [filteredLogs]);

  const handleRefreshAll = () => {
    void refetchHealth();
    void refetchLogs();
    void refetchActiveJobs();
  };

  return (
    <div className="space-y-6">
      {activeJobs && activeJobs.length > 0 && (
        <Card className="border-blue/30 bg-blue/5 space-y-4 p-6">
          <h2 className="text-label text-title-3 flex items-center gap-2">
            <RefreshCw className="text-blue h-5 w-5 animate-spin" />
            Active / Paused Sync Jobs ({activeJobs.length})
          </h2>
          <div className="space-y-3">
            {activeJobs.map((job: any) => {
              const pct =
                job.totalCards > 0
                  ? Math.min(100, Math.round((job.cardsProcessed / job.totalCards) * 100))
                  : 0;
              return (
                <Card
                  key={job.id}
                  className="rounded-row flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-label text-caption">
                        {job.syncType.replace("NS_REGION_", "Region: ").replace(/_/g, " ")}
                      </span>
                      <Badge variant={statusBadgeVariant(job.status)}>{job.status}</Badge>
                    </div>
                    <div className="bg-fill-3 h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-blue duration-fast h-full transition-[color,background-color,border-color,box-shadow,opacity,transform]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-label-secondary text-footnote flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        Cards: {job.cardsProcessed}/{job.totalCards} ({pct}%)
                      </span>
                      <span>Created: +{job.cardsCreated}</span>
                      <span>Updated: +{job.cardsUpdated}</span>
                      <span>Errors: {job.errorCount}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {job.status === "IN_PROGRESS" && (
                      <Button
                        variant="secondary"
                        onClick={() => pauseJobMutation.mutate({ syncLogId: job.id })}
                        disabled={pauseJobMutation.isPending}
                        size="sm"
                      >
                        <Pause className="mr-1 h-3.5 w-3.5" /> Pause
                      </Button>
                    )}
                    {job.status === "PAUSED" && (
                      <Button
                        variant="secondary"
                        onClick={() => resumeJobMutation.mutate({ syncLogId: job.id })}
                        disabled={resumeJobMutation.isPending}
                        size="sm"
                      >
                        <Play className="mr-1 h-3.5 w-3.5" /> Resume
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      onClick={() => setConfirmStopJobId(job.id)}
                      size="sm"
                    >
                      <Square className="mr-1 h-3.5 w-3.5" /> Stop
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Region Fetch Card */}
        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <div className="rounded-row border-green/30 bg-green/20 border p-2">
              <MapPin className="text-green h-5 w-5" />
            </div>
            <div>
              <h3 className="text-label text-title-3">Region card fetch</h3>
              <p className="text-label-secondary text-caption">
                Fetch trading cards from all nations in specified NS regions
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <Textarea
              value={regionNames}
              onChange={(e) => setRegionNames(e.target.value)}
              placeholder="Region name(s) (e.g. greater_ixnay, the_pacific)"
              className="h-24 w-full"
            />
            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={() => setConfirmFetchRegions(regionNames)}
                disabled={!regionNames.trim() || fetchRegionMutation.isPending}
              >
                {fetchRegionMutation.isPending ? (
                  <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Globe className="mr-2 h-3.5 w-3.5" />
                )}
                Fetch Region(s)
              </Button>
            </div>
          </div>
        </Card>

        {/* Discover Top Regions Card */}
        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <div className="rounded-row border-purple/30 bg-purple/20 border p-2">
              <Search className="text-purple h-5 w-5" />
            </div>
            <div>
              <h3 className="text-label text-title-3">Discover NS Regions</h3>
              <p className="text-label-secondary text-caption">
                Find high-card-density regions by activity tag
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={discoveryTag} onValueChange={(v) => setDiscoveryTag(v)}>
              <SelectTrigger size="sm" className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gargantuan">Largest regions</SelectItem>
                <SelectItem value="Role Player">Roleplay communities</SelectItem>
                <SelectItem value="Democratic">Democratic / Legislative</SelectItem>
                <SelectItem value="Totalitarian">Totalitarian / Dictatorships</SelectItem>
                <SelectItem value="Communist">Communist / Leftist</SelectItem>
                <SelectItem value="Capitalist">Capitalist / Trade</SelectItem>
                <SelectItem value="Monarchist">Monarchy / Feudalist</SelectItem>
                <SelectItem value="Anarchist">Anarchist / Lawless</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="secondary"
              onClick={() => discoverRegionsMutation.mutate({ limit: 15, tag: discoveryTag })}
              disabled={discoverRegionsMutation.isPending}
            >
              {discoverRegionsMutation.isPending ? (
                <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="mr-2 h-3.5 w-3.5" />
              )}
              Scan Regions
            </Button>
          </div>

          {discoveredRegions && (
            <Card className="rounded-row overflow-hidden">
              <div className="border-separator text-label-secondary text-eyebrow flex items-center justify-between border-b px-4 py-2">
                <span>Top {discoveredRegions.length} Regions</span>
                <span>
                  {discoveredRegions.reduce((sum, r) => sum + r.numnations, 0).toLocaleString()}{" "}
                  nations
                </span>
              </div>
              <div className="divide-separator max-h-56 divide-y overflow-y-auto">
                {discoveredRegions.map((region, i) => (
                  <div
                    key={region.id}
                    className="hover:bg-fill-4 flex items-center justify-between px-4 py-2 transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="text-label-secondary text-footnote w-5 text-right tabular-nums">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-label text-caption truncate">{region.name}</p>
                        <p className="text-label-secondary text-footnote flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {region.numnations.toLocaleString()} nations
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setConfirmFetchRegions(region.id)}
                      disabled={fetchRegionMutation.isPending}
                    >
                      <Globe className="mr-1 h-3 w-3" /> Fetch
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </Card>
      </div>

      <Card className="border-yellow/20 bg-yellow/5 space-y-4 p-6">
        <div className="flex items-center gap-2">
          <div className="rounded-row border-yellow/30 bg-yellow/20 border p-2">
            <RefreshCw className="text-yellow h-5 w-5" />
          </div>
          <div>
            <h3 className="text-label text-title-3">Filter Active vs. CTE (Defunct) Nations</h3>
            <p className="text-label-secondary text-caption">
              Tag imported cards against the official NationStates active nations dump (
              <code className="text-yellow tabular-nums">nations.xml.gz</code>)
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={() => filterCTENationsMutation.mutate()}
          disabled={filterCTENationsMutation.isPending}
        >
          {filterCTENationsMutation.isPending ? (
            <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
          )}
          {filterCTENationsMutation.isPending ? "Filtering..." : "Run CTE Filter"}
        </Button>
      </Card>

      <Card className="space-y-6 p-6">
        {/* Header toolbar */}
        <div className="border-separator flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-label text-title-3">Sync operations & import runs</h2>
              {selectedSyncLog && (
                <Badge variant="info">
                  <Filter className="h-3 w-3" /> Filtered view
                </Badge>
              )}
            </div>
            <p className="text-label-secondary text-footnote">
              Audit log stream & card inspection per individual import job
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Import run selector dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-label-secondary text-caption flex items-center gap-1">
                <Layers className="text-tint h-3 w-3" /> Import:
              </label>
              <Select
                value={selectedSyncLogId || "ALL"}
                onValueChange={(v) => {
                  const val = v === "ALL" ? null : v;
                  setSelectedSyncLogId(val);
                  if (val) setActiveLogTab("cards");
                  else setActiveLogTab("logs");
                }}
              >
                <SelectTrigger size="sm" className="max-w-[240px] truncate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Imports ({rawLogsData?.length ?? 0} runs)</SelectItem>
                  {(rawLogsData ?? []).map((log) => {
                    const label = log.syncType.replace("NS_REGION_", "Region: ").replace(/_/g, " ");
                    const dateStr = new Date(log.startedAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return (
                      <SelectItem key={log.id} value={log.id}>
                        [{log.status}] {label}: {dateStr} (+{log.cardsCreated})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Sync type filter */}
            <Select
              value={syncTypeFilter}
              onValueChange={(v) => setSyncTypeFilter(v as "all" | "region")}
            >
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="region">Region only</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={handleRefreshAll}>
              <RefreshCw className="mr-2 h-3 w-3" /> Refresh
            </Button>
          </div>
        </div>

        {/* Selected Import Run Drill-Down Header Banner */}
        {selectedSyncLog ? (
          <Card className="rounded-row border-blue/30 bg-blue/5 space-y-3 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-label text-headline flex items-center gap-2">
                  <Database className="text-blue h-4 w-4" />
                  {selectedSyncLog.syncType.replace("NS_REGION_", "Region: ").replace(/_/g, " ")}
                </span>
                <Badge variant={statusBadgeVariant(selectedSyncLog.status)}>
                  {selectedSyncLog.status}
                </Badge>
                <span className="text-label-secondary text-footnote font-mono">
                  ID: {selectedSyncLog.id}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Mode switcher: logs vs cards */}
                <SegmentedControl
                  size="sm"
                  asTabs
                  aria-label="Sync log view"
                  value={activeLogTab}
                  onValueChange={setActiveLogTab}
                  options={[
                    { value: "logs", label: "Audit log", icon: <FileText /> },
                    {
                      value: "cards",
                      icon: <Sparkles />,
                      label: `Imported Cards (${syncLogCardsData?.total ?? selectedSyncLog.cardsProcessed})`,
                    },
                  ]}
                />

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedSyncLogId(null);
                    setActiveLogTab("logs");
                  }}
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Clear filter
                </Button>
              </div>
            </div>

            {/* Metrics row */}
            <div className="text-footnote grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4 lg:grid-cols-6">
              <div className="bg-surface border-separator rounded-control border p-2">
                <span className="text-label-secondary text-footnote block">Processed</span>
                <span className="text-label font-semibold tabular-nums">
                  {selectedSyncLog.cardsProcessed} cards
                </span>
              </div>
              <div className="bg-surface border-separator rounded-control border p-2">
                <span className="text-label-secondary text-footnote block">Created</span>
                <span className="text-green font-semibold tabular-nums">
                  +{selectedSyncLog.cardsCreated} new
                </span>
              </div>
              <div className="bg-surface border-separator rounded-control border p-2">
                <span className="text-label-secondary text-footnote block">Updated</span>
                <span className="text-blue font-semibold tabular-nums">
                  +{selectedSyncLog.cardsUpdated}
                </span>
              </div>
              <div className="bg-surface border-separator rounded-control border p-2">
                <span className="text-label-secondary text-footnote block">Duration</span>
                <span className="text-label font-semibold tabular-nums">
                  {formatDuration(selectedSyncLog.duration)}
                </span>
              </div>
              <div className="bg-surface border-separator rounded-control col-span-2 border p-2">
                <span className="text-label-secondary text-footnote block">
                  Started / Completed
                </span>
                <span className="text-label text-footnote block truncate tabular-nums">
                  {new Date(selectedSyncLog.startedAt).toLocaleString([], {
                    dateStyle: "short",
                    timeStyle: "medium",
                  })}
                </span>
              </div>
            </div>

            {parsedErrors && (
              <div className="rounded-row border-red/30 bg-red/10 text-footnote space-y-2 border p-3">
                <div className="flex items-center justify-between">
                  <div className="text-red flex items-center gap-2 font-semibold">
                    <AlertTriangle className="text-red h-4 w-4 shrink-0" />
                    <span>
                      {parsedErrors.isRateLimit
                        ? `NationStates API Rate Limit Encountered (${parsedErrors.count} nations throttled)`
                        : `Import Run Notice (${parsedErrors.count} reported)`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedSyncLog.syncType.startsWith("NS_REGION_") && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setConfirmFetchRegions(
                            selectedSyncLog.syncType.replace("NS_REGION_", "").toLowerCase()
                          )
                        }
                      >
                        <RefreshCw className="mr-1 h-3 w-3" /> Retry region fetch
                      </Button>
                    )}
                    <Button
                      variant="link"
                      size="sm"
                      aria-expanded={showErrorDetails}
                      onClick={() => setShowErrorDetails(!showErrorDetails)}
                      className="text-red px-0"
                    >
                      {showErrorDetails ? "Hide Nations" : `View Nations (${parsedErrors.count})`}
                    </Button>
                  </div>
                </div>

                <p className="text-label-secondary text-footnote leading-relaxed">
                  {parsedErrors.isRateLimit
                    ? "The upstream NationStates API rate-limited card fetch requests for these nations. All cards that were successfully imported are safely stored in your database."
                    : parsedErrors.raw}
                </p>

                {showErrorDetails && (
                  <div className="rounded-control border-red/20 bg-fill-4 flex max-h-40 flex-wrap gap-2 overflow-y-auto border p-2">
                    {parsedErrors.nations.map((n, i) => (
                      <Badge key={i} variant="destructive" className="tabular-nums">
                        {n.nation}
                        {n.reason && <span className="text-footnote opacity-70">({n.reason})</span>}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        ) : (
          /* Recent Import Runs Quick Filter Table */
          rawLogsData &&
          rawLogsData.length > 0 && (
            <div className="space-y-2">
              <div className="text-label-secondary text-caption flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="text-blue h-3.5 w-3.5" /> Recent Import Runs (Click to inspect
                  cards & logs)
                </span>
                <span className="text-footnote tabular-nums">{rawLogsData.length} records</span>
              </div>
              <Card className="rounded-row overflow-hidden">
                <div className="divide-separator max-h-56 divide-y overflow-y-auto">
                  {rawLogsData.map((log) => {
                    const typeLabel = log.syncType
                      .replace("NS_REGION_", "Region: ")
                      .replace(/_/g, " ");
                    return (
                      <div
                        key={log.id}
                        onClick={() => {
                          setSelectedSyncLogId(log.id);
                          setActiveLogTab("cards");
                        }}
                        className="hover:bg-fill-4 flex cursor-pointer items-center justify-between px-4 py-3 transition-colors"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Badge variant={statusBadgeVariant(log.status)}>{log.status}</Badge>
                          <div className="min-w-0">
                            <p className="text-label text-caption truncate">{typeLabel}</p>
                            <p className="text-label-secondary text-footnote flex items-center gap-2">
                              <span>
                                {new Date(log.startedAt).toLocaleString([], {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </span>
                              <span>•</span>
                              <span>Duration: {formatDuration(log.duration)}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <div className="text-footnote text-right">
                            <span className="text-label font-semibold tabular-nums">
                              {log.cardsProcessed} cards
                            </span>
                            <div className="text-label-secondary text-footnote">
                              <span className="text-green font-semibold">+{log.cardsCreated}</span>
                              {" / "}
                              <span className="text-blue font-semibold">+{log.cardsUpdated}</span>
                            </div>
                          </div>
                          <Button size="sm" variant="ghost">
                            Filter <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )
        )}

        {/* Tab Content: Logs or Cards */}
        {selectedSyncLog && activeLogTab === "cards" ? (
          /* Cards Browser for this Import Run */
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="text-purple h-4 w-4" />
                <h3 className="text-label text-headline">
                  Cards in this Import Run ({syncLogCardsData?.total ?? 0})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="text-label-secondary absolute top-2 left-2 h-3.5 w-3.5" />
                  <Input
                    value={cardSearchQuery}
                    onChange={(e) => setCardSearchQuery(e.target.value)}
                    placeholder="Search cards in this batch..."
                    className="rounded-control-sm md:text-footnote h-(--control-height-sm) pl-8"
                  />
                </div>
              </div>
            </div>

            {loadingSyncCards ? (
              <div className="text-label-secondary text-footnote flex items-center justify-center py-12">
                <RefreshCw className="text-blue mr-2 h-4 w-4 animate-spin" />
                Loading cards from this import batch...
              </div>
            ) : syncLogCardsData?.cards && syncLogCardsData.cards.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {syncLogCardsData.cards.map((card) => {
                  const flag =
                    card.artwork ||
                    (card.artworkVariants as any)?.original ||
                    "/images/cards/lore-placeholder.svg";
                  const region = (card.stats as any)?.region || syncLogCardsData.regionName;
                  return (
                    <Card
                      key={card.id}
                      className="group hover:border-tint/40 rounded-row flex flex-col justify-between space-y-2 p-3 transition-[color,background-color,border-color,box-shadow,opacity,transform]"
                    >
                      <div className="space-y-2">
                        <div className="border-separator rounded-control relative aspect-3/2 w-full overflow-hidden border bg-black/40">
                          <img
                            src={flag}
                            alt={card.title}
                            className="duration-fast h-full w-full object-contain transition-transform"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                "/images/cards/lore-placeholder.svg";
                            }}
                          />
                          <div className="absolute top-2 right-2">
                            <RarityBadge rarity={card.rarity as CardRarity} size="small" />
                          </div>

                          {card.season && (
                            <div className="rounded-control-sm text-caption absolute bottom-2 left-2 bg-black/70 px-2 py-0.5 text-white tabular-nums">
                              S{card.season}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-label text-caption truncate" title={card.title}>
                            {card.title}
                          </p>
                          {region && (
                            <p className="text-label-secondary text-footnote flex items-center gap-1 truncate">
                              <MapPin className="text-green h-2.5 w-2.5" />
                              {region}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="border-separator text-footnote flex items-center justify-between border-t pt-2">
                        <span className="text-label-secondary font-mono">
                          ID: {card.nsCardId ? `#${card.nsCardId}` : card.id.slice(0, 10)}
                        </span>
                        <span className="text-yellow font-semibold tabular-nums">
                          {card.marketValue ? `${card.marketValue.toFixed(1)} IxC` : "0.0 IxC"}
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="border-separator bg-fill-4 text-label-secondary rounded-row text-footnote border p-8 text-center">
                No cards found matching this import filter.
              </div>
            )}
          </div>
        ) : (
          /* Standard Filtered Log Stream */
          <LogViewerFilterable
            entries={syncLogEntries}
            title={
              selectedSyncLog ? `Audit Logs: ${selectedSyncLog.syncType}` : "NS Sync Audit Log"
            }
            maxHeight={380}
            className="border-separator rounded-row border"
          />
        )}
      </Card>

      <AlertDialog open={!!confirmFetchRegions} onOpenChange={() => setConfirmFetchRegions(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Globe className="text-green h-5 w-5" />
              Confirm region fetch
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-label-secondary text-footnote space-y-2">
                <div>
                  Fetch cards from region:{" "}
                  <span className="text-label font-semibold tabular-nums">
                    {confirmFetchRegions}
                  </span>
                </div>
                <div className="pt-2">
                  <label className="text-label text-caption mb-1 block">
                    Seasons (e.g. 1-13 or 1,2,3)
                  </label>
                  <Input
                    type="text"
                    value={fetchSeasons}
                    onChange={(e) => setFetchSeasons(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose onClick={() => setConfirmFetchRegions(null)}>Cancel</AlertDialogClose>
            <Button
              onClick={() => {
                if (confirmFetchRegions) {
                  fetchRegionMutation.mutate({
                    regionNames: confirmFetchRegions,
                    seasons: parseSeasonsInput(fetchSeasons),
                  });
                }
              }}
              disabled={fetchRegionMutation.isPending}
            >
              {fetchRegionMutation.isPending ? "Starting..." : "Start Fetch"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmStopJobId} onOpenChange={() => setConfirmStopJobId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Square className="text-red h-5 w-5" />
              Stop Sync Job?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will abort the running sync job. Processed cards will remain saved in database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose onClick={() => setConfirmStopJobId(null)}>Cancel</AlertDialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmStopJobId) {
                  stopJobMutation.mutate({ syncLogId: confirmStopJobId });
                }
              }}
              disabled={stopJobMutation.isPending}
            >
              {stopJobMutation.isPending ? "Stopping..." : "Stop Job"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
