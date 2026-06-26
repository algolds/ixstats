"use client";

import { useEffect, useState } from "react";
import { Volume2, RotateCcw, Save, Mic, Loader2, Play, Languages } from "lucide-react";
import { api } from "~/trpc/react";
import { AdminHeader } from "./AdminHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { useNotify } from "~/hooks/useNotify";
import { DEFAULT_SPEECH_CONFIG, setSpeechConfig, type SpeechConfig } from "~/lib/onoma/speech";
import { translateToIPA } from "~/lib/onoma/phonology";
import { speakName } from "~/lib/onoma/mespeak-loader";

// meSpeak voices shipped under public/onoma/mespeak/voices.
const VOICE_OPTIONS = [
  { id: "en/en", label: "English (en)" },
  { id: "la", label: "Latin (la)" },
  { id: "de", label: "German (de)" },
  { id: "pl", label: "Polish (pl)" },
  { id: "zh", label: "Mandarin (zh)" },
  { id: "it", label: "Italian (it)" },
  { id: "el", label: "Greek (el)" },
  { id: "es", label: "Spanish (es)" },
  { id: "eo", label: "Esperanto (eo)" },
];
const CULTURES = [
  "any",
  "latin",
  "germanic",
  "celtic",
  "slavic",
  "arabic",
  "east-asian",
  "austronesian",
  "constructed",
];

// eSpeak voice variants (timbre).
const VARIANTS = ["", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "f1", "f2", "f3", "f4", "f5"];

