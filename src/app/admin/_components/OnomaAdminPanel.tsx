"use client";

import { useEffect, useState } from "react";
import { Save, Mic, Loader2, Play, Languages } from "lucide-react";
import { api } from "~/trpc/react";
import { AdminHeader } from "./AdminHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { useNotify } from "~/hooks/useNotify";
import { translateToIPA } from "~/lib/onoma/phonology";
import { ipaToKokoroPhonemes } from "~/lib/onoma/kokoro-phonemes";

const CULTURES = [
  "latin",
  "germanic",
  "celtic",
  "slavic",
  "arabic",
  "east-asian",
  "austronesian",
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
        <span className="font-mono text-xs text-[#0091ff]">
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
        className="w-full cursor-pointer accent-[#0091ff]"
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
  const [kokoroEnabled, setKokoroEnabled] = useState(false);
  const [kokoroBaseUrl, setKokoroBaseUrl] = useState("");
  const [kokoroApiKey, setKokoroApiKey] = useState("");
  const [kokoroModel, setKokoroModel] = useState("model_q8f16");
  const [kokoroVoice, setKokoroVoice] = useState("af_heart");
  const [kokoroSpeed, setKokoroSpeed] = useState(1.0);
  const [voiceMap, setVoiceMap] = useState<Record<string, string>>({});
  const [kokoroEngine, setKokoroEngine] = useState<"kokoro-fastapi" | "kokoro-web">(
    "kokoro-fastapi"
  );
  const [kokoroFastApiUrl, setKokoroFastApiUrl] = useState("");
  const [isTestingKokoro, setIsTestingKokoro] = useState(false);

  useEffect(() => {
    if (kokoroData) {
      setKokoroEnabled(kokoroData.enabled);
      setKokoroBaseUrl(kokoroData.baseUrl);
      setKokoroApiKey(kokoroData.apiKey);
      setKokoroModel(kokoroData.model);
      setKokoroVoice(kokoroData.voice);
      setKokoroSpeed(kokoroData.speed);
      setVoiceMap(kokoroData.voiceMap || {});
      setKokoroEngine(kokoroData.engine || "kokoro-fastapi");
      setKokoroFastApiUrl(kokoroData.fastApiUrl || "");
    }
  }, [kokoroData]);

  const handleTestKokoro = async () => {
    if (!testWord) {
      notify.error("Please enter a test word.");
      return;
    }
    setIsTestingKokoro(true);
    try {
      const res = await fetch("/api/onoma/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-test-override": "true",
        },
        body: JSON.stringify({
          text: testWord,
          ipa: translateToIPA(testWord, testCulture),
          voice: kokoroVoice,
          speed: kokoroSpeed,
          model: kokoroModel,
          baseUrl: kokoroBaseUrl,
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
        title="Onoma — Pronunciation"
        description="Configure the kokoro-web natural neural voice for the 🎙 Read Naturally button. The 🔊 phonetic badge is driven by Onoma's IPA in the naming lab."
      />

      {isLoadingKokoro ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mic className="h-4 w-4 text-[#0091ff]" /> Read Naturally (Kokoro)
            </CardTitle>
            <CardDescription>
              Self-hosted Kokoro neural voice for the 🎙 Read Naturally button. kokoro-fastapi
              accepts raw phonemes for precise pronunciation; kokoro-web uses re-spelling
              heuristics.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-border/40 flex items-center justify-between border-b pb-2">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Enable Kokoro Voice</Label>
                <p className="text-muted-foreground text-[10px]">
                  Activate the 🎙 Read Naturally button in the naming lab.
                </p>
              </div>
              <input
                type="checkbox"
                checked={kokoroEnabled}
                onChange={(e) => setKokoroEnabled(e.target.checked)}
                className="border-border/60 h-4 w-4 cursor-pointer rounded accent-[#0091ff]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Engine</Label>
                {healthData && (
                  <span className="flex items-center gap-1 text-[9px] font-semibold">
                    {kokoroEngine === "kokoro-fastapi" ? (
                      <span
                        className={
                          healthData.fastapi === "up"
                            ? "text-emerald-500"
                            : healthData.fastapi === "down"
                              ? "text-rose-500"
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
                            ? "text-emerald-500"
                            : healthData.web === "down"
                              ? "text-rose-500"
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
              </div>
              <select
                value={kokoroEngine}
                onChange={(e) => setKokoroEngine(e.target.value as "kokoro-fastapi" | "kokoro-web")}
                className="border-border/60 bg-background w-full rounded-md border px-2 py-1.5 text-xs focus:outline-none"
              >
                <option value="kokoro-fastapi">Phoneme-native (kokoro-fastapi)</option>
                <option value="kokoro-web">Re-spelling (kokoro-web)</option>
              </select>
            </div>

            {kokoroEngine === "kokoro-fastapi" && (
              <div className="space-y-1">
                <Label className="text-xs">kokoro-fastapi URL</Label>
                <Input
                  placeholder="http://localhost:8880"
                  value={kokoroFastApiUrl}
                  onChange={(e) => setKokoroFastApiUrl(e.target.value)}
                  className="text-xs"
                />
                <p className="text-muted-foreground text-[9px]">
                  Host of the self-hosted kokoro-fastapi server that accepts raw phoneme input.
                </p>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Base URL</Label>
              <Input
                placeholder="e.g. localhost:8888"
                value={kokoroBaseUrl}
                onChange={(e) => setKokoroBaseUrl(e.target.value)}
                className="text-xs"
              />
              <p className="text-muted-foreground text-[9px]">
                Host of the self-hosted kokoro-web container — the /api/v1 path is added
                automatically.
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">API Key</Label>
              <Input
                type="password"
                placeholder="API Key (optional)"
                value={kokoroApiKey}
                onChange={(e) => setKokoroApiKey(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Default Voice</Label>
                <select
                  value={kokoroVoice}
                  onChange={(e) => setKokoroVoice(e.target.value)}
                  className="border-border/60 bg-background w-full rounded-md border px-2 py-1.5 text-xs focus:outline-none"
                >
                  {voiceOptions.map((id) => (
                    <option key={id} value={id}>
                      {voiceLabel(id)}
                    </option>
                  ))}
                </select>
                <p className="text-muted-foreground text-[9px]">
                  {voicesData?.source === "server"
                    ? `${voiceOptions.length} voices loaded from the Kokoro server.`
                    : "Showing built-in voices (Kokoro server not reachable)."}
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Model</Label>
                <Input
                  placeholder="e.g. kokoro"
                  value={kokoroModel}
                  onChange={(e) => setKokoroModel(e.target.value)}
                  className="h-9 text-xs"
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
            <div className="border-border/40 space-y-2 border-t pt-3">
              <Label className="text-xs font-semibold">Per-culture voices</Label>
              <p className="text-muted-foreground text-[10px]">
                Assign a voice per naming culture. "Use default" falls back to the default voice
                above. The 🔊 Pronounce button always uses the default voice.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CULTURES.map((c) => {
                  const val = voiceMap[c] ?? "";
                  const isCustomBlend = val !== "" && !voiceOptions.includes(val);
                  return (
                    <div key={c} className="space-y-0.5">
                      <Label className="text-[10px] capitalize">{c}</Label>
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
                        className="border-border/60 bg-background w-full rounded-md border px-2 py-1 text-[11px] focus:outline-none"
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
                          className="mt-1 h-7 px-2 py-1 font-mono text-[10px]"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Test word */}
            <div className="border-border/40 flex flex-wrap items-end gap-3 border-t pt-3">
              <div className="space-y-1">
                <Label className="text-xs">Test word</Label>
                <Input
                  value={testWord}
                  onChange={(e) => setTestWord(e.target.value)}
                  className="w-full text-xs sm:w-44"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">As culture</Label>
                <select
                  value={testCulture}
                  onChange={(e) => setTestCulture(e.target.value)}
                  className="border-border/60 bg-background rounded-md border px-3 py-2 text-xs focus:outline-none"
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
                        <span className="self-center text-[10px] text-amber-500">
                          ⚠ dropped: {result.dropped.join(", ")}
                        </span>
                      )}
                    </>
                  );
                })()}
            </div>

            <div className="border-border/40 flex gap-2 border-t pt-2">
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
                className="h-8 flex-1 gap-1.5 px-3 py-1.5 text-xs"
              >
                <Save className="h-3.5 w-3.5" />
                {saveKokoro.isPending ? "Saving..." : "Save Kokoro"}
              </Button>

              <Button
                variant="outline"
                onClick={handleTestKokoro}
                disabled={isTestingKokoro}
                className="h-8 flex-1 gap-1.5 px-3 py-1.5 text-xs"
              >
                {isTestingKokoro ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Test Pronunciation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default OnomaAdminPanel;
