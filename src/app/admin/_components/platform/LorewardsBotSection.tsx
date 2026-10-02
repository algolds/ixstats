"use client";
// src/app/admin/_components/platform/LorewardsBotSection.tsx

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { cn } from "~/lib/utils";
import {
  Refresh as RefreshCw,
  SystemRestart as Loader2,
  Play,
  Square,
  Terminal,
  ControlSlider as Sliders,
  Database,
  Trash as Trash2,
  Trophy as Award,
  InfoCircle as Info,
  Flash as Zap,
  ArrowSeparateVertical as ChevronsUpDown,
  Prohibition as Ban,
  FloppyDisk as Save,
  CheckCircle,
} from "iconoir-react";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
  CommandGroup,
} from "~/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export function LorewardsBotSection() {
  const notify = useNotify();

  // Blacklist form states
  const [blacklistUser, setBlacklistUser] = useState<string>("");
  const [blacklistDuration, setBlacklistDuration] = useState<string>("permanent");
  const [blacklistExpiry, setBlacklistExpiry] = useState<string>("");

  // Search Combobox Popover states
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const { data: wikiUserSuggestions, isLoading: isSuggestionsLoading } =
    api.admin.searchWikiUsers.useQuery(
      { query: debouncedSearchTerm, limit: 15 },
      { enabled: debouncedSearchTerm.trim().length >= 2 }
    );

  // Override form states
  const [overrideDate, setOverrideDate] = useState<string>("");
  const [overrideType, setOverrideType] = useState<string>("daily");
  const [overrideWinnerUser, setOverrideWinnerUser] = useState<string>("");
  const [overrideWinnerPage, setOverrideWinnerPage] = useState<string>("");
  const [overrideWinnerScore, setOverrideWinnerScore] = useState<number>(100);
  const [overrideWinnerBytes, setOverrideWinnerBytes] = useState<number>(1000);
  const [overrideRunnerUpUser, setOverrideRunnerUpUser] = useState<string>("");
  const [overrideRunnerUpPage, setOverrideRunnerUpPage] = useState<string>("");
  const [overrideRunnerUpScore, setOverrideRunnerUpScore] = useState<number>(50);
  const [overrideRunnerUpBytes, setOverrideRunnerUpBytes] = useState<number>(500);

  // Cross-validation / Sync states
  const [adminDate, setAdminDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1); // Default to yesterday
    return d.toISOString().slice(0, 10);
  });
  const [validationResult, setValidationResult] = useState<any>(null);

  // Blacklist query
  const { data: blacklist, refetch: refetchBlacklist } = api.lorewards.getBlacklist.useQuery();

  // Blacklist Mutation
  const updateBlacklistMutation = api.lorewards.updateBlacklist.useMutation({
    onSuccess: () => {
      notify.success(
        "Blacklist Updated",
        "The user's blacklist status has been successfully updated."
      );
      refetchBlacklist();
    },
    onError: (err) => {
      notify.error("Blacklist Update Failed", err.message);
    },
  });

  // Override Winner Mutation
  const overrideWinnerMutation = api.lorewards.overrideWinner.useMutation({
    onSuccess: () => {
      notify.success("Winner Overridden", "The winner override has been successfully synced.");
    },
    onError: (err) => {
      notify.error("Override Failed", err.message);
    },
  });

  // Admin sync mutation
  const triggerSyncMutation = api.lorewards.triggerSync.useMutation({
    onSuccess: () => {
      notify.success(
        "Database Sync Complete",
        "Successfully synchronized state file and OOL page."
      );
    },
    onError: (err) => {
      notify.error("Database Sync Failed", err.message);
    },
  });

  // Cross validate mutation
  const crossValidateMutation = api.lorewards.crossValidate.useMutation({
    onSuccess: (data) => {
      setValidationResult(data);
      notify.success("Cross-Validation Complete", `Calculated match stats for ${data.date}.`);
    },
    onError: (err) => {
      notify.error("Cross-Validation Failed", err.message);
    },
  });

  // Fetch validation history for admin console
  const { data: validationHistory } = api.lorewards.getCrossValidationHistory.useQuery({
    limit: 5,
  });

  const handleAddBlacklist = () => {
    if (!blacklistUser.trim()) {
      notify.error("Validation Error", "Please input a valid username.");
      return;
    }
    let expiry: string | null = null;
    if (blacklistDuration === "7days") {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      expiry = d.toISOString().slice(0, 10);
    } else if (blacklistDuration === "30days") {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      expiry = d.toISOString().slice(0, 10);
    } else if (blacklistDuration === "custom") {
      if (!blacklistExpiry) {
        notify.error("Validation Error", "Please choose a custom expiry date.");
        return;
      }
      expiry = blacklistExpiry;
    }

    updateBlacklistMutation.mutate({
      username: blacklistUser.trim(),
      action: "add",
      expiryDate: expiry,
    });
    setBlacklistUser("");
    setSearchTerm("");
  };

  const handleOverrideSubmit = () => {
    if (!overrideDate) {
      notify.error("Validation Error", "Please select a date for the override.");
      return;
    }
    overrideWinnerMutation.mutate({
      date: overrideDate,
      type: overrideType as "daily" | "weekly" | "monthly",
      winnerUser: overrideWinnerUser || null,
      winnerPage: overrideWinnerPage || null,
      winnerScore: overrideWinnerScore ? Number(overrideWinnerScore) : null,
      winnerBytes: overrideWinnerBytes ? Number(overrideWinnerBytes) : null,
      runnerUpUser: overrideRunnerUpUser || null,
      runnerUpPage: overrideRunnerUpPage || null,
      runnerUpScore: overrideRunnerUpScore ? Number(overrideRunnerUpScore) : null,
      runnerUpBytes: overrideRunnerUpBytes ? Number(overrideRunnerUpBytes) : null,
    });
  };

  // PM2 Process control
  const { data: botProcesses, refetch: refetchProcesses } = api.admin.getBotProcesses.useQuery(
    undefined,
    { refetchInterval: 5000 }
  );

  const controlBotMutation = api.admin.controlBotProcess.useMutation({
    onSuccess: (data) => {
      notify.success("Process Control", data.message);
      refetchProcesses();
    },
    onError: (err) => notify.error("Process Error", err.message),
  });

  const handleProcessControl = (
    processName: "ixwiki-discord-bot" | "ixstats-ixtwitter",
    action: "start" | "stop" | "restart"
  ) => {
    controlBotMutation.mutate({ processName, action });
  };

  // Bot Logs terminal
  const [selectedProcess, setSelectedProcess] = useState<
    "ixwiki-discord-bot" | "ixstats-ixtwitter"
  >("ixwiki-discord-bot");
  const [logType, setLogType] = useState<"out" | "err">("out");

  const {
    data: logsData,
    refetch: refetchLogs,
    isFetching: isFetchingLogs,
  } = api.admin.getBotProcessLogs.useQuery(
    { processName: selectedProcess, logType },
    { refetchInterval: 5000 }
  );

  // Manual Loreward Run Console
  const [runDate, setRunDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [scoringResult, setScoringResult] = useState<any>(null);

  const triggerScoringMutation = api.admin.triggerLorewardScoring.useMutation({
    onSuccess: (data) => {
      setScoringResult(data);
      notify.success("Scoring Engine", "Successfully generated candidate lists.");
    },
    onError: (err) => notify.error("Scoring Error", err.message),
  });

  const pushToBotMutation = api.admin.pushLorewardToBot.useMutation({
    onSuccess: () => notify.success("Announced", "Broadcasted winner embed to Discord channel"),
    onError: (err) => notify.error("Broadcast Error", err.message),
  });

  const saveOverrideMutation = api.admin.saveLorewardWinnerOverride.useMutation({
    onSuccess: () => notify.success("Saved", "Saved winner details override to database"),
    onError: (err) => notify.error("Override Error", err.message),
  });

  const handleTriggerScoring = () => {
    triggerScoringMutation.mutate({ date: runDate });
  };

  const handlePushToBot = () => {
    if (!scoringResult || !scoringResult.winner) return;
    pushToBotMutation.mutate({
      date: runDate,
      winner: {
        user: scoringResult.winner.user,
        page: scoringResult.winner.page,
        score: scoringResult.winner.score ?? scoringResult.winner.finalScore ?? 0,
        bytesAdded: scoringResult.winner.bytesAdded ?? 0,
      },
      runnerUp: scoringResult.runnerUp
        ? {
            user: scoringResult.runnerUp.user,
            page: scoringResult.runnerUp.page,
            score: scoringResult.runnerUp.score ?? scoringResult.runnerUp.finalScore ?? 0,
            bytesAdded: scoringResult.runnerUp.bytesAdded ?? 0,
          }
        : null,
      candidates: scoringResult.candidates || [],
      editCount: scoringResult.editCount || 0,
    });
  };

  const handleSaveOverride = () => {
    if (!scoringResult || !scoringResult.winner) return;
    saveOverrideMutation.mutate({
      date: runDate,
      winnerUser: scoringResult.winner.user,
      winnerPage: scoringResult.winner.page,
      winnerScore: scoringResult.winner.score ?? scoringResult.winner.finalScore ?? 0,
      winnerBytes: scoringResult.winner.bytesAdded ?? 0,
      runnerUpUser: scoringResult.runnerUp?.user ?? null,
      runnerUpPage: scoringResult.runnerUp?.page ?? null,
      runnerUpScore: scoringResult.runnerUp?.score ?? scoringResult.runnerUp?.finalScore ?? null,
      runnerUpBytes: scoringResult.runnerUp?.bytesAdded ?? null,
      type: "daily",
    });
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const dm = 2;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* PM2 Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-title-3 flex items-center gap-2">
            <Sliders className="text-indigo h-5 w-5" />
            PM2 Process Manager
          </CardTitle>
          <CardDescription>Control active backend integrations in real-time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {botProcesses?.map((proc) => (
              <div
                key={proc.name}
                className="border-separator bg-fill-4 rounded-row flex flex-col justify-between border p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-label font-semibold">{proc.name}</h4>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          proc.status === "online" ? "bg-green" : "bg-red"
                        )}
                      />
                      <span className="text-label-secondary text-footnote capitalize">
                        {proc.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleProcessControl(proc.name as any, "start")}
                      disabled={proc.status === "online"}
                      className="w-8"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleProcessControl(proc.name as any, "stop")}
                      disabled={proc.status !== "online"}
                      className="text-destructive w-8"
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleProcessControl(proc.name as any, "restart")}
                      className="w-8"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="border-separator text-label-secondary text-footnote mt-4 grid grid-cols-2 gap-2 border-t pt-3">
                  <div>
                    <span className="block opacity-60">CPU Load</span>
                    <span className="text-label font-medium tabular-nums">{proc.cpu}%</span>
                  </div>
                  <div>
                    <span className="block opacity-60">Memory</span>
                    <span className="text-label font-medium tabular-nums">
                      {formatBytes(proc.memory)}
                    </span>
                  </div>
                  <div>
                    <span className="block opacity-60">Restarts</span>
                    <span className="text-label font-medium tabular-nums">{proc.restarts}</span>
                  </div>
                  <div>
                    <span className="block opacity-60">Uptime</span>
                    <span className="text-label font-medium tabular-nums">
                      {proc.uptime ? `${Math.round(proc.uptime / 60000)}m` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bot Logs Console */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-title-3 flex items-center gap-2">
                <Terminal className="text-green h-5 w-5" />
                Live Console logs
              </CardTitle>
              <CardDescription>Auditing output stream of Discord bot processes</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedProcess} onValueChange={(v) => setSelectedProcess(v as any)}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ixwiki-discord-bot">Discord Bot</SelectItem>
                  <SelectItem value="ixstats-ixtwitter">IxTwitter Feed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={logType} onValueChange={(v) => setLogType(v as any)}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="out">Stdout (info)</SelectItem>
                  <SelectItem value="err">Stderr (errors)</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => refetchLogs()}
                disabled={isFetchingLogs}
                className="w-8"
              >
                <RefreshCw className={cn("h-4 w-4", isFetchingLogs && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="scrollbar-thumb-muted-foreground/30 bg-fill-4 border-separator text-label rounded-row text-footnote max-h-72 min-h-60 scrollbar-thin overflow-y-auto border p-4 font-mono">
            {logsData && logsData.length > 0 ? (
              logsData.map((line, idx) => (
                <div key={idx} className="hover:bg-fill-4 py-0.5 leading-5 transition-colors">
                  <span className="text-label-secondary pr-3 select-none">{idx + 1}</span>
                  <span className={cn(logType === "err" ? "text-destructive" : "text-label")}>
                    {line}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-label-secondary flex min-h-48 items-center justify-center italic">
                No logs recorded yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loreward Run Console */}
      <Card>
        <CardHeader>
          <CardTitle className="text-title-3 flex items-center gap-2">
            <Award className="text-yellow h-5 w-5" />
            Loreward Run Console
          </CardTitle>
          <CardDescription>
            Manually trigger scoring run, preview candidates, and push updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Input
              type="date"
              value={runDate}
              onChange={(e) => setRunDate(e.target.value)}
              className="max-w-[12rem]"
            />
            <Button
              onClick={handleTriggerScoring}
              disabled={triggerScoringMutation.isPending}
              className="gap-2"
            >
              {triggerScoringMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Trigger Daily Scoring
            </Button>
          </div>

          {scoringResult && (
            <div className="border-separator rounded-row mt-6 space-y-4 border p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="text-headline text-green flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Winner Picked
                  </h4>
                  {scoringResult.winner ? (
                    <div className="text-label-secondary text-body mt-2">
                      <p className="text-label font-semibold">{scoringResult.winner.user}</p>
                      <p>Page: {scoringResult.winner.page}</p>
                      <p>Score: {scoringResult.winner.score ?? scoringResult.winner.finalScore}</p>
                      <p>Bytes: {scoringResult.winner.bytesAdded?.toLocaleString() || 0} bytes</p>
                    </div>
                  ) : (
                    <p className="text-label-secondary text-body mt-2 italic">None found</p>
                  )}
                </div>

                <div>
                  <h4 className="text-headline text-blue flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Runner-up Picked
                  </h4>
                  {scoringResult.runnerUp ? (
                    <div className="text-label-secondary text-body mt-2">
                      <p className="text-label font-semibold">{scoringResult.runnerUp.user}</p>
                      <p>Page: {scoringResult.runnerUp.page}</p>
                      <p>
                        Score: {scoringResult.runnerUp.score ?? scoringResult.runnerUp.finalScore}
                      </p>
                      <p>Bytes: {scoringResult.runnerUp.bytesAdded?.toLocaleString() || 0} bytes</p>
                    </div>
                  ) : (
                    <p className="text-label-secondary text-body mt-2 italic">None found</p>
                  )}
                </div>
              </div>

              {scoringResult.candidates && scoringResult.candidates.length > 0 && (
                <div className="border-separator mt-4 border-t pt-3">
                  <h4 className="text-label-secondary text-subhead mb-2">
                    Scoring Candidate Queue
                  </h4>
                  <div className="text-label-secondary text-footnote space-y-2">
                    {scoringResult.candidates.map((c: any, index: number) => (
                      <div
                        key={index}
                        className="border-separator flex justify-between border-b py-1"
                      >
                        <span>
                          {index + 1}. **{c.user}** on *{c.page}*
                        </span>
                        <span className="text-label font-semibold tabular-nums">
                          {c.score ?? c.finalScore} pts (+{c.bytesAdded?.toLocaleString() || 0}b)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleSaveOverride}
                  disabled={saveOverrideMutation.isPending}
                  variant="outline"
                  className="gap-2"
                >
                  {saveOverrideMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Winner Override to DB
                </Button>
                <Button
                  onClick={handlePushToBot}
                  disabled={pushToBotMutation.isPending}
                  className="gap-2"
                >
                  {pushToBotMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Announce & Sync to Discord Bot
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync & Cross-Validation Diagnostics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-title-3 flex items-center gap-2">
            <Database className="text-blue h-5 w-5" />
            Sync & Cross-Validation Diagnostics
          </CardTitle>
          <CardDescription>
            Force sync the scoring db and cross-validate daily outcomes between bot scanning and
            WikiOS core
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="destructive"
              onClick={() => triggerSyncMutation.mutate()}
              disabled={triggerSyncMutation.isPending}
              className="gap-2"
              size="sm"
            >
              {triggerSyncMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" />
                  Trigger Full State Sync
                </>
              )}
            </Button>

            <div className="ml-auto flex items-center gap-2">
              <Input
                type="date"
                value={adminDate}
                onChange={(e) => setAdminDate(e.target.value)}
                className="rounded-control-sm md:text-footnote h-(--control-height-sm) w-36"
              />
              <Button
                variant="secondary"
                onClick={() => crossValidateMutation.mutate({ date: adminDate })}
                disabled={crossValidateMutation.isPending}
                className="gap-2"
                size="sm"
              >
                {crossValidateMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Run Cross-Validation"
                )}
              </Button>
            </div>
          </div>

          {/* Validation Result Display */}
          {validationResult && (
            <div className="rounded-row border-blue/20 bg-blue/5 space-y-3 border p-4">
              <div className="border-blue/20 flex items-center justify-between border-b pb-2">
                <span className="text-eyebrow text-blue flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Cross-Validation Report for {validationResult.date}
                </span>
                <span
                  className={cn(
                    "rounded-control-sm text-caption px-2 py-0.5",
                    validationResult.winnersAgree
                      ? "bg-green/10 text-green"
                      : "bg-destructive/10 text-destructive"
                  )}
                >
                  {validationResult.winnersAgree ? "Winners Agree" : "Winners Disagree"}
                </span>
              </div>
              <div className="text-footnote grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <h6 className="text-label-secondary text-subhead mb-1">Bot Result:</h6>
                  <p>
                    Winner: <strong>{validationResult.bot.winner || "None"}</strong> (
                    {validationResult.bot.winnerPage || "No page"})
                  </p>
                  <p>
                    Score: <strong>{validationResult.bot.score || "—"}</strong>
                  </p>
                </div>
                <div>
                  <h6 className="text-label-secondary text-subhead mb-1">WikiOS Core Result:</h6>
                  <p>
                    Winner: <strong>{validationResult.wikios.winner || "None"}</strong> (
                    {validationResult.wikios.winnerPage || "No page"})
                  </p>
                  <p>
                    Score: <strong>{validationResult.wikios.score || "—"}</strong>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recent validation history list */}
          <div className="space-y-2">
            <h6 className="text-label-secondary text-subhead">Recent Cross-Validation History:</h6>
            <div className="border-separator bg-fill-4 divide-separator rounded-row text-footnote divide-y overflow-hidden border">
              {validationHistory?.results && validationHistory.results.length > 0 ? (
                validationHistory.results.map((r: any) => (
                  <div
                    key={r.date}
                    className="hover:bg-fill-4 flex items-center justify-between p-3 transition-colors"
                  >
                    <span className="font-semibold tabular-nums">{r.date}</span>
                    <div className="text-footnote flex items-center gap-3">
                      <span>
                        Bot: <strong>{r.botWinner || "None"}</strong>
                      </span>
                      <span>
                        WikiOS: <strong>{r.wikiosWinner || "None"}</strong>
                      </span>
                      <span
                        className={cn(
                          "py-0.2 rounded-control-sm text-caption px-2",
                          r.winnersAgree
                            ? "bg-green/10 text-green"
                            : "bg-destructive/10 text-destructive"
                        )}
                      >
                        {r.winnersAgree ? "MATCH" : "MISMATCH"}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-label-secondary p-4 text-center italic">
                  No cross-validation records found.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Silent Blacklist Manager */}
      <Card>
        <CardHeader>
          <CardTitle className="text-title-3 flex items-center gap-2">
            <Ban className="text-red h-5 w-5" />
            Silent Blacklist Manager
          </CardTitle>
          <CardDescription>
            Excludes specified users from the bot's daily scans and win eligibility for a
            configurable duration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-label-secondary text-subhead">Username</label>
              <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboboxOpen}
                    className="flex w-full items-center justify-between"
                  >
                    <span className="truncate">{blacklistUser || "Select wiki username..."}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search wiki account..."
                      value={searchTerm}
                      onValueChange={setSearchTerm}
                      className="text-footnote h-8"
                    />
                    <CommandList className="max-h-60 overflow-y-auto">
                      {isSuggestionsLoading && (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="text-label-secondary h-4 w-4 animate-spin" />
                          <span className="text-label-secondary text-footnote ml-2">
                            Searching wiki...
                          </span>
                        </div>
                      )}
                      {!isSuggestionsLoading &&
                        (!wikiUserSuggestions || wikiUserSuggestions.length === 0) && (
                          <CommandEmpty className="text-label-secondary text-footnote p-4 text-center">
                            {searchTerm.trim().length < 2
                              ? "Type at least 2 characters to search..."
                              : "No wiki accounts found."}
                          </CommandEmpty>
                        )}
                      {!isSuggestionsLoading &&
                        wikiUserSuggestions &&
                        wikiUserSuggestions.length > 0 && (
                          <CommandGroup heading="Wiki Accounts">
                            {wikiUserSuggestions.map((user) => (
                              <CommandItem
                                key={user.username}
                                value={user.username}
                                onSelect={() => {
                                  setBlacklistUser(user.username);
                                  setComboboxOpen(false);
                                }}
                                className="hover:bg-fill-4 text-footnote flex cursor-pointer items-center justify-between px-3 py-2"
                              >
                                <div className="flex items-center gap-2 font-medium">
                                  <UnifiedCountryFlag
                                    countryName={user.username}
                                    size="xs"
                                    showTooltip={false}
                                  />
                                  {user.username}
                                </div>
                                <span className="text-label-secondary text-footnote tabular-nums">
                                  {user.editCount} edits
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      {searchTerm.trim().length > 0 && (
                        <CommandGroup heading="Custom Entry">
                          <CommandItem
                            value={searchTerm.trim()}
                            onSelect={() => {
                              setBlacklistUser(searchTerm.trim());
                              setComboboxOpen(false);
                            }}
                            className="hover:bg-fill-4 text-tint text-caption flex cursor-pointer items-center gap-2 px-3 py-2"
                          >
                            Use custom: "{searchTerm.trim()}"
                          </CommandItem>
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <label className="text-label-secondary text-subhead">Duration</label>
              <Select value={blacklistDuration} onValueChange={(v) => setBlacklistDuration(v)}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="permanent">Permanent</SelectItem>
                  <SelectItem value="7days">7 Days</SelectItem>
                  <SelectItem value="30days">30 Days</SelectItem>
                  <SelectItem value="custom">Custom Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {blacklistDuration === "custom" && (
              <div className="space-y-1">
                <label className="text-label-secondary text-subhead">Expiry Date</label>
                <Input
                  type="date"
                  value={blacklistExpiry}
                  onChange={(e) => setBlacklistExpiry(e.target.value)}
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                />
              </div>
            )}
          </div>
          <Button
            variant="destructive"
            onClick={handleAddBlacklist}
            disabled={updateBlacklistMutation.isPending}
            className="w-full sm:w-auto"
          >
            Add to Blacklist
          </Button>

          {/* Active Blacklisted Users List */}
          <div className="space-y-2">
            <h6 className="text-label-secondary text-subhead">Active Blacklisted Users:</h6>
            <div className="border-separator bg-fill-4 divide-separator rounded-row text-footnote max-h-48 divide-y overflow-hidden overflow-y-auto border">
              {blacklist && Object.keys(blacklist).length > 0 ? (
                Object.entries(blacklist).map(([user, date]: [string, any]) => (
                  <div
                    key={user}
                    className="hover:bg-fill-4 flex items-center justify-between p-3 transition-colors"
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      <UnifiedCountryFlag countryName={user} size="xs" showTooltip={false} />
                      {user}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-label-secondary text-footnote tabular-nums">
                        Expires: {date ? String(date).slice(0, 10) : "Permanent"}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${user} from the blacklist`}
                        onClick={() =>
                          updateBlacklistMutation.mutate({ username: user, action: "remove" })
                        }
                        disabled={updateBlacklistMutation.isPending}
                        className="text-destructive"
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-label-secondary p-4 text-center italic">
                  No blacklisted users found.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Winner Override Tool */}
      <Card>
        <CardHeader>
          <CardTitle className="text-title-3 flex items-center gap-2">
            <Sliders className="text-yellow h-5 w-5" />
            Manual Winner Override Tool
          </CardTitle>
          <CardDescription>
            Manually rewrite the winning details of past daily, weekly, or monthly entries and push
            announcement updates to the Discord bot
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-label-secondary text-subhead">Date</label>
              <Input
                type="date"
                value={overrideDate}
                onChange={(e) => setOverrideDate(e.target.value)}
                className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
              />
            </div>
            <div className="space-y-1">
              <label className="text-label-secondary text-subhead">Type</label>
              <Select value={overrideType} onValueChange={(v) => setOverrideType(v)}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily Loreward</SelectItem>
                  <SelectItem value="weekly">Weekly Loreward</SelectItem>
                  <SelectItem value="monthly">Monthly Loreward</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Winner details */}
          <div className="border-separator space-y-2 border-t pt-2">
            <span className="text-eyebrow text-yellow">1. Winner Details</span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-label-secondary text-subhead">Username</label>
                <Input
                  placeholder="Winner username"
                  value={overrideWinnerUser}
                  onChange={(e) => setOverrideWinnerUser(e.target.value)}
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                />
              </div>
              <div className="space-y-1">
                <label className="text-label-secondary text-subhead">Page Title</label>
                <Input
                  placeholder="Winner article page"
                  value={overrideWinnerPage}
                  onChange={(e) => setOverrideWinnerPage(e.target.value)}
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-label-secondary text-subhead">Score</label>
                <Input
                  type="number"
                  placeholder="Winner score"
                  value={overrideWinnerScore}
                  onChange={(e) => setOverrideWinnerScore(Number(e.target.value))}
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-label-secondary text-subhead">Bytes Added</label>
                <Input
                  type="number"
                  placeholder="Winner bytes"
                  value={overrideWinnerBytes}
                  onChange={(e) => setOverrideWinnerBytes(Number(e.target.value))}
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
                />
              </div>
            </div>
          </div>

          {/* Runner up details */}
          <div className="border-separator space-y-2 border-t pt-2">
            <span className="text-label-secondary text-eyebrow">2. Runner-up Details</span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-label-secondary text-subhead">Username</label>
                <Input
                  placeholder="Runner-up username"
                  value={overrideRunnerUpUser}
                  onChange={(e) => setOverrideRunnerUpUser(e.target.value)}
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                />
              </div>
              <div className="space-y-1">
                <label className="text-label-secondary text-subhead">Page Title</label>
                <Input
                  placeholder="Runner-up article page"
                  value={overrideRunnerUpPage}
                  onChange={(e) => setOverrideRunnerUpPage(e.target.value)}
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-label-secondary text-subhead">Score</label>
                <Input
                  type="number"
                  placeholder="Runner-up score"
                  value={overrideRunnerUpScore}
                  onChange={(e) => setOverrideRunnerUpScore(Number(e.target.value))}
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-label-secondary text-subhead">Bytes Added</label>
                <Input
                  type="number"
                  placeholder="Runner-up bytes"
                  value={overrideRunnerUpBytes}
                  onChange={(e) => setOverrideRunnerUpBytes(Number(e.target.value))}
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
                />
              </div>
            </div>
          </div>

          <Button
            onClick={handleOverrideSubmit}
            disabled={overrideWinnerMutation.isPending}
            className="w-full gap-2"
          >
            {overrideWinnerMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save and Sync Winner Override
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
