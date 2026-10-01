"use client";
// src/app/admin/_components/platform/BotControlCard.tsx
// Redesigned with PM2 process grid, role permits, live logs, and command testing console.

import { SegmentedControl } from "~/components/ui/segmented-control";
import { useState, useEffect } from "react";
import {
  Cpu as Bot,
  Pause,
  Play,
  Undo as RotateCcw,
  WarningTriangle as AlertTriangle,
  Refresh as RefreshCw,
  SystemRestart as Loader2,
  Terminal,
  ControlSlider as Sliders,
  Shield,
  Activity,
  Cpu,
  Component as Layers,
  NavArrowRight as ChevronRight,
  InfoCircle as Info,
  CheckCircle as CheckCircle2,
  XmarkCircle as XCircle,
  Code as FileCode,
} from "iconoir-react";
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
import { fieldStyles } from "~/components/ui/input";

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
    // oxlint-disable-next-line
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
            className="text-label-secondary text-subhead flex items-center gap-1"
          >
            {opt.name} {isRequired && <span className="text-red">*</span>}
          </Label>
          <select
            id={`opt-${opt.name}`}
            value={value}
            onChange={(e) => setOptionValues((prev) => ({ ...prev, [opt.name]: e.target.value }))}
            className={cn(
              fieldStyles,
              "rounded-control-sm text-footnote h-(--control-height-sm) w-full cursor-pointer px-2.5"
            )}
          >
            <option value="">Select option...</option>
            {opt.choices.map((c: any) => (
              <option key={c.value} value={c.value}>
                {c.name}
              </option>
            ))}
          </select>
          <span className="text-label-secondary text-caption block leading-tight">
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
          className="border-separator bg-surface rounded-control flex items-center justify-between border px-3 py-2"
        >
          <div className="space-y-0.5">
            <Label
              htmlFor={`opt-${opt.name}`}
              className="text-label-secondary text-subhead flex items-center gap-1"
            >
              {opt.name} {isRequired && <span className="text-red">*</span>}
            </Label>
            <span className="text-label-secondary text-caption block leading-tight">
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
          className="text-label-secondary text-subhead flex items-center gap-1"
        >
          {opt.name} {isRequired && <span className="text-red">*</span>}
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
          className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
        />
        <span className="text-label-secondary text-caption block leading-tight">
          {opt.description}
        </span>
      </div>
    );
  };

  const isAvailable = botStatus?.botHealth?.available;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="shrink-0 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-headline flex items-center gap-2">
              <div className="rounded-control border-green/20 bg-green/10 text-green border p-1.5">
                <Bot className="h-4 w-4" />
              </div>
              Discord Bot Controller
            </CardTitle>
            <CardDescription className="text-footnote">
              Bot daemon processes, live command testing console, guild roles, and runtime logs
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isProcFetching && (
              <Loader2 className="text-label-secondary h-3.5 w-3.5 animate-spin" />
            )}
            {isAvailable ? (
              <Badge variant="green" className="text-eyebrow">
                <span className="bg-green mr-1.5 h-1.5 w-1.5 rounded-full" />
                Daemon Active
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-separator bg-fill-4 text-label-secondary text-eyebrow"
              >
                Offline
              </Badge>
            )}
          </div>
        </div>

        {/* Section switcher */}
        <SegmentedControl
          asTabs
          size="sm"
          className="mt-4"
          aria-label="Bot console sections"
          value={activeSubTab}
          onValueChange={(tab) => setActiveSubTab(tab as any)}
          options={[
            { value: "processes", label: "Process Status", icon: <Sliders /> },
            { value: "commands", label: "Simulator", icon: <FileCode /> },
            { value: "roles", label: "Permissions", icon: <Shield /> },
            { value: "logs", label: "Live Logs", icon: <Terminal /> },
          ]}
        />
      </CardHeader>

      <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        {/* --- PROCESS STATUS TAB --- */}
        {activeSubTab === "processes" && (
          <div className="animate-in fade-in duration-fast space-y-4 pt-1">
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
                    className="border-separator bg-surface hover:border-separator rounded-control flex flex-col justify-between space-y-3 border p-3.5 transition-[color,background-color,border-color,box-shadow,opacity,transform]"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-label text-caption max-w-[150px] truncate font-mono">
                          {proc.name}
                        </span>
                        <Badge
                          variant={isOnline ? "default" : "destructive"}
                          className={cn(
                            "text-eyebrow px-1.5 py-0",
                            isOnline
                              ? "border-green/20 bg-green/10 text-green"
                              : "border-red/20 bg-red/10 text-red"
                          )}
                        >
                          {proc.status}
                        </Badge>
                      </div>

                      {/* Process Metrics Grid */}
                      <div className="text-label-secondary border-separator text-caption mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-2.5">
                        <div className="flex items-center gap-1.5">
                          <Activity className="text-label-secondary h-3 w-3" />
                          <span>
                            CPU:{" "}
                            <span className="text-label font-semibold tabular-nums">
                              {proc.cpu}%
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Cpu className="text-label-secondary h-3 w-3" />
                          <span>
                            RAM:{" "}
                            <span className="text-label font-semibold tabular-nums">
                              {formatMemory(proc.memory)}
                            </span>
                          </span>
                        </div>
                        <div className="col-span-2 flex items-center gap-1.5">
                          <Layers className="text-label-secondary h-3 w-3" />
                          <span>
                            Uptime:{" "}
                            <span className="text-label font-semibold tabular-nums">
                              {formatUptime(proc.uptime)}
                            </span>
                          </span>
                        </div>
                        <div className="text-footnote col-span-2 flex items-center gap-1.5">
                          <RotateCcw className="text-label-secondary h-3 w-3" />
                          <span>
                            Restarts:{" "}
                            <span className="text-label font-semibold tabular-nums">
                              {proc.restarts}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* PM2 Controls */}
                    <div className="border-separator mt-3 grid grid-cols-3 gap-1.5 border-t pt-2.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isOnline || actionPending[`${proc.name}-start`]}
                        onClick={() => handleControlProcess(proc.name as any, "start")}
                        className="flex items-center justify-center p-0"
                      >
                        {actionPending[`${proc.name}-start`] ? (
                          <Loader2 className="text-label-secondary h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="text-green mr-1 h-3 w-3" />
                        )}
                        Start
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!isOnline || actionPending[`${proc.name}-stop`]}
                        onClick={() => handleControlProcess(proc.name as any, "stop")}
                        className="flex items-center justify-center p-0"
                      >
                        {actionPending[`${proc.name}-stop`] ? (
                          <Loader2 className="text-label-secondary h-3 w-3 animate-spin" />
                        ) : (
                          <Pause className="text-red mr-1 h-3 w-3" />
                        )}
                        Stop
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={actionPending[`${proc.name}-restart`]}
                        onClick={() => handleControlProcess(proc.name as any, "restart")}
                        className="flex items-center justify-center p-0"
                      >
                        {actionPending[`${proc.name}-restart`] ? (
                          <Loader2 className="text-label-secondary h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="text-blue mr-1 h-3 w-3" />
                        )}
                        Restart
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Existing Overrides & Sync Section */}
            <div className="border-separator bg-surface rounded-control space-y-4 border p-3">
              {botStatus?.botStatus?.hasTimeOverride && (
                <Alert className="rounded-control border-yellow/20 bg-yellow/5 flex items-start gap-2.5 py-2.5">
                  <AlertTriangle className="text-yellow mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <AlertDescription className="text-footnote text-yellow leading-relaxed">
                    Bot has an active time override. Use <strong>Clear Overrides</strong> to return
                    to natural time progression.
                  </AlertDescription>
                </Alert>
              )}

              {/* Grid matching details */}
              <div className="border-separator text-caption grid grid-cols-2 gap-3 border-b pb-3">
                <div className="space-y-0.5">
                  <span className="text-label-secondary text-eyebrow block">Health Status</span>
                  <span className="text-label block truncate font-semibold">
                    {botStatus?.botHealth?.message || "No report available"}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-label-secondary text-eyebrow block">Sync Time</span>
                  <span className="text-label block font-semibold">
                    {lastBotSync ? lastBotSync.toLocaleTimeString() : "Never synced"}
                  </span>
                </div>
              </div>

              {/* Execution Overrides */}
              <div className="space-y-2">
                <span className="text-label-secondary text-eyebrow block">
                  Execution Override Controls
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={onPauseBot}
                    disabled={pausePending || !isAvailable}
                  >
                    {pausePending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Pause className="mr-1 h-3.5 w-3.5" />
                    )}
                    Pause
                  </Button>
                  <Button
                    variant="tinted"
                    size="sm"
                    onClick={onResumeBot}
                    disabled={resumePending || !isAvailable}
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
                <span className="text-label-secondary text-eyebrow block">
                  Time Synchronization
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="tinted"
                    size="sm"
                    onClick={onSyncFromBot}
                    disabled={autoSyncPending || !isAvailable}
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
          <div className="animate-in fade-in duration-fast space-y-4 pt-1">
            {isCommandsLoading ? (
              <div className="text-label-secondary text-footnote flex items-center justify-center py-12">
                <Loader2 className="text-tint mr-2 h-4 w-4 animate-spin" />
                Fetching slash command registry...
              </div>
            ) : !commands || commands.length === 0 ? (
              <div className="text-label-secondary border-separator bg-surface rounded-control text-footnote flex flex-col items-center justify-center border p-6 py-12 text-center">
                <Info className="text-label-secondary mb-2 h-6 w-6" />
                <span>No commands returned by Discord bot.</span>
                <span className="text-footnote mt-1">
                  Make sure the ixwiki-discord-bot is online and running.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                {/* Commands list */}
                <div className="border-separator bg-surface rounded-control max-h-[450px] space-y-1 overflow-y-auto border p-2 lg:col-span-2">
                  <span className="text-label-secondary border-separator text-eyebrow block border-b px-2 pb-1.5">
                    Commands Registry
                  </span>
                  {commands.map((cmd: any) => (
                    <button
                      key={cmd.name}
                      onClick={() => setSelectedCommandName(cmd.name)}
                      className={cn(
                        "rounded-control-sm text-caption flex w-full items-center justify-between px-2.5 py-2 text-left transition-colors",
                        selectedCommandName === cmd.name
                          ? "bg-tint-fill text-tint border-tint/20 border"
                          : "text-label-secondary hover:bg-fill-4 hover:text-label border border-transparent"
                      )}
                    >
                      <span className="font-mono">/{cmd.name}</span>
                      <ChevronRight className="text-label-secondary h-3 w-3 opacity-60" />
                    </button>
                  ))}
                </div>

                {/* Simulation controls & Preview mockup */}
                <div className="space-y-4 lg:col-span-3">
                  {selectedCommand ? (
                    <div className="border-separator bg-surface rounded-control space-y-4 border p-4">
                      {/* Description header */}
                      <div className="space-y-1">
                        <div className="text-label text-headline font-mono">
                          /{selectedCommand.name}
                        </div>
                        <p className="text-label-secondary text-footnote leading-relaxed">
                          {selectedCommand.description}
                        </p>
                      </div>

                      <Separator className="border-separator" />

                      {/* Mock Author settings */}
                      <div className="bg-fill-4 border-separator rounded-control space-y-3 border p-3">
                        <span className="text-label-secondary text-eyebrow block">
                          Mock User Settings
                        </span>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label
                              htmlFor="mock-user"
                              className="text-label-secondary text-subhead"
                            >
                              Username
                            </Label>
                            <Input
                              id="mock-user"
                              value={mockUsername}
                              onChange={(e) => setMockUsername(e.target.value)}
                              className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label
                              htmlFor="mock-disp"
                              className="text-label-secondary text-subhead"
                            >
                              Display Name
                            </Label>
                            <Input
                              id="mock-disp"
                              value={mockDisplayName}
                              onChange={(e) => setMockDisplayName(e.target.value)}
                              className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                            />
                          </div>
                          <div className="col-span-2 flex items-center justify-between pt-1">
                            <div className="space-y-0.5">
                              <Label
                                htmlFor="mock-admin"
                                className="text-label-secondary text-subhead"
                              >
                                Admin Status (Roles Permission)
                              </Label>
                              <span className="text-label-secondary text-footnote block">
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
                        <div className="border-separator space-y-3.5 border-t pt-3.5">
                          <span className="text-label-secondary text-eyebrow block">
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
                        className="w-full"
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
                        <div className="border-separator animate-in fade-in duration-fast space-y-3.5 border-t pt-3.5">
                          <div className="flex items-center justify-between">
                            <span className="text-label-secondary text-eyebrow">
                              Output Console Preview
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-label-secondary text-caption">Raw JSON</span>
                              <Switch checked={showRawJson} onCheckedChange={setShowRawJson} />
                            </div>
                          </div>

                          {showRawJson ? (
                            <pre className="border-separator rounded-control text-footnote text-label bg-surface-secondary max-h-[250px] overflow-x-auto border p-3 font-mono leading-tight select-all">
                              {JSON.stringify(simulationResult, null, 2)}
                            </pre>
                          ) : (
                            <div className="space-y-2">
                              {simulationResult.success === false ? (
                                <div className="rounded-control border-red/20 bg-red/5 text-caption text-red flex items-start gap-2 border p-3">
                                  <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                  <span>{simulationResult.error || "Simulation error"}</span>
                                </div>
                              ) : simulationResult.payload ? (
                                <div className="space-y-2.5">
                                  {/* Discord mockup window */}
                                  <div className="rounded-control border-separator bg-surface-secondary text-footnote text-label-secondary md:text-body space-y-4 border p-4 font-sans">
                                    {/* Message */}
                                    <div className="flex items-start gap-3">
                                      <div className="bg-blue text-eyebrow text-on-blue flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-sans select-none">
                                        IX
                                      </div>
                                      <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex flex-wrap items-center">
                                          <span className="text-label cursor-pointer font-semibold hover:underline">
                                            IxTimeBot
                                          </span>
                                          <span className="bg-discord rounded-control-sm text-eyebrow text-label ml-1.5 px-1 py-0.5 leading-none select-none">
                                            BOT
                                          </span>
                                          <span className="text-footnote text-label-secondary ml-2 select-none">
                                            Today at{" "}
                                            {new Date().toLocaleTimeString([], {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            })}
                                          </span>
                                        </div>

                                        {/* Message Content */}
                                        {typeof simulationResult.payload === "string" ? (
                                          <div className="text-label-secondary break-words whitespace-pre-wrap">
                                            {simulationResult.payload}
                                          </div>
                                        ) : (
                                          <>
                                            {simulationResult.payload.content && (
                                              <div className="text-label-secondary mb-1 break-words whitespace-pre-wrap">
                                                {simulationResult.payload.content}
                                              </div>
                                            )}

                                            {/* Embeds */}
                                            {simulationResult.payload.embeds &&
                                              simulationResult.payload.embeds.map(
                                                (embed: any, idx: number) => (
                                                  <div
                                                    key={idx}
                                                    className="rounded-r-control-sm bg-surface mt-1.5 max-w-[520px] space-y-2 border-l-4 p-3"
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
                                                        <span className="text-caption text-label cursor-pointer hover:underline">
                                                          {embed.author.name}
                                                        </span>
                                                      </div>
                                                    )}

                                                    {embed.title && (
                                                      <div className="text-caption text-label md:text-body cursor-pointer hover:underline">
                                                        {embed.title}
                                                      </div>
                                                    )}

                                                    {embed.description && (
                                                      <div className="text-footnote text-label-secondary leading-relaxed break-words whitespace-pre-wrap">
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
                                                                "text-footnote space-y-0.5",
                                                                f.inline ? "" : "col-span-full"
                                                              )}
                                                            >
                                                              <div className="text-eyebrow text-label opacity-90">
                                                                {f.name}
                                                              </div>
                                                              <div className="text-footnote text-label-secondary break-words whitespace-pre-wrap">
                                                                {f.value}
                                                              </div>
                                                            </div>
                                                          )
                                                        )}
                                                      </div>
                                                    )}

                                                    {embed.footer && (
                                                      <div className="text-footnote text-label-secondary flex items-center gap-1 pt-1 select-none">
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
                                <div className="rounded-control border-green/20 bg-green/5 text-caption text-green flex items-start gap-2 border p-3">
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
                    <div className="border-separator bg-surface text-label-secondary rounded-control text-footnote flex min-h-[220px] flex-col items-center justify-center border p-8 text-center">
                      <Info className="text-label-secondary mb-2 h-6 w-6 opacity-50" />
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
          <div className="animate-in fade-in duration-fast space-y-4 pt-1">
            {isRolesLoading ? (
              <div className="text-label-secondary text-footnote flex items-center justify-center py-12">
                <Loader2 className="text-tint mr-2 h-4 w-4 animate-spin" />
                Loading Discord roles...
              </div>
            ) : !roles || roles.length === 0 ? (
              <div className="text-label-secondary border-separator bg-surface rounded-control text-footnote flex flex-col items-center justify-center border p-6 py-12 text-center">
                <Info className="text-label-secondary mb-2 h-6 w-6" />
                <span>No roles fetched from Discord API.</span>
                <span className="text-footnote mt-1">
                  Ensure correct guild credentials and bot online status.
                </span>
              </div>
            ) : (
              <div className="border-separator bg-surface rounded-control overflow-x-auto border">
                <table className="text-footnote w-full text-left tabular-nums">
                  <thead>
                    <tr className="border-separator bg-fill-4 border-b">
                      <th className="text-label-secondary text-eyebrow px-4 py-2.5">Position</th>
                      <th className="text-label-secondary text-eyebrow px-4 py-2.5">Role Name</th>
                      <th className="text-label-secondary text-eyebrow px-4 py-2.5">Role ID</th>
                      <th className="text-label-secondary text-eyebrow px-4 py-2.5">
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
                            "border-separator hover:bg-fill-4 border-b font-medium transition-colors last:border-b-0",
                            isAdm ? "bg-yellow/5 text-yellow" : ""
                          )}
                        >
                          <td className="text-label-secondary text-footnote px-4 py-2 tabular-nums">
                            #{role.position}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="border-separator h-2.5 w-2.5 shrink-0 rounded-full border"
                                style={{ backgroundColor: getRoleColor(role.color) }}
                              />
                              <span className="font-semibold">{role.name}</span>
                            </div>
                          </td>
                          <td className="text-label-secondary text-footnote px-4 py-2 font-mono">
                            {role.id}
                          </td>
                          <td className="px-4 py-2">
                            {isAdm ? (
                              <Badge variant="yellow" className="text-eyebrow px-1.5 py-0">
                                Admin Permit
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-separator bg-fill-4 text-label-secondary text-eyebrow px-1.5 py-0"
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
          <div className="animate-in fade-in duration-fast space-y-4 pt-1">
            {/* Filter Controls */}
            <div className="bg-fill-4 border-separator rounded-control text-footnote flex flex-wrap items-center justify-between gap-3 border p-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Process Selector */}
                <div className="space-y-1">
                  <Label
                    htmlFor="log-proc-select"
                    className="text-label-secondary text-subhead block"
                  >
                    Daemon Process
                  </Label>
                  <select
                    id="log-proc-select"
                    value={logProcess}
                    onChange={(e) => setLogProcess(e.target.value as any)}
                    className={cn(
                      fieldStyles,
                      "rounded-control-sm text-footnote h-(--control-height-sm) cursor-pointer px-2.5"
                    )}
                  >
                    <option value="ixwiki-discord-bot">ixwiki-discord-bot</option>
                    <option value="ixstats-ixtwitter">ixstats-ixtwitter</option>
                  </select>
                </div>

                {/* Log Type Selector */}
                <div className="space-y-1">
                  <Label
                    htmlFor="log-type-select"
                    className="text-label-secondary text-subhead block"
                  >
                    Stream Type
                  </Label>
                  <select
                    id="log-type-select"
                    value={logType}
                    onChange={(e) => setLogType(e.target.value as any)}
                    className={cn(
                      fieldStyles,
                      "rounded-control-sm text-footnote h-(--control-height-sm) cursor-pointer px-2.5"
                    )}
                  >
                    <option value="out">stdout (Logs)</option>
                    <option value="err">stderr (Errors)</option>
                  </select>
                </div>
              </div>

              {/* Refresh buttons and toggle */}
              <div className="flex items-center gap-3">
                <div className="border-separator bg-surface rounded-control flex items-center gap-1.5 border px-2 py-1.5">
                  <Label
                    htmlFor="auto-refresh-logs-switch"
                    className="text-label-secondary text-subhead cursor-pointer select-none"
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
              <div className="text-label-secondary border-separator rounded-control-sm text-footnote bg-surface-elevated absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 border px-2 py-0.5 font-mono select-none">
                <FileCode className="h-3 w-3" />
                <span>50 lines</span>
              </div>
              <div className="border-separator rounded-control bg-surface text-footnote text-label-secondary md:text-footnote max-h-[450px] min-h-[280px] w-full overflow-x-auto border p-4 font-mono leading-relaxed">
                {logs && logs.length > 0 ? (
                  <pre className="flex flex-col gap-0.5 whitespace-pre select-text">
                    {logs.map((line, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "rounded-control-sm hover:bg-fill-4 px-1 transition-colors",
                          logType === "err" ? "text-red" : ""
                        )}
                      >
                        <span className="border-separator text-label-secondary mr-3 inline-block w-6 border-r pr-1.5 text-right select-none">
                          {idx + 1}
                        </span>
                        <span>{line}</span>
                      </div>
                    ))}
                  </pre>
                ) : (
                  <div className="text-label-secondary flex flex-col items-center justify-center py-20 select-none">
                    <Terminal className="mb-2 h-6 w-6 opacity-40" />
                    <span>No process logs output recorded.</span>
                    <span className="text-footnote mt-0.5">
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
