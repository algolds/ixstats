"use client";

// src/app/labs/onoma/components/sections/OverviewSection.tsx
// Onoma Lab — Overview & Quick Generator Section (Facet Rebuild)

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Compass,
  Wand2,
  SlidersHorizontal,
  Copy,
  Check,
  Bookmark,
  Plus,
  Loader2,
  BookOpen,
  Info,
  Volume2,
} from "lucide-react";
import { useNameBank } from "~/hooks/useNameBank";
import { MarkovChain } from "~/lib/onoma/markov-chain";
import { generateFantasySyllableName } from "~/lib/onoma/name-generator";
import { FacetCard } from "~/components/ui/facet-container";
import { NameResultCard } from "../shared/NameResultCard";
import { UseNameDialog } from "../shared/UseNameDialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import type { NameCategory, GenerateOptions } from "~/lib/onoma/types";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { OnomaDoubleHelixIcon } from "../shared/OnomaDoubleHelixIcon";

export function OverviewSection() {
  const bank = useNameBank();

  // Smart SpeechSynthesis handler for "Onoma" pronunciation
  const playPronunciation = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance();
    const voices = window.speechSynthesis.getVoices();

    const greekVoice = voices.find((v) => v.lang.startsWith("el-") || v.lang.includes("Greek"));

    if (greekVoice) {
      utterance.voice = greekVoice;
      utterance.text = "Όνομα";
      utterance.lang = "el-GR";
    } else {
      utterance.text = "OH-nuh-muh";
      utterance.lang = "en-US";
      const englishVoice = voices.find(
        (v) => v.lang.startsWith("en-") || v.lang.includes("English")
      );
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
    }

    utterance.rate = 0.82;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Public dictionaries
  const publicDicts = useMemo(() => bank.publicDictionaries || [], [bank.publicDictionaries]);

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

  // Hover state for hero branding animation
  const [isHeroHovered, setIsHeroHovered] = useState<boolean>(false);

  const hasGeneratedOnLoad = useRef(false);

  // Auto-select "Iron Age States" dictionary when loaded
  useEffect(() => {
    if (publicDicts.length > 0 && !selectedDictId) {
      const ironAgeDict = publicDicts.find((d) => d.title.toLowerCase() === "iron age states");
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
      <div
        onMouseEnter={() => setIsHeroHovered(true)}
        onMouseLeave={() => setIsHeroHovered(false)}
        className="group relative overflow-hidden rounded-xl border border-[#0091ff]/20 hover:border-[#0091ff]/35 bg-gradient-to-br from-[#0091ff]/[0.06] via-[#0091ff]/[0.02] to-indigo-500/[0.04] dark:from-[#0091ff]/[0.08] dark:via-[#0091ff]/[0.02] dark:to-indigo-500/[0.06] backdrop-blur-md p-6 transition-all duration-500 shadow-md shadow-[#0091ff]/2 hover:shadow-[0_0_20px_rgba(0,145,255,0.06)] dark:hover:shadow-[0_0_24px_rgba(0,145,255,0.12)]"
      >
        {/* Texture Overlay */}
        <div className="pointer-events-none absolute -inset-2 opacity-[0.02] transition-all duration-500 ease-out group-hover:translate-x-1 group-hover:translate-y-1 group-hover:opacity-[0.08] group-hover:blur-[0.5px] dark:opacity-[0.12] dark:group-hover:opacity-[0.25]">
          <TextureOverlay texture="grid" className="mix-blend-overlay" />
        </div>

        <div className="relative z-10 max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0091ff]/10 px-3 py-1 text-xs font-semibold text-[#0091ff]">
            <Compass className="h-3 w-3" />
            Onoma (
            <button
              onClick={playPronunciation}
              className="inline-flex cursor-pointer items-center gap-0.5 font-mono underline decoration-[#0091ff]/40 decoration-dotted transition-all select-none hover:text-[#0091ff] hover:decoration-[#0091ff] focus:outline-none"
              title="Listen to pronunciation"
            >
              /ˈɒnəmə/
              <Volume2 className="h-3.5 w-3.5 shrink-0 opacity-70 transition-all duration-200 hover:scale-110 hover:opacity-100" />
            </button>
            • Greek for “name,” root of onomastics)
          </span>
          <h1 className="text-foreground text-2xl font-extrabold tracking-wide sm:text-3xl">
            Project Onoma
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            A{" "}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help underline decoration-[#0091ff]/60 decoration-dotted underline-offset-4 transition-colors hover:text-[#0091ff]">
                  Markov-based
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                A Markov chain is a procedural algorithm used to make coherent chains of values.
              </TooltipContent>
            </Tooltip>{" "}
            name generator for worldbuilding. Instantly create names from public name banks, or
            create your own set of data to generate any kind of name.
          </p>
          <div className="text-muted-foreground/60 flex items-center gap-1.5 pt-1 text-[11px] select-none">
            <Info className="h-3.5 w-3.5 shrink-0 text-[#0091ff]/50" />
            <span>
              Disclaimer: Onoma is a mathematical procedural generator, not a generative AI / LLM
              model.
            </span>
          </div>
        </div>
        
        {/* Apple-style Glassmorphic App Icon Widget Container */}
        <div className="hidden sm:flex absolute right-6 top-1/2 -translate-y-1/2 items-center justify-center z-20 pointer-events-none">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[22%] backdrop-blur-xl bg-white/40 dark:bg-neutral-900/60 border border-white/50 dark:border-neutral-800/80 shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.3)] flex items-center justify-center overflow-hidden transition-all duration-500 group-hover:scale-105 group-hover:shadow-[0_12px_48px_rgba(0,145,255,0.15)] dark:group-hover:shadow-[0_16px_56px_rgba(0,145,255,0.25)]">
            {/* Ambient background glow inside the squircle */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-[#0091ff]/10 to-indigo-500/10 dark:from-[#0091ff]/15 dark:to-indigo-500/15 opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
            <OnomaDoubleHelixIcon className="h-4/5 w-4/5 relative z-10" isHovered={isHeroHovered} />
          </div>
        </div>
      </div>

      {/* Quick Generator Workspace */}
      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Left Column (5/12): Configuration Panel */}
        <div className="space-y-4 lg:col-span-5">
          <FacetCard className="border-border/40 bg-secondary/5 space-y-4 border p-4">
            <div className="border-border/40 flex items-center justify-between border-b pb-2">
              <h3 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                Quick Generator Controls
              </h3>
              <span className="text-muted-foreground text-[10px] font-semibold">
                Select Dictionary Profile
              </span>
            </div>

            {/* Dictionary Select Dropdown */}
            <div className="space-y-1.5">
              <label className="text-muted-foreground flex items-center gap-1 text-xs font-bold">
                <BookOpen className="h-3.5 w-3.5 text-[#0091ff]" />
                Dictionary Profile
              </label>
              <select
                value={selectedDictId}
                onChange={(e) => setSelectedDictId(e.target.value)}
                className="border-border/60 bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm focus:border-[#0091ff]/50 focus:ring-1 focus:ring-[#0091ff]/50 focus:outline-none"
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
              <label className="text-muted-foreground text-xs font-bold">
                Generated Batch Size
              </label>
              <select
                value={batchCount}
                onChange={(e) => setBatchCount(parseInt(e.target.value))}
                className="border-border/60 bg-background text-foreground w-full rounded-lg border px-3 py-2 text-sm focus:border-[#0091ff]/50 focus:ring-1 focus:ring-[#0091ff]/50 focus:outline-none"
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
            <div className="border-border/40 border-t pt-3">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-xs font-bold text-[#0091ff] transition-opacity hover:opacity-85"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>
                  {showAdvanced ? "Hide Advanced Constraints" : "Show Advanced Constraints"}
                </span>
              </button>

              {showAdvanced && (
                <div className="animate-in fade-in mt-3.5 space-y-3.5 duration-200">
                  {/* Min / Max Length */}
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

                  {/* Starts / Ends With */}
                  <div className="grid grid-cols-2 gap-3">
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

                  {/* Contains / Excludes */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-muted-foreground text-[10px] font-bold uppercase">
                        Contains
                      </label>
                      <input
                        type="text"
                        placeholder="Substring"
                        value={options.contains || ""}
                        onChange={(e) => setOptions({ ...options, contains: e.target.value })}
                        className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-muted-foreground text-[10px] font-bold uppercase">
                        Excludes
                      </label>
                      <input
                        type="text"
                        placeholder="Substring"
                        value={options.excludes || ""}
                        onChange={(e) => setOptions({ ...options, excludes: e.target.value })}
                        className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Markov Order */}
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

                  {/* Allow duplicates */}
                  <div className="border-border/40 flex items-center justify-between border-t pt-3">
                    <label className="text-muted-foreground text-xs font-semibold">
                      Allow Dictionary Duplicates
                    </label>
                    <input
                      type="checkbox"
                      checked={options.allowDuplicates}
                      onChange={(e) =>
                        setOptions({ ...options, allowDuplicates: e.target.checked })
                      }
                      className="border-border/60 h-4 w-4 rounded text-[#0091ff] focus:ring-[#0091ff]/50"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Trigger Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !selectedDictId}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0091ff] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[#0091ff]/10 transition-all hover:bg-[#33a7ff] active:scale-[0.98] disabled:opacity-50"
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
        <div className="space-y-4 lg:col-span-7">
          {generatedNames.length > 0 ? (
            <FacetCard className="border-border/40 bg-secondary/5 space-y-4 border p-4">
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
                    key={idx}
                    name={name}
                    onSave={handleSaveName}
                    onUse={(n) => setUseName(n)}
                  />
                ))}
              </div>
            </FacetCard>
          ) : (
            <FacetCard className="border-border/40 bg-secondary/5 text-muted-foreground border border-dashed p-8 text-center text-sm">
              <Wand2 className="mx-auto mb-3 h-8 w-8 animate-pulse text-[#0091ff]/40" />
              <p className="font-semibold">Assemble names to start</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Configure your dictionary and generation constraints, then click Assemble to
                generate names.
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
