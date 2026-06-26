"use client";

// src/app/labs/onoma/components/sections/OverviewSection.tsx
// Onoma Lab — Overview & Quick Generator Section (Facet Rebuild)

import { useState, useEffect, useRef } from "react";
import { 
  Compass, 
  Wand2, 
  SlidersHorizontal, 
  Copy, 
  Check, 
  Bookmark, 
  Plus, 
  Loader2, 
  Dna,
  BookOpen,
  Info
} from "lucide-react";
import { useNameBank } from "~/hooks/useNameBank";
import { MarkovChain } from "~/lib/onoma/markov-chain";
import { generateFantasySyllableName } from "~/lib/onoma/name-generator";
import { FacetCard } from "~/components/ui/facet-container";
import { NameResultCard } from "../shared/NameResultCard";
import { UseNameDialog } from "../shared/UseNameDialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import type { NameCategory, GenerateOptions } from "~/lib/onoma/types";

export function OverviewSection() {
  const bank = useNameBank();
  
  // Public dictionaries
  const publicDicts = bank.publicDictionaries || [];

  // Local UI State
  const [selectedDictId, setSelectedDictId] = useState<string>("");
  const [batchCount, setBatchCount] = useState<number>(30);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [order, setOrder] = useState<number>(3);
  
  // Markov Generation Options
  const [options, setOptions] = useState<GenerateOptions>({
    minLength: 4,
    maxLength: 12,
    allowDuplicates: false,
    startsWith: "",
    endsWith: "",
    contains: "",
    excludes: "",
  });

  // Generation outputs
  const [generatedNames, setGeneratedNames] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedBatch, setCopiedBatch] = useState<boolean>(false);

  // Dictionary saving states
  const [dictionaryTitle, setDictionaryTitle] = useState<string>("");
  const [isSavingDict, setIsSavingDict] = useState<boolean>(false);
  const [showSaveDictForm, setShowSaveDictForm] = useState<boolean>(false);

  // Deploying name modal
  const [useName, setUseName] = useState<string | null>(null);

  const hasGeneratedOnLoad = useRef(false);

  // Auto-select "Iron Age States" dictionary when loaded
  useEffect(() => {
    if (publicDicts.length > 0 && !selectedDictId) {
      const ironAgeDict = publicDicts.find(
        (d) => d.title.toLowerCase() === "iron age states"
      );
      setSelectedDictId(ironAgeDict ? ironAgeDict.id : publicDicts[0].id);
    }
  }, [publicDicts, selectedDictId]);

  // Find currently selected dictionary details
  const selectedDict = publicDicts.find((d) => d.id === selectedDictId);

  // Auto-generate on load once a dictionary is selected
  useEffect(() => {
    if (selectedDict && !hasGeneratedOnLoad.current) {
      hasGeneratedOnLoad.current = true;
      setIsGenerating(true);
      try {
        const chain = new MarkovChain(order);
        chain.addWords(selectedDict.values);
        const results: string[] = [];
        for (let i = 0; i < batchCount; i++) {
          let name = chain.generate(options);
          if (!name) {
            name = generateFantasySyllableName();
          }
          results.push(name);
        }
        setGeneratedNames(results);
      } catch (err) {
        console.error("Failed to generate Markov names on load:", err);
      } finally {
        setIsGenerating(false);
      }
    }
  }, [selectedDict, order, batchCount, options]);

  // Perform Generation
  const handleGenerate = () => {
    if (!selectedDict) return;
    setIsGenerating(true);

    try {
      // 1. Instantiate and train Markov Chain
      const chain = new MarkovChain(order);
      chain.addWords(selectedDict.values);

      // 2. Generate batch size
      const results: string[] = [];
      for (let i = 0; i < batchCount; i++) {
        let name = chain.generate(options);
        if (!name) {
          name = generateFantasySyllableName();
        }
        results.push(name);
      }

      setGeneratedNames(results);
    } catch (err) {
      console.error("Failed to generate Markov names:", err);
    } finally {
      setIsGenerating(false);
      setShowSaveDictForm(false);
    }
  };

  // Save single generated name
  const handleSaveName = async (name: string, stashId?: string) => {
    const category = (selectedDict?.category as NameCategory) || "person";
    await bank.saveEntry({
      type: "saved-name",
      title: name,
      values: [name],
      category,
      stashId,
    });
  };

  // Copy entire batch
  const handleCopyBatch = async () => {
    if (generatedNames.length === 0) return;
    try {
      await navigator.clipboard.writeText(generatedNames.join(", "));
      setCopiedBatch(true);
      setTimeout(() => setCopiedBatch(false), 2000);
    } catch (err) {
      console.error("Failed to copy batch:", err);
    }
  };

  // Save batch as dictionary
  const handleSaveBatchAsDictionary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dictionaryTitle.trim() || generatedNames.length === 0) return;
    setIsSavingDict(true);
    try {
      const category = (selectedDict?.category as NameCategory) || "person";
      await bank.saveEntry({
        type: "dictionary",
        title: dictionaryTitle.trim(),
        values: generatedNames,
        category,
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

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-xl border border-[#0091ff]/20 bg-[#0091ff]/5 p-6">
        <div className="relative z-10 max-w-xl space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0091ff]/10 px-3 py-1 text-xs font-semibold text-[#0091ff]">
            <Compass className="h-3 w-3" />
            Onoma (/ˈɒnəmə/ • Greek for “name,” root of onomastics)
          </span>
          <h1 className="text-2xl font-extrabold tracking-wide text-foreground sm:text-3xl">
            Project Onoma
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A{" "}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="underline decoration-dotted decoration-[#0091ff]/60 underline-offset-4 cursor-help hover:text-[#0091ff] transition-colors">
                  Markov-based
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                A Markov chain is a procedural algorithm used to make coherent chains of values.
              </TooltipContent>
            </Tooltip>{" "}
            name generator for worldbuilding. Instantly create names from public name banks, or create your own set of data to generate any kind of name.
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 select-none pt-1">
            <Info className="h-3.5 w-3.5 text-[#0091ff]/50 shrink-0" />
            <span>Disclaimer: Onoma is a mathematical procedural generator, not a generative AI / LLM model.</span>
          </div>
        </div>
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 dark:opacity-5 pointer-events-none">
          <Dna className="h-full w-full stroke-1 text-[#0091ff]" />
        </div>
      </div>

      {/* Quick Generator Workspace */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        
        {/* Left Column (5/12): Configuration Panel */}
        <div className="lg:col-span-5 space-y-4">
          <FacetCard className="space-y-4 p-4 border border-border/40 bg-secondary/5">
            <div className="border-b border-border/40 pb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Quick Generator Controls
              </h3>
              <span className="text-[10px] text-muted-foreground font-semibold">
                Select Dictionary Profile
              </span>
            </div>

            {/* Dictionary Select Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5 text-[#0091ff]" />
                 Dictionary Profile
              </label>
              <select
                value={selectedDictId}
                onChange={(e) => setSelectedDictId(e.target.value)}
                className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus:border-[#0091ff]/50 focus:outline-none focus:ring-1 focus:ring-[#0091ff]/50"
              >
                {publicDicts.map((dict) => (
                  <option key={dict.id} value={dict.id}>
                    {dict.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Batch Count Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">Generated Batch Size</label>
              <select
                value={batchCount}
                onChange={(e) => setBatchCount(parseInt(e.target.value))}
                className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground focus:border-[#0091ff]/50 focus:outline-none focus:ring-1 focus:ring-[#0091ff]/50"
              >
                <option value={10}>10 names</option>
                <option value={30}>30 names</option>
                <option value={60}>60 names</option>
                <option value={100}>100 names</option>
                <option value={250}>250 names</option>
                <option value={500}>500 names</option>
              </select>
            </div>

            {/* Advanced Settings Accordion */}
            <div className="border-t border-border/40 pt-3">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-xs font-bold text-[#0091ff] hover:opacity-85 transition-opacity"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>{showAdvanced ? "Hide Advanced Constraints" : "Show Advanced Constraints"}</span>
              </button>

              {showAdvanced && (
                <div className="space-y-3.5 mt-3.5 animate-in fade-in duration-200">
                  {/* Min / Max Length */}
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

                  {/* Starts / Ends With */}
                  <div className="grid grid-cols-2 gap-3">
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

                  {/* Contains / Excludes */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Contains</label>
                      <input
                        type="text"
                        placeholder="Substring"
                        value={options.contains || ""}
                        onChange={(e) => setOptions({ ...options, contains: e.target.value })}
                        className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Excludes</label>
                      <input
                        type="text"
                        placeholder="Substring"
                        value={options.excludes || ""}
                        onChange={(e) => setOptions({ ...options, excludes: e.target.value })}
                        className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Markov Order */}
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

                  {/* Allow duplicates */}
                  <div className="flex items-center justify-between border-t border-border/40 pt-3">
                    <label className="text-xs font-semibold text-muted-foreground">Allow Dictionary Duplicates</label>
                    <input
                      type="checkbox"
                      checked={options.allowDuplicates}
                      onChange={(e) => setOptions({ ...options, allowDuplicates: e.target.checked })}
                      className="rounded border-border/60 text-[#0091ff] focus:ring-[#0091ff]/50 h-4 w-4"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Trigger Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedDictId}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#0091ff] hover:bg-[#33a7ff] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[#0091ff]/10 active:scale-[0.98] transition-all disabled:opacity-50 mt-4"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              <span>Assemble Names</span>
            </button>
          </FacetCard>
        </div>

        {/* Right Column (7/12): Results Card */}
        <div className="lg:col-span-7 space-y-4">
          {generatedNames.length > 0 ? (
            <FacetCard className="p-4 border border-border/40 bg-secondary/5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-foreground">
                    Assembled Candidates
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Click name cards to copy, save, or deploy them in game.
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

              {/* Save Dictionary Form */}
              {showSaveDictForm && (
                <form
                  onSubmit={handleSaveBatchAsDictionary}
                  className="flex items-center gap-2 rounded-xl border border-[#0091ff]/20 bg-[#0091ff]/5 p-3 animate-in slide-in-from-top-2 duration-300"
                >
                  <input
                    type="text"
                    placeholder="Dictionary Title (e.g. Generated Cities)"
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
                {generatedNames.map((name, idx) => (
                  <NameResultCard
                    key={idx}
                    name={name}
                    onSave={handleSaveName}
                    onUse={(n) => setUseName(n)}
                  />
                ))}
              </div>
            </FacetCard>
          ) : (
            <FacetCard className="p-8 border border-border/40 border-dashed bg-secondary/5 text-center text-sm text-muted-foreground">
              <Wand2 className="h-8 w-8 mx-auto text-[#0091ff]/40 mb-3 animate-pulse" />
              <p className="font-semibold">Assemble names to start</p>
              <p className="text-xs text-muted-foreground mt-1">
                Configure your dictionary and generation constraints, then click Assemble to generate names.
              </p>
            </FacetCard>
          )}
        </div>

      </div>

      {/* Redirect Modal for deployment */}
      {useName && (
        <UseNameDialog
          isOpen={!!useName}
          onClose={() => setUseName(null)}
          name={useName}
          category={(selectedDict?.category as NameCategory) || "person"}
        />
      )}
    </div>
  );
}

export default OverviewSection;
