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
      <div className="space-y-1 border-b border-border/40 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>

      {/* Two-Column Adaptive Layout */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        
        {/* Left Column (5/12): Generator parameters inside FacetCard */}
        <div className="lg:col-span-5 space-y-4">
          <FacetCard className="space-y-4 p-4 border border-border/40 bg-secondary/5">
            <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase border-b border-border/40 pb-2">
              Linguistic Constraints
            </h3>

            {/* Subtypes dropdown (if applicable) */}
            {subTypes.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Generation Preset</label>
                <select
                  value={gen.subType}
                  onChange={(e) => gen.setSubType(e.target.value)}
                  className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus:border-[#0091ff]/50 focus:outline-none focus:ring-1 focus:ring-[#0091ff]/50"
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
                <label className="text-xs font-bold text-muted-foreground">Gender Modifier</label>
                <div className="flex gap-2">
                  {(["male", "female", "neutral"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => gen.setGender(g)}
                      className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                        gen.gender === g
                          ? "border-[#0091ff]/30 bg-[#0091ff]/10 text-[#0091ff] font-bold"
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
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <label className="text-xs font-bold text-muted-foreground">Culture / Linguistic Family</label>
              <select
                value={gen.culture}
                onChange={(e) => gen.setCulture(e.target.value)}
                className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus:border-[#0091ff]/50 focus:outline-none"
              >
                <option value="any">Any / Mixed Culture</option>
                <option value="latin">Latin / Romance</option>
                <option value="germanic">Germanic / Norse</option>
                <option value="celtic">Celtic / Gaelic</option>
                <option value="slavic">Slavic / Eastern European</option>
                <option value="arabic">Arabic / Semitic</option>
                <option value="east-asian">East Asian / Romanized</option>
                <option value="austronesian">Austronesian / Polynesian</option>
                <option value="constructed">Constructed / Fantasy (Tolkien)</option>
              </select>
              <p className="text-[10px] text-muted-foreground">
                Markov chains are trained on both curated linguistic presets and classified wiki corpora.
              </p>
            </div>

            {/* Advanced option toggler */}
            <div className="border-t border-border/40 pt-3">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-xs font-bold text-[#0091ff] hover:opacity-85 transition-opacity"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>{showAdvanced ? "Hide Advanced Options" : "Show Advanced Options"}</span>
              </button>

              {showAdvanced && (
                <div className="space-y-3.5 mt-3.5 animate-in fade-in duration-200">
                  {/* Include Live World Data Toggle */}
                  <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <div className="space-y-0.5 pr-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Include Live World Data</label>
                      <p className="text-[9px] text-muted-foreground leading-normal">
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
                    <div className="space-y-1.5 border-b border-border/40 pb-3">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Title Prefix</label>
                      <select
                        value={gen.selectedPrefix}
                        onChange={(e) => gen.setSelectedPrefix(e.target.value)}
                        className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none"
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
                          className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none mt-1 animate-in slide-in-from-top-1 duration-150"
                        />
                      )}
                    </div>
                  )}

                  {/* Category-aware Suffix Select (Organization, Country, Province categories only) */}
                  {(category === "organization" || category === "country" || category === "province") && (
                    <div className="space-y-1.5 border-b border-border/40 pb-3">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Name Suffix</label>
                      <select
                        value={gen.selectedSuffix}
                        onChange={(e) => gen.setSelectedSuffix(e.target.value)}
                        className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none"
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
                          className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none mt-1 animate-in slide-in-from-top-1 duration-150"
                        />
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Min Length</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={gen.options.minLength || 4}
                        onChange={(e) =>
                          gen.setOptions({ ...gen.options, minLength: parseInt(e.target.value) || 0 })
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
                        value={gen.options.maxLength || 12}
                        onChange={(e) =>
                          gen.setOptions({ ...gen.options, maxLength: parseInt(e.target.value) || 0 })
                        }
                        className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Substring constraint filters */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Starts With</label>
                      <input
                        type="text"
                        placeholder="e.g. Ae"
                        value={gen.options.startsWith || ""}
                        onChange={(e) => gen.setOptions({ ...gen.options, startsWith: e.target.value })}
                        className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Ends With</label>
                      <input
                        type="text"
                        placeholder="e.g. th"
                        value={gen.options.endsWith || ""}
                        onChange={(e) => gen.setOptions({ ...gen.options, endsWith: e.target.value })}
                        className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Markov Order Look-back */}
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Markov Order (Depth)</label>
                      <span className="text-[10px] text-[#0091ff] font-bold">{gen.order} char</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={4}
                      step={1}
                      value={gen.order}
                      onChange={(e) => gen.setOrder(parseInt(e.target.value))}
                      className="w-full h-1.5 rounded-lg bg-secondary/80 accent-[#0091ff] cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Assemble trigger button inside controls */}
            <div className="flex gap-2 items-center border-t border-border/40 pt-4 mt-2">
              <div className="w-20">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Batch</label>
                <select
                  value={batchCount}
                  onChange={(e) => setBatchCount(parseInt(e.target.value))}
                  className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground focus:outline-none mt-1"
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
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#0091ff] hover:bg-[#33a7ff] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[#0091ff]/10 active:scale-[0.98] transition-all disabled:opacity-50 mt-4 self-end"
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
        <div className="lg:col-span-7 space-y-4">
          {gen.generatedNames.length > 0 ? (
            <FacetCard className="p-4 border border-border/40 bg-secondary/5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-foreground">
                    Assembled Candidates
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Select name options to copy, save, or deploy.
                  </p>
                </div>

                {/* Batch Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyBatch}
                    className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all"
                  >
                    {copiedBatch ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedBatch ? "Copied" : "Copy Batch"}</span>
                  </button>

                  <button
                    onClick={() => setShowSaveDictForm(!showSaveDictForm)}
                    className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all"
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
                  className="flex items-center gap-2 rounded-xl border border-[#0091ff]/20 bg-[#0091ff]/5 p-3 animate-in slide-in-from-top-2 duration-300"
                >
                  <input
                    type="text"
                    placeholder="Dictionary Title (e.g. Nordic Cities List)"
                    required
                    value={dictionaryTitle}
                    onChange={(e) => setDictionaryTitle(e.target.value)}
                    className="flex-1 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSavingDict}
                    className="flex items-center gap-1.5 rounded-lg bg-[#0091ff] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#33a7ff] disabled:opacity-50 transition-colors"
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
              <div className="grid gap-3 sm:grid-cols-2 max-h-[500px] overflow-y-auto pr-1">
                {gen.generatedNames.map((name, idx) => (
                  <NameResultCard
                    key={idx}
                    name={name}
                    onSave={handleSaveName}
                    onUse={(n) => setUseName(n)}
                    culture={gen.culture}
                  />
                ))}
              </div>
            </FacetCard>
          ) : (
            <FacetCard className="p-8 border border-border/40 border-dashed bg-secondary/5 text-center text-sm text-muted-foreground">
              <Wand2 className="h-8 w-8 mx-auto text-[#0091ff]/40 mb-3 animate-pulse" />
              <p className="font-semibold">Assemble names to start</p>
              <p className="text-xs text-muted-foreground mt-1">
                Configure your Markov constraints on the left and assemble a batch of custom name choices.
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
