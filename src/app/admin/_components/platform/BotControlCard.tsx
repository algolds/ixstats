// src/app/admin/_components/platform/BotControlCard.tsx
// Redesigned with PM2 process grid, role permits, live logs, and command testing console.
"use client";

import { useState, useEffect } from "react";
import {
  Bot,
  Pause,
  Play,
  RotateCcw,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Terminal,
  Sliders,
  Shield,
  Activity,
  Cpu,
  Layers,
  ChevronRight,
  Info,
  CheckCircle2,
  XCircle,
  FileCode,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";
import type { AdminPageBotStatusView } from "~/types/ixstats";
import { cn } from "~/lib/utils";

interface BotControlCardProps {
  botStatus: AdminPageBotStatusView | undefined;
  onPauseBot: () => void;
  onResumeBot: () => void;
  onClearOverrides: () => void;
  onSyncFromBot?: () => void;
  onSyncEpoch?: (targetEpoch: number) => void;
  pausePending: boolean;
  resumePending: boolean;
  clearPending: boolean;
  autoSyncPending?: boolean;
  syncEpochPending?: boolean;
  lastBotSync?: Date | null;
}

export function BotControlCard({
  botStatus,
  onPauseBot,
  onResumeBot,
  onClearOverrides,
  onSyncFromBot,
  onSyncEpoch,
  pausePending,
  resumePending,
  clearPending,
  autoSyncPending = false,
  syncEpochPending = false,
  lastBotSync,
}: BotControlCardProps) {
  const [activeSubTab, setActiveSubTab] = useState<"processes" | "commands" | "roles" | "logs">(
    "processes"
  );

  // --- PM2 Processes state ---
  const {
    data: processes,
    refetch: refetchProcesses,
    isFetching: isProcFetching,
  } = api.admin.getBotProcesses.useQuery(undefined, {
    refetchInterval: activeSubTab === "processes" ? 8000 : undefined,
    refetchOnWindowFocus: false,
  });

  const controlMutation = api.admin.controlBotProcess.useMutation();
  const [actionPending, setActionPending] = useState<Record<string, boolean>>({});

  const handleControlProcess = async (
    processName: "ixwiki-discord-bot" | "ixstats-ixtwitter",
    action: "start" | "stop" | "restart"
  ) => {
    const key = `${processName}-${action}`;
    setActionPending((prev) => ({ ...prev, [key]: true }));
    try {
      await controlMutation.mutateAsync({ processName, action });
      await refetchProcesses();
    } catch (err) {
      console.error(`PM2 command error for ${processName}:`, err);
    } finally {
      setActionPending((prev) => ({ ...prev, [key]: false }));
    }
  };

  // --- Command simulator state ---
  const { data: commands, isLoading: isCommandsLoading } = api.admin.getBotCommands.useQuery(
    undefined,
    {
      enabled: activeSubTab === "commands",
      refetchOnWindowFocus: false,
    }
  );

  const simulateMutation = api.admin.simulateBotCommand.useMutation();

  const [selectedCommandName, setSelectedCommandName] = useState<string | null>(null);
  const [optionValues, setOptionValues] = useState<Record<string, any>>({});
  const [mockUsername, setMockUsername] = useState("TestAdmin");
  const [mockDisplayName, setMockDisplayName] = useState("Test Admin");
  const [mockIsAdmin, setMockIsAdmin] = useState(true);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const selectedCommand = commands?.find((c: any) => c.name === selectedCommandName);

  // Reset simulation and options when command changes
  useEffect(() => {
    setOptionValues({});
    setSimulationResult(null);
  }, [selectedCommandName]);

  const handleSimulate = async () => {
    if (!selectedCommandName) return;
    try {
      const response = await simulateMutation.mutateAsync({
        commandName: selectedCommandName,
        options: optionValues,
        user: {
          username: mockUsername,
          displayName: mockDisplayName,
          isAdmin: mockIsAdmin,
        },
      });
      setSimulationResult(response);
    } catch (err) {
      console.error("Simulation failed:", err);
      setSimulationResult({ success: false, error: String(err) });
    }
  };

  // --- Guild Roles state ---
  const { data: roles, isLoading: isRolesLoading } = api.admin.getBotRoles.useQuery(undefined, {
    enabled: activeSubTab === "roles",
    refetchOnWindowFocus: false,
  });

  // --- Logs state ---
  const [logProcess, setLogProcess] = useState<"ixwiki-discord-bot" | "ixstats-ixtwitter">(
    "ixwiki-discord-bot"
  );
  const [logType, setLogType] = useState<"out" | "err">("out");
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(true);

  const {
    data: logs,
    refetch: refetchLogs,
    isFetching: isLogsFetching,
  } = api.admin.getBotProcessLogs.useQuery(
    { processName: logProcess, logType },
    {
      enabled: activeSubTab === "logs",
      refetchInterval: autoRefreshLogs ? 4000 : undefined,
      refetchOnWindowFocus: false,
    }
  );

  // Formatter helpers
  const formatMemory = (bytes?: number) => {
    if (!bytes) return "0 MB";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatUptime = (ms?: number) => {
    if (!ms || ms <= 0) return "Offline";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getRoleColor = (decimalColor?: number) => {
    if (!decimalColor) return "currentColor";
    const hex = decimalColor.toString(16).padStart(6, "0");
    return `#${hex}`;
  };

  const getEmbedColor = (decimalColor?: number) => {
    if (!decimalColor) return "#202225";
    const hex = decimalColor.toString(16).padStart(6, "0");
    return `#${hex}`;
  };

  // Option UI generator
  const renderOptionInput = (opt: any) => {
    const isRequired = opt.required;
    const value = optionValues[opt.name] ?? "";

    // If choices are present, display a custom selection dropdown
    if (opt.choices && opt.choices.length > 0) {
      return (
        <div key={opt.name} className="space-y-1.5">
          <Label
            htmlFor={`opt-${opt.name}`}
            className="text-muted-foreground flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase"
          >
            {opt.name} {isRequired && <span className="text-red-500">*</span>}
          </Label>
          <select
            id={`opt-${opt.name}`}
            value={value}
            onChange={(e) => setOptionValues((prev) => ({ ...prev, [opt.name]: e.target.value }))}
            className="bg-card/20 border-border/30 text-foreground focus:border-primary/50 w-full rounded-md border px-2.5 py-1.5 text-xs focus:outline-none"
          >
            <option value="" className="bg-background text-foreground">
              Select option...
            </option>
            {opt.choices.map((c: any) => (
              <option key={c.value} value={c.value} className="bg-background text-foreground">
                {c.name}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground block text-[10px] leading-tight font-medium">
            {opt.description}
          </span>
        </div>
      );
    }

    // Type 5: Boolean (render switch)
    if (opt.type === 5) {
      return (
        <div
          key={opt.name}
          className="border-border/10 bg-card/10 flex items-center justify-between rounded-lg border px-3 py-2"
        >
          <div className="space-y-0.5">
            <Label
              htmlFor={`opt-${opt.name}`}
              className="text-muted-foreground flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase"
            >
              {opt.name} {isRequired && <span className="text-red-500">*</span>}
            </Label>
            <span className="text-muted-foreground block text-[10px] leading-tight font-medium">
              {opt.description}
            </span>
          </div>
          <Switch
            id={`opt-${opt.name}`}
            checked={!!value}
            onCheckedChange={(checked) =>
              setOptionValues((prev) => ({ ...prev, [opt.name]: checked }))
            }
          />
        </div>
      );
    }

    // Standard string/number input
    const isNumber = opt.type === 4 || opt.type === 10;
    return (
      <div key={opt.name} className="space-y-1.5">
        <Label
          htmlFor={`opt-${opt.name}`}
          className="text-muted-foreground flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase"
        >
          {opt.name} {isRequired && <span className="text-red-500">*</span>}
        </Label>
        <Input
          id={`opt-${opt.name}`}
          type={isNumber ? "number" : "text"}
          value={value}
          onChange={(e) =>
            setOptionValues((prev) => ({
              ...prev,
              [opt.name]: isNumber ? Number(e.target.value) : e.target.value,
            }))
          }
          placeholder={`Enter ${opt.name}...`}
          className="bg-card/20 border-border/30 focus:border-primary/50 h-9 text-xs focus:ring-0"
        />
        <span className="text-muted-foreground block text-[10px] leading-tight font-medium">
          {opt.description}
        </span>
      </div>
    );
  };

  const isAvailable = botStatus?.botHealth?.available;

  return (
    <Card className="glass-surface border-border/40 flex h-full flex-col">
      <CardHeader className="shrink-0 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-1.5 text-green-500">
                <Bot className="h-4 w-4" />
              </div>
              Discord Bot Controller
            </CardTitle>
            <CardDescription className="text-xs">
              Bot daemon processes, live command testing console, guild roles, and runtime logs
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isProcFetching && (
              <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />
            )}
            {isAvailable ? (
              <Badge className="border-green-500/20 bg-green-500/10 text-[10px] font-semibold tracking-wide text-green-500 uppercase dark:text-green-400">
                <span className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                Daemon Active
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-border/30 bg-muted/20 text-muted-foreground text-[10px] font-semibold tracking-wide uppercase"
              >
                Offline
              </Badge>
            )}
          </div>
        </div>

        {/* Custom Tab Switcher */}
        <div className="border-border/20 mt-4 flex gap-1 border-b">
          {[
            { id: "processes", label: "Process Status", icon: Sliders },
            { id: "commands", label: "Simulator", icon: FileCode },
            { id: "roles", label: "Permissions", icon: Shield },
            { id: "logs", label: "Live Logs", icon: Terminal },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={cn(
                  "-mb-[2px] flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-all select-none",
                  active
                    ? "border-primary text-foreground bg-primary/5 rounded-t-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/5 border-transparent"
                )}
              >
                <TabIcon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        {/* --- PROCESS STATUS TAB --- */}
        {activeSubTab === "processes" && (
          <div className="animate-in fade-in space-y-4 pt-1 duration-200">
            {/* PM2 Processes Grid */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(
                processes || [
                  {
                    name: "ixwiki-discord-bot",
                    status: "offline",
                    cpu: 0,
                    memory: 0,
                    restarts: 0,
                    uptime: 0,
                  },
                  {
                    name: "ixstats-ixtwitter",
                    status: "offline",
                    cpu: 0,
                    memory: 0,
                    restarts: 0,
                    uptime: 0,
                  },
                ]
              ).map((proc) => {
                const isOnline = proc.status === "online";
                return (
                  <div
                    key={proc.name}
                    className="border-border/20 bg-card/15 hover:border-border/30 flex flex-col justify-between space-y-3 rounded-lg border p-3.5 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-foreground max-w-[150px] truncate font-mono text-xs font-bold">
                          {proc.name}
                        </span>
                        <Badge
                          variant={isOnline ? "default" : "destructive"}
                          className={cn(
                            "px-1.5 py-0 text-[8px] font-bold tracking-wider uppercase",
                            isOnline
                              ? "border-green-500/20 bg-green-500/10 text-green-500"
                              : "border-red-500/20 bg-red-500/10 text-red-500"
                          )}
                        >
                          {proc.status}
                        </Badge>
                      </div>

                      {/* Process Metrics Grid */}
                      <div className="text-muted-foreground border-border/10 mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-2.5 text-[10px] font-medium">
                        <div className="flex items-center gap-1.5">
                          <Activity className="text-muted-foreground h-3 w-3" />
                          <span>
                            CPU:{" "}
                            <span className="text-foreground font-mono font-semibold">
                              {proc.cpu}%
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Cpu className="text-muted-foreground h-3 w-3" />
                          <span>
                            RAM:{" "}
                            <span className="text-foreground font-mono font-semibold">
                              {formatMemory(proc.memory)}
                            </span>
                          </span>
                        </div>
                        <div className="col-span-2 flex items-center gap-1.5">
                          <Layers className="text-muted-foreground h-3 w-3" />
                          <span>
                            Uptime:{" "}
                            <span className="text-foreground font-mono font-semibold">
                              {formatUptime(proc.uptime)}
                            </span>
                          </span>
                        </div>
                        <div className="col-span-2 flex items-center gap-1.5 text-[9px]">
                          <RotateCcw className="text-muted-foreground h-3 w-3" />
                          <span>
                            Restarts:{" "}
                            <span className="text-foreground font-mono font-semibold">
                              {proc.restarts}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* PM2 Controls */}
                    <div className="border-border/10 mt-3 grid grid-cols-3 gap-1.5 border-t pt-2.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isOnline || actionPending[`${proc.name}-start`]}
                        onClick={() => handleControlProcess(proc.name as any, "start")}
                        className="flex h-7 items-center justify-center p-0 text-[10px] font-semibold"
                      >
                        {actionPending[`${proc.name}-start`] ? (
                          <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="mr-1 h-3 w-3 text-green-500" />
                        )}
                        Start
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!isOnline || actionPending[`${proc.name}-stop`]}
                        onClick={() => handleControlProcess(proc.name as any, "stop")}
                        className="flex h-7 items-center justify-center p-0 text-[10px] font-semibold"
                      >
                        {actionPending[`${proc.name}-stop`] ? (
                          <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
                        ) : (
                          <Pause className="mr-1 h-3 w-3 text-red-500" />
                        )}
                        Stop
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={actionPending[`${proc.name}-restart`]}
                        onClick={() => handleControlProcess(proc.name as any, "restart")}
                        className="flex h-7 items-center justify-center p-0 text-[10px] font-semibold"
                      >
                        {actionPending[`${proc.name}-restart`] ? (
                          <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-1 h-3 w-3 text-blue-500" />
                        )}
                        Restart
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Existing Overrides & Sync Section */}
            <div className="border-border/20 bg-card/5 space-y-4 rounded-lg border p-3">
              {botStatus?.botStatus?.hasTimeOverride && (
                <Alert className="flex items-start gap-2.5 rounded-lg border-amber-500/20 bg-amber-500/5 py-2.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <AlertDescription className="text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
                    Bot has an active time override. Use <strong>Clear Overrides</strong> to return
                    to natural time progression.
                  </AlertDescription>
                </Alert>
              )}

              {/* Grid matching details */}
              <div className="border-border/10 grid grid-cols-2 gap-3 border-b pb-3 text-[11px] font-medium">
                <div className="space-y-0.5">
                  <span className="text-muted-foreground block text-[9px] font-bold tracking-wider uppercase">
                    Health Status
                  </span>
                  <span className="text-foreground block truncate font-semibold">
                    {botStatus?.botHealth?.message || "No report available"}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-muted-foreground block text-[9px] font-bold tracking-wider uppercase">
                    Sync Time
                  </span>
                  <span className="text-foreground block font-semibold">
                    {lastBotSync ? lastBotSync.toLocaleTimeString() : "Never synced"}
                  </span>
                </div>
              </div>

              {/* Execution Overrides */}
              <div className="space-y-2">
                <span className="text-muted-foreground block text-[9px] font-bold tracking-wider uppercase">
                  Execution Override Controls
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onPauseBot}
                    disabled={pausePending || !isAvailable}
                    className="h-8 border-red-500/20 bg-red-500/5 text-xs font-semibold text-red-500 hover:border-red-500/30 hover:bg-red-500/10"
                  >
                    {pausePending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Pause className="mr-1 h-3.5 w-3.5" />
                    )}
                    Pause
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onResumeBot}
                    disabled={resumePending || !isAvailable}
                    className="h-8 border-emerald-500/20 bg-emerald-500/5 text-xs font-semibold text-emerald-500 hover:border-emerald-500/30 hover:bg-emerald-500/10"
                  >
                    {resumePending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="mr-1 h-3.5 w-3.5" />
                    )}
                    Resume
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClearOverrides}
                    disabled={clearPending || !isAvailable}
                    className="border-border/30 bg-muted/20 text-foreground hover:bg-muted/30 h-8 text-xs font-semibold"
                  >
                    {clearPending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Clear
                  </Button>
                </div>
              </div>

              {/* Synchronization actions */}
              <div className="space-y-2">
                <span className="text-muted-foreground block text-[9px] font-bold tracking-wider uppercase">
                  Time Synchronization
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSyncFromBot}
                    disabled={autoSyncPending || !isAvailable}
                    className="h-8 border-blue-500/20 bg-blue-500/5 text-xs font-semibold text-blue-500 hover:border-blue-500/30 hover:bg-blue-500/10"
                  >
                    {autoSyncPending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-3.5 w-3.5" />
                    )}
                    Sync from Bot
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSyncEpoch && onSyncEpoch(Date.now())}
                    disabled={syncEpochPending}
                    className="h-8 border-orange-500/20 bg-orange-500/5 text-xs font-semibold text-orange-500 hover:border-orange-500/30 hover:bg-orange-500/10"
                  >
                    {syncEpochPending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-3.5 w-3.5" />
                    )}
                    Sync Epoch
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- COMMAND SIMULATOR TAB --- */}
        {activeSubTab === "commands" && (
          <div className="animate-in fade-in space-y-4 pt-1 duration-200">
            {isCommandsLoading ? (
              <div className="text-muted-foreground flex items-center justify-center py-12 text-xs">
                <Loader2 className="text-primary mr-2 h-4 w-4 animate-spin" />
                Fetching slash command registry...
              </div>
            ) : !commands || commands.length === 0 ? (
              <div className="text-muted-foreground border-border/10 bg-card/5 flex flex-col items-center justify-center rounded-lg border p-6 py-12 text-center text-xs">
                <Info className="text-muted-foreground/60 mb-2 h-6 w-6" />
                <span>No commands returned by Discord bot.</span>
                <span className="mt-1 text-[10px]">
                  Make sure the ixwiki-discord-bot is online and running.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                {/* Commands list */}
                <div className="border-border/20 bg-card/10 max-h-[450px] space-y-1 overflow-y-auto rounded-lg border p-2 lg:col-span-2">
                  <span className="text-muted-foreground border-border/10 block border-b px-2 pb-1.5 text-[9px] font-bold tracking-wider uppercase">
                    Commands Registry
                  </span>
                  {commands.map((cmd: any) => (
                    <button
                      key={cmd.name}
                      onClick={() => setSelectedCommandName(cmd.name)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs font-semibold transition-colors",
                        selectedCommandName === cmd.name
                          ? "bg-primary/10 text-primary border-primary/20 border"
                          : "text-muted-foreground hover:bg-muted/5 hover:text-foreground border border-transparent"
                      )}
                    >
                      <span className="font-mono">/{cmd.name}</span>
                      <ChevronRight className="text-muted-foreground h-3 w-3 opacity-60" />
                    </button>
                  ))}
                </div>

                {/* Simulation controls & Preview mockup */}
                <div className="space-y-4 lg:col-span-3">
                  {selectedCommand ? (
                    <div className="border-border/20 bg-card/5 space-y-4 rounded-lg border p-4">
                      {/* Description header */}
                      <div className="space-y-1">
                        <div className="text-foreground font-mono text-sm font-bold">
                          /{selectedCommand.name}
                        </div>
                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                          {selectedCommand.description}
                        </p>
                      </div>

                      <Separator className="border-border/10" />

                      {/* Mock Author settings */}
                      <div className="bg-muted/10 border-border/10 space-y-3 rounded-lg border p-3">
                        <span className="text-muted-foreground block text-[9px] font-bold tracking-wider uppercase">
                          Mock User Settings
                        </span>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label
                              htmlFor="mock-user"
                              className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase"
                            >
                              Username
                            </Label>
                            <Input
                              id="mock-user"
                              value={mockUsername}
                              onChange={(e) => setMockUsername(e.target.value)}
                              className="bg-card/25 border-border/30 h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label
                              htmlFor="mock-disp"
                              className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase"
                            >
                              Display Name
                            </Label>
                            <Input
                              id="mock-disp"
                              value={mockDisplayName}
                              onChange={(e) => setMockDisplayName(e.target.value)}
                              className="bg-card/25 border-border/30 h-8 text-xs"
                            />
                          </div>
                          <div className="col-span-2 flex items-center justify-between pt-1">
                            <div className="space-y-0.5">
                              <Label
                                htmlFor="mock-admin"
                                className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase"
                              >
                                Admin Status (Roles Permission)
                              </Label>
                              <span className="text-muted-foreground block text-[9px]">
                                Allows execution of admin-locked commands
                              </span>
                            </div>
                            <Switch
                              id="mock-admin"
                              checked={mockIsAdmin}
                              onCheckedChange={setMockIsAdmin}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Options fields */}
                      {selectedCommand.options && selectedCommand.options.length > 0 && (
                        <div className="border-border/10 space-y-3.5 border-t pt-3.5">
                          <span className="text-muted-foreground block text-[9px] font-bold tracking-wider uppercase">
                            Command Options
                          </span>
                          <div className="space-y-3">
                            {selectedCommand.options.map((opt: any) => renderOptionInput(opt))}
                          </div>
                        </div>
                      )}

                      {/* Action trigger */}
                      <Button
                        onClick={handleSimulate}
                        disabled={simulateMutation.isPending || !isAvailable}
                        className="h-9 w-full text-xs font-bold"
                      >
                        {simulateMutation.isPending ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Executing Mock Interaction...
                          </>
                        ) : (
                          <>
                            <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
                            Simulate Command execution
                          </>
                        )}
                      </Button>

                      {/* Output section */}
                      {simulationResult && (
                        <div className="border-border/15 animate-in fade-in space-y-3.5 border-t pt-3.5 duration-200">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
                              Output Console Preview
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-muted-foreground text-[10px] font-semibold">
                                Raw JSON
                              </span>
                              <Switch checked={showRawJson} onCheckedChange={setShowRawJson} />
                            </div>
                          </div>

                          {showRawJson ? (
                            <pre className="border-border/15 max-h-[250px] overflow-x-auto rounded-lg border bg-black/45 p-3 font-mono text-[10px] leading-tight text-emerald-400 select-all">
                              {JSON.stringify(simulationResult, null, 2)}
                            </pre>
                          ) : (
                            <div className="space-y-2">
                              {simulationResult.success === false ? (
                                <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs font-semibold text-red-500">
                                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                  <span>{simulationResult.error || "Simulation error"}</span>
                                </div>
                              ) : simulationResult.payload ? (
                                <div className="space-y-2.5">
                                  {/* Discord mockup window */}
                                  <div className="space-y-4 rounded-lg border border-black/20 bg-[#313338] p-4 font-sans text-xs text-[#dbdee1] md:text-sm">
                                    {/* Message */}
                                    <div className="flex items-start gap-3">
                                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 font-sans text-xs font-bold text-white uppercase shadow-sm select-none">
                                        IX
                                      </div>
                                      <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex flex-wrap items-center">
                                          <span className="cursor-pointer font-bold text-[#f2f3f5] hover:underline">
                                            IxTimeBot
                                          </span>
                                          <span className="ml-1.5 rounded bg-[#5865F2] px-1 py-0.5 text-[8px] leading-none font-bold text-white uppercase select-none">
                                            BOT
                                          </span>
                                          <span className="ml-2 text-[10px] text-[#949ba4] select-none">
                                            Today at{" "}
                                            {new Date().toLocaleTimeString([], {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            })}
                                          </span>
                                        </div>

                                        {/* Message Content */}
                                        {typeof simulationResult.payload === "string" ? (
                                          <div className="break-words whitespace-pre-wrap text-[#dbdee1]">
                                            {simulationResult.payload}
                                          </div>
                                        ) : (
                                          <>
                                            {simulationResult.payload.content && (
                                              <div className="mb-1 break-words whitespace-pre-wrap text-[#dbdee1]">
                                                {simulationResult.payload.content}
                                              </div>
                                            )}

                                            {/* Embeds */}
                                            {simulationResult.payload.embeds &&
                                              simulationResult.payload.embeds.map(
                                                (embed: any, idx: number) => (
                                                  <div
                                                    key={idx}
                                                    className="mt-1.5 max-w-[520px] space-y-2 rounded-r border-l-4 bg-[#2b2d31] p-3 shadow-sm"
                                                    style={{
                                                      borderLeftColor: getEmbedColor(embed.color),
                                                    }}
                                                  >
                                                    {embed.author && (
                                                      <div className="flex items-center gap-1.5">
                                                        {embed.author.icon_url && (
                                                          <img
                                                            src={embed.author.icon_url}
                                                            alt=""
                                                            className="h-5 w-5 rounded-full select-none"
                                                          />
                                                        )}
                                                        <span className="cursor-pointer text-[11px] font-bold text-white hover:underline">
                                                          {embed.author.name}
                                                        </span>
                                                      </div>
                                                    )}

                                                    {embed.title && (
                                                      <div className="cursor-pointer text-xs font-bold text-white hover:underline md:text-sm">
                                                        {embed.title}
                                                      </div>
                                                    )}

                                                    {embed.description && (
                                                      <div className="text-[11px] leading-relaxed break-words whitespace-pre-wrap text-[#dbdee1]">
                                                        {embed.description}
                                                      </div>
                                                    )}

                                                    {embed.fields && embed.fields.length > 0 && (
                                                      <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2 md:grid-cols-3">
                                                        {embed.fields.map(
                                                          (f: any, fidx: number) => (
                                                            <div
                                                              key={fidx}
                                                              className={cn(
                                                                "space-y-0.5 text-xs",
                                                                f.inline ? "" : "col-span-full"
                                                              )}
                                                            >
                                                              <div className="text-[10px] font-bold tracking-wide text-white uppercase opacity-90">
                                                                {f.name}
                                                              </div>
                                                              <div className="text-[11px] break-words whitespace-pre-wrap text-[#dbdee1]">
                                                                {f.value}
                                                              </div>
                                                            </div>
                                                          )
                                                        )}
                                                      </div>
                                                    )}

                                                    {embed.footer && (
                                                      <div className="flex items-center gap-1 pt-1 text-[9px] text-[#949ba4] select-none">
                                                        {embed.footer.icon_url && (
                                                          <img
                                                            src={embed.footer.icon_url}
                                                            alt=""
                                                            className="h-3.5 w-3.5 rounded-full"
                                                          />
                                                        )}
                                                        <span>{embed.footer.text}</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                )
                                              )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-2 rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-xs font-semibold text-green-500">
                                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                                  <span>
                                    Command executed successfully with empty reply payload.
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border-border/10 bg-card/5 text-muted-foreground flex min-h-[220px] flex-col items-center justify-center rounded-lg border p-8 text-center text-xs">
                      <Info className="text-muted-foreground mb-2 h-6 w-6 opacity-50" />
                      <span>
                        Select a slash command from the left registry panel to test execution
                        simulations.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- ROLES & PERMISSIONS TAB --- */}
        {activeSubTab === "roles" && (
          <div className="animate-in fade-in space-y-4 pt-1 duration-200">
            {isRolesLoading ? (
              <div className="text-muted-foreground flex items-center justify-center py-12 text-xs">
                <Loader2 className="text-primary mr-2 h-4 w-4 animate-spin" />
                Loading Discord roles...
              </div>
            ) : !roles || roles.length === 0 ? (
              <div className="text-muted-foreground border-border/10 bg-card/5 flex flex-col items-center justify-center rounded-lg border p-6 py-12 text-center text-xs">
                <Info className="text-muted-foreground/60 mb-2 h-6 w-6" />
                <span>No roles fetched from Discord API.</span>
                <span className="mt-1 text-[10px]">
                  Ensure correct guild credentials and bot online status.
                </span>
              </div>
            ) : (
              <div className="border-border/20 bg-card/10 overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-border/20 bg-muted/20 border-b">
                      <th className="text-muted-foreground px-4 py-2.5 text-[9px] font-bold tracking-wider uppercase">
                        Position
                      </th>
                      <th className="text-muted-foreground px-4 py-2.5 text-[9px] font-bold tracking-wider uppercase">
                        Role Name
                      </th>
                      <th className="text-muted-foreground px-4 py-2.5 text-[9px] font-bold tracking-wider uppercase">
                        Role ID
                      </th>
                      <th className="text-muted-foreground px-4 py-2.5 text-[9px] font-bold tracking-wider uppercase">
                        Permit Level
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((role: any) => {
                      const isAdm = role.isAdmin || role.id === "557025114210697242";
                      return (
                        <tr
                          key={role.id}
                          className={cn(
                            "border-border/10 hover:bg-muted/5 border-b font-medium transition-colors last:border-b-0",
                            isAdm ? "bg-amber-500/5 text-amber-500/90" : ""
                          )}
                        >
                          <td className="text-muted-foreground px-4 py-2 font-mono text-[10px]">
                            #{role.position}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
                                style={{ backgroundColor: getRoleColor(role.color) }}
                              />
                              <span className="font-semibold">{role.name}</span>
                            </div>
                          </td>
                          <td className="text-muted-foreground px-4 py-2 font-mono text-[10px]">
                            {role.id}
                          </td>
                          <td className="px-4 py-2">
                            {isAdm ? (
                              <Badge className="border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[8px] font-bold tracking-wide text-amber-500 uppercase">
                                Admin Permit
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-border/20 bg-muted/10 text-muted-foreground px-1.5 py-0 text-[8px] font-bold tracking-wide uppercase"
                              >
                                Default
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* --- LIVE LOGS TAB --- */}
        {activeSubTab === "logs" && (
          <div className="animate-in fade-in space-y-4 pt-1 duration-200">
            {/* Filter Controls */}
            <div className="bg-muted/5 border-border/10 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                {/* Process Selector */}
                <div className="space-y-1">
                  <Label
                    htmlFor="log-proc-select"
                    className="text-muted-foreground block text-[9px] font-bold tracking-wider uppercase"
                  >
                    Daemon Process
                  </Label>
                  <select
                    id="log-proc-select"
                    value={logProcess}
                    onChange={(e) => setLogProcess(e.target.value as any)}
                    className="bg-card/20 border-border/30 text-foreground focus:border-primary/50 rounded border px-2 py-1 text-xs font-semibold focus:outline-none"
                  >
                    <option value="ixwiki-discord-bot" className="bg-background text-foreground">
                      ixwiki-discord-bot
                    </option>
                    <option value="ixstats-ixtwitter" className="bg-background text-foreground">
                      ixstats-ixtwitter
                    </option>
                  </select>
                </div>

                {/* Log Type Selector */}
                <div className="space-y-1">
                  <Label
                    htmlFor="log-type-select"
                    className="text-muted-foreground block text-[9px] font-bold tracking-wider uppercase"
                  >
                    Stream Type
                  </Label>
                  <select
                    id="log-type-select"
                    value={logType}
                    onChange={(e) => setLogType(e.target.value as any)}
                    className="bg-card/20 border-border/30 text-foreground focus:border-primary/50 rounded border px-2 py-1 text-xs font-semibold focus:outline-none"
                  >
                    <option value="out" className="bg-background text-foreground">
                      stdout (Logs)
                    </option>
                    <option value="err" className="bg-background text-foreground">
                      stderr (Errors)
                    </option>
                  </select>
                </div>
              </div>

              {/* Refresh buttons and toggle */}
              <div className="flex items-center gap-3">
                <div className="border-border/10 bg-card/10 flex items-center gap-1.5 rounded-lg border px-2 py-1.5">
                  <Label
                    htmlFor="auto-refresh-logs-switch"
                    className="text-muted-foreground cursor-pointer text-[9px] font-bold tracking-wider uppercase select-none"
                  >
                    Auto-Refresh
                  </Label>
                  <Switch
                    id="auto-refresh-logs-switch"
                    checked={autoRefreshLogs}
                    onCheckedChange={setAutoRefreshLogs}
                  />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchLogs()}
                  disabled={isLogsFetching}
                  className="h-8 px-3 text-xs font-semibold"
                >
                  <RefreshCw
                    className={cn("mr-1.5 h-3 w-3", isLogsFetching ? "animate-spin" : "")}
                  />
                  Refresh Logs
                </Button>
              </div>
            </div>

            {/* Console output window */}
            <div className="relative">
              <div className="text-muted-foreground border-border/10 absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 rounded border bg-black/50 px-2 py-0.5 font-mono text-[9px] select-none">
                <FileCode className="h-3 w-3" />
                <span>50 lines</span>
              </div>
              <div className="max-h-[450px] min-h-[280px] w-full overflow-x-auto rounded-lg border border-[#2b2d31] bg-[#1e1e24] p-4 font-mono text-[10px] leading-relaxed text-zinc-300 md:text-[11px]">
                {logs && logs.length > 0 ? (
                  <pre className="flex flex-col gap-0.5 whitespace-pre select-text">
                    {logs.map((line, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "rounded px-1 transition-colors hover:bg-zinc-800/40",
                          logType === "err" ? "text-red-400" : ""
                        )}
                      >
                        <span className="mr-3 inline-block w-6 border-r border-zinc-700/55 pr-1.5 text-right text-zinc-500 select-none">
                          {idx + 1}
                        </span>
                        <span>{line}</span>
                      </div>
                    ))}
                  </pre>
                ) : (
                  <div className="text-muted-foreground/60 flex flex-col items-center justify-center py-20 select-none">
                    <Terminal className="mb-2 h-6 w-6 animate-pulse opacity-40" />
                    <span>No process logs output recorded.</span>
                    <span className="mt-0.5 text-[9px]">
                      Ensure process is started and writing output logs.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
