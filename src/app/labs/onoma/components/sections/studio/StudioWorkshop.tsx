"use client";

// src/app/labs/onoma/components/sections/studio/StudioWorkshop.tsx
// Onoma Custom Studio Workshop View

import { Wand2, SlidersHorizontal, Bookmark, Loader2, Info, Upload } from "lucide-react";
import { NameResultCard } from "../../shared/NameResultCard";
import { FacetCard } from "~/components/ui/facet-container";
import { MarkovVisualizer } from "../MarkovVisualizer";
import { LexiconExplorer } from "../LexiconExplorer";
import { type StudioState } from "../../../hooks/useStudioState";

interface StudioWorkshopProps {
  state: StudioState;
}

export function StudioWorkshop({ state }: StudioWorkshopProps) {
  const {
    inputText,
    setInputText,
    order,
    setOrder,
    batchCount,
    setBatchCount,
    options,
    setOptions,
    generatedNames,
    dictTitle,
    setDictTitle,
    selectedDictId,
    isSaving,
    successMsg,
    visualizerPrefix,
    setVisualizerPrefix,
    uploadStatus,
    trainingWords,
    classifiedCulture,
    savedDictionaries,
    isEdited,
    visualizerChain,
    generateNames,
    handleFileUpload,
    handleLoadSavedDictionary,
    handleCompleteName,
    handleSaveDictionary,
    bank,
  } = state;

  return (
    <>
      {/* Two-Column Layout */}
      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Left Column (5/12): Seed input and parameters */}
        <div className="space-y-4 lg:col-span-5">
          <FacetCard className="border-border/40 bg-secondary/5 space-y-4 border p-4">
            {/* Seeds text area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-muted-foreground text-xs font-bold">Training Seeds</label>
                <div className="flex items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-[#0091ff]/20 bg-[#0091ff]/5 px-2 py-0.5 text-[10px] font-bold text-[#0091ff] transition-all duration-200 hover:bg-[#0091ff]/10 hover:text-[#0091ff] active:scale-95">
                    <Upload className="h-3 w-3" />
                    <span>Upload .txt</span>
                    <input
                      type="file"
                      multiple
                      accept=".txt"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                  <span className="text-muted-foreground text-[10px] font-semibold">
                    {trainingWords.length} words loaded
                  </span>
                  {classifiedCulture !== "any" && (
                    <span className="animate-in fade-in rounded-md border border-[#0091ff]/20 bg-[#0091ff]/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-[#0091ff] uppercase duration-200">
                      Classified: {classifiedCulture}
                    </span>
                  )}
                </div>
              </div>
              {/* Load Saved Dictionary Selector */}
              {savedDictionaries.length > 0 && (
                <div className="pt-0.5 pb-1">
                  <select
                    value={selectedDictId}
                    onChange={(e) => handleLoadSavedDictionary(e.target.value)}
                    className="border-border/60 bg-background text-foreground w-full rounded-lg border px-3 py-1.5 text-xs focus:border-[#0091ff]/50 focus:outline-none"
                  >
                    <option value="">-- Load a saved dictionary --</option>
                    {savedDictionaries.map((dict) => (
                      <option key={dict.id} value={dict.id}>
                        {dict.title} ({dict.values.length} words)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste words separated by commas or newlines, or upload .txt files..."
                className="border-border/60 bg-background text-foreground placeholder-muted-foreground h-32 w-full rounded-xl border p-3 text-sm focus:border-[#0091ff]/50 focus:ring-1 focus:ring-[#0091ff]/50 focus:outline-none"
              />
            </div>

            {uploadStatus && (
              <div className="animate-in fade-in slide-in-from-top-1 flex items-center gap-1.5 rounded-lg border border-[#0091ff]/20 bg-[#0091ff]/10 px-3.5 py-2 text-xs font-medium text-[#0091ff] duration-200">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>{uploadStatus}</span>
              </div>
            )}

            {/* Save Seeds Form */}
            {isEdited && (
              <form
                onSubmit={handleSaveDictionary}
                className="animate-in slide-in-from-top-2 flex items-center gap-2 rounded-xl border border-[#0091ff]/25 bg-[#0091ff]/5 p-3.5 duration-300"
              >
                <input
                  type="text"
                  placeholder="Save seeds title (e.g. Roman City Seeds)"
                  required
                  value={dictTitle}
                  onChange={(e) => setDictTitle(e.target.value)}
                  className="border-border/60 bg-background text-foreground flex-1 rounded-lg border px-3 py-1.5 text-xs focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSaving || trainingWords.length === 0}
                  className="flex items-center gap-1 rounded-lg bg-[#0091ff] px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#33a7ff] disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Bookmark className="h-3.5 w-3.5" />
                  )}
                  <span>Save</span>
                </button>
              </form>
            )}

            {successMsg && (
              <div className="animate-in fade-in rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-600 duration-300 dark:text-emerald-400">
                {successMsg}
              </div>
            )}

            {/* Parameters Accordion/Content */}
            <div className="border-border/40 space-y-3.5 border-t pt-4">
              <h3 className="text-muted-foreground flex items-center gap-1 pb-1 text-xs font-bold tracking-wider uppercase">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Parameters
              </h3>

              {/* Look-back order */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <label className="text-muted-foreground text-[10px] font-bold uppercase">
                    Markov Order
                  </label>
                  <span className="text-[10px] font-bold text-[#0091ff]">{order} char</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={1}
                  value={order}
                  onChange={(e) => setOrder(parseInt(e.target.value))}
                  className="bg-secondary/80 h-1.5 w-full cursor-pointer rounded-lg accent-[#0091ff]"
                />
              </div>

              {/* Length limits */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-muted-foreground text-[10px] font-bold uppercase">
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
                    className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1 text-xs focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-muted-foreground text-[10px] font-bold uppercase">
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
                    className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1 text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Advanced Substring constraints */}
              <div className="grid grid-cols-2 gap-3 pb-3">
                <div className="space-y-1">
                  <label className="text-muted-foreground text-[10px] font-bold uppercase">
                    Starts With
                  </label>
                  <input
                    type="text"
                    placeholder="Prefix"
                    value={options.startsWith || ""}
                    onChange={(e) => setOptions({ ...options, startsWith: e.target.value })}
                    className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-muted-foreground text-[10px] font-bold uppercase">
                    Ends With
                  </label>
                  <input
                    type="text"
                    placeholder="Suffix"
                    value={options.endsWith || ""}
                    onChange={(e) => setOptions({ ...options, endsWith: e.target.value })}
                    className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Phonotactic Constraints */}
              <div className="border-border/20 space-y-3 border-t pt-3">
                <h4 className="text-muted-foreground pb-0.5 text-[10px] font-bold tracking-wider uppercase">
                  Phonotactic Constraints
                </h4>

                {/* Vowel Harmony */}
                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-[10px] font-bold uppercase">
                    Vowel Harmony
                  </label>
                  <select
                    value={options.vowelHarmony || "none"}
                    onChange={(e) =>
                      setOptions({ ...options, vowelHarmony: e.target.value as any })
                    }
                    className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
                  >
                    <option value="none">None (Standard)</option>
                    <option value="front">Front Harmony (e, i, y, ä, ö, ü)</option>
                    <option value="back">Back Harmony (a, o, u)</option>
                  </select>
                </div>

                {/* Cluster Size Limits */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="text-muted-foreground text-[9px] font-bold uppercase">
                        Max Consonant Cluster
                      </label>
                      <span className="text-[9px] font-bold text-[#0091ff]">
                        {options.maxConsonantCluster ?? 3}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={options.maxConsonantCluster ?? 3}
                      onChange={(e) =>
                        setOptions({ ...options, maxConsonantCluster: parseInt(e.target.value) })
                      }
                      className="bg-secondary/80 h-1 w-full cursor-pointer rounded-lg accent-[#0091ff]"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="text-muted-foreground text-[9px] font-bold uppercase">
                        Max Vowel Cluster
                      </label>
                      <span className="text-[9px] font-bold text-[#0091ff]">
                        {options.maxVowelCluster ?? 3}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={options.maxVowelCluster ?? 3}
                      onChange={(e) =>
                        setOptions({ ...options, maxVowelCluster: parseInt(e.target.value) })
                      }
                      className="bg-secondary/80 h-1 w-full cursor-pointer rounded-lg accent-[#0091ff]"
                    />
                  </div>
                </div>

                {/* Allow Double Letters Toggle */}
                <div className="border-border/20 flex items-center justify-between border-t pt-2.5">
                  <div className="space-y-0.5">
                    <label className="text-muted-foreground text-[10px] font-bold uppercase">
                      Allow Double Letters
                    </label>
                    <p className="text-muted-foreground text-[8px] leading-normal">
                      Permit repeating vowels/consonants (e.g. aa, ss)
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={options.allowDoubleLetters ?? true}
                    onChange={(e) =>
                      setOptions({ ...options, allowDoubleLetters: e.target.checked })
                    }
                    className="border-border/60 bg-background h-3.5 w-3.5 rounded text-[#0091ff] focus:ring-[#0091ff]"
                  />
                </div>
              </div>
            </div>

            {/* Assemble control */}
            <div className="border-border/40 mt-2 flex items-center gap-2 border-t pt-4">
              <div className="w-16">
                <select
                  value={batchCount}
                  onChange={(e) => setBatchCount(parseInt(e.target.value))}
                  className="border-border/60 bg-background text-foreground w-full rounded-md border px-2 py-1 text-xs focus:outline-none"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                </select>
              </div>

              <button
                onClick={() => generateNames()}
                disabled={trainingWords.length === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0091ff] px-4 py-2 text-sm font-bold text-white shadow-md shadow-[#0091ff]/10 transition-all hover:bg-[#33a7ff] disabled:opacity-50"
              >
                <Wand2 className="h-4 w-4" />
                <span>Assemble Seeds</span>
              </button>
            </div>
          </FacetCard>
        </div>

        {/* Right Column (7/12): scrollable candidates grid */}
        <div className="space-y-4 lg:col-span-7">
          {generatedNames.length > 0 ? (
            <FacetCard className="border-border/40 bg-secondary/5 animate-in fade-in space-y-4 border p-4 duration-300">
              <div className="border-border/40 border-b pb-3">
                <h3 className="text-foreground text-sm font-bold tracking-tight">
                  Custom Model Output
                </h3>
                <p className="text-muted-foreground mt-0.5 text-[11px]">
                  Names assembled by training Markov trie on input seeds.
                </p>
              </div>

              <div className="grid max-h-[500px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                {generatedNames.map((name, idx) => (
                  <NameResultCard
                    key={idx}
                    name={name}
                    culture={classifiedCulture}
                    onSave={async (n, stashId) => {
                      await bank.saveEntry({
                        type: "saved-name",
                        title: n,
                        values: [n],
                        stashId,
                      });
                    }}
                  />
                ))}
              </div>
            </FacetCard>
          ) : (
            <FacetCard className="border-border/40 bg-secondary/5 text-muted-foreground border border-dashed p-8 text-center text-sm">
              <Info className="mx-auto mb-3 h-8 w-8 animate-pulse text-[#0091ff]/40" />
              <p className="font-semibold">Generate name candidates</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Enter your seed list (comma or newline separated) in the training box, and click
                Assemble to view Markov results.
              </p>
            </FacetCard>
          )}
        </div>
      </div>

      {/* Interactive Markov Path Visualizer & Lexicon Explorer Grid */}
      <div className="border-border/40 mt-4 grid gap-6 border-t pt-6 lg:grid-cols-2">
        {/* Interactive Markov Path Visualizer Panel */}
        <div>
          {visualizerChain ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-bold tracking-tight text-[#0091ff]">
                  Interactive Path Workshop
                </h3>
                <p className="text-muted-foreground text-xs">
                  Explore the Markov transition tree step-by-step. Click green tokens to grow the
                  path and click red [End] to finalize name compilation.
                </p>
              </div>
              <MarkovVisualizer
                chain={visualizerChain}
                activePrefix={visualizerPrefix}
                onChangePrefix={setVisualizerPrefix}
                onCompleteName={handleCompleteName}
              />
            </div>
          ) : (
            <FacetCard className="border-border/40 bg-secondary/5 text-muted-foreground flex h-full min-h-[300px] flex-col items-center justify-center border border-dashed p-8 text-center text-sm">
              <Info className="mb-3 h-8 w-8 text-[#0091ff]/40" />
              <p className="font-semibold">Interactive visualizer is inactive</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Provide training seeds to build the Markov trie.
              </p>
            </FacetCard>
          )}
        </div>

        {/* Lexicon Explorer & Health Panel */}
        <div className="h-full">
          <LexiconExplorer words={trainingWords} />
        </div>
      </div>
    </>
  );
}
