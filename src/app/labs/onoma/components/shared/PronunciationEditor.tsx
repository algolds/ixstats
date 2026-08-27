"use client";

// src/app/labs/onoma/components/shared/PronunciationEditor.tsx
// Onoma Custom Studio Workshop — Pronunciation Editor Component

import { Xmark as X, Undo as RotateCcw, SoundHigh as Volume2 } from "iconoir-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { ipaToKokoroPhonemes } from "~/lib/onoma/kokoro-phonemes";

interface PronunciationEditorProps {
  name: string;
  ipaDraft: string;
  setIpaDraft: (val: string) => void;
  voiceDraft: string;
  setVoiceDraft: (val: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onPreview: () => void;
  onReset: () => void;
}

export function PronunciationEditor({
  name,
  ipaDraft,
  setIpaDraft,
  voiceDraft,
  setVoiceDraft,
  onSave,
  onCancel,
  onPreview,
  onReset,
}: PronunciationEditorProps) {
  const notify = useNotify();

  // Load public speech config (including Kokoro settings)
  const { data: speechConfig } = api.onoma.getSpeechConfig.useQuery(undefined, {
    staleTime: 600000,
  });
  const { data: voicesData } = api.onoma.getKokoroVoices.useQuery(undefined, {
    staleTime: 600000,
  });
  const suggestMutation = api.onoma.suggestPhonemes.useMutation();

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="border-border/20 animate-in slide-in-from-top-1 bg-onoma-primary/[0.02] relative z-10 w-full space-y-2.5 rounded-xl border p-3 text-left duration-200"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-foreground text-[10px] font-bold tracking-wider uppercase">
          Customize Pronunciation
        </h4>
        <button
          onClick={onCancel}
          title="Close"
          className="text-muted-foreground hover:text-onoma-primary cursor-pointer rounded p-0.5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-0.5">
        <div className="flex items-center justify-between">
          <label className="text-muted-foreground text-[8px] font-bold uppercase">
            IPA (drives Read Naturally phonemes)
          </label>
          {speechConfig?.kokoro?.enabled && speechConfig?.kokoro?.engine === "kokoro-fastapi" && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await suggestMutation.mutateAsync({ text: name });
                  if (res.phonemes) {
                    setIpaDraft(res.phonemes);
                    notify.success("Suggested IPA loaded.");
                  } else {
                    notify.error("Could not generate IPA suggestion.");
                  }
                } catch (err: any) {
                  notify.error(err.message || "Failed to fetch suggestion.");
                }
              }}
              disabled={suggestMutation.isPending}
              className="text-onoma-primary flex cursor-pointer items-center gap-1 text-[8px] font-bold select-none hover:underline disabled:opacity-50"
            >
              {suggestMutation.isPending ? "Suggesting..." : "Suggest IPA"}
            </button>
          )}
        </div>
        <input
          type="text"
          value={ipaDraft}
          onChange={(e) => setIpaDraft(e.target.value)}
          placeholder="/ˈeksɑːmpl/"
          className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2 py-1 font-mono text-xs focus:outline-none"
        />
        {speechConfig?.kokoro?.enabled &&
          (() => {
            const result = ipaToKokoroPhonemes(ipaDraft);
            return (
              <div className="text-muted-foreground mt-1 flex flex-wrap gap-1 font-mono text-[9px]">
                <span>Phonemes: {result.phonemes || "(empty)"}</span>
                {result.dropped.length > 0 && (
                  <span className="font-semibold text-amber-500">
                    (dropped: {result.dropped.join(", ")})
                  </span>
                )}
              </div>
            );
          })()}
      </div>

      <div className="space-y-0.5">
        <label className="text-muted-foreground text-[8px] font-bold uppercase">Voice</label>
        <Select
          value={voiceDraft || "default"}
          onValueChange={(val) => setVoiceDraft(val === "default" ? "" : val)}
        >
          <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground flex w-full items-center justify-between rounded-lg border px-2 py-1 text-xs transition-colors focus:outline-none">
            <SelectValue placeholder="Default / culture voice" />
          </SelectTrigger>
          <SelectContent className="border-border/40 bg-background/95 max-h-[200px] backdrop-blur-md">
            <SelectItem
              value="default"
              className="focus:text-foreground focus:bg-onoma-primary/10 text-xs"
            >
              Default / culture voice
            </SelectItem>
            {(voicesData?.voices ?? []).map((v) => (
              <SelectItem
                key={v}
                value={v}
                className="focus:text-foreground focus:bg-onoma-primary/10 text-xs"
              >
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-1.5 pt-0.5">
        <button
          onClick={onReset}
          title="Reset to defaults"
          className="border-border/60 bg-background text-muted-foreground hover:bg-secondary/40 flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-bold transition-colors"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
        <div className="flex gap-1.5">
          <button
            onClick={onPreview}
            className="border-border/60 bg-background text-muted-foreground hover:bg-secondary/40 flex items-center gap-1 rounded border px-2 py-0.5 text-[9px] font-bold transition-colors"
          >
            <Volume2 className="h-3 w-3" /> Preview
          </button>
          <button
            onClick={onSave}
            className="bg-onoma-primary hover:bg-onoma-primary-light rounded px-2.5 py-0.5 text-[9px] font-bold text-white transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default PronunciationEditor;
