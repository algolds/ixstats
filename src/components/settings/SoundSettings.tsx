// src/components/settings/SoundSettings.tsx
// Sound settings panel with volume controls and sound previews

"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Volume2, VolumeX, Play, RotateCcw } from "lucide-react";
import { CometCard } from "~/components/ui/comet-card";
import { Button } from "~/components/ui/button";
import { getSoundService } from "~/lib/sound-service";
import type { SoundEffect } from "~/lib/sound-service";
import { cn } from "~/lib/utils";

/**
 * Sound settings panel props
 */
export interface SoundSettingsProps {
  className?: string;
}

/**
 * Sound categories for organization
 */
const SOUND_CATEGORIES = {
  "Pack Opening": ["pack-open", "card-flip"] as SoundEffect[],
  "Card Interaction": ["card-hover", "card-select"] as SoundEffect[],
  "Card Reveals": [
    "common-reveal",
    "rare-reveal",
    "epic-reveal",
    "legendary-reveal",
  ] as SoundEffect[],
  Marketplace: ["auction-bid"] as SoundEffect[],
  Crafting: ["craft-success", "craft-fail"] as SoundEffect[],
  Trading: ["trade-complete"] as SoundEffect[],
};

/**
 * Sound display names
 */
const SOUND_NAMES: Record<SoundEffect, string> = {
  "pack-open": "Pack Opening",
  "card-flip": "Card Flip",
  "card-hover": "Card Hover",
  "card-select": "Card Select",
  "common-reveal": "Common/Uncommon Reveal",
  "rare-reveal": "Rare/Ultra Rare Reveal",
  "epic-reveal": "Epic Reveal",
  "legendary-reveal": "Legendary Reveal",
  "auction-bid": "Bid Placed",
  "craft-success": "Crafting Success",
  "craft-fail": "Crafting Failed",
  "trade-complete": "Trade Complete",
};

/**
 * VolumeSlider - Reusable volume slider component
 */
interface VolumeSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  icon?: React.ReactNode;
  className?: string;
}

const VolumeSlider: React.FC<VolumeSliderProps> = ({
  label,
  value,
  onChange,
  icon,
  className,
}) => {
  const percentage = Math.round(value * 100);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-white/90">
          {icon}
          <span>{label}</span>
        </div>
        <span className="text-sm font-mono text-white/60">{percentage}%</span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-white/10">
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
          style={{ width: `${percentage}%` }}
          initial={false}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.2 }}
        />
        <input
          type="range"
          min="0"
          max="100"
          value={percentage}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="absolute inset-0 w-full cursor-pointer opacity-0"
          aria-label={label}
        />
      </div>
    </div>
  );
};

/**
 * SoundSettings - Sound controls panel
 *
 * Features:
 * - Master volume control
 * - SFX volume control
 * - Music volume control (for future use)
 * - Individual sound previews
 * - Mute/unmute individual sounds
 * - Reset to defaults
 * - Settings persistence via localStorage
 *
 * @example
 * ```tsx
 * <SoundSettings className="max-w-2xl" />
 * ```
 */
export const SoundSettings: React.FC<SoundSettingsProps> = ({ className }) => {
  const soundService = getSoundService();
  const [settings, setSettings] = useState(soundService.getSettings());
  const [playingSound, setPlayingSound] = useState<SoundEffect | null>(null);

  // Update settings when they change in the service
  useEffect(() => {
    const interval = setInterval(() => {
      const newSettings = soundService.getSettings();
      setSettings(newSettings);
    }, 500);

    return () => clearInterval(interval);
  }, [soundService]);

  /**
   * Handle master volume change
   */
  const handleMasterVolumeChange = (value: number) => {
    soundService.setMasterVolume(value);
    setSettings(soundService.getSettings());
  };

  /**
   * Handle SFX volume change
   */
  const handleSfxVolumeChange = (value: number) => {
    soundService.setSfxVolume(value);
    setSettings(soundService.getSettings());
  };

  /**
   * Handle music volume change
   */
  const handleMusicVolumeChange = (value: number) => {
    soundService.setMusicVolume(value);
    setSettings(soundService.getSettings());
  };

  /**
   * Handle enable/disable toggle
   */
  const handleToggleEnabled = () => {
    soundService.setEnabled(!settings.enabled);
    setSettings(soundService.getSettings());
  };

  /**
   * Handle sound preview
   */
  const handlePreviewSound = (sound: SoundEffect) => {
    setPlayingSound(sound);
    soundService.preview(sound);
    setTimeout(() => setPlayingSound(null), 1000);
  };

  /**
   * Handle sound mute toggle
   */
  const handleToggleSoundMute = (sound: SoundEffect) => {
    soundService.toggleSoundMute(sound);
    setSettings(soundService.getSettings());
  };

  /**
   * Handle reset to defaults
   */
  const handleReset = () => {
    soundService.resetSettings();
    setSettings(soundService.getSettings());
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Sound Settings</h2>
          <p className="mt-1 text-sm text-white/60">
            Customize audio experience for IxCards
          </p>
        </div>
        <Button
          onClick={handleToggleEnabled}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          {settings.enabled ? (
            <>
              <Volume2 className="h-4 w-4" />
              Enabled
            </>
          ) : (
            <>
              <VolumeX className="h-4 w-4" />
              Muted
            </>
          )}
        </Button>
      </div>

      {/* Volume Controls */}
      <CometCard
        /* depth="parent" */
        className="p-6"
      >
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Volume Controls</h3>

          <VolumeSlider
            label="Master Volume"
            value={settings.masterVolume}
            onChange={handleMasterVolumeChange}
            icon={<Volume2 className="h-4 w-4" />}
          />

          <VolumeSlider
            label="Sound Effects"
            value={settings.sfxVolume}
            onChange={handleSfxVolumeChange}
          />

          <VolumeSlider
            label="Music (Future)"
            value={settings.musicVolume}
            onChange={handleMusicVolumeChange}
          />
        </div>
      </CometCard>

      {/* Individual Sound Controls */}
      <CometCard
        /* depth="parent" */
        className="p-6"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              Individual Sounds
            </h3>
            <Button
              onClick={handleReset}
              variant="ghost"
              size="sm"
              className="gap-2 text-white/60 hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
              Reset All
            </Button>
          </div>

          {Object.entries(SOUND_CATEGORIES).map(([category, sounds]) => (
            <div key={category} className="space-y-2">
              <h4 className="text-sm font-medium text-white/70">{category}</h4>
              <div className="space-y-1">
                {sounds.map((sound) => {
                  const isMuted = settings.mutedSounds.has(sound);
                  const isPlaying = playingSound === sound;

                  return (
                    <div
                      key={sound}
                      className="flex items-center justify-between rounded-lg bg-white/5 p-3 transition-colors hover:bg-white/10"
                    >
                      <span className="text-sm text-white/90">
                        {SOUND_NAMES[sound]}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handlePreviewSound(sound)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={!settings.enabled || isMuted}
                        >
                          <Play
                            className={cn(
                              "h-4 w-4",
                              isPlaying && "animate-pulse text-blue-400"
                            )}
                          />
                        </Button>
                        <Button
                          onClick={() => handleToggleSoundMute(sound)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          {isMuted ? (
                            <VolumeX className="h-4 w-4 text-red-400" />
                          ) : (
                            <Volume2 className="h-4 w-4 text-white/60" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CometCard>

      {/* Info */}
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-white/70">
        <p>
          <strong className="text-white/90">Note:</strong> Sound files are
          optional. If sounds are missing, the system will gracefully fall back
          to silent mode without affecting functionality.
        </p>
      </div>
    </div>
  );
};
