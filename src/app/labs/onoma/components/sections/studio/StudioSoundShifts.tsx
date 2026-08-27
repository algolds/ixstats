"use client";

// src/app/labs/onoma/components/sections/studio/StudioSoundShifts.tsx
// Onoma Lab — Historical Sound Change & Language Evolution Studio

import { useState, useMemo } from "react";
import {
  GitFork,
  Plus,
  Trash as Trash2,
  SoundHigh as Volume2,
  ArrowRight,
  Copy,
  Check,
  NavArrowDown as ChevronDown,
  NavArrowRight as ChevronRight,
  Component as Layers,
  ArrowUp,
  ArrowDown,
  Bookmark,
  Globe as Globe2,
  Folder as FolderDown,
} from "iconoir-react";
import {
  SOUND_SHIFT_PRESETS,
  applySoundShifts,
  type SoundShiftEpoch,
  type SoundShiftRule,
  type WordEvolutionResult,
} from "~/lib/onoma/sound-shifts";
import { speakName } from "~/lib/onoma/browser-speech";
import { translateToIPA } from "~/lib/onoma/phonology";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useNameBank } from "~/hooks/useNameBank";
import { cn } from "~/lib/utils";
import LoanwordsSection from "../LoanwordsSection";
import { CorpusSelector } from "../../shared/CorpusSelector";
import { resolveCorpusWords } from "~/lib/onoma/data-bridge";

const QUICK_SYMBOLS = [
  { label: "#_ (Initial)", value: "#_" },
  { label: "_# (Final)", value: "_#" },
  { label: "V_V (Intervocalic)", value: "V_V" },
  { label: "_[ei] (Front Vowels)", value: "_[ei]" },
  { label: "θ", value: "θ" },
  { label: "ʃ", value: "ʃ" },
  { label: "tʃ", value: "tʃ" },
  { label: "dʒ", value: "dʒ" },
  { label: "ʒ", value: "ʒ" },
  { label: "č", value: "č" },
  { label: "ž", value: "ž" },
  { label: "š", value: "š" },
  { label: "ʰ", value: "ʰ" },
  { label: "∅ (Delete)", value: "" },
];

interface StudioSoundShiftsProps {
  studioWords?: string[];
}

