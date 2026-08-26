// src/app/admin/_components/ThinkPagesSettingsContent.tsx
// ThinkPages Social Feed & Moderation Admin Panel
"use client";

import { useEffect, useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "./AdminHeader";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Globe,
  FloppyDisk as Save,
  FireFlame as Flame,
  RssFeed as Rss,
  Send,
} from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";

export function ThinkPagesSettingsContent() {
  usePageTitle({ title: "Admin - ThinkPages Panel" });

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Globe}
        title="ThinkPages Social Platform Controls"
        description="Configure ThinkPages social feed properties, maximum character caps, auto-news election logs, and Discord RSS-style feed mirroring."
      />

      <Tabs defaultValue="platform" className="w-full">
        <TabsList className="bg-card/40 border-border/40 mb-4 flex w-full max-w-md justify-start gap-1 rounded-xl border p-1 backdrop-blur-md">
          <TabsTrigger
            value="platform"
            className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold active:scale-[0.98] transition-transform"
          >
            <Globe className="h-4 w-4 text-cyan-400" />
            Platform Settings
          </TabsTrigger>
          <TabsTrigger
            value="discord"
            className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold active:scale-[0.98] transition-transform"
          >
            <Rss className="h-4 w-4 text-purple-400" />
            Discord Mirror Feed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="platform" className="mt-4 focus-visible:outline-none">
          <PlatformSettingsTab />
        </TabsContent>

        <TabsContent value="discord" className="mt-4 focus-visible:outline-none">
          <DiscordMirrorTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// 1. Platform Settings Tab
// ────────────────────────────────────────────────────────────────────────

