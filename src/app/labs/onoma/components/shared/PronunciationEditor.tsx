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
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";

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
      className="border-separator animate-in slide-in-from-top-1 bg-tint/5 rounded-row relative z-10 w-full space-y-2 border p-3 text-left duration-200"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-label text-subhead">Customize pronunciation</h4>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onCancel}
          title="Close"
          aria-label="Close"
          className="text-label-secondary hover:text-tint"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-0.5">
        <div className="flex items-center justify-between">
          <label className="text-label-secondary text-subhead">
            IPA (drives Read Naturally phonemes)
          </label>
          {speechConfig?.kokoro?.enabled && speechConfig?.kokoro?.engine === "kokoro-fastapi" && (
            <Button
              variant="link"
              size="sm"
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
              className="text-tint h-auto px-0"
            >
              {suggestMutation.isPending ? "Suggesting..." : "Suggest IPA"}
            </Button>
          )}
        </div>
        <Input
          type="text"
          value={ipaDraft}
          onChange={(e) => setIpaDraft(e.target.value)}
          placeholder="/ˈeksɑːmpl/"
          className="text-footnote w-full font-mono"
        />
        {speechConfig?.kokoro?.enabled &&
          (() => {
            const result = ipaToKokoroPhonemes(ipaDraft);
            return (
              <div className="text-label-secondary text-caption mt-1 flex flex-wrap gap-1 font-mono">
                <span>Phonemes: {result.phonemes || "(empty)"}</span>
                {result.dropped.length > 0 && (
                  <span className="text-yellow font-semibold">
                    (dropped: {result.dropped.join(", ")})
                  </span>
                )}
              </div>
            );
          })()}
      </div>

      <div className="space-y-0.5">
        <label className="text-label-secondary text-subhead">Voice</label>
        <Select
          value={voiceDraft || "default"}
          onValueChange={(val) => setVoiceDraft(val === "default" ? "" : val)}
        >
          <SelectTrigger className="text-footnote w-full">
            <SelectValue placeholder="Default / culture voice" />
          </SelectTrigger>
          <SelectContent className="max-h-[200px]">
            <SelectItem value="default" className="text-footnote">
              Default / culture voice
            </SelectItem>
            {(voicesData?.voices ?? []).map((v) => (
              <SelectItem key={v} value={v} className="text-footnote">
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <Button variant="outline" size="sm" onClick={onReset} title="Reset to defaults">
          <RotateCcw className="h-3 w-3" /> Reset
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onPreview}>
            <Volume2 className="h-3 w-3" /> Preview
          </Button>
          <Button size="sm" onClick={onSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PronunciationEditor;
