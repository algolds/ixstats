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
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Button } from "~/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { Checkbox } from "~/components/ui/checkbox";

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
      <div className="border-separator flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h3 className="text-label text-title-2 font-bold">Sound Shifts & Phonetic Adaptation</h3>
          <p className="text-label-secondary text-footnote leading-relaxed">
            Model chronological diachronic sound change or configure interlinguistic borrowing and
            loanword adaptation.
          </p>
        </div>

        <SegmentedControl
          size="sm"
          aria-label="Mode"
          className="self-start sm:self-auto"
          value={shiftMode}
          onValueChange={setShiftMode}
          options={[
            { value: "diachronic", label: "Historical sound shifts", icon: <GitFork /> },
            { value: "loanwords", label: "Loanwords & contact adaptation", icon: <Globe2 /> },
          ]}
        />
      </div>

      {shiftMode === "loanwords" ? (
        <LoanwordsSection />
      ) : (
        <>
          {/* Header Banner */}
          <div className="bg-surface-secondary rounded-row relative overflow-hidden p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="space-y-1">
                <h4 className="text-label text-body font-semibold">
                  Diachronic Phonetic Transformation
                </h4>
                <p className="text-label-secondary text-footnote leading-relaxed">
                  Define chronological phonetic shift rules (<code>X → Y / ENV</code>) across
                  historical epochs to systematically derive daughter languages and regional
                  dialects from Proto-Lexicons.
                </p>
              </div>

              {/* Preset Selector */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-label-secondary text-eyebrow">Presets:</span>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  disallowEmpty
                  aria-label="Sound shift preset"
                  value={selectedPresetId}
                >
                  {SOUND_SHIFT_PRESETS.map((preset) => (
                    <ToggleGroupItem
                      key={preset.id}
                      value={preset.id}
                      onClick={() => handleSelectPreset(preset.id)}
                    >
                      {preset.name.split(" ")[0]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left Column: Chronological Rule Timeline (7 cols) */}
            <div className="space-y-5 lg:col-span-7">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="text-tint h-4 w-4" />
                  <h4 className="text-label text-body font-semibold">
                    Chronological Epochs & Rules
                  </h4>
                </div>
                <Button variant="outline" size="sm" onClick={handleAddEpoch}>
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Epoch</span>
                </Button>
              </div>

              {/* Quick Insert Symbols Palette */}
              <div className="border-separator bg-fill-4 rounded-row flex flex-wrap items-center gap-2 border p-3">
                <span className="text-label-secondary text-eyebrow mr-1">Insert:</span>
                {QUICK_SYMBOLS.map((sym) => (
                  <Button
                    variant="outline"
                    size="sm"
                    key={sym.label}
                    onClick={() => handleInsertSymbol(sym.value)}
                    className="h-7 px-2 font-mono"
                  >
                    {sym.label}
                  </Button>
                ))}
              </div>

              {/* Epochs List */}
              <div className="space-y-4">
                {epochs.map((epoch, epochIdx) => (
                  <div
                    key={epoch.id}
                    className="border-separator bg-surface rounded-row shadow-card relative space-y-3 border p-4"
                  >
                    {/* Epoch Header */}
                    <div className="border-separator flex items-center justify-between gap-2 border-b pb-2">
                      <div className="flex flex-1 items-center gap-2">
                        <span className="bg-tint/15 text-tint text-caption flex h-5 w-5 items-center justify-center rounded-full font-semibold">
                          {epochIdx + 1}
                        </span>
                        <Input
                          type="text"
                          value={epoch.name}
                          onChange={(e) => {
                            const updated = [...epochs];
                            updated[epochIdx]!.name = e.target.value;
                            setEpochs(updated);
                          }}
                          className="text-footnote w-full"
                          placeholder="Epoch Title (e.g. Phase 1: High Vowel Raising)"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveEpoch(epochIdx)}
                        disabled={epochs.length <= 1}
                        title="Delete Epoch"
                        aria-label="Delete Epoch"
                        className="text-label-secondary hover:text-red"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Rules Table / Rows */}
                    <div className="space-y-2">
                      {epoch.rules.map((rule, ruleIdx) => (
                        <div
                          key={rule.id}
                          className={cn(
                            "border-separator bg-surface rounded-control flex flex-wrap items-center gap-2 border p-2 transition-[color,background-color,border-color,box-shadow,opacity,transform] sm:flex-nowrap",
                            !rule.enabled && "opacity-50"
                          )}
                        >
                          {/* Checkbox Enable */}
                          <Checkbox
                            checked={rule.enabled !== false}
                            onCheckedChange={(checked) =>
                              handleUpdateRule(epochIdx, ruleIdx, "enabled", checked === true)
                            }
                            title="Toggle Rule"
                          />

                          {/* Source */}
                          <div className="flex w-20 flex-shrink-0 items-center">
                            <Input
                              type="text"
                              value={rule.source}
                              onFocus={() =>
                                setFocusedInput({ epochIdx, ruleIdx, field: "source" })
                              }
                              onChange={(e) =>
                                handleUpdateRule(epochIdx, ruleIdx, "source", e.target.value)
                              }
                              placeholder="Source"
                              className="text-footnote w-full font-mono"
                            />
                          </div>

                          <ArrowRight className="text-label-secondary h-3.5 w-3.5 flex-shrink-0" />

                          {/* Target */}
                          <div className="flex w-20 flex-shrink-0 items-center">
                            <Input
                              type="text"
                              value={rule.target}
                              onFocus={() =>
                                setFocusedInput({ epochIdx, ruleIdx, field: "target" })
                              }
                              onChange={(e) =>
                                handleUpdateRule(epochIdx, ruleIdx, "target", e.target.value)
                              }
                              placeholder="Target"
                              className="text-footnote w-full font-mono"
                            />
                          </div>

                          <span className="text-label-secondary text-footnote font-semibold">
                            /
                          </span>

                          {/* Context / Environment */}
                          <div className="flex min-w-[90px] flex-1 items-center">
                            <Input
                              type="text"
                              value={rule.context || ""}
                              onFocus={() =>
                                setFocusedInput({ epochIdx, ruleIdx, field: "context" })
                              }
                              onChange={(e) =>
                                handleUpdateRule(epochIdx, ruleIdx, "context", e.target.value)
                              }
                              placeholder="Env (e.g. V_V, _[ei], _#)"
                              className="text-footnote w-full font-mono"
                            />
                          </div>

                          {/* Move Up / Down / Delete */}
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleMoveRule(epochIdx, ruleIdx, "up")}
                              disabled={ruleIdx === 0}
                              aria-label="Move rule up"
                              className="text-label-secondary hover:text-label"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleMoveRule(epochIdx, ruleIdx, "down")}
                              disabled={ruleIdx === epoch.rules.length - 1}
                              aria-label="Move rule down"
                              className="text-label-secondary hover:text-label"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleRemoveRule(epochIdx, ruleIdx)}
                              aria-label="Remove rule"
                              className="text-label-secondary hover:text-red"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddRule(epochIdx)}
                        className="text-label-secondary hover:text-tint text-label-secondary hover:text-tint px-2"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Add Shift Rule</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Interactive Lexicon Evolution & Diff (5 cols) */}
            <div className="space-y-5 lg:col-span-5">
              {/* Proto-Lexicon Input */}
              <div className="border-separator bg-surface rounded-row shadow-card space-y-2 border p-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <label className="text-label text-footnote font-semibold">
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
                <Textarea
                  rows={4}
                  value={inputWordsText}
                  onChange={(e) => setInputWordsText(e.target.value)}
                  placeholder="Enter proto-words separated by newlines or commas..."
                  className="text-footnote w-full font-mono"
                />
                <div className="text-label-secondary text-caption flex items-center justify-between">
                  <span>{parsedWords.length} words loaded</span>
                  <span>Loaded from Stash or custom text</span>
                </div>
              </div>

              {/* Evolved Daughter Lexicon Results */}
              <div className="border-separator bg-surface rounded-row shadow-card space-y-3 border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-label text-footnote font-semibold">
                      Evolved Daughter Lexicon
                    </h4>
                    <span className="text-label-secondary text-caption">
                      {evolutionResults.length} simulated
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
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
                  >
                    <FolderDown className="h-3.5 w-3.5" />
                    <span>Save to Stash</span>
                  </Button>
                </div>

                <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
                  {evolutionResults.map((res, idx) => {
                    const isExpanded = expandedWordIdx === idx;
                    const hasChanged = res.original.toLowerCase() !== res.final.toLowerCase();

                    return (
                      <div
                        key={`${res.original}-${idx}`}
                        className={cn(
                          "border-separator bg-surface rounded-control border p-3 transition-[color,background-color,border-color,box-shadow,opacity,transform]",
                          hasChanged && "border-tint/30 bg-tint/5"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            {/* Proto Word */}
                            <div className="flex items-center gap-1">
                              <span className="text-label-secondary text-footnote font-mono">
                                *{res.original}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handlePlay(res.original)}
                                title="Pronounce Proto Word"
                                aria-label="Pronounce Proto Word"
                                className="text-label-secondary hover:text-label"
                              >
                                <Volume2 className="h-3 w-3" />
                              </Button>
                            </div>

                            <ArrowRight className="text-label-tertiary h-3 w-3 flex-shrink-0" />

                            {/* Daughter Word */}
                            <div className="flex items-center gap-1">
                              <span className="text-label text-footnote font-mono font-semibold">
                                {res.final}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => handlePlay(res.final)}
                                title="Pronounce Evolved Word"
                                aria-label="Pronounce Evolved Word"
                                className="text-tint hover:text-tint/80"
                              >
                                <Volume2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            {/* Save to Stash */}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleSaveToStash(res)}
                              title="Save to Stash"
                              aria-label="Save to Stash"
                              className="text-label-secondary hover:text-tint"
                            >
                              <Bookmark className="h-3.5 w-3.5" />
                            </Button>

                            {/* Copy */}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleCopy(res.final, idx)}
                              title="Copy Evolved Word"
                              aria-label="Copy Evolved Word"
                              className="text-label-secondary hover:text-label"
                            >
                              {copiedIdx === idx ? (
                                <Check className="text-green h-3.5 w-3.5" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>

                            {/* Trace Step toggle */}
                            {res.steps.length > 0 && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setExpandedWordIdx(isExpanded ? null : idx)}
                                title="Inspect derivation steps"
                                aria-label="Inspect derivation steps"
                                className="text-label-secondary hover:text-tint"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Step-by-Step Derivation Inspector */}
                        {isExpanded && res.steps.length > 0 && (
                          <div className="border-separator bg-fill-4 rounded-control-sm text-caption mt-2 space-y-2 border p-2">
                            <div className="text-label-secondary font-semibold uppercase">
                              Derivation Trace:
                            </div>
                            {res.steps.map((step, sIdx) => (
                              <div
                                key={sIdx}
                                className="border-separator flex items-center justify-between gap-2 border-b pb-1 font-mono last:border-none last:pb-0"
                              >
                                <span className="text-label-secondary truncate">
                                  {step.epochName}
                                </span>
                                <span className="text-tint">{step.ruleDescription}</span>
                                <span className="text-label font-semibold">
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
