"use client";

// src/app/labs/onoma/components/sections/settings/ConlangDataManagerPanel.tsx
// Local storage data management, backup export, restore import, cache clearer

import React from "react";
import { Download, Upload, Trash as Trash2 } from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import {
  NAME_OVERRIDES_KEY,
  PHONOLOGY_RULES_KEY,
  OVERRIDES_UPDATED_EVENT,
} from "~/lib/onoma/ipa-overrides";

interface ConlangDataManagerPanelProps {
  onImportComplete: (backup: any) => void;
}

export function ConlangDataManagerPanel({ onImportComplete }: ConlangDataManagerPanelProps) {
  const notify = useNotify();

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
          }
          if (backup.personalSpeed !== undefined) {
            localStorage.setItem("onoma-personal-speed", String(backup.personalSpeed));
          }
          if (backup.personalForceNative !== undefined) {
            localStorage.setItem("onoma-personal-force-native", String(backup.personalForceNative));
          }
          if (backup.personalVolume !== undefined) {
            localStorage.setItem("onoma-personal-volume", String(backup.personalVolume));
          }
          if (backup.personalPitch !== undefined) {
            localStorage.setItem("onoma-personal-pitch", String(backup.personalPitch));
          }
          if (backup.personalAnglicize !== undefined) {
            localStorage.setItem("onoma-personal-anglicize", String(backup.personalAnglicize));
          }
          if (backup.personalPhonemePrefix !== undefined) {
            localStorage.setItem(
              "onoma-personal-phoneme-prefix",
              String(backup.personalPhonemePrefix)
            );
          }
          if (backup.personalStripStress !== undefined) {
            localStorage.setItem("onoma-personal-strip-stress", String(backup.personalStripStress));
          }
          if (backup.personalModel !== undefined) {
            localStorage.setItem("onoma-personal-model", String(backup.personalModel));
          }
          if (backup.personalProsody !== undefined) {
            localStorage.setItem("onoma-personal-prosody", String(backup.personalProsody));
          }
          if (backup.voiceBlendActive !== undefined) {
            localStorage.setItem(
              "onoma-personal-voice-blend-active",
              String(backup.voiceBlendActive)
            );
          }
          if (backup.voiceBlendPrimary !== undefined) {
            localStorage.setItem(
              "onoma-personal-voice-blend-primary",
              String(backup.voiceBlendPrimary)
            );
          }
          if (backup.voiceBlendSecondary !== undefined) {
            localStorage.setItem(
              "onoma-personal-voice-blend-secondary",
              String(backup.voiceBlendSecondary)
            );
          }
          if (backup.personalVoiceMap !== undefined) {
            localStorage.setItem("onoma-personal-voice-map", String(backup.personalVoiceMap));
          }
          if (backup.personalPreset !== undefined) {
            localStorage.setItem("onoma-personal-preset", String(backup.personalPreset));
          }

          onImportComplete(backup);

          // Trigger update events
          window.dispatchEvent(new Event(OVERRIDES_UPDATED_EVENT));
          window.dispatchEvent(new Event("onoma-definitions-updated"));
          notify.success("Conlang settings imported successfully.");
        } else {
          notify.error("Invalid backup file format.");
        }
      } catch {
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

  return (
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
          className="border-border/60 bg-background text-foreground hover:bg-secondary/40 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer"
        >
          <Download className="h-3.5 w-3.5 text-onoma-primary" /> Export Backup File
        </button>

        {/* Restore / Import */}
        <label className="border-border/60 bg-background text-foreground hover:bg-secondary/40 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors select-none">
          <Upload className="h-3.5 w-3.5 text-emerald-500" /> Import Backup File
          <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
        </label>

        {/* Clear Actions */}
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
          className="flex items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-500/10 cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear All Data
        </button>
      </div>
    </div>
  );
}
