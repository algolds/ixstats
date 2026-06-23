"use client";

import { useState, useMemo, useEffect } from "react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
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
import { LeagueCreator } from "~/components/myleague/LeagueCreator";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Plus,
  Trash2,
  Eye,
  Loader2,
  AlertTriangle,
  Shield,
  ArrowLeft,
  Sparkles,
  Settings,
  Star,
} from "lucide-react";
import { useNotify } from "~/hooks/useNotify";
import { getAllPresets } from "~/lib/sports";

const statusMeta: Record<string, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  draft: { label: "Draft", className: "bg-muted/50 text-muted-foreground border-border" },
  archived: { label: "Archived", className: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  suspended: { label: "Suspended", className: "bg-red-500/10 text-red-400 border-red-500/30" },
};

const archetypeMeta: Record<string, { label: string; className: string }> = {
  league: { label: "League", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  division_conference: {
    label: "Division / Conference",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  bracket: { label: "Bracket", className: "bg-red-500/10 text-red-400 border-red-500/30" },
  circuit: { label: "Circuit", className: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
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
            className="border-red-500/20 text-xs font-bold text-red-400 hover:bg-red-500/5"
          >
            {resetSeasonMutation.isPending ? "Resetting..." : "Reset Season Data"}
          </Button>
        )}

        {activeSeason && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMatchOverrideOpen(true)}
            className="text-xs font-bold"
          >
            Override Match Score
          </Button>
        )}

        {activeSeason && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => regenerateScheduleMutation.mutate({ seasonId: activeSeasonId })}
            disabled={regenerateScheduleMutation.isPending}
            className="text-xs font-bold"
          >
            {regenerateScheduleMutation.isPending ? "Regenerating..." : "Regenerate Matches"}
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportData}
          className="text-xs font-bold"
        >
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
              <label className="text-muted-foreground block text-xs font-bold uppercase">
                Select Match
              </label>
              <select
                value={selectedMatchId}
                onChange={(e) => setSelectedMatchId(e.target.value)}
                className="text-foreground w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-xs"
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
                <label className="text-muted-foreground block text-xs font-bold uppercase">
                  Home Score
                </label>
                <input
                  type="number"
                  min="0"
                  value={homeScore}
                  onChange={(e) => setHomeScore(Number(e.target.value))}
                  className="text-foreground w-full rounded-lg border border-white/10 bg-slate-900 p-2 font-mono text-xs"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-muted-foreground block text-xs font-bold uppercase">
                  Away Score
                </label>
                <input
                  type="number"
                  min="0"
                  value={awayScore}
                  onChange={(e) => setAwayScore(Number(e.target.value))}
                  className="text-foreground w-full rounded-lg border border-white/10 bg-slate-900 p-2 font-mono text-xs"
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
    <Card className="facet-hierarchy-child border-border/50 bg-card/40 relative overflow-hidden p-6">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute -top-20 -right-20 h-44 w-44 rounded-full bg-amber-500/5 blur-3xl" />

      <div className="space-y-6">
        <div>
          <h2 className="text-foreground flex items-center gap-2 text-xl font-black">
            <Sparkles className="h-5 w-5 text-amber-400" />
            AI Narrator Test Lab
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Test and preview live generated commentary across different sports configurations.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-12">
          {/* Controls & Inputs (Left) */}
          <div className="space-y-4 md:col-span-6">
            <div className="space-y-2">
              <label className="text-muted-foreground block text-xs font-bold uppercase">
                Sport Preset
              </label>
              <select
                value={sport}
                onChange={(e) => handleLoadTemplate(e.target.value)}
                className="text-foreground w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-xs font-semibold"
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
                className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-[11px] font-bold transition select-none"
              >
                <Settings className="h-3.5 w-3.5" />
                {showConfig ? "Hide Advanced Settings" : "Configure AI Settings"}
              </button>
            </div>

            {/* Config Fields */}
            {showConfig && (
              <div className="space-y-3.5 rounded-2xl border border-white/5 bg-white/5 p-4">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2.5 select-none">
                  <input
                    type="checkbox"
                    id="applyGlobally"
                    checked={applyGlobally}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setApplyGlobally(v);
                      saveConfig("applyGlobally", v);
                    }}
                    className="h-3.5 w-3.5 cursor-pointer rounded border-white/10 bg-slate-950 text-amber-400 accent-amber-400"
                  />
                  <label
                    htmlFor="applyGlobally"
                    className="cursor-pointer text-[10px] font-bold tracking-wider text-white uppercase"
                  >
                    Apply settings globally (Write to DB)
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground block text-[10px] font-bold uppercase">
                      Provider
                    </label>
                    <select
                      value={provider}
                      onChange={(e) => {
                        setProvider(e.target.value);
                        saveConfig("provider", e.target.value);
                      }}
                      className="text-foreground w-full rounded-lg border border-white/10 bg-slate-950 p-2 text-xs font-semibold"
                    >
                      <option value="nvidia">Nvidia</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="openai">OpenAI</option>
                      <option value="custom">Custom (OpenAI-like)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-muted-foreground block text-[10px] font-bold uppercase">
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
                      className="h-8 w-full cursor-pointer accent-amber-400"
                    />
                  </div>
                </div>

                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-950 p-2">
                  <span>
                    <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                      Reasoning Mode
                    </span>
                    <span className="text-muted-foreground/70 block text-[10px]">
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
                    className="h-4 w-4 cursor-pointer accent-amber-400"
                  />
                </label>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground block text-[10px] font-bold uppercase">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      saveConfig("apiKey", e.target.value);
                    }}
                    placeholder="Read from env if empty"
                    className="text-foreground w-full rounded-lg border border-white/10 bg-slate-950 p-2 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground block text-[10px] font-bold uppercase">
                    Model Name
                  </label>
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => {
                      setModelName(e.target.value);
                      saveConfig("modelName", e.target.value);
                    }}
                    placeholder={placeholders.modelName}
                    className="text-foreground w-full rounded-lg border border-white/10 bg-slate-950 p-2 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-muted-foreground block text-[10px] font-bold uppercase">
                    Base API URL
                  </label>
                  <input
                    type="text"
                    value={apiUrl}
                    onChange={(e) => {
                      setApiUrl(e.target.value);
                      saveConfig("apiUrl", e.target.value);
                    }}
                    placeholder={placeholders.apiUrl}
                    className="text-foreground w-full rounded-lg border border-white/10 bg-slate-950 p-2 font-mono text-xs"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2">
                  <span className="text-muted-foreground text-[9px]">
                    {applyGlobally ? "Settings will be written globally." : "Local storage only."}
                  </span>
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResetConfig}
                      className="h-6 rounded-lg border-rose-500/30 bg-rose-500/5 px-2 text-[10px] font-bold text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                    >
                      Reset Defaults
                    </Button>
                    <Button
                      type="button"
                      variant="default"
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
                      className="h-6 rounded-lg bg-amber-500 px-2.5 text-[10px] font-bold text-slate-950 hover:bg-amber-600"
                    >
                      {saveGlobalSettingsMutation.isPending ? "Saving..." : "Save Config"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-muted-foreground text-xs font-bold uppercase">
                  Play-by-Play Events
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddEvent}
                  className="h-6 rounded-full border-white/10 bg-white/5 px-2.5 text-[10px] font-bold text-white"
                >
                  + Add Event
                </Button>
              </div>

              <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
                {events.map((event, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-muted-foreground w-6 text-right font-mono text-xs font-black">
                      {idx * 10}'
                    </span>
                    <input
                      type="text"
                      value={event}
                      onChange={(e) => handleEventChange(idx, e.target.value)}
                      placeholder="e.g. Referee blows whistle / Goal scored..."
                      className="text-foreground flex-1 rounded-xl border border-white/10 bg-slate-900 p-2 text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEvent(idx)}
                      className="h-8 w-8 rounded-full p-0 text-red-400 hover:text-red-300"
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
              className="mt-2 w-full gap-2 rounded-xl bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
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
              <label className="text-muted-foreground text-xs font-bold uppercase">
                Generated Broadcast Output
              </label>
              {latency != null && (
                <Badge
                  variant="outline"
                  className="border-cyan-500/30 bg-cyan-500/10 text-[9px] font-bold text-cyan-400"
                >
                  Latency: {latency.toLocaleString()}ms
                </Badge>
              )}
            </div>

            <div className="relative max-h-[460px] min-h-[360px] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/50 p-4 backdrop-blur-md">
              {runTestMutation.isPending ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 p-6 text-center">
                  <Sparkles className="h-8 w-8 animate-spin text-amber-400" />
                  <div>
                    <p className="text-xs font-bold text-white">
                      Transmitting mock telemetry to LLM...
                    </p>
                    <p className="mt-1 max-w-[280px] text-[10px] text-white/50">
                      Generating immersive, custom-style commentary via the Nvidia Nemotron engine.
                    </p>
                  </div>
                </div>
              ) : outputs.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-xs text-white/40 italic">
                  <Sparkles className="mb-2 h-7 w-7 text-amber-500/40 opacity-55" />
                  Set up event inputs on the left and click run to stream generated play-by-play
                  commentary.
                </div>
              ) : (
                <div className="space-y-4">
                  {outputs.map((out, idx) => (
                    <div
                      key={idx}
                      className="border-b border-white/5 pb-3 text-xs leading-relaxed last:border-b-0 last:pb-0"
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="rounded border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-300">
                          {idx * 10}' Event
                        </span>
                        <span className="max-w-[200px] truncate text-[9px] text-white/40 italic">
                          "{events[idx]}"
                        </span>
                      </div>
                      <p className="rounded-r-xl border-l border-amber-400 bg-white/5 p-2 pl-1 font-medium text-white/90">
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

  const { data: featuredId, refetch: refetchFeatured } =
    api.sports.getFeaturedLeagueId.useQuery();

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
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <AlertTriangle className="h-10 w-10 text-red-400" />
          <p className="text-muted-foreground text-sm">Failed to load leagues.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      );
    }

    if (!leagueList || leagueList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Trophy className="text-muted-foreground/40 h-10 w-10" />
          <p className="text-muted-foreground text-sm">No leagues found.</p>
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
              className: "bg-muted/50 text-muted-foreground border-border",
            };
            const archetype = archetypeMeta[league.archetype] ?? {
              label: league.archetype,
              className: "bg-muted/50 text-muted-foreground border-border",
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
                        className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-500"
                        aria-label="Featured on lobby"
                      />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground capitalize">
                  {league.sportPreset}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("text-[10px]", archetype.className)}>
                    {archetype.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{league.teamCount}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("text-[10px]", status.className)}>
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {league.isCanonical ? (
                    <Badge
                      variant="outline"
                      className="border-purple-500/30 bg-purple-500/10 text-[10px] text-purple-400"
                    >
                      <Shield className="mr-1 h-3 w-3" />
                      Canonical
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">—</span>
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
                      className="text-red-400 hover:text-red-300"
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
      {/* Overview stats cards */}
      <div className="facet-hierarchy-parent border-border/60 bg-card/40 rounded-xl border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="border-border/50 bg-muted/30 flex h-12 w-12 items-center justify-center rounded-xl border text-purple-400">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-foreground text-2xl font-bold">Sports Admin Oversight</h1>
              <p className="text-muted-foreground text-sm">
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
          <div className="facet-hierarchy-child border-border/50 bg-card/30 rounded-lg border p-3">
            <span className="text-muted-foreground text-[11px] font-medium uppercase">
              Total Leagues
            </span>
            <div className="text-foreground mt-0.5 text-xl font-bold tabular-nums">
              {globalStats?.totalLeagues ?? 0}
            </div>
          </div>
          <div className="facet-hierarchy-child border-border/50 bg-card/30 rounded-lg border p-3">
            <span className="text-muted-foreground text-[11px] font-medium uppercase">
              Simulated Matches
            </span>
            <div className="mt-0.5 text-xl font-bold text-purple-400 tabular-nums">
              {globalStats?.totalMatches ?? 0}
            </div>
          </div>
          <div className="facet-hierarchy-child border-border/50 bg-card/30 rounded-lg border p-3">
            <span className="text-muted-foreground text-[11px] font-medium uppercase">
              Total Players
            </span>
            <div className="mt-0.5 text-xl font-bold text-emerald-400 tabular-nums">
              {globalStats?.totalPlayers ?? 0}
            </div>
          </div>
          <div className="facet-hierarchy-child border-border/50 bg-card/30 rounded-lg border p-3">
            <span className="text-muted-foreground text-[11px] font-medium uppercase">
              LLM News Auto-Posts
            </span>
            <div className="mt-0.5 text-xl font-bold text-amber-400 tabular-nums">
              {globalStats?.llmPosts ?? 0}
            </div>
          </div>
        </div>
      </div>

      {managedLeagueId && managedLeague ? (
        /* Expanded Drill-down League Manage Panel */
        <Card className="facet-hierarchy-child border-border/50 bg-card/40 relative p-6">
          <Button
            variant="ghost"
            onClick={() => setManagedLeagueId(null)}
            className="text-muted-foreground hover:text-foreground absolute top-4 right-4 text-xs font-bold"
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
                  <Badge className="border-purple-500/20 bg-purple-500/10 text-purple-400">
                    Canonical League
                  </Badge>
                ) : (
                  <Badge variant="secondary">User Created</Badge>
                )}
              </div>
              <h2 className="text-foreground mt-2 text-2xl font-black">{managedLeague.name}</h2>
              <p className="text-muted-foreground mt-1 text-xs">ID: {managedLeague.id}</p>

              <div className="mt-3">
                <Button
                  variant={managedLeague.id === featuredId ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleToggleFeatured(managedLeague.id)}
                  disabled={setFeaturedMutation.isPending}
                  className={cn(
                    "gap-1.5 text-xs font-bold",
                    managedLeague.id === featuredId &&
                      "bg-amber-500 text-slate-950 hover:bg-amber-600"
                  )}
                >
                  <Star
                    className={cn(
                      "h-3.5 w-3.5",
                      managedLeague.id === featuredId && "fill-slate-950"
                    )}
                  />
                  {managedLeague.id === featuredId
                    ? "Featured on Lobby — Unset"
                    : "Set as Featured League"}
                </Button>
                <p className="text-muted-foreground mt-1.5 text-[11px]">
                  The featured league is shown as the hero on the MyLeague lobby. Only one at a time.
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
                  <div className="bg-muted/10 border-border/10 rounded-xl border p-4">
                    <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                      Archetype
                    </span>
                    <span className="text-foreground text-sm font-semibold capitalize">
                      {managedLeague.archetype}
                    </span>
                  </div>
                  <div className="bg-muted/10 border-border/10 rounded-xl border p-4">
                    <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                      Teams Count
                    </span>
                    <span className="text-foreground text-sm font-semibold">
                      {managedLeague.teamCount} Teams
                    </span>
                  </div>
                  <div className="bg-muted/10 border-border/10 rounded-xl border p-4">
                    <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                      promotion Zone
                    </span>
                    <span className="text-foreground text-sm font-semibold">
                      {managedLeague.promotionCount} Teams
                    </span>
                  </div>
                  <div className="bg-muted/10 border-border/10 rounded-xl border p-4">
                    <span className="text-muted-foreground block text-[10px] font-bold uppercase">
                      relegation Zone
                    </span>
                    <span className="text-foreground text-sm font-semibold">
                      {managedLeague.relegationCount} Teams
                    </span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="danger" className="mt-6 space-y-4">
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                  <h3 className="text-sm font-bold text-red-400">Destructive Actions</h3>
                  <p className="text-muted-foreground mt-1 text-xs">
                    These operations are irreversibly destructive and will wipe out season matches,
                    standings or the league completely.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      onClick={() =>
                        handleToggleCanonical(managedLeague.id, managedLeague.isCanonical)
                      }
                      className="border-amber-500/20 text-xs font-bold text-amber-400 hover:bg-amber-500/5"
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
                      className="text-xs font-bold"
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
            <TabsTrigger value="narrator" className="gap-1.5 text-amber-400">
              <Sparkles className="h-3.5 w-3.5" />
              AI Narrator Lab
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card className="facet-hierarchy-child border-border/50 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">All Leagues</CardTitle>
              </CardHeader>
              <CardContent>{renderTable(leagues, true)}</CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="canonical">
            <Card className="facet-hierarchy-child border-border/50 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Canonical Leagues</CardTitle>
              </CardHeader>
              <CardContent>{renderTable(canonicalLeagues, true)}</CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create">
            <Card className="facet-hierarchy-child border-border/50 bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Create Canonical League</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                  <div className="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-full">
                    <Shield className="text-primary h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-foreground text-sm font-semibold">
                      Standard League Builder
                    </h3>
                    <p className="text-muted-foreground mt-1 max-w-[280px] text-xs">
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
            <DialogTitle className="text-red-400">Irreversible Deletion</DialogTitle>
            <DialogDescription>
              Are you absolutely certain you want to delete{" "}
              <span className="font-bold text-white">"{deleteTarget?.name}"</span>? All associated
              matches, teams, rosters, historical standings, and records will be deleted forever.
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
