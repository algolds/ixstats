"use client";
// src/app/admin/cards/CardsPanel.tsx
// Unified Theme-Compliant Card Administration Dashboard - Overview, Explorer, Imports, Takedowns, Operations Log, Packs, Lore & Seasons

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Database,
  CheckCircle,
  StatUp as TrendingUp,
  WarningTriangle as AlertTriangle,
  Globe,
  Component as Layers,
  Search,
  OpenBook as BookOpen,
  ControlSlider as Sliders,
  Page as FileText,
  Sparks as Sparkles,
  Palette,
  Refresh as RefreshCw,
} from "iconoir-react";

import { api } from "~/trpc/react";
import { LogViewerFilterable, type LogEntry, type LogLevel } from "~/components/ui/log-viewer";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import { useVisibleRefetch } from "~/hooks/useVisibleRefetch";
import { LoreCategory } from "~/lib/cards/category-enums";
import { FacetContainer, FacetCard, FacetNavigation } from "~/components/ui/facet-container";
import { AdminHeader } from "../_components/AdminHeader";
import { AdminCardExplorer } from "./AdminCardExplorer";
import { CardImportStudio, type ImportSubtab } from "./CardImportStudio";
import { CardSettingsAdmin, type SettingsSubtab } from "./CardSettingsAdmin";
import { CardDesignerStudio } from "~/components/cards/designer";

type AdminTab = "overview" | "designer" | "explorer" | "imports" | "settings";

