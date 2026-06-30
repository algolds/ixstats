"use client";

// src/app/labs/onoma/components/sections/SettingsSection.tsx
// Onoma Lab — User Voice Settings, Interactive Sandbox, & Local Browser Data Manager

import { useState, useEffect } from "react";
import {
  Volume2,
  Mic,
  RotateCcw,
  Sliders,
  Download,
  Upload,
  Trash2,
  Check,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { speakName } from "~/lib/onoma/browser-speech";
import { translateToIPA } from "~/lib/onoma/phonology";
import { ipaToKokoroPhonemes } from "~/lib/onoma/kokoro-phonemes";
import {
  NAME_OVERRIDES_KEY,
  PHONOLOGY_RULES_KEY,
  OVERRIDES_UPDATED_EVENT,
} from "~/lib/onoma/ipa-overrides";

// Friendly labels for common Kokoro voices
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

export function SettingsSection() {
  const notify = useNotify();

  // Load public speech config (including Kokoro settings)
  const { data: speechConfig } = api.onoma.getSpeechConfig.useQuery(undefined, {
    staleTime: 600000,
  });

  // Voice catalog — loaded from Kokoro server or fallback list
  const { data: voicesData } = api.onoma.getKokoroVoices.useQuery(undefined, {
    staleTime: 600000,
  });
  const voiceOptions = voicesData?.voices ?? Object.keys(VOICE_LABELS);

  // tRPC suggestion mutation
  const suggestMutation = api.onoma.suggestPhonemes.useMutation();

  // Local storage states
  const [personalVoice, setPersonalVoice] = useState("");
  const [personalSpeed, setPersonalSpeed] = useState(1.0);
  const [mounted, setMounted] = useState(false);

  // Advanced Options
  const [forceNative, setForceNative] = useState(false);
  const [personalVolume, setPersonalVolume] = useState(1.0);
  const [personalPitch, setPersonalPitch] = useState(1.0);
  const [personalAnglicize, setPersonalAnglicize] = useState(true);
  const [personalPhonemePrefix, setPersonalPhonemePrefix] = useState("");
  const [personalStripStress, setPersonalStripStress] = useState(false);
  const [personalModel, setPersonalModel] = useState("");
  const [personalVoiceMap, setPersonalVoiceMap] = useState<Record<string, string>>({});
  const [personalProsody, setPersonalProsody] = useState("neutral");

  // Blending
  const [voiceBlendActive, setVoiceBlendActive] = useState(false);
  const [voiceBlendPrimary, setVoiceBlendPrimary] = useState("af_heart");
  const [voiceBlendSecondary, setVoiceBlendSecondary] = useState("am_michael");

  // Preset
  const [selectedPreset, setSelectedPreset] = useState("custom");

  // Collapsible toggle states
  const [showAdvancedVoice, setShowAdvancedVoice] = useState(false);
  const [showCultureMap, setShowCultureMap] = useState(false);

  // Sandbox states
  const [sandboxText, setSandboxText] = useState("Imperia");
  const [sandboxIpa, setSandboxIpa] = useState("");
  const [sandboxVoice, setSandboxVoice] = useState("");
  const [isPlayingSandbox, setIsPlayingSandbox] = useState(false);

  // Load local state on mount
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setPersonalVoice(localStorage.getItem("onoma-personal-voice") || "");
      const speedRaw = localStorage.getItem("onoma-personal-speed");
      setPersonalSpeed(speedRaw ? Number(speedRaw) : 1.0);

      // Advanced Options
      setForceNative(localStorage.getItem("onoma-personal-force-native") === "true");
      const volRaw = localStorage.getItem("onoma-personal-volume");
      setPersonalVolume(volRaw ? Number(volRaw) : 1.0);
      const pitchRaw = localStorage.getItem("onoma-personal-pitch");
      setPersonalPitch(pitchRaw ? Number(pitchRaw) : 1.0);
      setPersonalAnglicize(localStorage.getItem("onoma-personal-anglicize") !== "false");
      setPersonalPhonemePrefix(localStorage.getItem("onoma-personal-phoneme-prefix") || "");
      setPersonalStripStress(localStorage.getItem("onoma-personal-strip-stress") === "true");
      setPersonalModel(localStorage.getItem("onoma-personal-model") || "");
      setPersonalProsody(localStorage.getItem("onoma-personal-prosody") || "neutral");

      // Blending
      setVoiceBlendActive(localStorage.getItem("onoma-personal-voice-blend-active") === "true");
      setVoiceBlendPrimary(
        localStorage.getItem("onoma-personal-voice-blend-primary") || "af_heart"
      );
      setVoiceBlendSecondary(
        localStorage.getItem("onoma-personal-voice-blend-secondary") || "am_michael"
      );

      // Culture Voice Map
      try {
        const mapRaw = localStorage.getItem("onoma-personal-voice-map");
        setPersonalVoiceMap(mapRaw ? JSON.parse(mapRaw) : {});
      } catch {
        setPersonalVoiceMap({});
      }

      // Selected Preset
      setSelectedPreset(localStorage.getItem("onoma-personal-preset") || "custom");
    }
  }, []);

  // Update sandbox IPA automatically when sandboxText changes
  useEffect(() => {
    setSandboxIpa(translateToIPA(sandboxText, "latin"));
  }, [sandboxText]);

  const savePersonalPreferences = (voice: string, speed: number) => {
    if (typeof window === "undefined") return;
    localStorage.setItem("onoma-personal-voice", voice);
    localStorage.setItem("onoma-personal-speed", String(speed));
    setPersonalVoice(voice);
    setPersonalSpeed(speed);

    // Set preset to custom since user directly adjusted main controls
    localStorage.setItem("onoma-personal-preset", "custom");
    setSelectedPreset("custom");

    notify.success("Voice preferences updated successfully.");
  };

  const handleUpdateAdvancedSetting = (key: string, value: any) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, String(value));

    if (key === "onoma-personal-force-native") setForceNative(value === "true" || value === true);
    if (key === "onoma-personal-volume") setPersonalVolume(Number(value));
    if (key === "onoma-personal-pitch") setPersonalPitch(Number(value));
    if (key === "onoma-personal-anglicize")
      setPersonalAnglicize(value === "true" || value === true);
    if (key === "onoma-personal-phoneme-prefix") setPersonalPhonemePrefix(value);
    if (key === "onoma-personal-strip-stress")
      setPersonalStripStress(value === "true" || value === true);
    if (key === "onoma-personal-model") setPersonalModel(value);
    if (key === "onoma-personal-prosody") setPersonalProsody(value);
    if (key === "onoma-personal-voice-blend-active")
      setVoiceBlendActive(value === "true" || value === true);
    if (key === "onoma-personal-voice-blend-primary") setVoiceBlendPrimary(value);
    if (key === "onoma-personal-voice-blend-secondary") setVoiceBlendSecondary(value);

    if (key !== "onoma-personal-preset") {
      localStorage.setItem("onoma-personal-preset", "custom");
      setSelectedPreset("custom");
    }
  };

  const handleUpdateCultureMap = (culture: string, voiceId: string) => {
    if (typeof window === "undefined") return;
    const newMap = { ...personalVoiceMap, [culture]: voiceId };
    if (!voiceId) {
      delete newMap[culture];
    }
    localStorage.setItem("onoma-personal-voice-map", JSON.stringify(newMap));
    setPersonalVoiceMap(newMap);
  };

  const handleApplyPreset = (presetName: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem("onoma-personal-preset", presetName);
    setSelectedPreset(presetName);

    if (presetName === "custom") return;

    const preset = PRESETS[presetName];
    if (preset) {
      localStorage.setItem("onoma-personal-voice", preset.voice);
      localStorage.setItem("onoma-personal-speed", String(preset.speed));
      localStorage.setItem("onoma-personal-volume", String(preset.volume));
      localStorage.setItem("onoma-personal-pitch", String(preset.pitch));
      localStorage.setItem("onoma-personal-anglicize", String(preset.anglicize));
      localStorage.setItem("onoma-personal-phoneme-prefix", preset.phonemePrefix);
      localStorage.setItem("onoma-personal-strip-stress", String(preset.stripStress));
      localStorage.setItem("onoma-personal-prosody", preset.prosody);
      localStorage.setItem("onoma-personal-voice-blend-active", String(preset.blendActive));

      setPersonalVoice(preset.voice);
      setPersonalSpeed(preset.speed);
      setPersonalVolume(preset.volume);
      setPersonalPitch(preset.pitch);
      setPersonalAnglicize(preset.anglicize);
      setPersonalPhonemePrefix(preset.phonemePrefix);
      setPersonalStripStress(preset.stripStress);
      setPersonalProsody(preset.prosody);
      setVoiceBlendActive(preset.blendActive);

      notify.success(
        `Applied ${presetName.charAt(0).toUpperCase() + presetName.slice(1)} species voice preset.`
      );
    }
  };

  const handleResetPreferences = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("onoma-personal-voice");
    localStorage.removeItem("onoma-personal-speed");
    localStorage.removeItem("onoma-personal-force-native");
    localStorage.removeItem("onoma-personal-volume");
    localStorage.removeItem("onoma-personal-pitch");
    localStorage.removeItem("onoma-personal-anglicize");
    localStorage.removeItem("onoma-personal-phoneme-prefix");
    localStorage.removeItem("onoma-personal-strip-stress");
    localStorage.removeItem("onoma-personal-model");
    localStorage.removeItem("onoma-personal-voice-map");
    localStorage.removeItem("onoma-personal-prosody");
    localStorage.removeItem("onoma-personal-voice-blend-active");
    localStorage.removeItem("onoma-personal-voice-blend-primary");
    localStorage.removeItem("onoma-personal-voice-blend-secondary");
    localStorage.removeItem("onoma-personal-preset");

    setPersonalVoice("");
    setPersonalSpeed(1.0);
    setForceNative(false);
    setPersonalVolume(1.0);
    setPersonalPitch(1.0);
    setPersonalAnglicize(true);
    setPersonalPhonemePrefix("");
    setPersonalStripStress(false);
    setPersonalModel("");
    setPersonalVoiceMap({});
    setPersonalProsody("neutral");
    setVoiceBlendActive(false);
    setVoiceBlendPrimary("af_heart");
    setVoiceBlendSecondary("am_michael");
    setSelectedPreset("custom");

    notify.success("Voice preferences reset to system defaults.");
  };

  // Play sandbox audio
  const handlePlaySandbox = async () => {
    if (isPlayingSandbox) return;
    setIsPlayingSandbox(true);
    try {
      await speakName({
        name: sandboxText,
        ipa: sandboxIpa,
        culture: "latin",
        kokoroEnabled: Boolean(speechConfig?.kokoro?.enabled),
        voice: sandboxVoice || undefined,
        defaultVoice: speechConfig?.kokoro?.voice,
      });
    } catch (err: any) {
      console.error(err);
      notify.error(err.message || "Sandbox playback failed.");
    } finally {
      setIsPlayingSandbox(false);
    }
  };

  // Suggest IPA for sandbox
  const handleSuggestSandboxIpa = async () => {
    try {
      const res = await suggestMutation.mutateAsync({ text: sandboxText });
      if (res.phonemes) {
        setSandboxIpa(res.phonemes);
        notify.success("IPA suggestion loaded from Kokoro G2P.");
      } else {
        notify.error("Could not obtain an IPA suggestion.");
      }
    } catch (err: any) {
      notify.error(err.message || "G2P suggestion failed.");
    }
  };

  // Export local conlang data as a JSON file
  const handleExportData = () => {
    if (typeof window === "undefined") return;
    const backup = {
      nameOverrides: JSON.parse(localStorage.getItem(NAME_OVERRIDES_KEY) || "{}"),
      phonologyRules: JSON.parse(localStorage.getItem(PHONOLOGY_RULES_KEY) || "{}"),
      lexiconDefinitions: JSON.parse(localStorage.getItem("onoma-lexicon-definitions") || "{}"),
      personalVoice: localStorage.getItem("onoma-personal-voice") || "",
      personalSpeed: localStorage.getItem("onoma-personal-speed") || "",
      personalForceNative: localStorage.getItem("onoma-personal-force-native") || "",
      personalVolume: localStorage.getItem("onoma-personal-volume") || "",
      personalPitch: localStorage.getItem("onoma-personal-pitch") || "",
      personalAnglicize: localStorage.getItem("onoma-personal-anglicize") || "",
      personalPhonemePrefix: localStorage.getItem("onoma-personal-phoneme-prefix") || "",
      personalStripStress: localStorage.getItem("onoma-personal-strip-stress") || "",
      personalModel: localStorage.getItem("onoma-personal-model") || "",
      personalProsody: localStorage.getItem("onoma-personal-prosody") || "",
      voiceBlendActive: localStorage.getItem("onoma-personal-voice-blend-active") || "",
      voiceBlendPrimary: localStorage.getItem("onoma-personal-voice-blend-primary") || "",
      voiceBlendSecondary: localStorage.getItem("onoma-personal-voice-blend-secondary") || "",
      personalVoiceMap: localStorage.getItem("onoma-personal-voice-map") || "",
      personalPreset: localStorage.getItem("onoma-personal-preset") || "",
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `onoma-conlang-backup-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify.success("Conlang data exported successfully.");
  };

  // Import local conlang data from a JSON file
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (typeof window === "undefined" || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = event.target?.result as string;
        const backup = JSON.parse(raw);

        if (backup && typeof backup === "object") {
          if (backup.nameOverrides) {
            localStorage.setItem(NAME_OVERRIDES_KEY, JSON.stringify(backup.nameOverrides));
          }
          if (backup.phonologyRules) {
            localStorage.setItem(PHONOLOGY_RULES_KEY, JSON.stringify(backup.phonologyRules));
          }
          if (backup.lexiconDefinitions) {
            localStorage.setItem(
              "onoma-lexicon-definitions",
              JSON.stringify(backup.lexiconDefinitions)
            );
          }
          if (backup.personalVoice !== undefined) {
            localStorage.setItem("onoma-personal-voice", backup.personalVoice);
            setPersonalVoice(backup.personalVoice);
          }
          if (backup.personalSpeed !== undefined) {
            localStorage.setItem("onoma-personal-speed", String(backup.personalSpeed));
            setPersonalSpeed(backup.personalSpeed ? Number(backup.personalSpeed) : 1.0);
          }
          if (backup.personalForceNative !== undefined) {
            localStorage.setItem("onoma-personal-force-native", String(backup.personalForceNative));
            setForceNative(
              backup.personalForceNative === "true" || backup.personalForceNative === true
            );
          }
          if (backup.personalVolume !== undefined) {
            localStorage.setItem("onoma-personal-volume", String(backup.personalVolume));
            setPersonalVolume(Number(backup.personalVolume));
          }
          if (backup.personalPitch !== undefined) {
            localStorage.setItem("onoma-personal-pitch", String(backup.personalPitch));
            setPersonalPitch(Number(backup.personalPitch));
          }
          if (backup.personalAnglicize !== undefined) {
            localStorage.setItem("onoma-personal-anglicize", String(backup.personalAnglicize));
            setPersonalAnglicize(
              backup.personalAnglicize === "true" ||
                backup.personalAnglicize === true ||
                backup.personalAnglicize === "false"
                ? backup.personalAnglicize !== "false"
                : true
            );
          }
          if (backup.personalPhonemePrefix !== undefined) {
            localStorage.setItem(
              "onoma-personal-phoneme-prefix",
              String(backup.personalPhonemePrefix)
            );
            setPersonalPhonemePrefix(backup.personalPhonemePrefix);
          }
          if (backup.personalStripStress !== undefined) {
            localStorage.setItem("onoma-personal-strip-stress", String(backup.personalStripStress));
            setPersonalStripStress(
              backup.personalStripStress === "true" || backup.personalStripStress === true
            );
          }
          if (backup.personalModel !== undefined) {
            localStorage.setItem("onoma-personal-model", String(backup.personalModel));
            setPersonalModel(backup.personalModel);
          }
          if (backup.personalProsody !== undefined) {
            localStorage.setItem("onoma-personal-prosody", String(backup.personalProsody));
            setPersonalProsody(backup.personalProsody);
          }
          if (backup.voiceBlendActive !== undefined) {
            localStorage.setItem(
              "onoma-personal-voice-blend-active",
              String(backup.voiceBlendActive)
            );
            setVoiceBlendActive(
              backup.voiceBlendActive === "true" || backup.voiceBlendActive === true
            );
          }
          if (backup.voiceBlendPrimary !== undefined) {
            localStorage.setItem(
              "onoma-personal-voice-blend-primary",
              String(backup.voiceBlendPrimary)
            );
            setVoiceBlendPrimary(backup.voiceBlendPrimary);
          }
          if (backup.voiceBlendSecondary !== undefined) {
            localStorage.setItem(
              "onoma-personal-voice-blend-secondary",
              String(backup.voiceBlendSecondary)
            );
            setVoiceBlendSecondary(backup.voiceBlendSecondary);
          }
          if (backup.personalVoiceMap !== undefined) {
            localStorage.setItem("onoma-personal-voice-map", String(backup.personalVoiceMap));
            try {
              setPersonalVoiceMap(JSON.parse(backup.personalVoiceMap));
            } catch {
              setPersonalVoiceMap({});
            }
          }
          if (backup.personalPreset !== undefined) {
            localStorage.setItem("onoma-personal-preset", String(backup.personalPreset));
            setSelectedPreset(backup.personalPreset);
          }

          // Trigger update events
          window.dispatchEvent(new Event(OVERRIDES_UPDATED_EVENT));
          window.dispatchEvent(new Event("onoma-definitions-updated"));
          notify.success("Conlang settings imported successfully.");
        } else {
          notify.error("Invalid backup file format.");
        }
      } catch (err) {
        notify.error("Failed to parse backup file.");
      }
    };
    reader.readAsText(file);
  };

  // Reset/Clear conlang data
  const handleClearData = (key: "all" | "overrides" | "rules" | "definitions") => {
    if (typeof window === "undefined") return;
    if (key === "all" || key === "overrides") {
      localStorage.removeItem(NAME_OVERRIDES_KEY);
    }
    if (key === "all" || key === "rules") {
      localStorage.removeItem(PHONOLOGY_RULES_KEY);
    }
    if (key === "all" || key === "definitions") {
      localStorage.removeItem("onoma-lexicon-definitions");
    }
    window.dispatchEvent(new Event(OVERRIDES_UPDATED_EVENT));
    window.dispatchEvent(new Event("onoma-definitions-updated"));
    notify.success("Selected data cleared from this browser.");
  };

  const sandboxNormalized = ipaToKokoroPhonemes(sandboxIpa);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="border-border/40 space-y-1 border-b pb-3 text-left">
        <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
          <Sliders className="h-4 w-4 text-[#0091ff]" /> Onoma Preferences & Sandbox
        </h3>
        <p className="text-muted-foreground text-sm">
          Customize playback parameters, preview voices, and manage conlang dictionaries stored in
          this browser.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column: Preferences Card */}
        <div className="border-border/40 bg-secondary/5 space-y-4 rounded-xl border p-4 text-left">
          <h4 className="text-foreground text-xs font-bold tracking-wider uppercase">
            Voice Preferences
          </h4>
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
                  savePersonalPreferences(val === "default" ? "" : val, personalSpeed)
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
                onChange={(e) => savePersonalPreferences(personalVoice, Number(e.target.value))}
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
                      onChange={(e) => handleApplyPreset(e.target.value)}
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
                        handleUpdateAdvancedSetting(
                          "onoma-personal-force-native",
                          String(e.target.checked)
                        )
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
                      onChange={(e) =>
                        handleUpdateAdvancedSetting("onoma-personal-volume", e.target.value)
                      }
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
                      onChange={(e) =>
                        handleUpdateAdvancedSetting("onoma-personal-pitch", e.target.value)
                      }
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
                          handleUpdateAdvancedSetting(
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
                              handleUpdateAdvancedSetting(
                                "onoma-personal-voice-blend-primary",
                                e.target.value
                              )
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
                              handleUpdateAdvancedSetting(
                                "onoma-personal-voice-blend-secondary",
                                e.target.value
                              )
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
                      onChange={(e) =>
                        handleUpdateAdvancedSetting("onoma-personal-prosody", e.target.value)
                      }
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
                          handleUpdateAdvancedSetting(
                            "onoma-personal-anglicize",
                            String(e.target.checked)
                          )
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
                          handleUpdateAdvancedSetting(
                            "onoma-personal-strip-stress",
                            String(e.target.checked)
                          )
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
                          handleUpdateAdvancedSetting(
                            "onoma-personal-phoneme-prefix",
                            e.target.value
                          )
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
                        onChange={(e) =>
                          handleUpdateAdvancedSetting("onoma-personal-model", e.target.value)
                        }
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
                        onChange={(e) => handleUpdateCultureMap(c, e.target.value)}
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
                onClick={handleResetPreferences}
                className="border-border/60 bg-background text-muted-foreground hover:bg-secondary/40 flex items-center gap-1 rounded border px-2.5 py-1 text-[10px] font-bold transition-colors"
              >
                <RotateCcw className="h-3 w-3" /> Reset Preferences
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Voice Sandbox Card */}
        <div className="border-border/40 bg-secondary/5 space-y-4 rounded-xl border p-4 text-left">
          <div className="flex items-center justify-between">
            <h4 className="text-foreground text-xs font-bold tracking-wider uppercase">
              Voice Sandbox
            </h4>
            <span className="text-muted-foreground font-mono text-[10px]">
              {speechConfig?.kokoro?.enabled ? "Kokoro Active" : "Browser TTS fallback"}
            </span>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-muted-foreground text-[10px] font-bold uppercase">
                  Preview Text
                </label>
                <input
                  type="text"
                  value={sandboxText}
                  onChange={(e) => setSandboxText(e.target.value)}
                  placeholder="e.g. Imperia"
                  className="border-border/60 bg-background text-foreground w-full rounded-md border px-2 py-1 text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground text-[10px] font-bold uppercase">
                  Select Voice
                </label>
                <Select
                  value={sandboxVoice || "default"}
                  onValueChange={(val) => setSandboxVoice(val === "default" ? "" : val)}
                >
                  <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground flex w-full items-center justify-between rounded-md border px-2 py-1 text-xs transition-colors focus:outline-none">
                    <SelectValue placeholder="Default voice" />
                  </SelectTrigger>
                  <SelectContent className="border-border/40 bg-background/95 max-h-[250px] backdrop-blur-md">
                    <SelectItem
                      value="default"
                      className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                    >
                      Default voice
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
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-muted-foreground text-[10px] font-bold uppercase">
                  IPA Sound Transcribe
                </label>
                {speechConfig?.kokoro?.enabled &&
                  speechConfig?.kokoro?.engine === "kokoro-fastapi" && (
                    <button
                      type="button"
                      onClick={handleSuggestSandboxIpa}
                      disabled={suggestMutation.isPending}
                      className="flex cursor-pointer items-center gap-1 text-[9px] font-bold text-[#0091ff] select-none hover:underline disabled:opacity-50"
                    >
                      {suggestMutation.isPending ? (
                        <Loader2 className="h-2 w-2 animate-spin" />
                      ) : (
                        "Suggest IPA"
                      )}
                    </button>
                  )}
              </div>
              <input
                type="text"
                value={sandboxIpa}
                onChange={(e) => setSandboxIpa(e.target.value)}
                placeholder="/ˈimpeɾia/"
                className="border-border/60 bg-background text-foreground w-full rounded-md border px-2 py-1 font-mono text-xs focus:outline-none"
              />

              {/* Normalizer Preview & Warning */}
              {speechConfig?.kokoro?.enabled && (
                <div className="text-muted-foreground mt-1 space-y-0.5 font-mono text-[10px]">
                  <div className="flex justify-between">
                    <span>Phonemes: {sandboxNormalized.phonemes || "(empty)"}</span>
                    {sandboxNormalized.dropped.length > 0 && (
                      <span className="flex items-center gap-0.5 font-semibold text-amber-500">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        dropped: {sandboxNormalized.dropped.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handlePlaySandbox}
              disabled={isPlayingSandbox || !sandboxText}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0091ff] px-3 py-1.5 text-xs font-bold text-white transition-colors select-none hover:bg-[#33a7ff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPlayingSandbox ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
              <span>{isPlayingSandbox ? "Speaking..." : "Synthesize Sandbox"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Browser Conlang Data Manager */}
      <div className="border-border/40 bg-secondary/5 space-y-4 rounded-xl border p-4 text-left">
        <h4 className="text-foreground text-xs font-bold tracking-wider uppercase">
          Browser Conlang Data Manager
        </h4>
        <p className="text-muted-foreground text-[10px] leading-normal">
          All conlang dictionary definitions, custom pronunciation rules, and overrides are stored
          device-locally. Use these controls to backup, restore, or clear your data.
        </p>

        <div className="grid gap-3 pt-1 sm:grid-cols-3">
          {/* Backup / Export */}
          <button
            onClick={handleExportData}
            className="border-border/60 bg-background text-foreground hover:bg-secondary/40 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-[#0091ff]" /> Export Backup File
          </button>

          {/* Restore / Import */}
          <label className="border-border/60 bg-background text-foreground hover:bg-secondary/40 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors select-none">
            <Upload className="h-3.5 w-3.5 text-emerald-500" /> Import Backup File
            <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
          </label>

          {/* Clear Actions Dropdown / Selector */}
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                if (
                  confirm(
                    "Are you sure you want to delete all local conlang data? This cannot be undone."
                  )
                ) {
                  handleClearData("all");
                }
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsSection;