export function StudioSoundShifts({ studioWords = [] }: StudioSoundShiftsProps = {}) {
  const notify = useNotify();
  const bank = useNameBank();
  const { saveEntry } = bank;
  const { data: speechConfig } = api.onoma.getSpeechConfig.useQuery();

  const customDicts = useMemo(() => {
    return bank.nameBank?.filter((d) => d.type === "dictionary" && d.values?.length > 0) || [];
  }, [bank.nameBank]);

  // Selected Preset
  const [selectedPresetId, setSelectedPresetId] = useState<string>("grimms-law");

  // Epochs State
  const [epochs, setEpochs] = useState<SoundShiftEpoch[]>(() => {
    const preset = SOUND_SHIFT_PRESETS.find((p) => p.id === "grimms-law")!;
    return JSON.parse(JSON.stringify(preset.epochs));
  });

  // Proto-words input state
  const [inputWordsText, setInputWordsText] = useState<string>(() => {
    if (studioWords && studioWords.length > 0) {
      return studioWords.join(", ");
    }
    const preset = SOUND_SHIFT_PRESETS.find((p) => p.id === "grimms-law")!;
    return preset.sampleInput.join("\n");
  });

  // Expanded word details in output table
  const [expandedWordIdx, setExpandedWordIdx] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Active rule being edited context for quick symbol insertion
  const [focusedInput, setFocusedInput] = useState<{
    epochIdx: number;
    ruleIdx: number;
    field: "source" | "target" | "context";
  } | null>(null);

  // Load Preset Handler
  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = SOUND_SHIFT_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setEpochs(JSON.parse(JSON.stringify(preset.epochs)));
      setInputWordsText(preset.sampleInput.join("\n"));
      notify.success(`Loaded "${preset.name}" sound shift rules.`);
    }
  };

  // Add Epoch
  const handleAddEpoch = () => {
    const newEpoch: SoundShiftEpoch = {
      id: `epoch-${Date.now()}`,
      name: `Epoch ${epochs.length + 1}: Sound Shift`,
      description: "Custom chronological sound shift phase",
      rules: [
        {
          id: `rule-${Date.now()}`,
          source: "p",
          target: "f",
          description: "p → f",
          enabled: true,
        },
      ],
    };
    setEpochs([...epochs, newEpoch]);
  };

  // Remove Epoch
  const handleRemoveEpoch = (epochIdx: number) => {
    setEpochs(epochs.filter((_, i) => i !== epochIdx));
  };

  // Add Rule to Epoch
  const handleAddRule = (epochIdx: number) => {
    const updated = [...epochs];
    const epoch = updated[epochIdx];
    if (!epoch) return;

    epoch.rules.push({
      id: `rule-${Date.now()}`,
      source: "",
      target: "",
      context: "",
      description: "",
      enabled: true,
    });
    setEpochs(updated);
  };

  // Update Rule in Epoch
  const handleUpdateRule = <K extends keyof SoundShiftRule>(
    epochIdx: number,
    ruleIdx: number,
    field: K,
    value: SoundShiftRule[K]
  ) => {
    const updated = [...epochs];
    const epoch = updated[epochIdx];
    if (epoch && epoch.rules[ruleIdx]) {
      epoch.rules[ruleIdx][field] = value;
      setEpochs(updated);
    }
  };

  // Move Rule
  const handleMoveRule = (epochIdx: number, ruleIdx: number, direction: "up" | "down") => {
    const updated = [...epochs];
    const rules = updated[epochIdx]?.rules;
    if (!rules) return;

    const targetIdx = direction === "up" ? ruleIdx - 1 : ruleIdx + 1;
    if (targetIdx < 0 || targetIdx >= rules.length) return;

    const temp = rules[ruleIdx]!;
    rules[ruleIdx] = rules[targetIdx]!;
    rules[targetIdx] = temp;
    setEpochs(updated);
  };

  // Remove Rule from Epoch
  const handleRemoveRule = (epochIdx: number, ruleIdx: number) => {
    const updated = [...epochs];
    const epoch = updated[epochIdx];
    if (epoch) {
      epoch.rules = epoch.rules.filter((_, i) => i !== ruleIdx);
      setEpochs(updated);
    }
  };

  // Insert Symbol into focused field
  const handleInsertSymbol = (sym: string) => {
    if (!focusedInput) return;
    const { epochIdx, ruleIdx, field } = focusedInput;
    const currentVal = epochs[epochIdx]?.rules[ruleIdx]?.[field] || "";
    handleUpdateRule(epochIdx, ruleIdx, field, `${currentVal}${sym}`);
  };

  // Parse words list from text area
  const parsedWords = useMemo(() => {
    return inputWordsText
      .split(/[\r\n,]+/)
      .map((w) => w.trim())
      .filter(Boolean);
  }, [inputWordsText]);

  // Compute Evolution Results
  const evolutionResults: WordEvolutionResult[] = useMemo(() => {
    return applySoundShifts(parsedWords, epochs);
  }, [parsedWords, epochs]);

  // Audio Playback
  const handlePlay = async (word: string) => {
    try {
      const ipa = translateToIPA(word, "latin");
      await speakName({
        name: word,
        ipa,
        culture: "latin",
        kokoroEnabled: speechConfig?.kokoro?.enabled ?? false,
        defaultVoice: speechConfig?.kokoro?.voice || "af_heart",
      });
    } catch {
      notify.error("Speech playback error.");
    }
  };

  // Copy word
  const handleCopy = async (word: string, idx: number) => {
    await navigator.clipboard.writeText(word);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
    notify.success(`Copied "${word}" to clipboard.`);
  };

  // Save to Stash
  const handleSaveToStash = async (res: WordEvolutionResult) => {
    try {
      await saveEntry({
        type: "saved-name",
        title: res.final,
        values: [res.final],
        category: "culture",
      });
      notify.success(`Saved "${res.final}" to Stash.`);
    } catch {
      notify.error("Failed to save to Stash.");
    }
  };

  const [shiftMode, setShiftMode] = useState<"diachronic" | "loanwords">("diachronic");

  return (
    <div className="space-y-6 text-left">
      {/* Top Controls Bar with Segmented Mode Switch */}
      <div className="border-border/40 flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h3 className="text-foreground text-xl font-bold tracking-tight">
            Sound Shifts & Phonetic Adaptation
          </h3>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Model chronological diachronic sound change or configure interlinguistic borrowing and
            loanword adaptation.
          </p>
        </div>

        {/* Apple-style Segmented Control */}
        <div className="border-border/40 bg-secondary/15 flex items-center gap-1 self-start rounded-full border p-1 backdrop-blur-md sm:self-auto">
          <button
            type="button"
            onClick={() => setShiftMode("diachronic")}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-1 text-xs font-semibold transition-all duration-200 select-none",
              shiftMode === "diachronic"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <GitFork className="h-3.5 w-3.5 text-pink-500" />
            <span>Historical Sound Shifts</span>
          </button>
          <button
            type="button"
            onClick={() => setShiftMode("loanwords")}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-1 text-xs font-semibold transition-all duration-200 select-none",
              shiftMode === "loanwords"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Globe2 className="h-3.5 w-3.5 text-pink-500" />
            <span>Loanwords & Contact Adaptation</span>
          </button>
        </div>
      </div>

      {shiftMode === "loanwords" ? (
        <LoanwordsSection />
      ) : (
        <>
          {/* Header Banner */}
          <div className="border-border/40 bg-secondary/5 relative overflow-hidden rounded-2xl border p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="space-y-1">
                <h4 className="text-foreground text-sm font-bold">
                  Diachronic Phonetic Transformation
                </h4>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Define chronological phonetic shift rules (<code>X → Y / ENV</code>) across
                  historical epochs to systematically derive daughter languages and regional
                  dialects from Proto-Lexicons.
                </p>
              </div>

              {/* Preset Selector */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Presets:
                </span>
                {SOUND_SHIFT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={cn(
                      "cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all active:scale-95",
                      selectedPresetId === preset.id
                        ? "border-pink-500/40 bg-pink-500/10 text-pink-600 shadow-sm dark:text-pink-400"
                        : "border-border/40 bg-background/50 text-muted-foreground hover:text-foreground hover:border-pink-500/30 hover:bg-pink-500/5"
                    )}
                  >
                    {preset.name.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left Column: Chronological Rule Timeline (7 cols) */}
            <div className="space-y-5 lg:col-span-7">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-pink-500" />
                  <h4 className="text-foreground text-sm font-bold">
                    Chronological Epochs & Rules
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={handleAddEpoch}
                  className="border-border/40 bg-secondary/20 flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold transition-all hover:border-pink-500/40 hover:bg-pink-500/10 hover:text-pink-600 active:scale-95 dark:hover:text-pink-400"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Epoch</span>
                </button>
              </div>

              {/* Quick Insert Symbols Palette */}
              <div className="border-border/30 bg-secondary/10 flex flex-wrap items-center gap-1.5 rounded-xl border p-2.5">
                <span className="text-muted-foreground mr-1 text-[10px] font-bold uppercase">
                  Insert:
                </span>
                {QUICK_SYMBOLS.map((sym) => (
                  <button
                    key={sym.label}
                    type="button"
                    onClick={() => handleInsertSymbol(sym.value)}
                    className="border-border/40 bg-background/80 cursor-pointer rounded border px-2 py-0.5 font-mono text-[10px] transition-all hover:border-pink-500/40 hover:bg-pink-500/10 hover:text-pink-500 active:scale-90"
                  >
                    {sym.label}
                  </button>
                ))}
              </div>

              {/* Epochs List */}
              <div className="space-y-4">
                {epochs.map((epoch, epochIdx) => (
                  <div
                    key={epoch.id}
                    className="border-border/40 bg-card/40 relative space-y-3 rounded-xl border p-4 shadow-sm backdrop-blur-sm"
                  >
                    {/* Epoch Header */}
                    <div className="border-border/20 flex items-center justify-between gap-2 border-b pb-2.5">
                      <div className="flex flex-1 items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-pink-500/15 text-[10px] font-bold text-pink-600 dark:text-pink-400">
                          {epochIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={epoch.name}
                          onChange={(e) => {
                            const updated = [...epochs];
                            updated[epochIdx]!.name = e.target.value;
                            setEpochs(updated);
                          }}
                          className="text-foreground w-full bg-transparent text-xs font-bold focus:outline-none"
                          placeholder="Epoch Title (e.g. Phase 1: High Vowel Raising)"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveEpoch(epochIdx)}
                        disabled={epochs.length <= 1}
                        title="Delete Epoch"
                        className="text-muted-foreground cursor-pointer p-1 transition-colors hover:text-rose-500 disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Rules Table / Rows */}
                    <div className="space-y-2">
                      {epoch.rules.map((rule, ruleIdx) => (
                        <div
                          key={rule.id}
                          className={cn(
                            "border-border/30 bg-background/50 flex flex-wrap items-center gap-2 rounded-lg border p-2 transition-all sm:flex-nowrap",
                            !rule.enabled && "opacity-50"
                          )}
                        >
                          {/* Checkbox Enable */}
                          <input
                            type="checkbox"
                            checked={rule.enabled !== false}
                            onChange={(e) =>
                              handleUpdateRule(epochIdx, ruleIdx, "enabled", e.target.checked)
                            }
                            className="h-3.5 w-3.5 cursor-pointer rounded accent-pink-500"
                            title="Toggle Rule"
                          />

                          {/* Source */}
                          <div className="flex w-20 flex-shrink-0 items-center">
                            <input
                              type="text"
                              value={rule.source}
                              onFocus={() =>
                                setFocusedInput({ epochIdx, ruleIdx, field: "source" })
                              }
                              onChange={(e) =>
                                handleUpdateRule(epochIdx, ruleIdx, "source", e.target.value)
                              }
                              placeholder="Source"
                              className="border-border/40 bg-secondary/10 w-full rounded border px-2 py-1 font-mono text-xs focus:border-pink-500 focus:outline-none"
                            />
                          </div>

                          <ArrowRight className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0" />

                          {/* Target */}
                          <div className="flex w-20 flex-shrink-0 items-center">
                            <input
                              type="text"
                              value={rule.target}
                              onFocus={() =>
                                setFocusedInput({ epochIdx, ruleIdx, field: "target" })
                              }
                              onChange={(e) =>
                                handleUpdateRule(epochIdx, ruleIdx, "target", e.target.value)
                              }
                              placeholder="Target"
                              className="border-border/40 bg-secondary/10 w-full rounded border px-2 py-1 font-mono text-xs focus:border-pink-500 focus:outline-none"
                            />
                          </div>

                          <span className="text-muted-foreground text-xs font-semibold">/</span>

                          {/* Context / Environment */}
                          <div className="flex min-w-[90px] flex-1 items-center">
                            <input
                              type="text"
                              value={rule.context || ""}
                              onFocus={() =>
                                setFocusedInput({ epochIdx, ruleIdx, field: "context" })
                              }
                              onChange={(e) =>
                                handleUpdateRule(epochIdx, ruleIdx, "context", e.target.value)
                              }
                              placeholder="Env (e.g. V_V, _[ei], _#)"
                              className="border-border/40 bg-secondary/10 w-full rounded border px-2 py-1 font-mono text-xs focus:border-pink-500 focus:outline-none"
                            />
                          </div>

                          {/* Move Up / Down / Delete */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveRule(epochIdx, ruleIdx, "up")}
                              disabled={ruleIdx === 0}
                              className="text-muted-foreground hover:text-foreground cursor-pointer p-1 transition-colors disabled:opacity-25"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveRule(epochIdx, ruleIdx, "down")}
                              disabled={ruleIdx === epoch.rules.length - 1}
                              className="text-muted-foreground hover:text-foreground cursor-pointer p-1 transition-colors disabled:opacity-25"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveRule(epochIdx, ruleIdx)}
                              className="text-muted-foreground cursor-pointer p-1 transition-colors hover:text-rose-500"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => handleAddRule(epochIdx)}
                        className="text-muted-foreground flex cursor-pointer items-center gap-1 pt-1 text-[11px] font-semibold transition-colors hover:text-pink-500"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Add Shift Rule</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Interactive Lexicon Evolution & Diff (5 cols) */}
            <div className="space-y-5 lg:col-span-5">
              {/* Proto-Lexicon Input */}
              <div className="border-border/40 bg-card/40 space-y-2.5 rounded-xl border p-4 shadow-sm">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <label className="text-foreground text-xs font-bold">
                    Proto-Language Lexicon Input
                  </label>
                  <div className="w-full sm:w-48">
                    <CorpusSelector
                      value=""
                      onChange={(val) => {
                        const resolved = resolveCorpusWords(val, customDicts, studioWords);
                        if (resolved.words?.length > 0) {
                          setInputWordsText(resolved.words.join(", "));
                          notify.success(
                            `Loaded ${resolved.words.length} words from "${resolved.label}"`
                          );
                        }
                      }}
                      studioWords={studioWords}
                    />
                  </div>
                </div>
                <textarea
                  rows={4}
                  value={inputWordsText}
                  onChange={(e) => setInputWordsText(e.target.value)}
                  placeholder="Enter proto-words separated by newlines or commas..."
                  className="border-border/40 bg-background/50 text-foreground w-full rounded-lg border p-2.5 font-mono text-xs focus:border-pink-500 focus:outline-none"
                />
                <div className="text-muted-foreground flex items-center justify-between text-[10px]">
                  <span>{parsedWords.length} words loaded</span>
                  <span>Loaded from Stash or custom text</span>
                </div>
              </div>

              {/* Evolved Daughter Lexicon Results */}
              <div className="border-border/40 bg-card/40 space-y-3 rounded-xl border p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-foreground text-xs font-bold">Evolved Daughter Lexicon</h4>
                    <span className="text-muted-foreground text-[10px]">
                      {evolutionResults.length} simulated
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const words = evolutionResults.map((r) => r.final);
                      if (words.length === 0) return;
                      await saveEntry({
                        type: "dictionary",
                        title: `Evolved ${selectedPresetId.replace(/-/g, " ")} Lexicon`,
                        values: words,
                      });
                      notify.success(`Saved ${words.length} evolved words to Stash!`);
                    }}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-pink-500/40 bg-pink-500/10 px-2.5 py-1 text-[11px] font-semibold text-pink-600 shadow-xs transition-all hover:bg-pink-500/20 active:scale-95 dark:text-pink-400"
                  >
                    <FolderDown className="h-3.5 w-3.5" />
                    <span>Save to Stash</span>
                  </button>
                </div>

                <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
                  {evolutionResults.map((res, idx) => {
                    const isExpanded = expandedWordIdx === idx;
                    const hasChanged = res.original.toLowerCase() !== res.final.toLowerCase();

                    return (
                      <div
                        key={`${res.original}-${idx}`}
                        className={cn(
                          "border-border/30 bg-background/60 rounded-lg border p-2.5 transition-all",
                          hasChanged && "border-pink-500/30 bg-pink-500/[0.02]"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            {/* Proto Word */}
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground font-mono text-xs">
                                *{res.original}
                              </span>
                              <button
                                type="button"
                                onClick={() => handlePlay(res.original)}
                                title="Pronounce Proto Word"
                                className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                              >
                                <Volume2 className="h-3 w-3" />
                              </button>
                            </div>

                            <ArrowRight className="text-muted-foreground/60 h-3 w-3 flex-shrink-0" />

                            {/* Daughter Word */}
                            <div className="flex items-center gap-1">
                              <span className="text-foreground font-mono text-xs font-bold">
                                {res.final}
                              </span>
                              <button
                                type="button"
                                onClick={() => handlePlay(res.final)}
                                title="Pronounce Evolved Word"
                                className="cursor-pointer p-0.5 text-pink-500 hover:text-pink-600"
                              >
                                <Volume2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            {/* Save to Stash */}
                            <button
                              type="button"
                              onClick={() => handleSaveToStash(res)}
                              title="Save to Stash"
                              className="text-muted-foreground cursor-pointer rounded p-1 transition-colors hover:text-pink-500"
                            >
                              <Bookmark className="h-3.5 w-3.5" />
                            </button>

                            {/* Copy */}
                            <button
                              type="button"
                              onClick={() => handleCopy(res.final, idx)}
                              title="Copy Evolved Word"
                              className="text-muted-foreground hover:text-foreground cursor-pointer rounded p-1 transition-colors"
                            >
                              {copiedIdx === idx ? (
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>

                            {/* Trace Step toggle */}
                            {res.steps.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedWordIdx(isExpanded ? null : idx)}
                                title="Inspect derivation steps"
                                className="text-muted-foreground cursor-pointer rounded p-1 transition-colors hover:text-pink-500"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Step-by-Step Derivation Inspector */}
                        {isExpanded && res.steps.length > 0 && (
                          <div className="border-border/30 bg-secondary/10 mt-2 space-y-1.5 rounded border p-2 text-[10px]">
                            <div className="text-muted-foreground font-bold tracking-wider uppercase">
                              Derivation Trace:
                            </div>
                            {res.steps.map((step, sIdx) => (
                              <div
                                key={sIdx}
                                className="border-border/15 flex items-center justify-between gap-2 border-b pb-1 font-mono last:border-none last:pb-0"
                              >
                                <span className="text-muted-foreground truncate">
                                  {step.epochName}
                                </span>
                                <span className="text-pink-600 dark:text-pink-400">
                                  {step.ruleDescription}
                                </span>
                                <span className="text-foreground font-bold">
                                  {step.before} → {step.after}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default StudioSoundShifts;
