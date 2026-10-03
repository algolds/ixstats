"use client";
// src/app/admin/narrator/NarratorPanel.tsx
// AI Narrator Global Configuration & Testing Suite

import React, { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Slider } from "~/components/ui/slider";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ValueSelect } from "~/components/ui/value-select";
import {
  Settings,
  Database,
  Play,
  SystemRestart as Loader2,
  ControlSlider as SlidersHorizontal,
  FloppyDisk as Save,
} from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { DEFAULT_FLAVOR_SYSTEM_PROMPT } from "~/lib/narrator/constants";
import { NarratorPlaygroundTab } from "./_components/NarratorPlaygroundTab";
import { NarratorCacheTab } from "./_components/NarratorCacheTab";
import { usePageTitle } from "~/hooks/usePageTitle";
import { Card } from "~/components/ui/card";

export function NarratorPanel() {
  usePageTitle({ title: "Admin - AI Narrator & Flavor" });
  const notify = useNotify();

  // Tab 1: Configuration state
  const [enabled, setEnabled] = useState(true);
  const [provider, setProvider] = useState("nvidia");
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
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
      setApiKey("");
      setClearApiKey(false);
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
      clearApiKey,
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
          <Loader2 className="text-tint mx-auto h-8 w-8 animate-spin" />
          <p className="text-label-secondary text-caption">Loading Narrator Settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI narrator"
        subtitle="LLM endpoints, system prompts, card narration tests and cache state."
      />

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="bg-fill-3 mb-4 flex w-full max-w-md justify-start gap-1 rounded-full p-1">
          <TabsTrigger
            value="config"
            className="text-caption flex flex-1 items-center justify-center gap-2"
          >
            <Settings className="text-teal h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger
            value="playground"
            className="text-caption flex flex-1 items-center justify-center gap-2"
          >
            <Play className="text-yellow h-4 w-4" />
            Playground
          </TabsTrigger>
          <TabsTrigger
            value="cache"
            className="text-caption flex flex-1 items-center justify-center gap-2"
          >
            <Database className="text-green h-4 w-4" />
            Cache lab
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Configuration */}
        <TabsContent value="config" className="mt-4 focus-visible:outline-none">
          <Card className="space-y-5 p-5">
            <div className="border-separator flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="text-yellow h-4 w-4" />
                  <h3 className="text-label text-caption">Global AI Narrator Configuration</h3>
                </div>
                <p className="text-label-secondary text-footnote mt-0.5">
                  Manage LLM credentials and connection parameters. Falls back to SPORTS_LLM_API_KEY
                  if left blank.
                </p>
              </div>
              <Button
                onClick={handleSaveSettings}
                disabled={saveSettingsMutation.isPending}
                size="sm"
              >
                <Save className="mr-2 h-3.5 w-3.5" />
                {saveSettingsMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>

            <div className="space-y-4">
              <div className="border-separator bg-fill-3 rounded-row flex items-center justify-between border p-4">
                <div>
                  <Label className="text-label text-caption">Enable flavor cards globally</Label>
                  <p className="text-label-secondary text-footnote">
                    Enable or disable AI flavorization cards globally across all events and issues.
                  </p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} className="scale-90" />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-label-secondary text-subhead">LLM Provider</Label>
                  <ValueSelect
                    value={provider}
                    onValueChange={setProvider}
                    options={[
                      ["nvidia", "Nvidia API"],
                      ["openrouter", "OpenRouter"],
                      ["openai", "OpenAI"],
                      ["custom", "Custom Endpoint (OpenAI-compatible)"],
                    ]}
                    size="sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label id="narrator-temperature" className="text-label-secondary text-subhead">
                      Temperature
                    </Label>
                    <span className="text-caption text-yellow tabular-nums">{temperature}</span>
                  </div>
                  <Slider
                    aria-labelledby="narrator-temperature"
                    min={0}
                    max={2}
                    step={0.1}
                    value={[temperature]}
                    onValueChange={([v]) => {
                      if (v !== undefined) setTemperature(v);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-label-secondary text-subhead">API Endpoint URL</Label>
                  <Input
                    type="text"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder={placeholders.apiUrl}
                    className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-label-secondary text-subhead">Model name</Label>
                  <Input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder={placeholders.modelName}
                    className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-label-secondary text-subhead">API Key / Token</Label>
                <Input
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    if (e.target.value) setClearApiKey(false);
                  }}
                  placeholder={
                    settingsData?.hasApiKey && !clearApiKey
                      ? `Saved (${settingsData.apiKeyHint}). Leave blank to keep`
                      : "Fallback to SPORTS_LLM_API_KEY if empty"
                  }
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                />
                {settingsData?.hasApiKey && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setClearApiKey((v) => !v);
                      setApiKey("");
                    }}
                    className="text-label-secondary hover:text-label h-auto px-0"
                  >
                    {clearApiKey ? "Keep the saved key" : "Remove the saved key on save"}
                  </Button>
                )}
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-label-secondary text-subhead">Global system prompt</Label>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Revert system prompt to default Paradox designer configuration?"
                        )
                      ) {
                        setSystemPrompt(DEFAULT_FLAVOR_SYSTEM_PROMPT);
                      }
                    }}
                    className="text-yellow h-auto px-0"
                  >
                    Reset to default
                  </Button>
                </div>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder={DEFAULT_FLAVOR_SYSTEM_PROMPT}
                  rows={5}
                  className="md:text-footnote font-mono"
                />
              </div>
            </div>
          </Card>
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
