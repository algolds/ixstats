"use client";

// src/app/labs/onoma/components/shared/SynthesisResultsGrid.tsx
// Onoma Lab — Modular Synthesis Results Surface (Adaptive Card Grid & Pro Data Table with 50-Word Cutoff)

import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy, Bookmark, SystemRestart as Loader2, Plus, ViewGrid as LayoutGrid, Table } from "iconoir-react";
import { OnomaGlyph } from "../glyphs/OnomaGlyph";
import { FacetCard } from "~/components/ui/facet-container";
import { NameResultCard } from "./NameResultCard";
import { BatchResultsTable } from "../sections/batch/BatchResultsTable";
import type { BatchNameResult } from "../sections/batch/batch-constants";
import { exportToCSV, exportToJSON } from "~/lib/onoma/name-generator";
import { translateToIPA } from "~/lib/onoma/phonology";
import { tokenizeIntoSyllables } from "~/lib/onoma/markov-chain";
import { speakName } from "~/lib/onoma/browser-speech";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { cn } from "~/lib/utils";

interface SynthesisResultsGridProps {
  generatedNames: string[];
  isGenerating: boolean;
  copiedBatch: boolean;
  handleCopyBatch: () => void;
  showSaveDictForm: boolean;
  setShowSaveDictForm: (show: boolean) => void;
  dictionaryTitle: string;
  setDictionaryTitle: (title: string) => void;
  handleSaveBatchAsDictionary: (e: React.FormEvent) => void;
  isSavingDict: boolean;
  nameBank?: Array<{ id: string; title: string; type?: string; values?: string[] }>;
  handleSaveName: (name: string, stashId?: string) => Promise<unknown> | void;
  onUseName: (name: string) => void;
  culture?: string;
  subType?: string;
  category?: string;
  scoreNaturalness?: (name: string) => number | null | undefined;
}

