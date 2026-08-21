"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { useNotify } from "~/hooks/useNotify";
import { Send, Plus, Bell, MessageSquare, Crown, Shield, Globe, Sparkles } from "lucide-react";
import { cn } from "~/lib/utils";

type BroadcastMode = "platform_alert" | "system_message" | "direct_message";

const TYPES = [
  "info",
  "warning",
  "success",
  "error",
  "alert",
  "update",
  "economic",
  "crisis",
  "diplomatic",
  "system",
] as const;

const LEVELS = ["low", "medium", "high", "critical"] as const;

const CATEGORIES = [
  "system",
  "economic",
  "diplomatic",
  "governance",
  "social",
  "security",
  "achievement",
  "crisis",
  "opportunity",
  "intelligence",
  "policy",
  "global",
  "military",
] as const;

const DIPLOMATIC_CLASSIFICATIONS = [
  "PUBLIC",
  "RESTRICTED",
  "CONFIDENTIAL",
  "SECRET",
  "TOP_SECRET",
] as const;

interface FormState {
  mode: BroadcastMode;
  title: string;
  description: string;
  type: string;
  level: "low" | "medium" | "high" | "critical";
  category: string;
  href: string;
  userId: string;
  countryId: string;
  scope: "global" | "user" | "country";
  actionable: boolean;
  classification: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL" | "SECRET" | "TOP_SECRET";
  conversationType: "personal" | "diplomatic" | "official";
}

const emptyForm: FormState = {
  mode: "platform_alert",
  title: "",
  description: "",
  type: "system",
  level: "medium",
  category: "system",
  href: "",
  userId: "",
  countryId: "",
  scope: "global",
  actionable: false,
  classification: "CONFIDENTIAL",
  conversationType: "official",
};

const PRESETS = [
  {
    label: "Engine Release",
    mode: "system_message" as BroadcastMode,
    fill: {
      title: "🚀 IxStates 1.4.0 Engine Update Deployed",
      description: "Platform performance upgraded with TypeScript 7.0 Go Engine and real-time mesh caching.",
      type: "system",
      level: "high" as const,
      category: "system",
      scope: "global" as const,
      actionable: false,
    },
  },
  {
    label: "Crisis Alert",
    mode: "platform_alert" as BroadcastMode,
    fill: {
      title: "🚨 System Crisis Detected",
      description: "A major economic or geopolitical crisis event has been detected requiring immediate attention.",
      type: "crisis",
      level: "critical" as const,
      category: "crisis",
      scope: "global" as const,
      actionable: true,
    },
  },
  {
    label: "Diplomatic Dispatch",
    mode: "direct_message" as BroadcastMode,
    fill: {
      title: "Summons for Bilateral Security Consultation",
      description: "The Executive Council requests an immediate bilateral diplomatic review regarding regional borders.",
      type: "diplomatic",
      level: "high" as const,
      category: "diplomatic",
      scope: "country" as const,
      classification: "TOP_SECRET" as const,
      conversationType: "diplomatic" as const,
      actionable: true,
    },
  },
  {
    label: "Scheduled Maintenance",
    mode: "platform_alert" as BroadcastMode,
    fill: {
      title: "🔧 Scheduled System Maintenance",
      description: "The platform simulation engine will undergo routine indexing in 2 hours.",
      type: "system",
      level: "medium" as const,
      category: "system",
      scope: "global" as const,
      actionable: false,
    },
  },
  {
    label: "Milestone / Reward",
    mode: "system_message" as BroadcastMode,
    fill: {
      title: "🏆 National Milestone Achieved!",
      description: "Your nation has achieved a significant economic development threshold. Stash rewards unlocked.",
      type: "success",
      level: "high" as const,
      category: "achievement",
      scope: "country" as const,
      actionable: true,
    },
  },
];

