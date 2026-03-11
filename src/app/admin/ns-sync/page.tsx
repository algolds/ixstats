'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { RefreshCw, Database, AlertCircle, CheckCircle, XCircle, Play, RotateCcw, Clock, TrendingUp, AlertTriangle, Globe, MapPin, Layers, Upload, FileUp, Search, Users, Package, Gavel, BookOpen } from 'lucide-react';
import { api } from '~/trpc/react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { CardPacksAdmin } from './CardPacksAdmin';
import { LoreCardBatchAdmin } from './LoreCardBatchAdmin';

type AdminTab = 'sync' | 'packs' | 'lore';

function SeedDemoAuctionsButton() {
  const seedMutation = api.cardMarket.seedDemoAuctions.useMutation({
    onSuccess: (data) => {
      alert(data.message);
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  return (
    <div className="glass-card-child flex items-center justify-between rounded-xl border border-amber-500/20 p-4">
      <div className="flex items-center gap-3">
        <Gavel className="h-5 w-5 text-amber-400" />
        <div>
          <p className="text-sm font-medium text-foreground">Demo Auctions</p>
          <p className="text-xs text-muted-foreground">Seed sample auctions with lore cards for marketplace testing</p>
        </div>
      </div>
      <Button
        onClick={() => {
          if (confirm('Create 6 demo auctions with sample lore cards?')) {
            seedMutation.mutate();
          }
        }}
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
  );
}

export default function NSSyncMonitoringPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const tab = searchParams.get('tab');
    if (tab === 'packs') return 'packs';
    if (tab === 'lore') return 'lore';
    return 'sync';
  });
  const [refreshInterval, setRefreshInterval] = useState<number | null>(10000);
  const [showResetConfirm, setShowResetConfirm] = useState<number | null>(null);
  const [regionName, setRegionName] = useState('greater_ixnay');
  const [dumpSeason, setDumpSeason] = useState(3);
  const [dumpFile, setDumpFile] = useState<{ name: string; base64: string; isGzipped: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSyncLogId, setActiveSyncLogId] = useState<string | null>(null);
  const [syncTypeFilter, setSyncTypeFilter] = useState<'all' | 'season' | 'region' | 'dump'>('all');
  const [discoveredRegions, setDiscoveredRegions] = useState<{ id: string; name: string; numnations: number }[] | null>(null);

  const seasons = [1, 2, 3, 4] as const;

  // ─── Queries ──────────────────────────────────────────────────

  const { data: healthStats, isLoading: loadingHealth, refetch: refetchHealth } =
    api.nsImport.getSyncHealth.useQuery(undefined, {
      refetchInterval: refreshInterval ?? false,
    });

  const { data: libraryStats } = api.cards.getNSLibraryStats.useQuery(undefined, {
    refetchInterval: refreshInterval ?? false,
  });

  const season1Query = api.nsImport.getSyncStatus.useQuery({ season: 1 }, { refetchInterval: refreshInterval ?? false });
  const season2Query = api.nsImport.getSyncStatus.useQuery({ season: 2 }, { refetchInterval: refreshInterval ?? false });
  const season3Query = api.nsImport.getSyncStatus.useQuery({ season: 3 }, { refetchInterval: refreshInterval ?? false });
  const season4Query = api.nsImport.getSyncStatus.useQuery({ season: 4 }, { refetchInterval: refreshInterval ?? false });

  const seasonStatuses = [season1Query.data, season2Query.data, season3Query.data, season4Query.data];

  const { data: syncLogs, refetch: refetchLogs } = api.nsImport.getSyncLogs.useQuery(
    { season: undefined, syncTypeFilter, limit: 50 },
    { refetchInterval: refreshInterval ?? false }
  );

  // Poll active background job
  const { data: activeSyncStatus } = api.nsImport.getRegionSyncStatus.useQuery(
    { syncLogId: activeSyncLogId! },
    { enabled: !!activeSyncLogId, refetchInterval: activeSyncLogId ? 3000 : false }
  );

  // Check for interrupted jobs that can be resumed
  const { data: interruptedJobs, refetch: refetchInterrupted } = api.nsImport.getInterruptedJobs.useQuery(
    undefined,
    { refetchInterval: false }
  );

  // Clear polling when job completes
  useEffect(() => {
    if (activeSyncStatus && (activeSyncStatus.status === 'SUCCESS' || activeSyncStatus.status === 'FAILED')) {
      const timer = setTimeout(() => {
        setActiveSyncLogId(null);
        void refetchLogs();
        void refetchInterrupted();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeSyncStatus, refetchLogs, refetchInterrupted]);

  // ─── Mutations ────────────────────────────────────────────────

  const triggerSyncMutation = api.nsImport.triggerManualSync.useMutation({
    onSuccess: (data) => { alert(`Sync queued for Season ${data.season}`); void refetchHealth(); },
    onError: (error) => { alert(`Error triggering sync: ${error.message}`); },
  });

  const resetSyncMutation = api.nsImport.resetSync.useMutation({
    onSuccess: (data) => { alert(data.message); setShowResetConfirm(null); void refetchHealth(); },
    onError: (error) => { alert(`Error resetting sync: ${error.message}`); },
  });

  const fetchRegionMutation = api.nsImport.fetchRegionCards.useMutation({
    onSuccess: (data) => {
      setActiveSyncLogId(data.syncLogId);
      alert(`Started: Fetching cards from ${data.nationsFound} nations in "${regionName}"`);
    },
    onError: (error) => { alert(`Error: ${error.message}`); },
  });

  const importDumpMutation = api.nsImport.importSeasonDump.useMutation({
    onSuccess: (data) => {
      setActiveSyncLogId(data.syncLogId);
      alert(data.message);
    },
    onError: (error) => { alert(`Error: ${error.message}`); },
  });

  const discoverRegionsMutation = api.nsImport.discoverTopRegions.useMutation({
    onSuccess: (data) => {
      setDiscoveredRegions(data.regions);
    },
    onError: (error) => { alert(`Error discovering regions: ${error.message}`); },
  });

  const resumeJobMutation = api.nsImport.resumeRegionFetch.useMutation({
    onSuccess: (data) => {
      if (data.resumed) {
        setActiveSyncLogId(data.syncLogId);
        void refetchInterrupted();
      }
      alert(data.message);
    },
    onError: (error) => { alert(`Error resuming: ${error.message}`); },
  });

  // ─── Handlers ─────────────────────────────────────────────────

  const handleRefreshAll = () => { void refetchHealth(); void refetchLogs(); };
  const handleTriggerSync = (season: number) => {
    if (confirm(`Start manual sync for Season ${season}?`)) triggerSyncMutation.mutate({ season });
  };
  const handleResetSync = (season: number) => { resetSyncMutation.mutate({ season }); };

  // ─── Helpers ──────────────────────────────────────────────────

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': case 'SUCCESS': return 'text-green-400 bg-green-500/20';
      case 'IN_PROGRESS': return 'text-blue-400 bg-blue-500/20';
      case 'FAILED': return 'text-red-400 bg-red-500/20';
      default: return 'text-muted-foreground bg-muted/50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': case 'SUCCESS': return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'IN_PROGRESS': return <RefreshCw className="h-5 w-5 text-blue-400 animate-spin" />;
      case 'FAILED': return <XCircle className="h-5 w-5 text-red-400" />;
      default: return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className="bg-background text-foreground min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="glass-card-parent rounded-xl border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-transparent to-blue-500/10 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
                <Database className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-foreground text-2xl font-bold md:text-3xl">
                  Card Management
                </h1>
                <p className="text-muted-foreground text-sm">
                  NS card sync, card pack configuration, and import management
                </p>
              </div>
            </div>
            {activeTab === 'sync' && (
              <div className="flex items-center gap-3">
                <select
                  value={refreshInterval ?? 'off'}
                  onChange={(e) => setRefreshInterval(e.target.value === 'off' ? null : parseInt(e.target.value))}
                  className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground"
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
                  <RefreshCw className={`h-4 w-4 ${loadingHealth ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            )}
          </div>

          {/* Tab Strip */}
          <div className="mt-4 flex gap-2 border-t border-border pt-4">
            {([
              { id: 'sync' as AdminTab, label: 'NS Sync', icon: Database },
              { id: 'packs' as AdminTab, label: 'Card Packs', icon: Package },
              { id: 'lore' as AdminTab, label: 'Lore Cards', icon: BookOpen },
            ]).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
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
        {activeTab === 'packs' && (
          <div className="space-y-4">
            <SeedDemoAuctionsButton />
            <CardPacksAdmin />
          </div>
        )}

        {/* Lore Cards Tab */}
        {activeTab === 'lore' && <LoreCardBatchAdmin />}

        {/* NS Sync Tab Content */}
        {activeTab === 'sync' && (<>

        {/* ─── Interrupted Jobs Banner ────────────────────────── */}
        {interruptedJobs && interruptedJobs.length > 0 && !activeSyncLogId && (
          <div className="glass-card-child rounded-xl border-2 border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-transparent to-amber-500/5 p-5">
            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-foreground font-semibold">Interrupted Import Jobs</h3>
                <p className="text-sm text-muted-foreground">
                  These region imports were interrupted (e.g. server restart). Resume to continue where they left off.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {interruptedJobs.map((job) => {
                const pct = job.totalNations > 0 ? Math.round((job.nationsProcessed / job.totalNations) * 100) : 0;
                return (
                  <div key={job.id} className="flex items-center gap-4 rounded-lg border border-border/50 bg-muted/30 p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground truncate">{job.regionName}</span>
                        <span className="text-xs text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full">{pct}%</span>
                      </div>
                      <div className="w-full rounded-full h-1.5 bg-muted/50 mb-1">
                        <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Nations: {job.nationsProcessed}/{job.totalNations}</span>
                        <span>Cards: +{job.cardsCreated}</span>
                        <span>Remaining: {job.totalNations - job.nationsProcessed}</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => resumeJobMutation.mutate({ syncLogId: job.id })}
                      disabled={resumeJobMutation.isPending}
                      className="shrink-0 bg-amber-500 hover:bg-amber-600"
                    >
                      {resumeJobMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      Resume
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Library Statistics ─────────────────────────────── */}
        {libraryStats && (
          <div className="glass-card-child rounded-xl border border-purple-500/20 p-6">
            <h2 className="text-foreground text-xl font-semibold flex items-center gap-2 mb-4">
              <Layers className="h-6 w-6 text-purple-400" />
              NS Card Library
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-muted-foreground">Total NS Cards in DB</div>
                <div className="text-3xl font-bold text-purple-400">{libraryStats.totalCards.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-2">Top Regions</div>
                {libraryStats.cardsByRegion.length > 0 ? (
                  <div className="space-y-1">
                    {libraryStats.cardsByRegion.slice(0, 5).map((r) => (
                      <div key={r.region} className="flex items-center justify-between text-sm">
                        <span className="text-foreground/80 truncate">{r.region}</span>
                        <span className="font-medium text-foreground ml-2">{r.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No cards imported yet</p>
                )}
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Last Sync</div>
                <div className="text-lg font-semibold text-foreground">
                  {libraryStats.lastSync ? new Date(libraryStats.lastSync.at).toLocaleString() : 'Never'}
                </div>
                {libraryStats.lastSync && (
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(libraryStats.lastSync.status)}`}>
                    {libraryStats.lastSync.status} ({libraryStats.lastSync.type})
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Bulk Import Operations ─────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Region Fetch */}
          <div className="glass-card-child rounded-xl border border-green-500/20 p-6">
            <h3 className="text-foreground text-lg font-semibold flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-green-400" />
              Region Card Fetch
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Fetch trading cards from all nations in a specific NS region. Each nation&apos;s deck is queried via the API (~800ms per nation).
            </p>
            <div className="flex gap-2 mb-4">
              <Input
                type="text"
                value={regionName}
                onChange={(e) => setRegionName(e.target.value)}
                placeholder="Region name (e.g. greater_ixnay)"
                className="flex-1"
              />
              <Button
                onClick={() => fetchRegionMutation.mutate({ regionName })}
                disabled={!regionName.trim() || fetchRegionMutation.isPending || (!!activeSyncLogId && activeSyncStatus?.status === 'IN_PROGRESS')}
                className="bg-green-500 hover:bg-green-600 whitespace-nowrap"
              >
                {fetchRegionMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                Fetch Region
              </Button>
            </div>

            {/* Active job progress */}
            {activeSyncStatus && activeSyncStatus.syncType.startsWith('NS_REGION_') && (
              <div className="rounded-lg border border-border/50 bg-muted/30 p-4 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground/80">
                    {activeSyncStatus.regionName ?? 'Region Fetch'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(activeSyncStatus.status)}`}>
                    {activeSyncStatus.status}
                  </span>
                </div>
                <div className="w-full rounded-full h-2 mb-2 bg-muted/50">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      activeSyncStatus.status === 'SUCCESS' ? 'bg-green-500' :
                      activeSyncStatus.status === 'FAILED' ? 'bg-red-500' : 'bg-blue-500'
                    }`}
                    style={{
                      width: activeSyncStatus.totalNations
                        ? `${Math.min((activeSyncStatus.itemsProcessed / activeSyncStatus.totalNations) * 100, 100)}%`
                        : '0%'
                    }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>Nations: {activeSyncStatus.itemsProcessed}/{activeSyncStatus.totalNations}</div>
                  <div>Cards: +{activeSyncStatus.cardsCreated}</div>
                  <div>Errors: {activeSyncStatus.errorCount}</div>
                </div>
              </div>
            )}
          </div>

          {/* Discover Top Regions */}
          <div className="glass-card-child rounded-xl border border-purple-500/20 p-6">
            <h3 className="text-foreground text-lg font-semibold flex items-center gap-2 mb-4">
              <Search className="h-5 w-5 text-purple-400" />
              Discover Top Regions
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Find the largest NS regions by nation count. More nations = more unique cards to fetch.
            </p>
            <Button
              onClick={() => discoverRegionsMutation.mutate({ limit: 15 })}
              disabled={discoverRegionsMutation.isPending}
              className="mb-4 bg-purple-500 hover:bg-purple-600"
            >
              {discoverRegionsMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {discoverRegionsMutation.isPending ? 'Scanning NS Regions...' : 'Scan Top Regions'}
            </Button>

            {discoveredRegions && (
              <div className="rounded-lg border border-border/50 bg-muted/30 overflow-hidden">
                <div className="px-4 py-2 border-b border-border/50 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Top {discoveredRegions.length} regions by nation count
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {discoveredRegions.reduce((sum, r) => sum + r.numnations, 0).toLocaleString()} total nations
                  </span>
                </div>
                <div className="divide-y divide-border/30 max-h-80 overflow-y-auto">
                  {discoveredRegions.map((region, i) => (
                    <div key={region.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-muted-foreground w-5 text-right shrink-0">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{region.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {region.numnations.toLocaleString()} nations
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRegionName(region.id);
                          if (confirm(`Fetch all cards from "${region.name}" (${region.numnations.toLocaleString()} nations)?\n\nThis will take ~${Math.ceil(region.numnations * 0.8 / 60)} minutes.`)) {
                            fetchRegionMutation.mutate({ regionName: region.id });
                          }
                        }}
                        disabled={fetchRegionMutation.isPending || (!!activeSyncLogId && activeSyncStatus?.status === 'IN_PROGRESS')}
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

          {/* Season Dump Import */}
          <div className="glass-card-child rounded-xl border border-orange-500/20 p-6">
            <h3 className="text-foreground text-lg font-semibold flex items-center gap-2 mb-4">
              <Upload className="h-5 w-5 text-orange-400" />
              Season Card Dump Import
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              Upload a cardlist XML dump file to bulk-import cards for a season.
            </p>

            {/* Notice about dump availability */}
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 mb-4">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-600">
                <p className="font-medium text-amber-400 mb-1">NS Dump Files Currently Unavailable</p>
                <p>
                  The official dump files (<code className="text-amber-400/90">cardlist_S*.xml.gz</code>) are unavailable
                  following the Jan 2026 NS data breach. Use <span className="text-foreground font-medium">Region Fetch</span> above
                  to populate cards via the API instead. If you have a dump file from another source, you can still upload it below.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 mb-4">
              <div className="flex gap-2">
                <select
                  value={dumpSeason}
                  onChange={(e) => setDumpSeason(parseInt(e.target.value))}
                  className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground"
                >
                  <option value={1}>Season 1</option>
                  <option value={2}>Season 2</option>
                  <option value={3}>Season 3</option>
                </select>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-orange-500/30 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 whitespace-nowrap"
                >
                  <FileUp className="h-4 w-4" />
                  {dumpFile ? dumpFile.name : 'Choose File'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml,.xml.gz,.gz"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const isGz = file.name.endsWith('.gz');
                    const reader = new FileReader();
                    reader.onload = () => {
                      const arrayBuffer = reader.result as ArrayBuffer;
                      const base64 = btoa(
                        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
                      );
                      setDumpFile({ name: file.name, base64, isGzipped: isGz });
                    };
                    reader.readAsArrayBuffer(file);
                    e.target.value = '';
                  }}
                />
              </div>
              {dumpFile && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                  <span>
                    <span className="font-medium text-foreground">{dumpFile.name}</span>
                    {' '}ready to import ({dumpFile.isGzipped ? 'gzipped' : 'raw XML'})
                  </span>
                  <button onClick={() => setDumpFile(null)} className="text-muted-foreground hover:text-red-400 ml-1">
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <Button
                onClick={() => {
                  if (!dumpFile) return;
                  if (confirm(`Import ALL cards from Season ${dumpSeason} using "${dumpFile.name}"?`)) {
                    importDumpMutation.mutate({
                      season: dumpSeason,
                      fileData: dumpFile.base64,
                      isGzipped: dumpFile.isGzipped,
                    });
                  }
                }}
                disabled={!dumpFile || importDumpMutation.isPending || (!!activeSyncLogId && activeSyncStatus?.status === 'IN_PROGRESS')}
                className="w-full bg-orange-500 hover:bg-orange-600"
              >
                {importDumpMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Import Dump
              </Button>
            </div>

            {/* Active job progress */}
            {activeSyncStatus && activeSyncStatus.syncType.startsWith('NS_SEASON_DUMP_') && (
              <div className="rounded-lg border border-border/50 bg-muted/30 p-4 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground/80">
                    Season {activeSyncStatus.syncType.replace('NS_SEASON_DUMP_', '')} Dump
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(activeSyncStatus.status)}`}>
                    {activeSyncStatus.status}
                  </span>
                </div>
                <div className="w-full rounded-full h-2 mb-2 bg-muted/50">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      activeSyncStatus.status === 'SUCCESS' ? 'bg-green-500' :
                      activeSyncStatus.status === 'FAILED' ? 'bg-red-500' : 'bg-orange-500'
                    }`}
                    style={{ width: activeSyncStatus.cardsProcessed > 0 ? `${Math.min(50, 100)}%` : '10%' }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>Processed: {activeSyncStatus.cardsProcessed.toLocaleString()}</div>
                  <div>Created: {activeSyncStatus.cardsCreated.toLocaleString()}</div>
                  <div>Errors: {activeSyncStatus.errorCount}</div>
                </div>
                {activeSyncStatus.errorMessage && (
                  <div className="mt-2 text-xs text-red-400 font-mono bg-red-500/10 rounded p-2 truncate">
                    {activeSyncStatus.errorMessage}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Overall Health Metrics ─────────────────────────── */}
        {healthStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass-card-child rounded-xl border border-blue-500/20 p-6">
              <div className="flex items-center gap-3 mb-2">
                <Database className="h-6 w-6 text-blue-400" />
                <div className="text-sm text-muted-foreground">Total Syncs</div>
              </div>
              <div className="text-3xl font-bold text-foreground">{healthStats.overall.totalSyncs}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {healthStats.overall.lastSyncAt ? new Date(healthStats.overall.lastSyncAt).toLocaleString() : 'Never'}
              </div>
            </div>
            <div className="glass-card-child rounded-xl border border-green-500/20 p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="h-6 w-6 text-green-400" />
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
              <div className="text-3xl font-bold text-green-400">
                {(healthStats.overall.successRate * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">{healthStats.overall.successfulSyncs} successful</div>
            </div>
            <div className="glass-card-child rounded-xl border border-red-500/20 p-6">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="h-6 w-6 text-red-400" />
                <div className="text-sm text-muted-foreground">Error Rate</div>
              </div>
              <div className={`text-3xl font-bold ${healthStats.overall.errorRate > 0.1 ? 'text-red-400' : 'text-foreground'}`}>
                {(healthStats.overall.errorRate * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">{healthStats.overall.failedSyncs} failed</div>
            </div>
            <div className="glass-card-child rounded-xl border border-purple-500/20 p-6">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="h-6 w-6 text-purple-400" />
                <div className="text-sm text-muted-foreground">Avg Cards/Sync</div>
              </div>
              <div className="text-3xl font-bold text-purple-400">
                {healthStats.overall.avgCardsProcessed.toFixed(0)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">per sync operation</div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {healthStats && healthStats.alerts.length > 0 && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
            <div className="flex items-center gap-3 mb-3">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-red-400">Active Alerts</h3>
            </div>
            <div className="space-y-2">
              {healthStats.alerts.map((alert, idx) => (
                <div key={idx} className="text-sm text-red-500 ml-8">{alert}</div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Season Status Cards ────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {seasonStatuses?.map((seasonData, idx) => {
            if (!seasonData) return null;
            const season = seasons[idx]!;
            return (
              <div key={season} className="glass-card-child rounded-xl border border-blue-500/20 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold text-foreground">Season {season}</h3>
                    {getStatusIcon(seasonData.status)}
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(seasonData.status)}`}>
                    {seasonData.status}
                  </div>
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                    <span>Progress</span>
                    <span className="font-medium">{seasonData.progress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full rounded-full h-3 bg-muted/50">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        seasonData.status === 'COMPLETED' ? 'bg-green-500' :
                        seasonData.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                        seasonData.status === 'FAILED' ? 'bg-red-500' : 'bg-muted'
                      }`}
                      style={{ width: `${seasonData.progress}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Cards Processed</div>
                    <div className="text-2xl font-bold text-foreground">{seasonData.cardsProcessed.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">of {seasonData.totalCards.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Errors</div>
                    <div className={`text-2xl font-bold ${seasonData.errorCount > 10 ? 'text-red-400' : 'text-foreground'}`}>
                      {seasonData.errorCount}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {seasonData.errorCount > 10 ? 'High error count' : 'Within threshold'}
                    </div>
                  </div>
                </div>
                {seasonData.lastCheckpoint && (
                  <div className="text-sm text-muted-foreground mb-4">
                    <Clock className="inline h-4 w-4 mr-1" />
                    Last checkpoint: {new Date(seasonData.lastCheckpoint).toLocaleString()}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleTriggerSync(season)}
                    disabled={seasonData.status === 'IN_PROGRESS' || triggerSyncMutation.isPending}
                    className="flex-1 bg-blue-500 hover:bg-blue-600"
                  >
                    <Play className="h-4 w-4" /> Trigger Sync
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowResetConfirm(season)}
                    disabled={seasonData.status === 'IN_PROGRESS' || resetSyncMutation.isPending}
                    className="flex-1 border-red-500/20 bg-red-500/20 text-red-500 hover:bg-red-500/30"
                  >
                    <RotateCcw className="h-4 w-4" /> Reset
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Errors */}
        {healthStats && healthStats.recentErrors.length > 0 && (
          <div className="glass-card-child rounded-xl border border-red-500/20 p-6">
            <h2 className="text-foreground text-xl font-semibold flex items-center gap-2 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-400" />
              Recent Errors (Last 50)
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {healthStats.recentErrors.slice(0, 20).map((error, idx) => (
                <div key={idx} className="p-4 rounded-lg border border-red-500/20 bg-red-500/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-red-400">Season {error.season}</span>
                    <span className="text-sm text-red-500">{new Date(error.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="text-sm text-red-500 font-mono bg-red-500/10 p-2 rounded">{error.error}</div>
                  {error.cardsAffected > 0 && (
                    <div className="text-xs text-red-400 mt-2">Cards affected: {error.cardsAffected}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Sync Logs ─────────────────────────────────────── */}
        <div className="glass-card-child rounded-xl border border-blue-500/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-foreground text-xl font-semibold flex items-center gap-2">
              <Database className="h-6 w-6 text-blue-400" />
              Sync Operations Log
            </h2>
            <select
              value={syncTypeFilter}
              onChange={(e) => setSyncTypeFilter(e.target.value as typeof syncTypeFilter)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="all">All Operations</option>
              <option value="season">Season Syncs</option>
              <option value="region">Region Fetches</option>
              <option value="dump">Dump Imports</option>
            </select>
          </div>
          {syncLogs && syncLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Cards</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Created</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Updated</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Duration</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map((log) => (
                    <tr key={log.id} className="border-b border-border/30 transition-colors hover:bg-muted/30">
                      <td className="py-3 px-4 text-sm text-foreground">
                        {log.season ? `Season ${log.season}` : (log as any).syncType || 'Unknown'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">{log.cardsProcessed.toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm text-foreground">{(log.cardsCreated ?? 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm text-foreground">{(log.cardsUpdated ?? 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm text-foreground">{formatDuration(log.duration)}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {new Date(log.startedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No sync operations recorded yet</p>
          )}
        </div>

        {/* Reset Confirmation Dialog */}
        {showResetConfirm !== null && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-card-parent rounded-xl border border-border/50 max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="h-6 w-6 text-red-400" />
                <h3 className="text-lg font-semibold text-foreground">Reset Season {showResetConfirm} Sync?</h3>
              </div>
              <p className="text-muted-foreground mb-6">
                This will clear the checkpoint and sync will start from the beginning. All progress will be lost.
              </p>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowResetConfirm(null)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleResetSync(showResetConfirm)}
                  disabled={resetSyncMutation.isPending}
                  className="bg-red-500 hover:bg-red-600"
                >
                  {resetSyncMutation.isPending ? 'Resetting...' : 'Reset Sync'}
                </Button>
              </div>
            </div>
          </div>
        )}

        </>)}
      </div>
    </div>
  );
}
