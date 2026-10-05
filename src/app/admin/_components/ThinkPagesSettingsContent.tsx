"use client";
// src/app/admin/_components/ThinkPagesSettingsContent.tsx
// ThinkPages Social Feed & Moderation Admin Panel

import { useEffect, useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Globe, FloppyDisk as Save, RssFeed as Rss } from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";
import { Card } from "~/components/ui/card";
import { ThinkPagesDiscordFeedCard } from "./ThinkPagesDiscordFeedCard";

export function ThinkPagesSettingsContent() {
  usePageTitle({ title: "Admin - ThinkPages Panel" });

  return (
    <div className="space-y-6">
      <PageHeader
        title="ThinkPages settings"
        subtitle="Account limits and the Discord feed mirror."
      />

      <Tabs defaultValue="platform" className="w-full">
        <TabsList className="bg-fill-3 mb-4 flex w-full max-w-md justify-start gap-1 rounded-full p-1">
          <TabsTrigger
            value="platform"
            className="text-caption flex flex-1 items-center justify-center gap-2"
          >
            <Globe className="text-teal h-4 w-4" />
            Platform settings
          </TabsTrigger>
          <TabsTrigger
            value="discord"
            className="text-caption flex flex-1 items-center justify-center gap-2"
          >
            <Rss className="text-purple h-4 w-4" />
            Discord mirror feed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="platform" className="mt-4 focus-visible:outline-none">
          <PlatformSettingsTab />
        </TabsContent>

        <TabsContent value="discord" className="mt-4 focus-visible:outline-none">
          <ThinkPagesDiscordFeedCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// 1. Platform Settings Tab

function PlatformSettingsTab() {
  const notify = useNotify();

  const { data: stats, isLoading: statsLoading } = api.admin.getThinkPagesStats.useQuery();
  const {
    data: configData,
    isLoading: configLoading,
    refetch: refetchConfig,
  } = api.admin.getThinkPagesConfig.useQuery();

  const [settings, setSettings] = useState({
    maxAccountsPerUser: 25,
    maxCharLength: 2000,
    autoNewsElections: true,
    autoNewsPolicies: true,
    commentAttachments: true,
    feedLimit: 100,
  });

  useEffect(() => {
    if (configData) {
      setSettings(configData);
    }
  }, [configData]);

  const saveMutation = api.admin.saveThinkPagesConfig.useMutation({
    onSuccess: () => {
      notify.success("Settings Saved", "ThinkPages platform configuration updated.");
      void refetchConfig();
    },
    onError: (err: { message?: string }) => {
      notify.error("Save Failed", err.message || "Failed to update configuration.");
    },
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  const handleToggle = (key: keyof typeof settings, value: boolean | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-label-secondary text-eyebrow">Total social posts</p>
          {statsLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="text-label text-title-2 mt-1 tabular-nums">
              {stats?.totalPosts.toLocaleString() ?? "—"}
            </p>
          )}
        </Card>

        <Card className="p-4">
          <p className="text-label-secondary text-eyebrow">Registered accounts</p>
          {statsLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="text-title-2 text-purple mt-1 tabular-nums">
              {stats?.totalAccounts.toLocaleString() ?? "—"}
            </p>
          )}
        </Card>

        <Card className="p-4">
          <p className="text-label-secondary text-eyebrow">Weekly growth</p>
          {statsLoading ? (
            <Skeleton className="mt-1 h-7 w-20" />
          ) : (
            <p className="text-title-2 text-green mt-1 tabular-nums">
              {stats ? `${stats.weeklyGrowth > 0 ? "+" : ""}${stats.weeklyGrowth}%` : "—"}
            </p>
          )}
        </Card>
      </div>

      <Card className="space-y-5 p-5">
        <div className="border-separator flex items-center justify-between border-b pb-4">
          <div>
            <h3 className="text-label text-caption">ThinkPages Platform Settings</h3>
            <p className="text-label-secondary text-footnote mt-0.5">Per-user account limit</p>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending || configLoading}>
            <Save className="mr-2 h-3.5 w-3.5" />
            {saveMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        <div className="space-y-3">
          <div className="border-separator bg-fill-3 rounded-row flex flex-col justify-between gap-3 border p-4 sm:flex-row sm:items-center">
            <div>
              <Label className="text-label text-caption">Max Accounts Limit per User</Label>
              <p className="text-label-secondary text-footnote">
                Cap the maximum number of ThinkPages feed profiles a player can hold
              </p>
            </div>
            <Input
              type="number"
              value={settings.maxAccountsPerUser}
              onChange={(e) => handleToggle("maxAccountsPerUser", parseInt(e.target.value) || 1)}
              className="rounded-control-sm md:text-footnote h-(--control-height-sm) w-28 font-mono"
              min={1}
              max={100}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
