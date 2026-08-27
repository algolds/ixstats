// src/app/admin/_components/OnomaAdminPanel.tsx
// Onoma Voice & Phonology Admin Panel
"use client";

import { useEffect, useState } from "react";
import {
  FloppyDisk as Save,
  Microphone as Mic,
  SystemRestart as Loader2,
  Play,
  Translate as Languages,
  Flash as Zap,
  Activity,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { AdminHeader } from "./AdminHeader";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { useNotify } from "~/hooks/useNotify";
import { translateToIPA } from "~/lib/onoma/phonology";
import { ipaToKokoroPhonemes } from "~/lib/onoma/kokoro-phonemes";
import { withBasePath } from "~/lib/base-path";

const CULTURES = [
  "latin",
  "germanic",
  "celtic",
  "slavic",
  "arabic",
  "persian",
  "turkic",
  "indic",
  "east-asian",
  "austronesian",
  "african",
  "uralic",
  "constructed",
];

// Friendly labels for the common Kokoro voices; unknown ids fall back to the raw id.
const VOICE_LABELS: Record<string, string> = {
  af_heart: "Female US - Soft / Celtic & Elven tone",
  af_bella: "Female US - Bright / Germanic & Custom conlang tone",
  af_nicole: "Female US - Whisper / Shadow & Covert tone",
  af_sarah: "Female US - Warm / Slavic & Runic tone",
  am_adam: "Male US - Clear / Latin & Academic tone",
  am_michael: "Male US - Deep / Imperial & Military tone",
  bf_emma: "Female UK - Noble / Austronesian & Royal tone",
  bf_isabella: "Female UK - Expressive / Arabic & Cultural tone",
  bm_george: "Male UK - Gravel / Stout-folk & Deep tone",
  bm_lewis: "Male UK - Mellow / Place names & Geography tone",
};
const voiceLabel = (id: string) => (VOICE_LABELS[id] ? `${VOICE_LABELS[id]} (${id})` : id);

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-primary font-mono text-xs">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-primary w-full cursor-pointer"
      />
    </div>
  );
}

