"use client";

// src/app/labs/onoma/components/sections/studio/StudioPhonology.tsx
// Onoma Lab — IPA Studio: edit grapheme→IPA rules per culture, preview & play,
// and manage per-name pronunciation overrides. All customization is device-local
// (localStorage) via ~/lib/onoma/ipa-overrides.

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash as Trash2,
  SoundHigh as Volume2,
  FloppyDisk as Save,
  Undo as RotateCcw,
  SoundHigh as AudioLines,
  Xmark as X,
  GitCompare,
} from "iconoir-react";
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
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { SegmentedControl } from "~/components/ui/segmented-control";

const ACCENT = "var(--tint)";

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
    // oxlint-disable-next-line
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
      <div className="border-separator flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h2 className="text-label text-title-2 font-bold">Acoustics & IPA</h2>
          <p className="text-label-secondary text-footnote mt-0.5">
            Configure grapheme-to-phoneme mapping rules, inspect acoustic formant spectra, and
            compare cross-language phonology.
          </p>
        </div>

        <SegmentedControl
          size="sm"
          aria-label="Mode"
          className="self-start sm:self-auto"
          value={activeMode}
          onValueChange={setActiveMode}
          options={[
            { value: "matrix", label: "IPA matrix & formants", icon: <AudioLines /> },
            { value: "comparison", label: "Profile comparison", icon: <GitCompare /> },
          ]}
        />
      </div>

      {activeMode === "comparison" ? (
        <ComparatorSection hideHeader studioWords={studioWords} />
      ) : (
        <>
          <div className="border-separator bg-fill-4 rounded-row space-y-2 border p-4">
            <label className="text-label-secondary text-subhead">Live preview</label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="Type a word…"
                className="text-body w-44"
              />
              <Select value={culture} onValueChange={setCulture}>
                <SelectTrigger className="text-body">
                  <SelectValue placeholder="Select culture" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <div className="text-label-secondary text-eyebrow px-2 py-1">
                    Natural Languages (13)
                  </div>
                  {CULTURES.map((c) => (
                    <SelectItem key={c} value={c} className="text-footnote capitalize">
                      {c}
                    </SelectItem>
                  ))}
                  <div className="text-label-secondary border-separator text-eyebrow mt-1 border-t px-2 pt-2 pb-1">
                    Fantasy & Lineage Templates (18)
                  </div>
                  {getAllTemplateLinguisticProfiles().map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-footnote">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-label-secondary text-body flex flex-wrap items-center gap-2 font-mono">
                <span>{previewIpa}</span>
                {speechConfig?.kokoro?.enabled &&
                  (() => {
                    const result = ipaToKokoroPhonemes(previewIpa);
                    return (
                      <span className="text-label-secondary text-footnote flex items-center gap-2">
                        <span>→ {result.phonemes || "(empty)"}</span>
                        {result.dropped.length > 0 && (
                          <span className="text-caption text-yellow font-semibold">
                            ⚠ dropped: {result.dropped.join(", ")}
                          </span>
                        )}
                      </span>
                    );
                  })()}
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => play(previewText, previewIpa)}
                title="Play preview"
                className="ml-auto"
              >
                <Volume2 className="h-3.5 w-3.5" /> Play
              </Button>
            </div>

            {previewText.trim().length > 0 && (
              <div className="border-separator animate-in fade-in mt-3 space-y-2 border-t pt-4 duration-200">
                <h4 className="text-label-secondary text-subhead">
                  Interactive Grapheme Mapper (click segment to customize sound)
                </h4>
                <div className="flex flex-wrap items-center gap-2">
                  {segments.map((seg, idx) => {
                    const isOverridden = rows.some(([g]) => g === seg.grapheme);
                    const isActive = activeSegmentIndex === idx;

                    return (
                      <Popover
                        key={idx}
                        open={isActive}
                        onOpenChange={(open) => {
                          if (!open) {
                            setActiveSegmentIndex(null);
                            setSelectedSound(null);
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant={isOverridden ? "secondary" : "outline"}
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
                              "rounded-row text-label h-14 min-w-10 flex-col gap-0 px-3",
                              isActive && "ring-tint border-transparent ring-2"
                            )}
                          >
                            <span className="text-body font-mono font-semibold capitalize">
                              {seg.grapheme}
                            </span>
                            <span className="text-label-secondary text-caption mt-0.5 font-mono">
                              /{seg.ipa || "∅"}/
                            </span>
                          </Button>
                        </PopoverTrigger>

                        <PopoverContent align="start" className="w-72 p-4">
                          <div className="border-separator mb-2 flex items-center justify-between border-b pb-2">
                            <span className="text-label text-eyebrow">
                              Map segment:{" "}
                              <span className="text-tint font-mono font-semibold">
                                "{seg.grapheme}"
                              </span>
                            </span>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setActiveSegmentIndex(null)}
                              aria-label="Close"
                              className="text-label-secondary"
                            >
                              <X />
                            </Button>
                          </div>

                          <SegmentedControl
                            size="sm"
                            fullWidth
                            aria-label="Sound set"
                            className="mb-3"
                            value={soundboardTab}
                            onValueChange={setSoundboardTab}
                            options={[
                              { value: "vowels", label: "Vowels" },
                              { value: "consonants", label: "Consonants" },
                              { value: "diphthongs", label: "Diphthongs/length" },
                            ]}
                          />

                          {/* Tab Content (IPA Grid) */}
                          <div className="grid max-h-36 grid-cols-5 gap-2 overflow-y-auto pr-0.5">
                            {(soundboardTab === "vowels"
                              ? IPA_VOWELS
                              : soundboardTab === "consonants"
                                ? IPA_CONSONANTS
                                : IPA_DIPHTHONGS
                            ).map((sym) => {
                              const isSelected = selectedSound === sym;
                              const isKokoro = KOKORO_VALID_TOKENS.has(sym);
                              return (
                                <Button
                                  key={sym}
                                  variant="outline"
                                  size="sm"
                                  aria-pressed={isSelected}
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
                                    "h-8 px-0 font-mono",
                                    isSelected
                                      ? "border-tint bg-tint/20 ring-tint ring-1"
                                      : isKokoro &&
                                          "border-tint/30 bg-tint/5 text-tint hover:bg-tint/15"
                                  )}
                                >
                                  {sym}
                                  {isKokoro && (
                                    <span className="bg-tint absolute top-1 right-1 h-1 w-1 rounded-full" />
                                  )}
                                </Button>
                              );
                            })}
                          </div>

                          {/* Popover Footer (Preview & Confirm) */}
                          {selectedSound && (
                            <div className="animate-in fade-in border-separator mt-4 flex items-center justify-between gap-2 border-t pt-2 duration-200">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => playPhoneme(selectedSound)}
                                title="Listen to selected sound again"
                              >
                                <Volume2 /> Hear again
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => mapGrapheme(seg.grapheme, selectedSound)}
                              >
                                Confirm map
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
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

          <div className="border-separator rounded-row space-y-3 border p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-label text-subhead">{culture} grapheme → IPA overrides</h4>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={resetRules}>
                  <RotateCcw className="h-3 w-3" /> Reset
                </Button>
                <Button variant="default" size="sm" onClick={saveRules}>
                  <Save className="h-3 w-3" /> Save rules
                </Button>
              </div>
            </div>

            <p className="text-label-secondary text-caption">
              Overrides take priority over the built-in rules. Multi-letter graphemes (e.g.{" "}
              <span className="font-mono">sch</span>) are matched before single letters.
            </p>

            <div className="space-y-2">
              {rows.length === 0 && (
                <p className="text-label-secondary text-footnote py-2 text-center italic">
                  No overrides; built-in {culture} rules apply. Add one below.
                </p>
              )}
              {rows.map(([g, ipa], i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={g}
                    onChange={(e) => updateRow(i, 0, e.target.value)}
                    placeholder="grapheme"
                    className="text-footnote w-28 font-mono"
                  />
                  <span className="text-label-secondary text-footnote">→</span>
                  <Input
                    value={ipa}
                    onChange={(e) => updateRow(i, 1, e.target.value)}
                    placeholder="IPA"
                    className="text-footnote w-28 font-mono"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeRow(i)}
                    title="Remove rule"
                    aria-label="Remove rule"
                    className="text-label-secondary hover:text-red"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={addRow}
                className="text-label-secondary hover:text-label text-label-secondary hover:text-label px-2"
              >
                <Plus className="h-3.5 w-3.5" /> Add rule
              </Button>
            </div>

            <details className="border-separator border-t pt-2">
              <summary className="text-label-secondary text-subhead cursor-pointer">
                Built-in {culture} rules (reference)
              </summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {baseRules.map(([g, ipa], i) => (
                  <span
                    key={i}
                    className="border-separator bg-fill-4 text-label-secondary rounded-control-sm text-caption border px-2 py-0.5 font-mono"
                  >
                    {g} → {ipa || "∅"}
                  </span>
                ))}
              </div>
            </details>
          </div>

          <div className="border-separator rounded-row space-y-2 border p-4">
            <h4 className="text-label text-subhead">Per-name overrides</h4>
            {overrideNames.length === 0 ? (
              <p className="text-label-secondary text-footnote italic">
                None yet. Use the pencil on any generated name to set a custom IPA or voice.
              </p>
            ) : (
              <div className="divide-separator divide-y">
                {overrideNames.map((name) => {
                  const ov = nameOverrides[name];
                  return (
                    <div key={name} className="text-footnote flex items-center gap-2 py-2">
                      <span className="text-label font-semibold">{name}</span>
                      {ov.ipa && <span className="text-label-secondary font-mono">{ov.ipa}</span>}
                      {ov.voice && (
                        <span className="text-label-secondary bg-fill-4 rounded-control-sm text-caption px-2 py-0.5 font-mono">
                          {ov.voice}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          play(name, ov.ipa ?? translateToIPA(name, culture), ov.voice)
                        }
                        title="Play"
                        aria-label="Play"
                        className="text-label-secondary hover:text-tint ml-auto"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setNameOverride(name, { ipa: undefined, voice: undefined })}
                        title="Clear override"
                        aria-label="Clear override"
                        className="text-label-secondary hover:text-red"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
