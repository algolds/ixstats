"use client";

// src/app/labs/onoma/components/sections/QuickGeneratorControls.tsx
// Onoma Lab — Quick Generator Controls Bar with Expanded Seed Editor & Custom Lexicon Management

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  SlidersHorizontal,
  Loader2,
  ChevronDown,
  RotateCcw,
  Plus,
  Save,
  Trash2,
  Edit2,
  Check,
  X,
  Bookmark,
} from "lucide-react";
import { OnomaGlyph } from "../glyphs/OnomaGlyph";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import { PatternDepthControl } from "../shared/PatternDepthControl";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { getOnomaDomainIcon } from "../shared/onoma-icon-families";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import {
  loadCustomDictionaries,
  saveCustomDictionary,
  renameCustomDictionary,
  deleteCustomDictionary,
  CUSTOM_DICTS_CHANGED_EVENT,
  type CustomDictionary,
} from "~/lib/onoma/custom-dictionaries";
import type { GenerateOptions } from "~/lib/onoma/types";
import { cn } from "~/lib/utils";

export const getDictionaryCategoryIcon = getOnomaDomainIcon;

interface QuickGeneratorControlsProps {
  selectedDictId: string;
  setSelectedDictId: (id: string) => void;
  customWords?: string[] | null;
  setCustomWords?: (words: string[] | null) => void;
  publicDicts: Array<{
    id: string;
    title: string;
    values: string[];
    category?: string | null;
    culturalProfile?: string | null;
  }>;
  batchCount: number;
  setBatchCount: (c: number | ((prev: number) => number)) => void;
  showAdvanced: boolean;
  setShowAdvanced: (show: boolean) => void;
  options: GenerateOptions;
  setOptions: (opts: GenerateOptions) => void;
  order: number;
  setOrder: (o: number) => void;
  isGenerating: boolean;
  handleGenerate: () => void;
}

