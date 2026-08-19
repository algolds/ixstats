"use client";

// src/app/labs/onoma/components/shared/SynthesisResultsGrid.tsx
// Onoma Lab — Modular Synthesis Results Grid with Emil Stagger Animations and Batch Actions

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy, Bookmark, Loader2, Plus } from "lucide-react";
import { ScienceGameIcon } from "../nav/onoma-tabs";
import { FacetCard } from "~/components/ui/facet-container";
import { NameResultCard } from "./NameResultCard";
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
  nameBank?: any[];
  handleSaveName: (name: string, stashId?: string) => Promise<any> | void;
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
  category,
  scoreNaturalness,
}: SynthesisResultsGridProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="space-y-4 w-full">
      {generatedNames.length > 0 ? (
        <div className="space-y-3.5">
          {/* Surface Toolbar: Output Count & Batch Actions */}
          <div className="border-border/40 bg-secondary/10 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-2 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="text-foreground text-xs font-bold tracking-tight">
                Synthesized Candidates
              </span>
              <span className="font-mono text-[10px] text-[#0091ff] font-bold bg-[#0091ff]/10 border border-[#0091ff]/20 px-2 py-0.5 rounded-full">
                {generatedNames.length} outputs
              </span>
            </div>

            {/* Batch Action Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCopyBatch}
                className="border-border/60 bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all active:scale-95"
                title="Copy entire batch to clipboard"
              >
                {copiedBatch ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-[#0091ff]" />
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
              className="animate-in slide-in-from-top-2 flex items-center gap-2 rounded-xl border border-[#0091ff]/30 bg-[#0091ff]/5 p-3 duration-200"
            >
              <input
                type="text"
                placeholder="Dictionary Title (e.g. 'Nordic Settlement Names')"
                required
                value={dictionaryTitle}
                onChange={(e) => setDictionaryTitle(e.target.value)}
                className="border-border/60 bg-background text-foreground flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium focus:border-[#0091ff]/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSavingDict}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#0091ff] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#33a7ff] active:scale-95 disabled:opacity-50"
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

          {/* Results Grid with Apple spring entrance and generous card proportions */}
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
        </div>
      ) : (
        <FacetCard className="border-border/40 bg-secondary/5 flex min-h-[260px] flex-col items-center justify-center p-8 text-center rounded-2xl">
          <div className="border-border/40 bg-secondary/20 mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border text-[#0091ff]">
            <ScienceGameIcon className="h-6 w-6 text-[#0091ff]/70" />
          </div>
          <h4 className="text-foreground text-sm font-bold tracking-tight">
            Ready for Domain Synthesis
          </h4>
          <p className="text-muted-foreground mt-1 max-w-sm text-xs leading-relaxed">
            Select a preset and culture above, then click{" "}
            <span className="font-mono font-semibold text-[#0091ff]">⟨Synthesize⟩</span>{" "}
            to derive vocabulary for this category.
          </p>
        </FacetCard>
      )}
    </div>
  );
}

export default SynthesisResultsGrid;
