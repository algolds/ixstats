"use client";

// src/app/labs/onoma/components/sections/QuickGeneratorControls.tsx
// Onoma Lab — Quick Generator Controls Bar with Expanded Seed Editor & Custom Lexicon Management

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ControlSlider as SlidersHorizontal,
  NavArrowDown as ChevronDown,
  Undo as RotateCcw,
  Plus,
  FloppyDisk as Save,
  Trash as Trash2,
  EditPencil as Edit2,
  Check,
  Xmark as X,
} from "iconoir-react";
import { GenerateCountPill } from "../shared/GenerateCountPill";
import { LengthFields, OptionText, type OptionFieldContext } from "../shared/GenerateOptionFields";
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
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { Toggle } from "~/components/ui/toggle";
import { Checkbox } from "~/components/ui/checkbox";

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
  const ctx: OptionFieldContext = { options, onChange: setOptions, look: "inspector" };
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
    selectedDict &&
    ("isCustom" in selectedDict || customDicts.some((cd) => cd.id === selectedDictId))
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
    // oxlint-disable-next-line
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
    // oxlint-disable-next-line eslint/no-shadow -- shadowed 'w' is intentional in this scope
    for (const w of wordDraft
      .split(/[,\r\n]+/)
      .map((w) => w.trim())
      .filter(Boolean)) {
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
    <div className="rounded-row bg-surface-secondary relative space-y-4 overflow-hidden p-5">
      {/* 1. Dictionary Selector & Actions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-footnote text-label font-semibold">Dictionary</label>

          {/* Dictionary Action Controls & Rules toggle */}
          <div className="flex items-center gap-2">
            <Toggle
              variant="outline"
              size="sm"
              pressed={showAdvanced}
              onPressedChange={setShowAdvanced}
              aria-expanded={showAdvanced}
              title="Toggle phonotactic rules"
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span>Rules</span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  showAdvanced && "rotate-180"
                )}
              />
            </Toggle>
            {isCustomDict && (
              <>
                {/* Update changes to this custom lexicon */}
                {isWordsModified && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleUpdateCurrentDict}
                    title="Save changes to this dictionary"
                    className="bg-green/15 text-green-ink hover:bg-green/25"
                  >
                    <Save className="h-2.5 w-2.5" />
                    <span>Save</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setIsRenaming(true);
                    setRenameTitle(selectedDict?.title || "");
                  }}

                  title="Rename this custom dictionary"
                >
                  <Edit2 className="h-2.5 w-2.5" />
                  <span>Rename</span>
                </Button>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleDeleteCurrentDict}
                  title="Delete this custom dictionary"
                  aria-label="Delete this custom dictionary"
                  className="text-red text-red bg-red/10 hover:bg-red/20"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </Button>
              </>
            )}

            {/* New Dictionary / Save As — visible only when seed words are modified */}
            {isWordsModified && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsCreatingNew(true);
                  setNewDictTitle(`${selectedDict?.title || "Custom"} (Edited)`);
                }}
                title="Save current modified words as a new custom dictionary"
              >
                <Plus className="h-2.5 w-2.5" />
                <span>Save as new</span>
              </Button>
            )}
          </div>
        </div>

        {isRenaming && (
          <div className="border-tint/30 bg-tint/5 animate-in fade-in rounded-row flex items-center gap-2 border p-2 duration-150">
            <Input
              type="text"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              placeholder="Dictionary name..."
              className="text-footnote h-7.5 flex-1 font-medium"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameCurrentDict();
                if (e.key === "Escape") setIsRenaming(false);
              }}
            />
            <Button
              size="icon-sm"
              aria-label="Save name"
              type="button"
              onClick={handleRenameCurrentDict}
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Cancel"
              type="button"
              onClick={() => setIsRenaming(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Inline Create New Lexicon Form */}
        {isCreatingNew && (
          <div className="border-tint/30 bg-tint/5 animate-in fade-in rounded-row flex items-center gap-2 border p-2 duration-150">
            <Input
              type="text"
              value={newDictTitle}
              onChange={(e) => setNewDictTitle(e.target.value)}
              placeholder="New dictionary title..."
              className="text-footnote h-7.5 flex-1 font-medium"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveAsNewDict();
                if (e.key === "Escape") setIsCreatingNew(false);
              }}
            />
            <Button
              size="icon-sm"
              aria-label="Create dictionary"
              type="button"
              onClick={handleSaveAsNewDict}
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Cancel"
              type="button"
              onClick={() => setIsCreatingNew(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        <Select value={selectedDictId} onValueChange={setSelectedDictId}>
          <SelectTrigger className="text-footnote h-9 w-full">
            <SelectValue placeholder="Select lexicon..." />
          </SelectTrigger>
          <SelectContent className="max-h-[320px]">
            {customDicts.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-tint px-2 py-1">
                  Your Lexicons ({customDicts.length})
                </SelectLabel>
                {customDicts.map((dict) => (
                  <SelectItem key={dict.id} value={dict.id} className="text-footnote font-medium">
                    <div className="flex w-full min-w-0 items-center justify-between gap-2">
                      <span className="text-label truncate font-semibold">{dict.title}</span>
                      <span className="text-label-secondary text-caption ml-auto font-mono">
                        ({dict.values.length})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}

            <SelectGroup>
              <SelectLabel className="text-label-secondary px-2 py-1">
                Built-in Presets ({publicDicts.length})
              </SelectLabel>
              {publicDicts.map((dict) => (
                <SelectItem key={dict.id} value={dict.id} className="text-footnote font-medium">
                  <span className="text-label truncate font-medium">{dict.title}</span>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* 2. Expanded Words Editor (Clean Apple Design) */}
      <div className="space-y-2">
        {(hasDuplicates || isWordsModified) && (
          <div className="flex items-center justify-end gap-2 pb-0.5">
            {hasDuplicates && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCleanWords}
                title={`Remove ${duplicateCount} duplicate word${duplicateCount === 1 ? "" : "s"}`}
                className="bg-yellow/15 text-yellow-ink hover:bg-yellow/25"
              >
                <span>Dedupe</span>
                <span className="text-caption font-mono opacity-85">({duplicateCount})</span>
              </Button>
            )}
            {isWordsModified && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetToDefault}
                title="Revert to original dictionary"
                className="text-tint"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                <span>Revert</span>
              </Button>
            )}
          </div>
        )}

        <Textarea
          value={wordDraft}
          onChange={handleTextChange}
          placeholder="Enter training words separated by commas or line breaks..."
          rows={8}
          className="text-footnote min-h-[160px] w-full resize-y font-mono"
        />

        <div className="text-caption text-label-secondary flex items-center justify-between px-0.5">
          <span className="font-normal">Comma or newline separated</span>
          <span className="text-tint bg-tint/10 py-0.2 rounded-control-sm text-caption px-2 font-mono font-medium">
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
      <GenerateCountPill
        isGenerating={isGenerating}
        generateDisabled={!selectedDictId}
        onGenerate={handleGenerate}
        batchCount={batchCount}
        setBatchCount={setBatchCount}
      />

      {showAdvanced && (
        <div className="animate-in fade-in slide-in-from-top-1 border-separator space-y-3 border-t pt-4 duration-200">
          <div className="space-y-2">
            <LengthFields ctx={ctx} className="grid grid-cols-2 gap-2" />
            <OptionText
              ctx={ctx}
              field="startsWith"
              label="Starts With"
              hint="(#_)"
              placeholder="#_"
            />
            <OptionText ctx={ctx} field="endsWith" label="Ends with" hint="(_#)" placeholder="_#" />
            <OptionText
              ctx={ctx}
              field="contains"
              label="Contains pattern"
              placeholder="e.g. 'an'"
            />
            <OptionText
              ctx={ctx}
              field="excludes"
              label="Excludes pattern"
              placeholder="e.g. 'xx'"
            />

            <div className="border-separator bg-fill-4 rounded-control flex items-center justify-between border px-3 py-2">
              <label className="text-caption text-label font-medium">Allow seed duplicates</label>
              <Checkbox
                checked={options.allowDuplicates}
                onCheckedChange={(checked) =>
                  setOptions({ ...options, allowDuplicates: checked === true })
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
