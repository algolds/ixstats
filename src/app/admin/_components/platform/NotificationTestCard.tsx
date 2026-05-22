// src/app/admin/_components/platform/NotificationTestCard.tsx
"use client";

import { useState } from "react";
import { Bell, Play, Sparkles, AlertTriangle, ShieldAlert, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { useNotify } from "~/hooks/useNotify";
import type { ToastType, ToastPriority } from "~/stores/toastQueueStore";
import type { NotificationCategory } from "~/types/unified-notifications";

const CATEGORIES: { label: string; value: NotificationCategory }[] = [
  { label: "System", value: "system" },
  { label: "Economic", value: "economic" },
  { label: "Diplomatic", value: "diplomatic" },
  { label: "Social", value: "social" },
  { label: "Governance", value: "governance" },
  { label: "Policy", value: "policy" },
  { label: "Security", value: "security" },
  { label: "Achievement", value: "achievement" },
  { label: "Crisis", value: "crisis" },
  { label: "Intelligence", value: "intelligence" },
  { label: "Military", value: "military" },
];

const TYPES: { label: string; value: ToastType }[] = [
  { label: "Success", value: "success" },
  { label: "Info", value: "info" },
  { label: "Warning", value: "warning" },
  { label: "Error", value: "error" },
];

const PRIORITIES: { label: string; value: ToastPriority }[] = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Critical", value: "critical" },
];

export function NotificationTestCard() {
  const notify = useNotify();

  const [title, setTitle] = useState("Test Alert");
  const [message, setMessage] = useState("This is a simulated notification from the admin panel.");
  const [type, setType] = useState<ToastType>("info");
  const [priority, setPriority] = useState<ToastPriority>("medium");
  const [category, setCategory] = useState<NotificationCategory>("system");
  const [persistent, setPersistent] = useState(false);
  const [silent, setSilent] = useState(false);
  const [duration, setDuration] = useState("5000");
  const [hasAction, setHasAction] = useState(false);

  const handleTrigger = () => {
    const parsedDuration = duration ? parseInt(duration, 10) : undefined;
    
    notify.notify({
      title,
      message: message || undefined,
      type,
      priority,
      category,
      persistent,
      silent,
      duration: parsedDuration,
      actions: hasAction
        ? [
            {
              label: "Run Test Callback",
              onClick: () => {
                // Trigger a secondary success message to verify callback invocation
                notify.success(
                  "Callback Executed",
                  "The action callback on the test notification ran successfully!"
                );
              },
            },
          ]
        : undefined,
    });
  };

  // Preset triggers
  const triggerPreset = (preset: string) => {
    switch (preset) {
      case "crisis":
        notify.notify({
          title: "Major Crisis Declared",
          message: "A severe diplomatic crisis has broken out in Sector 4. Immediate intervention required.",
          type: "error",
          priority: "critical",
          category: "crisis",
          persistent: true,
          actions: [
            {
              label: "Deploy Peacekeepers",
              onClick: () => notify.success("Crisis Addressed", "Peacekeepers deployed successfully."),
            },
          ],
        });
        break;
      case "achievement":
        notify.notify({
          title: "Milestone Achieved!",
          message: "Your nation has entered the top 5% of global GDP per capita.",
          type: "success",
          priority: "high",
          category: "achievement",
          duration: 7000,
        });
        break;
      case "security":
        notify.notify({
          title: "Intrusion Attempt Blocked",
          message: "Firewall detected and neutralized a brute force attack on your intelligence database.",
          type: "warning",
          priority: "high",
          category: "security",
          duration: 6000,
        });
        break;
      case "trade":
        notify.notify({
          title: "New Trade Pact Proposal",
          message: "Burgundie has sent a bilateral commerce treaty proposal offering +12% Tariff efficiency.",
          type: "info",
          priority: "medium",
          category: "economic",
          duration: 5000,
          actions: [
            {
              label: "Accept Treaty",
              onClick: () => notify.success("Treaty Signed", "The trade agreement is now active."),
            },
          ],
        });
        break;
      default:
        break;
    }
  };

  return (
    <Card className="glass-card-parent border-indigo-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-indigo-500" />
          Notification Simulator Suite
        </CardTitle>
        <CardDescription>
          Simulate notifications and test Dynamic Island animations (scale bump, ripple, critical pulse) and Sonner toast rendering.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preset Buttons */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Test Presets</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerPreset("crisis")}
              className="border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/10 dark:text-red-400"
            >
              <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
              Crisis Alert
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerPreset("achievement")}
              className="border-emerald-500/20 bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500/10 dark:text-emerald-400"
            >
              <Award className="mr-1.5 h-3.5 w-3.5" />
              Achievement
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerPreset("security")}
              className="border-amber-500/20 bg-amber-500/5 text-amber-500 hover:bg-amber-500/10 dark:text-amber-400"
            >
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
              Security Intel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerPreset("trade")}
              className="border-blue-500/20 bg-blue-500/5 text-blue-500 hover:bg-blue-500/10 dark:text-blue-400"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Trade Pact
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Custom Notification Config */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="notif-title">Title</Label>
              <Input
                id="notif-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter alert title..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notif-message">Message</Label>
              <Textarea
                id="notif-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter alert description..."
                className="h-20"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="notif-type">Type</Label>
                <select
                  id="notif-type"
                  value={type}
                  onChange={(e) => setType(e.target.value as ToastType)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notif-priority">Priority</Label>
                <select
                  id="notif-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as ToastPriority)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notif-category">Category</Label>
              <select
                id="notif-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as NotificationCategory)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Behavior Settings */}
          <div className="space-y-4 rounded-lg border border-border/40 bg-card/40 p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Persistent Alert</Label>
                <p className="text-xs text-muted-foreground">Requires manual closing; will not auto-dismiss.</p>
              </div>
              <Switch checked={persistent} onCheckedChange={setPersistent} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Silent Alert</Label>
                <p className="text-xs text-muted-foreground">Only add to notification center, suppress toast banner.</p>
              </div>
              <Switch checked={silent} onCheckedChange={setSilent} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">With Action Callback</Label>
                <p className="text-xs text-muted-foreground">Includes a clickable action button on the toast.</p>
              </div>
              <Switch checked={hasAction} onCheckedChange={setHasAction} />
            </div>

            <div className="space-y-1.5 pt-2">
              <Label htmlFor="notif-duration">Auto-dismiss Duration (ms)</Label>
              <Input
                id="notif-duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="5000"
                disabled={persistent}
              />
            </div>
          </div>
        </div>

        <Button onClick={handleTrigger} size="lg" className="w-full bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600">
          <Play className="mr-2 h-4 w-4" />
          Trigger Custom Notification
        </Button>
      </CardContent>
    </Card>
  );
}

export default NotificationTestCard;
