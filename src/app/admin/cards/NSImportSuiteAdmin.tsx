// src/app/admin/cards/NSImportSuiteAdmin.tsx
// Dedicated NationStates Import Suite Admin Module
"use client";

import { useState, useMemo } from "react";
import {
  RefreshCw,
  Database,
  Globe,
  MapPin,
  Search,
  Users,
  Play,
  Pause,
  Square,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Filter,
  X,
  Layers,
  Calendar,
  Clock,
  ArrowRight,
  Tag,
  Eye,
  Sparkles,
  ExternalLink,
  Image as ImageIcon,
  FileText,
  Check,
} from "lucide-react";

import { api } from "~/trpc/react";
import { LogViewerFilterable, type LogEntry, type LogLevel } from "~/components/log-viewer";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useNotify } from "~/hooks/useNotify";
import { useVisibleRefetch } from "~/hooks/useVisibleRefetch";
import {
  FacetContainer,
  FacetCard,
} from "~/components/ui/facet-container";
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

function getStatusColor(status: string) {
  switch (status) {
    case "COMPLETED":
    case "SUCCESS":
      return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/30";
    case "IN_PROGRESS":
      return "text-blue-600 dark:text-blue-400 bg-blue-500/15 border border-blue-500/30";
    case "PAUSED":
      return "text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30";
    case "FAILED":
      return "text-rose-600 dark:text-rose-400 bg-rose-500/15 border border-rose-500/30";
    default:
      return "text-muted-foreground bg-muted border border-border";
  }
}