export function QuickGeneratorControls({
  selectedDictId,
  setSelectedDictId,
  customWords,
  setCustomWords,
  publicDicts,
  batchCount,
  setBatchCount,
  showAdvanced,
  setShowAdvanced,
  options,
  setOptions,
  order,
  setOrder,
  isGenerating,
  handleGenerate,
}: QuickGeneratorControlsProps) {
  // Custom Dictionaries from LocalStorage
  const [customDicts, setCustomDicts] = useState<CustomDictionary[]>([]);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newDictTitle, setNewDictTitle] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");

  const refreshCustomDicts = useCallback(() => {
    setCustomDicts(loadCustomDictionaries());
  }, []);

  useEffect(() => {
    refreshCustomDicts();
    const handleStorage = () => refreshCustomDicts();
    window.addEventListener(CUSTOM_DICTS_CHANGED_EVENT, handleStorage);
    return () => {
      window.removeEventListener(CUSTOM_DICTS_CHANGED_EVENT, handleStorage);
    };
  }, [refreshCustomDicts]);

  // Combined dictionary map (Custom + Built-in)
  const allDicts = useMemo(() => {
    return [...customDicts, ...publicDicts];
  }, [customDicts, publicDicts]);

  const selectedDict = allDicts.find((d) => d.id === selectedDictId);
  const isCustomDict = Boolean(
    selectedDict && ("isCustom" in selectedDict || customDicts.some((cd) => cd.id === selectedDictId))
  );

  const defaultValues: string[] = useMemo(() => {
    return Array.isArray(selectedDict?.values) ? (selectedDict.values as string[]) : [];
  }, [selectedDict]);

  const activeWords = useMemo(() => {
    if (customWords && customWords.length > 0) return customWords;
    return defaultValues;
  }, [customWords, defaultValues]);

  const [wordDraft, setWordDraft] = useState<string>("");

  // Sync draft when active dictionary changes or custom words update
  useEffect(() => {
    if (customWords && customWords.length > 0) {
      setWordDraft(customWords.join(", "));
    } else {
      setWordDraft(defaultValues.join(", "));
    }
  }, [selectedDictId, defaultValues, customWords]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setWordDraft(text);
    const parsed = text
      .split(/[,\r\n]+/)
      .map((w) => w.trim())
      .filter(Boolean);
    setCustomWords?.(parsed.length > 0 ? parsed : null);
  };

  const handleResetToDefault = () => {
    setCustomWords?.(null);
    setWordDraft(defaultValues.join(", "));
  };

  // Real-time scan for duplicate tokens in draft seed words (active on load & edits)
  const parsedWords = useMemo(() => {
    return wordDraft
      .split(/[,\r\n]+/)
      .map((w) => w.trim())
      .filter(Boolean);
  }, [wordDraft]);

  const duplicateCount = useMemo(() => {
    const seen = new Set<string>();
    let dupes = 0;
    for (const w of parsedWords) {
      const normalized = w.toLowerCase();
      if (seen.has(normalized)) {
        dupes++;
      } else {
        seen.add(normalized);
      }
    }
    return dupes;
  }, [parsedWords]);

  const hasDuplicates = duplicateCount > 0;

  const handleCleanWords = () => {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const w of wordDraft.split(/[,\r\n]+/).map((w) => w.trim()).filter(Boolean)) {
      const normalized = w.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        unique.push(w);
      }
    }
    setWordDraft(unique.join(", "));
    setCustomWords?.(unique.length > 0 ? unique : null);
  };

  // Save current words as a new custom dictionary
  const handleSaveAsNewDict = () => {
    if (!newDictTitle.trim() || activeWords.length === 0) return;
    const created = saveCustomDictionary(newDictTitle.trim(), activeWords);
    refreshCustomDicts();
    setSelectedDictId(created.id);
    setCustomWords?.(null);

    setIsCreatingNew(false);
    setNewDictTitle("");
  };

  // Overwrite/Update existing custom dictionary
  const handleUpdateCurrentDict = () => {
    if (!isCustomDict || !selectedDictId) return;
    saveCustomDictionary(selectedDict?.title || "Custom Lexicon", activeWords, selectedDictId);
    refreshCustomDicts();
    setCustomWords?.(null);
  };

  // Rename current custom dictionary
  const handleRenameCurrentDict = () => {
    if (!isCustomDict || !selectedDictId || !renameTitle.trim()) return;
    renameCustomDictionary(selectedDictId, renameTitle.trim());
    refreshCustomDicts();
    setIsRenaming(false);
    setRenameTitle("");
  };

  // Delete current custom dictionary
  const handleDeleteCurrentDict = () => {
    if (!isCustomDict || !selectedDictId) return;
    deleteCustomDictionary(selectedDictId);
    refreshCustomDicts();
    // Fall back to first public dictionary
    if (publicDicts.length > 0) {
      setSelectedDictId(publicDicts[0].id);
      setCustomWords?.(null);
    }
  };

  const isWordsModified = Boolean(
    customWords &&
      customWords.length > 0 &&
      (customWords.length !== defaultValues.length ||
        customWords.some((w, idx) => w !== defaultValues[idx]))
  );

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-200/85 bg-white/95 dark:border-zinc-800/85 dark:bg-zinc-900/90 p-4.5 shadow-sm space-y-4">
      {/* Specular top highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-[#0091ff]/30 via-[#0091ff]/10 to-transparent" />

      {/* 1. Dictionary Selector & Actions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-zinc-800 dark:text-zinc-200 text-xs font-semibold tracking-tight">
            Dictionary
          </label>

          {/* Dictionary Action Controls & Rules toggle */}
          <div className="flex items-center gap-1.5">
            {/* Rules / Constraints toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={cn(
                "flex cursor-pointer items-center gap-1 text-xs font-medium tracking-tight transition-all px-2.5 py-0.5 rounded-lg border shadow-2xs active:scale-95",
                showAdvanced
                  ? "border-[#0091ff]/40 bg-[#0091ff]/10 text-[#0091ff]"
                  : "border-zinc-200/80 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              )}
              title="Toggle phonotactic rules"
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span>Rules</span>
              <ChevronDown
                className={cn("h-3 w-3 transition-transform duration-200", showAdvanced && "rotate-180")}
              />
            </button>
            {isCustomDict && (
              <>
                {/* Update changes to this custom lexicon */}
                {isWordsModified && (
                  <button
                    type="button"
                    onClick={handleUpdateCurrentDict}
                    className="flex cursor-pointer items-center gap-1 text-[11px] font-medium tracking-tight text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 px-2 py-0.5 rounded-lg transition-all shadow-2xs active:scale-95"
                    title="Save changes to this dictionary"
                  >
                    <Save className="h-2.5 w-2.5" />
                    <span>Save</span>
                  </button>
                )}

                {/* Rename custom dictionary */}
                <button
                  type="button"
                  onClick={() => {
                    setIsRenaming(true);
                    setRenameTitle(selectedDict?.title || "");
                  }}
                  className="flex cursor-pointer items-center gap-1 text-[11px] font-medium tracking-tight text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white px-2 py-0.5 rounded-lg border border-zinc-200/80 dark:border-zinc-700 transition-all shadow-2xs active:scale-95"
                  title="Rename this custom dictionary"
                >
                  <Edit2 className="h-2.5 w-2.5" />
                  <span>Rename</span>
                </button>

                {/* Delete custom dictionary */}
                <button
                  type="button"
                  onClick={handleDeleteCurrentDict}
                  className="flex cursor-pointer items-center text-[11px] font-medium tracking-tight text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 p-1.5 rounded-lg transition-all shadow-2xs active:scale-95"
                  title="Delete this custom dictionary"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </>
            )}

            {/* New Dictionary / Save As — visible only when seed words are modified */}
            {isWordsModified && (
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNew(true);
                  setNewDictTitle(
                    `${selectedDict?.title || "Custom"} (Edited)`
                  );
                }}
                className="flex cursor-pointer items-center gap-1 text-[11px] font-medium tracking-tight text-[#0091ff] bg-[#0091ff]/10 hover:bg-[#0091ff]/15 border border-[#0091ff]/25 px-2 py-0.5 rounded-lg transition-all shadow-2xs active:scale-95 animate-in fade-in duration-150"
                title="Save current modified words as a new custom dictionary"
              >
                <Plus className="h-2.5 w-2.5" />
                <span>Save As New</span>
              </button>
            )}
          </div>
        </div>

        {/* Inline Rename Form */}
        {isRenaming && (
          <div className="flex items-center gap-1.5 p-1.5 rounded-xl border border-[#0091ff]/30 bg-[#0091ff]/5 animate-in fade-in duration-150">
            <input
              type="text"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              placeholder="Dictionary name..."
              className="h-7.5 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 text-xs font-medium text-foreground focus:border-[#0091ff]/60 focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameCurrentDict();
                if (e.key === "Escape") setIsRenaming(false);
              }}
            />
            <button
              type="button"
              onClick={handleRenameCurrentDict}
              className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-[#0091ff] text-white hover:bg-[#0080e6] active:scale-95 cursor-pointer shadow-xs"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setIsRenaming(false)}
              className="flex h-7.5 w-7.5 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 active:scale-95 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Inline Create New Lexicon Form */}
        {isCreatingNew && (
          <div className="flex items-center gap-1.5 p-1.5 rounded-xl border border-[#0091ff]/30 bg-[#0091ff]/5 animate-in fade-in duration-150">
            <input
              type="text"
              value={newDictTitle}
              onChange={(e) => setNewDictTitle(e.target.value)}
              placeholder="New dictionary title..."
              className="h-7.5 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 text-xs font-medium text-foreground focus:border-[#0091ff]/60 focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveAsNewDict();
                if (e.key === "Escape") setIsCreatingNew(false);
              }}
            />
            <button
              type="button"
              onClick={handleSaveAsNewDict}
              className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-[#0091ff] text-white hover:bg-[#0080e6] active:scale-95 cursor-pointer shadow-xs"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingNew(false)}
              className="flex h-7.5 w-7.5 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 active:scale-95 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Dictionary Select Dropdown */}
        <Select value={selectedDictId} onValueChange={setSelectedDictId}>
          <SelectTrigger className="border-zinc-200/85 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/60 hover:bg-white dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 h-9 w-full rounded-xl border px-3 text-xs font-medium tracking-tight transition-all focus:border-[#0091ff]/60 focus:outline-none shadow-2xs">
            <SelectValue placeholder="Select lexicon..." />
          </SelectTrigger>
          <SelectContent className="border-zinc-200/80 dark:border-zinc-700/80 bg-popover/95 max-h-[320px] backdrop-blur-xl shadow-lg">
            {/* Custom Dictionaries Group */}
            {customDicts.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-[10px] uppercase font-semibold text-[#0091ff] tracking-wider px-2 py-1">
                  Your Lexicons ({customDicts.length})
                </SelectLabel>
                {customDicts.map((dict) => (
                  <SelectItem
                    key={dict.id}
                    value={dict.id}
                    className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer py-1.5 font-medium"
                  >
                    <div className="flex items-center justify-between min-w-0 w-full gap-2">
                      <span className="font-semibold text-foreground truncate">{dict.title}</span>
                      <span className="text-[10px] font-mono text-muted-foreground ml-auto">({dict.values.length})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}

            {/* Built-in Presets Group */}
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider px-2 py-1">
                Built-in Presets ({publicDicts.length})
              </SelectLabel>
              {publicDicts.map((dict) => (
                <SelectItem
                  key={dict.id}
                  value={dict.id}
                  className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer py-1.5 font-medium"
                >
                  <span className="font-medium text-foreground truncate">{dict.title}</span>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* 2. Expanded Words Editor (Clean Apple Design) */}
      <div className="space-y-1.5">
        {(hasDuplicates || isWordsModified) && (
          <div className="flex items-center justify-end gap-1.5 pb-0.5">
            {hasDuplicates && (
              <button
                type="button"
                onClick={handleCleanWords}
                className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/20 flex items-center gap-1 cursor-pointer transition-all px-2 py-0.5 rounded-lg active:scale-95 shadow-2xs animate-in fade-in zoom-in-95 duration-150 tracking-tight"
                title={`Remove ${duplicateCount} duplicate word${duplicateCount === 1 ? "" : "s"}`}
              >
                <span>Dedupe</span>
                <span className="font-mono text-[9.5px] opacity-85">({duplicateCount})</span>
              </button>
            )}
            {isWordsModified && (
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-[11px] font-medium text-[#0091ff] hover:underline flex items-center gap-1 cursor-pointer px-1.5 py-0.5 tracking-tight"
                title="Revert to original dictionary"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                <span>Revert</span>
              </button>
            )}
          </div>
        )}

        <textarea
          value={wordDraft}
          onChange={handleTextChange}
          placeholder="Enter training words separated by commas or line breaks..."
          rows={8}
          className="border border-zinc-200/90 dark:border-zinc-700/80 bg-white dark:bg-zinc-900/90 text-foreground placeholder:text-muted-foreground/50 w-full min-h-[160px] resize-y rounded-xl p-3 font-mono text-[12px] tracking-tight leading-relaxed focus:border-[#0091ff]/60 focus:ring-1 focus:ring-[#0091ff]/25 focus:outline-none shadow-inner"
        />

        <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 px-0.5">
          <span className="font-normal">Comma or newline separated</span>
          <span className="font-mono text-[10.5px] font-medium text-[#0091ff] bg-[#0091ff]/10 px-1.5 py-0.2 rounded-md">
            {activeWords.length} active words
          </span>
        </div>
      </div>

      {/* 3. Pattern Depth (Apple Stepped Pill Group with Spring Feel) */}
      <PatternDepthControl
        value={order}
        onChange={setOrder}
        variant="segmented"
        showDescription={false}
      />

      {/* 4. Batch Size Stepper */}
      {/* 4. Unified Generate Action & Quantity Pill */}
      <div className="relative flex h-11 w-full items-center rounded-xl bg-[#0091ff] hover:bg-[#0086eb] active:bg-[#007cdb] shadow-md shadow-[#0091ff]/25 border border-white/20 select-none overflow-hidden transition-all group">
        {/* Left / Center: Primary Generate Action Trigger */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || !selectedDictId}
          className="flex h-full flex-1 cursor-pointer items-center justify-center gap-2 pl-4 pr-3 text-xs font-semibold tracking-tight text-white transition-all active:scale-[0.98] disabled:opacity-40 select-none"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <OnomaGlyph
              name="emerge-synthesis"
              size="xs"
              className="text-white transition-transform group-hover:scale-110"
            />
          )}
          <span className="text-sm font-semibold tracking-tight">Generate</span>
        </button>

        {/* Subtle Vertical Divider */}
        <div className="h-5 w-[1px] bg-white/25 shrink-0" />

        {/* Right: Quantity Stepper Pill */}
        <div className="flex h-full items-center pr-1.5 pl-1 text-white shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setBatchCount((c) =>
                c > 100 ? Math.max(100, c - 50) : c > 50 ? Math.max(50, c - 25) : Math.max(5, c - 5)
              )
            }}
            disabled={batchCount <= 5 || isGenerating}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white/80 hover:text-white hover:bg-black/15 active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-all"
            title="Decrease count"
            aria-label="Decrease count"
          >
            -
          </button>
          <div className="flex items-center px-1 min-w-[28px] justify-center text-sm font-bold tracking-tight text-white leading-none">
            <NumberFlowDisplay value={batchCount} className="text-sm font-bold tracking-tight text-white" />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setBatchCount((c) =>
                c >= 100 ? Math.min(500, c + 50) : c >= 50 ? Math.min(100, c + 25) : c + 5
              )
            }}
            disabled={batchCount >= 500 || isGenerating}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white/80 hover:text-white hover:bg-black/15 active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-all"
            title="Increase count"
            aria-label="Increase count"
          >
            +
          </button>
        </div>
      </div>

      {/* Collapsible Phonotactics & Constraints */}
      {showAdvanced && (
        <div className="animate-in fade-in slide-in-from-top-1 border-border/30 space-y-3 border-t pt-3.5 duration-200">
          <div className="space-y-2.5">
            {/* Length Range */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-zinc-700 dark:text-zinc-300 text-[11px] font-medium tracking-tight block">
                  Min Length
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={options.minLength || 4}
                  onChange={(e) =>
                    setOptions({ ...options, minLength: parseInt(e.target.value) || 0 })
                  }
                  className="border-border/60 bg-background text-foreground font-mono w-full rounded-lg border px-2.5 py-1 text-xs focus:border-[#0091ff]/50 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-700 dark:text-zinc-300 text-[11px] font-medium tracking-tight block">
                  Max Length
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={options.maxLength || 12}
                  onChange={(e) =>
                    setOptions({ ...options, maxLength: parseInt(e.target.value) || 0 })
                  }
                  className="border-border/60 bg-background text-foreground font-mono w-full rounded-lg border px-2.5 py-1 text-xs focus:border-[#0091ff]/50 focus:outline-none"
                />
              </div>
            </div>

            {/* Prefix / Suffix Affixes */}
            <div className="space-y-1">
              <label className="text-zinc-700 dark:text-zinc-300 text-[11px] font-medium tracking-tight block">
                Starts With <span className="font-mono text-[10px] text-muted-foreground/75">(#_)</span>
              </label>
              <input
                type="text"
                placeholder="#_"
                value={options.startsWith || ""}
                onChange={(e) => setOptions({ ...options, startsWith: e.target.value })}
                className="border-border/60 bg-background text-foreground font-mono w-full rounded-lg border px-2.5 py-1 text-xs focus:border-[#0091ff]/50 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-zinc-700 dark:text-zinc-300 text-[11px] font-medium tracking-tight block">
                Ends With <span className="font-mono text-[10px] text-muted-foreground/75">(_#)</span>
              </label>
              <input
                type="text"
                placeholder="_#"
                value={options.endsWith || ""}
                onChange={(e) => setOptions({ ...options, endsWith: e.target.value })}
                className="border-border/60 bg-background text-foreground font-mono w-full rounded-lg border px-2.5 py-1 text-xs focus:border-[#0091ff]/50 focus:outline-none"
              />
            </div>

            {/* Contains Filter */}
            <div className="space-y-1">
              <label className="text-zinc-700 dark:text-zinc-300 text-[11px] font-medium tracking-tight block">
                Contains Pattern
              </label>
              <input
                type="text"
                placeholder="e.g. 'an'"
                value={options.contains || ""}
                onChange={(e) => setOptions({ ...options, contains: e.target.value })}
                className="border-border/60 bg-background text-foreground font-mono w-full rounded-lg border px-2.5 py-1 text-xs focus:border-[#0091ff]/50 focus:outline-none"
              />
            </div>

            {/* Excludes Filter */}
            <div className="space-y-1">
              <label className="text-zinc-700 dark:text-zinc-300 text-[11px] font-medium tracking-tight block">
                Excludes Pattern
              </label>
              <input
                type="text"
                placeholder="e.g. 'xx'"
                value={options.excludes || ""}
                onChange={(e) => setOptions({ ...options, excludes: e.target.value })}
                className="border-border/60 bg-background text-foreground font-mono w-full rounded-lg border px-2.5 py-1 text-xs focus:border-[#0091ff]/50 focus:outline-none"
              />
            </div>

            {/* Permit Seed Duplicates */}
            <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/15 px-2.5 py-2">
              <label className="text-zinc-700 dark:text-zinc-300 text-[11px] font-medium tracking-tight">
                Allow Seed Duplicates
              </label>
              <input
                type="checkbox"
                checked={options.allowDuplicates}
                onChange={(e) => setOptions({ ...options, allowDuplicates: e.target.checked })}
                className="border-border/60 h-3.5 w-3.5 rounded text-[#0091ff] focus:ring-[#0091ff]/50 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuickGeneratorControls;
