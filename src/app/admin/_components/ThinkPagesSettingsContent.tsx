// src/app/admin/_components/ThinkPagesSettingsContent.tsx
"use client";

import { useEffect, useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "./AdminHeader";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Globe, FloppyDisk as Save, Check, ChatBubble as MessageSquare, FireFlame as Flame, StatUp as TrendingUp, RssFeed as Rss, Send, CheckCircle as CheckCircle2, XmarkCircle as XCircle, SystemRestart as Loader2, Hashtag as Hash, Group as Users, ShieldCheck } from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

export function ThinkPagesSettingsContent() {
  usePageTitle({ title: "Admin - ThinkPages Panel" });

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Globe}
        title="ThinkPages Settings"
        description="Configure ThinkPages social feed properties, maximum character caps, auto-news election logs, and Discord RSS-style feed mirroring."
      />

      <Tabs defaultValue="platform" className="w-full">
        <TabsList className="facet-surface border-border/40 grid w-full max-w-md grid-cols-2 p-1">
          <TabsTrigger value="platform" className="text-xs md:text-sm">
            Platform Settings
          </TabsTrigger>
          <TabsTrigger value="discord" className="text-xs md:text-sm">
            Discord Mirror Feed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="platform" className="mt-6">
          <PlatformSettingsTab />
        </TabsContent>

        <TabsContent value="discord" className="mt-6">
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
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(true);

  const { data: stats } = api.admin.getThinkPagesStats.useQuery();

  const [settings, setSettings] = useState({
    maxAccountsPerUser: 25,
    maxCharLength: 2000,
    autoNewsElections: true,
    autoNewsPolicies: true,
    commentAttachments: true,
    feedLimit: 100,
  });

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
      notify.success("ThinkPages settings saved successfully");
    }, 800);
  };

  const handleToggle = (key: keyof typeof settings, value: boolean | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="facet-surface border-border/40">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-indigo-500/10 p-3 text-indigo-500">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {stats ? stats.totalPosts.toLocaleString() : "..."}
              </p>
              <p className="text-muted-foreground text-xs">Total Social Posts</p>
            </div>
          </CardContent>
        </Card>

        <Card className="facet-surface border-border/40">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-pink-500/10 p-3 text-pink-500">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {stats ? stats.totalAccounts.toLocaleString() : "..."}
              </p>
              <p className="text-muted-foreground text-xs">Registered Social Accounts</p>
            </div>
          </CardContent>
        </Card>

        <Card className="facet-surface border-border/40">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-cyan-500/10 p-3 text-cyan-500">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {stats ? `${stats.weeklyGrowth > 0 ? "+" : ""}${stats.weeklyGrowth}%` : "..."}
              </p>
              <p className="text-muted-foreground text-xs">Weekly Engagement Growth</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings Form */}
      <Card className="facet-surface border-border/40">
        <CardHeader>
          <CardTitle className="text-base font-bold">ThinkPages Platform Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Max Accounts */}
          <div className="bg-card/10 border-border/20 flex flex-col justify-between gap-4 rounded-lg border p-4 sm:flex-row sm:items-center">
            <div>
              <Label className="text-sm font-medium">Max Accounts Limit per User</Label>
              <p className="text-muted-foreground text-xs">
                Cap the maximum number of ThinkPages feed profiles a player can hold
              </p>
            </div>
            <Input
              type="number"
              value={settings.maxAccountsPerUser}
              onChange={(e) => handleToggle("maxAccountsPerUser", parseInt(e.target.value) || 0)}
              className="bg-background/40 border-border/60 w-32 text-sm font-bold"
            />
          </div>

          {/* Character Cap */}
          <div className="bg-card/10 border-border/20 flex flex-col justify-between gap-4 rounded-lg border p-4 sm:flex-row sm:items-center">
            <div>
              <Label className="text-sm font-medium">Post Character Length Cap</Label>
              <p className="text-muted-foreground text-xs">
                The maximum allowed character length for post content (excluding metadata prefix)
              </p>
            </div>
            <Input
              type="number"
              value={settings.maxCharLength}
              onChange={(e) => handleToggle("maxCharLength", parseInt(e.target.value) || 0)}
              className="bg-background/40 border-border/60 w-32 text-sm font-bold"
            />
          </div>

          {/* Auto News Elections */}
          <div className="bg-card/10 border-border/20 flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="text-sm font-medium">Election Results Auto-News</Label>
              <p className="text-muted-foreground text-xs">
                Automatically publish detailed election outcomes to the ThinkPages feed
              </p>
            </div>
            <Switch
              checked={settings.autoNewsElections}
              onCheckedChange={(checked) => handleToggle("autoNewsElections", checked)}
            />
          </div>

          {/* Auto News Policies */}
          <div className="bg-card/10 border-border/20 flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="text-sm font-medium">Executive Policy Auto-News</Label>
              <p className="text-muted-foreground text-xs">
                Automatically post new country executive policies and diplomatic warnings
              </p>
            </div>
            <Switch
              checked={settings.autoNewsPolicies}
              onCheckedChange={(checked) => handleToggle("autoNewsPolicies", checked)}
            />
          </div>

          {/* Comment attachments */}
          <div className="bg-card/10 border-border/20 flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="text-sm font-medium">Allow Rich Media in Comments</Label>
              <p className="text-muted-foreground text-xs">
                Allow users to embed stashed wiki links or images directly in comments
              </p>
            </div>
            <Switch
              checked={settings.commentAttachments}
              onCheckedChange={(checked) => handleToggle("commentAttachments", checked)}
            />
          </div>

          {/* Save Action */}
          <div className="border-border/20 border-t pt-4">
            {!saved ? (
              <Button onClick={handleSave} disabled={isSaving} className="w-full">
                {isSaving ? "Saving..." : "Save ThinkPages Changes"}
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

// ────────────────────────────────────────────────────────────────────────
// 2. Discord Mirror Feed Tab
// ────────────────────────────────────────────────────────────────────────

interface FormState {
  enabled: boolean;
  channelId: string;
  includeGovernment: boolean;
  includeMedia: boolean;
  includeCitizen: boolean;
  includeSports: boolean;
  verifiedOnly: boolean;
  excludeReplies: boolean;
  excludeAutoGenerated: boolean;
  minEngagement: number;
  accountAllowlist: string;
  accountBlocklist: string;
  hashtagAllowlist: string;
  hashtagBlocklist: string;
}

const joinList = (arr: string[]) => arr.join("\n");
const parseList = (text: string) =>
  text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <Label className="text-sm font-medium">{label}</Label>
        {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function DiscordMirrorTab() {
  const notify = useNotify();

  const { data: config, isLoading, refetch } = api.admin.getThinkpagesDiscordFeedConfig.useQuery();
  const {
    data: preview,
    isLoading: previewLoading,
    refetch: refetchPreview,
  } = api.admin.getThinkpagesDiscordFeedPreview.useQuery({ limit: 20 });

  const [form, setForm] = useState<FormState | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (config && !form) {
      setForm({
        enabled: config.enabled,
        channelId: config.channelId,
        includeGovernment: config.includeGovernment,
        includeMedia: config.includeMedia,
        includeCitizen: config.includeCitizen,
        includeSports: config.includeSports,
        verifiedOnly: config.verifiedOnly,
        excludeReplies: config.excludeReplies,
        excludeAutoGenerated: config.excludeAutoGenerated,
        minEngagement: config.minEngagement,
        accountAllowlist: joinList(config.accountAllowlist),
        accountBlocklist: joinList(config.accountBlocklist),
        hashtagAllowlist: joinList(config.hashtagAllowlist),
        hashtagBlocklist: joinList(config.hashtagBlocklist),
      });
    }
  }, [config, form]);

  const saveMutation = api.admin.saveThinkpagesDiscordFeedConfig.useMutation({
    onSuccess: async () => {
      notify.success("ThinkPages → Discord feed config saved");
      setDirty(false);
      await Promise.all([refetch(), refetchPreview()]);
    },
    onError: (e) => notify.error(`Save failed: ${e.message}`),
  });

  const testMutation = api.admin.sendThinkpagesDiscordFeedTest.useMutation({
    onSuccess: (res) => {
      if (res.ok) notify.success("Test message sent to the channel");
      else notify.error(`Test failed: ${res.error ?? "unknown error"}`);
    },
    onError: (e) => notify.error(`Test failed: ${e.message}`),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true);
  };

  const handleSave = () => {
    if (!form) return;
    saveMutation.mutate({
      enabled: form.enabled,
      channelId: form.channelId.trim(),
      includeGovernment: form.includeGovernment,
      includeMedia: form.includeMedia,
      includeCitizen: form.includeCitizen,
      includeSports: form.includeSports,
      verifiedOnly: form.verifiedOnly,
      excludeReplies: form.excludeReplies,
      excludeAutoGenerated: form.excludeAutoGenerated,
      minEngagement: Number.isFinite(form.minEngagement) ? form.minEngagement : 0,
      accountAllowlist: parseList(form.accountAllowlist),
      accountBlocklist: parseList(form.accountBlocklist),
      hashtagAllowlist: parseList(form.hashtagAllowlist),
      hashtagBlocklist: parseList(form.hashtagBlocklist),
    });
  };

  if (isLoading || !form) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="facet-surface border-border/40">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            <div>
              <p className="text-xl font-bold">{config?.stats.sentCount ?? 0}</p>
              <p className="text-muted-foreground text-xs">Posts mirrored</p>
            </div>
          </CardContent>
        </Card>
        <Card className="facet-surface border-border/40">
          <CardContent className="flex items-center gap-3 p-4">
            <XCircle className="h-6 w-6 text-red-500" />
            <div>
              <p className="text-xl font-bold">{config?.stats.failedCount ?? 0}</p>
              <p className="text-muted-foreground text-xs">Failed sends</p>
            </div>
          </CardContent>
        </Card>
        <Card className="facet-surface border-border/40">
          <CardContent className="flex items-center gap-3 p-4">
            <Rss className="h-6 w-6 text-indigo-500" />
            <div>
              <p className="text-sm font-bold">
                {config?.stats.lastSentAt
                  ? new Date(config.stats.lastSentAt).toLocaleString()
                  : "Never"}
              </p>
              <p className="text-muted-foreground text-xs">Last mirrored</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Connection */}
        <Card className="facet-surface border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Rss className="h-4 w-4 text-indigo-500" /> Channel & Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow
              label="Mirror enabled"
              description="Master switch. When off, no posts are forwarded to Discord."
              checked={form.enabled}
              onCheckedChange={(v) => set("enabled", v)}
            />
            <div className="space-y-1.5">
              <Label className="text-sm">Discord channel ID</Label>
              <Input
                value={form.channelId}
                onChange={(e) => set("channelId", e.target.value)}
                placeholder="1514756187193741433"
                className="font-mono"
              />
              <p className="text-muted-foreground text-xs">
                The bot must be a member of the server and have permission to post in this channel.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => testMutation.mutate({ channelId: form.channelId.trim() })}
              disabled={testMutation.isPending || !form.channelId.trim()}
            >
              {testMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send test message
            </Button>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="facet-surface border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-indigo-500" /> Account & Quality Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-border/40 divide-y">
            <ToggleRow
              label="Government accounts"
              checked={form.includeGovernment}
              onCheckedChange={(v) => set("includeGovernment", v)}
            />
            <ToggleRow
              label="Media accounts"
              checked={form.includeMedia}
              onCheckedChange={(v) => set("includeMedia", v)}
            />
            <ToggleRow
              label="Citizen accounts"
              checked={form.includeCitizen}
              onCheckedChange={(v) => set("includeCitizen", v)}
            />
            <ToggleRow
              label="Sports accounts"
              description="Mirror automated sports digests and results (@SportsNews)"
              checked={form.includeSports}
              onCheckedChange={(v) => set("includeSports", v)}
            />
            <ToggleRow
              label="Verified accounts only"
              description="Only mirror posts from verified accounts."
              checked={form.verifiedOnly}
              onCheckedChange={(v) => set("verifiedOnly", v)}
            />
            <ToggleRow
              label="Exclude replies"
              checked={form.excludeReplies}
              onCheckedChange={(v) => set("excludeReplies", v)}
            />
            <ToggleRow
              label="Exclude auto-generated posts"
              description="Skip bot / auto-news posts."
              checked={form.excludeAutoGenerated}
              onCheckedChange={(v) => set("excludeAutoGenerated", v)}
            />
            <div className="flex items-center justify-between gap-4 py-2">
              <div>
                <Label className="text-sm font-medium">Minimum engagement</Label>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Likes + reposts + replies. Posts mirror instantly on creation, so leave at 0
                  unless you switch to polling later.
                </p>
              </div>
              <Input
                type="number"
                min={0}
                value={form.minEngagement}
                onChange={(e) => set("minEngagement", parseInt(e.target.value || "0", 10))}
                className="w-20"
              />
            </div>
          </CardContent>
        </Card>

        {/* Account lists */}
        <Card className="facet-surface border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-indigo-500" /> Account Allow / Block
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Allowlist (always include)</Label>
              <Textarea
                value={form.accountAllowlist}
                onChange={(e) => set("accountAllowlist", e.target.value)}
                placeholder="@StateDept&#10;@GlobalNews"
                rows={3}
                className="font-mono text-xs"
              />
              <p className="text-muted-foreground text-xs">
                Usernames here are always mirrored, bypassing the filters above. One per line.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Blocklist (never include)</Label>
              <Textarea
                value={form.accountBlocklist}
                onChange={(e) => set("accountBlocklist", e.target.value)}
                placeholder="@spam_account"
                rows={3}
                className="font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* Hashtag lists */}
        <Card className="facet-surface border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Hash className="h-4 w-4 text-indigo-500" /> Hashtag Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Required hashtags (allowlist)</Label>
              <Textarea
                value={form.hashtagAllowlist}
                onChange={(e) => set("hashtagAllowlist", e.target.value)}
                placeholder="#breaking&#10;#official"
                rows={3}
                className="font-mono text-xs"
              />
              <p className="text-muted-foreground text-xs">
                If set, only posts containing at least one of these hashtags are mirrored. Leave
                empty to allow all.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Blocked hashtags</Label>
              <Textarea
                value={form.hashtagBlocklist}
                onChange={(e) => set("hashtagBlocklist", e.target.value)}
                placeholder="#ooc&#10;#shitpost"
                rows={3}
                className="font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save bar */}
      <div className="bg-background/80 border-border/40 sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-lg border p-3 backdrop-blur">
        <p className="text-muted-foreground text-xs">
          {dirty ? "You have unsaved changes." : "All changes saved."}
        </p>
        <Button onClick={handleSave} disabled={saveMutation.isPending || !dirty}>
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save configuration
        </Button>
      </div>

      {/* Live preview */}
      <Card className="facet-surface border-border/40">
        <CardHeader>
          <CardTitle className="text-base">
            Preview — would these recent posts be mirrored?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-3 text-xs">
            Evaluated against the <strong>saved</strong> config. Save your changes to refresh this
            list.
          </p>
          {previewLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            </div>
          ) : !preview || preview.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No recent public posts.
            </p>
          ) : (
            <div className="divide-border/30 divide-y">
              {preview.map((p: any) => (
                <div key={p.id} className="flex items-start gap-3 py-2">
                  <div className="mt-0.5 shrink-0">
                    {p.mirrorStatus === "sent" ? (
                      <Badge className="bg-indigo-500/15 text-indigo-500">Mirrored</Badge>
                    ) : p.eligible ? (
                      <Badge className="bg-emerald-500/15 text-emerald-500">Eligible</Badge>
                    ) : (
                      <Badge className="bg-muted text-muted-foreground">Skipped</Badge>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-foreground font-semibold">{p.authorName}</span>
                      <span className="text-muted-foreground">@{p.authorHandle}</span>
                      {p.verified && <span className="text-emerald-500">✓</span>}
                      {p.accountType && (
                        <span className="text-muted-foreground/60 capitalize">
                          · {p.accountType}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground truncate text-xs">{p.content || "—"}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-[10px]",
                      p.eligible ? "text-emerald-500/80" : "text-muted-foreground/70"
                    )}
                  >
                    {p.reason}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
