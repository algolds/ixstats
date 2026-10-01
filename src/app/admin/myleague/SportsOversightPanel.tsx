"use client";

import { useState, useMemo, useEffect } from "react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { LeagueCreator } from "~/components/sports/league/LeagueCreator";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Plus,
  Trash as Trash2,
  Eye,
  SystemRestart as Loader2,
  WarningTriangle as AlertTriangle,
  Shield,
  ArrowLeft,
  Sparks as Sparkles,
  Settings,
  Star,
} from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { getAllPresets } from "~/lib/sports";
import { Input, fieldStyles } from "~/components/ui/input";

const statusMeta: Record<string, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-green/10 text-green border-green/30",
  },
  draft: { label: "Draft", className: "bg-fill-3 text-label-secondary border-separator" },
  archived: { label: "Archived", className: "bg-yellow/10 text-yellow border-yellow/30" },
  suspended: { label: "Suspended", className: "bg-red/10 text-red border-red/30" },
};

const archetypeMeta: Record<string, { label: string; className: string }> = {
  league: { label: "League", className: "bg-blue/10 text-blue border-blue/30" },
  division_conference: {
    label: "Division / Conference",
    className: "bg-green/10 text-green border-green/30",
  },
  bracket: { label: "Bracket", className: "bg-red/10 text-red border-red/30" },
  circuit: { label: "Circuit", className: "bg-yellow/10 text-yellow border-yellow/30" },
};

// ─── Sub-Component for Advanced Operations ───────────────────────────────

