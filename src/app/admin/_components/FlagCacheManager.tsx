"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Loader2,
  RefreshCw,
  Trash2,
  Database,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { withBasePath } from "~/lib/base-path";

interface FlagStats {
  totalCountries: number;
  cachedFlags: number;
  failedFlags: number;
  lastUpdateTime: number | null;
  nextUpdateTime: number | null;
  isUpdating: boolean;
  updateProgress: {
    current: number;
    total: number;
    percentage: number;
  };
}

interface MediaWikiStats {
  cacheSize: number;
  hitRate: number;
  lastCleared: number | null;
}

interface ServerFlagCacheStats {
  totalCountries: number;
  cachedFlags: number;
  failedFlags: number;
  lastUpdateTime: number | null;
  isUpdating: boolean;
  updateProgress: {
    current: number;
    total: number;
    percentage: number;
  };
  diskUsage: {
    totalFiles: number;
    totalSizeBytes: number;
    totalSizeMB: number;
  };
}

interface FlagCacheStatus {
  flagCache: FlagStats;
  serverFlagCache: ServerFlagCacheStats;
  mediaWiki: MediaWikiStats;
  timestamp: number;
}

export function FlagCacheManager() {
  const [status, setStatus] = useState<FlagCacheStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setError(null);
      const response = await fetch(withBasePath("/api/flag-cache?action=status"));
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (data.success) {
        setStatus(data);
      } else {
        throw new Error(data.error || "Failed to fetch status");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("Error fetching flag cache status:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateCache = async () => {
    try {
      setUpdating(true);
      setError(null);

      const response = await fetch(withBasePath("/api/flag-cache?action=update"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countries: [] }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (data.success) {
        // Refresh status after update
        await fetchStatus();
      } else {
        throw new Error(data.error || "Failed to update cache");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("Error updating flag cache:", err);
    } finally {
      setUpdating(false);
    }
  };

  const clearCache = async () => {
    try {
      setClearing(true);
      setError(null);

      const response = await fetch(withBasePath("/api/flag-cache?action=clear"), {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (data.success) {
        // Refresh status after clearing
        await fetchStatus();
      } else {
        throw new Error(data.error || "Failed to clear cache");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("Error clearing flag cache:", err);
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (stats: FlagStats) => {
    if (stats.isUpdating) return "yellow";
    if (stats.failedFlags > stats.cachedFlags * 0.1) return "red";
    if (stats.cachedFlags > stats.totalCountries * 0.8) return "green";
    return "orange";
  };

  if (loading) {
    return (
      <Card className="glass-surface border-border/40 w-full animate-pulse">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-1.5 text-purple-500">
              <Database className="h-4 w-4" />
            </div>
            Flag Cache Manager
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground flex items-center justify-center py-12 text-xs">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-purple-500" />
          <span>Loading cache status...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-surface border-border/40 w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-bold">
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-1.5 text-purple-500">
            <Database className="h-4 w-4" />
          </div>
          Flag Cache Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-xs font-semibold text-red-500">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {status && (
          <>
            {/* Server Flag Cache Stats (Primary) */}
            <div className="space-y-4">
              <span className="text-muted-foreground border-border/10 block border-b pb-1.5 text-[10px] font-bold tracking-wider uppercase">
                Server Flag Cache (Local Storage)
              </span>

              <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
                <div className="border-border/20 bg-card/10 hover:border-border/30 rounded-lg border p-3 transition-all">
                  <div className="text-foreground font-mono text-lg font-bold">
                    {status.serverFlagCache.totalCountries}
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-[10px] font-bold tracking-wider uppercase">
                    Total Countries
                  </div>
                </div>

                <div className="border-border/20 bg-card/10 hover:border-border/30 rounded-lg border p-3 transition-all">
                  <div className="font-mono text-lg font-bold text-green-500">
                    {status.serverFlagCache.cachedFlags}
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-[10px] font-bold tracking-wider uppercase">
                    Downloaded Flags
                  </div>
                </div>

                <div className="border-border/20 bg-card/10 hover:border-border/30 rounded-lg border p-3 transition-all">
                  <div className="text-foreground font-mono text-lg font-bold">
                    {status.serverFlagCache.diskUsage.totalSizeMB.toFixed(1)} MB
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-[10px] font-bold tracking-wider uppercase">
                    Disk Usage
                  </div>
                </div>

                <div className="border-border/20 bg-card/10 hover:border-border/30 rounded-lg border p-3 transition-all">
                  <div className="text-foreground font-mono text-lg font-bold">
                    {status.serverFlagCache.diskUsage.totalFiles}
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-[10px] font-bold tracking-wider uppercase">
                    Files Stored
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Badge
                  variant={status.serverFlagCache.isUpdating ? "destructive" : "default"}
                  className="flex items-center gap-1 px-1.5 py-0 text-[8px] font-bold tracking-wider uppercase"
                >
                  {status.serverFlagCache.isUpdating ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Downloading ({status.serverFlagCache.updateProgress.percentage}%)
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-3 w-3" />
                      Ready
                    </>
                  )}
                </Badge>

                {status.serverFlagCache.lastUpdateTime && (
                  <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium">
                    <Clock className="h-3 w-3" />
                    Last updated: {formatTime(status.serverFlagCache.lastUpdateTime)}
                  </div>
                )}
              </div>

              {status.serverFlagCache.isUpdating && (
                <div className="animate-in fade-in rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 duration-200">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-foreground font-semibold">Download Progress</span>
                    <span className="font-mono font-bold text-blue-500">
                      {status.serverFlagCache.updateProgress.current} /{" "}
                      {status.serverFlagCache.updateProgress.total}
                    </span>
                  </div>
                  <div className="bg-muted/30 h-2 w-full rounded-full p-[1px]">
                    <div
                      className="h-[6px] rounded-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${status.serverFlagCache.updateProgress.percentage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* In-Memory Flag Cache Stats */}
            <div className="space-y-4 pt-1">
              <span className="text-muted-foreground border-border/10 block border-b pb-1.5 text-[10px] font-bold tracking-wider uppercase">
                In-Memory Flag Cache
              </span>

              <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
                <div className="border-border/20 bg-card/10 hover:border-border/30 rounded-lg border p-3 transition-all">
                  <div className="text-foreground font-mono text-lg font-bold">
                    {status.flagCache.totalCountries}
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-[10px] font-bold tracking-wider uppercase">
                    Total Countries
                  </div>
                </div>

                <div className="border-border/20 bg-card/10 hover:border-border/30 rounded-lg border p-3 transition-all">
                  <div className="font-mono text-lg font-bold text-green-500">
                    {status.flagCache.cachedFlags}
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-[10px] font-bold tracking-wider uppercase">
                    Cached Flags
                  </div>
                </div>

                <div className="border-border/20 bg-card/10 hover:border-border/30 rounded-lg border p-3 transition-all">
                  <div className="font-mono text-lg font-bold text-red-500">
                    {status.flagCache.failedFlags}
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-[10px] font-bold tracking-wider uppercase">
                    Failed Flags
                  </div>
                </div>

                <div className="border-border/20 bg-card/10 hover:border-border/30 rounded-lg border p-3 transition-all">
                  <div className="text-foreground font-mono text-lg font-bold">
                    {status.flagCache.totalCountries > 0
                      ? Math.round(
                          (status.flagCache.cachedFlags / status.flagCache.totalCountries) * 100
                        )
                      : 0}
                    %
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-[10px] font-bold tracking-wider uppercase">
                    Cache Rate
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Badge
                  variant={getStatusColor(status.flagCache) === "green" ? "default" : "destructive"}
                  className="flex items-center gap-1 px-1.5 py-0 text-[8px] font-bold tracking-wider uppercase"
                >
                  {status.flagCache.isUpdating ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Updating ({status.flagCache.updateProgress.percentage}%)
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-3 w-3" />
                      Ready
                    </>
                  )}
                </Badge>

                {status.flagCache.lastUpdateTime && (
                  <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-medium">
                    <Clock className="h-3 w-3" />
                    Last updated: {formatTime(status.flagCache.lastUpdateTime)}
                  </div>
                )}
              </div>
            </div>

            {/* MediaWiki Cache Stats */}
            <div className="space-y-4 pt-1">
              <span className="text-muted-foreground border-border/10 block border-b pb-1.5 text-[10px] font-bold tracking-wider uppercase">
                MediaWiki Cache
              </span>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <div className="border-border/20 bg-card/10 hover:border-border/30 rounded-lg border p-3 transition-all">
                  <div className="text-foreground font-mono text-lg font-bold">
                    {status.mediaWiki.cacheSize}
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-[10px] font-bold tracking-wider uppercase">
                    Cache Size
                  </div>
                </div>

                <div className="border-border/20 bg-card/10 hover:border-border/30 rounded-lg border p-3 transition-all">
                  <div className="font-mono text-lg font-bold text-blue-500">
                    {status.mediaWiki.hitRate.toFixed(1)}%
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-[10px] font-bold tracking-wider uppercase">
                    Hit Rate
                  </div>
                </div>

                <div className="border-border/20 bg-card/10 hover:border-border/30 rounded-lg border p-3 transition-all">
                  <div className="text-foreground text-xs font-semibold">
                    {formatTime(status.mediaWiki.lastCleared)}
                  </div>
                  <div className="text-muted-foreground mt-1 text-[10px] font-bold tracking-wider uppercase">
                    Last Cleared
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="border-border/10 flex flex-wrap gap-2.5 border-t pt-4">
              <Button
                onClick={updateCache}
                disabled={updating || status.flagCache.isUpdating}
                className="flex h-9 items-center gap-1.5 px-4 text-xs font-bold"
              >
                {updating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Download & Cache Flags
              </Button>

              <Button
                variant="outline"
                onClick={clearCache}
                disabled={clearing}
                className="flex h-9 items-center gap-1.5 border-red-500/20 bg-red-500/5 px-4 text-xs font-bold text-red-500 hover:border-red-500/30 hover:bg-red-500/10"
              >
                {clearing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Clear All Caches
              </Button>

              <Button
                variant="ghost"
                onClick={fetchStatus}
                disabled={loading}
                className="flex h-9 items-center gap-1.5 px-3 text-xs font-bold"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh Status
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
