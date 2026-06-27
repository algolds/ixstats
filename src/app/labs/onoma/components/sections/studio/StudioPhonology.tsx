"use client";

// src/app/labs/onoma/components/sections/studio/StudioPhonology.tsx
// Onoma Lab — IPA Studio: edit grapheme→IPA rules per culture, preview & play,
// and manage per-name pronunciation overrides. All customization is device-local
// (localStorage) via ~/lib/onoma/ipa-overrides.

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Volume2, Save, RotateCcw, AudioLines } from "lucide-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { translateToIPA, getCultureRules } from "~/lib/onoma/phonology";
import { speakName } from "~/lib/onoma/browser-speech";
import { ipaToKokoroPhonemes } from "~/lib/onoma/kokoro-phonemes";
import {
  getCultureRuleOverrides,
  setCultureRuleOverrides,
  getNameOverrides,
  setNameOverride,
  OVERRIDES_UPDATED_EVENT,
  type NameOverride,
} from "~/lib/onoma/ipa-overrides";

const CULTURES = [
  "latin",
  "germanic",
  "celtic",
  "slavic",
  "arabic",
  "east-asian",
  "austronesian",
  "constructed",
];

const ACCENT = "#8b5cf6";

export function StudioPhonology() {
  const notify = useNotify();
  const { data: speechConfig } = api.onoma.getSpeechConfig.useQuery(undefined, {
    staleTime: 600000,
  });

  const [culture, setCulture] = useState("latin");
  const [rows, setRows] = useState<[string, string][]>([]);
  const [previewText, setPreviewText] = useState("Imperia");
  const [nameOverrides, setNameOverrides] = useState<Record<string, NameOverride>>({});

  // Load this culture's saved rule overrides into editable state when it changes.
  useEffect(() => {
    setRows(getCultureRuleOverrides(culture));
  }, [culture]);

  // Keep the per-name override list in sync with localStorage.
  useEffect(() => {
    const refresh = () => setNameOverrides(getNameOverrides());
    refresh();
    window.addEventListener(OVERRIDES_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(OVERRIDES_UPDATED_EVENT, refresh);
  }, []);

  const baseRules = useMemo(() => getCultureRules(culture), [culture]);

  // Live preview reflects the current (possibly unsaved) edits.
  const previewIpa = useMemo(
    () =>
      translateToIPA(
        previewText,
        culture,
        rows.filter(([g]) => g.trim().length > 0)
      ),
    [previewText, culture, rows]
  );

  const updateRow = (i: number, idx: 0 | 1, value: string) => {
    setRows((prev) => {
      const next = prev.map((r) => [...r] as [string, string]);
      next[i][idx] = value;
      return next;
    });
  };

  const addRow = () => setRows((prev) => [...prev, ["", ""]]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, j) => j !== i));

  const saveRules = () => {
    setCultureRuleOverrides(culture, rows);
    notify.success(`Saved ${culture} pronunciation rules.`);
  };

  const resetRules = () => {
    setCultureRuleOverrides(culture, []);
    setRows([]);
    notify.success(`Reset ${culture} to built-in rules.`);
  };

  const play = async (text: string, ipa: string, voice?: string) => {
    if (!text.trim()) return;
    try {
      await speakName({
        name: text,
        ipa,
        culture,
        kokoroEnabled: Boolean(speechConfig?.kokoro?.enabled),
        voice,
        defaultVoice: speechConfig?.kokoro?.voice,
      });
    } catch (err) {
      console.error("Playback failed:", err);
      notify.error("Could not play this pronunciation.");
    }
  };

  const overrideNames = Object.keys(nameOverrides);

  return (
    <div className="space-y-5">
      <div className="border-border/40 space-y-1 border-b pb-3">
        <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
          <AudioLines className="h-4 w-4" style={{ color: ACCENT }} /> IPA Studio
        </h3>
        <p className="text-muted-foreground text-sm">
          Tune how letters map to sounds. Edits drive the pronunciation badges and the Read Naturally
          voice. Everything here is saved to this browser.
        </p>
      </div>

      {/* Live preview */}
      <div className="border-border/40 bg-secondary/5 space-y-2 rounded-xl border p-4">
        <label className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
          Live preview
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            placeholder="Type a word…"
            className="border-border/60 bg-background text-foreground w-44 rounded-lg border px-3 py-1.5 text-sm focus:outline-none"
          />
          <select
            value={culture}
            onChange={(e) => setCulture(e.target.value)}
            className="border-border/60 bg-background text-foreground rounded-lg border px-3 py-1.5 text-sm focus:outline-none"
          >
            {CULTURES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-2 font-mono text-sm text-muted-foreground">
            <span>{previewIpa}</span>
            {speechConfig?.kokoro?.enabled && (() => {
              const result = ipaToKokoroPhonemes(previewIpa);
              return (
                <span className="text-xs text-muted-foreground/80 flex items-center gap-1.5">
                  <span>→ {result.phonemes || "(empty)"}</span>
                  {result.dropped.length > 0 && (
                    <span className="text-amber-500 text-[10px] font-semibold">
                      ⚠ dropped: {result.dropped.join(", ")}
                    </span>
                  )}
                </span>
              );
            })()}
          </div>
          <button
            onClick={() => play(previewText, previewIpa)}
            title="Play preview"
            className="ml-auto flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: ACCENT }}
          >
            <Volume2 className="h-3.5 w-3.5" /> Play
          </button>
        </div>
      </div>

      {/* Rule editor */}
      <div className="border-border/40 space-y-3 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-foreground text-xs font-bold tracking-wider uppercase">
            {culture} grapheme → IPA overrides
          </h4>
          <div className="flex gap-1.5">
            <button
              onClick={resetRules}
              className="border-border/60 bg-background text-muted-foreground hover:bg-secondary/40 flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-bold transition-colors"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
            <button
              onClick={saveRules}
              className="flex items-center gap-1 rounded px-2.5 py-1 text-[10px] font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: ACCENT }}
            >
              <Save className="h-3 w-3" /> Save rules
            </button>
          </div>
        </div>

        <p className="text-muted-foreground text-[10px]">
          Overrides take priority over the built-in rules. Multi-letter graphemes (e.g.{" "}
          <span className="font-mono">sch</span>) are matched before single letters.
        </p>

        <div className="space-y-1.5">
          {rows.length === 0 && (
            <p className="text-muted-foreground py-2 text-center text-xs italic">
              No overrides — built-in {culture} rules apply. Add one below.
            </p>
          )}
          {rows.map(([g, ipa], i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={g}
                onChange={(e) => updateRow(i, 0, e.target.value)}
                placeholder="grapheme"
                className="border-border/60 bg-background text-foreground w-28 rounded-lg border px-2 py-1 font-mono text-xs focus:outline-none"
              />
              <span className="text-muted-foreground text-xs">→</span>
              <input
                value={ipa}
                onChange={(e) => updateRow(i, 1, e.target.value)}
                placeholder="IPA"
                className="border-border/60 bg-background text-foreground w-28 rounded-lg border px-2 py-1 font-mono text-xs focus:outline-none"
              />
              <button
                onClick={() => removeRow(i)}
                title="Remove rule"
                className="text-muted-foreground cursor-pointer rounded p-1 hover:text-rose-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={addRow}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 pt-1 text-[11px] font-bold"
          >
            <Plus className="h-3.5 w-3.5" /> Add rule
          </button>
        </div>

        {/* Built-in reference */}
        <details className="border-border/30 border-t pt-2">
          <summary className="text-muted-foreground cursor-pointer text-[10px] font-bold tracking-wider uppercase">
            Built-in {culture} rules (reference)
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {baseRules.map(([g, ipa], i) => (
              <span
                key={i}
                className="border-border/40 bg-secondary/10 text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-[10px]"
              >
                {g} → {ipa || "∅"}
              </span>
            ))}
          </div>
        </details>
      </div>

      {/* Per-name overrides */}
      <div className="border-border/40 space-y-2 rounded-xl border p-4">
        <h4 className="text-foreground text-xs font-bold tracking-wider uppercase">
          Per-name overrides
        </h4>
        {overrideNames.length === 0 ? (
          <p className="text-muted-foreground text-xs italic">
            None yet. Use the pencil on any generated name to set a custom IPA or voice.
          </p>
        ) : (
          <div className="divide-border/20 divide-y">
            {overrideNames.map((name) => {
              const ov = nameOverrides[name];
              return (
                <div key={name} className="flex items-center gap-2 py-1.5 text-xs">
                  <span className="text-foreground font-semibold">{name}</span>
                  {ov.ipa && <span className="text-muted-foreground font-mono">{ov.ipa}</span>}
                  {ov.voice && (
                    <span className="text-muted-foreground rounded bg-secondary/20 px-1.5 py-0.5 font-mono text-[10px]">
                      {ov.voice}
                    </span>
                  )}
                  <button
                    onClick={() => play(name, ov.ipa ?? translateToIPA(name, culture), ov.voice)}
                    title="Play"
                    className="text-muted-foreground ml-auto cursor-pointer rounded p-1 hover:text-[color:var(--accent)]"
                    style={{ ["--accent" as string]: ACCENT }}
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setNameOverride(name, { ipa: undefined, voice: undefined })}
                    title="Clear override"
                    className="text-muted-foreground cursor-pointer rounded p-1 hover:text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default StudioPhonology;
