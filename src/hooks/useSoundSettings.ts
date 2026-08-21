"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getStoredSoundSettings,
  setSoundEnabled as applySoundEnabled,
  setSoundVolume as applySoundVolume,
  playSound,
  sounds,
  type SoundName,
} from "~/lib/sound/cuelume";

export interface SoundSettingsState {
  enabled: boolean;
  volume: number;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  toggleEnabled: () => void;
  previewSound: (name: SoundName) => void;
  sounds: readonly SoundName[];
}

export function useSoundSettings(): SoundSettingsState {
  const [settings, setSettings] = useState<{ enabled: boolean; volume: number }>(() =>
    getStoredSoundSettings()
  );

  useEffect(() => {
    // Initial sync
    setSettings(getStoredSoundSettings());

    const handleSettingsChange = () => {
      setSettings(getStoredSoundSettings());
    };

    window.addEventListener("ixstates-sound-settings-changed", handleSettingsChange);
    return () => {
      window.removeEventListener("ixstates-sound-settings-changed", handleSettingsChange);
    };
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    applySoundEnabled(enabled);
    setSettings((prev) => ({ ...prev, enabled }));
  }, []);

  const toggleEnabled = useCallback(() => {
    setEnabled(!settings.enabled);
  }, [setEnabled, settings.enabled]);

  const setVolume = useCallback((volume: number) => {
    applySoundVolume(volume);
    setSettings((prev) => ({ ...prev, volume }));
  }, []);

  const previewSound = useCallback(
    (name: SoundName) => {
      playSound(name, { volume: settings.volume });
    },
    [settings.volume]
  );

  return {
    enabled: settings.enabled,
    volume: settings.volume,
    setEnabled,
    setVolume,
    toggleEnabled,
    previewSound,
    sounds,
  };
}
