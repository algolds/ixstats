// src/app/admin/cards/CardsPanel.tsx
// Unified Theme-Compliant Card Administration Dashboard - Overview, Explorer, Imports, Takedowns, Operations Log, Packs, Lore & Seasons
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  RefreshCw,
  Database,
  CheckCircle,
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
  Coins,
  ShieldAlert,
  SlidersHorizontal,
  FileText,
} from "lucide-react";
import { api } from "~/trpc/react";
import { LogViewerFilterable, type LogEntry, type LogLevel } from "~/components/log-viewer";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import { useVisibleRefetch } from "~/hooks/useVisibleRefetch";
import {
  FacetContainer,
  FacetCard,
  FacetNavigation,
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
import { CardPacksAdmin } from "./CardPacksAdmin";
import { LoreCardBatchAdmin } from "./LoreCardBatchAdmin";
import { IxCardSeasonAdmin } from "./IxCardSeasonAdmin";
import { ValuationAdmin } from "./ValuationAdmin";
import { BonusAdmin } from "./BonusAdmin";
import { AdminCardExplorer } from "./AdminCardExplorer";
import { CommonsFlagImporterAdmin } from "./CommonsFlagImporterAdmin";

type AdminTab =
  | "overview"
  | "explorer"
  | "import"
  | "commons"
  | "takedowns"
  | "packs"
  | "lore"
  | "valuation";

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

function SeedDemoAuctionsButton() {
  const notify = useNotify();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const seedMutation = api.cardMarket.seedDemoAuctions.useMutation({
    onSuccess: (data: { message: string }) => {
      notify.success("Demo Auctions Seeded", data.message);
      setConfirmOpen(false);
    },
    onError: (error: { message: string }) => {
      notify.error("Seeding Failed", error.message);
      setConfirmOpen(false);
    },
  });

  return (
    <>
      <FacetCard depth={1} interactive="hover" className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 backdrop-blur-xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/20 p-2.5 backdrop-blur-md">
            <Gavel className="h-5 w-5 text-amber-500 dark:text-amber-300" />
          </div>
          <div>
            <p className="text-foreground text-sm font-semibold">Demo Marketplace Auctions</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Seed synthetic market auctions with active bidding for test environments.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={seedMutation.isPending}
          className="h-9 rounded-xl border border-amber-400/30 bg-amber-500/20 text-xs font-semibold text-amber-600 dark:text-amber-200 hover:bg-amber-500/30 active:scale-95 transition-all shadow-xs"
        >
          {seedMutation.isPending ? "Seeding..." : "Seed Demo Auctions"}
        </Button>
      </FacetCard>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="border border-border bg-card text-card-foreground backdrop-blur-2xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <Gavel className="h-5 w-5 text-amber-500" />
              Seed Demo Card Auctions?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs">
              This will create test auctions in the card marketplace using sample cards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose onClick={() => setConfirmOpen(false)}>Cancel</AlertDialogClose>
            <Button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="bg-amber-500 font-semibold text-black hover:bg-amber-400 active:scale-95 transition-all"
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
    if (tab === "season") return "packs";
    if (tab === "bonuses") return "valuation";
    if (
      tab &&
      [
        "overview",
        "explorer",
        "import",
        "takedowns",
        "packs",
        "lore",
        "valuation",
      ].includes(tab)
    ) {
      return tab as AdminTab;
    }
    return "overview";
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
  const [fetchSeasons, setFetchSeasons] = useState("1-13");
  const [confirmStopJobId, setConfirmStopJobId] = useState<string | null>(null);
  const [takedownCardId, setTakedownCardId] = useState("");
  const [takedownSeason, setTakedownSeason] = useState("");

  const isSyncTabActive = activeTab === "import" || activeTab === "overview";

  const { data: healthStats, isLoading: loadingHealth, refetch: refetchHealth } =
    api.nsImport.getSyncHealth.useQuery(undefined, {
      enabled: isSyncTabActive,
      refetchInterval: refreshInterval ?? false,
    });

  const { data: rawLogsData, refetch: refetchLogs } =
    api.nsImport.getSyncLogs.useQuery(
      {
        limit: 50,
        syncTypeFilter: syncTypeFilter === "all" ? "all" : "region",
      },
      {
        enabled: isSyncTabActive,
        refetchInterval: refreshInterval ?? false,
      }
    );

  const { data: activeJobs, refetch: refetchActiveJobs } =
    api.nsImport.getActiveJobs.useQuery(undefined, {
      enabled: isSyncTabActive,
      refetchInterval: refreshInterval ?? false,
    });

  const { data: hiddenCards, refetch: refetchHiddenCards } =
    api.nsImport.listHiddenNSCards.useQuery(undefined, {
      enabled: activeTab === "takedowns",
    });

  const { data: libraryStats } = api.cards.getNSLibraryStats.useQuery();

  useVisibleRefetch(
    isSyncTabActive ? refreshInterval ?? 10000 : false
  );

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
    },
    onError: (err: { message: string }) => notify.error("Discovery Error", err.message),
  });

  const pauseJobMutation = api.nsImport.pauseRegionFetch.useMutation({
    onSuccess: () => {
      notify.info("Job Paused", "The sync job has been paused.");
      void refetchActiveJobs();
    },
    onError: (err: { message: string }) => notify.error("Pause Failed", err.message),
  });

  const resumeJobMutation = api.nsImport.resumeRegionFetch.useMutation({
    onSuccess: () => {
      notify.success("Job Resumed", "The sync job has resumed.");
      void refetchActiveJobs();
    },
    onError: (err: { message: string }) => notify.error("Resume Failed", err.message),
  });

  const stopJobMutation = api.nsImport.stopRegionFetch.useMutation({
    onSuccess: () => {
      notify.info("Job Stopped", "The sync job was stopped.");
      setConfirmStopJobId(null);
      void refetchActiveJobs();
      void refetchLogs();
    },
    onError: (err: { message: string }) => notify.error("Stop Failed", err.message),
  });

  const filterCTECardsMutation = api.nsImport.filterCTECards.useMutation({
    onSuccess: (data: { totalProcessed: number; cteCount: number; activeCount: number; message: string }) => {
      notify.success(
        "CTE Filter Complete",
        `Tagged ${data.cteCount} CTE cards out of ${data.totalProcessed} total cards.`
      );
    },
    onError: (err: { message: string }) => notify.error("CTE Filter Error", err.message),
  });

  const hideNSCardMutation = api.nsImport.hideNSCard.useMutation({
    onSuccess: () => {
      notify.success("Card Taken Down", "Card artwork cleared and marked as retired.");
      setTakedownCardId("");
      setTakedownSeason("");
      void refetchHiddenCards();
    },
    onError: (err: { message: string }) => notify.error("Takedown Failed", err.message),
  });

  const restoreNSCardMutation = api.nsImport.restoreNSCard.useMutation({
    onSuccess: () => {
      notify.success("Card Restored", "Card status set back to active.");
      void refetchHiddenCards();
    },
    onError: (err: { message: string }) => notify.error("Restore Failed", err.message),
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

  const syncLogEntries: LogEntry[] = (rawLogsData ?? []).map((log: {
    id: string;
    syncType: string;
    status: string;
    cardsProcessed: number;
    cardsCreated: number;
    cardsUpdated: number;
    errorMessage: string | null;
    startedAt: Date;
    completedAt: Date | null;
    duration: number | null;
  }) => {
    let level: LogLevel = "info";
    if (log.status === "FAILED") level = "error";
    else if (log.status === "PAUSED") level = "warn";

    const detailLines: string[] = [
      `Status: ${log.status}`,
      `Cards Processed: ${log.cardsProcessed ?? 0}`,
      `Cards Created: ${log.cardsCreated ?? 0}`,
      `Cards Updated: ${log.cardsUpdated ?? 0}`,
    ];
    if (log.duration) {
      detailLines.push(`Duration: ${formatDuration(log.duration)}`);
    }

    return {
      timestamp: log.completedAt ? new Date(log.completedAt).toISOString() : new Date(log.startedAt).toISOString(),
      message: `[${log.syncType}] — ${log.status} | Processed: ${log.cardsProcessed ?? 0} (Created: +${log.cardsCreated ?? 0}, Updated: +${log.cardsUpdated ?? 0})`,
      level,
    };
  });

  const handleRefreshAll = () => {
    void refetchHealth();
    void refetchLogs();
    void refetchActiveJobs();
  };

  return (
    <div className="bg-background text-foreground min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* ─── Facet Navigation Top Header ─────────────────────────── */}
        <FacetNavigation className="rounded-2xl border border-border bg-card/80 p-6 backdrop-blur-2xl shadow-xl space-y-6 text-card-foreground">
          {/* Header Title Row */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3.5 backdrop-blur-md shadow-sm">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-foreground tracking-tight text-2xl font-extrabold md:text-3xl">
                    Cards Administration
                  </h1>
                </div>
              </div>
            </div>
            {isSyncTabActive && (
              <div className="flex items-center gap-3">
                <select
                  value={refreshInterval ?? "off"}
                  onChange={(e) =>
                    setRefreshInterval(e.target.value === "off" ? null : parseInt(e.target.value, 10))
                  }
                  className="h-9 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground backdrop-blur-md transition-all hover:bg-accent focus:outline-none"
                >
                  <option value="off" className="bg-card text-card-foreground">Auto-refresh: Off</option>
                  <option value="5000" className="bg-card text-card-foreground">Every 5s</option>
                  <option value="10000" className="bg-card text-card-foreground">Every 10s</option>
                  <option value="30000" className="bg-card text-card-foreground">Every 30s</option>
                </select>
                <Button
                  onClick={handleRefreshAll}
                  disabled={loadingHealth}
                  className="h-9 rounded-xl border border-primary/30 bg-primary/20 text-xs font-semibold text-primary hover:bg-primary/30 active:scale-95 transition-all shadow-sm"
                >
                  <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingHealth ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            )}
          </div>

          {/* Embedded Library Overview Metrics & Proportion Bar */}
          {libraryStats && (() => {
            const activePct = libraryStats.totalCards > 0
              ? Math.round(((libraryStats.activeCardsCount ?? 0) / libraryStats.totalCards) * 100)
              : 0;
            const ctePct = libraryStats.totalCards > 0
              ? Math.round(((libraryStats.cteCardsCount ?? 0) / libraryStats.totalCards) * 100)
              : 0;

            return (
              <div className="space-y-2.5 pt-2 border-t border-border">
                {/* 4 Hero Stat Cards with Facet Physics */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Total Cards */}
                  <FacetCard depth={1} interactive="hover" className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-2 backdrop-blur-md transition-all">
                    <div className="text-muted-foreground text-[11px] font-medium flex items-center justify-between">
                      <span>Total NS Cards</span>
                      <Layers className="h-3 w-3 text-purple-500" />
                    </div>
                    <div className="text-base font-bold tracking-tight text-purple-600 dark:text-purple-300 mt-0.5">
                      {libraryStats.totalCards.toLocaleString()}
                    </div>
                    <div className="text-purple-600/80 dark:text-purple-300/60 text-[9px] font-medium">
                      Stored across all seasons
                    </div>
                  </FacetCard>

                  {/* Active Nation Cards */}
                  <FacetCard depth={1} interactive="hover" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 backdrop-blur-md transition-all">
                    <div className="text-muted-foreground text-[11px] font-medium flex items-center justify-between">
                      <span>Active Nation Cards</span>
                      <CheckCircle className="h-3 w-3 text-emerald-500" />
                    </div>
                    <div className="text-base font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {(libraryStats.activeCardsCount ?? 0).toLocaleString()}
                    </div>
                    <div className="text-emerald-600/80 dark:text-emerald-300/70 text-[9px] font-medium">
                      {activePct}% of total cards
                    </div>
                  </FacetCard>

                  {/* CTE Defunct Cards */}
                  <FacetCard depth={1} interactive="hover" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 backdrop-blur-md transition-all">
                    <div className="text-muted-foreground text-[11px] font-medium flex items-center justify-between">
                      <span>Defunct (CTE) Cards</span>
                      <AlertTriangle className="h-3 w-3 text-rose-500" />
                    </div>
                    <div className="text-base font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-0.5">
                      {(libraryStats.cteCardsCount ?? 0).toLocaleString()}
                    </div>
                    <div className="text-rose-600/80 dark:text-rose-300/70 text-[9px] font-medium">
                      {ctePct}% of total cards
                    </div>
                  </FacetCard>

                  {/* Last Sync */}
                  <FacetCard depth={1} interactive="hover" className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 backdrop-blur-md transition-all">
                    <div className="text-muted-foreground text-[11px] font-medium flex items-center justify-between">
                      <span>Last Operations Sync</span>
                      <Globe className="h-3 w-3 text-blue-500" />
                    </div>
                    <div className="text-foreground text-xs font-semibold mt-0.5 truncate">
                      {libraryStats.lastSync
                        ? new Date(libraryStats.lastSync.at).toLocaleString()
                        : "Never"}
                    </div>
                    {libraryStats.lastSync && (
                      <span
                        className={`inline-block rounded-full px-1.5 py-0.2 text-[8px] font-bold ${getStatusColor(libraryStats.lastSync.status)}`}
                      >
                        {libraryStats.lastSync.status} ({libraryStats.lastSync.type})
                      </span>
                    )}
                  </FacetCard>
                </div>

                {/* Proportion Distribution Bar */}
                {libraryStats.totalCards > 0 && (
                  <FacetContainer depth={1} enableRefraction={true} className="rounded-xl border border-border bg-card/60 px-3 py-2 backdrop-blur-md space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="h-3 w-3" />
                        Active Nation Cards ({libraryStats.activeCardsCount?.toLocaleString() ?? 0} cards — {activePct}%)
                      </span>
                      <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                        <AlertTriangle className="h-3 w-3" />
                        Defunct (CTE) Cards ({libraryStats.cteCardsCount?.toLocaleString() ?? 0} cards — {ctePct}%)
                      </span>
                    </div>

                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted flex p-0.5 gap-0.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 shadow-xs"
                        style={{ width: `${activePct}%` }}
                      />
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-500 shadow-xs"
                        style={{ width: `${ctePct}%` }}
                      />
                    </div>
                  </FacetContainer>
                )}
              </div>
            );
          })()}

          {/* Facet Segmented Tab Control Container */}
          <FacetContainer depth={2} enableRefraction={true} className="bg-card/60 p-1.5 rounded-2xl border border-border backdrop-blur-xl flex flex-wrap gap-1">
            {[
              { id: "overview" as AdminTab, label: "Overview", icon: Layers },
              { id: "explorer" as AdminTab, label: "Card Explorer", icon: Search },
              { id: "import" as AdminTab, label: "Card Fetching", icon: Globe },
              { id: "commons" as AdminTab, label: "Commons Flag Importer", icon: Globe },
              { id: "takedowns" as AdminTab, label: "Takedowns & Compliance", icon: ShieldAlert },
              { id: "packs" as AdminTab, label: "Card Packs & Seasons", icon: Package },
              { id: "lore" as AdminTab, label: "Lore Generator", icon: BookOpen },
              { id: "valuation" as AdminTab, label: "Valuation & Bonuses", icon: Coins },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200 active:scale-95 ${
                    isActive
                      ? "bg-primary/15 border border-primary/40 text-foreground shadow-sm scale-[1.02]"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  {tab.label}
                </button>
              );
            })}
          </FacetContainer>
        </FacetNavigation>

        {/* ─── TAB: OVERVIEW & LIBRARY STATISTICS ──────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Operations Log & Audit Trail Card inside Overview */}
            <FacetCard depth={2} className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-xl shadow-xl space-y-4 text-card-foreground">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl border border-primary/30 bg-primary/20 p-2 backdrop-blur-md">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-foreground tracking-tight text-lg font-bold">
                      Operations Log & Audit Trail
                    </h2>
                    <p className="text-muted-foreground text-xs font-medium">
                      Live database sync logs and operation tracebacks
                    </p>
                  </div>
                </div>
                <select
                  value={syncTypeFilter}
                  onChange={(e) => setSyncTypeFilter(e.target.value as typeof syncTypeFilter)}
                  className="h-8 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground transition-all hover:bg-accent focus:outline-none"
                >
                  <option value="all" className="bg-card text-card-foreground">All Operations</option>
                  <option value="region" className="bg-card text-card-foreground">Region Fetches</option>
                </select>
              </div>

              <LogViewerFilterable
                entries={syncLogEntries}
                title="Card Sync Operations & Execution Trail"
                maxHeight={450}
                className="border border-border bg-card/40 backdrop-blur-md"
              />
            </FacetCard>
          </div>
        )}

        {/* ─── TAB: CARD EXPLORER ──────────────────────────────────── */}
        {activeTab === "explorer" && <AdminCardExplorer />}

        {/* ─── TAB: COMMONS FLAG IMPORTER ──────────────────────────── */}
        {activeTab === "commons" && <CommonsFlagImporterAdmin />}

        {/* ─── TAB: CARD FETCHING & IMPORTS ────────────────────────── */}
        {activeTab === "import" && (
          <div className="space-y-6">
            {/* Overall Sync Health Metrics Grid with Facet Depth */}
            {healthStats && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <FacetCard depth={1} interactive="hover" className="rounded-2xl border border-border bg-card/70 p-4 backdrop-blur-xl shadow-sm">
                  <div className="mb-1 flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-500" />
                    <div className="text-muted-foreground text-xs font-medium">Total Syncs</div>
                  </div>
                  <div className="text-foreground font-mono text-2xl font-bold">
                    {healthStats.overall.totalSyncs}
                  </div>
                  <div className="text-muted-foreground mt-0.5 truncate font-mono text-[10px]">
                    {healthStats.overall.lastSyncAt
                      ? new Date(healthStats.overall.lastSyncAt).toLocaleString()
                      : "Never"}
                  </div>
                </FacetCard>

                <FacetCard depth={1} interactive="hover" className="rounded-2xl border border-border bg-card/70 p-4 backdrop-blur-xl shadow-sm">
                  <div className="mb-1 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <div className="text-muted-foreground text-xs font-medium">Success Rate</div>
                  </div>
                  <div className="font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {(healthStats.overall.successRate * 100).toFixed(1)}%
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-[10px]">
                    {healthStats.overall.successfulSyncs} successful
                  </div>
                </FacetCard>

                <FacetCard depth={1} interactive="hover" className="rounded-2xl border border-border bg-card/70 p-4 backdrop-blur-xl shadow-sm">
                  <div className="mb-1 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-500" />
                    <div className="text-muted-foreground text-xs font-medium">Error Rate</div>
                  </div>
                  <div
                    className={`font-mono text-2xl font-bold ${healthStats.overall.errorRate > 0.1 ? "text-rose-500" : "text-foreground"}`}
                  >
                    {(healthStats.overall.errorRate * 100).toFixed(1)}%
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-[10px]">
                    {healthStats.overall.failedSyncs} failed
                  </div>
                </FacetCard>

                <FacetCard depth={1} interactive="hover" className="rounded-2xl border border-border bg-card/70 p-4 backdrop-blur-xl shadow-sm">
                  <div className="mb-1 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-purple-500" />
                    <div className="text-muted-foreground text-xs font-medium">Avg Cards/Sync</div>
                  </div>
                  <div className="font-mono text-2xl font-bold text-purple-600 dark:text-purple-300">
                    {healthStats.overall.avgCardsProcessed.toFixed(0)}
                  </div>
                  <div className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                    per sync operation
                  </div>
                </FacetCard>
              </div>
            )}

            {/* Active & Paused Background Sync Jobs */}
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

            {/* Bulk Region Import & Discovery Grid */}
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

            {/* Filter CTE Nations Section */}
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
                size="sm"
                variant="outline"
                disabled={filterCTECardsMutation.isPending}
                onClick={() => filterCTECardsMutation.mutate()}
                className="h-9 rounded-xl border border-amber-500/30 bg-amber-500/20 text-xs font-semibold text-amber-600 dark:text-amber-200 hover:bg-amber-500/30 active:scale-95 transition-all shadow-xs"
              >
                {filterCTECardsMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Tagging CTE Nations...
                  </>
                ) : (
                  "Run CTE Nation Filter"
                )}
              </Button>
            </FacetCard>
          </div>
        )}

        {/* ─── TAB: TAKEDOWNS & COMPLIANCE ─────────────────────────── */}
        {activeTab === "takedowns" && (
          <div className="space-y-6">
            <FacetCard depth={2} className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 backdrop-blur-xl shadow-xl space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl border border-rose-400/30 bg-rose-500/20 p-2 backdrop-blur-md">
                  <ShieldAlert className="h-5 w-5 text-rose-500" />
                </div>
                <div>
                  <h3 className="text-foreground tracking-tight text-lg font-bold">
                    NS Card Takedown & Compliance Management
                  </h3>
                  <p className="text-muted-foreground text-xs font-medium">
                    Hide cards for flag-owner copyright requests and legal compliance
                  </p>
                </div>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed max-w-3xl">
                If a nation&apos;s flag owner requests artwork removal, hide the card by NS card ID and season.
                The card artwork is cleared and retired so subsequent daily dumps or region fetches will not restore it.
              </p>

              {/* Takedown Input Form */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <input
                  value={takedownCardId}
                  onChange={(e) => setTakedownCardId(e.target.value.replace(/\D/g, ""))}
                  placeholder="NS Card ID"
                  inputMode="numeric"
                  className="h-9 w-36 rounded-xl border border-border bg-card px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all outline-none"
                />
                <input
                  value={takedownSeason}
                  onChange={(e) => setTakedownSeason(e.target.value.replace(/\D/g, ""))}
                  placeholder="Season"
                  inputMode="numeric"
                  className="h-9 w-24 rounded-xl border border-border bg-card px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all outline-none"
                />
                <Button
                  size="sm"
                  disabled={
                    hideNSCardMutation.isPending || !takedownCardId || !takedownSeason
                  }
                  onClick={() =>
                    hideNSCardMutation.mutate({
                      nsCardId: parseInt(takedownCardId, 10),
                      nsSeason: parseInt(takedownSeason, 10),
                    })
                  }
                  className="h-9 rounded-xl border border-rose-500/30 bg-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-200 hover:bg-rose-500/30 active:scale-95 transition-all shadow-xs"
                >
                  Hide Card
                </Button>
              </div>

              {/* List of Hidden Cards */}
              {hiddenCards && hiddenCards.length > 0 && (
                <div className="pt-4 border-t border-border space-y-3">
                  <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                    Taken Down Cards ({hiddenCards.length})
                  </div>
                  <div className="space-y-2">
                    {hiddenCards.map((card: any) => (
                      <FacetCard
                        key={card.cardId}
                        depth={1}
                        interactive="hover"
                        className="rounded-xl border border-border bg-card/60 p-3 backdrop-blur-md flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 truncate">
                          <span className="text-foreground font-semibold">
                            {card.title || `#${card.nsCardId}`}
                          </span>
                          <span className="text-muted-foreground ml-2 font-mono">
                            NS ID: {card.nsCardId} S{card.nsSeason}
                          </span>
                          {card.selfService && (
                            <span className="ml-2 rounded-full bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-300">
                              flag-owner request
                            </span>
                          )}
                          {card.reason && (
                            <span className="text-muted-foreground ml-2 truncate">
                              — {card.reason}
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-muted-foreground text-[11px] font-mono">
                            {card.retiredAt ? new Date(card.retiredAt).toLocaleDateString() : ""}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={restoreNSCardMutation.isPending}
                            onClick={() =>
                              restoreNSCardMutation.mutate({
                                nsCardId: card.nsCardId ?? 0,
                                nsSeason: card.nsSeason ?? 0,
                              })
                            }
                            className="h-7 rounded-lg border-emerald-500/30 bg-emerald-500/10 text-[11px] font-medium text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20 active:scale-95 transition-all"
                          >
                            Restore
                          </Button>
                        </div>
                      </FacetCard>
                    ))}
                  </div>
                </div>
              )}
            </FacetCard>
          </div>
        )}

        {/* ─── TAB: CARD PACKS & SEASONS ────────────────────────────── */}
        {activeTab === "packs" && (
          <div className="space-y-6">
            <SeedDemoAuctionsButton />
            <CardPacksAdmin />
            <IxCardSeasonAdmin />
          </div>
        )}

        {/* ─── TAB: LORE GENERATOR ─────────────────────────────────── */}
        {activeTab === "lore" && <LoreCardBatchAdmin />}

        {/* ─── TAB: VALUATION & BONUSES ─────────────────────────────── */}
        {activeTab === "valuation" && (
          <div className="space-y-6">
            <ValuationAdmin />
            <BonusAdmin />
          </div>
        )}
      </div>

      {/* Confirmation Dialog: Region Fetch */}
      <AlertDialog
        open={confirmFetchRegions !== null}
        onOpenChange={(open) => !open && setConfirmFetchRegions(null)}
      >
        <AlertDialogContent className="border border-border bg-card text-card-foreground backdrop-blur-2xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <Globe className="h-5 w-5 text-emerald-500" />
              Start Region Card Fetch?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs leading-relaxed space-y-2">
              <p>
                Fetch all cards for region(s):{" "}
                <strong className="text-emerald-500 font-mono">{confirmFetchRegions}</strong>
              </p>
              <div className="mt-3">
                <label className="text-foreground text-xs font-semibold block mb-1">
                  Seasons (e.g. "1-13" or "1,3,5")
                </label>
                <input
                  value={fetchSeasons}
                  onChange={(e) => setFetchSeasons(e.target.value)}
                  className="h-9 w-full rounded-xl border border-border bg-card px-3 font-mono text-xs text-foreground focus:border-emerald-500 outline-none"
                  placeholder="1-13"
                />
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
              className="bg-emerald-500 text-black font-semibold hover:bg-emerald-400 active:scale-95 transition-all"
            >
              {fetchRegionMutation.isPending ? "Starting..." : "Start Fetch"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Stop Job */}
      <AlertDialog
        open={confirmStopJobId !== null}
        onOpenChange={(open) => !open && setConfirmStopJobId(null)}
      >
        <AlertDialogContent className="border border-border bg-card text-card-foreground backdrop-blur-2xl shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              Stop Import Job?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-xs">
              This will abort the background import job. Any progress made so far will be saved.
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
              className="bg-rose-500 text-white font-semibold hover:bg-rose-600 active:scale-95 transition-all"
            >
              {stopJobMutation.isPending ? "Stopping..." : "Stop Job"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
