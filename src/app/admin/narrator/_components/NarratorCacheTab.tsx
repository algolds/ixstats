"use client";
// src/app/admin/narrator/_components/NarratorCacheTab.tsx
// AI Narrator Generation Cache Metrics & Maintenance Tab

import React from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Database,
  Trash as Trash2,
  WarningTriangle as AlertTriangle,
  SystemRestart as Loader2,
} from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { Card } from "~/components/ui/card";

export function NarratorCacheTab() {
  const notify = useNotify();

  const {
    data: cacheStats,
    isLoading,
    refetch: refetchCacheStats,
  } = api.narrator.getCacheStats.useQuery();

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
        <Card className="p-4">
          <p className="text-label-secondary text-eyebrow">Total cached cards</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-16" />
          ) : (
            <p className="text-label text-title-2 mt-1 tabular-nums">
              {(cacheStats?.total ?? 0).toLocaleString()}
            </p>
          )}
        </Card>

        <Card className="p-4">
          <p className="text-label-secondary text-eyebrow">Total cache hits</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-16" />
          ) : (
            <p className="text-title-2 text-teal mt-1 tabular-nums">
              {(cacheStats?.totalHits ?? 0).toLocaleString()}
            </p>
          )}
        </Card>

        <Card className="p-4">
          <p className="text-label-secondary text-eyebrow">Avg Hits per Card</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-7 w-16" />
          ) : (
            <p className="text-title-2 text-green mt-1 tabular-nums">
              {cacheStats?.averageHitCount ?? 0}x
            </p>
          )}
        </Card>
      </div>

      {/* Cache Control Card */}
      <Card className="space-y-4 p-5">
        <div className="border-separator border-b pb-3">
          <div className="flex items-center gap-2">
            <Database className="text-yellow h-4 w-4" />
            <h3 className="text-label text-caption">Cache policy & storage</h3>
          </div>
          <p className="text-label-secondary text-footnote mt-0.5">
            To prevent quota drainage and API rate limits, flavor text descriptions are cached for
            14 days in the database. Clearing the cache forces new narrative cards to generate on
            demand.
          </p>
        </div>

        <div className="rounded-row border-red/20 bg-red/5 flex flex-col items-start justify-between gap-4 border p-4 sm:flex-row sm:items-center">
          <div>
            <h4 className="text-caption text-red flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Flush AI Narrator Cache
            </h4>
            <p className="text-label-secondary text-footnote mt-0.5 max-w-xl">
              Deletes all database cache entries with the flavor prefix. This will force subsequent
              requests to load directly from the LLM provider.
            </p>
          </div>
          <Button
            onClick={handleClearCache}
            disabled={clearCacheMutation.isPending}
            variant="destructive"
            size="sm"
            className="shrink-0"
          >
            {clearCacheMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Flushing...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Flush flavor cache
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default NarratorCacheTab;
