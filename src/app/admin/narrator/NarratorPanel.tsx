// src/app/admin/narrator/NarratorPanel.tsx
// AI Narrator Global Configuration & Testing Suite
"use client";

import React, { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { AdminHeader } from "../_components/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Sparks as Sparkles,
  Settings,
  Database,
  Play,
  SystemRestart as Loader2,
  Check,
  ControlSlider as SlidersHorizontal,
  FloppyDisk as Save,
} from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { DEFAULT_FLAVOR_SYSTEM_PROMPT } from "~/lib/narrator/constants";
import { NarratorPlaygroundTab } from "./_components/NarratorPlaygroundTab";
import { NarratorCacheTab } from "./_components/NarratorCacheTab";
import { usePageTitle } from "~/hooks/usePageTitle";

export function NarratorPanel() {
  usePageTitle({ title: "Admin - AI Narrator & Flavor" });
  const notify = useNotify();

  // Tab 1: Configuration state
  const [enabled, setEnabled] = useState(true);
  const [provider, setProvider] = useState("nvidia");
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [modelName, setModelName] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [reasoning, setReasoning] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");

  const {
    data: settingsData,
    isLoading: settingsLoading,
    refetch: refetchSettings,
  } = api.narrator.getNarratorSettings.useQuery();

  const saveSettingsMutation = api.narrator.saveNarratorSettings.useMutation({
    onSuccess: () => {
      notify.success("Configuration Saved", "Global AI Narrator settings updated.");
      void refetchSettings();
    },
    onError: (e: { message?: string }) => {
      notify.error("Save Failed", e.message || "Failed to save configuration settings.");
    },
  });

  useEffect(() => {
    if (settingsData) {
      setEnabled(settingsData.enabled);
      setProvider(settingsData.provider || "nvidia");
      setApiKey(settingsData.apiKey || "");
      setApiUrl(settingsData.apiUrl || "");
      setModelName(settingsData.modelName || "");
      setTemperature(settingsData.temperature ?? 0.7);
      setReasoning(settingsData.reasoning ?? false);
      setSystemPrompt(settingsData.systemPrompt || "");
    }
  }, [settingsData]);

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate({
      enabled,
      provider: provider || undefined,
      apiKey: apiKey || undefined,
      apiUrl: apiUrl || undefined,
      modelName: modelName || undefined,
      temperature,
      reasoning,
      systemPrompt: systemPrompt || undefined,
    });
  };

  const getProviderPlaceholders = () => {
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

  const placeholders = getProviderPlaceholders();

  if (settingsLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="space-y-2 text-center">
          <Loader2 className="text-primary mx-auto h-8 w-8 animate-spin" />
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
        <TabsList className="bg-card/40 border-border/40 mb-4 flex w-full max-w-md justify-start gap-1 rounded-xl border p-1 backdrop-blur-md">
          <TabsTrigger
            value="config"
            className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold active:scale-[0.98] transition-transform"
          >
            <Settings className="h-4 w-4 text-cyan-400" />
            Configuration
          </TabsTrigger>
          <TabsTrigger
            value="playground"
            className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold active:scale-[0.98] transition-transform"
          >
            <Play className="h-4 w-4 text-amber-400" />
            Playground
          </TabsTrigger>
          <TabsTrigger
            value="cache"
            className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold active:scale-[0.98] transition-transform"
          >
            <Database className="h-4 w-4 text-emerald-400" />
            Cache Lab
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Configuration */}
        <TabsContent value="config" className="mt-4 focus-visible:outline-none">
          <div className="rounded-2xl border border-border/30 bg-card/25 p-5 backdrop-blur-md shadow-xs space-y-5">
            <div className="flex flex-col gap-3 border-b border-border/20 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-foreground">Global AI Narrator Configuration</h3>
                </div>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  Manage LLM credentials and connection parameters. Falls back to SPORTS_LLM_API_KEY if left blank.
                </p>
              </div>
              <Button
                onClick={handleSaveSettings}
                disabled={saveSettingsMutation.isPending}
                size="sm"
                className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98] transition-transform"
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>

            <div className="space-y-4">
              {/* Enable Switch */}
              <div className="flex items-center justify-between rounded-xl border border-border/20 bg-background/30 p-3.5">
                <div>
                  <Label className="text-foreground text-xs font-bold">Enable Flavor Cards Globally</Label>
                  <p className="text-muted-foreground text-[11px]">
                    Enable or disable AI flavorization cards globally across all events and issues.
                  </p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} className="scale-90" />
              </div>

              {/* Grid Configs */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">LLM Provider</Label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger className="h-8 rounded-xl border-border/30 bg-background/50 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nvidia">Nvidia API</SelectItem>
                      <SelectItem value="openrouter">OpenRouter</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="custom">Custom Endpoint (OpenAI-compatible)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <Label className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Temperature</Label>
                    <span className="font-mono text-xs text-amber-400 font-bold">{temperature}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="h-1.5 w-full cursor-pointer accent-amber-500 rounded-lg bg-muted/40"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">API Endpoint URL</Label>
                  <Input
                    type="text"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder={placeholders.apiUrl}
                    className="h-8 rounded-xl border-border/30 bg-background/50 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Model Name</Label>
                  <Input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder={placeholders.modelName}
                    className="h-8 rounded-xl border-border/30 bg-background/50 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">API Key / Token</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={settingsData?.apiKey ? "••••••••••••••••" : "Fallback to SPORTS_LLM_API_KEY if empty"}
                  className="h-8 rounded-xl border-border/30 bg-background/50 text-xs"
                />
              </div>

              {/* System Prompt Editor */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Global System Prompt</Label>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Revert system prompt to default Paradox designer configuration?")) {
                        setSystemPrompt(DEFAULT_FLAVOR_SYSTEM_PROMPT);
                      }
                    }}
                    className="text-[10px] font-bold text-amber-400 uppercase hover:underline"
                  >
                    Reset to Default
                  </button>
                </div>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder={DEFAULT_FLAVOR_SYSTEM_PROMPT}
                  rows={5}
                  className="rounded-xl border-border/30 bg-background/50 font-mono text-xs leading-relaxed"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Playground */}
        <TabsContent value="playground" className="mt-4 focus-visible:outline-none">
          <NarratorPlaygroundTab />
        </TabsContent>

        {/* Tab 3: Cache Lab */}
        <TabsContent value="cache" className="mt-4 focus-visible:outline-none">
          <NarratorCacheTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default NarratorPanel;
