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
import { LogViewerFilterable, type LogEntry, type LogLevel } from "~/components/admin/log-viewer";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import { useVisibleRefetch } from "~/hooks/useVisibleRefetch";
import { LoreCategory } from "~/lib/cards/category-enums";
import { Stat } from "~/components/ui/stat";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { AdminHeader } from "../_components/AdminHeader";
import { AdminCardExplorer } from "./AdminCardExplorer";
import { CardImportStudio, type ImportSubtab } from "./CardImportStudio";
import { CardSettingsAdmin, type SettingsSubtab } from "./CardSettingsAdmin";
import { CardDesignerStudio } from "~/components/cards/designer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Card } from "~/components/ui/card";

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
        <Card padding="lg" className="space-y-6">
          {/* Embedded Library Overview / NS Sync Health Metrics (Switches dynamically per active tab) */}
          {(() => {
            const isNSTab = activeTab === "imports" && importSubtab === "ns";

            if (isNSTab) {
              return (
                <div className="border-separator space-y-2 border-t pt-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Total Sync Operations */}
                    <Card padding="sm">
                      <Stat
                        size="sm"
                        label="Total Sync Operations"
                        icon={<Database className="text-blue" />}
                        iconPlacement="trailing"
                        value={<>{(healthStats?.overall.totalSyncs ?? 0).toLocaleString()}</>}
                        hint={
                          <>
                            {healthStats?.overall.lastSyncAt
                              ? `Last: ${new Date(healthStats.overall.lastSyncAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}`
                              : "Never run"}
                          </>
                        }
                      />
                    </Card>

                    {/* Success Rate */}
                    <Card padding="sm">
                      <Stat
                        size="sm"
                        label="Success Rate"
                        icon={<TrendingUp className="text-green" />}
                        iconPlacement="trailing"
                        value={<>{((healthStats?.overall.successRate ?? 0) * 100).toFixed(1)}%</>}
                        hint={
                          <>
                            {(healthStats?.overall.successfulSyncs ?? 0).toLocaleString()}{" "}
                            successful operations
                          </>
                        }
                      />
                    </Card>

                    {/* Failure / Error Rate */}
                    <Card padding="sm">
                      <Stat
                        size="sm"
                        label="Failure Rate"
                        icon={<AlertTriangle className="text-red" />}
                        iconPlacement="trailing"
                        value={<>{((healthStats?.overall.errorRate ?? 0) * 100).toFixed(1)}%</>}
                        hint={
                          <>
                            {(healthStats?.overall.failedSyncs ?? 0).toLocaleString()} failed
                            operations
                          </>
                        }
                      />
                    </Card>

                    {/* Avg Cards / Sync */}
                    <Card padding="sm">
                      <Stat
                        size="sm"
                        label="Avg Cards / Sync"
                        icon={<CheckCircle className="text-purple" />}
                        iconPlacement="trailing"
                        value={<>{(healthStats?.overall.avgCardsProcessed ?? 0).toFixed(0)}</>}
                        hint={<>Average throughput per batch</>}
                      />
                    </Card>
                  </div>
                </div>
              );
            }

            return (
              <div className="border-separator space-y-2 border-t pt-2">
                {/* 4 Hero Stat Cards */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Active Cards */}
                  <Card padding="sm">
                    <Stat
                      size="sm"
                      label="Active Cards"
                      icon={<BookOpen className="text-yellow" />}
                      iconPlacement="trailing"
                      value={<>{(loreStats?.totalLoreCards ?? 0).toLocaleString()}</>}
                      hint={<>Cards in circulation</>}
                    />
                  </Card>

                  {/* Active Categories */}
                  <Card padding="sm">
                    <Stat
                      size="sm"
                      label="Lore Categories"
                      icon={<Layers className="text-teal" />}
                      iconPlacement="trailing"
                      value={<>{Object.keys(loreStats?.categoryBreakdown ?? {}).length} / 13</>}
                      hint={<>Super-categories in active circulation</>}
                    />
                  </Card>

                  {/* Pending Requests */}
                  <Card padding="sm">
                    <Stat
                      size="sm"
                      label="Pending Requests"
                      icon={<Sparkles className="text-purple" />}
                      iconPlacement="trailing"
                      value={<>{(loreStats?.pendingRequests ?? 0).toLocaleString()}</>}
                      hint={<>User requests awaiting approval</>}
                    />
                  </Card>

                  {/* NS Cards */}
                  <Card padding="sm">
                    <Stat
                      size="sm"
                      label="NS Cards"
                      icon={<Globe className="text-blue" />}
                      iconPlacement="trailing"
                      value={<>{(loreStats?.totalNSCards ?? 0).toLocaleString()}</>}
                      hint={<>NationStates imports</>}
                    />
                  </Card>
                </div>
              </div>
            );
          })()}

          {/* Section switcher */}
          <SegmentedControl
            asTabs
            aria-label="Cards administration sections"
            value={activeTab}
            onValueChange={(tab) => setActiveTab(tab)}
            options={[
              { value: "overview", label: "Overview", icon: <Layers /> },
              { value: "designer", label: "Card Designer", icon: <Palette /> },
              { value: "explorer", label: "Card Explorer", icon: <Search /> },
              { value: "imports", label: "Import Studio", icon: <Globe /> },
              { value: "settings", label: "Settings", icon: <Sliders /> },
            ]}
          />
        </Card>

        {/* ─── TAB: 3D CARD DESIGNER STUDIO ─────────────────────── */}
        {activeTab === "designer" && <CardDesignerStudio />}

        {/* ─── TAB: OVERVIEW & LIBRARY STATISTICS ──────────────────── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Operations Log & Audit Trail Card inside Overview */}
            <Card className="space-y-4 p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <div className="border-tint/20 bg-tint-fill text-tint rounded-row border p-2">
                    <FileText className="text-tint h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-label text-title-3">Operations Log & Audit Trail</h2>
                    <p className="text-label-secondary text-caption">
                      All admin actions, designer mints, import syncs, batch generations, takedowns,
                      and system operations
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={logCategoryFilter}
                    onValueChange={(v) => setLogCategoryFilter(v as any)}
                  >
                    <SelectTrigger size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        All Logs ({unifiedLogsData?.stats.all ?? 0})
                      </SelectItem>
                      <SelectItem value="imports">
                        Imports & Syncs ({unifiedLogsData?.stats.imports ?? 0})
                      </SelectItem>
                      <SelectItem value="designer">
                        Card Designer ({unifiedLogsData?.stats.designer ?? 0})
                      </SelectItem>
                      <SelectItem value="lore_batch">
                        Lore Batch Studio ({unifiedLogsData?.stats.lore_batch ?? 0})
                      </SelectItem>
                      <SelectItem value="explorer">
                        Card Explorer & Takedowns ({unifiedLogsData?.stats.explorer ?? 0})
                      </SelectItem>
                      <SelectItem value="settings">
                        Settings & Valuations ({unifiedLogsData?.stats.settings ?? 0})
                      </SelectItem>
                      <SelectItem value="duplicates">
                        Duplicate Purges ({unifiedLogsData?.stats.duplicates ?? 0})
                      </SelectItem>
                      <SelectItem value="admin">
                        Admin Audit Trail ({unifiedLogsData?.stats.admin ?? 0})
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Button size="sm" variant="outline" onClick={() => void refetchUnifiedLogs()}>
                    <RefreshCw className="mr-2 h-3 w-3" /> Refresh
                  </Button>
                </div>
              </div>

              {/* Quick Filter Pill Badges */}
              {unifiedLogsData?.stats && (
                <ToggleGroup
                  type="single"
                  size="sm"
                  disallowEmpty
                  aria-label="Log category"
                  value={logCategoryFilter}
                  onValueChange={(value) => value && setLogCategoryFilter(value as any)}
                  className="flex-wrap"
                >
                  {[
                    {
                      id: "all",
                      label: "All",
                      count: unifiedLogsData.stats.all,
                    },
                    {
                      id: "imports",
                      label: "Imports & Syncs",
                      count: unifiedLogsData.stats.imports,
                    },
                    {
                      id: "designer",
                      label: "Card Designer",
                      count: unifiedLogsData.stats.designer,
                    },
                    {
                      id: "lore_batch",
                      label: "Lore Batch",
                      count: unifiedLogsData.stats.lore_batch,
                    },
                    {
                      id: "explorer",
                      label: "Explorer & Actions",
                      count: unifiedLogsData.stats.explorer,
                    },
                    {
                      id: "settings",
                      label: "Settings",
                      count: unifiedLogsData.stats.settings,
                    },
                    {
                      id: "duplicates",
                      label: "Purges",
                      count: unifiedLogsData.stats.duplicates,
                    },
                  ].map((item) => (
                    <ToggleGroupItem key={item.id} value={item.id}>
                      {item.label}
                      <span className="tabular-nums opacity-80">({item.count})</span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}

              <LogViewerFilterable
                entries={operationsLogEntries}
                title="Unified Cards Audit Trail & Operations Stream"
                maxHeight={460}
                className="border-separator bg-surface border"
              />
            </Card>
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
