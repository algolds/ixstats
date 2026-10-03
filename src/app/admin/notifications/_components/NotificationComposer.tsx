"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { ALL_REALMS } from "~/lib/realms/realm-ids";
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
import { ValueSelect } from "~/components/ui/value-select";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { RadioCard, RadioCardGroup } from "~/components/ui/radio-card";
import { useNotify } from "~/hooks/useNotify";
import {
  Send,
  Plus,
  Bell,
  ChatBubble as MessageSquare,
  Crown,
  Shield,
  Globe,
  Sparks as Sparkles,
} from "iconoir-react";

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
    label: "Engine release",
    mode: "system_message" as BroadcastMode,
    fill: {
      title: "🚀 IxStates 1.4.0 Engine Update Deployed",
      description:
        "Platform performance upgraded with TypeScript 7.0 Go Engine and real-time mesh caching.",
      type: "system",
      level: "high" as const,
      category: "system",
      scope: "global" as const,
      actionable: false,
    },
  },
  {
    label: "Crisis alert",
    mode: "platform_alert" as BroadcastMode,
    fill: {
      title: "🚨 System Crisis Detected",
      description:
        "A major economic or geopolitical crisis event has been detected requiring immediate attention.",
      type: "crisis",
      level: "critical" as const,
      category: "crisis",
      scope: "global" as const,
      actionable: true,
    },
  },
  {
    label: "Diplomatic dispatch",
    mode: "direct_message" as BroadcastMode,
    fill: {
      title: "Summons for Bilateral Security Consultation",
      description:
        "The Executive Council requests an immediate bilateral diplomatic review regarding regional borders.",
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
    label: "Scheduled maintenance",
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
      description:
        "Your nation has achieved a significant economic development threshold. Stash rewards unlocked.",
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

  const { data: countries } = api.countries.getSelectList.useQuery({
    limit: 250,
    realm: ALL_REALMS,
  });

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
      <div className="space-y-6 lg:col-span-2">
        <Card className="flex flex-col gap-6 py-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-headline flex items-center gap-2">
              <Sparkles className="text-yellow h-4 w-4" />
              Delivery destination
            </CardTitle>
            <CardDescription className="text-footnote">
              Choose where and how this message will be delivered across IxStates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioCardGroup
              aria-label="Delivery destination"
              columns={3}
              value={form.mode}
              onValueChange={(mode) => handleField("mode", mode as BroadcastMode)}
            >
              <RadioCard
                value="platform_alert"
                icon={<Bell className="text-red" />}
                title="Platform alert"
                description="Halo tray & realtime notification center."
              />
              <RadioCard
                value="system_message"
                icon={<Crown className="text-yellow" />}
                title="System message"
                description="Pinned System Messages thread in /messages inbox."
              />
              <RadioCard
                value="direct_message"
                icon={<MessageSquare className="text-indigo" />}
                title="Direct dispatch"
                description="Direct conversation or diplomatic cable in /messages."
              />
            </RadioCardGroup>
          </CardContent>
        </Card>

        <Card className="flex flex-col gap-6 py-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-caption flex items-center gap-2">
              <Plus className="h-3.5 w-3.5" />
              Quick templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"

                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col gap-6 py-6">
          <CardHeader>
            <CardTitle className="text-headline flex items-center gap-2">
              <Send className="h-4 w-4" />
              {form.mode === "platform_alert" && "Compose Platform Alert"}
              {form.mode === "system_message" && "Publish System Message"}
              {form.mode === "direct_message" && "Compose Direct Dispatch"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-caption">
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
                className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-caption">
                {form.mode === "direct_message" ? "Message Content *" : "Description / Body"}
              </Label>
              <Textarea
                placeholder="Message body or event description"
                value={form.description}
                onChange={(e) => handleField("description", e.target.value)}
                rows={4}
                className="md:text-footnote"
              />
            </div>

            {form.mode === "direct_message" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-caption">Conversation type</Label>
                  <ValueSelect
                    value={form.conversationType}
                    onValueChange={(v) => handleField("conversationType", v as any)}
                    options={[
                      ["official", "Official system dispatch"],
                      ["diplomatic", "Diplomatic cable"],
                      ["personal", "Personal direct message"],
                    ]}
                    size="sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-caption">Security classification</Label>
                  <ValueSelect
                    value={form.classification}
                    onValueChange={(v) => handleField("classification", v as any)}
                    options={DIPLOMATIC_CLASSIFICATIONS.map((c) => [c, c] as const)}
                    size="sm"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-caption">Type</Label>
                  <ValueSelect
                    value={form.type}
                    onValueChange={(v) => handleField("type", v)}
                    options={TYPES.map((t) => [t, t.charAt(0).toUpperCase() + t.slice(1)] as const)}
                    size="sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-caption">Level / Priority</Label>
                  <ValueSelect
                    value={form.level}
                    onValueChange={(v) => handleField("level", v as any)}
                    options={LEVELS.map(
                      (l) => [l, l.charAt(0).toUpperCase() + l.slice(1)] as const
                    )}
                    size="sm"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-caption">Category</Label>
                <ValueSelect
                  value={form.category}
                  onValueChange={(v) => handleField("category", v)}
                  options={CATEGORIES.map(
                    (c) => [c, c.charAt(0).toUpperCase() + c.slice(1)] as const
                  )}
                  size="sm"
                  placeholder="None"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-caption">Recipient scope</Label>
                <ValueSelect
                  value={form.scope}
                  onValueChange={(v) => handleField("scope", v as FormState["scope"])}
                  options={[
                    ["global", "Global (All Users)"],
                    ["country", "Country specific"],
                    ["user", "Specific user"],
                  ]}
                  size="sm"
                />
              </div>
            </div>

            {form.scope === "country" && (
              <div className="space-y-2">
                <Label className="text-caption">Target country</Label>
                <Select value={form.countryId} onValueChange={(v) => handleField("countryId", v)}>
                  <SelectTrigger size="sm">
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
                <Label className="text-caption">Target User ID (Clerk ID)</Label>
                <Input
                  placeholder="e.g. user_2abc..."
                  value={form.userId}
                  onChange={(e) => handleField("userId", e.target.value)}
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-caption">Action Link (optional)</Label>
              <Input
                placeholder="e.g. /mycountry or /maps"
                value={form.href}
                onChange={(e) => handleField("href", e.target.value)}
                className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Switch
                checked={form.actionable}
                onCheckedChange={(v) => handleField("actionable", v)}
              />
              <Label className="text-caption cursor-pointer">
                Actionable (highlights action button in UI)
              </Label>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isPending}
              className="w-full cursor-pointer"
              size="lg"
            >
              <Send className="mr-2 h-4 w-4" />
              {isPending ? "Transmitting..." : "Send Message"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="flex flex-col gap-6 py-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-headline flex items-center gap-2">
              <Sparkles className="text-indigo h-4 w-4" />
              Live preview
            </CardTitle>
            <CardDescription className="text-footnote">
              Render preview as seen by recipient players.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {form.mode === "platform_alert" && (
              <div className="rounded-row border-red/30 bg-red/[0.06] border p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-eyebrow text-red flex items-center gap-2">
                    <Shield className="h-3 w-3" />
                    {form.level} Priority Alert
                  </span>
                  <span className="text-label-secondary text-footnote tabular-nums">Just now</span>
                </div>
                <h4 className="text-label text-caption">{form.title || "Notification Title"}</h4>
                <p className="text-label-secondary text-footnote mt-1 leading-relaxed">
                  {form.description || "Enter a description to preview the body."}
                </p>
              </div>
            )}

            {form.mode === "system_message" && (
              <div className="rounded-row border-yellow/30 bg-yellow/[0.06] border p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-eyebrow text-yellow flex items-center gap-2">
                    <Crown className="h-3 w-3" />
                    System Dispatch • {form.category}
                  </span>
                  <span className="text-label-secondary text-footnote tabular-nums">10:42 AM</span>
                </div>
                <h4 className="text-label text-caption">{form.title || "System Message Title"}</h4>
                <p className="text-label-secondary text-footnote mt-1 leading-relaxed">
                  {form.description || "Event summary and dispatch details."}
                </p>
                {form.actionable && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="rounded-control-sm border-yellow/40 bg-yellow/15 text-caption text-yellow border px-2 py-0.5">
                      Open Action →
                    </div>
                  </div>
                )}
              </div>
            )}

            {form.mode === "direct_message" && (
              <div className="rounded-row border-indigo/30 bg-indigo/[0.06] border p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-eyebrow text-indigo flex items-center gap-2">
                    <Globe className="h-3 w-3" />
                    {form.classification}
                    {" // "}
                    {form.conversationType.toUpperCase()}
                  </span>
                  <span className="text-label-secondary text-footnote tabular-nums">Just now</span>
                </div>
                <h4 className="text-label text-caption">{form.title || "Subject Line"}</h4>
                <p className="text-label-secondary text-footnote mt-1 leading-relaxed whitespace-pre-wrap">
                  {form.description || "Direct dispatch message contents."}
                </p>
              </div>
            )}

            <div className="text-label-secondary text-footnote space-y-1 pt-2">
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
