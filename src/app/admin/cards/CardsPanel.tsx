// src/app/admin/cards/page.tsx
// Unified Card Administration Dashboard - Sync, Packs, Lore Cards, Vault & Credits
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  RefreshCw,
  Database,
  // eslint-disable-next-line unused-imports/no-unused-imports
  AlertCircle,
  CheckCircle,
  // eslint-disable-next-line unused-imports/no-unused-imports
  XCircle,
  Play,
  Pause,
  Square,
  TrendingUp,
  AlertTriangle,
  Globe,
  MapPin,
  Layers,
  Search,
  Users,
  Package,
  Gavel,
  BookOpen,
} from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { CardPacksAdmin } from "./CardPacksAdmin";
import { LoreCardBatchAdmin } from "./LoreCardBatchAdmin";
import { IxCardSeasonAdmin } from "./IxCardSeasonAdmin";

type AdminTab = "sync" | "packs" | "lore" | "season";

function SeedDemoAuctionsButton() {
  const notify = useNotify();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const seedMutation = api.cardMarket.seedDemoAuctions.useMutation({
    onSuccess: (data: any) => {
      notify.success("Demo Auctions Seeded", data.message);
      setConfirmOpen(false);
    },
    onError: (error: any) => {
      notify.error("Seeding Failed", error.message);
      setConfirmOpen(false);
    },
  });

  return (
    <>
      <div className="glass-card-child flex items-center justify-between rounded-xl border border-amber-500/20 p-4">
        <div className="flex items-center gap-3">
          <Gavel className="h-5 w-5 text-amber-400" />
          <div>
            <p className="text-foreground text-sm font-medium">Demo Auctions</p>
            <p className="text-muted-foreground text-xs">
              Seed sample auctions with lore cards for marketplace testing
            </p>
          </div>
        </div>
        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={seedMutation.isPending}
          className="bg-amber-500 hover:bg-amber-600"
        >
          {seedMutation.isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Gavel className="h-4 w-4" />
          )}
          Seed Auctions
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-amber-500" />
              Seed Demo Auctions?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Create 6 demo auctions with sample lore cards? This will populate the marketplace for
              active testing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose onClick={() => setConfirmOpen(false)}>Cancel</AlertDialogClose>
            <Button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="bg-amber-500 font-semibold text-white hover:bg-amber-600"
            >
              {seedMutation.isPending ? "Seeding..." : "Confirm Seed"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function CardAdminDashboardPage() {
  const notify = useNotify();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTabState] = useState<AdminTab>(() => {
    const tab = searchParams.get("tab");
    if (tab === "packs") return "packs";
    if (tab === "lore") return "lore";
    if (tab === "season") return "season";
    return "sync";
  });

  const setActiveTab = (tab: AdminTab) => {
    setActiveTabState(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.pushState({}, "", url.toString());
  };

  const [refreshInterval, setRefreshInterval] = useState<number | null>(10000);
  const [regionNames, setRegionNames] = useState("greater_ixnay");
  const [syncTypeFilter, setSyncTypeFilter] = useState<"all" | "region">("all");
  const [discoveredRegions, setDiscoveredRegions] = useState<
    { id: string; name: string; numnations: number }[] | null
  >(null);
  const [discoveryTag, setDiscoveryTag] = useState("gargantuan");

  // Modal confirmation states
  const [confirmFetchRegions, setConfirmFetchRegions] = useState<string | null>(null);
  const [confirmStopJobId, setConfirmStopJobId] = useState<string | null>(null);

  // ─── Queries ──────────────────────────────────────────────────
  const {
    data: healthStats,
    isLoading: loadingHealth,
    refetch: refetchHealth,
  } = api.nsImport.getSyncHealth.useQuery(undefined, {
    refetchInterval: refreshInterval ?? false,
    enabled: activeTab === "sync",
  });

  const { data: libraryStats } = api.cards.getNSLibraryStats.useQuery(undefined, {
    refetchInterval: refreshInterval ?? false,
    enabled: activeTab === "sync",
  });

  const { data: syncLogs, refetch: refetchLogs } = api.nsImport.getSyncLogs.useQuery(
    { syncTypeFilter, limit: 50 },
    { refetchInterval: refreshInterval ?? false, enabled: activeTab === "sync" }
  );

  // Poll all active/paused background jobs
  const { data: activeJobs, refetch: refetchActiveJobs } = api.nsImport.getActiveJobs.useQuery(
    undefined,
    {
      enabled: activeTab === "sync",
      refetchInterval: 3000,
    }
  );

  // ─── Mutations ────────────────────────────────────────────────
  const fetchRegionMutation = api.nsImport.fetchRegionCards.useMutation({
    onSuccess: (data) => {
      notify.success("Region fetch started", data.message);
      void refetchActiveJobs();
      setConfirmFetchRegions(null);
    },
    onError: (error) => {
      notify.error("Fetch failed", error.message);
    },
  });

  const discoverRegionsMutation = api.nsImport.discoverTopRegions.useMutation({
    onSuccess: (data) => {
      setDiscoveredRegions(data.regions);
    },
    onError: (error) => {
      notify.error("Discovery failed", error.message);
    },
  });

  const pauseJobMutation = api.nsImport.pauseRegionFetch.useMutation({
    onSuccess: (data) => {
      notify.success("Pause requested", data.message);
      void refetchActiveJobs();
    },
    onError: (error) => {
      notify.error("Failed to pause", error.message);
    },
  });

  const resumeJobMutation = api.nsImport.resumeRegionFetch.useMutation({
    onSuccess: (data) => {
      notify.success("Resume requested", data.message);
      void refetchActiveJobs();
    },
    onError: (error) => {
      notify.error("Failed to resume", error.message);
    },
  });

  const stopJobMutation = api.nsImport.stopRegionFetch.useMutation({
    onSuccess: (data) => {
      notify.success("Sync job stopped", data.message);
      setConfirmStopJobId(null);
      void refetchActiveJobs();
      void refetchLogs();
      void refetchHealth();
    },
    onError: (error) => {
      notify.error("Failed to stop", error.message);
    },
  });

  // ─── Handlers ─────────────────────────────────────────────────
  const handleRefreshAll = () => {
    void refetchHealth();
    void refetchLogs();
    void refetchActiveJobs();
  };

  // ─── Helpers ──────────────────────────────────────────────────
  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
      case "SUCCESS":
        return "text-green-400 bg-green-500/20";
      case "IN_PROGRESS":
        return "text-blue-400 bg-blue-500/20";
      case "FAILED":
        return "text-red-400 bg-red-500/20";
      default:
        return "text-muted-foreground bg-muted/50";
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "N/A";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className="bg-background text-foreground min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="glass-card-parent rounded-xl border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-transparent to-blue-500/10 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
                <Database className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-foreground text-2xl font-bold md:text-3xl">Card Management</h1>
                <p className="text-muted-foreground text-sm">
                  NS Card Sync, Card Packs, and Batch Lore Generator
                </p>
              </div>
            </div>
            {activeTab === "sync" && (
              <div className="flex items-center gap-3">
                <select
                  value={refreshInterval ?? "off"}
                  onChange={(e) =>
                    setRefreshInterval(e.target.value === "off" ? null : parseInt(e.target.value))
                  }
                  className="border-border bg-background text-foreground rounded-lg border px-4 py-2 text-sm"
                >
                  <option value="off">Auto-refresh: Off</option>
                  <option value="5000">Every 5s</option>
                  <option value="10000">Every 10s</option>
                  <option value="30000">Every 30s</option>
                </select>
                <Button
                  onClick={handleRefreshAll}
                  disabled={loadingHealth}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingHealth ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            )}
          </div>

          {/* Tab Strip */}
          <div className="border-border mt-4 flex flex-wrap gap-2 border-t pt-4">
            {[
              { id: "sync" as AdminTab, label: "NS Sync", icon: Database },
              { id: "packs" as AdminTab, label: "Card Packs", icon: Package },
              { id: "lore" as AdminTab, label: "Lore Card Generator", icon: BookOpen },
              { id: "season" as AdminTab, label: "IxCard Seasons", icon: Layers },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-blue-500/20 text-blue-400"
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Card Packs Tab */}
        {activeTab === "packs" && (
          <div className="space-y-4">
            <SeedDemoAuctionsButton />
            <CardPacksAdmin />
          </div>
        )}

        {/* Lore Cards Tab */}
        {activeTab === "lore" && <LoreCardBatchAdmin />}

        {/* Season Config Tab */}
        {activeTab === "season" && <IxCardSeasonAdmin />}

        {/* NS Sync Tab Content */}
        {activeTab === "sync" && (
          <>
            {/* ─── Active & Paused Region Imports ────────────────── */}
            {activeJobs && activeJobs.length > 0 && (
              <div className="glass-card-child rounded-xl border-2 border-blue-500/30 bg-gradient-to-r from-blue-500/10 via-transparent to-blue-500/5 p-5">
                <div className="mb-3 flex items-start gap-3">
                  <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-blue-400" />
                  <div>
                    <h3 className="text-foreground font-semibold">Region Import Queue</h3>
                    <p className="text-muted-foreground text-sm">
                      Monitor and manage region import jobs.
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  {activeJobs.map((job) => {
                    const pct =
                      job.totalNations > 0
                        ? Math.round((job.nationsProcessed / job.totalNations) * 100)
                        : 0;
                    return (
                      <div
                        key={job.id}
                        className="border-border/50 bg-muted/30 flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-foreground truncate text-sm font-semibold">
                              {job.regionName}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                job.status === "PAUSED"
                                  ? "bg-amber-500/20 text-amber-400"
                                  : job.status === "IN_PROGRESS"
                                    ? "bg-blue-500/20 text-blue-400"
                                    : "text-muted-foreground bg-muted/50"
                              }`}
                            >
                              {job.status}
                            </span>
                            <span className="text-muted-foreground ml-auto font-mono text-xs md:ml-0">
                              (Started {new Date(job.startedAt).toLocaleTimeString()})
                            </span>
                          </div>
                          <div className="bg-muted/50 mb-1 h-1.5 w-full rounded-full">
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                job.status === "PAUSED" ? "bg-amber-500" : "bg-blue-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            <span>
                              Nations: {job.nationsProcessed}/{job.totalNations} ({pct}%)
                            </span>
                            <span>Cards Created: +{job.cardsCreated}</span>
                            <span>Cards Updated: +{job.cardsUpdated}</span>
                            <span>Errors: {job.errorCount}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {job.status === "IN_PROGRESS" && (
                            <Button
                              onClick={() => pauseJobMutation.mutate({ syncLogId: job.id })}
                              disabled={pauseJobMutation.isPending}
                              size="sm"
                              className="bg-amber-500 text-white hover:bg-amber-600"
                            >
                              <Pause className="h-3.5 w-3.5" />
                              Pause
                            </Button>
                          )}
                          {job.status === "PAUSED" && (
                            <Button
                              onClick={() => resumeJobMutation.mutate({ syncLogId: job.id })}
                              disabled={resumeJobMutation.isPending}
                              size="sm"
                              className="bg-green-600 text-white hover:bg-green-700"
                            >
                              <Play className="h-3.5 w-3.5" />
                              Resume
                            </Button>
                          )}
                          <Button
                            onClick={() => setConfirmStopJobId(job.id)}
                            size="sm"
                            className="bg-red-600 text-white hover:bg-red-700"
                          >
                            <Square className="h-3.5 w-3.5" />
                            Stop
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── Library Statistics ─────────────────────────────── */}
            {libraryStats && (
              <div className="glass-card-child rounded-xl border border-purple-500/20 p-6">
                <h2 className="text-foreground mb-4 flex items-center gap-2 text-xl font-semibold">
                  <Layers className="h-6 w-6 text-purple-400" />
                  NS Card Library
                </h2>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <div>
                    <div className="text-muted-foreground text-sm">Total NS Cards in DB</div>
                    <div className="text-3xl font-bold text-purple-400">
                      {libraryStats.totalCards.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-2 text-sm">Top Regions</div>
                    {libraryStats.cardsByRegion.length > 0 ? (
                      <div className="space-y-1">
                        {libraryStats.cardsByRegion.slice(0, 5).map((r) => (
                          <div key={r.region} className="flex items-center justify-between text-sm">
                            <span className="text-foreground/80 truncate">{r.region}</span>
                            <span className="text-foreground ml-2 font-medium">
                              {r.count.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No cards imported yet</p>
                    )}
                  </div>
                  <div>
                    <div className="text-muted-foreground text-sm">Last Sync</div>
                    <div className="text-foreground text-lg font-semibold">
                      {libraryStats.lastSync
                        ? new Date(libraryStats.lastSync.at).toLocaleString()
                        : "Never"}
                    </div>
                    {libraryStats.lastSync && (
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(libraryStats.lastSync.status)}`}
                      >
                        {libraryStats.lastSync.status} ({libraryStats.lastSync.type})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Bulk Import Operations ─────────────────────────── */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Region Fetch */}
              <div className="glass-card-child rounded-xl border border-green-500/20 p-6">
                <h3 className="text-foreground mb-4 flex items-center gap-2 text-lg font-semibold">
                  <MapPin className="h-5 w-5 text-green-400" />
                  Region Card Fetch
                </h3>
                <p className="text-muted-foreground mb-4 text-sm text-balance">
                  Fetch trading cards from all nations in specific NS regions. Enter one or more
                  region names separated by commas (e.g.{" "}
                  <code className="font-mono text-xs text-green-400">
                    greater_ixnay, the_pacific
                  </code>
                  ).
                </p>
                <div className="mb-4 flex flex-col gap-2">
                  <textarea
                    value={regionNames}
                    onChange={(e) => setRegionNames(e.target.value)}
                    placeholder="Region name(s) (e.g. greater_ixnay, the_pacific)"
                    className="border-input bg-background/50 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                  />
                  <Button
                    onClick={() => setConfirmFetchRegions(regionNames)}
                    disabled={!regionNames.trim() || fetchRegionMutation.isPending}
                    className="self-end bg-green-500 hover:bg-green-600"
                  >
                    {fetchRegionMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                    Fetch Region(s)
                  </Button>
                </div>
              </div>

              {/* Discover Top Regions */}
              <div className="glass-card-child rounded-xl border border-purple-500/20 p-6">
                <h3 className="text-foreground mb-4 flex items-center gap-2 text-lg font-semibold">
                  <Search className="h-5 w-5 text-purple-400" />
                  Discover NS Regions
                </h3>
                <p className="text-muted-foreground mb-4 text-sm text-balance">
                  Find and explore different regions matching various activity, size, or political
                  tags. More nations = more cards to fetch.
                </p>
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    value={discoveryTag}
                    onChange={(e) => setDiscoveryTag(e.target.value)}
                    className="border-border bg-background/50 text-foreground flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-purple-500/50"
                  >
                    <option value="gargantuan">Largest Regions</option>
                    <option value="Role Player">Roleplay / Active Communities</option>
                    <option value="Democratic">Democratic / Legislative</option>
                    <option value="Totalitarian">Totalitarian / Dictatorships</option>
                    <option value="Communist">Communist / Leftist</option>
                    <option value="Capitalist">Capitalist / Trade</option>
                    <option value="Monarchist">Feudalist / Monarchy</option>
                    <option value="Anarchist">Anarchist / Lawless</option>
                  </select>
                  <Button
                    onClick={() => discoverRegionsMutation.mutate({ limit: 15, tag: discoveryTag })}
                    disabled={discoverRegionsMutation.isPending}
                    className="bg-purple-500 font-semibold hover:bg-purple-600"
                  >
                    {discoverRegionsMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    {discoverRegionsMutation.isPending ? "Scanning..." : "Scan Regions"}
                  </Button>
                </div>

                {discoveredRegions && (
                  <div className="border-border/50 bg-muted/30 overflow-hidden rounded-lg border">
                    <div className="border-border/50 flex items-center justify-between border-b px-4 py-2">
                      <span className="text-muted-foreground text-xs font-medium">
                        Top {discoveredRegions.length} regions by nation count
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {discoveredRegions
                          .reduce((sum, r) => sum + r.numnations, 0)
                          .toLocaleString()}{" "}
                        total nations
                      </span>
                    </div>
                    <div className="divide-border/30 max-h-80 divide-y overflow-y-auto">
                      {discoveredRegions.map((region, i) => (
                        <div
                          key={region.id}
                          className="hover:bg-muted/30 flex items-center justify-between px-4 py-2.5 transition-colors"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="text-muted-foreground w-5 shrink-0 text-right font-mono text-xs">
                              {i + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-foreground truncate text-sm font-medium">
                                {region.name}
                              </p>
                              <p className="text-muted-foreground flex items-center gap-1 text-xs">
                                <Users className="h-3 w-3" />
                                {region.numnations.toLocaleString()} nations
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setConfirmFetchRegions(region.id);
                            }}
                            disabled={fetchRegionMutation.isPending}
                            className="shrink-0 border-green-500/20 bg-green-500/10 text-xs text-green-500 hover:bg-green-500/20"
                          >
                            <Globe className="h-3.5 w-3.5" />
                            Fetch
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Overall Health Metrics ─────────────────────────── */}
            {healthStats && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="glass-card-child rounded-xl border border-blue-500/20 p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-400" />
                    <div className="text-muted-foreground text-xs font-semibold">Total Syncs</div>
                  </div>
                  <div className="text-foreground font-mono text-2xl font-bold">
                    {healthStats.overall.totalSyncs}
                  </div>
                  <div className="text-muted-foreground mt-0.5 truncate font-mono text-[10px]">
                    {healthStats.overall.lastSyncAt
                      ? new Date(healthStats.overall.lastSyncAt).toLocaleString()
                      : "Never"}
                  </div>
                </div>
                <div className="glass-card-child rounded-xl border border-green-500/20 p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-400" />
                    <div className="text-muted-foreground text-xs font-semibold">Success Rate</div>
                  </div>
                  <div className="font-mono text-2xl font-bold text-green-400">
                    {(healthStats.overall.successRate * 100).toFixed(1)}%
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-[10px]">
                    {healthStats.overall.successfulSyncs} successful
                  </div>
                </div>
                <div className="glass-card-child rounded-xl border border-red-500/20 p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <div className="text-muted-foreground text-xs font-semibold">Error Rate</div>
                  </div>
                  <div
                    className={`font-mono text-2xl font-bold ${healthStats.overall.errorRate > 0.1 ? "text-red-400" : "text-foreground"}`}
                  >
                    {(healthStats.overall.errorRate * 100).toFixed(1)}%
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-[10px]">
                    {healthStats.overall.failedSyncs} failed
                  </div>
                </div>
                <div className="glass-card-child rounded-xl border border-purple-500/20 p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-purple-400" />
                    <div className="text-muted-foreground text-xs font-semibold">
                      Avg Cards/Sync
                    </div>
                  </div>
                  <div className="font-mono text-2xl font-bold text-purple-400">
                    {healthStats.overall.avgCardsProcessed.toFixed(0)}
                  </div>
                  <div className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                    per sync operation
                  </div>
                </div>
              </div>
            )}

            {/* ─── Sync Logs ─────────────────────────────────────── */}
            <div className="glass-card-child rounded-xl border border-blue-500/20 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-foreground flex items-center gap-2 text-xl font-semibold">
                  <Database className="h-6 w-6 text-blue-400" />
                  Operations Log
                </h2>
                <select
                  value={syncTypeFilter}
                  onChange={(e) => setSyncTypeFilter(e.target.value as typeof syncTypeFilter)}
                  className="border-border bg-background text-foreground rounded-lg border px-3 py-1.5 text-sm"
                >
                  <option value="all">All Operations</option>
                  <option value="region">Region Fetches</option>
                </select>
              </div>
              {syncLogs && syncLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-border/50 border-b">
                        <th className="text-muted-foreground px-4 py-3 text-left text-sm font-medium">
                          Type
                        </th>
                        <th className="text-muted-foreground px-4 py-3 text-left text-sm font-medium">
                          Status
                        </th>
                        <th className="text-muted-foreground px-4 py-3 text-left font-mono text-sm font-medium">
                          Processed
                        </th>
                        <th className="text-muted-foreground px-4 py-3 text-left font-mono text-sm font-medium">
                          Created
                        </th>
                        <th className="text-muted-foreground px-4 py-3 text-left font-mono text-sm font-medium">
                          Updated
                        </th>
                        <th className="text-muted-foreground px-4 py-3 text-left text-sm font-medium">
                          Duration
                        </th>
                        <th className="text-muted-foreground px-4 py-3 text-left text-sm font-medium">
                          Started
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="border-border/30 hover:bg-muted/30 border-b transition-colors"
                        >
                          <td className="text-foreground max-w-[200px] truncate px-4 py-3 text-sm font-semibold">
                            {log.syncType.replace("NS_REGION_", "Region: ").replace(/_/g, " ")}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(log.status)}`}
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="text-foreground px-4 py-3 font-mono text-sm">
                            {log.cardsProcessed.toLocaleString()}
                          </td>
                          <td className="text-foreground px-4 py-3 font-mono text-sm">
                            {(log.cardsCreated ?? 0).toLocaleString()}
                          </td>
                          <td className="text-foreground px-4 py-3 font-mono text-sm">
                            {(log.cardsUpdated ?? 0).toLocaleString()}
                          </td>
                          <td className="text-foreground px-4 py-3 font-mono text-sm">
                            {formatDuration(log.duration)}
                          </td>
                          <td className="text-muted-foreground px-4 py-3 font-mono text-sm">
                            {new Date(log.startedAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No sync operations recorded yet
                </p>
              )}
            </div>
            {/* Fetch Confirmation Dialog */}
            <AlertDialog
              open={confirmFetchRegions !== null}
              onOpenChange={(open) => !open && setConfirmFetchRegions(null)}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 animate-pulse text-green-500" />
                    Fetch Region Cards?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to fetch trading cards from the region(s):{" "}
                    <span className="text-foreground font-mono font-bold">
                      {confirmFetchRegions}
                    </span>
                    ? This will query all decks in the region in the background using the
                    NationStates API (~800ms per nation).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogClose onClick={() => setConfirmFetchRegions(null)}>
                    Cancel
                  </AlertDialogClose>
                  <Button
                    onClick={() => {
                      if (confirmFetchRegions) {
                        fetchRegionMutation.mutate({ regionNames: confirmFetchRegions });
                      }
                    }}
                    disabled={fetchRegionMutation.isPending}
                    className="bg-green-500 font-semibold text-white hover:bg-green-600"
                  >
                    {fetchRegionMutation.isPending ? "Starting..." : "Start Fetch"}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Stop Job Confirmation Dialog */}
            <AlertDialog
              open={confirmStopJobId !== null}
              onOpenChange={(open) => !open && setConfirmStopJobId(null)}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 animate-bounce text-red-500" />
                    Stop Import Job?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently abort the background import job. Any progress made so far
                    will be saved, but the remaining nations will not be fetched.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogClose onClick={() => setConfirmStopJobId(null)}>
                    Cancel
                  </AlertDialogClose>
                  <Button
                    onClick={() => {
                      if (confirmStopJobId) {
                        stopJobMutation.mutate({ syncLogId: confirmStopJobId });
                      }
                    }}
                    disabled={stopJobMutation.isPending}
                    className="bg-red-600 font-semibold text-white hover:bg-red-700"
                  >
                    {stopJobMutation.isPending ? "Stopping..." : "Stop Job"}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
}
