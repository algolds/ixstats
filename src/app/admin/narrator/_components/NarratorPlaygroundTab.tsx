"use client";
// src/app/admin/narrator/_components/NarratorPlaygroundTab.tsx
// AI Narrator Live Simulation & Playground Testing Tab

import React, { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { ALL_REALMS } from "~/lib/realms/realm-ids";
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
import { Badge } from "~/components/ui/badge";
import { FacetCard } from "~/components/ui/facet-container";

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

  const { data: countries } = api.countries.getSelectList.useQuery({
    limit: 100,
    realm: ALL_REALMS,
  });

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
        <FacetCard className="space-y-4 p-5">
          <div className="border-separator border-b pb-3">
            <div className="flex items-center gap-2">
              <FileCode2 className="text-yellow h-4 w-4" />
              <h3 className="text-label text-caption">Event Simulation Telemetry</h3>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="border-separator bg-fill-3 rounded-row flex items-center justify-between border p-4">
            <div>
              <Label className="text-label text-subhead">Sandbox Snapshot Mode</Label>
              <p className="text-label-secondary text-footnote">
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
            <div className="border-separator bg-fill-3 rounded-row grid grid-cols-1 gap-3 border p-4 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-label-secondary text-subhead">1. Country</Label>
                <Select
                  value={selectedCountryId}
                  onValueChange={(val) => {
                    setSelectedCountryId(val);
                    setSelectedEventId("");
                  }}
                >
                  <SelectTrigger size="sm">
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
                <Label className="text-label-secondary text-subhead">2. Event Type</Label>
                <Select
                  value={selectedEventType}
                  onValueChange={(val: "issue" | "policy" | "decision") => {
                    setSelectedEventType(val);
                    setSelectedEventId("");
                  }}
                >
                  <SelectTrigger size="sm">
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
                <Label className="text-label-secondary text-subhead">3. Live Incident</Label>
                <Select
                  value={selectedEventId}
                  onValueChange={setSelectedEventId}
                  disabled={eventsLoading || !selectedCountryId}
                >
                  <SelectTrigger size="sm">
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
              <Label className="text-label-secondary text-subhead">Event Title</Label>
              <Input
                value={playgroundTitle}
                onChange={(e) => setPlaygroundTitle(e.target.value)}
                placeholder="e.g. Grain Tariff Act"
                className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-label-secondary text-subhead">Event Details</Label>
              <Textarea
                value={playgroundDescription}
                onChange={(e) => setPlaygroundDescription(e.target.value)}
                placeholder="Describe the context, severity, and options..."
                rows={3}
                className="md:text-footnote"
              />
            </div>
          </div>

          {/* Sandbox JSON */}
          {sandboxMode && (
            <div className="space-y-1">
              <Label className="text-label-secondary text-subhead">
                Sandbox Country Snapshot (JSON)
              </Label>
              <Textarea
                value={sandboxMetricsJson}
                onChange={(e) => setSandboxMetricsJson(e.target.value)}
                rows={5}
                className="md:text-footnote font-mono"
              />
            </div>
          )}

          {/* Custom Prompt */}
          <div className="space-y-1">
            <Label className="text-label-secondary text-subhead">
              Prompt Override (Playground only)
            </Label>
            <Textarea
              value={customSystemPrompt}
              onChange={(e) => setCustomSystemPrompt(e.target.value)}
              placeholder="Override global system prompt rules temporarily to test modifications..."
              rows={2}
              className="md:text-footnote font-mono"
            />
          </div>

          <Button
            onClick={handleTestFlavorize}
            disabled={testFlavorizeMutation.isPending}
            className="w-full"
          >
            {testFlavorizeMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Consulting LLM Chronicle...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-3.5 w-3.5" />
                Draft Flavor Card
              </>
            )}
          </Button>
        </FacetCard>
      </div>

      {/* Preview Card Panel (Right) */}
      <div className="space-y-4 xl:col-span-5">
        <div className="flex items-center justify-between">
          <Label className="text-label-secondary text-subhead">Chronicle Card Mockup Preview</Label>
          {playgroundLatency !== null && (
            <Badge variant="teal" className="tabular-nums">
              {playgroundLatency}ms
            </Badge>
          )}
        </div>

        {testFlavorizeMutation.isPending ? (
          <div className="rounded-card border-yellow/20 bg-yellow/5 relative flex min-h-[160px] flex-col justify-center overflow-hidden border p-5">
            <div className="bg-yellow/40 absolute top-0 left-0 h-full w-[3px]" />
            <div className="text-eyebrow text-yellow mb-2 flex items-center gap-2">
              <ScrollText className="h-4 w-4" />
              <span>The Chronicle</span>
            </div>
            <span className="text-label-secondary text-footnote leading-relaxed italic">
              Drafting Chronicle narrative...
            </span>
          </div>
        ) : playgroundOutput ? (
          <div className="rounded-card border-yellow/30 bg-yellow/5 relative min-h-[160px] overflow-hidden border p-5">
            <div className="bg-yellow/80 absolute top-0 left-0 h-full w-[3px]" />
            <div className="mb-2 flex items-center justify-between">
              <div className="text-eyebrow text-yellow flex items-center gap-2">
                <ScrollText className="h-4 w-4" />
                <span>The Chronicle</span>
              </div>
              <span className="text-label-secondary text-eyebrow italic tabular-nums">
                {selectedEventType}
              </span>
            </div>
            <span className="text-label text-footnote leading-relaxed italic">
              {playgroundOutput}
            </span>
          </div>
        ) : (
          <FacetCard className="text-label-secondary text-footnote flex min-h-[160px] flex-col items-center justify-center border-dashed p-8 text-center italic">
            <ScrollText className="text-label-tertiary mb-2 h-8 w-8" />
            Configure the parameters on the left and run test to view the Paradox-style narrative
            wrapper.
          </FacetCard>
        )}

        <FacetCard className="text-footnote space-y-2 p-4">
          <h4 className="text-label text-subhead">Immersion Snapshots</h4>
          <p className="text-label-secondary text-footnote leading-relaxed">
            During live simulation, when a player views an Issue, Policy, or Cabinet Decision, a
            contextual snapshot of live national metrics (GDP, stability, approval, government type)
            is passed alongside details to generate immersion flavor text.
          </p>
        </FacetCard>
      </div>
    </div>
  );
}

export default NarratorPlaygroundTab;