export default function CardAdminDashboardPage() {
  const _notify = useNotify();
  const searchParams = useSearchParams();

  const [importSubtab, setImportSubtab] = useState<ImportSubtab>(() => {
    const tab = searchParams.get("tab");
    const sub = searchParams.get("subtab");
    if (sub === "wiki" || sub === "lore" || tab === "lore") return "wiki";
    if (sub === "ns" || sub === "nationstates" || tab === "import") return "ns";
    if (sub === "flags" || sub === "commons" || tab === "commons") return "flags";
    return "wiki";
  });

  const [settingsSubtab, setSettingsSubtab] = useState<SettingsSubtab>(() => {
    const sub = searchParams.get("subtab");
    if (sub && ["general", "packs", "seasons", "valuation", "takedowns"].includes(sub)) {
      return sub as SettingsSubtab;
    }
    return "general";
  });

  const [activeTab, setActiveTabState] = useState<AdminTab>(() => {
    const tab = searchParams.get("tab");
    if (tab === "designer") return "designer";
    if (tab === "explorer" || tab === "library") return "explorer";
    if (tab === "imports" || tab === "import" || tab === "lore" || tab === "commons")
      return "imports";
    if (
      tab === "settings" ||
      tab === "market" ||
      tab === "takedowns" ||
      tab === "packs" ||
      tab === "rarity"
    )
      return "settings";
    return "overview";
  });

  const setActiveTab = (tab: AdminTab, subtab?: string) => {
    setActiveTabState(tab);
    if (tab === "imports" && subtab) setImportSubtab(subtab as ImportSubtab);
    if (tab === "settings" && subtab) setSettingsSubtab(subtab as SettingsSubtab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    if (tab === "imports") {
      url.searchParams.set("subtab", subtab || importSubtab);
    } else if (tab === "settings") {
      url.searchParams.set("subtab", subtab || settingsSubtab);
    } else {
      url.searchParams.delete("subtab");
    }
    window.history.pushState({}, "", url.toString());
  };

  const [refreshInterval, _setRefreshInterval] = useState<number | null>(10000);
  const [logCategoryFilter, setLogCategoryFilter] = useState<
    "all" | "imports" | "designer" | "lore_batch" | "explorer" | "settings" | "duplicates" | "admin"
  >("all");

  const isSyncTabActive = activeTab === "overview";

  const { data: healthStats } = api.nsImport.getSyncHealth.useQuery(undefined, {
    enabled: isSyncTabActive,
    refetchInterval: refreshInterval ?? false,
  });

  const { data: unifiedLogsData, refetch: refetchUnifiedLogs } =
    api.cards.getUnifiedAuditLogs.useQuery(
      {
        category: logCategoryFilter,
        limit: 200,
      },
      {
        enabled: isSyncTabActive,
        refetchInterval: refreshInterval ?? false,
      }
    );

  const { data: _libraryStats } = api.cards.getNSLibraryStats.useQuery();
  const { data: loreStats } = api.cards.getLoreStats.useQuery();
  const [selectedExplorerCategory, _setSelectedExplorerCategory] = useState<LoreCategory | "all">(
    "all"
  );

  useVisibleRefetch(isSyncTabActive ? (refreshInterval ?? 10000) : false);

  const operationsLogEntries: LogEntry[] = useMemo(() => {
    if (!unifiedLogsData?.logs) return [];
    return unifiedLogsData.logs.map((log) => {
      const level: LogLevel = (log.level as LogLevel) || "info";
      const actorStr = log.actor ? ` [by ${log.actor.slice(0, 12)}]` : "";
      const targetStr = log.target ? ` [target: ${log.target}]` : "";
      return {
        timestamp: log.timestamp,
        message: `${log.title} — ${log.message}${actorStr}${targetStr}`,
        level,
      };
    });
  }, [unifiedLogsData?.logs]);

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Database}
        title="Cards Administration"
        description="Comprehensive card administration suite — overview metrics, real-time library explorer, NationStates & wiki batch pipelines, card designer, and economic policies."
      />

      <div className="space-y-6">
        {/* ─── Facet Navigation Top Header ─────────────────────────── */}
        <FacetNavigation className="border-border/30 bg-card/25 text-card-foreground space-y-6 rounded-2xl border p-6 shadow-sm backdrop-blur-md">
          {/* Embedded Library Overview / NS Sync Health Metrics (Switches dynamically per active tab) */}
          {(() => {
            const isNSTab = activeTab === "imports" && importSubtab === "ns";

            if (isNSTab) {
              return (
                <div className="border-border space-y-2.5 border-t pt-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Total Sync Operations */}
                    <FacetCard
                      depth={1}
                      interactive="hover"
                      className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 backdrop-blur-md transition-all"
                    >
                      <div className="text-muted-foreground flex items-center justify-between text-[11px] font-medium">
                        <span>Total Sync Operations</span>
                        <Database className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <div className="mt-0.5 font-mono text-base font-bold tracking-tight text-blue-600 dark:text-blue-300">
                        {(healthStats?.overall.totalSyncs ?? 0).toLocaleString()}
                      </div>
                      <div className="truncate font-mono text-[9px] font-medium text-blue-600/80 dark:text-blue-300/60">
                        {healthStats?.overall.lastSyncAt
                          ? `Last: ${new Date(healthStats.overall.lastSyncAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}`
                          : "Never run"}
                      </div>
                    </FacetCard>

                    {/* Success Rate */}
                    <FacetCard
                      depth={1}
                      interactive="hover"
                      className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 backdrop-blur-md transition-all"
                    >
                      <div className="text-muted-foreground flex items-center justify-between text-[11px] font-medium">
                        <span>Success Rate</span>
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                      </div>
                      <div className="mt-0.5 font-mono text-base font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                        {((healthStats?.overall.successRate ?? 0) * 100).toFixed(1)}%
                      </div>
                      <div className="text-[9px] font-medium text-emerald-600/80 dark:text-emerald-300/70">
                        {(healthStats?.overall.successfulSyncs ?? 0).toLocaleString()} successful
                        operations
                      </div>
                    </FacetCard>

                    {/* Failure / Error Rate */}
                    <FacetCard
                      depth={1}
                      interactive="hover"
                      className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 backdrop-blur-md transition-all"
                    >
                      <div className="text-muted-foreground flex items-center justify-between text-[11px] font-medium">
                        <span>Failure Rate</span>
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                      </div>
                      <div className="mt-0.5 font-mono text-base font-bold tracking-tight text-rose-600 dark:text-rose-400">
                        {((healthStats?.overall.errorRate ?? 0) * 100).toFixed(1)}%
                      </div>
                      <div className="text-[9px] font-medium text-rose-600/80 dark:text-rose-400/70">
                        {(healthStats?.overall.failedSyncs ?? 0).toLocaleString()} failed operations
                      </div>
                    </FacetCard>

                    {/* Avg Cards / Sync */}
                    <FacetCard
                      depth={1}
                      interactive="hover"
                      className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-2 backdrop-blur-md transition-all"
                    >
                      <div className="text-muted-foreground flex items-center justify-between text-[11px] font-medium">
                        <span>Avg Cards / Sync</span>
                        <CheckCircle className="h-3.5 w-3.5 text-purple-500" />
                      </div>
                      <div className="mt-0.5 font-mono text-base font-bold tracking-tight text-purple-600 dark:text-purple-300">
                        {(healthStats?.overall.avgCardsProcessed ?? 0).toFixed(0)}
                      </div>
                      <div className="text-[9px] font-medium text-purple-600/80 dark:text-purple-300/70">
                        Average throughput per batch
                      </div>
                    </FacetCard>
                  </div>
                </div>
              );
            }

            return (
              <div className="border-border space-y-2.5 border-t pt-2">
                {/* 4 Hero Stat Cards */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Active Cards */}
                  <FacetCard
                    depth={1}
                    interactive="hover"
                    className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 backdrop-blur-md transition-all"
                  >
                    <div className="text-muted-foreground flex items-center justify-between text-[11px] font-medium">
                      <span>Active Cards</span>
                      <BookOpen className="h-3.5 w-3.5 text-amber-500" />
                    </div>
                    <div className="mt-0.5 text-base font-bold tracking-tight text-amber-600 dark:text-amber-300">
                      {(loreStats?.totalLoreCards ?? 0).toLocaleString()}
                    </div>
                    <div className="text-[9px] font-medium text-amber-600/80 dark:text-amber-300/60">
                      Cards in circulation
                    </div>
                  </FacetCard>

                  {/* Active Categories */}
                  <FacetCard
                    depth={1}
                    interactive="hover"
                    className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 backdrop-blur-md transition-all"
                  >
                    <div className="text-muted-foreground flex items-center justify-between text-[11px] font-medium">
                      <span>Lore Categories</span>
                      <Layers className="h-3.5 w-3.5 text-cyan-500" />
                    </div>
                    <div className="mt-0.5 text-base font-bold tracking-tight text-cyan-600 dark:text-cyan-300">
                      {Object.keys(loreStats?.categoryBreakdown ?? {}).length} / 13
                    </div>
                    <div className="text-[9px] font-medium text-cyan-600/80 dark:text-cyan-300/70">
                      Super-categories in active circulation
                    </div>
                  </FacetCard>

                  {/* Pending Requests */}
                  <FacetCard
                    depth={1}
                    interactive="hover"
                    className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-2 backdrop-blur-md transition-all"
                  >
                    <div className="text-muted-foreground flex items-center justify-between text-[11px] font-medium">
                      <span>Pending Requests</span>
                      <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                    </div>
                    <div className="mt-0.5 text-base font-bold tracking-tight text-purple-600 dark:text-purple-300">
                      {(loreStats?.pendingRequests ?? 0).toLocaleString()}
                    </div>
                    <div className="text-[9px] font-medium text-purple-600/80 dark:text-purple-300/70">
                      User requests awaiting approval
                    </div>
                  </FacetCard>

                  {/* NS Cards */}
                  <FacetCard
                    depth={1}
                    interactive="hover"
                    className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 backdrop-blur-md transition-all"
                  >
                    <div className="text-muted-foreground flex items-center justify-between text-[11px] font-medium">
                      <span>NS Cards</span>
                      <Globe className="h-3.5 w-3.5 text-blue-500" />
                    </div>
                    <div className="mt-0.5 text-base font-bold tracking-tight text-blue-600 dark:text-blue-300">
                      {(loreStats?.totalNSCards ?? 0).toLocaleString()}
                    </div>
                    <div className="text-[9px] font-medium text-blue-600/80 dark:text-blue-300/70">
                      NationStates imports
                    </div>
                  </FacetCard>
                </div>
              </div>
            );
          })()}

          {/* Facet Segmented Tab Control Container */}
          <FacetContainer
            depth={2}
            enableRefraction={true}
            className="bg-card/60 border-border flex flex-wrap gap-1 rounded-2xl border p-1.5 backdrop-blur-xl"
          >
            {[
              { id: "overview" as AdminTab, label: "Overview", icon: Layers },
              { id: "designer" as AdminTab, label: "Card Designer", icon: Palette },
              { id: "explorer" as AdminTab, label: "Card Explorer", icon: Search },
              { id: "imports" as AdminTab, label: "Import Studio", icon: Globe },
              { id: "settings" as AdminTab, label: "Settings", icon: Sliders },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200 active:scale-95 ${
                    isActive
                      ? "bg-primary/15 border-primary/40 text-foreground scale-[1.02] border shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                  />
                  {tab.label}
                </button>
              );
            })}
          </FacetContainer>
        </FacetNavigation>

        {/* ─── TAB: 3D CARD DESIGNER STUDIO ─────────────────────── */}
        {activeTab === "designer" && <CardDesignerStudio />}

        {/* ─── TAB: OVERVIEW & LIBRARY STATISTICS ──────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Operations Log & Audit Trail Card inside Overview */}
            <FacetCard
              depth={2}
              className="border-border bg-card text-card-foreground space-y-4 rounded-2xl border p-6 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="border-primary/20 bg-primary/10 text-primary rounded-xl border p-2">
                    <FileText className="text-primary h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-foreground text-lg font-bold tracking-tight">
                      Operations Log & Audit Trail
                    </h2>
                    <p className="text-muted-foreground text-xs font-medium">
                      All admin actions, designer mints, import syncs, batch generations, takedowns,
                      and system operations
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={logCategoryFilter}
                    onChange={(e) => setLogCategoryFilter(e.target.value as any)}
                    className="border-border/40 bg-background text-foreground hover:bg-muted/50 h-9 rounded-xl border px-3 text-xs font-semibold transition-all focus:outline-none"
                  >
                    <option value="all" className="bg-background text-foreground">
                      All Logs ({unifiedLogsData?.stats.all ?? 0})
                    </option>
                    <option value="imports" className="bg-background text-foreground">
                      Imports & Syncs ({unifiedLogsData?.stats.imports ?? 0})
                    </option>
                    <option value="designer" className="bg-background text-foreground">
                      Card Designer ({unifiedLogsData?.stats.designer ?? 0})
                    </option>
                    <option value="lore_batch" className="bg-background text-foreground">
                      Lore Batch Studio ({unifiedLogsData?.stats.lore_batch ?? 0})
                    </option>
                    <option value="explorer" className="bg-background text-foreground">
                      Card Explorer & Takedowns ({unifiedLogsData?.stats.explorer ?? 0})
                    </option>
                    <option value="settings" className="bg-background text-foreground">
                      Settings & Valuations ({unifiedLogsData?.stats.settings ?? 0})
                    </option>
                    <option value="duplicates" className="bg-background text-foreground">
                      Duplicate Purges ({unifiedLogsData?.stats.duplicates ?? 0})
                    </option>
                    <option value="admin" className="bg-background text-foreground">
                      Admin Audit Trail ({unifiedLogsData?.stats.admin ?? 0})
                    </option>
                  </select>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void refetchUnifiedLogs()}
                    className="border-border/40 h-9 rounded-xl border text-xs shadow-xs transition-all active:scale-[0.98]"
                  >
                    <RefreshCw className="mr-1.5 h-3 w-3" /> Refresh
                  </Button>
                </div>
              </div>

              {/* Quick Filter Pill Badges */}
              {unifiedLogsData?.stats && (
                <div className="flex flex-wrap gap-1.5 pt-1 text-[11px]">
                  {[
                    {
                      id: "all",
                      label: "All",
                      count: unifiedLogsData.stats.all,
                      color: "text-foreground bg-muted",
                    },
                    {
                      id: "imports",
                      label: "Imports & Syncs",
                      count: unifiedLogsData.stats.imports,
                      color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
                    },
                    {
                      id: "designer",
                      label: "Card Designer",
                      count: unifiedLogsData.stats.designer,
                      color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
                    },
                    {
                      id: "lore_batch",
                      label: "Lore Batch",
                      count: unifiedLogsData.stats.lore_batch,
                      color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
                    },
                    {
                      id: "explorer",
                      label: "Explorer & Actions",
                      count: unifiedLogsData.stats.explorer,
                      color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
                    },
                    {
                      id: "settings",
                      label: "Settings",
                      count: unifiedLogsData.stats.settings,
                      color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
                    },
                    {
                      id: "duplicates",
                      label: "Purges",
                      count: unifiedLogsData.stats.duplicates,
                      color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
                    },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setLogCategoryFilter(item.id as any)}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 font-medium transition-all ${
                        logCategoryFilter === item.id
                          ? "border-primary bg-primary text-primary-foreground font-bold shadow-xs"
                          : `${item.color} hover:opacity-80`
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className="font-mono text-[10px] opacity-80">({item.count})</span>
                    </button>
                  ))}
                </div>
              )}

              <LogViewerFilterable
                entries={operationsLogEntries}
                title="Unified Cards Audit Trail & Operations Stream"
                maxHeight={460}
                className="border-border bg-card/40 border"
              />
            </FacetCard>
          </div>
        )}

        {/* ─── TAB: CARD EXPLORER ──────────────────────────────────── */}
        {activeTab === "explorer" && (
          <AdminCardExplorer initialCategory={selectedExplorerCategory} />
        )}

        {/* ─── TAB: UNIFIED IMPORT STUDIO ─────────────────────────── */}
        {activeTab === "imports" && (
          <CardImportStudio
            initialSubtab={importSubtab}
            onSubtabChange={(sub) => setActiveTab("imports", sub)}
          />
        )}

        {/* ─── TAB: UNIFIED SETTINGS STUDIO ───────────────────────── */}
        {activeTab === "settings" && (
          <CardSettingsAdmin
            initialSubtab={settingsSubtab}
            onSubtabChange={(sub) => setActiveTab("settings", sub)}
          />
        )}
      </div>
    </div>
  );
}
