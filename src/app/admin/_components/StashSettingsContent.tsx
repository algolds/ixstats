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
import { FacetCard } from "~/components/ui/facet-container";

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
        <FacetCard className="p-4">
          <p className="text-label-secondary text-eyebrow">Total Stashed Articles</p>
          {statsLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="text-label text-title-2 mt-1 tabular-nums">
              {stats?.totalStashes.toLocaleString() ?? 0}
            </p>
          )}
        </FacetCard>

        <FacetCard className="p-4">
          <p className="text-label-secondary text-eyebrow">Text Highlight Marks</p>
          {statsLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="text-title-2 text-purple mt-1 tabular-nums">
              {stats?.totalHighlights.toLocaleString() ?? 0}
            </p>
          )}
        </FacetCard>

        <FacetCard className="p-4">
          <p className="text-label-secondary text-eyebrow">Cache Quota per User</p>
          {statsLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="text-title-2 text-green mt-1 tabular-nums">
              {stats?.avgCacheSizeKb ?? 143} KB
            </p>
          )}
        </FacetCard>
      </div>

      {/* Settings Form */}
      <FacetCard className="space-y-5 p-5">
        <div className="border-separator flex items-center justify-between border-b pb-4">
          <div>
            <h3 className="text-label text-caption">Stash Configuration Parameters</h3>
            <p className="text-label-secondary text-footnote mt-0.5">
              Client storage policies and offline synchronization settings
            </p>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending || configLoading}>
            <Save className="mr-2 h-3.5 w-3.5" />
            {saveMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        <div className="space-y-3">
          {/* Max Items */}
          <div className="border-separator bg-fill-3 rounded-row flex flex-col justify-between gap-3 border p-4 sm:flex-row sm:items-center">
            <div>
              <Label className="text-label text-caption">Max Stash Limit per Account</Label>
              <p className="text-label-secondary text-footnote">
                Cap the maximum number of stashed wiki pages per user
              </p>
            </div>
            <Input
              type="number"
              value={settings.maxStashCount}
              onChange={(e) => handleToggle("maxStashCount", parseInt(e.target.value) || 10)}
              className="rounded-control-sm md:text-footnote h-(--control-height-sm) w-28 font-mono"
              min={10}
              max={500}
            />
          </div>

          {/* Offline Sync */}
          <div className="border-separator bg-fill-3 rounded-row flex items-center justify-between border p-4">
            <div>
              <Label className="text-label text-caption">Offline Storage Syncing</Label>
              <p className="text-label-secondary text-footnote">
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
          <div className="border-separator bg-fill-3 rounded-row flex items-center justify-between border p-4">
            <div>
              <Label className="text-label text-caption">Automatic Image Categorization</Label>
              <p className="text-label-secondary text-footnote">
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
          <div className="border-separator bg-fill-3 rounded-row flex items-center justify-between border p-4">
            <div>
              <Label className="text-label text-caption">Text Highlight Tracking</Label>
              <p className="text-label-secondary text-footnote">
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
      </FacetCard>
    </div>
  );
}

export default StashSettingsContent;
