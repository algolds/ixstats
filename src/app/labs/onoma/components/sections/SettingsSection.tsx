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
} from "lucide-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
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
    notify.success("Voice preferences updated successfully.");
  };

  const handleResetPreferences = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("onoma-personal-voice");
    localStorage.removeItem("onoma-personal-speed");
    setPersonalVoice("");
    setPersonalSpeed(1.0);
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
              <Select value={personalVoice || "default"} onValueChange={(val) => savePersonalPreferences(val === "default" ? "" : val, personalSpeed)}>
                <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground w-full rounded-md border px-2 py-1.5 text-xs focus:outline-none flex justify-between items-center transition-colors">
                  <SelectValue placeholder="Use system default" />
                </SelectTrigger>
                <SelectContent className="border-border/40 bg-background/95 backdrop-blur-md max-h-[250px]">
                  <SelectItem value="default" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">Use system default</SelectItem>
                  {voiceOptions.map((id) => (
                    <SelectItem key={id} value={id} className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
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

            <button
              onClick={handleResetPreferences}
              className="border-border/60 bg-background text-muted-foreground hover:bg-secondary/40 flex items-center gap-1 rounded border px-2.5 py-1 text-[10px] font-bold transition-colors"
            >
              <RotateCcw className="h-3 w-3" /> Reset Preferences
            </button>
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
                <Select value={sandboxVoice || "default"} onValueChange={(val) => setSandboxVoice(val === "default" ? "" : val)}>
                  <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground w-full rounded-md border px-2 py-1 text-xs focus:outline-none flex justify-between items-center transition-colors">
                    <SelectValue placeholder="Default voice" />
                  </SelectTrigger>
                  <SelectContent className="border-border/40 bg-background/95 backdrop-blur-md max-h-[250px]">
                    <SelectItem value="default" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">Default voice</SelectItem>
                    {voiceOptions.map((id) => (
                      <SelectItem key={id} value={id} className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
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