export function OnomaAdminPanel() {
  const notify = useNotify();
  const utils = api.useUtils();

  // Kokoro configuration queries/mutations
  const { data: kokoroData, isLoading: isLoadingKokoro } =
    api.onoma.getKokoroAdminConfig.useQuery();
  const { data: healthData, refetch: refetchHealth } = api.onoma.getEngineHealth.useQuery(
    undefined,
    {
      refetchInterval: 30000,
    }
  );

  const saveKokoro = api.onoma.updateKokoroConfig.useMutation({
    onSuccess: async () => {
      await utils.onoma.getKokoroAdminConfig.invalidate();
      await utils.onoma.getSpeechConfig.invalidate();
      await refetchHealth();
      notify.success("Kokoro natural voice settings saved.");
    },
    onError: (e) => notify.error(e.message),
  });

  // Live voice catalog from the configured Kokoro server (falls back to a built-in list).
  const { data: voicesData } = api.onoma.getKokoroVoices.useQuery(undefined, {
    staleTime: 600000,
  });
  const voiceOptions = voicesData?.voices ?? Object.keys(VOICE_LABELS);

  // Test word state
  const [testWord, setTestWord] = useState("Imperia");
  const [testCulture, setTestCulture] = useState("latin");

  // Kokoro State
  const [kokoroEnabled, setKokoroEnabled] = useState(true);
  const [kokoroBaseUrl, setKokoroBaseUrl] = useState("localhost:8888");
  const [kokoroApiKey, setKokoroApiKey] = useState("");
  const [kokoroModel, setKokoroModel] = useState("kokoro");
  const [kokoroVoice, setKokoroVoice] = useState("af_heart");
  const [kokoroSpeed, setKokoroSpeed] = useState(1.0);
  const [voiceMap, setVoiceMap] = useState<Record<string, string>>({});
  const [kokoroEngine, setKokoroEngine] = useState<"kokoro-fastapi" | "kokoro-web">(
    "kokoro-fastapi"
  );
  const [kokoroFastApiUrl, setKokoroFastApiUrl] = useState("http://localhost:8880");
  const [isTestingKokoro, setIsTestingKokoro] = useState(false);
  const [isWaking, setIsWaking] = useState(false);
  const [wakeStatusMessage, setWakeStatusMessage] = useState<string | null>(null);

  // Sync state with query data
  useEffect(() => {
    if (kokoroData) {
      setKokoroEnabled(kokoroData.enabled);
      setKokoroBaseUrl(kokoroData.baseUrl);
      setKokoroApiKey(kokoroData.apiKey);
      setKokoroModel(kokoroData.model);
      setKokoroVoice(kokoroData.voice);
      setKokoroSpeed(kokoroData.speed);
      setVoiceMap(kokoroData.voiceMap);
      setKokoroEngine(kokoroData.engine);
      setKokoroFastApiUrl(kokoroData.fastApiUrl);
    }
  }, [kokoroData]);

  const handleWakeServer = async () => {
    setIsWaking(true);
    setWakeStatusMessage("Pinging Kokoro server...");
    try {
      const res = await fetch(withBasePath("/api/onoma/health"), { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      await refetchHealth();

      const target = kokoroEngine === "kokoro-fastapi" ? data.fastapi : data.web;
      if (target === "up") {
        setWakeStatusMessage("Server is live and responding.");
        notify.success("Kokoro server is UP and responding.");
      } else {
        setWakeStatusMessage("Ping sent; cold start may take up to 45s.");
        notify.info("Wake ping sent. Server may be spinning up.");
      }
    } catch {
      setWakeStatusMessage("Could not contact health check endpoint.");
      notify.error("Health check endpoint unreachable.");
    } finally {
      setIsWaking(false);
    }
  };

  const handleTestKokoro = async () => {
    setIsTestingKokoro(true);
    try {
      const res = await fetch(withBasePath("/api/onoma/speak"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: testWord,
          culture: testCulture,
          engine: kokoroEngine,
          fastApiUrl: kokoroFastApiUrl,
          baseUrl: kokoroBaseUrl,
          voice: kokoroVoice,
          speed: kokoroSpeed,
          model: kokoroModel,
          apiKey: kokoroApiKey,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.details || `HTTP error ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      notify.success("Test pronunciation played successfully.");
    } catch (e: any) {
      console.error(e);
      notify.error(`Test failed: ${e.message}`);
    } finally {
      setIsTestingKokoro(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Languages}
        title="Onoma Voice & Phonology"
        description="Configure Kokoro natural voice synthesis, phonetic translation rules, and per-culture voice mappings."
      />

      {isLoadingKokoro ? (
        <p className="text-muted-foreground text-xs">Loading configuration…</p>
      ) : (
        <div className="border-border/30 bg-card/25 space-y-4 rounded-2xl border p-5 shadow-xs backdrop-blur-md">
          <div className="border-border/20 border-b pb-3">
            <div className="flex items-center gap-2">
              <Mic className="text-primary h-4 w-4" />
              <h3 className="text-foreground text-xs font-bold">
                Read Naturally (Kokoro Voice Engine)
              </h3>
            </div>
            <p className="text-muted-foreground mt-0.5 text-[11px]">
              Kokoro neural voice engine for natural phoneme synthesis. kokoro-fastapi accepts raw
              phonemes for precise pronunciation; kokoro-web uses re-spelling heuristics.
            </p>
          </div>

          <div className="space-y-4">
            <div className="border-border/20 bg-background/30 flex items-center justify-between rounded-xl border p-3.5">
              <div className="space-y-0.5">
                <Label className="text-foreground text-xs font-bold">Enable Kokoro Voice</Label>
                <p className="text-muted-foreground text-[11px]">
                  Activate the natural voice button across the naming lab.
                </p>
              </div>
              <Switch
                checked={kokoroEnabled}
                onCheckedChange={setKokoroEnabled}
                className="scale-90"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-foreground text-xs font-medium">Engine & Status</Label>
                <div className="flex items-center gap-2">
                  {healthData && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold">
                      {kokoroEngine === "kokoro-fastapi" ? (
                        <span
                          className={
                            healthData.fastapi === "up"
                              ? "text-emerald-400"
                              : healthData.fastapi === "down"
                                ? "text-rose-400"
                                : "text-muted-foreground"
                          }
                        >
                          {healthData.fastapi === "up"
                            ? "● Reachable"
                            : healthData.fastapi === "down"
                              ? "○ Unreachable"
                              : "Not configured"}
                        </span>
                      ) : (
                        <span
                          className={
                            healthData.web === "up"
                              ? "text-emerald-400"
                              : healthData.web === "down"
                                ? "text-rose-400"
                                : "text-muted-foreground"
                          }
                        >
                          {healthData.web === "up"
                            ? "● Reachable"
                            : healthData.web === "down"
                              ? "○ Unreachable"
                              : "Not configured"}
                        </span>
                      )}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleWakeServer}
                    disabled={isWaking}
                    title="Send a wake-up ping to the Kokoro server"
                    className="border-border/30 bg-background/50 text-foreground/80 hover:border-primary/40 hover:bg-primary/10 hover:text-primary flex cursor-pointer items-center gap-1 rounded-xl border px-2 py-0.5 text-[10px] font-medium transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {isWaking ? (
                      <Loader2 className="text-primary h-3 w-3 animate-spin" />
                    ) : (
                      <Zap className="text-primary h-3 w-3" />
                    )}
                    <span>{isWaking ? "Waking..." : "Ping Server"}</span>
                  </button>
                </div>
              </div>
              {wakeStatusMessage && (
                <p className="text-muted-foreground flex items-center gap-1 font-mono text-[10px]">
                  <Activity className="text-primary h-3 w-3" />
                  <span>{wakeStatusMessage}</span>
                </p>
              )}
              <select
                value={kokoroEngine}
                onChange={(e) => setKokoroEngine(e.target.value as "kokoro-fastapi" | "kokoro-web")}
                className="border-border/30 bg-background/50 text-foreground h-8 rounded-xl border px-3 text-xs backdrop-blur-md focus:outline-none"
              >
                <option value="kokoro-fastapi">Phoneme-native (kokoro-fastapi)</option>
                <option value="kokoro-web">Re-spelling (kokoro-web)</option>
              </select>
            </div>

            {kokoroEngine === "kokoro-fastapi" && (
              <div className="space-y-1">
                <Label className="text-foreground text-xs font-medium">kokoro-fastapi URL</Label>
                <Input
                  placeholder="http://localhost:8880"
                  value={kokoroFastApiUrl}
                  onChange={(e) => setKokoroFastApiUrl(e.target.value)}
                  className="border-border/30 bg-background/50 h-8 rounded-xl text-xs"
                />
                <p className="text-muted-foreground text-[10px]">
                  Host of the self-hosted kokoro-fastapi server that accepts raw phoneme input.
                </p>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-foreground text-xs font-medium">Base URL</Label>
              <Input
                placeholder="e.g. localhost:8888"
                value={kokoroBaseUrl}
                onChange={(e) => setKokoroBaseUrl(e.target.value)}
                className="border-border/30 bg-background/50 h-8 rounded-xl text-xs"
              />
              <p className="text-muted-foreground text-[10px]">
                Host of the self-hosted kokoro-web container.
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-foreground text-xs font-medium">API Key</Label>
              <Input
                type="password"
                placeholder="API Key (optional)"
                value={kokoroApiKey}
                onChange={(e) => setKokoroApiKey(e.target.value)}
                className="border-border/30 bg-background/50 h-8 rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-foreground text-xs font-medium">Default Voice</Label>
                <select
                  value={kokoroVoice}
                  onChange={(e) => setKokoroVoice(e.target.value)}
                  className="border-border/30 bg-background/50 text-foreground h-8 w-full rounded-xl border px-3 text-xs backdrop-blur-md focus:outline-none"
                >
                  {voiceOptions.map((id) => (
                    <option key={id} value={id}>
                      {voiceLabel(id)}
                    </option>
                  ))}
                </select>
                <p className="text-muted-foreground text-[10px]">
                  {voicesData?.source === "server"
                    ? `${voiceOptions.length} voices loaded from Kokoro server.`
                    : "Showing built-in voices."}
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-foreground text-xs font-medium">Model</Label>
                <Input
                  placeholder="e.g. kokoro"
                  value={kokoroModel}
                  onChange={(e) => setKokoroModel(e.target.value)}
                  className="border-border/30 bg-background/50 h-8 rounded-xl text-xs"
                />
              </div>
            </div>

            <Slider
              label="Speed Multiplier"
              value={kokoroSpeed}
              min={0.2}
              max={5.0}
              step={0.1}
              suffix="x"
              onChange={(v) => setKokoroSpeed(v)}
            />

            {/* Per-culture voice mapping */}
            <div className="border-border/20 space-y-2 border-t pt-3">
              <Label className="text-foreground text-xs font-bold">Per-culture voices</Label>
              <p className="text-muted-foreground text-[11px]">
                Assign a voice per naming culture. Use default falls back to the default voice
                above.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CULTURES.map((c) => {
                  const val = voiceMap[c] ?? "";
                  const isCustomBlend = val !== "" && !voiceOptions.includes(val);
                  return (
                    <div
                      key={c}
                      className="border-border/20 bg-background/30 space-y-1 rounded-xl border p-2"
                    >
                      <Label className="text-foreground text-[11px] font-semibold capitalize">
                        {c}
                      </Label>
                      <select
                        value={isCustomBlend ? "custom_blend" : val}
                        onChange={(e) =>
                          setVoiceMap((prev) => {
                            const next = { ...prev };
                            const v = e.target.value;
                            if (v === "custom_blend") {
                              next[c] = "af_heart*0.5+am_adam*0.5";
                            } else if (v) {
                              next[c] = v;
                            } else {
                              delete next[c];
                            }
                            return next;
                          })
                        }
                        className="border-border/30 bg-background/50 text-foreground h-7 w-full rounded-lg border px-2 text-[11px] focus:outline-none"
                      >
                        <option value="">Use default</option>
                        <option value="custom_blend">Custom Blend...</option>
                        {voiceOptions.map((id) => (
                          <option key={id} value={id}>
                            {voiceLabel(id)}
                          </option>
                        ))}
                      </select>
                      {isCustomBlend && (
                        <Input
                          value={val}
                          onChange={(e) => {
                            const inputVal = e.target.value;
                            setVoiceMap((prev) => ({ ...prev, [c]: inputVal }));
                          }}
                          placeholder="voice1*0.5+voice2*0.5"
                          className="border-border/30 bg-background/50 h-7 rounded-lg px-2 font-mono text-[10px]"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Test word */}
            <div className="border-border/20 flex flex-wrap items-end gap-3 border-t pt-3">
              <div className="space-y-1">
                <Label className="text-foreground text-xs font-medium">Test word</Label>
                <Input
                  value={testWord}
                  onChange={(e) => setTestWord(e.target.value)}
                  className="border-border/30 bg-background/50 h-8 w-full rounded-xl text-xs sm:w-44"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-foreground text-xs font-medium">As culture</Label>
                <select
                  value={testCulture}
                  onChange={(e) => setTestCulture(e.target.value)}
                  className="border-border/30 bg-background/50 text-foreground h-8 rounded-xl border px-3 text-xs focus:outline-none"
                >
                  {CULTURES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-muted-foreground self-center font-mono text-xs">
                {translateToIPA(testWord, testCulture)}
              </span>
              {kokoroEngine === "kokoro-fastapi" &&
                (() => {
                  const result = ipaToKokoroPhonemes(translateToIPA(testWord, testCulture));
                  return (
                    <>
                      <span className="text-muted-foreground self-center font-mono text-xs">
                        → {result.phonemes || "(empty)"}
                      </span>
                      {result.dropped.length > 0 && (
                        <span className="self-center text-[10px] text-amber-400">
                          ⚠ dropped: {result.dropped.join(", ")}
                        </span>
                      )}
                    </>
                  );
                })()}
            </div>

            <div className="border-border/20 flex gap-2 border-t pt-3">
              <Button
                onClick={() =>
                  saveKokoro.mutate({
                    enabled: kokoroEnabled,
                    baseUrl: kokoroBaseUrl,
                    apiKey: kokoroApiKey,
                    model: kokoroModel,
                    voice: kokoroVoice,
                    speed: kokoroSpeed,
                    voiceMap,
                    engine: kokoroEngine,
                    fastApiUrl: kokoroFastApiUrl,
                  })
                }
                disabled={saveKokoro.isPending}
                className="h-8 flex-1 gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-transform active:scale-[0.98]"
              >
                <Save className="h-3.5 w-3.5" />
                {saveKokoro.isPending ? "Saving..." : "Save Configuration"}
              </Button>

              <Button
                variant="outline"
                onClick={handleTestKokoro}
                disabled={isTestingKokoro}
                className="h-8 flex-1 gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-transform active:scale-[0.98]"
              >
                {isTestingKokoro ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Test Pronunciation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OnomaAdminPanel;