export function SynthesisResultsGrid({
  generatedNames,
  isGenerating,
  copiedBatch,
  handleCopyBatch,
  showSaveDictForm,
  setShowSaveDictForm,
  dictionaryTitle,
  setDictionaryTitle,
  handleSaveBatchAsDictionary,
  isSavingDict,
  nameBank = [],
  handleSaveName,
  onUseName,
  culture,
  subType,
  category = "name",
  scoreNaturalness,
}: SynthesisResultsGridProps) {
  const notify = useNotify();
  const shouldReduceMotion = useReducedMotion();

  const { data: speechConfig } = api.onoma.getSpeechConfig.useQuery(undefined, {
    staleTime: 600000,
  });

  // Adaptive view mode: defaults to table if > 50 names, grid if <= 50
  const [viewMode, setViewMode] = useState<"grid" | "table">(() =>
    generatedNames.length > 50 ? "table" : "grid"
  );

  // Auto-switch view mode when generated count crosses the 50-name threshold
  const prevCountRef = useRef(generatedNames.length);
  useEffect(() => {
    if (generatedNames.length > 50 && prevCountRef.current <= 50) {
      setViewMode("table");
    } else if (generatedNames.length <= 50 && prevCountRef.current > 50) {
      setViewMode("grid");
    }
    prevCountRef.current = generatedNames.length;
  }, [generatedNames.length]);

  // Table state
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [perplexityFilter, setPerplexityFilter] = useState(0);
  const [sorting, setSorting] = useState<{
    column: keyof BatchNameResult;
    direction: "asc" | "desc";
  }>({
    column: "name",
    direction: "asc",
  });

  // Clear selections when new names are generated
  useEffect(() => {
    setSelectedNames(new Set());
  }, [generatedNames]);

  // Transform names array to full BatchNameResult objects
  const tableData: BatchNameResult[] = useMemo(() => {
    return generatedNames.map((name) => {
      const ipa = translateToIPA(name, culture || "latin");
      const syllables = tokenizeIntoSyllables(name).length;
      const naturalness = scoreNaturalness ? (scoreNaturalness(name) ?? 85) : 85;
      return {
        name,
        ipa,
        syllables,
        perplexity: Math.max(0, 100 - naturalness),
        length: name.length,
      };
    });
  }, [generatedNames, culture, scoreNaturalness]);

  // Filter and sort for table view
  const filteredTableResults = useMemo(() => {
    let list = [...tableData];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q) || r.ipa.toLowerCase().includes(q));
    }
    if (perplexityFilter > 0) {
      list = list.filter((r) => r.perplexity <= perplexityFilter);
    }
    list.sort((a, b) => {
      const valA = a[sorting.column];
      const valB = b[sorting.column];
      if (typeof valA === "string" && typeof valB === "string") {
        return sorting.direction === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return sorting.direction === "asc"
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number);
    });
    return list;
  }, [tableData, searchQuery, perplexityFilter, sorting]);

  const handleSort = (column: keyof BatchNameResult) => {
    setSorting((prev) => ({
      column,
      direction: prev.column === column && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  const handleSelectName = (name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedNames.size === filteredTableResults.length) {
      setSelectedNames(new Set());
    } else {
      setSelectedNames(new Set(filteredTableResults.map((r) => r.name)));
    }
  };

  const handleBulkSave = async () => {
    if (selectedNames.size === 0) return;
    const namesArray = Array.from(selectedNames);
    let savedCount = 0;
    for (const name of namesArray) {
      try {
        await handleSaveName(name);
        savedCount++;
      } catch (err) {
        console.error(`Failed to save ${name}:`, err);
      }
    }
    notify.success(`Saved ${savedCount} names to your Stash.`);
    setSelectedNames(new Set());
  };

  const playName = (name: string, ipa: string) => {
    speakName({
      name,
      ipa,
      culture: culture ?? null,
      kokoroEnabled: Boolean(speechConfig?.kokoro?.enabled),
      voice: undefined,
      defaultVoice: speechConfig?.kokoro?.voice,
      forceDefaultVoice: false,
    });
  };

  const handleExportCSV = () => {
    exportToCSV(filteredTableResults, `onoma-${category}-${culture || "batch"}.csv`);
  };

  const handleExportJSON = () => {
    const meta = { count: generatedNames.length, category, culture, subType };
    exportToJSON(filteredTableResults, meta, `onoma-${category}-${culture || "batch"}.json`);
  };

  return (
    <div className="space-y-4 w-full">
      {generatedNames.length > 0 ? (
        <div className="space-y-3.5">
          {/* Horizontal Line & Unified Toolbar (View Switcher + Batch Actions) */}
          <div className="border-border/40 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            {/* Left: [ Grid ⊞ | Table ☰ ] Segmented View Toggle */}
            <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-secondary/20 p-0.5 select-none">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex cursor-pointer items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all active:scale-95",
                  viewMode === "grid"
                    ? "bg-background text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Card Grid View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex cursor-pointer items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all active:scale-95",
                  viewMode === "table"
                    ? "bg-background text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Data Table View"
              >
                <Table className="h-3.5 w-3.5" />
                <span>Table</span>
              </button>
            </div>

            {/* Right: Copy All and Save to Stash Actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopyBatch}
                className="border-border/60 bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all active:scale-95"
                title="Copy entire batch to clipboard"
              >
                {copiedBatch ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-onoma-primary" />
                )}
                <span>{copiedBatch ? "Copied" : "Copy All"}</span>
              </button>

              <button
                onClick={() => setShowSaveDictForm(!showSaveDictForm)}
                className="border-border/60 bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all active:scale-95"
                title="Save batch to your Stash"
              >
                <Bookmark className="h-3.5 w-3.5 text-indigo-500" />
                <span>Save to Stash</span>
              </button>
            </div>
          </div>

          {/* Save to Stash Form Drawer */}
          {showSaveDictForm && (
            <form
              onSubmit={handleSaveBatchAsDictionary}
              className="animate-in slide-in-from-top-2 flex items-center gap-2 rounded-xl border border-onoma-primary/30 bg-onoma-primary/5 p-3 duration-200"
            >
              <input
                type="text"
                placeholder="Dictionary Title (e.g. 'Nordic Settlement Names')"
                required
                value={dictionaryTitle}
                onChange={(e) => setDictionaryTitle(e.target.value)}
                className="border-border/60 bg-background text-foreground flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium focus:border-onoma-primary/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSavingDict}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-onoma-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-onoma-primary-light active:scale-95 disabled:opacity-50"
              >
                {isSavingDict ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                <span>Save Dictionary</span>
              </button>
            </form>
          )}

          {/* Adaptive View Rendering */}
          {viewMode === "table" ? (
            <div className={cn("transition-opacity duration-200", isGenerating && "opacity-50")}>
              <BatchResultsTable
                results={filteredTableResults}
                category={category}
                profile={culture || "any"}
                selectedNames={selectedNames}
                sorting={sorting}
                searchQuery={searchQuery}
                perplexityFilter={perplexityFilter}
                onSearchChange={setSearchQuery}
                onPerplexityChange={setPerplexityFilter}
                onSort={handleSort}
                onSelectName={handleSelectName}
                onSelectAll={handleSelectAll}
                onBulkSave={handleBulkSave}
                onPlayName={playName}
                onExportCSV={handleExportCSV}
                onExportJSON={handleExportJSON}
              />
            </div>
          ) : (
            /* Results Grid with Apple spring entrance and generous card proportions */
            <div
              className={cn(
                "grid grid-cols-1 gap-3.5 sm:grid-cols-2 2xl:grid-cols-3 transition-opacity duration-200",
                isGenerating && "opacity-50"
              )}
            >
              {generatedNames.map((name, index) => {
                const isSaved = nameBank.some(
                  (entry) => entry.type === "saved-name" && entry.title === name
                );

                const effectiveCulture =
                  culture && culture !== "any"
                    ? culture
                    : subType && subType !== "generic" && category
                      ? `${category}:${subType}`
                      : culture;

                const natScore = scoreNaturalness ? scoreNaturalness(name) : undefined;

                return (
                  <motion.div
                    key={`${name}-${index}`}
                    initial={
                      shouldReduceMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: 6 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.25,
                      delay: shouldReduceMotion ? 0 : Math.min(index * 0.025, 0.4),
                      ease: [0.23, 1, 0.32, 1],
                    }}
                  >
                    <NameResultCard
                      name={name}
                      isSaved={isSaved}
                      onSave={handleSaveName}
                      onUse={onUseName}
                      culture={effectiveCulture}
                      naturalness={natScore}
                      expandOnCardClick
                    />
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <FacetCard className="border-border/40 bg-secondary/5 flex min-h-[260px] flex-col items-center justify-center p-8 text-center rounded-2xl">
          <div className="border-border/40 bg-secondary/20 mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border text-onoma-primary">
            <OnomaGlyph name="emerge-synthesis" size="sm" className="text-onoma-primary" />
          </div>
          <h4 className="text-foreground text-sm font-bold tracking-tight">
            Ready to Generate
          </h4>
          <p className="text-muted-foreground mt-1 max-w-sm text-xs leading-relaxed">
            Select a preset and culture above, then click{" "}
            <span className="font-semibold text-onoma-primary">Generate Names</span>{" "}
            to produce vocabulary for this category.
          </p>
        </FacetCard>
      )}
    </div>
  );
}

export default SynthesisResultsGrid;
