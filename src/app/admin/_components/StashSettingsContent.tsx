// src/app/admin/_components/StashSettingsContent.tsx
"use client";

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "./AdminHeader";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import { FolderHeart, Save, Check, Database, Sparkles, RefreshCw } from "lucide-react";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";

export function StashSettingsContent() {
  usePageTitle({ title: "Admin - Stash Settings" });
  const notify = useNotify();
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  const { data: stats } = api.admin.getStashStats.useQuery();

  const [settings, setSettings] = useState({
    maxStashCount: 100,
    offlineCacheEnabled: true,
    autoCategorization: true,
    highlightTracking: true,
    welcomeVersion: "1.0",
  });

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
      notify.success("Stash settings saved successfully");
    }, 800);
  };

  const handleToggle = (key: keyof typeof settings, value: boolean | number | string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={FolderHeart}
        title="Stash Settings"
        description="Configure the WikiOS article stash parameters, offline storage, highlights tracker, and welcome modals."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Stats */}
        <Card className="glass-surface border-border/40">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-blue-500/10 p-3 text-blue-500">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats ? stats.totalStashes.toLocaleString() : "..."}</p>
              <p className="text-muted-foreground text-xs">Total Stashes Saved</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-surface border-border/40">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-purple-500/10 p-3 text-purple-500">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats ? stats.totalHighlights.toLocaleString() : "..."}</p>
              <p className="text-muted-foreground text-xs">Stashed Highlight Marks</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-surface border-border/40">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-emerald-500/10 p-3 text-emerald-500">
              <RefreshCw className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats ? `${stats.avgCacheSizeKb} KB` : "..."}</p>
              <p className="text-muted-foreground text-xs">Avg. Cache size per user</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-surface border-border/40">
        <CardHeader>
          <CardTitle className="text-base font-bold">Stash Configuration Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Max Items */}
          <div className="bg-card/10 border-border/20 flex flex-col justify-between gap-4 rounded-lg border p-4 sm:flex-row sm:items-center">
            <div>
              <Label className="text-sm font-medium">Max Stash Limit per Account</Label>
              <p className="text-muted-foreground text-xs">Cap the maximum number of stashed wiki pages per user</p>
            </div>
            <Input
              type="number"
              value={settings.maxStashCount}
              onChange={(e) => handleToggle("maxStashCount", parseInt(e.target.value) || 0)}
              className="bg-background/40 border-border/60 w-32 text-sm font-bold"
            />
          </div>

          {/* Offline Sync */}
          <div className="bg-card/10 border-border/20 flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="text-sm font-medium">Offline Storage Syncing</Label>
              <p className="text-muted-foreground text-xs">Cache stashed articles locally in browser indexDB storage</p>
            </div>
            <Switch
              checked={settings.offlineCacheEnabled}
              onCheckedChange={(checked) => handleToggle("offlineCacheEnabled", checked)}
            />
          </div>

          {/* Auto Category */}
          <div className="bg-card/10 border-border/20 flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="text-sm font-medium">Automatic Image Categorization</Label>
              <p className="text-muted-foreground text-xs">Group stashed images by orientation and type filters automatically</p>
            </div>
            <Switch
              checked={settings.autoCategorization}
              onCheckedChange={(checked) => handleToggle("autoCategorization", checked)}
            />
          </div>

          {/* Highlight Tracker */}
          <div className="bg-card/10 border-border/20 flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="text-sm font-medium">Text Highlight Tracking</Label>
              <p className="text-muted-foreground text-xs">Save and sync custom reader highlights on stashed pages</p>
            </div>
            <Switch
              checked={settings.highlightTracking}
              onCheckedChange={(checked) => handleToggle("highlightTracking", checked)}
            />
          </div>

          {/* Welcome Modal Version */}
          <div className="bg-card/10 border-border/20 flex flex-col justify-between gap-4 rounded-lg border p-4 sm:flex-row sm:items-center">
            <div>
              <Label className="text-sm font-medium">Welcome Guide Overlay Version</Label>
              <p className="text-muted-foreground text-xs">Bump the version identifier to re-show the stash welcome overlay to users</p>
            </div>
            <Input
              value={settings.welcomeVersion}
              onChange={(e) => handleToggle("welcomeVersion", e.target.value)}
              className="bg-background/40 border-border/60 w-32 text-sm font-bold"
            />
          </div>

          {/* Save Action */}
          <div className="border-border/20 border-t pt-4">
            {!saved ? (
              <Button onClick={handleSave} disabled={isSaving} className="w-full">
                {isSaving ? "Saving..." : "Save Stash Changes"}
              </Button>
            ) : (
              <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500" />
                All changes saved
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
