"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
import { Send, Plus, Bell } from "lucide-react";

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
  "economic",
  "diplomatic",
  "governance",
  "social",
  "security",
  "system",
  "achievement",
  "crisis",
  "opportunity",
  "intelligence",
  "policy",
  "global",
  "military",
] as const;

interface FormState {
  title: string;
  description: string;
  type: string;
  level: string;
  category: string;
  href: string;
  userId: string;
  countryId: string;
  scope: "global" | "user" | "country";
  actionable: boolean;
}

const emptyForm: FormState = {
  title: "",
  description: "",
  type: "info",
  level: "medium",
  category: "",
  href: "",
  userId: "",
  countryId: "",
  scope: "global",
  actionable: false,
};

const PRESETS = [
  {
    label: "Crisis Alert",
    fill: {
      title: "🚨 System Crisis Detected",
      description: "A major crisis event has been detected requiring immediate attention.",
      type: "crisis",
      level: "critical",
      category: "crisis",
      actionable: true,
    },
  },
  {
    label: "Achievement",
    fill: {
      title: "🏆 Milestone Achieved!",
      description: "Your nation has achieved a significant economic milestone.",
      type: "success",
      level: "high",
      category: "achievement",
      actionable: false,
    },
  },
  {
    label: "Maintenance",
    fill: {
      title: "🔧 Scheduled Maintenance",
      description:
        "The system will undergo maintenance in 2 hours. Some features may be unavailable.",
      type: "system",
      level: "medium",
      category: "system",
      actionable: false,
    },
  },
  {
    label: "Policy Update",
    fill: {
      title: "📋 New Policy Enacted",
      description: "A new government policy has been enacted with significant economic impact.",
      type: "update",
      level: "high",
      category: "governance",
      actionable: true,
    },
  },
  {
    label: "Trade Alert",
    fill: {
      title: "🤝 New Trade Agreement",
      description: "A new bilateral trade agreement has been signed with favorable terms.",
      type: "diplomatic",
      level: "medium",
      category: "diplomatic",
      actionable: false,
    },
  },
  {
    label: "Security Threat",
    fill: {
      title: "🛡️ Security Threat Detected",
      description: "Intelligence indicates an imminent security threat. Take defensive measures.",
      type: "warning",
      level: "critical",
      category: "security",
      actionable: true,
    },
  },
];

export function NotificationComposer() {
  const { userId } = useAuth();
  const notify = useNotify();
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: countries } = api.countries.getAll.useQuery();

  const createMutation = api.notifications.createNotification.useMutation({
    onSuccess: () => {
      notify.success("Notification sent");
      setForm(emptyForm);
    },
    onError: (e) => notify.error("Failed to send", e.message),
  });

  const handleField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setForm((prev) => ({ ...prev, ...preset.fill }));
  };

  const handleSubmit = () => {
    if (!form.title.trim()) {
      notify.error("Title required");
      return;
    }

    createMutation.mutate({
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
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Compose form */}
      <div className="space-y-6 lg:col-span-2">
        {/* Templates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" />
              Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button key={p.label} variant="outline" size="sm" onClick={() => applyPreset(p)}>
                  {p.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Send className="h-4 w-4" />
              Compose Notification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="Notification title"
                value={form.title}
                onChange={(e) => handleField("title", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Notification description / body"
                value={form.description}
                onChange={(e) => handleField("description", e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => handleField("type", v)}>
                  <SelectTrigger>
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
                <Label>Level / Priority</Label>
                <Select value={form.level} onValueChange={(v) => handleField("level", v)}>
                  <SelectTrigger>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => handleField("category", v)}>
                  <SelectTrigger>
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
                <Label>Scope</Label>
                <Select
                  value={form.scope}
                  onValueChange={(v) => handleField("scope", v as FormState["scope"])}
                >
                  <SelectTrigger>
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
                <Label>Country</Label>
                <Select value={form.countryId} onValueChange={(v) => handleField("countryId", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries?.countries?.map((c) => (
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
                <Label>User ID</Label>
                <Input
                  placeholder="Clerk User ID"
                  value={form.userId}
                  onChange={(e) => handleField("userId", e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Link (optional)</Label>
              <Input
                placeholder="https://..."
                value={form.href}
                onChange={(e) => handleField("href", e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.actionable}
                onCheckedChange={(v) => handleField("actionable", v)}
              />
              <Label>Actionable (user can take action)</Label>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="w-full"
              size="lg"
            >
              <Send className="mr-2 h-4 w-4" />
              {createMutation.isPending ? "Sending..." : "Send Notification"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4" />
              Delivery Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="text-muted-foreground space-y-1">
              <p>
                <strong>Global:</strong> All users receive this notification.
              </p>
              <p>
                <strong>Country:</strong> All users belonging to the selected country receive it.
              </p>
              <p>
                <strong>User:</strong> Only the specified user receives it.
              </p>
              <p className="mt-2">
                Notifications are delivered in real-time via WebSocket when users are active, or
                fetched on next page load.
              </p>
            </div>
          </CardContent>
        </Card>

        {createMutation.isPending && (
          <Card>
            <CardContent className="text-muted-foreground p-4 text-center text-sm">
              Sending notification...
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
