"use client";

import { useState } from "react";
import { useNotify } from "~/hooks/useNotify";
import { useNotificationStore } from "~/stores/notificationStore";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { ScrollArea } from "~/components/ui/scroll-area";
import type { ToastType, ToastPriority } from "~/stores/toastQueueStore";
import type { NotificationCategory } from "~/types/unified-notifications";
import {
  Shield,
  Dollar as DollarSign,
  Globe,
  Trophy,
  Flash as Zap,
  Sparks as Sparkles,
  WarningTriangle as AlertTriangle,
  ShieldAlert,
  Trophy as Award,
  Play,
  Bell,
  Flask as FlaskConical,
} from "iconoir-react";

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

export function TestSuitePanel() {
  const notify = useNotify();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [testResults, setTestResults] = useState<string[]>([]);

  // Custom notification simulator
  const [title, setTitle] = useState("Test Alert");
  const [message, setMessage] = useState("This is a simulated notification from the admin panel.");
  const [type, setType] = useState<ToastType>("info");
  const [priority, setPriority] = useState<ToastPriority>("medium");
  const [category, setCategory] = useState<NotificationCategory>("system");
  const [persistent, setPersistent] = useState(false);
  const [silent, setSilent] = useState(false);
  const [hasAction, setHasAction] = useState(false);

  const addResult = (msg: string) => setTestResults((prev) => [...prev, msg]);
  const clearResults = () => setTestResults([]);

  // === Trigger preset via useNotify ===
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
              onClick: () => addResult("✅ Peacekeepers deployed"),
            },
          ],
        });
        addResult("🔴 Crisis alert triggered");
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
        addResult("🏆 Achievement notification fired");
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
        addResult("🛡️ Security alert fired");
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
              onClick: () => addResult("✅ Treaty accepted"),
            },
          ],
        });
        addResult("🤝 Trade pact notification fired");
        break;
      default:
        break;
    }
  };

  // === Fire custom notification simulator ===
  const handleCustomTrigger = () => {
    notify.notify({
      title,
      message: message || undefined,
      type,
      priority,
      category,
      persistent,
      silent,
      actions: hasAction
        ? [
            {
              label: "Run Test Callback",
              onClick: () => addResult("✅ Custom callback executed"),
            },
          ]
        : undefined,
    });
    addResult(`📨 Custom "${title}" notification triggered`);
  };

  // === System-level tests via store ===
  const testIntelligence = async () => {
    try {
      await addNotification({
        source: "intelligence",
        title: "🚨 TEST: Critical Intelligence Alert",
        message: "High-priority security alert detected — test from admin panel.",
        category: "security",
        type: "alert",
        priority: "critical",
        severity: "urgent",
        deliveryMethod: "dynamic-island",
        actionable: true,
        actions: [
          {
            id: "test",
            label: "Investigate",
            type: "primary",
            onClick: () => addResult("🔍 Investigate clicked"),
          },
        ],
        triggers: [{ type: "data-change", source: "admin-panel", data: {}, confidence: 1.0 }],
        status: "pending" as const,
        relevanceScore: 90,
        context: {} as any,
      });
      addResult("✅ Intelligence notification created");
    } catch (e) {
      addResult(`❌ Failed: ${e}`);
    }
  };

  const testEconomic = async () => {
    try {
      await addNotification({
        source: "intelligence",
        title: "📈 TEST: Economic Alert",
        message: "GDP has increased by 15.2% this quarter.",
        category: "economic",
        type: "alert",
        priority: "high",
        severity: "important",
        deliveryMethod: "dynamic-island",
        actionable: true,
        actions: [
          {
            id: "view",
            label: "View Dashboard",
            type: "primary",
            onClick: () => addResult("📊 Dashboard opened"),
          },
        ],
        triggers: [{ type: "data-change", source: "economic-system", data: {}, confidence: 0.9 }],
        status: "pending" as const,
        relevanceScore: 85,
        context: {} as any,
      });
      addResult("✅ Economic notification created");
    } catch (e) {
      addResult(`❌ Failed: ${e}`);
    }
  };

  const testDiplomatic = async () => {
    try {
      await addNotification({
        source: "intelligence",
        title: "🕊️ TEST: Diplomatic Event",
        message: "Peace treaty signed between test countries.",
        category: "diplomatic",
        type: "update",
        priority: "medium",
        severity: "info",
        deliveryMethod: "toast",
        actionable: false,
        triggers: [{ type: "event", source: "diplomatic-system", data: {}, confidence: 0.95 }],
        status: "pending" as const,
        relevanceScore: 80,
        context: {} as any,
      });
      addResult("✅ Diplomatic notification processed");
    } catch (e) {
      addResult(`❌ Diplomatic failed: ${e}`);
    }
  };

  const testAchievement = async () => {
    try {
      await addNotification({
        source: "system",
        title: "🏆 TEST: Achievement Unlocked",
        message: "Admin Test Achievement: Successfully tested from admin panel.",
        category: "achievement",
        type: "success",
        priority: "high",
        severity: "important",
        deliveryMethod: "toast",
        actionable: false,
        triggers: [{ type: "achievement-unlocked", source: "system", data: {}, confidence: 1.0 }],
        status: "pending" as const,
        relevanceScore: 90,
        context: {} as any,
      });
      addResult("✅ Achievement notification created");
    } catch (e) {
      addResult(`❌ Failed: ${e}`);
    }
  };

  const runFullTest = async () => {
    setTestResults(["🧪 Starting full system test..."]);
    await new Promise((r) => setTimeout(r, 500));
    await testIntelligence();
    await new Promise((r) => setTimeout(r, 800));
    await testEconomic();
    await new Promise((r) => setTimeout(r, 800));
    await testDiplomatic();
    await new Promise((r) => setTimeout(r, 800));
    await testAchievement();
    await new Promise((r) => setTimeout(r, 500));
    addResult("🎉 Full system test completed!");
  };

  return (
    <div className="space-y-6">
      {/* Preset Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Quick Test Presets
          </CardTitle>
          <CardDescription>Trigger pre-configured notification scenarios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Button
              variant="outline"
              onClick={() => triggerPreset("crisis")}
              className="border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/10"
            >
              <ShieldAlert className="mr-1.5 h-4 w-4" />
              Crisis Alert
            </Button>
            <Button
              variant="outline"
              onClick={() => triggerPreset("achievement")}
              className="border-emerald-500/20 bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500/10"
            >
              <Award className="mr-1.5 h-4 w-4" />
              Achievement
            </Button>
            <Button
              variant="outline"
              onClick={() => triggerPreset("security")}
              className="border-amber-500/20 bg-amber-500/5 text-amber-500 hover:bg-amber-500/10"
            >
              <AlertTriangle className="mr-1.5 h-4 w-4" />
              Security Intel
            </Button>
            <Button
              variant="outline"
              onClick={() => triggerPreset("trade")}
              className="border-blue-500/20 bg-blue-500/5 text-blue-500 hover:bg-blue-500/10"
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              Trade Pact
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System-level test buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-purple-500" />
            System Integration Tests
          </CardTitle>
          <CardDescription>
            Test full notification pipeline: store, services, and delivery handlers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Button
              onClick={testIntelligence}
              className="h-auto border-red-500/30 bg-red-500/20 p-4 hover:bg-red-500/30"
            >
              <Shield className="mr-2 h-5 w-5 text-red-400" />
              <div className="text-left">
                <div className="text-sm font-medium">Intelligence</div>
                <div className="text-[10px] opacity-70">Critical alert</div>
              </div>
            </Button>
            <Button
              onClick={testEconomic}
              className="h-auto border-green-500/30 bg-green-500/20 p-4 hover:bg-green-500/30"
            >
              <DollarSign className="mr-2 h-5 w-5 text-green-400" />
              <div className="text-left">
                <div className="text-sm font-medium">Economic</div>
                <div className="text-[10px] opacity-70">GDP update</div>
              </div>
            </Button>
            <Button
              onClick={testDiplomatic}
              className="h-auto border-blue-500/30 bg-blue-500/20 p-4 hover:bg-blue-500/30"
            >
              <Globe className="mr-2 h-5 w-5 text-blue-400" />
              <div className="text-left">
                <div className="text-sm font-medium">Diplomatic</div>
                <div className="text-[10px] opacity-70">Treaty event</div>
              </div>
            </Button>
            <Button
              onClick={testAchievement}
              className="h-auto border-yellow-500/30 bg-yellow-500/20 p-4 hover:bg-yellow-500/30"
            >
              <Trophy className="mr-2 h-5 w-5 text-yellow-400" />
              <div className="text-left">
                <div className="text-sm font-medium">Achievement</div>
                <div className="text-[10px] opacity-70">Unlock test</div>
              </div>
            </Button>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={runFullTest}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              <Play className="mr-2 h-4 w-4" />
              Run Full Test Suite
            </Button>
            <Button onClick={clearResults} variant="outline">
              Clear Results
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Custom Simulator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-indigo-500" />
            Custom Notification Simulator
          </CardTitle>
          <CardDescription>
            Configure and trigger a custom notification with specific parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Message</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="h-20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as ToastType)}
                    className="border-border/60 bg-background text-foreground flex h-9 w-full rounded-xl border px-3 py-1.5 text-xs focus:outline-none"
                  >
                    {TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Priority</Label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as ToastPriority)}
                    className="border-border/60 bg-background text-foreground flex h-9 w-full rounded-xl border px-3 py-1.5 text-xs focus:outline-none"
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
                <Label className="text-xs">Category</Label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as NotificationCategory)}
                  className="border-border/60 bg-background text-foreground flex h-9 w-full rounded-xl border px-3 py-1.5 text-xs focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border-border/40 bg-card/40 space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Persistent</Label>
                  <p className="text-muted-foreground text-xs">Requires manual closing</p>
                </div>
                <Switch checked={persistent} onCheckedChange={setPersistent} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Silent</Label>
                  <p className="text-muted-foreground text-xs">
                    Suppress toast, add to center only
                  </p>
                </div>
                <Switch checked={silent} onCheckedChange={setSilent} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Action Callback</Label>
                  <p className="text-muted-foreground text-xs">Include clickable action</p>
                </div>
                <Switch checked={hasAction} onCheckedChange={setHasAction} />
              </div>
              <Button onClick={handleCustomTrigger} className="w-full" size="lg">
                <Play className="mr-2 h-4 w-4" />
                Trigger Custom Notification
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Test Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            {testResults.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                No test results yet. Run some tests above.
              </p>
            ) : (
              <div className="space-y-1.5">
                {testResults.map((result, i) => {
                  let color = "bg-blue-500/10 text-blue-400";
                  if (result.includes("✅")) color = "bg-green-500/10 text-green-400";
                  else if (result.includes("❌")) color = "bg-red-500/10 text-red-400";
                  else if (result.includes("🧪") || result.includes("🎉"))
                    color = "bg-purple-500/10 text-purple-400";
                  else if (result.includes("🔴")) color = "bg-red-500/10 text-red-400";
                  else if (result.includes("🏆")) color = "bg-yellow-500/10 text-yellow-400";
                  else if (result.includes("🛡️")) color = "bg-amber-500/10 text-amber-400";
                  else if (result.includes("🤝") || result.includes("📨"))
                    color = "bg-blue-500/10 text-blue-400";
                  return (
                    <div key={i} className={`rounded px-3 py-1.5 font-mono text-xs ${color}`}>
                      {result}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
