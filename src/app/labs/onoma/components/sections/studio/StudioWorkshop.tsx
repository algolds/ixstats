"use client";

// src/app/labs/onoma/components/sections/studio/StudioWorkshop.tsx
// Onoma Custom Studio Workshop View

import {
  CvTemplateField,
  LengthFields,
  OptionSwitches,
  OptionText,
  SyllableFields,
  type OptionFieldContext,
} from "../../shared/GenerateOptionFields";
import {
  ControlSlider as SlidersHorizontal,
  Bookmark,
  SystemRestart as Loader2,
  InfoCircle as Info,
  Upload,
} from "iconoir-react";
import { NameResultCard } from "../../shared/NameResultCard";
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
import { PatternDepthControl } from "../../shared/PatternDepthControl";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Slider } from "~/components/ui/slider";
import { Card } from "~/components/ui/card";

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

  const ctx: OptionFieldContext = { options, onChange: setOptions, look: "studio" };

  return (
    <>
      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Left Column (5/12): Seed input and parameters */}
        <div className="space-y-4 lg:col-span-5">
          <Card variant="inset" padding="none" className="space-y-4 p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-label-secondary text-footnote font-semibold">
                  Training seeds
                </label>
                <div className="flex items-center gap-2">
                  <label className="border-tint/20 bg-tint/5 text-tint hover:bg-tint/10 hover:text-tint rounded-control text-caption flex cursor-pointer items-center gap-1 border px-2 py-0.5 font-semibold transition-[color,background-color,border-color,box-shadow,opacity] duration-200">
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
                    <span className="animate-in fade-in border-tint/20 bg-tint/10 text-tint rounded-control-sm text-eyebrow border px-2 py-0.5 duration-200">
                      Classified: {classifiedCulture}
                    </span>
                  )}
                </div>
              </div>
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
              <div className="animate-in fade-in slide-in-from-top-1 border-tint/20 bg-tint/10 text-tint rounded-control text-footnote flex items-center gap-2 border px-4 py-2 font-medium duration-200">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>{uploadStatus}</span>
              </div>
            )}

            {isEdited && (
              <form
                onSubmit={handleSaveDictionary}
                className="animate-in slide-in-from-top-2 border-tint/25 bg-tint/5 rounded-row flex items-center gap-2 border p-4 duration-300"
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
              <div className="animate-in fade-in rounded-control border-green/20 bg-green/10 text-footnote text-green border px-4 py-2 duration-300">
                {successMsg}
              </div>
            )}

            <div className="border-separator space-y-4 border-t pt-4">
              <h3 className="text-label-secondary text-subhead flex items-center gap-1 pb-1">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Parameters
              </h3>

              <PatternDepthControl value={order} onChange={setOrder} variant="inspector" />

              <LengthFields ctx={ctx} />

              <div className="grid grid-cols-2 gap-3 pb-3">
                <OptionText ctx={ctx} field="startsWith" label="Starts with" placeholder="Prefix" />
                <OptionText ctx={ctx} field="endsWith" label="Ends with" placeholder="Suffix" />
              </div>

              <div className="border-separator space-y-3 border-t pt-3">
                <h4 className="text-label-secondary text-subhead pb-0.5">
                  Phonotactic constraints
                </h4>

                <div className="space-y-2">
                  <label className="text-label-secondary text-subhead">Vowel harmony</label>
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

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="text-label-secondary text-subhead">
                        Max consonant cluster
                      </label>
                      <span className="text-tint text-caption font-semibold">
                        {options.maxConsonantCluster ?? 3}
                      </span>
                    </div>
                    <Slider
                      min={1}
                      max={5}
                      step={1}
                      value={[Number(options.maxConsonantCluster ?? 3)]}
                      onValueChange={([v = 1]) =>
                        setOptions({ ...options, maxConsonantCluster: v })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="text-label-secondary text-subhead">Max vowel cluster</label>
                      <span className="text-tint text-caption font-semibold">
                        {options.maxVowelCluster ?? 3}
                      </span>
                    </div>
                    <Slider
                      min={1}
                      max={5}
                      step={1}
                      value={[Number(options.maxVowelCluster ?? 3)]}
                      onValueChange={([v = 1]) => setOptions({ ...options, maxVowelCluster: v })}
                    />
                  </div>
                </div>

                <div className="border-separator flex items-center justify-between border-t pt-2">
                  <div className="space-y-0.5">
                    <label className="text-label-secondary text-subhead">
                      Allow double letters
                    </label>
                    <p className="text-label-secondary text-caption leading-normal">
                      Permit repeating vowels/consonants (e.g. aa, ss)
                    </p>
                  </div>
                  <Checkbox
                    checked={options.allowDoubleLetters ?? true}
                    onCheckedChange={(checked) =>
                      setOptions({ ...options, allowDoubleLetters: checked === true })
                    }
                  />
                </div>

                <div className="border-separator border-t pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-tint px-0 hover:bg-transparent"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>
                      {showAdvanced ? "Hide Advanced Phonotactics" : "Show Advanced Phonotactics"}
                    </span>
                  </Button>

                  {showAdvanced && (
                    <div className="animate-in fade-in mt-4 space-y-4 duration-200">
                      <SyllableFields ctx={ctx} />
                      <CvTemplateField ctx={ctx} />
                      <OptionSwitches
                        ctx={ctx}
                        labels={{
                          mustEndWithVowel: "Must end with vowel",
                          mustEndWithConsonant: "Must end with consonant",
                          noInitialClusters: "No Initial CC Clusters",
                          noFinalClusters: "No Final CC Clusters",
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-separator mt-2 flex items-center gap-2 border-t pt-4">
              <div className="border-separator bg-background rounded-control flex h-7 items-center gap-1 border p-0.5 select-none">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setBatchCount((c) => Math.max(5, c - 5))}
                  disabled={batchCount <= 5}
                  aria-label="Decrease count"
                  className="text-label-secondary hover:text-label"
                >
                  -
                </Button>
                <NumberFlowDisplay
                  value={batchCount}
                  className="text-label text-body min-w-[20px] px-1 text-center font-semibold"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setBatchCount((c) => Math.min(50, c + 5))}
                  disabled={batchCount >= 50}
                  aria-label="Increase count"
                  className="text-label-secondary hover:text-label"
                >
                  +
                </Button>
              </div>

              <Button
                size="default"
                onClick={() => generateNames()}
                disabled={trainingWords.length === 0}
                className="flex-1 justify-center"
              >
                <span>Assemble seeds</span>
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column (7/12): scrollable candidates grid */}
        <div className="space-y-4 lg:col-span-7">
          {generatedNames.length > 0 ? (
            <Card
              variant="inset"
              padding="none"
              className="animate-in fade-in space-y-4 p-4 duration-300"
            >
              <div className="border-separator border-b pb-3">
                <h3 className="text-label text-body font-semibold">Custom model output</h3>
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
            </Card>
          ) : (
            <Card
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
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
