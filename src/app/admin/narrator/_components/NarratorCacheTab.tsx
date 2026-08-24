// src/app/admin/narrator/_components/NarratorCacheTab.tsx
// AI Narrator Generation Cache Metrics & Maintenance Tab
"use client";

import React from "react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Database,
  Trash as Trash2,
  Check,
  Page as ScrollText,
  Refresh as RefreshCw,
  WarningTriangle as AlertTriangle,
  SystemRestart as Loader2,
} from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";

export function NarratorCacheTab() {
  const notify = useNotify();

  const { data: cacheStats, isLoading, refetch: refetchCacheStats } =
    api.narrator.getCacheStats.useQuery();

  const clearCacheMutation = api.narrator.clearCache.useMutation({
    onSuccess: (data) => {
      notify.success("Cache Cleared", `Cleaned up ${data.count} cached narration cards.`);
      void refetchCacheStats();
    },
    onError: (e: { message?: string }) => {
      notify.error("Cleanup Failed", e.message || "Failed to wipe cached flavor cards.");
    },
  });

  const handleClearCache = () => {
    if (window.confirm("Are you sure you want to clear all cached narrator flavor texts?")) {
      clearCacheMutation.mutate();
    }
  };

  return (
    <div className="space-y-5">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Total Cached Cards</p>
          {isLoading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <p className="text-foreground mt-1 font-mono text-xl font-bold tracking-tight">
              {(cacheStats?.total ?? 0).toLocaleString()}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Total Cache Hits</p>
          {isLoading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <p className="text-cyan-400 mt-1 font-mono text-xl font-bold tracking-tight">
              {(cacheStats?.totalHits ?? 0).toLocaleString()}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Avg Hits per Card</p>
          {isLoading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <p className="text-emerald-400 mt-1 font-mono text-xl font-bold tracking-tight">
              {cacheStats?.averageHitCount ?? 0}x
            </p>
          )}
        </div>
      </div>

      {/* Cache Control Card */}
      <div className="rounded-2xl border border-border/30 bg-card/25 p-5 backdrop-blur-md shadow-xs space-y-4">
        <div className="border-b border-border/20 pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-bold text-foreground">Cache Policy & Storage</h3>
          </div>
          <p className="text-muted-foreground text-[11px] mt-0.5">
            To prevent quota drainage and API rate limits, flavor text descriptions are cached for 14 days in the database. Clearing the cache forces new narrative cards to generate on demand.
          </p>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 sm:flex-row sm:items-center">
          <div>
            <h4 className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
              <AlertTriangle className="h-4 w-4" />
              Flush AI Narrator Cache
            </h4>
            <p className="text-muted-foreground mt-0.5 max-w-xl text-[11px]">
              Deletes all database cache entries with the flavor prefix. This will force subsequent requests to load directly from the LLM provider.
            </p>
          </div>
          <Button
            onClick={handleClearCache}
            disabled={clearCacheMutation.isPending}
            variant="destructive"
            size="sm"
            className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98] transition-transform shrink-0"
          >
            {clearCacheMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Flushing...
              </>
            ) : (
              <>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Flush Flavor Cache
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default NarratorCacheTab;
