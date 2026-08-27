// src/app/admin/narrator/_components/NarratorPlaygroundTab.tsx
// AI Narrator Live Simulation & Playground Testing Tab
"use client";

import React, { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Sparks as Sparkles,
  Page as ScrollText,
  Code as FileCode2,
  SystemRestart as Loader2,
} from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";

export function NarratorPlaygroundTab() {
  const notify = useNotify();

  const [sandboxMode, setSandboxMode] = useState(true);
  const [selectedCountryId, setSelectedCountryId] = useState("");
  const [selectedEventType, setSelectedEventType] = useState<"issue" | "policy" | "decision">(
    "issue"
  );
  const [selectedEventId, setSelectedEventId] = useState("");

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

  const { data: countries } = api.countries.getSelectList.useQuery({ limit: 100 });

  const { data: playgroundEvents, isLoading: eventsLoading } =
    api.narrator.getPlaygroundEvents.useQuery(
      { countryId: selectedCountryId, type: selectedEventType },
      { enabled: !sandboxMode && !!selectedCountryId }
    );

  const testFlavorizeMutation = api.narrator.testFlavorize.useMutation();

  useEffect(() => {
    if (!sandboxMode && selectedEventId && playgroundEvents) {
      const match = playgroundEvents.find((x) => x.id === selectedEventId);
      if (match) {
        setPlaygroundTitle(match.title);
        setPlaygroundDescription(match.description);
      }
    }
  }, [selectedEventId, playgroundEvents, sandboxMode]);

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

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
      {/* Input Config Panel (Left) */}
      <div className="space-y-4 xl:col-span-7">
        <div className="border-border/30 bg-card/25 space-y-4 rounded-2xl border p-5 shadow-xs backdrop-blur-md">
          <div className="border-border/20 border-b pb-3">
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-amber-400" />
              <h3 className="text-foreground text-xs font-bold">Event Simulation Telemetry</h3>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="border-border/20 bg-background/30 flex items-center justify-between rounded-xl border p-3.5">
            <div>
              <Label className="text-foreground text-xs font-bold uppercase">
                Sandbox Snapshot Mode
              </Label>
              <p className="text-muted-foreground text-[10px]">
                Inject custom JSON metrics directly instead of querying database instances.
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
              className="scale-90"
            />
          </div>

          {/* Database Select Controls */}
          {!sandboxMode && (
            <div className="border-border/20 bg-background/30 grid grid-cols-1 gap-3 rounded-xl border p-3.5 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-[10px] font-semibold uppercase">
                  1. Country
                </Label>
                <Select
                  value={selectedCountryId}
                  onValueChange={(val) => {
                    setSelectedCountryId(val);
                    setSelectedEventId("");
                  }}
                >
                  <SelectTrigger className="border-border/30 bg-background/50 h-8 rounded-xl text-xs">
                    <SelectValue placeholder="Choose nation..." />
                  </SelectTrigger>
                  <SelectContent>
                    {countries?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground text-[10px] font-semibold uppercase">
                  2. Event Type
                </Label>
                <Select
                  value={selectedEventType}
                  onValueChange={(val: "issue" | "policy" | "decision") => {
                    setSelectedEventType(val);
                    setSelectedEventId("");
                  }}
                >
                  <SelectTrigger className="border-border/30 bg-background/50 h-8 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="issue">Issue</SelectItem>
                    <SelectItem value="policy">Policy</SelectItem>
                    <SelectItem value="decision">Decision</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-muted-foreground text-[10px] font-semibold uppercase">
                  3. Live Incident
                </Label>
                <Select
                  value={selectedEventId}
                  onValueChange={setSelectedEventId}
                  disabled={eventsLoading || !selectedCountryId}
                >
                  <SelectTrigger className="border-border/30 bg-background/50 h-8 rounded-xl text-xs">
                    <SelectValue placeholder={eventsLoading ? "Loading..." : "Choose event..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {playgroundEvents?.map((ev) => (
                      <SelectItem key={ev.id} value={ev.id}>
                        {ev.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Title & Description */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Event Title
              </Label>
              <Input
                value={playgroundTitle}
                onChange={(e) => setPlaygroundTitle(e.target.value)}
                placeholder="e.g. Grain Tariff Act"
                className="border-border/30 bg-background/50 h-8 rounded-xl text-xs font-semibold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Event Details
              </Label>
              <Textarea
                value={playgroundDescription}
                onChange={(e) => setPlaygroundDescription(e.target.value)}
                placeholder="Describe the context, severity, and options..."
                rows={3}
                className="border-border/30 bg-background/50 rounded-xl text-xs leading-relaxed"
              />
            </div>
          </div>

          {/* Sandbox JSON */}
          {sandboxMode && (
            <div className="space-y-1">
              <Label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Sandbox Country Snapshot (JSON)
              </Label>
              <Textarea
                value={sandboxMetricsJson}
                onChange={(e) => setSandboxMetricsJson(e.target.value)}
                rows={5}
                className="border-border/30 bg-background/50 rounded-xl font-mono text-[11px] leading-relaxed"
              />
            </div>
          )}

          {/* Custom Prompt */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Prompt Override (Playground only)
            </Label>
            <Textarea
              value={customSystemPrompt}
              onChange={(e) => setCustomSystemPrompt(e.target.value)}
              placeholder="Override global system prompt rules temporarily to test modifications..."
              rows={2}
              className="border-border/30 bg-background/50 rounded-xl font-mono text-xs leading-relaxed"
            />
          </div>

          <Button
            onClick={handleTestFlavorize}
            disabled={testFlavorizeMutation.isPending}
            className="h-8 w-full rounded-xl text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            {testFlavorizeMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Consulting LLM Chronicle...
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Draft Flavor Card
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Preview Card Panel (Right) */}
      <div className="space-y-4 xl:col-span-5">
        <div className="flex items-center justify-between">
          <Label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Chronicle Card Mockup Preview
          </Label>
          {playgroundLatency !== null && (
            <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-400">
              {playgroundLatency}ms
            </span>
          )}
        </div>

        {testFlavorizeMutation.isPending ? (
          <div className="relative flex min-h-[160px] animate-pulse flex-col justify-center overflow-hidden rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="absolute top-0 left-0 h-full w-[3px] bg-amber-500/40" />
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wider text-amber-500/60 uppercase">
              <ScrollText className="h-4 w-4" />
              <span>The Chronicle</span>
            </div>
            <span className="text-muted-foreground font-serif text-xs leading-relaxed italic">
              Drafting Chronicle narrative...
            </span>
          </div>
        ) : playgroundOutput ? (
          <div className="relative min-h-[160px] overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 shadow-[0_0_20px_rgba(245,158,11,0.06)]">
            <div className="absolute top-0 left-0 h-full w-[3px] bg-amber-500/80" />
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-amber-400 uppercase">
                <ScrollText className="h-4 w-4 animate-pulse" />
                <span>The Chronicle</span>
              </div>
              <span className="text-muted-foreground/60 font-mono text-[10px] uppercase italic">
                {selectedEventType}
              </span>
            </div>
            <span className="text-foreground font-serif text-xs leading-relaxed italic">
              {playgroundOutput}
            </span>
          </div>
        ) : (
          <div className="border-border/30 text-muted-foreground/60 bg-card/10 flex min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center text-xs italic">
            <ScrollText className="text-muted-foreground/30 mb-2 h-8 w-8" />
            Configure the parameters on the left and run test to view the Paradox-style narrative
            wrapper.
          </div>
        )}

        <div className="border-border/30 bg-card/25 space-y-1.5 rounded-2xl border p-4 text-xs shadow-xs backdrop-blur-md">
          <h4 className="text-foreground text-xs font-bold uppercase">Immersion Snapshots</h4>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            During live simulation, when a player views an Issue, Policy, or Cabinet Decision, a
            contextual snapshot of live national metrics (GDP, stability, approval, government type)
            is passed alongside details to generate immersion flavor text.
          </p>
        </div>
      </div>
    </div>
  );
}

export default NarratorPlaygroundTab;
