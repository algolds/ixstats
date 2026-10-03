"use client";

import React, { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import {
  SystemRestart as Loader2,
  Refresh as RefreshCw,
  Database,
  Flash as Zap,
  WarningTriangle as AlertTriangle,
} from "iconoir-react";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";

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
        <Card className="p-4">
          <p className="text-label-secondary text-stat-label">Cached items</p>
          <p className="text-label text-title-2 mt-1 tabular-nums">{stats?.cacheSize ?? 0}</p>
        </Card>

        <Card className="p-4">
          <p className="text-label-secondary text-stat-label">Hit rate</p>
          <p className="text-title-2 text-green mt-1 tabular-nums">{hitRate}%</p>
        </Card>

        <Card className="p-4">
          <p className="text-label-secondary text-stat-label">Flag requests</p>
          <p className="text-title-2 text-yellow mt-1 tabular-nums">
            {stats?.serviceStats?.flagRequests ?? 0}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-label-secondary text-stat-label">Total requests</p>
          <p className="text-title-2 text-purple mt-1 tabular-nums">
            {stats?.serviceStats?.totalRequests ?? 0}
          </p>
        </Card>
      </div>

      {/* Main Controls Card */}
      <Card className="space-y-5 p-5">
        <div className="border-separator flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Database className="text-blue h-4 w-4" />
            <div>
              <h3 className="text-label text-caption">Media service controls</h3>
              <p className="text-label-secondary text-footnote">
                Centralized flag and wiki data caching system
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={cn(
                "rounded-control-sm text-caption inline-block border px-2 py-0.5",
                stats?.cacheSize
                  ? "border-green/30 bg-green/10 text-green"
                  : "border-separator bg-fill-3 text-label-secondary"
              )}
            >
              Cache: {stats?.cacheSize ? "Active" : "Empty"}
            </span>
            <span
              className={cn(
                "rounded-control-sm text-caption inline-block border px-2 py-0.5",
                parseFloat(hitRate) > 80
                  ? "border-green/30 bg-green/10 text-green"
                  : "border-yellow/30 bg-yellow/10 text-yellow"
              )}
            >
              Health: {parseFloat(hitRate) > 80 ? "Optimal" : "Cold"}
            </span>
            {lastUpdated && (
              <Badge variant="default" className="tabular-nums">
                Synced {lastUpdated.toLocaleTimeString()}
              </Badge>
            )}
          </div>
        </div>

        {/* Cache Health Warning */}
        {stats && stats.cacheSize === 0 && (
          <div className="rounded-row border-yellow/30 bg-yellow/10 text-footnote text-yellow flex items-center gap-2 border p-3">
            <AlertTriangle className="text-yellow h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Cache is currently uninitialized</p>
              <p className="text-footnote opacity-80">
                Initialize the cache to index flags and improve UI response times.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={fetchStats} disabled={isLoading} variant="outline" size="sm">
            {isLoading ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
            )}
            Refresh Stats
          </Button>

          <Button onClick={initializeCache} disabled={isInitializing} size="sm">
            {isInitializing ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="mr-2 h-3.5 w-3.5" />
            )}
            Initialize Cache
          </Button>

          <Button onClick={clearCache} disabled={isLoading} variant="destructive" size="sm">
            Clear cache
          </Button>
        </div>

        {/* Detailed Stats */}
        {stats && (
          <div className="border-separator grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2">
            <div className="border-separator bg-fill-3 rounded-row space-y-2 border p-3">
              <h4 className="text-label text-caption">Request statistics</h4>
              <div className="text-footnote space-y-2">
                <div className="flex justify-between">
                  <span className="text-label-secondary">Cache Hits:</span>
                  <span className="text-label font-semibold tabular-nums">{stats.cacheHits}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-label-secondary">Cache Misses:</span>
                  <span className="text-label font-semibold tabular-nums">{stats.cacheMisses}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-label-secondary">Hit Ratio:</span>
                  <span className="text-green font-semibold tabular-nums">{hitRate}%</span>
                </div>
              </div>
            </div>

            <div className="border-separator bg-fill-3 rounded-row space-y-2 border p-3">
              <h4 className="text-label text-caption">Service breakdown</h4>
              <div className="text-footnote space-y-2">
                <div className="flex justify-between">
                  <span className="text-label-secondary">Flag Requests:</span>
                  <span className="text-label font-semibold tabular-nums">
                    {stats.serviceStats?.flagRequests ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-label-secondary">Infobox Requests:</span>
                  <span className="text-label font-semibold tabular-nums">
                    {stats.serviceStats?.infoboxRequests ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-label-secondary">Total Service Requests:</span>
                  <span className="text-label font-semibold tabular-nums">
                    {stats.serviceStats?.totalRequests ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default UnifiedMediaServiceAdmin;
