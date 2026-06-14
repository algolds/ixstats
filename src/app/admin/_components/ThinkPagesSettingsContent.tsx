// src/app/admin/_components/ThinkPagesSettingsContent.tsx
"use client";

import { useState } from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "./AdminHeader";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Globe, Save, Check, MessageSquare, Flame, TrendingUp } from "lucide-react";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";

export function ThinkPagesSettingsContent() {
  usePageTitle({ title: "Admin - ThinkPages Settings" });
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
      <AdminHeader
        icon={Globe}
        title="ThinkPages Settings"
        description="Configure ThinkPages social feed properties, maximum character caps, auto-news election logs, and account guidelines."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="glass-surface border-border/40">
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

        <Card className="glass-surface border-border/40">
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

        <Card className="glass-surface border-border/40">
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

      <Card className="glass-surface border-border/40">
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
