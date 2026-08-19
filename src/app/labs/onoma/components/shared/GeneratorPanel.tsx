"use client";

// src/app/labs/onoma/components/shared/GeneratorPanel.tsx
// Onoma Lab — Unified Name Generation UI Panel (Facet Rebuild)

import { useState, useEffect } from "react";
import { Wand2, SlidersHorizontal, Plus, Copy, Check, Bookmark, Loader2 } from "lucide-react";
import { NameResultCard } from "./NameResultCard";
import { UseNameDialog } from "./UseNameDialog";
import { useOnomaGenerator } from "~/hooks/useOnomaGenerator";
import { useNameBank } from "~/hooks/useNameBank";
import type { NameCategory, CulturalProfile } from "~/lib/onoma/types";
import { FacetCard } from "~/components/ui/facet-container";
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
import { AdvancedConlangSettings } from "./AdvancedConlangSettings";

// "celtic+germanic" → "Celtic + Germanic", "mixed" → "Mixed / Other", "latin" → "Latin"
function formatBucket(bucket: string): string {
  if (bucket === "mixed") return "Mixed / Other";
  return bucket
    .split("+")
    .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
    .join(" + ");
}

interface GeneratorPanelProps {
  category: NameCategory;
  title: string;
  description: string;
  subTypes?: { value: string; label: string }[];
  defaultSubType?: string;
}

