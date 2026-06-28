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
import { AppleSwitch } from "~/components/unlumen-ui/apple-switch";

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
                <select
                  value={gen.subType}
                  onChange={(e) => gen.setSubType(e.target.value)}
                  className="border-border/60 bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm focus:border-[#0091ff]/50 focus:ring-1 focus:ring-[#0091ff]/50 focus:outline-none"
                >
                  {subTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
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
              <select
                value={gen.culture}
                onChange={(e) => gen.setCulture(e.target.value)}
                className="border-border/60 bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm focus:border-[#0091ff]/50 focus:outline-none"
              >
                <option value="any">Any / Mixed Culture</option>
                <optgroup label="Linguistic Families">
                  <option value="latin">Latin / Romance</option>
                  <option value="germanic">Germanic / Norse</option>
                  <option value="celtic">Celtic / Gaelic</option>
                  <option value="slavic">Slavic / Eastern European</option>
                  <option value="arabic">Arabic / Semitic</option>
                  <option value="persian">Persian / Iranian</option>
                  <option value="turkic">Turkic / Central Asian</option>
                  <option value="indic">Indic / South Asian</option>
                  <option value="east-asian">East Asian / Romanized</option>
                  <option value="austronesian">Austronesian / Polynesian</option>
                  <option value="african">African / Sub-Saharan</option>
                  <option value="uralic">Uralic / Finno-Ugric</option>
                  <option value="constructed">Constructed / Fantasy (Tolkien)</option>
                </optgroup>
                <optgroup label="Hybrid Families (places &amp; people)">
                  <option value="celtic+germanic">Celtic + Germanic</option>
                  <option value="celtic+latin">Celtic + Latin</option>
                  <option value="germanic+latin">Germanic + Latin</option>
                  <option value="germanic+slavic">Germanic + Slavic</option>
                  <option value="latin+slavic">Latin + Slavic</option>
                  <option value="arabic+austronesian">Arabic + Austronesian</option>
                </optgroup>
              </select>
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

              {showAdvanced && (
                <div className="animate-in fade-in mt-3.5 space-y-3.5 duration-200">
                  {/* Include Live World Data Toggle */}
                  <div className="border-border/40 flex items-center justify-between border-b pb-3">
                    <div className="space-y-0.5 pr-2">
                      <label className="text-muted-foreground text-[10px] font-bold uppercase">
                        Include Live World Data
                      </label>
                      <p className="text-muted-foreground text-[9px] leading-normal">
                        Blend live database records (cities, leaders) into training seeds.
                      </p>
                    </div>
                    <AppleSwitch
                      checked={gen.includeWorldData}
                      onCheckedChange={gen.setIncludeWorldData}
                      size="sm"
                    />
                  </div>

                  {/* Category-aware Prefix Title Select (Person Category only) */}
                  {category === "person" && (
                    <div className="border-border/40 space-y-1.5 border-b pb-3">
                      <label className="text-muted-foreground text-[10px] font-bold uppercase">
                        Title Prefix
                      </label>
                      <select
                        value={gen.selectedPrefix}
                        onChange={(e) => gen.setSelectedPrefix(e.target.value)}
                        className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1 text-xs focus:outline-none"
                      >
                        <option value="">None</option>
                        <option value="King">King</option>
                        <option value="Queen">Queen</option>
                        <option value="Prince">Prince</option>
                        <option value="Princess">Princess</option>
                        <option value="Lord">Lord</option>
                        <option value="Lady">Lady</option>
                        <option value="Sir">Sir</option>
                        <option value="General">General</option>
                        <option value="President">President</option>
                        <option value="Governor">Governor</option>
                        <option value="Minister">Minister</option>
                        <option value="Dr.">Dr.</option>
                        <option value="custom">Custom Prefix...</option>
                      </select>

                      {gen.selectedPrefix === "custom" && (
                        <input
                          type="text"
                          placeholder="e.g. Grand Duke"
                          value={gen.customPrefix}
                          onChange={(e) => gen.setCustomPrefix(e.target.value)}
                          className="border-border/60 bg-background text-foreground animate-in slide-in-from-top-1 mt-1 w-full rounded-lg border px-2.5 py-1 text-xs duration-150 focus:outline-none"
                        />
                      )}
                    </div>
                  )}

                  {/* Category-aware Suffix Select (Organization, Country, Province categories only) */}
                  {(category === "organization" ||
                    category === "country" ||
                    category === "province") && (
                    <div className="border-border/40 space-y-1.5 border-b pb-3">
                      <label className="text-muted-foreground text-[10px] font-bold uppercase">
                        Name Suffix
                      </label>
                      <select
                        value={gen.selectedSuffix}
                        onChange={(e) => gen.setSelectedSuffix(e.target.value)}
                        className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1 text-xs focus:outline-none"
                      >
                        <option value="">None</option>
                        <option value="Association">Association</option>
                        <option value="Committee">Committee</option>
                        <option value="Society">Society</option>
                        <option value="Alliance">Alliance</option>
                        <option value="Union">Union</option>
                        <option value="Club">Club</option>
                        <option value="Company">Company</option>
                        <option value="Party">Party</option>
                        <option value="Organization">Organization</option>
                        <option value="custom">Custom Suffix...</option>
                      </select>

                      {gen.selectedSuffix === "custom" && (
                        <input
                          type="text"
                          placeholder="e.g. Guild"
                          value={gen.customSuffix}
                          onChange={(e) => gen.setCustomSuffix(e.target.value)}
                          className="border-border/60 bg-background text-foreground animate-in slide-in-from-top-1 mt-1 w-full rounded-lg border px-2.5 py-1 text-xs duration-150 focus:outline-none"
                        />
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-muted-foreground text-[10px] font-bold uppercase">
                        Min Length
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={gen.options.minLength || 4}
                        onChange={(e) =>
                          gen.setOptions({
                            ...gen.options,
                            minLength: parseInt(e.target.value) || 0,
                          })
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
                        value={gen.options.maxLength || 12}
                        onChange={(e) =>
                          gen.setOptions({
                            ...gen.options,
                            maxLength: parseInt(e.target.value) || 0,
                          })
                        }
                        className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1 text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Substring constraint filters */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-muted-foreground text-[10px] font-bold uppercase">
                        Starts With
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Ae"
                        value={gen.options.startsWith || ""}
                        onChange={(e) =>
                          gen.setOptions({ ...gen.options, startsWith: e.target.value })
                        }
                        className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1 text-xs focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-muted-foreground text-[10px] font-bold uppercase">
                        Ends With
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. th"
                        value={gen.options.endsWith || ""}
                        onChange={(e) =>
                          gen.setOptions({ ...gen.options, endsWith: e.target.value })
                        }
                        className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1 text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Markov Order Look-back */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="text-muted-foreground text-[10px] font-bold uppercase">
                        Markov Order (Depth)
                      </label>
                      <span className="text-[10px] font-bold text-[#0091ff]">{gen.order} char</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={4}
                      step={1}
                      value={gen.order}
                      onChange={(e) => gen.setOrder(parseInt(e.target.value))}
                      className="bg-secondary/80 h-1.5 w-full cursor-pointer rounded-lg accent-[#0091ff]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Assemble trigger button inside controls */}
            <div className="border-border/40 mt-2 flex items-center gap-2 border-t pt-4">
              <div className="w-20">
                <label className="text-muted-foreground text-[10px] font-bold uppercase">
                  Batch
                </label>
                <select
                  value={batchCount}
                  onChange={(e) => setBatchCount(parseInt(e.target.value))}
                  className="border-border/60 bg-background text-foreground mt-1 w-full rounded-md border px-2 py-1 text-xs focus:outline-none"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                </select>
              </div>

              <button
                onClick={handleGenerate}
                disabled={gen.isGenerating}
                className="mt-4 flex flex-1 items-center justify-center gap-2 self-end rounded-lg bg-[#0091ff] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[#0091ff]/10 transition-all hover:bg-[#33a7ff] active:scale-[0.98] disabled:opacity-50"
              >
                {gen.isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 fill-slate-950" />
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
                {gen.generatedNames.map((name, idx) => (
                  <NameResultCard
                    key={`${name}-${idx}`}
                    name={name}
                    isSaved={bank.nameBank?.some((entry) => entry.type === "saved-name" && entry.title === name)}
                    onSave={handleSaveName}
                    onUse={(n) => setUseName(n)}
                    culture={gen.culture}
                    naturalness={gen.scoreNaturalness(name)}
                  />
                ))}
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
