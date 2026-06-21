"use client";

import React, { useState, useEffect, useMemo } from "react";
import { api } from "~/trpc/react";
import { AdminHeader } from "./AdminHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Sparkles,
  Settings,
  Database,
  Trash2,
  Play,
  Loader2,
  Check,
  ScrollText,
  SlidersHorizontal,
  FileCode2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { useNotify } from "~/hooks/useNotify";
import { DEFAULT_FLAVOR_SYSTEM_PROMPT } from "~/lib/narrator/flavorization";

export function NarratorAdminPanel() {
  const notify = useNotify();

  // Tab 1: Configuration state
  const [enabled, setEnabled] = useState(true);
  const [provider, setProvider] = useState("nvidia");
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [modelName, setModelName] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Tab 2: Playground state
  const [sandboxMode, setSandboxMode] = useState(true);
  const [selectedCountryId, setSelectedCountryId] = useState("");
  const [selectedEventType, setSelectedEventType] = useState<"issue" | "policy" | "decision">("issue");
  const [selectedEventId, setSelectedEventId] = useState("");
  
  // Unified playground text inputs
  const [playgroundTitle, setPlaygroundTitle] = useState("Tensions at the Border");
  const [playgroundDescription, setPlaygroundDescription] = useState(
    "A neighboring realm has mobilized security detachments along the border. Citizens are demanding a response."
  );
  const [sandboxMetricsJson, setSandboxMetricsJson] = useState(
    JSON.stringify(
      {
        name: "Almadaria",
        leader: "Emperor Castos",
        governmentType: "Absolute Monarchy",
        approval: 65,
        stability: 80,
      },
      null,
      2
    )
  );
  const [customSystemPrompt, setCustomSystemPrompt] = useState("");
  const [playgroundOutput, setPlaygroundOutput] = useState("");
  const [playgroundLatency, setPlaygroundLatency] = useState<number | null>(null);

  // Backend queries & mutations
  const { data: settingsData, isLoading: settingsLoading, refetch: refetchSettings } =
    api.narrator.getNarratorSettings.useQuery();

  const saveSettingsMutation = api.narrator.saveNarratorSettings.useMutation({
    onSuccess: () => {
      notify.success("Configuration Saved", "Global AI Narrator settings have been updated.");
      setIsSaving(false);
      void refetchSettings();
    },
    onError: (e) => {
      notify.error("Save Failed", e.message || "Failed to save configuration settings.");
      setIsSaving(false);
    },
  });

  const { data: countries } = api.countries.getSelectList.useQuery({ limit: 100 });

  // Get active issues/policies/decisions for selected country in playground
  const { data: playgroundEvents, isLoading: eventsLoading } =
    api.narrator.getPlaygroundEvents.useQuery(
      { countryId: selectedCountryId, type: selectedEventType },
      { enabled: !sandboxMode && !!selectedCountryId }
    );

  const testFlavorizeMutation = api.narrator.testFlavorize.useMutation();

  // Tab 3: Cache queries & mutations
  const { data: cacheStats, refetch: refetchCacheStats } = api.narrator.getCacheStats.useQuery();
  const clearCacheMutation = api.narrator.clearCache.useMutation({
    onSuccess: (data) => {
      notify.success("Cache Cleared", `Cleaned up ${data.count} cached narration cards.`);
      void refetchCacheStats();
    },
    onError: (e) => {
      notify.error("Cleanup Failed", e.message || "Failed to wipe cached flavor cards.");
    },
  });

  // Sync settings values on load
  useEffect(() => {
    if (settingsData) {
      setEnabled(settingsData.enabled);
      setProvider(settingsData.provider || "nvidia");
      setApiKey(settingsData.apiKey || "");
      setApiUrl(settingsData.apiUrl || "");
      setModelName(settingsData.modelName || "");
      setTemperature(settingsData.temperature ?? 0.7);
      setSystemPrompt(settingsData.systemPrompt || "");
    }
  }, [settingsData]);

  // Sync selected event data to unified text inputs
  useEffect(() => {
    if (!sandboxMode && selectedEventId && playgroundEvents) {
      const match = playgroundEvents.find((x) => x.id === selectedEventId);
      if (match) {
        setPlaygroundTitle(match.title);
        setPlaygroundDescription(match.description);
      }
    }
  }, [selectedEventId, playgroundEvents, sandboxMode]);

  const handleSaveSettings = () => {
    setIsSaving(true);
    saveSettingsMutation.mutate({
      enabled,
      provider: provider || undefined,
      apiKey: apiKey || undefined,
      apiUrl: apiUrl || undefined,
      modelName: modelName || undefined,
      temperature,
      systemPrompt: systemPrompt || undefined,
    });
  };

  const handleTestFlavorize = () => {
    if (!playgroundTitle.trim()) {
      notify.error("Validation Error", "Please provide an event title.");
      return;
    }
    if (!playgroundDescription.trim()) {
      notify.error("Validation Error", "Please provide event details/description.");
      return;
    }

    const tStart = Date.now();
    setPlaygroundOutput("");
    setPlaygroundLatency(null);

    testFlavorizeMutation.mutate(
      {
        type: selectedEventType,
        title: playgroundTitle,
        description: playgroundDescription,
        countryId: sandboxMode ? undefined : selectedCountryId || undefined,
        customSystemPrompt: customSystemPrompt || undefined,
        sandboxMode,
        sandboxMetricsJson: sandboxMode ? sandboxMetricsJson : undefined,
      },
      {
        onSuccess: (res) => {
          setPlaygroundLatency(Date.now() - tStart);
          setPlaygroundOutput(res.flavorText || "No narration returned.");
          notify.success("Generation Complete", "Paradox-style flavor text generated.");
        },
        onError: (e) => {
          notify.error("Generation Failed", e.message || "Failed to generate flavor card text.");
        },
      }
    );
  };

  const handleClearCache = () => {
    if (window.confirm("Are you sure you want to clear all cached narrator flavor texts?")) {
      clearCacheMutation.mutate();
    }
  };

  const getProviderPlaceholders = () => {
    if (provider === "nvidia") {
      return {
        apiUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
        modelName: "deepseek-ai/deepseek-v4-flash",
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

  const placeholders = getProviderPlaceholders();

  if (settingsLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="space-y-2 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-500" />
          <p className="text-muted-foreground text-xs font-semibold">Loading Narrator Settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Sparkles}
        title="AI Narrator & Flavorization Console"
        description="Configure LLM endpoints, manage global system prompts, test Paradox-style card narration with custom metrics, and monitor cache state."
      />

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md bg-slate-950/60 p-1 rounded-xl border border-white/5">
          <TabsTrigger value="config" className="gap-2 text-xs font-bold py-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950">
            <Settings className="h-4 w-4" />
            Config & Prompt
          </TabsTrigger>
          <TabsTrigger value="playground" className="gap-2 text-xs font-bold py-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950">
            <Play className="h-4 w-4" />
            Playground
          </TabsTrigger>
          <TabsTrigger value="cache" className="gap-2 text-xs font-bold py-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950">
            <Database className="h-4 w-4" />
            Cache Lab
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: API Configuration & Prompt Settings */}
        <TabsContent value="config" className="mt-6 space-y-6">
          <Card className="glass-surface border-border/40 bg-slate-950/20 backdrop-blur-md relative overflow-hidden">
            <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-amber-500/5 blur-3xl" />
            
            <CardHeader>
              <CardTitle className="text-base font-extrabold flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-amber-500" />
                Global AI Narrator Configuration
              </CardTitle>
              <CardDescription className="text-xs">
                Manage LLM provider credentials, connection params, and global status. If credentials are empty, the narrator falls back to Myleague settings automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable / Disable toggle */}
              <div className="bg-card/25 border border-white/5 flex items-center justify-between rounded-xl p-4">
                <div>
                  <Label className="text-sm font-bold text-white">Enable Paradox-style Flavor Cards</Label>
                  <p className="text-muted-foreground text-xs">
                    Enable or disable AI flavorization cards globally on national issues, policies, and meeting decisions.
                  </p>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={setEnabled}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>

              {/* Grid configs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-muted-foreground text-xs font-bold uppercase">LLM Provider</label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="text-foreground w-full rounded-xl border border-white/10 bg-slate-950 p-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="nvidia">Nvidia API</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="openai">OpenAI</option>
                    <option value="custom">Custom Endpoint (OpenAI-compatible)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-muted-foreground text-xs font-bold uppercase flex justify-between">
                    <span>Temperature</span>
                    <span className="font-mono text-amber-400">{temperature}</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="h-9 w-full cursor-pointer accent-amber-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-muted-foreground text-xs font-bold uppercase">API Endpoint URL</label>
                  <Input
                    type="text"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder={placeholders.apiUrl}
                    className="bg-slate-950/60 border-white/10 text-xs font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-muted-foreground text-xs font-bold uppercase">Model Name</label>
                  <Input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder={placeholders.modelName}
                    className="bg-slate-950/60 border-white/10 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-muted-foreground text-xs font-bold uppercase">API Key / Token</label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={settingsData?.apiKey ? "••••••••••••••••" : "Fallback to SPORTS_LLM_API_KEY if empty"}
                  className="bg-slate-950/60 border-white/10 text-xs"
                />
              </div>

              {/* Global System Prompt Editor */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground text-xs font-bold uppercase">Global System Prompt</label>
                  <button
                    onClick={() => {
                      if (window.confirm("Revert system prompt to default Paradox designer configuration?")) {
                        setSystemPrompt(DEFAULT_FLAVOR_SYSTEM_PROMPT);
                      }
                    }}
                    className="text-amber-500 hover:text-amber-400 text-[10px] font-bold tracking-wider uppercase focus:outline-none"
                  >
                    Reset to Default
                  </button>
                </div>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder={DEFAULT_FLAVOR_SYSTEM_PROMPT}
                  rows={5}
                  className="text-foreground w-full rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs leading-relaxed font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <p className="text-muted-foreground text-[10px]">
                  This prompt instructs the LLM how to shape simulations/events into short cards. Adapt this to modify global game tone.
                </p>
              </div>

              {/* Action buttons */}
              <div className="border-t border-white/5 pt-4 flex justify-end">
                <Button
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="bg-amber-500 hover:bg-amber-400 font-extrabold text-slate-950 text-xs gap-2 rounded-xl py-2 px-5"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4.5 w-4.5" />
                      Save Configuration
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Live Testing Playground */}
        <TabsContent value="playground" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* Input Config Panel (Left) */}
            <div className="xl:col-span-7 space-y-4">
              <Card className="glass-surface border-border/40 bg-slate-950/20 backdrop-blur-md">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-extrabold flex items-center gap-2">
                    <FileCode2 className="h-4.5 w-4.5 text-amber-500" />
                    Event Simulation Telemetry
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Mode switcher: Sandbox vs Real Data */}
                  <div className="bg-card/25 border border-white/5 flex items-center justify-between rounded-xl p-3.5 mb-2">
                    <div>
                      <Label className="text-xs font-bold text-white uppercase">Sandbox Mode</Label>
                      <p className="text-muted-foreground text-[10px]">
                        Inject custom JSON metrics instead of database lookups.
                      </p>
                    </div>
                    <Switch
                      checked={sandboxMode}
                      onCheckedChange={(v) => {
                        setSandboxMode(v);
                        if (!v && countries && countries.length > 0 && !selectedCountryId) {
                          setSelectedCountryId(countries[0]?.id || "");
                        }
                      }}
                      className="data-[state=checked]:bg-amber-500"
                    />
                  </div>

                  {/* Real Database select controls */}
                  {!sandboxMode && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-white/5 bg-white/5">
                      <div className="space-y-1.5">
                        <label className="text-muted-foreground text-[10px] font-bold uppercase">1. Country</label>
                        <select
                          value={selectedCountryId}
                          onChange={(e) => {
                            setSelectedCountryId(e.target.value);
                            setSelectedEventId("");
                          }}
                          className="text-foreground w-full rounded-lg border border-white/10 bg-slate-950 p-2 text-xs focus:outline-none"
                        >
                          <option value="">-- Select Country --</option>
                          {countries?.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-muted-foreground text-[10px] font-bold uppercase">2. Type</label>
                        <select
                          value={selectedEventType}
                          onChange={(e) => {
                            setSelectedEventType(e.target.value as any);
                            setSelectedEventId("");
                          }}
                          className="text-foreground w-full rounded-lg border border-white/10 bg-slate-950 p-2 text-xs focus:outline-none"
                        >
                          <option value="issue">Issue</option>
                          <option value="policy">Policy</option>
                          <option value="decision">Decision</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-muted-foreground text-[10px] font-bold uppercase">
                          3. Select Database Event
                        </label>
                        <select
                          value={selectedEventId}
                          onChange={(e) => setSelectedEventId(e.target.value)}
                          disabled={eventsLoading || !selectedCountryId}
                          className="text-foreground w-full rounded-lg border border-white/10 bg-slate-950 p-2 text-xs focus:outline-none disabled:opacity-50"
                        >
                          <option value="">
                            {eventsLoading ? "Loading..." : "-- Choose Event --"}
                          </option>
                          {playgroundEvents?.map((ev) => (
                            <option key={ev.id} value={ev.id}>
                              {ev.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Standard Text Inputs for Title & Description */}
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-muted-foreground uppercase">Event Title</Label>
                      <Input
                        value={playgroundTitle}
                        onChange={(e) => setPlaygroundTitle(e.target.value)}
                        placeholder="e.g. Grain Tariff Act"
                        className="bg-slate-950/60 border-white/10 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-muted-foreground uppercase">Event details</Label>
                      <textarea
                        value={playgroundDescription}
                        onChange={(e) => setPlaygroundDescription(e.target.value)}
                        placeholder="Describe the context, severity, and options..."
                        rows={3}
                        className="text-foreground w-full rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {/* Sandbox Metrics JSON Textarea */}
                  {sandboxMode && (
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-muted-foreground uppercase">Sandbox Country Snapshot (JSON)</Label>
                      <textarea
                        value={sandboxMetricsJson}
                        onChange={(e) => setSandboxMetricsJson(e.target.value)}
                        rows={6}
                        className="text-foreground w-full rounded-xl border border-white/10 bg-slate-950/60 p-3 font-mono text-[11px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  )}

                  {/* Custom Prompt Override */}
                  <div className="space-y-1.5 border-t border-white/5 pt-3">
                    <label className="text-muted-foreground text-xs font-bold uppercase">Prompt Override (Playground only)</label>
                    <textarea
                      value={customSystemPrompt}
                      onChange={(e) => setCustomSystemPrompt(e.target.value)}
                      placeholder="Override global system prompt rules temporarily to test modifications..."
                      rows={3}
                      className="text-foreground w-full rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs leading-relaxed font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <Button
                    onClick={handleTestFlavorize}
                    disabled={testFlavorizeMutation.isPending}
                    className="w-full bg-amber-500 hover:bg-amber-400 font-extrabold text-slate-950 text-xs gap-2 rounded-xl py-2.5 mt-2"
                  >
                    {testFlavorizeMutation.isPending ? (
                      <>
                        <Loader2 className="h-4.5 w-4.5 animate-spin" />
                        Consulting LLM Chronicle...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4.5 w-4.5" />
                        Draft Flavor Card
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Preview Card Panel (Right) */}
            <div className="xl:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-muted-foreground text-xs font-bold uppercase">Chronicle Card Mockup Preview</label>
                {playgroundLatency !== null && (
                  <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[9px] font-bold text-cyan-400">
                    Latency: {playgroundLatency}ms
                  </span>
                )}
              </div>

              {testFlavorizeMutation.isPending ? (
                <div className="relative overflow-hidden rounded-xl border border-amber-500/15 bg-amber-500/5 p-5 animate-pulse min-h-[160px] flex flex-col justify-center">
                  <div className="absolute top-0 left-0 h-full w-[3px] bg-amber-500/35" />
                  <div className="flex items-center gap-1.5 text-xs text-amber-500/60 font-bold uppercase tracking-wider mb-2">
                    <ScrollText className="h-4 w-4" />
                    <span>The Chronicle</span>
                  </div>
                  <span className="font-serif italic text-sm text-slate-500 leading-relaxed block">
                    Drafting Chronicle...
                  </span>
                </div>
              ) : playgroundOutput ? (
                <div className="relative overflow-hidden rounded-xl border border-amber-500/25 bg-amber-500/5 p-5 shadow-[0_0_20px_rgba(245,158,11,0.06)] min-h-[160px]">
                  <div className="absolute top-0 left-0 h-full w-[3px] bg-amber-500/70" />
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs text-amber-500/80 font-bold uppercase tracking-wider">
                      <ScrollText className="h-4 w-4 animate-pulse" />
                      <span>The Chronicle</span>
                    </div>
                    <span className="text-[10px] text-white/30 italic uppercase font-mono">
                      {selectedEventType}
                    </span>
                  </div>
                  <span className="font-serif italic text-sm text-slate-200 leading-relaxed block">
                    {playgroundOutput}
                  </span>
                </div>
              ) : (
                <div className="rounded-xl border border-white/5 bg-slate-950/40 p-8 text-center text-xs text-white/30 italic flex flex-col items-center justify-center min-h-[160px] border-dashed">
                  <ScrollText className="h-8 w-8 text-white/10 mb-2" />
                  Configure the parameters on the left and run test to view the Paradox-style narrative wrapper.
                </div>
              )}

              {/* Event Context Snapshots Info */}
              <Card className="glass-surface border-border/40 bg-slate-950/10 text-xs">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-bold text-white uppercase">Immersion Snapshots</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 text-muted-foreground leading-relaxed text-[11px] space-y-2">
                  <p>
                    During live gameplay, when a user views an Issue, Policy, or Cabinet Decision, a contextual prompt containing the country's live metrics (GDP, stability, approval, government type) is passed alongside details.
                  </p>
                  <p>
                    The Narrator converts dry variables into flavor lines, adapting tone to political volatility or stability snapshots.
                  </p>
                </CardContent>
              </Card>
            </div>

          </div>
        </TabsContent>

        {/* Tab 3: Cache Management */}
        <TabsContent value="cache" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <Card className="glass-surface border-border/40">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-lg bg-amber-500/10 p-3 text-amber-500">
                  <ScrollText className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-black">
                    {cacheStats ? cacheStats.total.toLocaleString() : "..."}
                  </p>
                  <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                    Total Cached Cards
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-surface border-border/40">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-lg bg-cyan-500/10 p-3 text-cyan-500">
                  <Check className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-black">
                    {cacheStats ? cacheStats.totalHits.toLocaleString() : "..."}
                  </p>
                  <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                    Total Cache Hits
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-surface border-border/40">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-lg bg-emerald-500/10 p-3 text-emerald-500">
                  <RefreshCw className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-black">
                    {cacheStats ? `${cacheStats.averageHitCount}x` : "..."}
                  </p>
                  <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
                    Average Hits per Card
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-surface border-border/40 bg-slate-950/20 backdrop-blur-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-extrabold flex items-center gap-2">
                <Database className="h-4.5 w-4.5 text-amber-500" />
                Cache Lab Settings
              </CardTitle>
              <CardDescription className="text-xs">
                To prevent credit drainage and API rate limits, flavor text descriptions are strongly cached for 14 days inside the database. Clearing the cache forces new AI cards to regenerate on user demand.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-rose-500/5 border border-rose-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 rounded-xl p-4">
                <div>
                  <h4 className="text-sm font-bold text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    Wipe AI Narrator Cache
                  </h4>
                  <p className="text-muted-foreground text-xs mt-1 max-w-xl">
                    Deletes all cache keys starting with the flavor prefix. This will force subsequent requests to load directly from the LLM engine.
                  </p>
                </div>
                <Button
                  onClick={handleClearCache}
                  disabled={clearCacheMutation.isPending}
                  className="bg-rose-600 hover:bg-rose-500 font-extrabold text-white text-xs gap-2 rounded-xl py-2 px-5 shrink-0 self-stretch sm:self-auto"
                >
                  {clearCacheMutation.isPending ? (
                    <>
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                      Clearing Cache...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4.5 w-4.5" />
                      Clear Flavor Cache
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default NarratorAdminPanel;
