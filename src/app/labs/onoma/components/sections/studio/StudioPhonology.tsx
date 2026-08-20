"use client";

// src/app/labs/onoma/components/sections/studio/StudioPhonology.tsx
// Onoma Lab — IPA Studio: edit grapheme→IPA rules per culture, preview & play,
// and manage per-name pronunciation overrides. All customization is device-local
// (localStorage) via ~/lib/onoma/ipa-overrides.

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Volume2, Save, RotateCcw, AudioLines, X, GitCompare } from "lucide-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { translateToIPA, getCultureRules, segmentGraphemes } from "~/lib/onoma/phonology";
import { speakName } from "~/lib/onoma/browser-speech";
import { ipaToKokoroPhonemes, KOKORO_VALID_TOKENS } from "~/lib/onoma/kokoro-phonemes";
import { cn } from "~/lib/utils";
import { AcousticFormantVisualizer } from "./AcousticFormantVisualizer";
import ComparatorSection from "../ComparatorSection";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  getCultureRuleOverrides,
  setCultureRuleOverrides,
  getNameOverrides,
  setNameOverride,
  OVERRIDES_UPDATED_EVENT,
  type NameOverride,
} from "~/lib/onoma/ipa-overrides";
import { getAllTemplateLinguisticProfiles } from "~/lib/onoma/template-phonetics";
import {
  IPA_VOWELS,
  IPA_CONSONANTS,
  IPA_DIPHTHONGS,
  STANDARD_CULTURES as CULTURES,
} from "~/lib/onoma/phonetics-shared";

const ACCENT = "#8b5cf6";

interface StudioPhonologyProps {
  studioWords?: string[];
}

