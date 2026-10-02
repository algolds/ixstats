"use client";
// src/app/admin/_components/platform/NotificationTestCard.tsx

import { useState } from "react";
import {
  Bell,
  Play,
  Sparks as Sparkles,
  WarningTriangle as AlertTriangle,
  ShieldAlert,
  Trophy as Award,
} from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { useNotify } from "~/hooks/useNotify";
import type { ToastType, ToastPriority } from "~/stores/toastQueueStore";
import type { NotificationCategory } from "~/types/unified-notifications";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

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
  const [showAdvanced, setShowAdvanced] = useState(false);

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
          message:
            "A severe diplomatic crisis has broken out in Sector 4. Immediate intervention required.",
          type: "error",
          priority: "critical",
          category: "crisis",
          persistent: true,
          actions: [
            {
              label: "Deploy Peacekeepers",
              onClick: () =>
                notify.success("Crisis Addressed", "Peacekeepers deployed successfully."),
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
          message:
            "Firewall detected and neutralized a brute force attack on your intelligence database.",
          type: "warning",
          priority: "high",
          category: "security",
          duration: 6000,
        });
        break;
      case "trade":
        notify.notify({
          title: "New Trade Pact Proposal",
          message:
            "Burgundie has sent a bilateral commerce treaty proposal offering +12% Tariff efficiency.",
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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-headline flex items-center gap-2">
              <Bell className="text-indigo h-4 w-4" />
              Notification Simulator Suite
            </CardTitle>
            <CardDescription className="text-footnote">
              Simulate notifications and test Dynamic Island animations (scale bump, ripple,
              critical pulse) and Sonner toast rendering.
            </CardDescription>
          </div>
          <div className="border-separator bg-surface rounded-control flex shrink-0 items-center gap-2 border px-3 py-2">
            <Label
              htmlFor="notif-advanced-mode"
              className="text-label-secondary text-subhead cursor-pointer select-none"
            >
              Custom Builder
            </Label>
            <Switch
              id="notif-advanced-mode"
              checked={showAdvanced}
              onCheckedChange={setShowAdvanced}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preset Buttons */}
        <div className="space-y-3">
          <Label className="text-label-secondary text-subhead">Test Presets</Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button
              variant="destructive"
              onClick={() => triggerPreset("crisis")}
              className="flex h-16 flex-col items-center justify-center gap-1"
            >
              <ShieldAlert className="h-5 w-5" />
              <span className="text-caption">Crisis Alert</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => triggerPreset("achievement")}
              className="flex h-16 flex-col items-center justify-center gap-1"
            >
              <Award className="h-5 w-5" />
              <span className="text-caption">Achievement</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => triggerPreset("security")}
              className="flex h-16 flex-col items-center justify-center gap-1"
            >
              <AlertTriangle className="h-5 w-5" />
              <span className="text-caption">Security Intel</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => triggerPreset("trade")}
              className="flex h-16 flex-col items-center justify-center gap-1"
            >
              <Sparkles className="h-5 w-5" />
              <span className="text-caption">Trade Pact</span>
            </Button>
          </div>
        </div>

        {showAdvanced && (
          <>
            <div className="border-separator animate-in fade-in duration-fast grid grid-cols-1 gap-6 border-t pt-4 md:grid-cols-2">
              {/* Custom Notification Config */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notif-title" className="text-label-secondary text-subhead">
                    Title
                  </Label>
                  <Input
                    id="notif-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter alert title..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notif-message" className="text-label-secondary text-subhead">
                    Message
                  </Label>
                  <Textarea
                    id="notif-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter alert description..."
                    className="h-20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="notif-type" className="text-label-secondary text-subhead">
                      Type
                    </Label>
                    <Select value={type} onValueChange={(v) => setType(v as ToastType)}>
                      <SelectTrigger size="sm" id="notif-type" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notif-priority" className="text-label-secondary text-subhead">
                      Priority
                    </Label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as ToastPriority)}>
                      <SelectTrigger size="sm" id="notif-priority" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notif-category" className="text-label-secondary text-subhead">
                    Category
                  </Label>
                  <Select
                    value={category}
                    onValueChange={(v) => setCategory(v as NotificationCategory)}
                  >
                    <SelectTrigger size="sm" id="notif-category" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Behavior Settings */}
              <div className="bg-surface border-separator rounded-row space-y-4 border p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-body font-medium">Persistent Alert</Label>
                    <p className="text-label-secondary text-footnote">
                      Requires manual closing; will not auto-dismiss.
                    </p>
                  </div>
                  <Switch checked={persistent} onCheckedChange={setPersistent} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-body font-medium">Silent Alert</Label>
                    <p className="text-label-secondary text-footnote">
                      Only add to notification center, suppress toast banner.
                    </p>
                  </div>
                  <Switch checked={silent} onCheckedChange={setSilent} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-body font-medium">With Action Callback</Label>
                    <p className="text-label-secondary text-footnote">
                      Includes a clickable action button on the toast.
                    </p>
                  </div>
                  <Switch checked={hasAction} onCheckedChange={setHasAction} />
                </div>

                <div className="space-y-2 pt-2">
                  <Label htmlFor="notif-duration" className="text-label-secondary text-subhead">
                    Auto-dismiss Duration (ms)
                  </Label>
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

            <Button onClick={handleTrigger} size="lg" className="w-full">
              <Play className="mr-2 h-4 w-4" />
              Trigger Custom Notification
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default NotificationTestCard;