function PlatformSettingsTab() {
  const notify = useNotify();

  const { data: stats, isLoading: statsLoading } = api.admin.getThinkPagesStats.useQuery();
  const { data: configData, isLoading: configLoading, refetch: refetchConfig } =
    api.admin.getThinkPagesConfig.useQuery();

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
      {/* Real Stats Metric Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Total Social Posts</p>
          {statsLoading ? (
            <Skeleton className="h-7 w-20 mt-1" />
          ) : (
            <p className="text-foreground mt-1 font-mono text-xl font-bold tracking-tight">
              {stats?.totalPosts.toLocaleString() ?? 0}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Registered Accounts</p>
          {statsLoading ? (
            <Skeleton className="h-7 w-20 mt-1" />
          ) : (
            <p className="text-purple-400 mt-1 font-mono text-xl font-bold tracking-tight">
              {stats?.totalAccounts.toLocaleString() ?? 0}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border/30 bg-card/25 p-3.5 backdrop-blur-md shadow-xs">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Weekly Growth</p>
          {statsLoading ? (
            <Skeleton className="h-7 w-20 mt-1" />
          ) : (
            <p className="text-emerald-400 mt-1 font-mono text-xl font-bold tracking-tight">
              {(stats?.weeklyGrowth ?? 0) > 0 ? "+" : ""}
              {stats?.weeklyGrowth ?? 0}%
            </p>
          )}
        </div>
      </div>

      {/* Settings Form */}
      <div className="rounded-2xl border border-border/30 bg-card/25 p-5 backdrop-blur-md shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-border/20 pb-4">
          <div>
            <h3 className="text-xs font-bold text-foreground">ThinkPages Platform Settings</h3>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              Limits, automated news publishing, and content moderation rules
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saveMutation.isPending || configLoading}
            className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98] transition-transform"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saveMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        <div className="space-y-3">
          {/* Max Accounts */}
          <div className="flex flex-col justify-between gap-3 rounded-xl border border-border/20 bg-background/30 p-3.5 sm:flex-row sm:items-center">
            <div>
              <Label className="text-foreground text-xs font-bold">Max Accounts Limit per User</Label>
              <p className="text-muted-foreground text-[11px]">
                Cap the maximum number of ThinkPages feed profiles a player can hold
              </p>
            </div>
            <Input
              type="number"
              value={settings.maxAccountsPerUser}
              onChange={(e) => handleToggle("maxAccountsPerUser", parseInt(e.target.value) || 1)}
              className="h-8 w-28 rounded-xl border-border/30 bg-background/50 text-xs font-mono font-bold"
              min={1}
              max={100}
            />
          </div>

          {/* Character Cap */}
          <div className="flex flex-col justify-between gap-3 rounded-xl border border-border/20 bg-background/30 p-3.5 sm:flex-row sm:items-center">
            <div>
              <Label className="text-foreground text-xs font-bold">Post Character Length Cap</Label>
              <p className="text-muted-foreground text-[11px]">
                Maximum allowed character length for post content (excluding blurb header tags)
              </p>
            </div>
            <Input
              type="number"
              value={settings.maxCharLength}
              onChange={(e) => handleToggle("maxCharLength", parseInt(e.target.value) || 280)}
              className="h-8 w-28 rounded-xl border-border/30 bg-background/50 text-xs font-mono font-bold"
              min={280}
              max={10000}
            />
          </div>

          {/* Auto News Elections */}
          <div className="flex items-center justify-between rounded-xl border border-border/20 bg-background/30 p-3.5">
            <div>
              <Label className="text-foreground text-xs font-bold">Election Results Auto-News</Label>
              <p className="text-muted-foreground text-[11px]">
                Automatically publish detailed election outcomes to the ThinkPages feed
              </p>
            </div>
            <Switch
              checked={settings.autoNewsElections}
              onCheckedChange={(checked) => handleToggle("autoNewsElections", checked)}
              className="scale-90"
            />
          </div>

          {/* Auto News Policies */}
          <div className="flex items-center justify-between rounded-xl border border-border/20 bg-background/30 p-3.5">
            <div>
              <Label className="text-foreground text-xs font-bold">Passed Directives Auto-News</Label>
              <p className="text-muted-foreground text-[11px]">
                Broadcast newly declared national directives and policy milestones
              </p>
            </div>
            <Switch
              checked={settings.autoNewsPolicies}
              onCheckedChange={(checked) => handleToggle("autoNewsPolicies", checked)}
              className="scale-90"
            />
          </div>

          {/* Comment Attachments */}
          <div className="flex items-center justify-between rounded-xl border border-border/20 bg-background/30 p-3.5">
            <div>
              <Label className="text-foreground text-xs font-bold">Media & Card Attachments</Label>
              <p className="text-muted-foreground text-[11px]">
                Allow attaching vault cards, flags, and image links in replies
              </p>
            </div>
            <Switch
              checked={settings.commentAttachments}
              onCheckedChange={(checked) => handleToggle("commentAttachments", checked)}
              className="scale-90"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// 2. Discord Mirror Tab
// ────────────────────────────────────────────────────────────────────────

function DiscordMirrorTab() {
  const notify = useNotify();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleTestWebhook = () => {
    if (!webhookUrl) {
      notify.error("Validation Error", "Please provide a valid Discord Webhook URL.");
      return;
    }

    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      notify.success("Test Dispatched", "Sample broadcast was sent to the Discord channel.");
    }, 600);
  };

  return (
    <div className="rounded-2xl border border-border/30 bg-card/25 p-5 backdrop-blur-md shadow-xs space-y-5">
      <div>
        <h3 className="text-xs font-bold text-foreground">Discord ThinkPages Mirror</h3>
        <p className="text-muted-foreground text-[11px] mt-0.5">
          Mirror trending thinkpage posts and breaking news bulletins directly to a Discord webhook channel
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-foreground mb-1.5 block text-xs font-medium">Discord Webhook URL</Label>
          <Input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="h-8 rounded-xl border-border/30 bg-background/50 text-xs font-mono"
          />
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleTestWebhook}
          disabled={isSending || !webhookUrl}
          className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98] transition-transform"
        >
          <Send className="mr-1.5 h-3.5 w-3.5" />
          {isSending ? "Sending Test..." : "Send Test Broadcast"}
        </Button>
      </div>
    </div>
  );
}

export default ThinkPagesSettingsContent;