export function StudioPhonology({ studioWords = [] }: StudioPhonologyProps = {}) {
  const notify = useNotify();
  const { data: speechConfig } = api.onoma.getSpeechConfig.useQuery(undefined, {
    staleTime: 600000,
  });

  const [culture, setCulture] = useState("latin");
  const [rows, setRows] = useState<[string, string][]>([]);
  const [previewText, setPreviewText] = useState(studioWords[0] || "Imperia");
  const [nameOverrides, setNameOverrides] = useState<Record<string, NameOverride>>({});
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);
  const [soundboardTab, setSoundboardTab] = useState<"vowels" | "consonants" | "diphthongs">(
    "vowels"
  );
  const [selectedSound, setSelectedSound] = useState<string | null>(null);

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

  const segments = useMemo(() => {
    return segmentGraphemes(
      previewText,
      culture,
      rows.filter(([g]) => g.trim().length > 0)
    );
  }, [previewText, culture, rows]);

  // Clean active popover if previewText changes length/segments
  useEffect(() => {
    setActiveSegmentIndex(null);
    setSelectedSound(null);
  }, [previewText, culture]);

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

  const playPhoneme = async (symbol: string) => {
    try {
      await speakName({
        name: "sound",
        ipa: `/${symbol}/`,
        culture: "constructed",
        kokoroEnabled: Boolean(speechConfig?.kokoro?.enabled),
        defaultVoice: speechConfig?.kokoro?.voice,
      });
    } catch (err) {
      console.error("Phoneme playback failed:", err);
    }
  };

  const mapGrapheme = (grapheme: string, symbol: string) => {
    setRows((prev) => {
      let next = prev.map((r) => [...r] as [string, string]);
      const idx = next.findIndex(([g]) => g === grapheme);
      if (idx !== -1) {
        next[idx][1] = symbol;
      } else {
        next = [[grapheme, symbol], ...next];
      }
      setCultureRuleOverrides(culture, next);
      return next;
    });
    notify.success(`Mapped "${grapheme}" → /${symbol}/`);
    setActiveSegmentIndex(null);
  };

  const [activeMode, setActiveMode] = useState<"matrix" | "comparison">("matrix");

  const overrideNames = Object.keys(nameOverrides);

  return (
    <div className="space-y-6">
      <div className="border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="space-y-1">
          <h2 className="text-foreground text-xl font-bold tracking-tight">
            Acoustics & IPA
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Configure grapheme-to-phoneme mapping rules, inspect acoustic formant spectra, and compare cross-language phonology.
          </p>
        </div>

        {/* Apple-style Segmented Control */}
        <div className="flex items-center gap-1 rounded-full border border-border/40 bg-secondary/15 p-1 backdrop-blur-md self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveMode("matrix")}
            className={cn(
              "flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-semibold transition-all duration-200 cursor-pointer select-none",
              activeMode === "matrix"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <AudioLines className="h-3.5 w-3.5 text-[#8b5cf6]" />
            <span>IPA Matrix & Formants</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode("comparison")}
            className={cn(
              "flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-semibold transition-all duration-200 cursor-pointer select-none",
              activeMode === "comparison"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <GitCompare className="h-3.5 w-3.5 text-[#8b5cf6]" />
            <span>Profile Comparison</span>
          </button>
        </div>
      </div>

      {activeMode === "comparison" ? (
        <ComparatorSection hideHeader studioWords={studioWords} />
      ) : (
        <>

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
          <Select value={culture} onValueChange={setCulture}>
            <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors focus:outline-none">
              <SelectValue placeholder="Select culture" />
            </SelectTrigger>
            <SelectContent className="border-border/40 bg-background/95 max-h-[300px] backdrop-blur-md">
              <div className="text-muted-foreground px-2 py-1 text-[10px] font-bold uppercase tracking-wider">
                Natural Languages (13)
              </div>
              {CULTURES.map((c) => (
                <SelectItem
                  key={c}
                  value={c}
                  className="focus:text-foreground text-xs capitalize focus:bg-[#0091ff]/10"
                >
                  {c}
                </SelectItem>
              ))}
              <div className="text-muted-foreground mt-1 border-t border-border/40 px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider">
                Fantasy & Lineage Templates (18)
              </div>
              {getAllTemplateLinguisticProfiles().map((t) => (
                <SelectItem
                  key={t.id}
                  value={t.id}
                  className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                >
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 font-mono text-sm">
            <span>{previewIpa}</span>
            {speechConfig?.kokoro?.enabled &&
              (() => {
                const result = ipaToKokoroPhonemes(previewIpa);
                return (
                  <span className="text-muted-foreground/80 flex items-center gap-1.5 text-xs">
                    <span>→ {result.phonemes || "(empty)"}</span>
                    {result.dropped.length > 0 && (
                      <span className="text-[10px] font-semibold text-amber-500">
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

        {/* Interactive Grapheme Mapper Timeline */}
        {previewText.trim().length > 0 && (
          <div className="border-border/30 animate-in fade-in mt-3 space-y-2.5 border-t pt-3.5 duration-200">
            <h4 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
              Interactive Grapheme Mapper (click segment to customize sound)
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              {segments.map((seg, idx) => {
                const isOverridden = rows.some(([g]) => g === seg.grapheme);
                const isActive = activeSegmentIndex === idx;

                return (
                  <div key={idx} className="relative">
                    <button
                      onClick={() => {
                        if (isActive) {
                          setActiveSegmentIndex(null);
                          setSelectedSound(null);
                        } else {
                          setActiveSegmentIndex(idx);
                          setSelectedSound(seg.ipa || null);
                        }
                      }}
                      className={cn(
                        "flex h-14 min-w-10 cursor-pointer flex-col items-center justify-center rounded-xl border px-3 py-1.5 text-center transition-all duration-200 active:scale-95",
                        isOverridden
                          ? "text-foreground border-[#8b5cf6]/40 bg-[#8b5cf6]/10 hover:bg-[#8b5cf6]/20"
                          : "border-border/50 bg-background text-foreground hover:bg-secondary/40",
                        isActive && "border-transparent ring-2 ring-[#8b5cf6]"
                      )}
                    >
                      <span className="font-mono text-sm font-bold capitalize">{seg.grapheme}</span>
                      <span className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                        /{seg.ipa || "∅"}/
                      </span>
                    </button>

                    {isActive && (
                      <div className="bg-popover/95 animate-in fade-in slide-in-from-top-2 border-border/60 absolute left-0 z-30 mt-2.5 w-72 rounded-2xl border p-3.5 shadow-2xl shadow-black/40 backdrop-blur-xl duration-200">
                        <div className="border-border/40 mb-2.5 flex items-center justify-between border-b pb-2">
                          <span className="text-foreground text-[10px] font-bold uppercase">
                            Map segment:{" "}
                            <span className="font-mono font-bold text-[#8b5cf6]">
                              "{seg.grapheme}"
                            </span>
                          </span>
                          <button
                            onClick={() => setActiveSegmentIndex(null)}
                            className="text-muted-foreground hover:text-foreground cursor-pointer rounded p-0.5"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Popover Tabs */}
                        <div className="bg-secondary/15 mb-3 flex gap-1 rounded-lg p-0.5">
                          {(["vowels", "consonants", "diphthongs"] as const).map((tab) => (
                            <button
                              key={tab}
                              onClick={() => setSoundboardTab(tab)}
                              className={cn(
                                "flex-1 cursor-pointer rounded-md py-1 text-[9px] font-bold capitalize uppercase transition-all",
                                soundboardTab === tab
                                  ? "bg-[#8b5cf6] text-white"
                                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/10"
                              )}
                            >
                              {tab === "diphthongs" ? "Diphthongs/Length" : tab}
                            </button>
                          ))}
                        </div>

                        {/* Tab Content (IPA Grid) */}
                        <div className="grid max-h-36 grid-cols-5 gap-1.5 overflow-y-auto pr-0.5">
                          {(soundboardTab === "vowels"
                            ? IPA_VOWELS
                            : soundboardTab === "consonants"
                              ? IPA_CONSONANTS
                              : IPA_DIPHTHONGS
                          ).map((sym) => {
                            const isSelected = selectedSound === sym;
                            const isKokoro = KOKORO_VALID_TOKENS.has(sym);
                            return (
                              <button
                                key={sym}
                                onClick={async () => {
                                  setSelectedSound(sym);
                                  await playPhoneme(sym);
                                }}
                                title={
                                  isKokoro
                                    ? `${sym} (Kokoro high-fidelity native)`
                                    : `${sym} (fallback/synthesized)`
                                }
                                className={cn(
                                  "relative flex h-8 cursor-pointer items-center justify-center rounded-lg border font-mono text-xs font-bold transition-all hover:scale-105 active:scale-95",
                                  isSelected
                                    ? "text-foreground border-[#8b5cf6] bg-[#8b5cf6]/20 ring-1 ring-[#8b5cf6]"
                                    : isKokoro
                                      ? "border-[#0091ff]/30 bg-[#0091ff]/5 text-[#0091ff] hover:bg-[#0091ff]/15"
                                      : "border-border/60 bg-background hover:bg-secondary/30 text-foreground"
                                )}
                              >
                                {sym}
                                {isKokoro && (
                                  <span className="absolute top-1 right-1 h-1 w-1 rounded-full bg-[#0091ff]" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Popover Footer (Preview & Confirm) */}
                        {selectedSound && (
                          <div className="animate-in fade-in border-border/40 mt-3.5 flex items-center justify-between gap-2 border-t pt-2.5 duration-200">
                            <button
                              onClick={() => playPhoneme(selectedSound)}
                              title="Listen to selected sound again"
                              className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-[10px] font-bold"
                            >
                              <Volume2 className="h-3.5 w-3.5" /> Hear again
                            </button>
                            <button
                              onClick={() => mapGrapheme(seg.grapheme, selectedSound)}
                              className="cursor-pointer rounded-lg bg-[#8b5cf6] px-3 py-1.5 text-[10px] font-bold text-white transition-opacity hover:opacity-90"
                            >
                              Confirm Map
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Acoustic Formant & Spectrogram Visualizer */}
      <AcousticFormantVisualizer
        currentIpa={previewIpa}
        currentName={previewText}
        accentColor={ACCENT}
      />

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
                    <span className="text-muted-foreground bg-secondary/20 rounded px-1.5 py-0.5 font-mono text-[10px]">
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
      </>
      )}
    </div>
  );
}

export default StudioPhonology;
