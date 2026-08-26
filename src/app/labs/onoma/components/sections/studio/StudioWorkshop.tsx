"use client";

// src/app/labs/onoma/components/sections/studio/StudioWorkshop.tsx
// Onoma Custom Studio Workshop View

import { ControlSlider as SlidersHorizontal, Bookmark, SystemRestart as Loader2, InfoCircle as Info, Upload } from "iconoir-react";
import { NameResultCard } from "../../shared/NameResultCard";
import { FacetCard } from "~/components/ui/facet-container";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useState } from "react";
import { type StudioState } from "../../../hooks/useStudioState";
import { AppleSwitch } from "~/components/ui/apple-switch";
import { PatternDepthControl } from "../../shared/PatternDepthControl";

interface StudioWorkshopProps {
  state: StudioState;
}

export function StudioWorkshop({ state }: StudioWorkshopProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
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
    // oxlint-disable-next-line eslint/no-unused-vars
    visualizerPrefix,
    // oxlint-disable-next-line eslint/no-unused-vars
    setVisualizerPrefix,
    uploadStatus,
    trainingWords,
    classifiedCulture,
    savedDictionaries,
    isEdited,
    // oxlint-disable-next-line eslint/no-unused-vars
    visualizerChain,
    generateNames,
    handleFileUpload,
    handleLoadSavedDictionary,
    // oxlint-disable-next-line eslint/no-unused-vars
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
                  <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-onoma-primary/20 bg-onoma-primary/5 px-2 py-0.5 text-[10px] font-bold text-onoma-primary transition-all duration-200 hover:bg-onoma-primary/10 hover:text-onoma-primary active:scale-95">
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
                    <span className="animate-in fade-in rounded-md border border-onoma-primary/20 bg-onoma-primary/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-onoma-primary uppercase duration-200">
                      Classified: {classifiedCulture}
                    </span>
                  )}
                </div>
              </div>
              {/* Load Saved Dictionary Selector */}
              {savedDictionaries.length > 0 && (
                <div className="pt-0.5 pb-1">
                  <Select
                    value={selectedDictId || "none"}
                    onValueChange={(val) => handleLoadSavedDictionary(val === "none" ? "" : val)}
                  >
                    <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground flex w-full items-center justify-between rounded-lg border px-3 py-1.5 text-xs transition-colors focus:border-onoma-primary/50 focus:outline-none">
                      <SelectValue placeholder="-- Load a saved dictionary --" />
                    </SelectTrigger>
                    <SelectContent className="border-border/40 bg-background/95 max-h-[300px] backdrop-blur-md">
                      <SelectItem
                        value="none"
                        className="focus:text-foreground text-xs focus:bg-onoma-primary/10"
                      >
                        -- Load a saved dictionary --
                      </SelectItem>
                      {savedDictionaries.map((dict) => (
                        <SelectItem
                          key={dict.id}
                          value={dict.id}
                          className="focus:text-foreground text-xs focus:bg-onoma-primary/10"
                        >
                          {dict.title} ({dict.values.length} words)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste words separated by commas or newlines, or upload .txt files..."
                className="border-border/60 bg-background text-foreground placeholder-muted-foreground h-32 w-full rounded-xl border p-3 text-sm focus:border-onoma-primary/50 focus:ring-1 focus:ring-onoma-primary/50 focus:outline-none"
              />
            </div>

            {uploadStatus && (
              <div className="animate-in fade-in slide-in-from-top-1 flex items-center gap-1.5 rounded-lg border border-onoma-primary/20 bg-onoma-primary/10 px-3.5 py-2 text-xs font-medium text-onoma-primary duration-200">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>{uploadStatus}</span>
              </div>
            )}

            {/* Save Seeds Form */}
            {isEdited && (
              <form
                onSubmit={handleSaveDictionary}
                className="animate-in slide-in-from-top-2 flex items-center gap-2 rounded-xl border border-onoma-primary/25 bg-onoma-primary/5 p-3.5 duration-300"
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
                  className="flex items-center gap-1 rounded-lg bg-onoma-primary px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-onoma-primary-light disabled:opacity-50"
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

              {/* Pattern Depth Control */}
              <PatternDepthControl
                value={order}
                onChange={setOrder}
                variant="inspector"
              />

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
                  <Select
                    value={options.vowelHarmony || "none"}
                    onValueChange={(val: "none" | "front" | "back") =>
                      setOptions({ ...options, vowelHarmony: val })
                    }
                  >
                    <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs transition-colors focus:outline-none">
                      <SelectValue placeholder="None (Standard)" />
                    </SelectTrigger>
                    <SelectContent className="border-border/40 bg-background/95 max-h-[250px] backdrop-blur-md">
                      <SelectItem
                        value="none"
                        className="focus:text-foreground text-xs focus:bg-onoma-primary/10"
                      >
                        None (Standard)
                      </SelectItem>
                      <SelectItem
                        value="front"
                        className="focus:text-foreground text-xs focus:bg-onoma-primary/10"
                      >
                        Front Harmony (e, i, y, ä, ö, ü)
                      </SelectItem>
                      <SelectItem
                        value="back"
                        className="focus:text-foreground text-xs focus:bg-onoma-primary/10"
                      >
                        Back Harmony (a, o, u)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Cluster Size Limits */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="text-muted-foreground text-[9px] font-bold uppercase">
                        Max Consonant Cluster
                      </label>
                      <span className="text-[9px] font-bold text-onoma-primary">
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
                      className="bg-secondary/80 h-1 w-full cursor-pointer rounded-lg accent-onoma-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="text-muted-foreground text-[9px] font-bold uppercase">
                        Max Vowel Cluster
                      </label>
                      <span className="text-[9px] font-bold text-onoma-primary">
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
                      className="bg-secondary/80 h-1 w-full cursor-pointer rounded-lg accent-onoma-primary"
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
                    className="border-border/60 bg-background h-3.5 w-3.5 rounded text-onoma-primary focus:ring-onoma-primary"
                  />
                </div>

                {/* Advanced toggler */}
                <div className="border-border/20 border-t pt-2.5">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-1.5 text-xs font-bold text-onoma-primary transition-opacity hover:opacity-85"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>
                      {showAdvanced ? "Hide Advanced Phonotactics" : "Show Advanced Phonotactics"}
                    </span>
                  </button>

                  {showAdvanced && (
                    <div className="animate-in fade-in mt-3.5 space-y-3.5 duration-200">
                      {/* Syllable Counts */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-muted-foreground text-[10px] font-bold uppercase">
                            Min Syllables
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={5}
                            value={options.minSyllables || 0}
                            onChange={(e) =>
                              setOptions({
                                ...options,
                                minSyllables: parseInt(e.target.value) || 0,
                              })
                            }
                            className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1 text-xs focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-muted-foreground text-[10px] font-bold uppercase">
                            Max Syllables
                          </label>
                          <input
                            type="number"
                            min={-1}
                            max={10}
                            placeholder="No limit"
                            value={
                              options.maxSyllables === undefined || options.maxSyllables === -1
                                ? ""
                                : options.maxSyllables
                            }
                            onChange={(e) =>
                              setOptions({
                                ...options,
                                maxSyllables:
                                  e.target.value === "" ? -1 : parseInt(e.target.value) || -1,
                              })
                            }
                            className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1 text-xs focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* CV Template Input */}
                      <div className="space-y-1">
                        <label className="text-muted-foreground text-[10px] font-bold uppercase">
                          Strict CV Template
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. CVCV (C=consonant, V=vowel)"
                          value={options.cvTemplate || ""}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              cvTemplate: e.target.value.replace(/[^cvCV]/g, "").toUpperCase(),
                            })
                          }
                          className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1 font-mono text-xs uppercase focus:outline-none"
                        />
                      </div>

                      {/* Switches Grid */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        {/* Must End With Vowel */}
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-[10px] font-semibold">
                            Must End With Vowel
                          </span>
                          <AppleSwitch
                            checked={options.mustEndWithVowel || false}
                            onCheckedChange={(checked) =>
                              setOptions({
                                ...options,
                                mustEndWithVowel: checked,
                                mustEndWithConsonant: checked
                                  ? false
                                  : options.mustEndWithConsonant,
                              })
                            }
                            size="sm"
                          />
                        </div>

                        {/* Must End With Consonant */}
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-[10px] font-semibold">
                            Must End With Consonant
                          </span>
                          <AppleSwitch
                            checked={options.mustEndWithConsonant || false}
                            onCheckedChange={(checked) =>
                              setOptions({
                                ...options,
                                mustEndWithConsonant: checked,
                                mustEndWithVowel: checked ? false : options.mustEndWithVowel,
                              })
                            }
                            size="sm"
                          />
                        </div>

                        {/* No Initial Clusters */}
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-[10px] font-semibold">
                            No Initial CC Clusters
                          </span>
                          <AppleSwitch
                            checked={options.noInitialClusters || false}
                            onCheckedChange={(checked) =>
                              setOptions({
                                ...options,
                                noInitialClusters: checked,
                              })
                            }
                            size="sm"
                          />
                        </div>

                        {/* No Final Clusters */}
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-[10px] font-semibold">
                            No Final CC Clusters
                          </span>
                          <AppleSwitch
                            checked={options.noFinalClusters || false}
                            onCheckedChange={(checked) =>
                              setOptions({
                                ...options,
                                noFinalClusters: checked,
                              })
                            }
                            size="sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Assemble control */}
            <div className="border-border/40 mt-2 flex items-center gap-2 border-t pt-4">
              <div className="border-border/60 bg-background flex h-7 items-center gap-1 rounded-lg border p-0.5 select-none">
                <button
                  type="button"
                  onClick={() => setBatchCount((c) => Math.max(5, c - 5))}
                  disabled={batchCount <= 5}
                  className="text-muted-foreground hover:text-foreground cursor-pointer px-2 text-xs font-bold disabled:opacity-30"
                >
                  -
                </button>
                <NumberFlowDisplay
                  value={batchCount}
                  className="text-foreground min-w-[20px] px-1 text-center text-sm font-bold tracking-tight"
                />
                <button
                  type="button"
                  onClick={() => setBatchCount((c) => Math.min(50, c + 5))}
                  disabled={batchCount >= 50}
                  className="text-muted-foreground hover:text-foreground cursor-pointer px-2 text-xs font-bold disabled:opacity-30"
                >
                  +
                </button>
              </div>

              <button
                onClick={() => generateNames()}
                disabled={trainingWords.length === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-onoma-primary px-4 py-2 text-sm font-bold text-white shadow-md shadow-onoma-primary/10 transition-all hover:bg-onoma-primary-light active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
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
                  Names assembled by modeling phonetic patterns from input seeds.
                </p>
              </div>

              <div className="grid max-h-[500px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                {generatedNames.map((name, idx) => (
                  <NameResultCard
                    key={`${name}-${idx}`}
                    name={name}
                    isSaved={bank.nameBank?.some(
                      (entry) => entry.type === "saved-name" && entry.title === name
                    )}
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
              <Info className="mx-auto mb-3 h-8 w-8 animate-pulse text-onoma-primary/40" />
              <p className="font-semibold">Generate name candidates</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Enter your seed list (comma or newline separated) in the training box, and click
                Assemble to generate new names matching your pattern depth.
              </p>
            </FacetCard>
          )}
        </div>
      </div>
    </>
  );
}
