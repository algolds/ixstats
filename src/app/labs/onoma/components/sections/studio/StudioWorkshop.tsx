"use client";

// src/app/labs/onoma/components/sections/studio/StudioWorkshop.tsx
// Onoma Custom Studio Workshop View

import {
  ControlSlider as SlidersHorizontal,
  Bookmark,
  SystemRestart as Loader2,
  InfoCircle as Info,
  Upload,
} from "iconoir-react";
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
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";

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
          <FacetCard variant="inset" padding="none" className="space-y-4 p-4">
            {/* Seeds text area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-label-secondary text-footnote font-semibold">
                  Training Seeds
                </label>
                <div className="flex items-center gap-2">
                  <label className="border-tint/20 bg-tint/5 text-tint hover:bg-tint/10 hover:text-tint rounded-control text-caption flex cursor-pointer items-center gap-1 border px-2 py-0.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 active:scale-95">
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
                  <span className="text-label-secondary text-caption font-semibold">
                    {trainingWords.length} words loaded
                  </span>
                  {classifiedCulture !== "any" && (
                    <span className="animate-in fade-in border-tint/20 bg-tint/10 text-tint rounded-control-sm text-eyebrow border px-1.5 py-0.5 duration-200">
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
                    <SelectTrigger className="text-footnote w-full">
                      <SelectValue placeholder="-- Load a saved dictionary --" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="none" className="text-footnote">
                        -- Load a saved dictionary --
                      </SelectItem>
                      {savedDictionaries.map((dict) => (
                        <SelectItem key={dict.id} value={dict.id} className="text-footnote">
                          {dict.title} ({dict.values.length} words)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste words separated by commas or newlines, or upload .txt files..."
                className="text-body h-32 w-full"
              />
            </div>

            {uploadStatus && (
              <div className="animate-in fade-in slide-in-from-top-1 border-tint/20 bg-tint/10 text-tint rounded-control text-footnote flex items-center gap-1.5 border px-3.5 py-2 font-medium duration-200">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>{uploadStatus}</span>
              </div>
            )}

            {/* Save Seeds Form */}
            {isEdited && (
              <form
                onSubmit={handleSaveDictionary}
                className="animate-in slide-in-from-top-2 border-tint/25 bg-tint/5 rounded-row flex items-center gap-2 border p-3.5 duration-300"
              >
                <Input
                  type="text"
                  placeholder="Save seeds title (e.g. Roman City Seeds)"
                  required
                  value={dictTitle}
                  onChange={(e) => setDictTitle(e.target.value)}
                  className="text-footnote flex-1"
                />
                <Button size="sm" type="submit" disabled={isSaving || trainingWords.length === 0}>
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Bookmark className="h-3.5 w-3.5" />
                  )}
                  <span>Save</span>
                </Button>
              </form>
            )}

            {successMsg && (
              <div className="animate-in fade-in rounded-control border-green/20 bg-green/10 text-footnote text-green border px-3.5 py-2 duration-300">
                {successMsg}
              </div>
            )}

            {/* Parameters Accordion/Content */}
            <div className="border-separator space-y-3.5 border-t pt-4">
              <h3 className="text-label-secondary text-subhead flex items-center gap-1 pb-1">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Parameters
              </h3>

              {/* Pattern Depth Control */}
              <PatternDepthControl value={order} onChange={setOrder} variant="inspector" />

              {/* Length limits */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-label-secondary text-subhead">Min Length</label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={options.minLength || 4}
                    onChange={(e) =>
                      setOptions({ ...options, minLength: parseInt(e.target.value) || 0 })
                    }
                    className="text-footnote w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-label-secondary text-subhead">Max Length</label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={options.maxLength || 12}
                    onChange={(e) =>
                      setOptions({ ...options, maxLength: parseInt(e.target.value) || 0 })
                    }
                    className="text-footnote w-full"
                  />
                </div>
              </div>

              {/* Advanced Substring constraints */}
              <div className="grid grid-cols-2 gap-3 pb-3">
                <div className="space-y-1">
                  <label className="text-label-secondary text-subhead">Starts With</label>
                  <Input
                    type="text"
                    placeholder="Prefix"
                    value={options.startsWith || ""}
                    onChange={(e) => setOptions({ ...options, startsWith: e.target.value })}
                    className="text-footnote w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-label-secondary text-subhead">Ends With</label>
                  <Input
                    type="text"
                    placeholder="Suffix"
                    value={options.endsWith || ""}
                    onChange={(e) => setOptions({ ...options, endsWith: e.target.value })}
                    className="text-footnote w-full"
                  />
                </div>
              </div>

              {/* Phonotactic Constraints */}
              <div className="border-separator space-y-3 border-t pt-3">
                <h4 className="text-label-secondary text-subhead pb-0.5">
                  Phonotactic Constraints
                </h4>

                {/* Vowel Harmony */}
                <div className="space-y-1.5">
                  <label className="text-label-secondary text-subhead">Vowel Harmony</label>
                  <Select
                    value={options.vowelHarmony || "none"}
                    onValueChange={(val: "none" | "front" | "back") =>
                      setOptions({ ...options, vowelHarmony: val })
                    }
                  >
                    <SelectTrigger className="text-footnote w-full">
                      <SelectValue placeholder="None (Standard)" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[250px]">
                      <SelectItem value="none" className="text-footnote">
                        None (Standard)
                      </SelectItem>
                      <SelectItem value="front" className="text-footnote">
                        Front Harmony (e, i, y, ä, ö, ü)
                      </SelectItem>
                      <SelectItem value="back" className="text-footnote">
                        Back Harmony (a, o, u)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Cluster Size Limits */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="text-label-secondary text-subhead">
                        Max Consonant Cluster
                      </label>
                      <span className="text-tint text-caption font-semibold">
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
                      className="bg-fill-2 accent-tint rounded-control h-1 w-full cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="text-label-secondary text-subhead">Max Vowel Cluster</label>
                      <span className="text-tint text-caption font-semibold">
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
                      className="bg-fill-2 accent-tint rounded-control h-1 w-full cursor-pointer"
                    />
                  </div>
                </div>

                {/* Allow Double Letters Toggle */}
                <div className="border-separator flex items-center justify-between border-t pt-2.5">
                  <div className="space-y-0.5">
                    <label className="text-label-secondary text-subhead">
                      Allow Double Letters
                    </label>
                    <p className="text-label-secondary text-caption leading-normal">
                      Permit repeating vowels/consonants (e.g. aa, ss)
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={options.allowDoubleLetters ?? true}
                    onChange={(e) =>
                      setOptions({ ...options, allowDoubleLetters: e.target.checked })
                    }
                    className="border-separator bg-background text-tint focus:ring-tint rounded-control-sm h-3.5 w-3.5"
                  />
                </div>

                {/* Advanced toggler */}
                <div className="border-separator border-t pt-2.5">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-tint text-footnote flex items-center gap-1.5 font-semibold transition-opacity hover:opacity-85"
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
                          <label className="text-label-secondary text-subhead">Min Syllables</label>
                          <Input
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
                            className="text-footnote w-full"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-label-secondary text-subhead">Max Syllables</label>
                          <Input
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
                            className="text-footnote w-full"
                          />
                        </div>
                      </div>

                      {/* CV Template Input */}
                      <div className="space-y-1">
                        <label className="text-label-secondary text-subhead">
                          Strict CV Template
                        </label>
                        <Input
                          type="text"
                          placeholder="e.g. CVCV (C=consonant, V=vowel)"
                          value={options.cvTemplate || ""}
                          onChange={(e) =>
                            setOptions({
                              ...options,
                              cvTemplate: e.target.value.replace(/[^cvCV]/g, "").toUpperCase(),
                            })
                          }
                          className="w-full font-mono"
                        />
                      </div>

                      {/* Switches Grid */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        {/* Must End With Vowel */}
                        <div className="flex items-center justify-between">
                          <span className="text-label-secondary text-caption font-semibold">
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
                          <span className="text-label-secondary text-caption font-semibold">
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
                          <span className="text-label-secondary text-caption font-semibold">
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
                          <span className="text-label-secondary text-caption font-semibold">
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
            <div className="border-separator mt-2 flex items-center gap-2 border-t pt-4">
              <div className="border-separator bg-background rounded-control flex h-7 items-center gap-1 border p-0.5 select-none">
                <button
                  type="button"
                  onClick={() => setBatchCount((c) => Math.max(5, c - 5))}
                  disabled={batchCount <= 5}
                  className="text-label-secondary hover:text-label text-footnote cursor-pointer px-2 font-semibold disabled:opacity-30"
                >
                  -
                </button>
                <NumberFlowDisplay
                  value={batchCount}
                  className="text-label text-body min-w-[20px] px-1 text-center font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setBatchCount((c) => Math.min(50, c + 5))}
                  disabled={batchCount >= 50}
                  className="text-label-secondary hover:text-label text-footnote cursor-pointer px-2 font-semibold disabled:opacity-30"
                >
                  +
                </button>
              </div>

              <Button
                size="md"
                onClick={() => generateNames()}
                disabled={trainingWords.length === 0}
                className="flex-1 justify-center"
              >
                <span>Assemble Seeds</span>
              </Button>
            </div>
          </FacetCard>
        </div>

        {/* Right Column (7/12): scrollable candidates grid */}
        <div className="space-y-4 lg:col-span-7">
          {generatedNames.length > 0 ? (
            <FacetCard
              variant="inset"
              padding="none"
              className="animate-in fade-in space-y-4 p-4 duration-300"
            >
              <div className="border-separator border-b pb-3">
                <h3 className="text-label text-body font-semibold">Custom Model Output</h3>
                <p className="text-label-secondary text-caption mt-0.5">
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
            <FacetCard
              variant="inset"
              padding="none"
              className="text-label-secondary text-body border-dashed p-8 text-center"
            >
              <Info className="text-tint/40 mx-auto mb-3 h-8 w-8" />
              <p className="font-semibold">Generate name candidates</p>
              <p className="text-label-secondary text-footnote mt-1">
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
