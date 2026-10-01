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
        <h4 className="text-label text-subhead">Voice Preferences</h4>
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
            variant="bordered"
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

      <div className="space-y-3.5">
        <div className="space-y-1">
          <label className="text-label-secondary text-subhead">Personal Default Voice</label>
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

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-label-secondary text-subhead">Personal Speed Override</label>
            <span className="text-tint text-footnote font-mono font-semibold">
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
            className="accent-tint w-full cursor-pointer"
          />
        </div>

        {/* Collapsible: Advanced Playback & Inflection Options */}
        <div className="border-separator border-t pt-3">
          <button
            type="button"
            onClick={() => setShowAdvancedVoice(!showAdvancedVoice)}
            className="text-label hover:text-tint text-footnote flex w-full items-center justify-between py-1 font-semibold transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Sliders className="text-tint h-3.5 w-3.5" /> Advanced Playback & Inflection
            </span>
            {showAdvancedVoice ? (
              <ChevronDown className="text-label-secondary h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="text-label-secondary h-3.5 w-3.5" />
            )}
          </button>

          {showAdvancedVoice && (
            <div className="text-label-secondary text-caption mt-3 space-y-3.5 pl-1">
              {/* Preset Selection */}
              <div className="space-y-1">
                <label className="text-label text-subhead">Species Preset</label>
                <select
                  value={selectedPreset}
                  onChange={(e) => onApplyPreset(e.target.value)}
                  className="border-separator bg-fill-3 text-label hover:bg-fill-2 focus-visible:outline-tint rounded-control-sm text-footnote h-(--control-height-sm) w-full border px-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <option value="custom">Custom (No preset)</option>
                  <option value="elven">Elven (Soft & Luminous)</option>
                  <option value="dwarven">Dwarven (Deep & Stout)</option>
                  <option value="orcish">Orcish (Rough & Energetic)</option>
                  <option value="wraith">Wraith (Whispered & Mysterious)</option>
                  <option value="celestial">Celestial (Bright & Divine)</option>
                </select>
              </div>

              {/* Force Native Bypass */}
              <div className="text-label flex items-center justify-between py-1">
                <span className="text-eyebrow">Force Native Browser TTS</span>
                <input
                  type="checkbox"
                  checked={forceNative}
                  onChange={(e) =>
                    onUpdateAdvanced("onoma-personal-force-native", String(e.target.checked))
                  }
                  className="border-separator accent-tint rounded-control-sm h-4 w-4 cursor-pointer"
                />
              </div>

              {/* Local Playback Volume */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-eyebrow">Local Playback Volume</span>
                  <span className="text-tint text-footnote font-mono font-semibold">
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
                  className="accent-tint w-full cursor-pointer"
                />
              </div>

              {/* Browser Pitch Override */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-eyebrow">Browser Speech Pitch</span>
                  <span className="text-tint text-footnote font-mono font-semibold">
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
                  className="accent-tint w-full cursor-pointer"
                />
              </div>

              {/* Voice Blending Options */}
              <div className="border-separator space-y-2 border-t pt-2.5">
                <div className="text-label flex items-center justify-between">
                  <span className="text-eyebrow">Voice Blending</span>
                  <input
                    type="checkbox"
                    checked={voiceBlendActive}
                    onChange={(e) =>
                      onUpdateAdvanced(
                        "onoma-personal-voice-blend-active",
                        String(e.target.checked)
                      )
                    }
                    className="border-separator accent-tint rounded-control-sm h-4 w-4 cursor-pointer"
                  />
                </div>
                {voiceBlendActive && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-caption font-semibold">Primary Voice</label>
                      <select
                        value={voiceBlendPrimary}
                        onChange={(e) =>
                          onUpdateAdvanced("onoma-personal-voice-blend-primary", e.target.value)
                        }
                        className="border-separator bg-fill-3 text-label hover:bg-fill-2 focus-visible:outline-tint rounded-control-sm text-footnote h-(--control-height-sm) w-full border px-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        {voiceOptions.map((id) => (
                          <option key={id} value={id}>
                            {voiceLabel(id)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-caption font-semibold">Secondary Voice</label>
                      <select
                        value={voiceBlendSecondary}
                        onChange={(e) =>
                          onUpdateAdvanced("onoma-personal-voice-blend-secondary", e.target.value)
                        }
                        className="border-separator bg-fill-3 text-label hover:bg-fill-2 focus-visible:outline-tint rounded-control-sm text-footnote h-(--control-height-sm) w-full border px-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
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
              <div className="border-separator space-y-1 border-t pt-2.5">
                <label className="text-label text-subhead">Emotional Prosody</label>
                <select
                  value={personalProsody}
                  onChange={(e) => onUpdateAdvanced("onoma-personal-prosody", e.target.value)}
                  className="border-separator bg-fill-3 text-label hover:bg-fill-2 focus-visible:outline-tint rounded-control-sm text-footnote h-(--control-height-sm) w-full border px-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <option value="neutral">Neutral (Standard)</option>
                  <option value="exclamatory">Energetic / Exclamatory (!)</option>
                  <option value="inquisitive">Inquisitive / Questioning (?)</option>
                  <option value="mysterious">Mysterious / Hesitant (...)</option>
                </select>
              </div>

              {/* Inflection & Aspiration Tweaks */}
              <div className="border-separator space-y-2.5 border-t pt-2.5">
                <span className="text-label text-eyebrow">Inflection & Phoneme Tweaks</span>

                <div className="text-label flex items-center justify-between">
                  <span className="font-medium">Anglicize Vowels (Soft/English tones)</span>
                  <input
                    type="checkbox"
                    checked={personalAnglicize}
                    onChange={(e) =>
                      onUpdateAdvanced("onoma-personal-anglicize", String(e.target.checked))
                    }
                    className="border-separator accent-tint rounded-control-sm h-4 w-4 cursor-pointer"
                  />
                </div>

                <div className="text-label flex items-center justify-between">
                  <span className="font-medium">Strip Stress Marks (Flatter pitch)</span>
                  <input
                    type="checkbox"
                    checked={personalStripStress}
                    onChange={(e) =>
                      onUpdateAdvanced("onoma-personal-strip-stress", String(e.target.checked))
                    }
                    className="border-separator accent-tint rounded-control-sm h-4 w-4 cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-label text-caption font-semibold">
                    Initial Breath/Aspiration Prefix
                  </label>
                  <select
                    value={personalPhonemePrefix}
                    onChange={(e) =>
                      onUpdateAdvanced("onoma-personal-phoneme-prefix", e.target.value)
                    }
                    className="border-separator bg-fill-3 text-label hover:bg-fill-2 focus-visible:outline-tint rounded-control-sm text-footnote h-(--control-height-sm) w-full border px-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <option value="">None (Standard start)</option>
                    <option value="h">Soft H (h) - breathy aspiration</option>
                    <option value=".">Pause (.) - small initial silence</option>
                    <option value="ə">Schwa (ə) - neutral vowel start</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-label text-caption font-semibold">
                    Custom Model Override
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
          <button
            type="button"
            onClick={() => setShowCultureMap(!showCultureMap)}
            className="text-label hover:text-tint text-footnote flex w-full items-center justify-between py-1 font-semibold transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Volume2 className="text-tint h-3.5 w-3.5" /> Culture-Specific Voices
            </span>
            {showCultureMap ? (
              <ChevronDown className="text-label-secondary h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="text-label-secondary h-3.5 w-3.5" />
            )}
          </button>

          {showCultureMap && (
            <div className="mt-3 max-h-[220px] space-y-2.5 overflow-y-auto pr-1 pl-1">
              <p className="text-label-secondary text-caption">
                Override the default voice for specific naming cultures during generation.
              </p>
              {CULTURES.map((c) => (
                <div key={c} className="text-caption flex items-center justify-between gap-2">
                  <span className="text-label-secondary truncate font-semibold capitalize">
                    {c}
                  </span>
                  <select
                    value={personalVoiceMap[c] || ""}
                    onChange={(e) => onUpdateCultureMap(c, e.target.value)}
                    className="border-separator bg-fill-3 text-label hover:bg-fill-2 focus-visible:outline-tint rounded-control-sm text-footnote h-(--control-height-sm) max-w-[140px] border px-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
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
          <Button variant="bordered" size="sm" onClick={onResetPreferences}>
            <RotateCcw className="h-3 w-3" /> Reset Preferences
          </Button>
        </div>
      </div>
    </div>
  );
}
