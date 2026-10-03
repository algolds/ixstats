"use client";

// src/app/labs/onoma/components/sections/settings/VoicePreferencesPanel.tsx
// Voice Preferences, Species Presets, Inflection Tuning, and Culture Voice Mappings

import React, { useState } from "react";
import {
  SoundHigh as Volume2,
  Undo as RotateCcw,
  ControlSlider as Sliders,
  SystemRestart as Loader2,
  Flash as Zap,
  Activity,
  NavArrowDown as ChevronDown,
  NavArrowRight as ChevronRight,
} from "iconoir-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Slider } from "~/components/ui/slider";

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

export const SPECIES_PRESETS: Record<string, any> = {
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
    <div className="border-separator bg-fill-4 rounded-row space-y-4 border p-4 text-left">
      <div className="border-separator flex items-center justify-between border-b pb-2">
        <h4 className="text-label text-subhead">Voice preferences</h4>
        <div className="flex items-center gap-2">
          {healthData && (
            <span className="text-caption flex items-center gap-1 font-semibold">
              <span
                className={
                  healthData.fastapi === "up" || healthData.web === "up"
                    ? "text-green"
                    : healthData.fastapi === "down" && healthData.web === "down"
                      ? "text-red"
                      : "text-label-secondary"
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
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={handleWakeServer}
            disabled={isWaking}
            title="Send a wake ping to the Hugging Face space or Kokoro server container"
          >
            {isWaking ? (
              <Loader2 className="text-tint h-2.5 w-2.5 animate-spin" />
            ) : (
              <Zap className="text-tint h-2.5 w-2.5" />
            )}
            <span>{isWaking ? "Waking..." : "Ping / Wake"}</span>
          </Button>
        </div>
      </div>
      {wakeStatusMsg && (
        <p className="text-label-secondary text-caption flex items-center gap-1 font-mono">
          <Activity className="text-tint h-2.5 w-2.5" />
          <span>{wakeStatusMsg}</span>
        </p>
      )}
      <p className="text-label-secondary text-caption leading-normal">
        These preferences act as a default override for your browser session, running on top of
        per-culture voice selections.
      </p>

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-label-secondary text-subhead">Personal default voice</label>
          <Select
            value={personalVoice || "default"}
            onValueChange={(val) => onSavePreferences(val === "default" ? "" : val, personalSpeed)}
          >
            <SelectTrigger className="text-footnote w-full">
              <SelectValue placeholder="Use system default" />
            </SelectTrigger>
            <SelectContent className="max-h-[250px]">
              <SelectItem value="default" className="text-footnote">
                Use system default
              </SelectItem>
              {voiceOptions.map((id) => (
                <SelectItem key={id} value={id} className="text-footnote">
                  {voiceLabel(id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-label-secondary text-subhead">Personal speed override</label>
            <span className="text-tint text-footnote font-mono font-semibold">
              {personalSpeed}x
            </span>
          </div>
          <Slider
            min={0.5}
            max={2.0}
            step={0.05}
            value={[Number(personalSpeed)]}
            onValueChange={([v = 0.5]) => onSavePreferences(personalVoice, v)}
          />
        </div>

        {/* Collapsible: Advanced Playback & Inflection Options */}
        <div className="border-separator border-t pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvancedVoice(!showAdvancedVoice)}
            aria-expanded={showAdvancedVoice}
            className="text-label hover:text-tint w-full justify-between px-2"
          >
            <span className="flex items-center gap-2">
              <Sliders className="text-tint h-3.5 w-3.5" /> Advanced playback & inflection
            </span>
            {showAdvancedVoice ? (
              <ChevronDown className="text-label-secondary h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="text-label-secondary h-3.5 w-3.5" />
            )}
          </Button>

          {showAdvancedVoice && (
            <div className="text-label-secondary text-caption mt-3 space-y-4 pl-1">
              {/* Preset Selection */}
              <div className="space-y-1">
                <label className="text-label text-subhead">Species preset</label>
                <Select value={selectedPreset} onValueChange={(v) => onApplyPreset(v)}>
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom (No preset)</SelectItem>
                    <SelectItem value="elven">Elven (Soft & Luminous)</SelectItem>
                    <SelectItem value="dwarven">Dwarven (Deep & Stout)</SelectItem>
                    <SelectItem value="orcish">Orcish (Rough & Energetic)</SelectItem>
                    <SelectItem value="wraith">Wraith (Whispered & Mysterious)</SelectItem>
                    <SelectItem value="celestial">Celestial (Bright & Divine)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Force Native Bypass */}
              <div className="text-label flex items-center justify-between py-1">
                <span className="text-eyebrow">Force Native Browser TTS</span>
                <Checkbox
                  checked={forceNative}
                  onCheckedChange={(checked) =>
                    onUpdateAdvanced("onoma-personal-force-native", String(checked === true))
                  }
                />
              </div>

              {/* Local Playback Volume */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-eyebrow">Local playback volume</span>
                  <span className="text-tint text-footnote font-mono font-semibold">
                    {Math.round(personalVolume * 100)}%
                  </span>
                </div>
                <Slider
                  min={0}
                  max={1}
                  step={0.05}
                  value={[Number(personalVolume)]}
                  onValueChange={([v = 0]) => onUpdateAdvanced("onoma-personal-volume", String(v))}
                />
              </div>

              {/* Browser Pitch Override */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-eyebrow">Browser speech pitch</span>
                  <span className="text-tint text-footnote font-mono font-semibold">
                    {personalPitch}x
                  </span>
                </div>
                <Slider
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  value={[Number(personalPitch)]}
                  onValueChange={([v = 0.5]) => onUpdateAdvanced("onoma-personal-pitch", String(v))}
                />
              </div>

              {/* Voice Blending Options */}
              <div className="border-separator space-y-2 border-t pt-2">
                <div className="text-label flex items-center justify-between">
                  <span className="text-eyebrow">Voice blending</span>
                  <Checkbox
                    checked={voiceBlendActive}
                    onCheckedChange={(checked) =>
                      onUpdateAdvanced(
                        "onoma-personal-voice-blend-active",
                        String(checked === true)
                      )
                    }
                  />
                </div>
                {voiceBlendActive && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-caption font-semibold">Primary voice</label>
                      <Select
                        value={voiceBlendPrimary}
                        onValueChange={(v) =>
                          onUpdateAdvanced("onoma-personal-voice-blend-primary", v)
                        }
                      >
                        <SelectTrigger size="sm" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {voiceOptions.map((id) => (
                            <SelectItem key={id} value={id}>
                              {voiceLabel(id)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-caption font-semibold">Secondary voice</label>
                      <Select
                        value={voiceBlendSecondary}
                        onValueChange={(v) =>
                          onUpdateAdvanced("onoma-personal-voice-blend-secondary", v)
                        }
                      >
                        <SelectTrigger size="sm" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {voiceOptions.map((id) => (
                            <SelectItem key={id} value={id}>
                              {voiceLabel(id)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Emotional Prosody Inflections */}
              <div className="border-separator space-y-1 border-t pt-2">
                <label className="text-label text-subhead">Emotional prosody</label>
                <Select
                  value={personalProsody}
                  onValueChange={(v) => onUpdateAdvanced("onoma-personal-prosody", v)}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="neutral">Neutral (Standard)</SelectItem>
                    <SelectItem value="exclamatory">Energetic / Exclamatory (!)</SelectItem>
                    <SelectItem value="inquisitive">Inquisitive / Questioning (?)</SelectItem>
                    <SelectItem value="mysterious">Mysterious / Hesitant (...)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Inflection & Aspiration Tweaks */}
              <div className="border-separator space-y-2 border-t pt-2">
                <span className="text-label text-eyebrow">Inflection & phoneme tweaks</span>

                <div className="text-label flex items-center justify-between">
                  <span className="font-medium">Anglicize Vowels (Soft/English tones)</span>
                  <Checkbox
                    checked={personalAnglicize}
                    onCheckedChange={(checked) =>
                      onUpdateAdvanced("onoma-personal-anglicize", String(checked === true))
                    }
                  />
                </div>

                <div className="text-label flex items-center justify-between">
                  <span className="font-medium">Strip Stress Marks (Flatter pitch)</span>
                  <Checkbox
                    checked={personalStripStress}
                    onCheckedChange={(checked) =>
                      onUpdateAdvanced("onoma-personal-strip-stress", String(checked === true))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-label text-caption font-semibold">
                    Initial Breath/Aspiration Prefix
                  </label>
                  <Select
                    value={personalPhonemePrefix || "__none__"}
                    onValueChange={(v) =>
                      onUpdateAdvanced("onoma-personal-phoneme-prefix", v === "__none__" ? "" : v)
                    }
                  >
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None (Standard start)</SelectItem>
                      <SelectItem value="h">Soft H (h) - breathy aspiration</SelectItem>
                      <SelectItem value=".">Pause (.) - small initial silence</SelectItem>
                      <SelectItem value="ə">Schwa (ə) - neutral vowel start</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-label text-caption font-semibold">
                    Custom model override
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. model_q8f16"
                    value={personalModel}
                    onChange={(e) => onUpdateAdvanced("onoma-personal-model", e.target.value)}
                    className="text-caption w-full"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible: Culture-Specific Mappings */}
        <div className="border-separator border-t pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCultureMap(!showCultureMap)}
            aria-expanded={showCultureMap}
            className="text-label hover:text-tint w-full justify-between px-2"
          >
            <span className="flex items-center gap-2">
              <Volume2 className="text-tint h-3.5 w-3.5" /> Culture-Specific Voices
            </span>
            {showCultureMap ? (
              <ChevronDown className="text-label-secondary h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="text-label-secondary h-3.5 w-3.5" />
            )}
          </Button>

          {showCultureMap && (
            <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto pr-1 pl-1">
              <p className="text-label-secondary text-caption">
                Override the default voice for specific naming cultures during generation.
              </p>
              {CULTURES.map((c) => (
                <div key={c} className="text-caption flex items-center justify-between gap-2">
                  <span className="text-label-secondary truncate font-semibold capitalize">
                    {c}
                  </span>
                  <Select
                    value={personalVoiceMap[c] || "" || "__none__"}
                    onValueChange={(v) => onUpdateCultureMap(c, v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger size="sm" className="max-w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Inherit default</SelectItem>
                      {voiceOptions.map((vId) => (
                        <SelectItem key={vId} value={vId}>
                          {voiceLabel(vId)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2">
          <Button variant="outline" size="sm" onClick={onResetPreferences}>
            <RotateCcw className="h-3 w-3" /> Reset preferences
          </Button>
        </div>
      </div>
    </div>
  );
}
