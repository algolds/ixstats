"use client";

// src/app/labs/onoma/components/sections/settings/VoiceSandboxPanel.tsx
// Interactive audio sandbox, IPA synthesis testbed, G2P phoneme suggester

import React, { useState, useEffect } from "react";
import { SoundHigh as Volume2, WarningTriangle as AlertTriangle, SystemRestart as Loader2, Refresh as RefreshCw } from "iconoir-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { speakName } from "~/lib/onoma/browser-speech";
import { translateToIPA } from "~/lib/onoma/phonology";
import { ipaToKokoroPhonemes } from "~/lib/onoma/kokoro-phonemes";
import { voiceLabel } from "./VoicePreferencesPanel";

interface VoiceSandboxPanelProps {
  voiceOptions: string[];
  speechConfig: any;
}

export function VoiceSandboxPanel({ voiceOptions, speechConfig }: VoiceSandboxPanelProps) {
  const notify = useNotify();

  const [sandboxText, setSandboxText] = useState("Imperia");
  const [sandboxIpa, setSandboxIpa] = useState("");
  const [sandboxVoice, setSandboxVoice] = useState("");
  const [isPlayingSandbox, setIsPlayingSandbox] = useState(false);

  const suggestMutation = api.onoma.suggestPhonemes.useMutation();

  // Update sandbox IPA automatically when sandboxText changes
  useEffect(() => {
    setSandboxIpa(translateToIPA(sandboxText, "latin"));
  }, [sandboxText]);

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

  const sandboxNormalized = ipaToKokoroPhonemes(sandboxIpa);

  return (
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
                  className="focus:text-foreground text-xs focus:bg-onoma-primary/10"
                >
                  Default voice
                </SelectItem>
                {voiceOptions.map((id) => (
                  <SelectItem
                    key={id}
                    value={id}
                    className="focus:text-foreground text-xs focus:bg-onoma-primary/10"
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
                  className="flex cursor-pointer items-center gap-1 text-[9px] font-bold text-onoma-primary select-none hover:underline disabled:opacity-50"
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
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-onoma-primary px-3 py-1.5 text-xs font-bold text-white transition-colors select-none hover:bg-onoma-primary-light disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          {isPlayingSandbox ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Volume2 className="h-3.5 w-3.5" />
          )}
          <span>{isPlayingSandbox ? "Speaking..." : "Preview Voice"}</span>
        </button>
      </div>
    </div>
  );
}
