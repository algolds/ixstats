"use client";

import React, { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { SystemRestart as Loader2, Refresh as RefreshCw, Database, Flash as Zap, WarningTriangle as AlertTriangle } from "iconoir-react";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";

interface CacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  cacheSize: number;
  lastUpdated: number;
  serviceStats: {
    totalRequests: number;
    flagRequests: number;
    infoboxRequests: number;
  };
}

export function UnifiedMediaServiceAdmin() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(withBasePath("/api/flag-cache?action=stats"));
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error("Failed to fetch cache stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeCache = async () => {
    try {
      setIsInitializing(true);
      const response = await fetch(withBasePath("/api/flag-cache?action=flags"), {
        method: "GET",
      });
      const data = await response.json();

      if (data.success) {
        await fetchStats(); // Refresh stats
        alert(`Cache initialized! Loaded ${Object.keys(data.flags).length} flags.`);
      } else {
        alert("Failed to initialize cache: " + data.error);
      }
    } catch (error) {
      console.error("Failed to initialize cache:", error);
      alert("Failed to initialize cache: " + error);
    } finally {
      setIsInitializing(false);
    }
  };

  const clearCache = async () => {
    try {
      setIsLoading(true);
      // Call the unified service clear method
      const response = await fetch(withBasePath("/api/flag-cache?action=clear"), {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success) {
        await fetchStats(); // Refresh stats
        alert("Cache cleared successfully!");
      } else {
        alert("Failed to clear cache: " + data.error);
      }
    } catch (error) {
      console.error("Failed to clear cache:", error);
      alert("Failed to clear cache: " + error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  // oxlint-disable-next-line
  }, []);

  const hitRate = stats ? (stats.hitRate * 100).toFixed(1) : "0";

  return (
    <div className="space-y-5">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Cached Items</p>
          <p className="text-foreground mt-1 font-mono text-xl font-bold tracking-tight">
            {stats?.cacheSize ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Hit Rate</p>
          <p className="text-emerald-400 mt-1 font-mono text-xl font-bold tracking-tight">
            {hitRate}%
          </p>
        </div>

        <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Flag Requests</p>
          <p className="text-amber-400 mt-1 font-mono text-xl font-bold tracking-tight">
            {stats?.serviceStats?.flagRequests ?? 0}
          </p>
        </div>

        <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Total Requests</p>
          <p className="text-purple-400 mt-1 font-mono text-xl font-bold tracking-tight">
            {stats?.serviceStats?.totalRequests ?? 0}
          </p>
        </div>
      </div>

      {/* Main Controls Card */}
      <div className="rounded-2xl border border-border/30 bg-card/25 p-5 backdrop-blur-md shadow-xs space-y-5">
        <div className="flex flex-col gap-3 border-b border-border/20 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-400" />
            <div>
              <h3 className="text-xs font-bold text-foreground">Media Service Controls</h3>
              <p className="text-muted-foreground text-[11px]">Centralized flag and wiki data caching system</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <span className={cn(
              "inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold",
              stats?.cacheSize
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-border/30 bg-background/50 text-muted-foreground"
            )}>
              Cache: {stats?.cacheSize ? "Active" : "Empty"}
            </span>
            <span className={cn(
              "inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold",
              parseFloat(hitRate) > 80
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/30 bg-amber-500/10 text-amber-400"
            )}>
              Health: {parseFloat(hitRate) > 80 ? "Optimal" : "Cold"}
            </span>
            {lastUpdated && (
              <span className="inline-block rounded-md border border-border/20 bg-background/30 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
                Synced {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Cache Health Warning */}
        {stats && stats.cacheSize === 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <p className="font-semibold">Cache is currently uninitialized</p>
              <p className="opacity-80 text-[11px]">Initialize the cache to index flags and improve UI response times.</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={fetchStats}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98] transition-transform"
          >
            {isLoading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Refresh Stats
          </Button>

          <Button
            onClick={initializeCache}
            disabled={isInitializing}
            size="sm"
            className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98] transition-transform"
          >
            {isInitializing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="mr-1.5 h-3.5 w-3.5" />
            )}
            Initialize Cache
          </Button>

          <Button
            onClick={clearCache}
            disabled={isLoading}
            variant="destructive"
            size="sm"
            className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98] transition-transform"
          >
            Clear Cache
          </Button>
        </div>

        {/* Detailed Stats */}
        {stats && (
          <div className="grid grid-cols-1 gap-4 border-t border-border/20 pt-4 md:grid-cols-2">
            <div className="rounded-xl border border-border/20 bg-background/20 p-3 space-y-2">
              <h4 className="text-xs font-bold text-foreground">Request Statistics</h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cache Hits:</span>
                  <span className="font-mono font-semibold text-foreground">{stats.cacheHits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cache Misses:</span>
                  <span className="font-mono font-semibold text-foreground">{stats.cacheMisses}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hit Ratio:</span>
                  <span className="font-mono font-semibold text-emerald-400">{hitRate}%</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/20 bg-background/20 p-3 space-y-2">
              <h4 className="text-xs font-bold text-foreground">Service Breakdown</h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Flag Requests:</span>
                  <span className="font-mono font-semibold text-foreground">{stats.serviceStats?.flagRequests ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Infobox Requests:</span>
                  <span className="font-mono font-semibold text-foreground">{stats.serviceStats?.infoboxRequests ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Service Requests:</span>
                  <span className="font-mono font-semibold text-foreground">{stats.serviceStats?.totalRequests ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UnifiedMediaServiceAdmin;