function AdminAdvancedControls({ league, onRefetch }: { league: any; onRefetch: () => void }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [matchOverrideOpen, setMatchOverrideOpen] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);

  // Active season logic
  const activeSeason = league.seasons?.[0] || null;
  const activeSeasonId = activeSeason?.id ?? "";

  const { data: schedule } = api.sports.getSchedule.useQuery(
    { seasonId: activeSeasonId },
    { enabled: !!activeSeasonId }
  );

  const resetSeasonMutation = api.sports.resetSeason.useMutation({
    onSuccess: () => {
      notify.success("Season Reset", "The active season games and standings have been wiped.");
      onRefetch();
      if (activeSeasonId) void utils.sports.getSchedule.invalidate({ seasonId: activeSeasonId });
    },
    onError: (e) => notify.error("Reset Failed", e.message),
  });

  const overrideMatchMutation = api.sports.overrideMatchResult.useMutation({
    onSuccess: () => {
      notify.success("Result Saved", "Match score has been overridden successfully.");
      setMatchOverrideOpen(false);
      onRefetch();
      if (activeSeasonId) void utils.sports.getSchedule.invalidate({ seasonId: activeSeasonId });
    },
    onError: (e) => notify.error("Override Failed", e.message),
  });

  const regenerateScheduleMutation = api.sports.regenerateSchedule.useMutation({
    onSuccess: () => {
      notify.success("Schedule Regenerated", "A fresh schedule has been constructed.");
      onRefetch();
      if (activeSeasonId) void utils.sports.getSchedule.invalidate({ seasonId: activeSeasonId });
    },
    onError: (e) => notify.error("Regeneration Failed", e.message),
  });

  const handleOverrideScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatchId) return;
    overrideMatchMutation.mutate({
      matchId: selectedMatchId,
      homeScore,
      awayScore,
    });
  };

  const handleExportData = () => {
    // Generate JSON download
    const filename = `${league.name.toLowerCase().replace(/\s+/g, "_")}_export.json`;
    const jsonStr = JSON.stringify(league, null, 2);
    const element = document.createElement("a");
    const file = new Blob([jsonStr], { type: "application/json" });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {activeSeason && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (window.confirm("Wipe all matches and standings for this active season?")) {
                resetSeasonMutation.mutate({ seasonId: activeSeasonId });
              }
            }}
            disabled={resetSeasonMutation.isPending}
            className="text-destructive"
          >
            {resetSeasonMutation.isPending ? "Resetting..." : "Reset Season Data"}
          </Button>
        )}

        {activeSeason && (
          <Button variant="outline" size="sm" onClick={() => setMatchOverrideOpen(true)}>
            Override Match Score
          </Button>
        )}

        {activeSeason && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => regenerateScheduleMutation.mutate({ seasonId: activeSeasonId })}
            disabled={regenerateScheduleMutation.isPending}
          >
            {regenerateScheduleMutation.isPending ? "Regenerating..." : "Regenerate Matches"}
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={handleExportData}>
          Export League JSON
        </Button>
      </div>

      {/* Match override dialog */}
      <Dialog open={matchOverrideOpen} onOpenChange={setMatchOverrideOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Override Match Result</DialogTitle>
            <DialogDescription>Input manual scores for any matchday.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleOverrideScore} className="space-y-4">
            <div className="space-y-2">
              <label className="text-label-secondary text-subhead block">Select Match</label>
              <select
                value={selectedMatchId}
                onChange={(e) => setSelectedMatchId(e.target.value)}
                className={cn(
                  fieldStyles,
                  "rounded-control-sm text-footnote h-(--control-height-sm) w-full cursor-pointer px-2.5"
                )}
                required
              >
                <option value="">-- Choose Match --</option>
                {schedule?.matches?.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    Matchday {m.matchDay}: {m.homeTeam.name} vs {m.awayTeam.name} ({m.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-label-secondary text-subhead block">Home Score</label>
                <Input
                  type="number"
                  min="0"
                  value={homeScore}
                  onChange={(e) => setHomeScore(Number(e.target.value))}
                  className="w-full font-mono"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-label-secondary text-subhead block">Away Score</label>
                <Input
                  type="number"
                  min="0"
                  value={awayScore}
                  onChange={(e) => setAwayScore(Number(e.target.value))}
                  className="w-full font-mono"
                  required
                />
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button variant="ghost" type="button" onClick={() => setMatchOverrideOpen(false)}>
                Cancel
              </Button>
              <Button variant="default" type="submit" disabled={overrideMatchMutation.isPending}>
                {overrideMatchMutation.isPending ? "Saving..." : "Save Override"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AINarratorLab() {
  const [sport, setSport] = useState("soccer");
  const [events, setEvents] = useState<string[]>([
    "Match begins. Home team using neutral tactics.",
    "GOAL! John Smith fires a shot past the goalie!",
    "YELLOW CARD: Alex Jones gets booked for a late challenge.",
  ]);
  const [outputs, setOutputs] = useState<string[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const notify = useNotify();

  const [showConfig, setShowConfig] = useState(false);
  const [provider, setProvider] = useState("nvidia");
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [modelName, setModelName] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [reasoning, setReasoning] = useState(false);
  const [applyGlobally, setApplyGlobally] = useState(false);

  const { data: dbSettings } = api.sports.getGlobalAINarratorSettings.useQuery();
  const saveGlobalSettingsMutation = api.sports.saveGlobalAINarratorSettings.useMutation();

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ixstats:sports:ai-config");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.provider) setProvider(parsed.provider);
        if (parsed.apiKey) setApiKey(parsed.apiKey);
        if (parsed.apiUrl) setApiUrl(parsed.apiUrl);
        if (parsed.modelName) setModelName(parsed.modelName);
        if (parsed.temperature !== undefined) setTemperature(parsed.temperature);
        if (parsed.reasoning !== undefined) setReasoning(parsed.reasoning);
        if (parsed.applyGlobally !== undefined) setApplyGlobally(parsed.applyGlobally);
      }
    } catch (e) {
      console.error("Failed to load AI config from localStorage", e);
    }
  }, []);

  // Sync loaded DB settings if applyGlobally was true
  useEffect(() => {
    if (dbSettings) {
      if (dbSettings.provider) setProvider(dbSettings.provider);
      if (dbSettings.apiKey) setApiKey(dbSettings.apiKey);
      if (dbSettings.apiUrl) setApiUrl(dbSettings.apiUrl);
      if (dbSettings.modelName) setModelName(dbSettings.modelName);
      if (dbSettings.temperature !== undefined) setTemperature(dbSettings.temperature);
      if (dbSettings.reasoning !== undefined) setReasoning(dbSettings.reasoning);
      setApplyGlobally(dbSettings.applyGlobally);
    }
  }, [dbSettings]);

  const saveConfig = (key: string, val: any) => {
    try {
      const saved = localStorage.getItem("ixstats:sports:ai-config");
      const current = saved ? JSON.parse(saved) : {};
      current[key] = val;
      localStorage.setItem("ixstats:sports:ai-config", JSON.stringify(current));
    } catch (e) {
      console.error("Failed to save AI config to localStorage", e);
    }
  };

  const handleResetConfig = () => {
    try {
      localStorage.removeItem("ixstats:sports:ai-config");
      setProvider("nvidia");
      setApiKey("");
      setApiUrl("");
      setModelName("");
      setTemperature(0.7);
      setReasoning(false);
      setApplyGlobally(false);
      notify.success("Config Reset", "AI Narrator configurations reverted to defaults.");
    } catch (e) {
      console.error("Failed to reset AI config", e);
    }
  };

  const getPlaceholders = () => {
    if (provider === "nvidia") {
      return {
        apiUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
        modelName: "meta/llama-3.1-70b-instruct",
      };
    }
    if (provider === "openrouter") {
      return {
        apiUrl: "https://openrouter.ai/api/v1/chat/completions",
        modelName: "meta-llama/llama-3.1-70b-instruct",
      };
    }
    if (provider === "openai") {
      return {
        apiUrl: "https://api.openai.com/v1/chat/completions",
        modelName: "gpt-4o-mini",
      };
    }
    return {
      apiUrl: "https://your-custom-endpoint/v1/chat/completions",
      modelName: "your-custom-model",
    };
  };

  const placeholders = getPlaceholders();

  const templates: Record<string, string[]> = {
    soccer: [
      "Match begins. Home team using neutral tactics.",
      "GOAL! John Smith fires a shot past the goalie!",
      "YELLOW CARD: Alex Jones gets booked for a late challenge.",
    ],
    f1: [
      "Race begins under clear skies. Drivers grid up.",
      "COLLISION: Hamilton and Verstappen touch at turn 4!",
      "CHEQUERED FLAG: Leclerc wins the race!",
    ],
    boxing: [
      "Round 1 begins. Fighters touch gloves.",
      "KNOCKDOWN: Tyson lands a devastating hook and sends Paul to the canvas!",
      "DECISION: Tyson wins by Unanimous Decision!",
    ],
    basketball: [
      "Tip-off! Lakers win the possession and run transition offense.",
      "THREE POINTER: Curry drains a deep shot from the logo!",
      "STEAL & SLAM: Antetokounmpo steals and runs the length of the court for an emphatic dunk!",
    ],
    football: [
      "Kickoff! The home team returns the kick to the 25-yard line.",
      "TOUCHDOWN: Mahomes connects with Kelce in the corner of the endzone!",
      "INTERCEPTION: Bosa tips the pass and Warner runs it back for a pick-six!",
    ],
    hockey: [
      "Faceoff! The puck is dropped and the Rangers gain control.",
      "GOAL: McDavid dekes past two defenders and slides it under the pads!",
      "FIGHT: Kane and Reaves drop the gloves behind the net after a heavy hit!",
    ],
    baseball: [
      "Play ball! The pitcher strikes out the first batter with a high fastball.",
      "HOME RUN: Ohtani crushes a 450-foot shot deep into the right-field stands!",
      "DOUBLE PLAY: Judge hits a grounder to shortstop, turned to second, then to first!",
    ],
  };

  const handleLoadTemplate = (selectedSport: string) => {
    setSport(selectedSport);
    setEvents(templates[selectedSport] ?? []);
    setOutputs([]);
    setLatency(null);
  };

  const handleAddEvent = () => {
    setEvents([...events, ""]);
  };

  const handleRemoveEvent = (index: number) => {
    const next = [...events];
    next.splice(index, 1);
    setEvents(next);
  };

  const handleEventChange = (index: number, val: string) => {
    const next = [...events];
    next[index] = val;
    setEvents(next);
  };

  const runTestMutation = api.sports.testLLMNarrator.useMutation({
    onMutate: () => {
      setStartTime(Date.now());
      setOutputs([]);
      setLatency(null);
    },
    onSuccess: (data) => {
      if (startTime) {
        setLatency(Date.now() - startTime);
      }
      setOutputs(data.outputs);
      notify.success("Simulation Complete", "AI Narrator successfully generated the commentary.");
    },
    onError: (e) => {
      setLatency(null);
      notify.error("Narration Failed", e.message ?? "Failed to run narration playground.");
    },
  });

  const handleRunTest = () => {
    const filteredEvents = events.filter((e) => e.trim().length > 0);
    if (filteredEvents.length === 0) {
      notify.error("Validation Error", "Please provide at least one event description.");
      return;
    }
    runTestMutation.mutate({
      sport,
      events: filteredEvents,
      config: {
        provider,
        apiKey: apiKey || undefined,
        apiUrl: apiUrl || undefined,
        modelName: modelName || undefined,
        temperature,
        reasoning,
      },
    });
  };

  return (
    <Card className="relative overflow-hidden p-6">
      {/* Background radial glow */}

      <div className="space-y-6">
        <div>
          <h2 className="text-label text-title-2 flex items-center gap-2">
            <Sparkles className="text-yellow h-5 w-5" />
            AI Narrator Test Lab
          </h2>
          <p className="text-label-secondary text-footnote mt-1">
            Test and preview live generated commentary across different sports configurations.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-12">
          {/* Controls & Inputs (Left) */}
          <div className="space-y-4 md:col-span-6">
            <div className="space-y-2">
              <label className="text-label-secondary text-subhead block">Sport Preset</label>
              <select
                value={sport}
                onChange={(e) => handleLoadTemplate(e.target.value)}
                className={cn(
                  fieldStyles,
                  "rounded-control-sm text-footnote h-(--control-height-sm) w-full cursor-pointer px-2.5"
                )}
              >
                <option value="soccer">Soccer ⚽</option>
                <option value="f1">Formula 1 🏎️</option>
                <option value="boxing">Boxing 🥊</option>
                <option value="basketball">Basketball 🏀</option>
                <option value="football">Football 🏈</option>
                <option value="hockey">Hockey 🏒</option>
                <option value="baseball">Baseball ⚾</option>
              </select>
            </div>

            {/* Advanced Settings Toggle */}
            <div className="pt-1 select-none">
              <button
                type="button"
                onClick={() => setShowConfig(!showConfig)}
                className="text-label-secondary hover:text-label text-caption flex items-center gap-1.5 transition select-none active:scale-[0.98]"
              >
                <Settings className="h-3.5 w-3.5" />
                {showConfig ? "Hide Advanced Settings" : "Configure AI Settings"}
              </button>
            </div>

            {/* Config Fields */}
            {showConfig && (
              <div className="border-separator rounded-row space-y-3.5 border p-4">
                <div className="border-separator flex items-center gap-2 border-b pb-2.5 select-none">
                  <input
                    type="checkbox"
                    id="applyGlobally"
                    checked={applyGlobally}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setApplyGlobally(v);
                      saveConfig("applyGlobally", v);
                    }}
                    className="border-separator bg-background text-tint accent-tint rounded-control-sm h-3.5 w-3.5 cursor-pointer"
                  />
                  <label htmlFor="applyGlobally" className="text-label text-subhead cursor-pointer">
                    Apply settings globally (Write to DB)
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-label-secondary text-subhead block">Provider</label>
                    <select
                      value={provider}
                      onChange={(e) => {
                        setProvider(e.target.value);
                        saveConfig("provider", e.target.value);
                      }}
                      className={cn(
                        fieldStyles,
                        "rounded-control-sm text-footnote h-(--control-height-sm) w-full cursor-pointer px-2.5"
                      )}
                    >
                      <option value="nvidia">Nvidia</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="openai">OpenAI</option>
                      <option value="custom">Custom (OpenAI-like)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-label-secondary text-subhead block">
                      Temp ({temperature})
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={temperature}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setTemperature(v);
                        saveConfig("temperature", v);
                      }}
                      className="accent-yellow h-8 w-full cursor-pointer"
                    />
                  </div>
                </div>

                <label className="rounded-control border-separator bg-surface flex cursor-pointer items-center justify-between gap-3 border p-2">
                  <span>
                    <span className="text-label-secondary text-eyebrow block">Reasoning Mode</span>
                    <span className="text-label-secondary text-footnote block">
                      Higher quality, much slower. Off = fast commentary.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={reasoning}
                    onChange={(e) => {
                      setReasoning(e.target.checked);
                      saveConfig("reasoning", e.target.checked);
                    }}
                    className="accent-yellow h-4 w-4 cursor-pointer"
                  />
                </label>

                <div className="space-y-1.5">
                  <label className="text-label-secondary text-subhead block">API Key</label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      saveConfig("apiKey", e.target.value);
                    }}
                    placeholder="Read from env if empty"
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-label-secondary text-subhead block">Model Name</label>
                  <Input
                    type="text"
                    value={modelName}
                    onChange={(e) => {
                      setModelName(e.target.value);
                      saveConfig("modelName", e.target.value);
                    }}
                    placeholder={placeholders.modelName}
                    className="w-full font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-label-secondary text-subhead block">Base API URL</label>
                  <Input
                    type="text"
                    value={apiUrl}
                    onChange={(e) => {
                      setApiUrl(e.target.value);
                      saveConfig("apiUrl", e.target.value);
                    }}
                    placeholder={placeholders.apiUrl}
                    className="w-full font-mono"
                  />
                </div>

                <div className="border-separator flex items-center justify-between gap-2 border-t pt-2">
                  <span className="text-label-secondary text-footnote">
                    {applyGlobally ? "Settings will be written globally." : "Local storage only."}
                  </span>
                  <div className="flex gap-1.5">
                    <Button type="button" variant="destructive" onClick={handleResetConfig}>
                      Reset Defaults
                    </Button>
                    <Button
                      type="button"
                      variant="filled"
                      onClick={() => {
                        saveGlobalSettingsMutation.mutate(
                          {
                            provider,
                            apiKey: apiKey || undefined,
                            apiUrl: apiUrl || undefined,
                            modelName: modelName || undefined,
                            temperature,
                            reasoning,
                            applyGlobally,
                          },
                          {
                            onSuccess: () => {
                              notify.success(
                                "Settings Saved",
                                "Global AI settings have been committed successfully."
                              );
                            },
                            onError: (e) => {
                              notify.error(
                                "Failed to Save",
                                e.message || "Could not write to global settings."
                              );
                            },
                          }
                        );
                      }}
                      disabled={saveGlobalSettingsMutation.isPending}
                    >
                      {saveGlobalSettingsMutation.isPending ? "Saving..." : "Save Config"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-label-secondary text-subhead">Play-by-Play Events</label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddEvent}>
                  + Add Event
                </Button>
              </div>

              <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
                {events.map((event, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-label-secondary text-caption w-6 text-right tabular-nums">
                      {idx * 10}'
                    </span>
                    <Input
                      type="text"
                      value={event}
                      onChange={(e) => handleEventChange(idx, e.target.value)}
                      placeholder="e.g. Referee blows whistle / Goal scored..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEvent(idx)}
                      className="text-destructive w-8 p-0"
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Button
              type="button"
              onClick={handleRunTest}
              disabled={runTestMutation.isPending}
              className="mt-2 w-full gap-2"
            >
              {runTestMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating Narration...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Run Live Commentary Test
                </>
              )}
            </Button>
          </div>

          {/* Results Card (Right) */}
          <div className="space-y-4 md:col-span-6">
            <div className="flex items-center justify-between select-none">
              <label className="text-label-secondary text-subhead">
                Generated Broadcast Output
              </label>
              {latency != null && (
                <Badge variant="teal">Latency: {latency.toLocaleString()}ms</Badge>
              )}
            </div>

            <div className="rounded-card border-separator bg-fill-3 relative max-h-[460px] min-h-[360px] overflow-y-auto border p-4">
              {runTestMutation.isPending ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 p-6 text-center">
                  <Sparkles className="text-yellow h-8 w-8 animate-spin" />
                  <div>
                    <p className="text-caption text-label">Transmitting mock telemetry to LLM...</p>
                    <p className="text-footnote text-label mt-1 max-w-[280px]">
                      Generating immersive, custom-style commentary via the Nvidia Nemotron engine.
                    </p>
                  </div>
                </div>
              ) : outputs.length === 0 ? (
                <div className="text-footnote text-label absolute inset-0 flex flex-col items-center justify-center p-6 text-center italic">
                  <Sparkles className="text-yellow mb-2 h-7 w-7 opacity-55" />
                  Set up event inputs on the left and click run to stream generated play-by-play
                  commentary.
                </div>
              ) : (
                <div className="space-y-4">
                  {outputs.map((out, idx) => (
                    <div
                      key={idx}
                      className="border-separator text-footnote border-b pb-3 leading-relaxed last:border-b-0 last:pb-0"
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <Badge variant="yellow" className="tabular-nums">
                          {idx * 10}' Event
                        </Badge>
                        <span className="text-footnote text-label max-w-[200px] truncate italic">
                          "{events[idx]}"
                        </span>
                      </div>
                      <p className="rounded-r-row border-yellow bg-fill-4 text-label border-l p-2 pl-1 font-medium">
                        {out}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function getSportIcon(sportPreset: string): string {
  const presets = getAllPresets();
  const preset = presets.find((p) => p.key === sportPreset);
  return preset?.icon ?? "🏆";
}

const NOTIFY_TOGGLES = [
  {
    key: "matchdayBulletins" as const,
    label: "Matchday bulletins",
    hint: "Per-matchday result cards posted to the SportsNews feed.",
  },
  {
    key: "llmNarration" as const,
    label: "AI narration",
    hint: "AI-written summary paragraph appended to matchday bulletins.",
  },
  {
    key: "seasonBulletins" as const,
    label: "Season / promo posts",
    hint: "Champion crowned, promotion/relegation swaps, World Cup final posts.",
  },
  {
    key: "clubDms" as const,
    label: "Club match DMs",
    hint: "Per-owner bell notification + DM after their team's result.",
  },
  {
    key: "discordMirror" as const,
    label: "Discord mirror",
    hint: "Echo sports bulletins to the Discord feed channel.",
  },
];

function NotificationSettingsCard() {
  const notify = useNotify();
  const utils = api.useUtils();
  const { data, isLoading } = api.sports.getNotificationSettings.useQuery();
  const save = api.sports.saveNotificationSettings.useMutation({
    onSuccess: () => {
      void utils.sports.getNotificationSettings.invalidate();
      notify.success("Saved", "Notification settings updated.");
    },
    onError: (e) => notify.error("Save failed", e.message),
  });

  const toggle = (key: (typeof NOTIFY_TOGGLES)[number]["key"], value: boolean) => {
    if (!data) return;
    save.mutate({ ...data, [key]: value });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-body">Auto-Notifications</CardTitle>
        <p className="text-label-secondary text-footnote">
          Master on/off switches for every automatic sports post and alert. Applies to all leagues.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {NOTIFY_TOGGLES.map((t) => (
          <div
            key={t.key}
            className="bg-surface-secondary border-separator rounded-control flex items-start justify-between gap-3 border p-3"
          >
            <div>
              <div className="text-label text-body font-medium">{t.label}</div>
              <p className="text-label-secondary text-footnote mt-0.5 leading-snug">{t.hint}</p>
            </div>
            <Switch
              checked={data?.[t.key] ?? true}
              disabled={isLoading || save.isPending}
              onCheckedChange={(v) => toggle(t.key, v)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function SportsOversightPanel() {
  const router = useRouter();
  const notify = useNotify();

  const [activeTab, setActiveTab] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [managedLeagueId, setManagedLeagueId] = useState<string | null>(null);

  // Queries
  const {
    data: leagues,
    isLoading,
    isError,
    refetch,
  } = api.sports.getLeagues.useQuery({}, { refetchOnWindowFocus: false });

  const { data: globalStats, refetch: refetchStats } = api.sports.getAdminGlobalStats.useQuery();

  const { data: featuredId, refetch: refetchFeatured } = api.sports.getFeaturedLeagueId.useQuery();

  // Mutations
  const deleteMutation = api.sports.deleteLeague.useMutation({
    onSuccess: () => {
      notify.success("League Deleted", `${deleteTarget?.name ?? "League"} has been removed.`);
      setDeleteTarget(null);
      setManagedLeagueId(null);
      void refetch();
      void refetchStats();
    },
    onError: (error) => {
      notify.error("Delete Failed", error.message ?? "Could not delete league.");
    },
  });

  const updateLeagueMutation = api.sports.updateLeague.useMutation({
    onSuccess: () => {
      notify.success("League Updated", "Canonical status has been toggled.");
      void refetch();
    },
    onError: (error) => {
      notify.error("Update Failed", error.message ?? "Could not update league.");
    },
  });

  // Derived data
  const canonicalLeagues = useMemo(() => leagues?.filter((l) => l.isCanonical) ?? [], [leagues]);
  const managedLeague = useMemo(
    () => leagues?.find((l) => l.id === managedLeagueId),
    [leagues, managedLeagueId]
  );

  const handleDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate({ id: deleteTarget.id });
    }
  };

  const handleToggleCanonical = (id: string, currentVal: boolean) => {
    updateLeagueMutation.mutate({ id, isCanonical: !currentVal });
  };

  const setFeaturedMutation = api.sports.setFeaturedLeague.useMutation({
    onSuccess: () => {
      notify.success("Featured Updated", "The MyLeague lobby hero has been updated.");
      void refetchFeatured();
    },
    onError: (error) => {
      notify.error("Update Failed", error.message ?? "Could not set featured league.");
    },
  });

  const handleToggleFeatured = (id: string) => {
    setFeaturedMutation.mutate({ leagueId: featuredId === id ? null : id });
  };

  const handleView = (id: string) => {
    router.push(withBasePath(`/myleague/${id}`));
  };

  const renderTable = (leagueList: typeof leagues, _showManageButton: boolean) => {
    if (isLoading) {
      return (
        <div className="space-y-3 py-6">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="rounded-control h-10 w-full" />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <AlertTriangle className="text-red h-10 w-10" />
          <p className="text-label-secondary text-body">Failed to load leagues.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      );
    }

    if (!leagueList || leagueList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Trophy className="text-label-tertiary h-10 w-10" />
          <p className="text-label-secondary text-body">No leagues found.</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>League</TableHead>
            <TableHead>Sport</TableHead>
            <TableHead>Archetype</TableHead>
            <TableHead className="text-right">Teams</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Canonical</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leagueList.map((league) => {
            const status = statusMeta[league.status] ?? {
              label: league.status,
              className: "bg-fill-3 text-label-secondary border-separator",
            };
            const archetype = archetypeMeta[league.archetype] ?? {
              label: league.archetype,
              className: "bg-fill-3 text-label-secondary border-separator",
            };
            const icon = getSportIcon(league.sportPreset);

            return (
              <TableRow key={league.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>{icon}</span>
                    <span className="max-w-[180px] truncate">{league.name}</span>
                    {league.id === featuredId && (
                      <Star
                        className="fill-yellow text-yellow h-3.5 w-3.5 shrink-0"
                        aria-label="Featured on lobby"
                      />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-label-secondary capitalize">
                  {league.sportPreset}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("text-footnote", archetype.className)}>
                    {archetype.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{league.teamCount}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("text-footnote", status.className)}>
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {league.isCanonical ? (
                    <Badge variant="purple">
                      <Shield className="mr-1 h-3 w-3" />
                      Canonical
                    </Badge>
                  ) : (
                    <span className="text-label-secondary text-footnote">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleView(league.id)}
                      title="View Main League Page"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setManagedLeagueId(league.id)}
                    >
                      Manage
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setDeleteTarget({ id: league.id, name: league.name })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6">
      <NotificationSettingsCard />

      {/* Overview stats cards */}
      <div className="border-separator bg-surface rounded-row border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="border-separator bg-fill-4 rounded-row text-purple flex h-12 w-12 items-center justify-center border">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-label text-title-1">Sports Admin Oversight</h1>
              <p className="text-label-secondary text-body">
                System oversight, canonical league creation and simulated state auditing
              </p>
            </div>
          </div>
          <Button onClick={() => setCreatorOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Canonical
          </Button>
        </div>

        {/* Global stats row */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="bg-surface-secondary border-separator rounded-control border p-3">
            <span className="text-label-secondary text-eyebrow">Total Leagues</span>
            <div className="text-label text-title-2 mt-0.5 tabular-nums">
              {globalStats?.totalLeagues ?? 0}
            </div>
          </div>
          <div className="bg-surface-secondary border-separator rounded-control border p-3">
            <span className="text-label-secondary text-eyebrow">Simulated Matches</span>
            <div className="text-title-2 text-purple mt-0.5 tabular-nums">
              {globalStats?.totalMatches ?? 0}
            </div>
          </div>
          <div className="bg-surface-secondary border-separator rounded-control border p-3">
            <span className="text-label-secondary text-eyebrow">Total Players</span>
            <div className="text-title-2 text-green mt-0.5 tabular-nums">
              {globalStats?.totalPlayers ?? 0}
            </div>
          </div>
          <div className="bg-surface-secondary border-separator rounded-control border p-3">
            <span className="text-label-secondary text-eyebrow">LLM News Auto-Posts</span>
            <div className="text-title-2 text-yellow mt-0.5 tabular-nums">
              {globalStats?.llmPosts ?? 0}
            </div>
          </div>
        </div>
      </div>

      {managedLeagueId && managedLeague ? (
        /* Expanded Drill-down League Manage Panel */
        <Card className="relative p-6">
          <Button
            variant="ghost"
            onClick={() => setManagedLeagueId(null)}
            className="absolute top-4 right-4"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to List
          </Button>

          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {getSportIcon(managedLeague.sportPreset)} {managedLeague.sportPreset}
                </Badge>
                {managedLeague.isCanonical ? (
                  <Badge variant="purple">Canonical League</Badge>
                ) : (
                  <Badge variant="secondary">User Created</Badge>
                )}
              </div>
              <h2 className="text-label text-title-1 mt-2">{managedLeague.name}</h2>
              <p className="text-label-secondary text-footnote mt-1">ID: {managedLeague.id}</p>

              <div className="mt-3">
                <Button
                  variant={managedLeague.id === featuredId ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleToggleFeatured(managedLeague.id)}
                  disabled={setFeaturedMutation.isPending}
                  className={cn(
                    "text-caption gap-1.5",
                    managedLeague.id === featuredId && "bg-yellow text-label hover:bg-yellow"
                  )}
                >
                  <Star
                    className={cn(
                      "h-3.5 w-3.5",
                      managedLeague.id === featuredId && "fill-label-secondary"
                    )}
                  />
                  {managedLeague.id === featuredId
                    ? "Featured on Lobby — Unset"
                    : "Set as Featured League"}
                </Button>
                <p className="text-label-secondary text-footnote mt-1.5">
                  The featured league is shown as the hero on the MyLeague lobby. Only one at a
                  time.
                </p>
              </div>
            </div>

            <Tabs defaultValue="actions" className="w-full">
              <TabsList className="grid w-full grid-cols-3 md:w-96">
                <TabsTrigger value="actions">Advanced Admin</TabsTrigger>
                <TabsTrigger value="info">Info Preview</TabsTrigger>
                <TabsTrigger value="danger">Danger Zone</TabsTrigger>
              </TabsList>

              <TabsContent value="actions" className="mt-6 space-y-4">
                <AdminAdvancedControls league={managedLeague} onRefetch={refetch} />
              </TabsContent>

              <TabsContent value="info" className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-fill-4 border-separator rounded-row border p-4">
                    <span className="text-label-secondary text-eyebrow block">Archetype</span>
                    <span className="text-label text-headline capitalize">
                      {managedLeague.archetype}
                    </span>
                  </div>
                  <div className="bg-fill-4 border-separator rounded-row border p-4">
                    <span className="text-label-secondary text-eyebrow block">Teams Count</span>
                    <span className="text-label text-headline">
                      {managedLeague.teamCount} Teams
                    </span>
                  </div>
                  <div className="bg-fill-4 border-separator rounded-row border p-4">
                    <span className="text-label-secondary text-eyebrow block">promotion Zone</span>
                    <span className="text-label text-headline">
                      {managedLeague.promotionCount} Teams
                    </span>
                  </div>
                  <div className="bg-fill-4 border-separator rounded-row border p-4">
                    <span className="text-label-secondary text-eyebrow block">relegation Zone</span>
                    <span className="text-label text-headline">
                      {managedLeague.relegationCount} Teams
                    </span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="danger" className="mt-6 space-y-4">
                <div className="rounded-card border-red/20 bg-red/10 border p-4">
                  <h3 className="text-headline text-red">Destructive Actions</h3>
                  <p className="text-label-secondary text-footnote mt-1">
                    These operations are irreversibly destructive and will wipe out season matches,
                    standings or the league completely.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      onClick={() =>
                        handleToggleCanonical(managedLeague.id, managedLeague.isCanonical)
                      }
                    >
                      {managedLeague.isCanonical
                        ? "Remove Canonical Status"
                        : "Make League Canonical"}
                    </Button>

                    <Button
                      variant="destructive"
                      onClick={() =>
                        setDeleteTarget({ id: managedLeague.id, name: managedLeague.name })
                      }
                    >
                      Force-Delete League Completely
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </Card>
      ) : (
        /* Standard Tabs List View */
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 w-full justify-start">
            <TabsTrigger value="all">All Leagues</TabsTrigger>
            <TabsTrigger value="canonical">Canonical Leagues</TabsTrigger>
            <TabsTrigger value="create">Create Canonical</TabsTrigger>
            <TabsTrigger value="narrator" className="text-yellow gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              AI Narrator Lab
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-body">All Leagues</CardTitle>
              </CardHeader>
              <CardContent>{renderTable(leagues, true)}</CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="canonical">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-body">Canonical Leagues</CardTitle>
              </CardHeader>
              <CardContent>{renderTable(canonicalLeagues, true)}</CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-body">Create Canonical League</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                  <div className="bg-tint-fill flex h-16 w-16 items-center justify-center rounded-full">
                    <Shield className="text-tint h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-label text-headline">Standard League Builder</h3>
                    <p className="text-label-secondary text-footnote mt-1 max-w-[280px]">
                      Construct a custom canonical league structure bound to the global system
                      presets.
                    </p>
                  </div>
                  <Button onClick={() => setCreatorOpen(true)}>Open Creator Dialog</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="narrator">
            <AINarratorLab />
          </TabsContent>
        </Tabs>
      )}

      {/* Creator dialog */}
      <LeagueCreator
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
        onCreated={() => {
          setCreatorOpen(false);
          void refetch();
          void refetchStats();
        }}
        isCanonical={true}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red">Irreversible Deletion</DialogTitle>
            <DialogDescription>
              Are you absolutely certain you want to delete{" "}
              <span className="text-label font-semibold">"{deleteTarget?.name}"</span>? All
              associated matches, teams, rosters, historical standings, and records will be deleted
              forever.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="gap-2"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
