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
  publicDicts: any[];
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

  const DictCorpusIcon = getOnomaDomainIcon();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-200/85 bg-white/95 dark:border-zinc-800/85 dark:bg-zinc-900/90 p-4.5 shadow-sm space-y-4">
      {/* Specular top highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-[#0091ff]/30 via-[#0091ff]/10 to-transparent" />

      {/* Top Header Row */}

      <div className="relative z-10 border-zinc-200/60 dark:border-zinc-800 flex items-center justify-between border-b pb-3">

        <div className="flex items-center gap-2">
          <h3 className="text-zinc-900 dark:text-zinc-50 text-xs font-bold tracking-tight">
            Quick Generator
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            "flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold transition-all px-2.5 py-1 rounded-lg border shadow-2xs active:scale-95",
            showAdvanced
              ? "border-[#0091ff]/40 bg-[#0091ff]/10 text-[#0091ff]"
              : "border-zinc-200/80 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          )}
          title="Toggle phonotactic constraints"
        >
          <SlidersHorizontal className="h-3 w-3" />
          <span>Rules</span>
          <ChevronDown
            className={cn("h-3 w-3 transition-transform duration-200", showAdvanced && "rotate-180")}
          />
        </button>
      </div>

      {/* 1. Dictionary Selector & Actions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 text-xs font-semibold">
            <DictCorpusIcon className="h-3.5 w-3.5 text-[#0091ff]" />
            <span>Dictionary</span>
          </label>

          {/* Dictionary Action Controls */}
          <div className="flex items-center gap-1">
            {isCustomDict && (
              <>
                {/* Update changes to this custom lexicon */}
                {isWordsModified && (
                  <button
                    type="button"
                    onClick={handleUpdateCurrentDict}
                    className="flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 px-2 py-0.5 rounded-md transition-all shadow-2xs active:scale-95"
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
                  className="flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white px-2 py-0.5 rounded-md border border-zinc-200/80 dark:border-zinc-700 transition-all shadow-2xs active:scale-95"
                  title="Rename this custom dictionary"
                >
                  <Edit2 className="h-2.5 w-2.5" />
                  <span>Rename</span>
                </button>

                {/* Delete custom dictionary */}
                <button
                  type="button"
                  onClick={handleDeleteCurrentDict}
                  className="flex cursor-pointer items-center text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 p-1 rounded-md transition-all shadow-2xs active:scale-95"
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
                className="flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-[#0091ff] bg-[#0091ff]/10 hover:bg-[#0091ff]/15 border border-[#0091ff]/25 px-2 py-0.5 rounded-md transition-all shadow-2xs active:scale-95 animate-in fade-in duration-150"
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
              className="h-7 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-xs font-medium text-foreground focus:border-[#0091ff]/60 focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameCurrentDict();
                if (e.key === "Escape") setIsRenaming(false);
              }}
            />
            <button
              type="button"
              onClick={handleRenameCurrentDict}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0091ff] text-white hover:bg-[#0080e6] active:scale-95 cursor-pointer shadow-xs"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setIsRenaming(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 active:scale-95 cursor-pointer"
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
              className="h-7 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 text-xs font-medium text-foreground focus:border-[#0091ff]/60 focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveAsNewDict();
                if (e.key === "Escape") setIsCreatingNew(false);
              }}
            />
            <button
              type="button"
              onClick={handleSaveAsNewDict}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0091ff] text-white hover:bg-[#0080e6] active:scale-95 cursor-pointer shadow-xs"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingNew(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 active:scale-95 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Dictionary Select Dropdown */}
        <Select value={selectedDictId} onValueChange={setSelectedDictId}>
          <SelectTrigger className="border-zinc-200 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/60 hover:bg-white dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 h-9 w-full rounded-xl border px-3 text-xs font-medium transition-all focus:border-[#0091ff]/60 focus:outline-none shadow-2xs">
            <SelectValue placeholder="Select lexicon..." />
          </SelectTrigger>
          <SelectContent className="border-zinc-200/80 dark:border-zinc-700/80 bg-popover/95 max-h-[320px] backdrop-blur-xl shadow-lg">
            {/* Custom Dictionaries Group */}
            {customDicts.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-[10px] uppercase font-bold text-[#0091ff] tracking-wider px-2 py-1">
                  Your Lexicons ({customDicts.length})
                </SelectLabel>
                {customDicts.map((dict) => (
                  <SelectItem
                    key={dict.id}
                    value={dict.id}
                    className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer py-1.5"
                  >
                    <div className="flex items-center gap-2 min-w-0 w-full">
                      <Bookmark className="h-3.5 w-3.5 flex-shrink-0 text-[#0091ff]" />
                      <span className="font-semibold text-foreground truncate">{dict.title}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">({dict.values.length})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}

            {/* Built-in Presets Group */}
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider px-2 py-1">
                Built-in Presets ({publicDicts.length})
              </SelectLabel>
              {publicDicts.map((dict) => {
                const DictCategoryIcon = getOnomaDomainIcon(dict);
                return (
                  <SelectItem
                    key={dict.id}
                    value={dict.id}
                    className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer py-1.5"
                  >
                    <div className="flex items-center gap-2 min-w-0 w-full">
                      <DictCategoryIcon className="h-3.5 w-3.5 flex-shrink-0 text-[#0091ff]" />
                      <span className="font-medium text-foreground truncate">{dict.title}</span>
                    </div>
                  </SelectItem>
                );
              })}
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
                className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/20 flex items-center gap-1 cursor-pointer transition-all px-2 py-0.5 rounded-md active:scale-95 shadow-2xs animate-in fade-in zoom-in-95 duration-150"
                title={`Remove ${duplicateCount} duplicate word${duplicateCount === 1 ? "" : "s"}`}
              >
                <span>Dedupe</span>
                <span className="font-mono text-[9px] opacity-85">({duplicateCount})</span>
              </button>
            )}
            {isWordsModified && (
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-[10px] font-semibold text-[#0091ff] hover:underline flex items-center gap-0.5 cursor-pointer px-1.5 py-0.5"
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
          rows={4}
          className="border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-foreground placeholder:text-muted-foreground/60 w-full resize-y rounded-xl p-2.5 font-mono text-xs focus:border-[#0091ff]/60 focus:outline-none leading-relaxed shadow-inner"
        />

        <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 px-0.5">
          <span>Comma or newline separated</span>
          <span className="font-mono">{activeWords.length} active words</span>
        </div>
      </div>

      {/* 3. Parameters Grid (Order & Batch Size) */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Order Stepper */}
        <div className="space-y-1">
          <label className="text-zinc-600 dark:text-zinc-400 text-[10px] font-semibold uppercase tracking-wider block">
            Order
          </label>
          <div className="flex h-9 w-full items-center justify-between rounded-xl border border-zinc-200/80 bg-zinc-100/70 p-1 select-none dark:border-zinc-700/70 dark:bg-zinc-800/60 shadow-2xs">
            <button
              type="button"
              onClick={() => setOrder(Math.max(1, order - 1))}
              disabled={order <= 1}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-xs font-bold text-zinc-700 shadow-2xs transition-all hover:bg-zinc-50 active:scale-95 disabled:opacity-30 disabled:shadow-none dark:bg-zinc-700 dark:text-zinc-200"
            >
              -
            </button>
            <span className="font-mono text-xs font-bold text-[#0091ff]">n={order}</span>
            <button
              type="button"
              onClick={() => setOrder(Math.min(4, order + 1))}
              disabled={order >= 4}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-xs font-bold text-zinc-700 shadow-2xs transition-all hover:bg-zinc-50 active:scale-95 disabled:opacity-30 disabled:shadow-none dark:bg-zinc-700 dark:text-zinc-200"
            >
              +
            </button>
          </div>
        </div>

        {/* Batch Size Stepper */}
        <div className="space-y-1">
          <label className="text-zinc-600 dark:text-zinc-400 text-[10px] font-semibold uppercase tracking-wider block">
            Batch Size
          </label>
          <div className="flex h-9 w-full items-center justify-between rounded-xl border border-zinc-200/80 bg-zinc-100/70 p-1 select-none dark:border-zinc-700/70 dark:bg-zinc-800/60 shadow-2xs">
            <button
              type="button"
              onClick={() => setBatchCount((c) => Math.max(5, c - 5))}
              disabled={batchCount <= 5}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-xs font-bold text-zinc-700 shadow-2xs transition-all hover:bg-zinc-50 active:scale-95 disabled:opacity-30 disabled:shadow-none dark:bg-zinc-700 dark:text-zinc-200"
            >
              -
            </button>
            <div className="flex items-center gap-1 font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
              <NumberFlowDisplay value={batchCount} className="text-xs font-bold" />
            </div>
            <button
              type="button"
              onClick={() => setBatchCount((c) => Math.min(100, c + 5))}
              disabled={batchCount >= 100}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-xs font-bold text-zinc-700 shadow-2xs transition-all hover:bg-zinc-50 active:scale-95 disabled:opacity-30 disabled:shadow-none dark:bg-zinc-700 dark:text-zinc-200"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* 4. Primary Synthesize Button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !selectedDictId}
        className="group relative flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0091ff] hover:bg-[#0080e6] active:bg-[#0070cc] px-4 text-xs font-bold text-white shadow-sm shadow-[#0091ff]/25 transition-all duration-150 active:scale-[0.98] disabled:opacity-40 select-none"
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <OnomaGlyph name="emerge-synthesis" size="xs" className="text-white transition-transform group-hover:scale-110" />
        )}
        <span className="tracking-tight">Synthesize Batch</span>
      </button>

      {/* Collapsible Phonotactics & Constraints */}
      {showAdvanced && (
        <div className="animate-in fade-in slide-in-from-top-1 border-border/30 space-y-3 border-t pt-3.5 duration-200">
          <div className="space-y-2.5">
            {/* Length Range */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-muted-foreground font-mono text-[9px] font-semibold uppercase">
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
                  className="border-border/60 bg-background text-foreground font-mono w-full rounded-lg border px-2 py-1 text-xs focus:border-[#0091ff]/50 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground font-mono text-[9px] font-semibold uppercase">
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
                  className="border-border/60 bg-background text-foreground font-mono w-full rounded-lg border px-2 py-1 text-xs focus:border-[#0091ff]/50 focus:outline-none"
                />
              </div>
            </div>

            {/* Prefix / Suffix Affixes */}
            <div className="space-y-1">
              <label className="text-muted-foreground font-mono text-[9px] font-semibold uppercase">
                Starts With (#_)
              </label>
              <input
                type="text"
                placeholder="#_"
                value={options.startsWith || ""}
                onChange={(e) => setOptions({ ...options, startsWith: e.target.value })}
                className="border-border/60 bg-background text-foreground font-mono w-full rounded-lg border px-2 py-1 text-xs focus:border-[#0091ff]/50 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-muted-foreground font-mono text-[9px] font-semibold uppercase">
                Ends With (_#)
              </label>
              <input
                type="text"
                placeholder="_#"
                value={options.endsWith || ""}
                onChange={(e) => setOptions({ ...options, endsWith: e.target.value })}
                className="border-border/60 bg-background text-foreground font-mono w-full rounded-lg border px-2 py-1 text-xs focus:border-[#0091ff]/50 focus:outline-none"
              />
            </div>

            {/* Contains Filter */}
            <div className="space-y-1">
              <label className="text-muted-foreground font-mono text-[9px] font-semibold uppercase">
                Contains
              </label>
              <input
                type="text"
                placeholder="e.g. 'an'"
                value={options.contains || ""}
                onChange={(e) => setOptions({ ...options, contains: e.target.value })}
                className="border-border/60 bg-background text-foreground font-mono w-full rounded-lg border px-2 py-1 text-xs focus:border-[#0091ff]/50 focus:outline-none"
              />
            </div>

            {/* Excludes Filter */}
            <div className="space-y-1">
              <label className="text-muted-foreground font-mono text-[9px] font-semibold uppercase">
                Excludes
              </label>
              <input
                type="text"
                placeholder="e.g. 'xx'"
                value={options.excludes || ""}
                onChange={(e) => setOptions({ ...options, excludes: e.target.value })}
                className="border-border/60 bg-background text-foreground font-mono w-full rounded-lg border px-2 py-1 text-xs focus:border-[#0091ff]/50 focus:outline-none"
              />
            </div>

            {/* Permit Seed Duplicates */}
            <div className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/15 px-2.5 py-1.5 pt-2">
              <label className="text-muted-foreground text-[11px] font-medium">
                Allow Duplicates
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
