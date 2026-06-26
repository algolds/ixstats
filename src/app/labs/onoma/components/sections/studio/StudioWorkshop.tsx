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
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        
        {/* Left Column (5/12): Seed input and parameters */}
        <div className="lg:col-span-5 space-y-4">
          <FacetCard className="p-4 border border-border/40 bg-secondary/5 space-y-4">
            
            {/* Seeds text area */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-muted-foreground">Training Seeds</label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-[10px] font-bold text-[#0091ff] hover:bg-[#0091ff]/10 hover:text-[#0091ff] cursor-pointer transition-all duration-200 bg-[#0091ff]/5 border border-[#0091ff]/20 px-2 py-0.5 rounded-lg active:scale-95">
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
                  <span className="text-[10px] text-muted-foreground font-semibold">{trainingWords.length} words loaded</span>
                  {classifiedCulture !== "any" && (
                    <span className="text-[9px] bg-[#0091ff]/10 text-[#0091ff] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider border border-[#0091ff]/20 animate-in fade-in duration-200">
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
                    className="w-full rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs text-foreground focus:border-[#0091ff]/50 focus:outline-none"
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
                className="h-32 w-full rounded-xl border border-border/60 bg-background p-3 text-sm text-foreground placeholder-muted-foreground focus:border-[#0091ff]/50 focus:outline-none focus:ring-1 focus:ring-[#0091ff]/50"
              />
            </div>

            {uploadStatus && (
              <div className="rounded-lg bg-[#0091ff]/10 border border-[#0091ff]/20 px-3.5 py-2 text-xs text-[#0091ff] font-medium flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>{uploadStatus}</span>
              </div>
            )}

            {/* Save Seeds Form */}
            {isEdited && (
              <form
                onSubmit={handleSaveDictionary}
                className="flex items-center gap-2 rounded-xl border border-[#0091ff]/25 bg-[#0091ff]/5 p-3.5 animate-in slide-in-from-top-2 duration-300"
              >
                <input
                  type="text"
                  placeholder="Save seeds title (e.g. Roman City Seeds)"
                  required
                  value={dictTitle}
                  onChange={(e) => setDictTitle(e.target.value)}
                  className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSaving || trainingWords.length === 0}
                  className="flex items-center gap-1 rounded-lg bg-[#0091ff] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#33a7ff] disabled:opacity-50 transition-colors"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bookmark className="h-3.5 w-3.5" />}
                  <span>Save</span>
                </button>
              </form>
            )}

            {successMsg && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 text-xs text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-300">
                {successMsg}
              </div>
            )}

            {/* Parameters Accordion/Content */}
            <div className="border-t border-border/40 pt-4 space-y-3.5">
              <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase pb-1 flex items-center gap-1">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Parameters
              </h3>

              {/* Look-back order */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Markov Order</label>
                  <span className="text-[10px] text-[#0091ff] font-bold">{order} char</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={1}
                  value={order}
                  onChange={(e) => setOrder(parseInt(e.target.value))}
                  className="w-full h-1.5 rounded-lg bg-secondary/80 accent-[#0091ff] cursor-pointer"
                />
              </div>

              {/* Length limits */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Min Length</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={options.minLength || 4}
                    onChange={(e) =>
                      setOptions({ ...options, minLength: parseInt(e.target.value) || 0 })
                    }
                    className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Max Length</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={options.maxLength || 12}
                    onChange={(e) =>
                      setOptions({ ...options, maxLength: parseInt(e.target.value) || 0 })
                    }
                    className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none"
                  />
                </div>
              </div>

              {/* Advanced Substring constraints */}
              <div className="grid grid-cols-2 gap-3 pb-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Starts With</label>
                  <input
                    type="text"
                    placeholder="Prefix"
                    value={options.startsWith || ""}
                    onChange={(e) => setOptions({ ...options, startsWith: e.target.value })}
                    className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Ends With</label>
                  <input
                    type="text"
                    placeholder="Suffix"
                    value={options.endsWith || ""}
                    onChange={(e) => setOptions({ ...options, endsWith: e.target.value })}
                    className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
                  />
                </div>
              </div>

              {/* Phonotactic Constraints */}
              <div className="space-y-3 border-t border-border/20 pt-3">
                <h4 className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase pb-0.5">
                  Phonotactic Constraints
                </h4>

                {/* Vowel Harmony */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Vowel Harmony</label>
                  <select
                    value={options.vowelHarmony || "none"}
                    onChange={(e) =>
                      setOptions({ ...options, vowelHarmony: e.target.value as any })
                    }
                    className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
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
                      <label className="text-[9px] font-bold text-muted-foreground uppercase">Max Consonant Cluster</label>
                      <span className="text-[9px] text-[#0091ff] font-bold">{options.maxConsonantCluster ?? 3}</span>
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
                      className="w-full h-1 rounded-lg bg-secondary/80 accent-[#0091ff] cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="text-[9px] font-bold text-muted-foreground uppercase">Max Vowel Cluster</label>
                      <span className="text-[9px] text-[#0091ff] font-bold">{options.maxVowelCluster ?? 3}</span>
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
                      className="w-full h-1 rounded-lg bg-secondary/80 accent-[#0091ff] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Allow Double Letters Toggle */}
                <div className="flex items-center justify-between border-t border-border/20 pt-2.5">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Allow Double Letters</label>
                    <p className="text-[8px] text-muted-foreground leading-normal">Permit repeating vowels/consonants (e.g. aa, ss)</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={options.allowDoubleLetters ?? true}
                    onChange={(e) =>
                      setOptions({ ...options, allowDoubleLetters: e.target.checked })
                    }
                    className="h-3.5 w-3.5 rounded border-border/60 bg-background text-[#0091ff] focus:ring-[#0091ff]"
                  />
                </div>
              </div>
            </div>

            {/* Assemble control */}
            <div className="flex gap-2 items-center border-t border-border/40 pt-4 mt-2">
              <div className="w-16">
                <select
                  value={batchCount}
                  onChange={(e) => setBatchCount(parseInt(e.target.value))}
                  className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                </select>
              </div>

              <button
                onClick={() => generateNames()}
                disabled={trainingWords.length === 0}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#0091ff] hover:bg-[#33a7ff] px-4 py-2 text-sm font-bold text-white shadow-md shadow-[#0091ff]/10 disabled:opacity-50 transition-all"
              >
                <Wand2 className="h-4 w-4" />
                <span>Assemble Seeds</span>
              </button>
            </div>

          </FacetCard>
        </div>

        {/* Right Column (7/12): scrollable candidates grid */}
        <div className="lg:col-span-7 space-y-4">
          {generatedNames.length > 0 ? (
            <FacetCard className="p-4 border border-border/40 bg-secondary/5 space-y-4 animate-in fade-in duration-300">
              <div className="border-b border-border/40 pb-3">
                <h3 className="text-sm font-bold tracking-tight text-foreground">
                  Custom Model Output
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Names assembled by training Markov trie on input seeds.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 max-h-[500px] overflow-y-auto pr-1">
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
            <FacetCard className="p-8 border border-border/40 border-dashed bg-secondary/5 text-center text-sm text-muted-foreground">
              <Info className="h-8 w-8 mx-auto text-[#0091ff]/40 mb-3 animate-pulse" />
              <p className="font-semibold">Generate name candidates</p>
              <p className="text-xs text-muted-foreground mt-1">
                Enter your seed list (comma or newline separated) in the training box, and click Assemble to view Markov results.
              </p>
            </FacetCard>
          )}
        </div>

      </div>

      {/* Interactive Markov Path Visualizer & Lexicon Explorer Grid */}
      <div className="grid gap-6 lg:grid-cols-2 mt-4 border-t border-border/40 pt-6">
        {/* Interactive Markov Path Visualizer Panel */}
        <div>
          {visualizerChain ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-bold tracking-tight text-[#0091ff]">
                  Interactive Path Workshop
                </h3>
                <p className="text-xs text-muted-foreground">
                  Explore the Markov transition tree step-by-step. Click green tokens to grow the path and click red [End] to finalize name compilation.
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
            <FacetCard className="p-8 border border-border/40 border-dashed bg-secondary/5 text-center text-sm text-muted-foreground flex flex-col items-center justify-center h-full min-h-[300px]">
              <Info className="h-8 w-8 text-[#0091ff]/40 mb-3" />
              <p className="font-semibold">Interactive visualizer is inactive</p>
              <p className="text-xs text-muted-foreground mt-1">
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