export function NotificationComposer() {
  const { userId } = useAuth();
  const notify = useNotify();
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: countries } = api.countries.getSelectList.useQuery({ limit: 250 });

  // Mutations
  const createNotificationMutation = api.notifications.createNotification.useMutation({
    onSuccess: () => {
      notify.success("Platform alert broadcasted successfully");
      setForm(emptyForm);
    },
    onError: (e) => notify.error("Failed to broadcast alert", e.message),
  });

  const sendBroadcastMutation = api.messages.sendAdminBroadcast.useMutation({
    onSuccess: () => {
      notify.success("System Message published to inbox feed");
      setForm(emptyForm);
    },
    onError: (e) => notify.error("Failed to publish System Message", e.message),
  });

  const sendDirectMessageMutation = api.messages.sendAdminMessage.useMutation({
    onSuccess: () => {
      notify.success("Direct Admin Message dispatched");
      setForm(emptyForm);
    },
    onError: (e) => notify.error("Failed to send message", e.message),
  });

  const handleField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setForm((prev) => ({
      ...prev,
      mode: preset.mode,
      ...preset.fill,
    }));
  };

  const isPending =
    createNotificationMutation.isPending ||
    sendBroadcastMutation.isPending ||
    sendDirectMessageMutation.isPending;

  const handleSubmit = () => {
    if (!form.title.trim()) {
      notify.error("Title or subject is required");
      return;
    }

    if (form.mode === "platform_alert") {
      createNotificationMutation.mutate({
        title: form.title,
        description: form.description || undefined,
        type: form.type as any,
        level: form.level as any,
        category: form.category ? (form.category as any) : undefined,
        href: form.href || undefined,
        userId: form.scope === "user" && form.userId ? form.userId : undefined,
        countryId: form.scope === "country" && form.countryId ? form.countryId : undefined,
        adminUserId: userId ?? "system-admin",
        actionable: form.actionable,
      });
    } else if (form.mode === "system_message") {
      sendBroadcastMutation.mutate({
        title: form.title,
        description: form.description || undefined,
        category: form.category,
        level: form.level,
        type: form.type,
        href: form.href || undefined,
        scope: form.scope,
        countryId: form.countryId || undefined,
        userId: form.userId || undefined,
        actionable: form.actionable,
      });
    } else if (form.mode === "direct_message") {
      if (form.scope === "user" && !form.userId.trim()) {
        notify.error("User ID is required for direct message");
        return;
      }
      const targetUserId = form.scope === "user" ? form.userId.trim() : (userId ?? "system-user");
      sendDirectMessageMutation.mutate({
        targetUserId,
        content: form.description ? `${form.title}\n\n${form.description}` : form.title,
        subject: form.title,
        source: form.conversationType === "diplomatic" ? "diplomatic" : "system",
        conversationType: form.conversationType,
        classification: form.classification,
      });
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Compose form */}
      <div className="space-y-6 lg:col-span-2">
        {/* Mode Selector */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Delivery Destination
            </CardTitle>
            <CardDescription className="text-xs">
              Choose where and how this message will be delivered across IxStates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => handleField("mode", "platform_alert")}
                className={cn(
                  "flex cursor-pointer flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all active:scale-[0.98]",
                  form.mode === "platform_alert"
                    ? "border-rose-500/50 bg-rose-500/10 text-foreground shadow-2xs"
                    : "border-border/40 bg-card/40 text-muted-foreground hover:border-border/80 hover:bg-card/80"
                )}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <Bell className="h-3.5 w-3.5 text-rose-500" />
                  Platform Alert
                </div>
                <p className="text-[11px] leading-tight text-muted-foreground">
                  Halo tray & realtime notification center.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleField("mode", "system_message")}
                className={cn(
                  "flex cursor-pointer flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all active:scale-[0.98]",
                  form.mode === "system_message"
                    ? "border-amber-500/50 bg-amber-500/10 text-foreground shadow-2xs"
                    : "border-border/40 bg-card/40 text-muted-foreground hover:border-border/80 hover:bg-card/80"
                )}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <Crown className="h-3.5 w-3.5 text-amber-500" />
                  System Message
                </div>
                <p className="text-[11px] leading-tight text-muted-foreground">
                  Pinned System Messages thread in /messages inbox.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleField("mode", "direct_message")}
                className={cn(
                  "flex cursor-pointer flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all active:scale-[0.98]",
                  form.mode === "direct_message"
                    ? "border-indigo-500/50 bg-indigo-500/10 text-foreground shadow-2xs"
                    : "border-border/40 bg-card/40 text-muted-foreground hover:border-border/80 hover:bg-card/80"
                )}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <MessageSquare className="h-3.5 w-3.5 text-indigo-500" />
                  Direct Dispatch
                </div>
                <p className="text-[11px] leading-tight text-muted-foreground">
                  Direct conversation or diplomatic cable in /messages.
                </p>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Templates */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-semibold">
              <Plus className="h-3.5 w-3.5" />
              Quick Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] font-medium"
                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main form */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Send className="h-4 w-4" />
              {form.mode === "platform_alert" && "Compose Platform Alert"}
              {form.mode === "system_message" && "Publish System Message"}
              {form.mode === "direct_message" && "Compose Direct Dispatch"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                {form.mode === "direct_message" ? "Subject *" : "Title *"}
              </Label>
              <Input
                placeholder={
                  form.mode === "direct_message"
                    ? "Diplomatic Summons / Message Subject"
                    : "e.g. 🚀 IxStates 1.4.0 Engine Update"
                }
                value={form.title}
                onChange={(e) => handleField("title", e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                {form.mode === "direct_message" ? "Message Content *" : "Description / Body"}
              </Label>
              <Textarea
                placeholder="Message body or event description"
                value={form.description}
                onChange={(e) => handleField("description", e.target.value)}
                rows={4}
                className="text-xs"
              />
            </div>

            {form.mode === "direct_message" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Conversation Type</Label>
                  <Select
                    value={form.conversationType}
                    onValueChange={(v) => handleField("conversationType", v as any)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="official">Official System Dispatch</SelectItem>
                      <SelectItem value="diplomatic">Diplomatic Cable</SelectItem>
                      <SelectItem value="personal">Personal Direct Message</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Security Classification</Label>
                  <Select
                    value={form.classification}
                    onValueChange={(v) => handleField("classification", v as any)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIPLOMATIC_CLASSIFICATIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Type</Label>
                  <Select value={form.type} onValueChange={(v) => handleField("type", v)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Level / Priority</Label>
                  <Select value={form.level} onValueChange={(v) => handleField("level", v as any)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l.charAt(0).toUpperCase() + l.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Category</Label>
                <Select value={form.category} onValueChange={(v) => handleField("category", v)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Recipient Scope</Label>
                <Select
                  value={form.scope}
                  onValueChange={(v) => handleField("scope", v as FormState["scope"])}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (All Users)</SelectItem>
                    <SelectItem value="country">Country Specific</SelectItem>
                    <SelectItem value="user">Specific User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.scope === "country" && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Target Country</Label>
                <Select value={form.countryId} onValueChange={(v) => handleField("countryId", v)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.scope === "user" && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Target User ID (Clerk ID)</Label>
                <Input
                  placeholder="e.g. user_2abc..."
                  value={form.userId}
                  onChange={(e) => handleField("userId", e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Action Link (optional)</Label>
              <Input
                placeholder="e.g. /mycountry or /maps"
                value={form.href}
                onChange={(e) => handleField("href", e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Switch
                checked={form.actionable}
                onCheckedChange={(v) => handleField("actionable", v)}
              />
              <Label className="text-xs font-medium cursor-pointer">
                Actionable (highlights action button in UI)
              </Label>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isPending}
              className="w-full cursor-pointer font-semibold shadow-xs"
              size="lg"
            >
              <Send className="mr-2 h-4 w-4" />
              {isPending ? "Transmitting..." : "Send Message"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar Live Preview */}
      <div className="space-y-4">
        <Card className="border-border/60 bg-card/60 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              Live Preview
            </CardTitle>
            <CardDescription className="text-xs">
              Render preview as seen by recipient players.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {form.mode === "platform_alert" && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.06] p-3.5 shadow-xs">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-400">
                    <Shield className="h-3 w-3" />
                    {form.level} Priority Alert
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">Just now</span>
                </div>
                <h4 className="text-xs font-bold text-foreground">
                  {form.title || "Notification Title"}
                </h4>
                <p className="text-[11px] leading-relaxed text-muted-foreground mt-1">
                  {form.description || "Notification body preview will appear here."}
                </p>
              </div>
            )}

            {form.mode === "system_message" && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3.5 shadow-xs">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    <Crown className="h-3 w-3" />
                    System Dispatch • {form.category}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">10:42 AM</span>
                </div>
                <h4 className="text-xs font-bold text-foreground">
                  {form.title || "System Message Title"}
                </h4>
                <p className="text-[11px] leading-relaxed text-muted-foreground mt-1">
                  {form.description || "Event summary and dispatch details."}
                </p>
                {form.actionable && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                      Open Action →
                    </div>
                  </div>
                )}
              </div>
            )}

            {form.mode === "direct_message" && (
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/[0.06] p-3.5 shadow-xs">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    <Globe className="h-3 w-3" />
                    {form.classification} // {form.conversationType.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">Just now</span>
                </div>
                <h4 className="text-xs font-bold text-foreground">
                  {form.title || "Subject Line"}
                </h4>
                <p className="text-[11px] leading-relaxed text-muted-foreground mt-1 whitespace-pre-wrap">
                  {form.description || "Direct dispatch message contents."}
                </p>
              </div>
            )}

            <div className="pt-2 text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Recipient Scope:</strong>{" "}
                {form.scope === "global"
                  ? "Global (All Players)"
                  : form.scope === "country"
                    ? "Target Country"
                    : "Individual Player"}
              </p>
              <p>
                <strong>Delivery Mode:</strong>{" "}
                {form.mode === "platform_alert"
                  ? "Halo Notification Tray"
                  : form.mode === "system_message"
                    ? "Inbox / System Messages Feed"
                    : "Direct Conversation Inbox"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
