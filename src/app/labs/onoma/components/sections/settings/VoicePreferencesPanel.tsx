"use client";

// src/app/labs/onoma/components/sections/settings/VoicePreferencesPanel.tsx
// Voice Preferences, Species Presets, Inflection Tuning, and Culture Voice Mappings

import React, { useState } from "react";
import {
  Volume2,
  RotateCcw,
  Sliders,
  Loader2,
  Zap,
  Activity,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

export const VOICE_LABELS: Record<string, string> = {
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
export const voiceLabel = (id: string) => (VOICE_LABELS[id] ? `${VOICE_LABELS[id]} (${id})` : id);

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

const PRESETS: Record<string, any> = {
  elven: {
    voice: "af_heart",
    speed: 0.85,
    volume: 1.0,
    pitch: 1.1,
    anglicize: true,
    phonemePrefix: ".",
    stripStress: false,
    prosody: "neutral",
    blendActive: false,
  },
  dwarven: {
    voice: "bm_george",
    speed: 0.82,
    volume: 1.0,
    pitch: 0.8,
    anglicize: false,
    phonemePrefix: "h",
    stripStress: false,
    prosody: "neutral",
    blendActive: false,
  },
  orcish: {
    voice: "bm_george",
    speed: 0.78,
    volume: 1.0,
    pitch: 0.75,
    anglicize: false,
    phonemePrefix: "h",
    stripStress: true,
    prosody: "exclamatory",
    blendActive: false,
  },
  wraith: {
    voice: "af_nicole",
    speed: 0.7,
    volume: 0.85,
    pitch: 0.9,
    anglicize: true,
    phonemePrefix: ".",
    stripStress: false,
    prosody: "mysterious",
    blendActive: false,
  },
  celestial: {
    voice: "bf_emma",
    speed: 0.9,
    volume: 1.0,
    pitch: 1.2,
    anglicize: true,
    phonemePrefix: "ə",
    stripStress: false,
    prosody: "neutral",
    blendActive: false,
  },
};

interface VoicePreferencesPanelProps {
  voiceOptions: string[];
  personalVoice: string;
  personalSpeed: number;
  forceNative: boolean;
  personalVolume: number;
  personalPitch: number;
  personalAnglicize: boolean;
  personalPhonemePrefix: string;
  personalStripStress: boolean;
  personalModel: string;
  personalVoiceMap: Record<string, string>;
  personalProsody: string;
  voiceBlendActive: boolean;
  voiceBlendPrimary: string;
  voiceBlendSecondary: string;
  selectedPreset: string;
  onSavePreferences: (voice: string, speed: number) => void;
  onUpdateAdvanced: (key: string, value: any) => void;
  onUpdateCultureMap: (culture: string, voiceId: string) => void;
  onApplyPreset: (presetName: string) => void;
  onResetPreferences: () => void;
}

export function VoicePreferencesPanel({
  voiceOptions,
  personalVoice,
  personalSpeed,
  forceNative,
  personalVolume,
  personalPitch,
  personalAnglicize,
  personalPhonemePrefix,
  personalStripStress,
  personalModel,
  personalVoiceMap,
  personalProsody,
  voiceBlendActive,
  voiceBlendPrimary,
  voiceBlendSecondary,
  selectedPreset,
  onSavePreferences,
  onUpdateAdvanced,
  onUpdateCultureMap,
  onApplyPreset,
  onResetPreferences,
}: VoicePreferencesPanelProps) {
  const notify = useNotify();
  const utils = api.useUtils();

  const { data: healthData, refetch: refetchHealth } = api.onoma.getEngineHealth.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );

  const [isWaking, setIsWaking] = useState(false);
  const [wakeStatusMsg, setWakeStatusMsg] = useState<string | null>(null);
  const [showAdvancedVoice, setShowAdvancedVoice] = useState(false);
  const [showCultureMap, setShowCultureMap] = useState(false);

  const wakeMutation = api.onoma.wakeKokoroServer.useMutation({
    onSuccess: async (res) => {
      await refetchHealth();
      await utils.onoma.getKokoroVoices.invalidate();
      if (res.status === "awake") {
        setWakeStatusMsg(`Awake (${res.latencyMs}ms)`);
        notify.success(res.message);
      } else if (res.status === "waking") {
        setWakeStatusMsg("Booting container...");
        notify.info(res.message);
      } else {
        setWakeStatusMsg(res.message);
        notify.error(res.message);
      }
    },
    onError: (err) => {
      notify.error(`Wake ping failed: ${err.message}`);
    },
  });

  const handleWakeServer = async () => {
    setIsWaking(true);
    setWakeStatusMsg("Waking Hugging Face space / container...");
    try {
      await wakeMutation.mutateAsync();
    } finally {
      setIsWaking(false);
    }
  };

  return (
    <div className="border-border/40 bg-secondary/5 space-y-4 rounded-xl border p-4 text-left">
      <div className="flex items-center justify-between border-b border-border/30 pb-2">
        <h4 className="text-foreground text-xs font-bold tracking-wider uppercase">
          Voice Preferences
        </h4>
        <div className="flex items-center gap-2">
          {healthData && (
            <span className="flex items-center gap-1 text-[9px] font-semibold">
              <span
                className={
                  healthData.fastapi === "up" || healthData.web === "up"
                    ? "text-emerald-500"
                    : healthData.fastapi === "down" && healthData.web === "down"
                      ? "text-rose-500"
                      : "text-muted-foreground"
                }
              >
                {healthData.fastapi === "up" || healthData.web === "up"
                  ? "● Server Online"
                  : healthData.fastapi === "down" && healthData.web === "down"
                    ? "○ Server Sleeping"
                    : "Server Configured"}
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={handleWakeServer}
            disabled={isWaking}
            title="Send a wake ping to the Hugging Face space or Kokoro server container"
            className="border-border/50 bg-secondary/30 text-foreground/80 hover:border-[#0091ff]/40 hover:bg-[#0091ff]/10 hover:text-[#0091ff] flex cursor-pointer items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-medium transition-all active:scale-95 disabled:opacity-50"
          >
            {isWaking ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin text-[#0091ff]" />
            ) : (
              <Zap className="h-2.5 w-2.5 text-[#0091ff]" />
            )}
            <span>{isWaking ? "Waking..." : "Ping / Wake"}</span>
          </button>
        </div>
      </div>
      {wakeStatusMsg && (
        <p className="text-muted-foreground flex items-center gap-1 font-mono text-[9px]">
          <Activity className="h-2.5 w-2.5 text-[#0091ff]" />
          <span>{wakeStatusMsg}</span>
        </p>
      )}
      <p className="text-muted-foreground text-[10px] leading-normal">
        These preferences act as a default override for your browser session, running on top of
        per-culture voice selections.
      </p>

      <div className="space-y-3.5">
        <div className="space-y-1">
          <label className="text-muted-foreground text-[10px] font-bold uppercase">
            Personal Default Voice
          </label>
          <Select
            value={personalVoice || "default"}
            onValueChange={(val) =>
              onSavePreferences(val === "default" ? "" : val, personalSpeed)
            }
          >
            <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-xs transition-colors focus:outline-none">
              <SelectValue placeholder="Use system default" />
            </SelectTrigger>
            <SelectContent className="border-border/40 bg-background/95 max-h-[250px] backdrop-blur-md">
              <SelectItem
                value="default"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Use system default
              </SelectItem>
              {voiceOptions.map((id) => (
                <SelectItem
                  key={id}
                  value={id}
                  className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                >
                  {voiceLabel(id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-muted-foreground text-[10px] font-bold uppercase">
              Personal Speed Override
            </label>
            <span className="font-mono text-xs font-semibold text-[#0091ff]">
              {personalSpeed}x
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.05}
            value={personalSpeed}
            onChange={(e) => onSavePreferences(personalVoice, Number(e.target.value))}
            className="w-full cursor-pointer accent-[#0091ff]"
          />
        </div>

        {/* Collapsible: Advanced Playback & Inflection Options */}
        <div className="border-border/20 border-t pt-3">
          <button
            type="button"
            onClick={() => setShowAdvancedVoice(!showAdvancedVoice)}
            className="text-foreground flex w-full items-center justify-between py-1 text-xs font-bold transition-colors hover:text-[#0091ff]"
          >
            <span className="flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-[#0091ff]" /> Advanced Playback & Inflection
            </span>
            {showAdvancedVoice ? (
              <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
            )}
          </button>

          {showAdvancedVoice && (
            <div className="text-muted-foreground mt-3 space-y-3.5 pl-1 text-[11px]">
              {/* Preset Selection */}
              <div className="space-y-1">
                <label className="text-foreground text-[10px] font-bold uppercase">
                  Species Preset
                </label>
                <select
                  value={selectedPreset}
                  onChange={(e) => onApplyPreset(e.target.value)}
                  className="border-border/60 bg-background text-foreground w-full rounded-md border px-2 py-1.5 text-[11px] focus:outline-none"
                >
                  <option value="custom">Custom (No preset)</option>
                  <option value="elven">Elven (Soft & Magical)</option>
                  <option value="dwarven">Dwarven (Deep & Stout)</option>
                  <option value="orcish">Orcish (Rough & Energetic)</option>
                  <option value="wraith">Wraith (Whispered & Mysterious)</option>
                  <option value="celestial">Celestial (Bright & Divine)</option>
                </select>
              </div>

              {/* Force Native Bypass */}
              <div className="text-foreground flex items-center justify-between py-1">
                <span className="text-[10px] font-semibold uppercase">
                  Force Native Browser TTS
                </span>
                <input
                  type="checkbox"
                  checked={forceNative}
                  onChange={(e) =>
                    onUpdateAdvanced("onoma-personal-force-native", String(e.target.checked))
                  }
                  className="border-border/60 h-4 w-4 cursor-pointer rounded accent-[#0091ff]"
                />
              </div>

              {/* Local Playback Volume */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-[10px] font-bold uppercase">Local Playback Volume</span>
                  <span className="font-mono text-xs font-semibold text-[#0091ff]">
                    {Math.round(personalVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={personalVolume}
                  onChange={(e) => onUpdateAdvanced("onoma-personal-volume", e.target.value)}
                  className="w-full cursor-pointer accent-[#0091ff]"
                />
              </div>

              {/* Browser Pitch Override */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-[10px] font-bold uppercase">Browser Speech Pitch</span>
                  <span className="font-mono text-xs font-semibold text-[#0091ff]">
                    {personalPitch}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  value={personalPitch}
                  onChange={(e) => onUpdateAdvanced("onoma-personal-pitch", e.target.value)}
                  className="w-full cursor-pointer accent-[#0091ff]"
                />
              </div>

              {/* Voice Blending Options */}
              <div className="border-border/10 space-y-2 border-t pt-2.5">
                <div className="text-foreground flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase">Voice Blending</span>
                  <input
                    type="checkbox"
                    checked={voiceBlendActive}
                    onChange={(e) =>
                      onUpdateAdvanced(
                        "onoma-personal-voice-blend-active",
                        String(e.target.checked)
                      )
                    }
                    className="border-border/60 h-4 w-4 cursor-pointer rounded accent-[#0091ff]"
                  />
                </div>
                {voiceBlendActive && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-semibold">Primary Voice</label>
                      <select
                        value={voiceBlendPrimary}
                        onChange={(e) =>
                          onUpdateAdvanced("onoma-personal-voice-blend-primary", e.target.value)
                        }
                        className="border-border/60 bg-background text-foreground w-full rounded border px-2 py-1 text-[11px] focus:outline-none"
                      >
                        {voiceOptions.map((id) => (
                          <option key={id} value={id}>
                            {voiceLabel(id)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-semibold">Secondary Voice</label>
                      <select
                        value={voiceBlendSecondary}
                        onChange={(e) =>
                          onUpdateAdvanced("onoma-personal-voice-blend-secondary", e.target.value)
                        }
                        className="border-border/60 bg-background text-foreground w-full rounded border px-2 py-1 text-[11px] focus:outline-none"
                      >
                        {voiceOptions.map((id) => (
                          <option key={id} value={id}>
                            {voiceLabel(id)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Emotional Prosody Inflections */}
              <div className="border-border/10 space-y-1 border-t pt-2.5">
                <label className="text-foreground text-[10px] font-bold uppercase">
                  Emotional Prosody
                </label>
                <select
                  value={personalProsody}
                  onChange={(e) => onUpdateAdvanced("onoma-personal-prosody", e.target.value)}
                  className="border-border/60 bg-background text-foreground w-full rounded-md border px-2 py-1.5 text-[11px] focus:outline-none"
                >
                  <option value="neutral">Neutral (Standard)</option>
                  <option value="exclamatory">Energetic / Exclamatory (!)</option>
                  <option value="inquisitive">Inquisitive / Questioning (?)</option>
                  <option value="mysterious">Mysterious / Hesitant (...)</option>
                </select>
              </div>

              {/* Inflection & Aspiration Tweaks */}
              <div className="border-border/10 space-y-2.5 border-t pt-2.5">
                <span className="text-foreground text-[10px] font-bold uppercase">
                  Inflection & Phoneme Tweaks
                </span>

                <div className="text-foreground flex items-center justify-between">
                  <span className="font-medium">Anglicize Vowels (Soft/English tones)</span>
                  <input
                    type="checkbox"
                    checked={personalAnglicize}
                    onChange={(e) =>
                      onUpdateAdvanced("onoma-personal-anglicize", String(e.target.checked))
                    }
                    className="border-border/60 h-4 w-4 cursor-pointer rounded accent-[#0091ff]"
                  />
                </div>

                <div className="text-foreground flex items-center justify-between">
                  <span className="font-medium">Strip Stress Marks (Flatter pitch)</span>
                  <input
                    type="checkbox"
                    checked={personalStripStress}
                    onChange={(e) =>
                      onUpdateAdvanced("onoma-personal-strip-stress", String(e.target.checked))
                    }
                    className="border-border/60 h-4 w-4 cursor-pointer rounded accent-[#0091ff]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-foreground text-[9px] font-semibold">
                    Initial Breath/Aspiration Prefix
                  </label>
                  <select
                    value={personalPhonemePrefix}
                    onChange={(e) =>
                      onUpdateAdvanced("onoma-personal-phoneme-prefix", e.target.value)
                    }
                    className="border-border/60 bg-background text-foreground w-full rounded border px-2 py-1 text-[11px] focus:outline-none"
                  >
                    <option value="">None (Standard start)</option>
                    <option value="h">Soft H (h) - breathy aspiration</option>
                    <option value=".">Pause (.) - small initial silence</option>
                    <option value="ə">Schwa (ə) - neutral vowel start</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-foreground text-[9px] font-semibold">
                    Custom Model Override
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. model_q8f16"
                    value={personalModel}
                    onChange={(e) => onUpdateAdvanced("onoma-personal-model", e.target.value)}
                    className="border-border/60 bg-background text-foreground w-full rounded border px-2 py-1 text-[11px] focus:border-[#0091ff] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible: Culture-Specific Mappings */}
        <div className="border-border/20 border-t pt-3">
          <button
            type="button"
            onClick={() => setShowCultureMap(!showCultureMap)}
            className="text-foreground flex w-full items-center justify-between py-1 text-xs font-bold transition-colors hover:text-[#0091ff]"
          >
            <span className="flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5 text-[#0091ff]" /> Culture-Specific Voices
            </span>
            {showCultureMap ? (
              <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
            )}
          </button>

          {showCultureMap && (
            <div className="mt-3 max-h-[220px] space-y-2.5 overflow-y-auto pr-1 pl-1">
              <p className="text-muted-foreground text-[10px]">
                Override the default voice for specific naming cultures during generation.
              </p>
              {CULTURES.map((c) => (
                <div key={c} className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-muted-foreground truncate font-semibold capitalize">
                    {c}
                  </span>
                  <select
                    value={personalVoiceMap[c] || ""}
                    onChange={(e) => onUpdateCultureMap(c, e.target.value)}
                    className="border-border/60 bg-background text-foreground max-w-[140px] rounded border px-1.5 py-0.5 text-[10px] focus:outline-none"
                  >
                    <option value="">Inherit Default</option>
                    {voiceOptions.map((vId) => (
                      <option key={vId} value={vId}>
                        {voiceLabel(vId)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2">
          <button
            onClick={onResetPreferences}
            className="border-border/60 bg-background text-muted-foreground hover:bg-secondary/40 flex items-center gap-1 rounded border px-2.5 py-1 text-[10px] font-bold transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" /> Reset Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
