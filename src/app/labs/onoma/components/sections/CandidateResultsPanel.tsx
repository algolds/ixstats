"use client";

// src/app/labs/onoma/components/sections/CandidateResultsPanel.tsx
// Onoma Lab — Candidate Results List Panel subcomponent

import { Check, Copy, Bookmark, Loader2, Plus, Wand2 } from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import { NameResultCard } from "../shared/NameResultCard";
import { cn } from "~/lib/utils";

interface CandidateResultsPanelProps {
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
}

export function CandidateResultsPanel({
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
}: CandidateResultsPanelProps) {
  return (
    <div className="space-y-4 lg:col-span-7">
      <div className="relative w-full rounded-xl">
        {/* Apple Intelligence inspired outer glow layers */}
        <div
          style={{ filter: "blur(6px)" }}
          className={cn(
            "pointer-events-none absolute -inset-1.5 z-0 rounded-xl bg-[linear-gradient(90deg,#0091ff,#0052cc,#00d2ff,#1a2035,#0091ff)] bg-[length:200%] transition-opacity duration-300",
            isGenerating ? "animate-rainbow-fast opacity-25" : "opacity-0"
          )}
        />
        {/* The 1px animated gradient border layer */}
        <div
          className={cn(
            "pointer-events-none absolute -inset-[1px] z-0 rounded-xl bg-[linear-gradient(90deg,#0091ff,#0052cc,#00d2ff,#1a2035,#0091ff)] bg-[length:200%] transition-opacity duration-300",
            isGenerating ? "animate-rainbow-fast opacity-55" : "opacity-0"
          )}
        />
        {/* Ripple Underneath Animation */}
        <div
          className={cn(
            "pointer-events-none absolute -inset-3.5 z-0 rounded-xl bg-[linear-gradient(90deg,#0091ff,#0052cc,#00d2ff,#1a2035,#0091ff)] blur-[12px] transition-opacity duration-300",
            isGenerating ? "animate-ripple-underneath opacity-100" : "opacity-0"
          )}
        />

        {generatedNames.length > 0 ? (
          <FacetCard
            className={cn(
              "relative z-10 space-y-4 p-4 transition-all duration-300",
              isGenerating
                ? "bg-secondary/[0.04] border-transparent shadow-[0_0_15px_rgba(0,145,255,0.15)] backdrop-blur-md"
                : "border-border/40 bg-secondary/5 border"
            )}
          >
            <div
              className={cn(
                "space-y-4 transition-all duration-300 ease-in-out",
                isGenerating ? "scale-[0.98] opacity-40 blur-sm" : "scale-100 opacity-100 blur-none"
              )}
            >
              <div className="border-border/40 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                <div>
                  <h3 className="text-foreground text-sm font-bold tracking-tight">
                    Assembled Candidates
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    Click name cards to copy, save, or deploy them in game.
                  </p>
                </div>

                {/* Batch Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyBatch}
                    className="border-border/60 bg-background text-muted-foreground hover:text-foreground hover:bg-secondary/40 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all"
                  >
                    {copiedBatch ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{copiedBatch ? "Copied" : "Copy Batch"}</span>
                  </button>

                  <button
                    onClick={() => setShowSaveDictForm(!showSaveDictForm)}
                    className="border-border/60 bg-background text-muted-foreground hover:text-foreground hover:bg-secondary/40 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all"
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    <span>Save Dictionary</span>
                  </button>
                </div>
              </div>

              {/* Save Dictionary Form */}
              {showSaveDictForm && (
                <form
                  onSubmit={handleSaveBatchAsDictionary}
                  className="animate-in slide-in-from-top-2 flex items-center gap-2 rounded-xl border border-[#0091ff]/20 bg-[#0091ff]/5 p-3 duration-300"
                >
                  <input
                    type="text"
                    placeholder="Dictionary Title (e.g. Generated Cities)"
                    required
                    value={dictionaryTitle}
                    onChange={(e) => setDictionaryTitle(e.target.value)}
                    className="border-border/60 bg-background text-foreground flex-1 rounded-lg border px-3 py-1.5 text-xs focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSavingDict}
                    className="flex items-center gap-1.5 rounded-lg bg-[#0091ff] px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#33a7ff] disabled:opacity-50"
                  >
                    {isSavingDict ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    <span>Save</span>
                  </button>
                </form>
              )}

              {/* Results Grid */}
              <div className="grid max-h-[500px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                {generatedNames.map((name, idx) => (
                  <NameResultCard
                    key={`${name}-${idx}`}
                    name={name}
                    isSaved={nameBank.some(
                      (entry) => entry.type === "saved-name" && entry.title === name
                    )}
                    onSave={async (name, stashId) => {
                      await handleSaveName(name, stashId);
                    }}
                    onUse={onUseName}
                  />
                ))}
              </div>
            </div>
          </FacetCard>
        ) : (
          <FacetCard
            className={cn(
              "border-border/40 bg-secondary/5 text-muted-foreground relative border border-dashed p-8 text-center text-sm transition-all duration-300",
              isGenerating
                ? "bg-secondary/[0.04] z-10 border-transparent shadow-[0_0_15px_rgba(0,145,255,0.15)] backdrop-blur-md"
                : ""
            )}
          >
            <div
              className={cn(
                "transition-all duration-300 ease-in-out",
                isGenerating ? "scale-[0.98] opacity-40 blur-sm" : "scale-100 opacity-100 blur-none"
              )}
            >
              <Wand2 className="mx-auto mb-3 h-8 w-8 animate-pulse text-[#0091ff]/40" />
              <p className="font-semibold">Assemble names to start</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Configure your dictionary and generation constraints, then click Assemble to
                generate names.
              </p>
            </div>
          </FacetCard>
        )}
      </div>
    </div>
  );
}

export default CandidateResultsPanel;
