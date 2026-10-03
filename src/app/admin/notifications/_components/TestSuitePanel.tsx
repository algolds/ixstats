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
  const [duration, setDuration] = useState("5000");

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
              label: "Deploy peacekeepers",
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
              label: "Accept treaty",
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
      duration: duration ? parseInt(duration, 10) : undefined,
      actions: hasAction
        ? [
            {
              label: "Run test callback",
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
        message: "High-priority security alert detected. Test from admin panel.",
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
            label: "View dashboard",
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
      <Card className="flex flex-col gap-6 py-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="text-yellow h-5 w-5" />
            Quick test presets
          </CardTitle>
          <CardDescription>Trigger pre-configured notification scenarios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Button variant="destructive" onClick={() => triggerPreset("crisis")}>
              <ShieldAlert className="mr-2 h-4 w-4" />
              Crisis alert
            </Button>
            <Button variant="secondary" onClick={() => triggerPreset("achievement")}>
              <Award className="mr-2 h-4 w-4" />
              Achievement
            </Button>
            <Button variant="secondary" onClick={() => triggerPreset("security")}>
              <AlertTriangle className="mr-2 h-4 w-4" />
              Security intel
            </Button>
            <Button variant="secondary" onClick={() => triggerPreset("trade")}>
              <Sparkles className="mr-2 h-4 w-4" />
              Trade pact
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System-level test buttons */}
      <Card className="flex flex-col gap-6 py-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="text-purple h-5 w-5" />
            System integration tests
          </CardTitle>
          <CardDescription>
            Test full notification pipeline: store, services, and delivery handlers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Button variant="destructive" onClick={testIntelligence} className="h-auto">
              <Shield className="text-red mr-2 h-5 w-5" />
              <div className="text-left">
                <div className="text-body font-medium">Intelligence</div>
                <div className="text-footnote opacity-70">Critical alert</div>
              </div>
            </Button>
            <Button variant="secondary" onClick={testEconomic} className="h-auto">
              <DollarSign className="text-green mr-2 h-5 w-5" />
              <div className="text-left">
                <div className="text-body font-medium">Economic</div>
                <div className="text-footnote opacity-70">GDP update</div>
              </div>
            </Button>
            <Button variant="secondary" onClick={testDiplomatic} className="h-auto">
              <Globe className="text-blue mr-2 h-5 w-5" />
              <div className="text-left">
                <div className="text-body font-medium">Diplomatic</div>
                <div className="text-footnote opacity-70">Treaty event</div>
              </div>
            </Button>
            <Button variant="secondary" onClick={testAchievement} className="h-auto">
              <Trophy className="text-yellow mr-2 h-5 w-5" />
              <div className="text-left">
                <div className="text-body font-medium">Achievement</div>
                <div className="text-footnote opacity-70">Unlock test</div>
              </div>
            </Button>
          </div>

          <div className="flex gap-3">
            <Button onClick={runFullTest} className="flex-1">
              <Play className="mr-2 h-4 w-4" />
              Run full test suite
            </Button>
            <Button onClick={clearResults} variant="outline">
              Clear results
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Custom Simulator */}
      <Card className="flex flex-col gap-6 py-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="text-indigo h-5 w-5" />
            Custom notification simulator
          </CardTitle>
          <CardDescription>
            Configure and trigger a custom notification with specific parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="h-20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-footnote">Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as ToastType)}>
                    <SelectTrigger size="sm" className="w-full">
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
                  <Label className="text-footnote">Priority</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as ToastPriority)}>
                    <SelectTrigger size="sm" className="w-full">
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
                <Label className="text-footnote">Category</Label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as NotificationCategory)}
                >
                  <SelectTrigger size="sm" className="w-full">
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

            <div className="border-separator bg-surface rounded-control space-y-4 border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-body font-medium">Persistent</Label>
                  <p className="text-label-secondary text-footnote">Requires manual closing</p>
                </div>
                <Switch checked={persistent} onCheckedChange={setPersistent} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-body font-medium">Silent</Label>
                  <p className="text-label-secondary text-footnote">
                    Suppress toast, add to center only
                  </p>
                </div>
                <Switch checked={silent} onCheckedChange={setSilent} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-body font-medium">Action callback</Label>
                  <p className="text-label-secondary text-footnote">Include clickable action</p>
                </div>
                <Switch checked={hasAction} onCheckedChange={setHasAction} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notif-duration" className="text-footnote">
                  Auto-dismiss duration (ms)
                </Label>
                <Input
                  id="notif-duration"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  disabled={persistent}
                />
              </div>
              <Button onClick={handleCustomTrigger} className="w-full" size="lg">
                <Play className="mr-2 h-4 w-4" />
                Trigger custom notification
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      <Card className="flex flex-col gap-6 py-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Test results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            {testResults.length === 0 ? (
              <p className="text-label-secondary text-body py-4 text-center">
                No test results yet. Run some tests above.
              </p>
            ) : (
              <div className="space-y-2">
                {testResults.map((result, i) => {
                  let color = "bg-blue/10 text-blue";
                  if (result.includes("✅")) color = "bg-green/10 text-green";
                  else if (result.includes("❌")) color = "bg-red/10 text-red";
                  else if (result.includes("🧪") || result.includes("🎉"))
                    color = "bg-purple/10 text-purple";
                  else if (result.includes("🔴")) color = "bg-red/10 text-red";
                  else if (result.includes("🏆")) color = "bg-yellow/10 text-yellow";
                  else if (result.includes("🛡️")) color = "bg-yellow/10 text-yellow";
                  else if (result.includes("🤝") || result.includes("📨"))
                    color = "bg-blue/10 text-blue";
                  return (
                    <div
                      key={i}
                      className={`rounded-control-sm text-footnote px-3 py-2 tabular-nums ${color}`}
                    >
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
