"use client";
// src/app/admin/_components/StashSettingsContent.tsx
// Stash and WikiOS Article Caching Administration Panel

import { useEffect, useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "./AdminHeader";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Folder as FolderHeart, FloppyDisk as Save } from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";

export function StashSettingsContent() {
  usePageTitle({ title: "Admin - Stash Settings" });
  const notify = useNotify();

  const { data: stats, isLoading: statsLoading } = api.admin.getStashStats.useQuery();
  const {
    data: configData,
    isLoading: configLoading,
    refetch: refetchConfig,
  } = api.admin.getStashConfig.useQuery();

  const [settings, setSettings] = useState({
    maxStashCount: 100,
    offlineCacheEnabled: true,
    autoCategorization: true,
    highlightTracking: true,
    welcomeVersion: "1.0",
  });

  useEffect(() => {
    if (configData) {
      setSettings(configData);
    }
  }, [configData]);

  const saveMutation = api.admin.saveStashConfig.useMutation({
    onSuccess: () => {
      notify.success("Settings Saved", "Stash configuration updated successfully.");
      void refetchConfig();
    },
    onError: (err: { message?: string }) => {
      notify.error("Save Failed", err.message || "Failed to update stash configuration.");
    },
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  const handleToggle = (key: keyof typeof settings, value: boolean | number | string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={FolderHeart}
        title="Stash & Wiki Caching Controls"
        description="Configure WikiOS article stash parameters, offline storage, highlights tracker, and welcome modals."
      />

      {/* Real Stats Metric Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Total Stashed Articles
          </p>
          {statsLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="text-foreground mt-1 font-mono text-xl font-bold tracking-tight">
              {stats?.totalStashes.toLocaleString() ?? 0}
            </p>
          )}
        </div>

        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Text Highlight Marks
          </p>
          {statsLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="mt-1 font-mono text-xl font-bold tracking-tight text-purple-400">
              {stats?.totalHighlights.toLocaleString() ?? 0}
            </p>
          )}
        </div>

        <div className="border-border/30 bg-card/25 rounded-2xl border p-3.5 shadow-xs backdrop-blur-md">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Cache Quota per User
          </p>
          {statsLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="mt-1 font-mono text-xl font-bold tracking-tight text-emerald-400">
              {stats?.avgCacheSizeKb ?? 143} KB
            </p>
          )}
        </div>
      </div>

      {/* Settings Form */}
      <div className="border-border/30 bg-card/25 space-y-5 rounded-2xl border p-5 shadow-xs backdrop-blur-md">
        <div className="border-border/20 flex items-center justify-between border-b pb-4">
          <div>
            <h3 className="text-foreground text-xs font-bold">Stash Configuration Parameters</h3>
            <p className="text-muted-foreground mt-0.5 text-[11px]">
              Client storage policies and offline synchronization settings
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saveMutation.isPending || configLoading}
            className="h-8 rounded-xl px-3.5 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saveMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        <div className="space-y-3">
          {/* Max Items */}
          <div className="border-border/20 bg-background/30 flex flex-col justify-between gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-center">
            <div>
              <Label className="text-foreground text-xs font-bold">
                Max Stash Limit per Account
              </Label>
              <p className="text-muted-foreground text-[11px]">
                Cap the maximum number of stashed wiki pages per user
              </p>
            </div>
            <Input
              type="number"
              value={settings.maxStashCount}
              onChange={(e) => handleToggle("maxStashCount", parseInt(e.target.value) || 10)}
              className="border-border/30 bg-background/50 h-8 w-28 rounded-xl font-mono text-xs font-bold"
              min={10}
              max={500}
            />
          </div>

          {/* Offline Sync */}
          <div className="border-border/20 bg-background/30 flex items-center justify-between rounded-xl border p-3.5">
            <div>
              <Label className="text-foreground text-xs font-bold">Offline Storage Syncing</Label>
              <p className="text-muted-foreground text-[11px]">
                Cache stashed articles locally in browser IndexedDB storage
              </p>
            </div>
            <Switch
              checked={settings.offlineCacheEnabled}
              onCheckedChange={(checked) => handleToggle("offlineCacheEnabled", checked)}
              className="scale-90"
            />
          </div>

          {/* Auto Category */}
          <div className="border-border/20 bg-background/30 flex items-center justify-between rounded-xl border p-3.5">
            <div>
              <Label className="text-foreground text-xs font-bold">
                Automatic Image Categorization
              </Label>
              <p className="text-muted-foreground text-[11px]">
                Group stashed images by orientation and type filters automatically
              </p>
            </div>
            <Switch
              checked={settings.autoCategorization}
              onCheckedChange={(checked) => handleToggle("autoCategorization", checked)}
              className="scale-90"
            />
          </div>

          {/* Highlight Tracker */}
          <div className="border-border/20 bg-background/30 flex items-center justify-between rounded-xl border p-3.5">
            <div>
              <Label className="text-foreground text-xs font-bold">Text Highlight Tracking</Label>
              <p className="text-muted-foreground text-[11px]">
                Persist user annotations and text highlights across sessions
              </p>
            </div>
            <Switch
              checked={settings.highlightTracking}
              onCheckedChange={(checked) => handleToggle("highlightTracking", checked)}
              className="scale-90"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default StashSettingsContent;