function formatDuration(ms: number | null) {
  if (!ms) return "N/A";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function NSImportSuiteAdmin() {
  const notify = useNotify();
  const [refreshInterval, setRefreshInterval] = useState<number | null>(10000);
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

  const { data: healthStats, isLoading: loadingHealth, refetch: refetchHealth } =
    api.nsImport.getSyncHealth.useQuery(undefined, {
      refetchInterval: refreshInterval ?? false,
    });

  const { data: rawLogsData, refetch: refetchLogs } =
    api.nsImport.getSyncLogs.useQuery(
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

  const { data: activeJobs, refetch: refetchActiveJobs } =
    api.nsImport.getActiveJobs.useQuery(undefined, {
      refetchInterval: refreshInterval ?? false,
    });

  useVisibleRefetch(refreshInterval ?? 10000);

  const selectedSyncLog = useMemo(
    () => rawLogsData?.find((l) => l.id === selectedSyncLogId) ?? null,
    [rawLogsData, selectedSyncLogId]
  );

  const parsedErrors = useMemo(() => {
    if (!selectedSyncLog?.errorMessage) return null;
    const raw = selectedSyncLog.errorMessage;
    const items = raw.split(";").map((s) => s.trim()).filter(Boolean);
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
    onSuccess: (data: { message: string; results: { regionName: string; syncLogId: string }[] }) => {
      notify.success("Fetch Started", data.message);
      setConfirmFetchRegions(null);
      void refetchActiveJobs();
      void refetchLogs();
    },
    onError: (err: { message: string }) => notify.error("Fetch Error", err.message),
  });

  const discoverRegionsMutation = api.nsImport.discoverTopRegions.useMutation({
    onSuccess: (data: { regions: { id: string; name: string; numnations: number }[]; totalScanned: number }) => {
      setDiscoveredRegions(data.regions);
      notify.success("Discovery Complete", `Found ${data.regions.length} regions with tag "${discoveryTag}"`);
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
    onSuccess: (data: { totalProcessed: number; cteCount: number; activeCount: number; message: string }) => {
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
        message: `[${log.syncType}] — ${log.status} | Processed: ${log.cardsProcessed ?? 0} (Created: +${log.cardsCreated ?? 0}, Updated: +${log.cardsUpdated ?? 0}) ${log.errorMessage ? `| Error: ${log.errorMessage}` : ""}`,
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



      {/* ─── Active & Paused Background Sync Jobs ───────────────── */}
      {activeJobs && activeJobs.length > 0 && (
        <FacetCard depth={2} className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-6 backdrop-blur-xl shadow-xl space-y-4">
          <h2 className="text-foreground flex items-center gap-2 text-lg font-bold">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
            Active / Paused Sync Jobs ({activeJobs.length})
          </h2>
          <div className="space-y-3">
            {activeJobs.map((job: any) => {
              const pct =
                job.totalCards > 0
                  ? Math.min(100, Math.round((job.cardsProcessed / job.totalCards) * 100))
                  : 0;
              return (
                <FacetCard
                  key={job.id}
                  depth={1}
                  className="rounded-xl border border-border bg-card/60 p-4 backdrop-blur-md flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground text-xs font-bold">
                        {job.syncType.replace("NS_REGION_", "Region: ").replace(/_/g, " ")}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getStatusColor(job.status)}`}
                      >
                        {job.status}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span>Cards: {job.cardsProcessed}/{job.totalCards} ({pct}%)</span>
                      <span>Created: +{job.cardsCreated}</span>
                      <span>Updated: +{job.cardsUpdated}</span>
                      <span>Errors: {job.errorCount}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {job.status === "IN_PROGRESS" && (
                      <Button
                        onClick={() => pauseJobMutation.mutate({ syncLogId: job.id })}
                        disabled={pauseJobMutation.isPending}
                        size="sm"
                        className="bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-300 hover:bg-amber-500/30 active:scale-95 transition-all text-xs"
                      >
                        <Pause className="mr-1 h-3.5 w-3.5" /> Pause
                      </Button>
                    )}
                    {job.status === "PAUSED" && (
                      <Button
                        onClick={() => resumeJobMutation.mutate({ syncLogId: job.id })}
                        disabled={resumeJobMutation.isPending}
                        size="sm"
                        className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/30 active:scale-95 transition-all text-xs"
                      >
                        <Play className="mr-1 h-3.5 w-3.5" /> Resume
                      </Button>
                    )}
                    <Button
                      onClick={() => setConfirmStopJobId(job.id)}
                      size="sm"
                      className="bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-300 hover:bg-rose-500/30 active:scale-95 transition-all text-xs"
                    >
                      <Square className="mr-1 h-3.5 w-3.5" /> Stop
                    </Button>
                  </div>
                </FacetCard>
              );
            })}
          </div>
        </FacetCard>
      )}

      {/* ─── Bulk Region Import & Discovery Grid ───────────────── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Region Fetch Card */}
        <FacetCard depth={2} className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-xl shadow-xl space-y-4 text-card-foreground">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/20 p-2 backdrop-blur-md">
              <MapPin className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-foreground tracking-tight text-lg font-bold">
                Region Card Fetch
              </h3>
              <p className="text-muted-foreground text-xs font-medium">
                Fetch trading cards from all nations in specified NS regions
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <textarea
              value={regionNames}
              onChange={(e) => setRegionNames(e.target.value)}
              placeholder="Region name(s) (e.g. greater_ixnay, the_pacific)"
              className="h-24 w-full rounded-xl border border-border bg-card p-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
            />
            <div className="flex justify-end">
              <Button
                onClick={() => setConfirmFetchRegions(regionNames)}
                disabled={!regionNames.trim() || fetchRegionMutation.isPending}
                className="h-9 rounded-xl border border-emerald-500/30 bg-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-200 hover:bg-emerald-500/30 active:scale-95 transition-all shadow-xs"
              >
                {fetchRegionMutation.isPending ? (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Globe className="mr-1.5 h-3.5 w-3.5" />
                )}
                Fetch Region(s)
              </Button>
            </div>
          </div>
        </FacetCard>

        {/* Discover Top Regions Card */}
        <FacetCard depth={2} className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-xl shadow-xl space-y-4 text-card-foreground">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl border border-purple-400/30 bg-purple-500/20 p-2 backdrop-blur-md">
              <Search className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <h3 className="text-foreground tracking-tight text-lg font-bold">
                Discover NS Regions
              </h3>
              <p className="text-muted-foreground text-xs font-medium">
                Find high-card-density regions by activity tag
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={discoveryTag}
              onChange={(e) => setDiscoveryTag(e.target.value)}
              className="h-9 flex-1 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground transition-all hover:bg-accent focus:outline-none"
            >
              <option value="gargantuan" className="bg-card text-card-foreground">Largest Regions</option>
              <option value="Role Player" className="bg-card text-card-foreground">Roleplay Communities</option>
              <option value="Democratic" className="bg-card text-card-foreground">Democratic / Legislative</option>
              <option value="Totalitarian" className="bg-card text-card-foreground">Totalitarian / Dictatorships</option>
              <option value="Communist" className="bg-card text-card-foreground">Communist / Leftist</option>
              <option value="Capitalist" className="bg-card text-card-foreground">Capitalist / Trade</option>
              <option value="Monarchist" className="bg-card text-card-foreground">Monarchy / Feudalist</option>
              <option value="Anarchist" className="bg-card text-card-foreground">Anarchist / Lawless</option>
            </select>
            <Button
              onClick={() => discoverRegionsMutation.mutate({ limit: 15, tag: discoveryTag })}
              disabled={discoverRegionsMutation.isPending}
              className="h-9 rounded-xl border border-purple-500/30 bg-purple-500/20 text-xs font-semibold text-purple-600 dark:text-purple-200 hover:bg-purple-500/30 active:scale-95 transition-all shadow-xs"
            >
              {discoverRegionsMutation.isPending ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="mr-1.5 h-3.5 w-3.5" />
              )}
              Scan Regions
            </Button>
          </div>

          {discoveredRegions && (
            <FacetContainer depth={1} enableRefraction={true} className="overflow-hidden rounded-xl border border-border bg-card/60 backdrop-blur-md">
              <div className="border-b border-border px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Top {discoveredRegions.length} Regions</span>
                <span>
                  {discoveredRegions.reduce((sum, r) => sum + r.numnations, 0).toLocaleString()} nations
                </span>
              </div>
              <div className="divide-y divide-border/60 max-h-56 overflow-y-auto">
                {discoveredRegions.map((region, i) => (
                  <div
                    key={region.id}
                    className="flex items-center justify-between px-4 py-2 hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-5 font-mono text-[10px] text-muted-foreground text-right">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-xs font-semibold">{region.name}</p>
                        <p className="text-muted-foreground flex items-center gap-1 text-[10px]">
                          <Users className="h-3 w-3" />
                          {region.numnations.toLocaleString()} nations
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmFetchRegions(region.id)}
                      disabled={fetchRegionMutation.isPending}
                      className="h-7 rounded-lg border-emerald-500/30 bg-emerald-500/10 text-[11px] font-medium text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20 active:scale-95 transition-all"
                    >
                      <Globe className="mr-1 h-3 w-3" /> Fetch
                    </Button>
                  </div>
                ))}
              </div>
            </FacetContainer>
          )}
        </FacetCard>
      </div>

      {/* ─── Filter CTE Nations Section ────────────────────────── */}
      <FacetCard depth={2} className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 backdrop-blur-xl space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/20 p-2 backdrop-blur-md">
            <RefreshCw className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-foreground tracking-tight text-lg font-bold">
              Filter Active vs. CTE (Defunct) Nations
            </h3>
            <p className="text-muted-foreground text-xs font-medium">
              Tag imported cards against the official NationStates active nations dump (<code className="text-amber-500 font-mono">nations.xml.gz</code>)
            </p>
          </div>
        </div>
        <Button
          onClick={() => filterCTENationsMutation.mutate()}
          disabled={filterCTENationsMutation.isPending}
          className="h-9 rounded-xl border border-amber-500/30 bg-amber-500/20 text-xs font-semibold text-amber-600 dark:text-amber-200 hover:bg-amber-500/30 active:scale-95 transition-all shadow-xs"
        >
          {filterCTENationsMutation.isPending ? (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          )}
          {filterCTENationsMutation.isPending ? "Filtering..." : "Run CTE Filter"}
        </Button>
      </FacetCard>

      {/* ─── Sync Operations Log & Import Filter Explorer ──────────────── */}
      <FacetCard depth={2} className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-xl shadow-xl space-y-6">
        {/* Header toolbar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-border/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-foreground text-lg font-bold">Sync Operations & Import Runs</h2>
              {selectedSyncLog && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  <Filter className="h-3 w-3" /> Filtered View
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              Audit log stream & card inspection per individual import job
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Import run selector dropdown */}
            <div className="flex items-center gap-1.5">
              <label className="text-muted-foreground text-[11px] font-semibold flex items-center gap-1">
                <Layers className="h-3 w-3 text-blue-500" /> Import:
              </label>
              <select
                value={selectedSyncLogId || "ALL"}
                onChange={(e) => {
                  const val = e.target.value === "ALL" ? null : e.target.value;
                  setSelectedSyncLogId(val);
                  if (val) setActiveLogTab("cards");
                  else setActiveLogTab("logs");
                }}

                className="h-8.5 max-w-[240px] truncate rounded-xl border border-border bg-card px-2.5 text-xs font-semibold text-foreground transition-all hover:bg-accent focus:outline-none"
              >
                <option value="ALL" className="bg-card text-card-foreground">
                  All Imports ({rawLogsData?.length ?? 0} runs)
                </option>
                {(rawLogsData ?? []).map((log) => {
                  const label = log.syncType.replace("NS_REGION_", "Region: ").replace(/_/g, " ");
                  const dateStr = new Date(log.startedAt).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <option key={log.id} value={log.id} className="bg-card text-card-foreground">
                      [{log.status}] {label} — {dateStr} (+{log.cardsCreated})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Sync type filter */}
            <select
              value={syncTypeFilter}
              onChange={(e) => setSyncTypeFilter(e.target.value as "all" | "region")}
              className="h-8.5 rounded-xl border border-border bg-card px-2.5 text-xs font-semibold text-foreground transition-all hover:bg-accent focus:outline-none"
            >
              <option value="all" className="bg-card text-card-foreground">All Types</option>
              <option value="region" className="bg-card text-card-foreground">Region Only</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              className="h-8.5 rounded-xl border border-border bg-card/80 text-xs text-foreground hover:bg-accent active:scale-95 transition-all shadow-xs"
            >
              <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
            </Button>
          </div>
        </div>

        {/* Selected Import Run Drill-Down Header Banner */}
        {selectedSyncLog ? (
          <FacetCard
            depth={1}
            className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 backdrop-blur-md space-y-3"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-foreground text-sm font-bold flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-blue-500" />
                  {selectedSyncLog.syncType.replace("NS_REGION_", "Region: ").replace(/_/g, " ")}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getStatusColor(selectedSyncLog.status)}`}
                >
                  {selectedSyncLog.status}
                </span>
                <span className="text-muted-foreground text-xs font-mono">
                  ID: {selectedSyncLog.id}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Mode Switcher: Logs vs Cards */}
                <div className="flex rounded-lg border border-border bg-card/80 p-0.5">
                  <button
                    onClick={() => setActiveLogTab("logs")}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      activeLogTab === "logs"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <FileText className="h-3 w-3" /> Audit Log
                  </button>
                  <button
                    onClick={() => setActiveLogTab("cards")}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      activeLogTab === "cards"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Imported Cards</span>
                    <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 py-0.2 text-[10px] font-mono">
                      {syncLogCardsData?.total ?? selectedSyncLog.cardsProcessed}
                    </span>
                  </button>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedSyncLogId(null);
                    setActiveLogTab("logs");
                  }}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Clear Filter
                </Button>
              </div>
            </div>

            {/* Metrics row */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 pt-1 text-xs">
              <div className="rounded-lg bg-card/60 border border-border/60 p-2">
                <span className="text-muted-foreground text-[10px] block">Processed</span>
                <span className="font-mono font-bold text-foreground">
                  {selectedSyncLog.cardsProcessed} cards
                </span>
              </div>
              <div className="rounded-lg bg-card/60 border border-border/60 p-2">
                <span className="text-muted-foreground text-[10px] block">Created</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  +{selectedSyncLog.cardsCreated} new
                </span>
              </div>
              <div className="rounded-lg bg-card/60 border border-border/60 p-2">
                <span className="text-muted-foreground text-[10px] block">Updated</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  +{selectedSyncLog.cardsUpdated}
                </span>
              </div>
              <div className="rounded-lg bg-card/60 border border-border/60 p-2">
                <span className="text-muted-foreground text-[10px] block">Duration</span>
                <span className="font-mono font-bold text-foreground">
                  {formatDuration(selectedSyncLog.duration)}
                </span>
              </div>
              <div className="rounded-lg bg-card/60 border border-border/60 p-2 col-span-2">
                <span className="text-muted-foreground text-[10px] block">Started / Completed</span>
                <span className="font-mono text-[11px] text-foreground truncate block">
                  {new Date(selectedSyncLog.startedAt).toLocaleString([], { dateStyle: "short", timeStyle: "medium" })}
                </span>
              </div>
            </div>

            {parsedErrors && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-300 font-bold">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
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
                        variant="outline"
                        onClick={() =>
                          setConfirmFetchRegions(
                            selectedSyncLog.syncType.replace("NS_REGION_", "").toLowerCase()
                          )
                        }
                        className="h-6.5 text-[11px] rounded-lg border-rose-500/40 bg-rose-500/20 text-rose-600 dark:text-rose-200 hover:bg-rose-500/30 active:scale-95 transition-all"
                      >
                        <RefreshCw className="mr-1 h-3 w-3" /> Retry Region Fetch
                      </Button>
                    )}
                    <button
                      onClick={() => setShowErrorDetails(!showErrorDetails)}
                      className="text-[11px] text-rose-600 dark:text-rose-400 underline hover:no-underline font-medium cursor-pointer"
                    >
                      {showErrorDetails ? "Hide Nations" : `View Nations (${parsedErrors.count})`}
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {parsedErrors.isRateLimit
                    ? "The upstream NationStates API rate-limited card fetch requests for these nations. All cards that were successfully imported are safely stored in your database."
                    : parsedErrors.raw}
                </p>

                {showErrorDetails && (
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto rounded-lg bg-black/30 p-2 border border-rose-500/20">
                    {parsedErrors.nations.map((n, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-md bg-rose-500/20 px-2 py-0.5 font-mono text-[10px] text-rose-600 dark:text-rose-300 border border-rose-500/30"
                      >
                        {n.nation}
                        {n.reason && <span className="text-[9px] opacity-70">({n.reason})</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

          </FacetCard>
        ) : (
          /* Recent Import Runs Quick Filter Table */
          rawLogsData && rawLogsData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-blue-500" /> Recent Import Runs (Click to inspect cards & logs)
                </span>
                <span className="text-[11px] font-mono">{rawLogsData.length} records</span>
              </div>
              <FacetContainer depth={1} enableRefraction={true} className="overflow-hidden rounded-xl border border-border bg-card/60 backdrop-blur-md">
                <div className="max-h-56 overflow-y-auto divide-y divide-border/60">
                  {rawLogsData.map((log) => {
                    const typeLabel = log.syncType.replace("NS_REGION_", "Region: ").replace(/_/g, " ");
                    return (
                      <div
                        key={log.id}
                        onClick={() => {
                          setSelectedSyncLogId(log.id);
                          setActiveLogTab("cards");
                        }}
                        className="flex cursor-pointer items-center justify-between px-4 py-2.5 hover:bg-accent/50 transition-colors"
                      >

                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${getStatusColor(log.status)}`}
                          >
                            {log.status}
                          </span>
                          <div className="min-w-0">
                            <p className="text-foreground truncate text-xs font-semibold">{typeLabel}</p>
                            <p className="text-muted-foreground text-[10px] flex items-center gap-2">
                              <span>{new Date(log.startedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                              <span>•</span>
                              <span>Duration: {formatDuration(log.duration)}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right text-xs">
                            <span className="font-mono font-bold text-foreground">
                              {log.cardsProcessed} cards
                            </span>
                            <div className="text-[10px] text-muted-foreground">
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+{log.cardsCreated}</span>
                              {" / "}
                              <span className="text-blue-600 dark:text-blue-400 font-semibold">+{log.cardsUpdated}</span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px] text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                          >
                            Filter <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </FacetContainer>
            </div>
          )
        )}

        {/* Tab Content: Logs or Cards */}
        {selectedSyncLog && activeLogTab === "cards" ? (
          /* Cards Browser for this Import Run */
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <h3 className="text-foreground text-sm font-bold">
                  Cards in this Import Run ({syncLogCardsData?.total ?? 0})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={cardSearchQuery}
                    onChange={(e) => setCardSearchQuery(e.target.value)}
                    placeholder="Search cards in this batch..."
                    className="h-8.5 pl-8 text-xs bg-card"
                  />
                </div>
              </div>
            </div>

            {loadingSyncCards ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-xs">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin text-blue-500" />
                Loading cards from this import batch...
              </div>
            ) : syncLogCardsData?.cards && syncLogCardsData.cards.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {syncLogCardsData.cards.map((card) => {
                  const flag =
                    card.artwork || (card.artworkVariants as any)?.original || "/images/cards/lore-placeholder.svg";
                  const region = (card.stats as any)?.region || syncLogCardsData.regionName;
                  return (
                    <FacetCard
                      key={card.id}
                      depth={1}
                      interactive="hover"
                      className="group rounded-xl border border-border bg-card/60 p-3 backdrop-blur-md transition-all hover:border-primary/40 flex flex-col justify-between space-y-2"
                    >
                      <div className="space-y-2">
                        <div className="relative aspect-3/2 w-full overflow-hidden rounded-lg bg-black/40 border border-border/40">
                          <img
                            src={flag}
                            alt={card.title}
                            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = "/images/cards/lore-placeholder.svg";
                            }}
                          />
                          <div className="absolute top-1.5 right-1.5">
                            <RarityBadge rarity={card.rarity as CardRarity} size="small" />
                          </div>

                          {card.season && (
                            <div className="absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">
                              S{card.season}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-foreground truncate text-xs font-bold" title={card.title}>
                            {card.title}
                          </p>
                          {region && (
                            <p className="text-muted-foreground truncate text-[10px] flex items-center gap-1">
                              <MapPin className="h-2.5 w-2.5 text-emerald-500" />
                              {region}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-border/40 pt-2 text-[10px]">
                        <span className="text-muted-foreground font-mono">
                          ID: {card.nsCardId ? `#${card.nsCardId}` : card.id.slice(0, 10)}
                        </span>
                        <span className="font-mono font-bold text-amber-500">
                          {card.marketValue ? `${card.marketValue.toFixed(1)} IxC` : "0.0 IxC"}
                        </span>
                      </div>
                    </FacetCard>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-8 text-center text-xs text-muted-foreground">
                No cards found matching this import filter.
              </div>
            )}
          </div>
        ) : (
          /* Standard Filtered Log Stream */
          <LogViewerFilterable
            entries={syncLogEntries}
            title={selectedSyncLog ? `Audit Logs: ${selectedSyncLog.syncType}` : "NS Sync Audit Log"}
            maxHeight={380}
            className="border border-border/80 shadow-inner rounded-xl"
          />
        )}
      </FacetCard>


      {/* ─── Confirm Region Fetch Modal ────────────────────────── */}
      <AlertDialog open={!!confirmFetchRegions} onOpenChange={() => setConfirmFetchRegions(null)}>
        <AlertDialogContent className="border border-border bg-card text-card-foreground backdrop-blur-2xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <Globe className="h-5 w-5 text-emerald-500" />
              Confirm Region Fetch
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-muted-foreground text-xs space-y-2">
                <div>
                  Fetch cards from region:{" "}
                  <span className="font-mono font-bold text-foreground">
                    {confirmFetchRegions}
                  </span>
                </div>
                <div className="pt-2">
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Seasons (e.g. 1-13 or 1,2,3)
                  </label>
                  <input
                    type="text"
                    value={fetchSeasons}
                    onChange={(e) => setFetchSeasons(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
              className="bg-emerald-500 font-semibold text-black hover:bg-emerald-400 active:scale-95 transition-all"
            >
              {fetchRegionMutation.isPending ? "Starting..." : "Start Fetch"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* ─── Confirm Stop Job Modal ─────────────────────────────── */}
      <AlertDialog open={!!confirmStopJobId} onOpenChange={() => setConfirmStopJobId(null)}>
        <AlertDialogContent className="border border-border bg-card text-card-foreground backdrop-blur-2xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <Square className="h-5 w-5 text-rose-500" />
              Stop Sync Job?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs">
              This will abort the running sync job. Processed cards will remain saved in database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose onClick={() => setConfirmStopJobId(null)}>Cancel</AlertDialogClose>
            <Button
              onClick={() => {
                if (confirmStopJobId) {
                  stopJobMutation.mutate({ syncLogId: confirmStopJobId });
                }
              }}
              disabled={stopJobMutation.isPending}
              className="bg-rose-500 font-semibold text-white hover:bg-rose-600 active:scale-95 transition-all"
            >
              {stopJobMutation.isPending ? "Stopping..." : "Stop Job"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
