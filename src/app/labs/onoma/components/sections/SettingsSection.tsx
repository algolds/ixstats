"use client";

// src/app/labs/onoma/components/sections/SettingsSection.tsx
// Onoma Lab — User Voice Settings, Interactive Sandbox, & Local Browser Data Manager

import React, { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  VoicePreferencesPanel,
  VOICE_LABELS,
  SPECIES_PRESETS,
} from "./settings/VoicePreferencesPanel";
import { VoiceSandboxPanel } from "./settings/VoiceSandboxPanel";
import { ConlangDataManagerPanel } from "./settings/ConlangDataManagerPanel";

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

    if (SPECIES_PRESETS[presetName]) {
      const p = SPECIES_PRESETS[presetName];
      savePersonalPreferences(p.voice, p.speed);
      handleUpdateAdvancedSetting("onoma-personal-volume", p.volume);
      handleUpdateAdvancedSetting("onoma-personal-pitch", p.pitch);
      handleUpdateAdvancedSetting("onoma-personal-anglicize", p.anglicize);
      handleUpdateAdvancedSetting("onoma-personal-phoneme-prefix", p.phonemePrefix);
      handleUpdateAdvancedSetting("onoma-personal-strip-stress", p.stripStress);
      handleUpdateAdvancedSetting("onoma-personal-prosody", p.prosody);
      handleUpdateAdvancedSetting("onoma-personal-voice-blend-active", p.blendActive);
      notify.success(
        `Applied ${presetName.charAt(0).toUpperCase() + presetName.slice(1)} voice preset.`
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

  const handleImportComplete = (backup: any) => {
    if (backup.personalVoice !== undefined) setPersonalVoice(backup.personalVoice);
    if (backup.personalSpeed !== undefined) setPersonalSpeed(Number(backup.personalSpeed));
    if (backup.personalForceNative !== undefined)
      setForceNative(backup.personalForceNative === "true" || backup.personalForceNative === true);
    if (backup.personalVolume !== undefined) setPersonalVolume(Number(backup.personalVolume));
    if (backup.personalPitch !== undefined) setPersonalPitch(Number(backup.personalPitch));
    if (backup.personalAnglicize !== undefined)
      setPersonalAnglicize(backup.personalAnglicize !== "false");
    if (backup.personalPhonemePrefix !== undefined)
      setPersonalPhonemePrefix(backup.personalPhonemePrefix);
    if (backup.personalStripStress !== undefined)
      setPersonalStripStress(backup.personalStripStress === "true");
    if (backup.personalModel !== undefined) setPersonalModel(backup.personalModel);
    if (backup.personalProsody !== undefined) setPersonalProsody(backup.personalProsody);
    if (backup.voiceBlendActive !== undefined)
      setVoiceBlendActive(backup.voiceBlendActive === "true");
    if (backup.voiceBlendPrimary !== undefined) setVoiceBlendPrimary(backup.voiceBlendPrimary);
    if (backup.voiceBlendSecondary !== undefined)
      setVoiceBlendSecondary(backup.voiceBlendSecondary);
    if (backup.personalVoiceMap !== undefined) {
      try {
        setPersonalVoiceMap(JSON.parse(backup.personalVoiceMap));
      } catch {
        setPersonalVoiceMap({});
      }
    }
    if (backup.personalPreset !== undefined) setSelectedPreset(backup.personalPreset);
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column: Preferences Card */}
        <VoicePreferencesPanel
          voiceOptions={voiceOptions}
          personalVoice={personalVoice}
          personalSpeed={personalSpeed}
          forceNative={forceNative}
          personalVolume={personalVolume}
          personalPitch={personalPitch}
          personalAnglicize={personalAnglicize}
          personalPhonemePrefix={personalPhonemePrefix}
          personalStripStress={personalStripStress}
          personalModel={personalModel}
          personalVoiceMap={personalVoiceMap}
          personalProsody={personalProsody}
          voiceBlendActive={voiceBlendActive}
          voiceBlendPrimary={voiceBlendPrimary}
          voiceBlendSecondary={voiceBlendSecondary}
          selectedPreset={selectedPreset}
          onSavePreferences={savePersonalPreferences}
          onUpdateAdvanced={handleUpdateAdvancedSetting}
          onUpdateCultureMap={handleUpdateCultureMap}
          onApplyPreset={handleApplyPreset}
          onResetPreferences={handleResetPreferences}
        />

        {/* Right Column: Voice Sandbox Card */}
        <VoiceSandboxPanel voiceOptions={voiceOptions} speechConfig={speechConfig} />
      </div>

      {/* Browser Conlang Data Manager */}
      <ConlangDataManagerPanel onImportComplete={handleImportComplete} />
    </div>
  );
}

export default SettingsSection;