const KOKORO_VOICES = [
  { id: "af_heart", label: "Female US - Heart (af_heart)" },
  { id: "af_bella", label: "Female US - Bella (af_bella)" },
  { id: "af_nicole", label: "Female US - Nicole (af_nicole)" },
  { id: "af_sarah", label: "Female US - Sarah (af_sarah)" },
  { id: "am_adam", label: "Male US - Adam (am_adam)" },
  { id: "am_michael", label: "Male US - Michael (am_michael)" },
  { id: "bf_emma", label: "Female UK - Emma (bf_emma)" },
  { id: "bf_isabella", label: "Female UK - Isabella (bf_isabella)" },
  { id: "bm_george", label: "Male UK - George (bm_george)" },
  { id: "bm_lewis", label: "Male UK - Lewis (bm_lewis)" },
];

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

  // meSpeak configuration queries/mutations
  const { data, isLoading } = api.onoma.getSpeechConfig.useQuery();
  const save = api.onoma.updateSpeechConfig.useMutation({
    onSuccess: async () => {
      await utils.onoma.getSpeechConfig.invalidate();
      notify.success("Onoma pronunciation settings saved.");
    },
    onError: (e) => notify.error(e.message),
  });

  // Kokoro configuration queries/mutations
  const { data: kokoroData, isLoading: isLoadingKokoro } =
    api.onoma.getKokoroAdminConfig.useQuery();
  const saveKokoro = api.onoma.updateKokoroConfig.useMutation({
    onSuccess: async () => {
      await utils.onoma.getKokoroAdminConfig.invalidate();
      await utils.onoma.getSpeechConfig.invalidate();
      notify.success("Kokoro natural voice settings saved.");
    },
    onError: (e) => notify.error(e.message),
  });

  // meSpeak State
  const [cfg, setCfg] = useState<SpeechConfig>(DEFAULT_SPEECH_CONFIG);
  const [testWord, setTestWord] = useState("Imperia");
  const [testCulture, setTestCulture] = useState("latin");

  // Kokoro State
  const [kokoroEnabled, setKokoroEnabled] = useState(false);
  const [kokoroBaseUrl, setKokoroBaseUrl] = useState("");
  const [kokoroApiKey, setKokoroApiKey] = useState("");
  const [kokoroModel, setKokoroModel] = useState("model_q8f16");
  const [kokoroVoice, setKokoroVoice] = useState("af_heart");
  const [kokoroSpeed, setKokoroSpeed] = useState(1.0);
  const [isTestingKokoro, setIsTestingKokoro] = useState(false);

  useEffect(() => {
    if (data)
      setCfg({
        ...DEFAULT_SPEECH_CONFIG,
        ...data,
        voices: { ...DEFAULT_SPEECH_CONFIG.voices, ...data.voices },
      });
  }, [data]);

  useEffect(() => {
    if (kokoroData) {
      setKokoroEnabled(kokoroData.enabled);
      setKokoroBaseUrl(kokoroData.baseUrl);
      setKokoroApiKey(kokoroData.apiKey);
      setKokoroModel(kokoroData.model);
      setKokoroVoice(kokoroData.voice);
      setKokoroSpeed(kokoroData.speed);
    }
  }, [kokoroData]);

  const set = <K extends keyof SpeechConfig>(k: K, v: SpeechConfig[K]) =>
    setCfg((p) => ({ ...p, [k]: v }));
  const setVoice = (culture: string, voice: string) =>
    setCfg((p) => ({ ...p, voices: { ...p.voices, [culture]: voice } }));

  const handleTest = () => {
    setSpeechConfig(cfg); // apply the in-form (possibly unsaved) settings
    void speakName(testWord, translateToIPA(testWord, testCulture), testCulture);
  };

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

  const isPanelLoading = isLoading || isLoadingKokoro;

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Languages}
        title="Onoma — Pronunciation"
        description="Tune the phonetic and natural neural speech synthesis settings that power name pronunciation."
      />

      {isPanelLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Engine parameters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Voice Parameters (meSpeak / eSpeak)</CardTitle>
              <CardDescription>
                Global synthesis settings applied to phonetic pronunciation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Slider
                label="Speed"
                value={cfg.speed}
                min={80}
                max={450}
                suffix=" wpm"
                onChange={(v) => set("speed", v)}
              />
              <Slider
                label="Pitch"
                value={cfg.pitch}
                min={0}
                max={99}
                onChange={(v) => set("pitch", v)}
              />
              <Slider
                label="Amplitude (volume)"
                value={cfg.amplitude}
                min={0}
                max={200}
                onChange={(v) => set("amplitude", v)}
              />
              <Slider
                label="Word gap"
                value={cfg.wordgap}
                min={0}
                max={50}
                suffix=" ×10ms"
                onChange={(v) => set("wordgap", v)}
              />
              <div className="space-y-1">
                <Label className="text-xs">Voice variant (timbre)</Label>
                <select
                  value={cfg.variant}
                  onChange={(e) => set("variant", e.target.value)}
                  className="border-border/60 bg-background w-full rounded-md border px-3 py-2 text-sm focus:outline-none"
                >
                  {VARIANTS.map((v) => (
                    <option key={v || "none"} value={v}>
                      {v || "Default"}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Per-culture voice mapping */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Culture → Voice Mapping</CardTitle>
              <CardDescription>
                Which eSpeak voice each cultural family is pronounced with.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {CULTURES.map((culture) => (
                <div key={culture} className="flex items-center justify-between gap-3">
                  <Label className="w-32 text-xs capitalize">{culture.replace("-", " ")}</Label>
                  <select
                    value={cfg.voices[culture] ?? "en/en"}
                    onChange={(e) => setVoice(culture, e.target.value)}
                    className="border-border/60 bg-background flex-1 rounded-md border px-3 py-1.5 text-sm focus:outline-none"
                  >
                    {VOICE_OPTIONS.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Read Naturally (Kokoro) card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mic className="h-4 w-4 text-[#0091ff]" /> Read Naturally (Kokoro)
              </CardTitle>
              <CardDescription>
                Configure the natural neural voice proxy settings for realistic audio immersion.
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
                <Label className="text-xs">Base URL</Label>
                <Input
                  placeholder="e.g. http://localhost:3000"
                  value={kokoroBaseUrl}
                  onChange={(e) => setKokoroBaseUrl(e.target.value)}
                  className="text-xs"
                />
                <p className="text-muted-foreground text-[9px]">
                  Endpoint of the self-hosted eduardolat/kokoro-web container.
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">API Key</Label>
                <Input
                  type="password"
                  placeholder="API Key (KW_SECRET_API_KEY)"
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
                    {KOKORO_VOICES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Model</Label>
                  <Input
                    placeholder="e.g. model_q8f16"
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
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Test + Save meSpeak */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Test & Save (meSpeak)</CardTitle>
              <CardDescription>
                Preview the current (unsaved) phonetic settings, then persist them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Test word</Label>
                  <Input
                    value={testWord}
                    onChange={(e) => setTestWord(e.target.value)}
                    className="w-full text-xs sm:w-48"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">As culture</Label>
                  <select
                    value={testCulture}
                    onChange={(e) => setTestCulture(e.target.value)}
                    className="border-border/60 bg-background rounded-md border px-3 py-2 text-xs focus:outline-none"
                  >
                    {CULTURES.filter((c) => c !== "any").map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <Button variant="outline" onClick={handleTest} className="gap-2 text-xs">
                  <Volume2 className="h-4 w-4" /> Test Phonetics
                </Button>
                <span className="text-muted-foreground self-center font-mono text-xs">
                  {translateToIPA(testWord, testCulture)}
                </span>
              </div>

              <div className="border-border/40 flex gap-2 border-t pt-4">
                <Button
                  onClick={() => save.mutate(cfg)}
                  disabled={save.isPending}
                  className="gap-2 text-xs"
                >
                  <Save className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save Phonetics"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setCfg(DEFAULT_SPEECH_CONFIG)}
                  className="gap-2 text-xs"
                >
                  <RotateCcw className="h-4 w-4" /> Reset to Defaults
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default OnomaAdminPanel;
