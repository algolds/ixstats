"use client";

import { useEffect, useState } from "react";
import { Volume2, RotateCcw, Save } from "lucide-react";
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
  "any", "latin", "germanic", "celtic", "slavic", "arabic", "east-asian", "austronesian", "constructed",
];

// eSpeak voice variants (timbre).
const VARIANTS = ["", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "f1", "f2", "f3", "f4", "f5"];

function Slider({
  label, value, min, max, step = 1, suffix, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs font-mono text-[#0091ff]">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#0091ff] cursor-pointer"
      />
    </div>
  );
}

export function OnomaAdminPanel() {
  const notify = useNotify();
  const { data, isLoading } = api.onoma.getSpeechConfig.useQuery();
  const utils = api.useUtils();
  const save = api.onoma.updateSpeechConfig.useMutation({
    onSuccess: async () => {
      await utils.onoma.getSpeechConfig.invalidate();
      notify.success("Onoma pronunciation settings saved.");
    },
    onError: (e) => notify.error(e.message),
  });

  const [cfg, setCfg] = useState<SpeechConfig>(DEFAULT_SPEECH_CONFIG);
  const [testWord, setTestWord] = useState("Imperia");
  const [testCulture, setTestCulture] = useState("latin");

  useEffect(() => {
    if (data) setCfg({ ...DEFAULT_SPEECH_CONFIG, ...data, voices: { ...DEFAULT_SPEECH_CONFIG.voices, ...data.voices } });
  }, [data]);

  const set = <K extends keyof SpeechConfig>(k: K, v: SpeechConfig[K]) => setCfg((p) => ({ ...p, [k]: v }));
  const setVoice = (culture: string, voice: string) =>
    setCfg((p) => ({ ...p, voices: { ...p.voices, [culture]: voice } }));

  const handleTest = () => {
    setSpeechConfig(cfg); // apply the in-form (possibly unsaved) settings
    void speakName(testWord, translateToIPA(testWord, testCulture), testCulture);
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Onoma — Pronunciation"
        description="Tune the meSpeak (eSpeak) phonetic engine that powers the 🔊 Pronounce button in the Naming Lab."
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Engine parameters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Voice Parameters (meSpeak / eSpeak)</CardTitle>
              <CardDescription>Global synthesis settings applied to every pronunciation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Slider label="Speed" value={cfg.speed} min={80} max={450} suffix=" wpm" onChange={(v) => set("speed", v)} />
              <Slider label="Pitch" value={cfg.pitch} min={0} max={99} onChange={(v) => set("pitch", v)} />
              <Slider label="Amplitude (volume)" value={cfg.amplitude} min={0} max={200} onChange={(v) => set("amplitude", v)} />
              <Slider label="Word gap" value={cfg.wordgap} min={0} max={50} suffix=" ×10ms" onChange={(v) => set("wordgap", v)} />
              <div className="space-y-1">
                <Label className="text-xs">Voice variant (timbre)</Label>
                <select
                  value={cfg.variant}
                  onChange={(e) => set("variant", e.target.value)}
                  className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                >
                  {VARIANTS.map((v) => (
                    <option key={v || "none"} value={v}>{v || "Default"}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Per-culture voice mapping */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Culture → Voice Mapping</CardTitle>
              <CardDescription>Which eSpeak voice each cultural family is pronounced with.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {CULTURES.map((culture) => (
                <div key={culture} className="flex items-center justify-between gap-3">
                  <Label className="text-xs capitalize w-32">{culture.replace("-", " ")}</Label>
                  <select
                    value={cfg.voices[culture] ?? "en/en"}
                    onChange={(e) => setVoice(culture, e.target.value)}
                    className="flex-1 rounded-md border border-border/60 bg-background px-3 py-1.5 text-sm"
                  >
                    {VOICE_OPTIONS.map((v) => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Test + Save */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Test & Save</CardTitle>
              <CardDescription>Preview the current (unsaved) settings, then persist them.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Test word</Label>
                  <Input value={testWord} onChange={(e) => setTestWord(e.target.value)} className="w-48" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">As culture</Label>
                  <select
                    value={testCulture}
                    onChange={(e) => setTestCulture(e.target.value)}
                    className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
                  >
                    {CULTURES.filter((c) => c !== "any").map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <Button variant="outline" onClick={handleTest} className="gap-2">
                  <Volume2 className="h-4 w-4" /> Test Pronunciation
                </Button>
                <span className="text-xs text-muted-foreground font-mono self-center">
                  {translateToIPA(testWord, testCulture)}
                </span>
              </div>

              <div className="flex gap-2 border-t border-border/40 pt-4">
                <Button onClick={() => save.mutate(cfg)} disabled={save.isPending} className="gap-2">
                  <Save className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save Settings"}
                </Button>
                <Button variant="ghost" onClick={() => setCfg(DEFAULT_SPEECH_CONFIG)} className="gap-2">
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