export function GeneratorPanel({
  category,
  title,
  description,
  subTypes = [],
  defaultSubType = "generic",
}: GeneratorPanelProps) {
  const gen = useOnomaGenerator();
  const bank = useNameBank();

  // Local UI State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [batchCount, setBatchCount] = useState(10);
  const [useName, setUseName] = useState<string | null>(null);
  const [dictionaryTitle, setDictionaryTitle] = useState("");
  const [isSavingDict, setIsSavingDict] = useState(false);
  const [showSaveDictForm, setShowSaveDictForm] = useState(false);
  const [copiedBatch, setCopiedBatch] = useState(false);

  // Set category and subType initial values
  useEffect(() => {
    gen.setCategory(category);
    if (defaultSubType) gen.setSubType(defaultSubType);
  }, [category, defaultSubType]);

  const handleGenerate = () => {
    gen.generate(batchCount);
    setShowSaveDictForm(false);
  };

  const handleSaveName = async (name: string, stashId?: string) => {
    await bank.saveEntry({
      type: "saved-name",
      title: name,
      values: [name],
      category,
      culturalProfile: gen.culture !== "any" ? (gen.culture as CulturalProfile) : null,
      stashId,
    });
  };

  const handleSaveBatchAsDictionary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dictionaryTitle.trim() || gen.generatedNames.length === 0) return;
    setIsSavingDict(true);
    try {
      await bank.saveEntry({
        type: "dictionary",
        title: dictionaryTitle.trim(),
        values: gen.generatedNames,
        category,
        culturalProfile: gen.culture !== "any" ? (gen.culture as CulturalProfile) : null,
        isPublic: false,
      });
      setDictionaryTitle("");
      setShowSaveDictForm(false);
    } catch (err) {
      console.error("Failed to save dictionary:", err);
    } finally {
      setIsSavingDict(false);
    }
  };

  const handleCopyBatch = async () => {
    if (gen.generatedNames.length === 0) return;
    try {
      await navigator.clipboard.writeText(gen.generatedNames.join(", "));
      setCopiedBatch(true);
      setTimeout(() => setCopiedBatch(false), 2000);
    } catch (err) {
      console.error("Failed to copy batch:", err);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Info */}
      <div className="border-border/40 space-y-1 border-b pb-4">
        <h2 className="text-foreground text-xl font-bold tracking-tight">{title}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </div>

      {/* Two-Column Adaptive Layout */}
      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Left Column (5/12): Generator parameters inside FacetCard */}
        <div className="space-y-4 lg:col-span-5">
          <FacetCard className="border-border/40 bg-secondary/5 space-y-4 border p-4">
            <h3 className="text-muted-foreground border-border/40 border-b pb-2 text-xs font-bold tracking-wider uppercase">
              Linguistic Constraints
            </h3>

            {/* Subtypes dropdown (if applicable) */}
            {subTypes.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-muted-foreground text-xs font-bold">Generation Preset</label>
                <Select value={gen.subType} onValueChange={gen.setSubType}>
                  <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors focus:border-[#0091ff]/50 focus:ring-1 focus:ring-[#0091ff]/50 focus:outline-none">
                    <SelectValue placeholder="Select preset" />
                  </SelectTrigger>
                  <SelectContent className="border-border/40 bg-background/95 max-h-[300px] backdrop-blur-md">
                    {subTypes.map((type) => (
                      <SelectItem
                        key={type.value}
                        value={type.value}
                        className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                      >
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Gender selection for people */}
            {category === "person" && gen.subType !== "generic" && (
              <div className="space-y-1.5">
                <label className="text-muted-foreground text-xs font-bold">Gender Modifier</label>
                <div className="flex gap-2">
                  {(["male", "female", "neutral"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => gen.setGender(g)}
                      className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold tracking-wider uppercase transition-all duration-200 ${
                        gen.gender === g
                          ? "border-[#0091ff]/30 bg-[#0091ff]/10 font-bold text-[#0091ff]"
                          : "border-border/60 bg-background text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Unified Culture Selector */}
            <div className="animate-in fade-in space-y-1.5 duration-200">
              <label className="text-muted-foreground text-xs font-bold">
                Culture / Linguistic Family
              </label>
              <Select value={gen.culture} onValueChange={gen.setCulture}>
                <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors focus:border-[#0091ff]/50 focus:outline-none">
                  <SelectValue placeholder="Select culture" />
                </SelectTrigger>
                <SelectContent className="border-border/40 bg-background/95 max-h-[300px] backdrop-blur-md">
                  <SelectItem
                    value="any"
                    className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                  >
                    Any / Mixed Culture
                  </SelectItem>
                  <SelectGroup>
                    <SelectLabel className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                      Linguistic Families
                    </SelectLabel>
                    <SelectItem
                      value="latin"
                      className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                    >
                      Latin / Romance
                    </SelectItem>
                    <SelectItem
                      value="germanic"
                      className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                    >
                      Germanic / Norse
                    </SelectItem>
                    <SelectItem
                      value="celtic"
                      className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                    >
                      Celtic / Gaelic
                    </SelectItem>
                    <SelectItem
                      value="slavic"
                      className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                    >
                      Slavic / Eastern European
                    </SelectItem>
                    <SelectItem
                      value="arabic"
                      className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                    >
                      Arabic / Semitic
                    </SelectItem>
                    <SelectItem
                      value="persian"
                      className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                    >
                      Persian / Iranian
                    </SelectItem>
                    <SelectItem
                      value="turkic"
                      className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                    >
                      Turkic / Central Asian
                    </SelectItem>
                    <SelectItem
                      value="indic"
                      className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                    >
                      Indic / South Asian
                    </SelectItem>
                    <SelectItem
                      value="east-asian"
                      className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                    >
                      East Asian / Romanized
                    </SelectItem>
                    <SelectItem
                      value="austronesian"
                      className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                    >
                      Austronesian / Polynesian
                    </SelectItem>
                    <SelectItem
                      value="african"
                      className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                    >
                      African / Sub-Saharan
                    </SelectItem>
                    <SelectItem
                      value="uralic"
                      className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                    >
                      Uralic / Finno-Ugric
                    </SelectItem>
                    <SelectItem
                      value="constructed"
                      className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                    >
                      Constructed / Fantasy (Tolkien)
                    </SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                      Hybrid Families
                    </SelectLabel>
                    <SelectItem
                      value="celtic+germanic"
                      className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                    >
                      Celtic + Germanic
                    </SelectItem>
                    <SelectItem
                      value="celtic+latin"
                      className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                    >
                      Celtic + Latin
                    </SelectItem>
                    <SelectItem
                      value="germanic+latin"
                      className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                    >
                      Germanic + Latin
                    </SelectItem>
                    <SelectItem
                      value="germanic+slavic"
                      className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                    >
                      Germanic + Slavic
                    </SelectItem>
                    <SelectItem
                      value="latin+slavic"
                      className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                    >
                      Latin + Slavic
                    </SelectItem>
                    <SelectItem
                      value="arabic+austronesian"
                      className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
                    >
                      Arabic + Austronesian
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-[10px]">
                Markov chains are trained on both curated linguistic presets and classified wiki
                corpora.
              </p>
            </div>

            {/* Advanced option toggler */}
            <div className="border-border/40 border-t pt-3">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-xs font-bold text-[#0091ff] transition-opacity hover:opacity-85"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>{showAdvanced ? "Hide Advanced Options" : "Show Advanced Options"}</span>
              </button>

              {showAdvanced && <AdvancedConlangSettings gen={gen} category={category} />}
            </div>

            <div className="border-border/40 mt-2 flex items-center gap-2 border-t pt-4">
              <div className="space-y-1 select-none">
                <label className="text-muted-foreground block text-[10px] font-bold uppercase">
                  Batch
                </label>
                <div className="border-border/60 bg-background mt-1 flex h-7 items-center gap-1 rounded-lg border p-0.5 select-none">
                  <button
                    type="button"
                    onClick={() => setBatchCount((c) => Math.max(5, c - 5))}
                    disabled={batchCount <= 5}
                    className="text-muted-foreground hover:text-foreground flex h-full cursor-pointer items-center px-2 text-xs font-bold disabled:opacity-30"
                  >
                    -
                  </button>
                  <NumberFlowDisplay
                    value={batchCount}
                    className="text-foreground min-w-[20px] px-1 text-center font-mono text-xs font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setBatchCount((c) => Math.min(50, c + 5))}
                    disabled={batchCount >= 50}
                    className="text-muted-foreground hover:text-foreground flex h-full cursor-pointer items-center px-2 text-xs font-bold disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={gen.isGenerating}
                className="mt-4 flex flex-1 items-center justify-center gap-2 self-end rounded-lg bg-[#0091ff] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[#0091ff]/10 transition-all hover:bg-[#33a7ff] active:scale-[0.98] disabled:opacity-50"
              >
                {gen.isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                <span>Assemble Names</span>
              </button>
            </div>
          </FacetCard>
        </div>

        {/* Right Column (7/12): Scrolling Results Card & Batch Actions */}
        <div className="space-y-4 lg:col-span-7">
          {gen.generatedNames.length > 0 ? (
            <FacetCard className="border-border/40 bg-secondary/5 space-y-4 border p-4">
              <div className="border-border/40 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                <div>
                  <h3 className="text-foreground text-sm font-bold tracking-tight">
                    Assembled Candidates
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    Select name options to copy, save, or deploy.
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

              {/* Inline Save Dictionary Form */}
              {showSaveDictForm && (
                <form
                  onSubmit={handleSaveBatchAsDictionary}
                  className="animate-in slide-in-from-top-2 flex items-center gap-2 rounded-xl border border-[#0091ff]/20 bg-[#0091ff]/5 p-3 duration-300"
                >
                  <input
                    type="text"
                    placeholder="Dictionary Title (e.g. Nordic Cities List)"
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
                {gen.generatedNames.map((name, idx) => {
                  const effectiveCulture =
                    gen.culture && gen.culture !== "any"
                      ? gen.culture
                      : gen.subType && gen.subType !== "generic"
                        ? `${gen.category}:${gen.subType}`
                        : gen.culture;

                  return (
                    <NameResultCard
                      key={`${name}-${idx}`}
                      name={name}
                      isSaved={bank.nameBank?.some(
                        (entry) => entry.type === "saved-name" && entry.title === name
                      )}
                      onSave={handleSaveName}
                      onUse={(n) => setUseName(n)}
                      culture={effectiveCulture}
                      naturalness={gen.scoreNaturalness(name)}
                    />
                  );
                })}
              </div>
            </FacetCard>
          ) : (
            <FacetCard className="border-border/40 bg-secondary/5 text-muted-foreground border border-dashed p-8 text-center text-sm">
              <Wand2 className="mx-auto mb-3 h-8 w-8 animate-pulse text-[#0091ff]/40" />
              <p className="font-semibold">Assemble names to start</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Configure your Markov constraints on the left and assemble a batch of custom name
                choices.
              </p>
            </FacetCard>
          )}
        </div>
      </div>

      {/* Redirect Modal */}
      {useName && (
        <UseNameDialog
          isOpen={!!useName}
          onClose={() => setUseName(null)}
          name={useName}
          category={category}
        />
      )}
    </div>
  );
}

export default GeneratorPanel;
