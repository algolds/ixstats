"use client";

// src/app/labs/onoma/components/sections/StudioSection.tsx
// Onoma Lab — Custom Markov Chain Studio Workshop (Facet Rebuild)

import { useState, useMemo, useEffect } from "react";
import { Wand2, SlidersHorizontal, Plus, Bookmark, Loader2, Info, Upload } from "lucide-react";
import { MarkovChain } from "~/lib/onoma/markov-chain";
import { NameResultCard } from "../shared/NameResultCard";
import { useNameBank } from "~/hooks/useNameBank";
import { type GenerateOptions } from "~/lib/onoma/types";
import { FacetCard } from "~/components/ui/facet-container";

interface StudioSectionProps {
  initialWords?: string[];
  initialTitle?: string;
  onClearInitial?: () => void;
}

export function StudioSection({ initialWords, initialTitle, onClearInitial }: StudioSectionProps = {}) {
  const bank = useNameBank();

  // Training Words Input
  const [inputText, setInputText] = useState(
    "roma, mediolanum, carthago, ravenna, verona, pompeii, florentia, corduba, toletum, tarraco"
  );
  
  // Generator Config
  const [order, setOrder] = useState<number>(3);
  const [batchCount, setBatchCount] = useState<number>(10);
  const [options, setOptions] = useState<GenerateOptions>({
    minLength: 4,
    maxLength: 12,
    allowDuplicates: false,
  });

  // Output State
  const [generatedNames, setGeneratedNames] = useState<string[]>([]);
  const [dictTitle, setDictTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (initialWords && initialWords.length > 0) {
      setInputText(initialWords.join(", "));
      if (initialTitle) {
        setDictTitle(initialTitle);
      }
      onClearInitial?.();
    }
  }, [initialWords, initialTitle, onClearInitial]);

  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let mergedText = "";
    let filesProcessed = 0;
    const fileList = Array.from(files);

    fileList.forEach((file) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          mergedText += (mergedText ? ", " : "") + text;
        }
        filesProcessed++;

        if (filesProcessed === fileList.length) {
          const words = mergedText
            .split(/[,\n]/)
            .map((w) => w.trim())
            .filter((w) => w.length > 0);

          setInputText((prev) => {
            const trimmedPrev = prev.trim();
            return trimmedPrev ? `${trimmedPrev}, ${mergedText}` : mergedText;
          });

          setUploadStatus(`Loaded ${words.length} words from ${fileList.length} file(s).`);
          setTimeout(() => setUploadStatus(null), 4000);
          e.target.value = "";
        }
      };

      reader.onerror = () => {
        console.error(`Failed to read file: ${file.name}`);
        filesProcessed++;
        if (filesProcessed === fileList.length) {
          e.target.value = "";
        }
      };

      reader.readAsText(file);
    });
  };

  // Parse words from input text
  const trainingWords = useMemo(() => {
    return inputText
      .split(/[,\n]/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0);
  }, [inputText]);

  // Handle generation
  const handleGenerate = () => {
    if (trainingWords.length === 0) return;
    const chain = new MarkovChain(order);
    chain.addWords(trainingWords);

    const names: string[] = [];
    for (let i = 0; i < batchCount; i++) {
      const name = chain.generate(options);
      if (name) {
        names.push(name);
      } else {
        // Fallback to random capitalized word from input to avoid blank cards
        const randSeed = trainingWords[Math.floor(Math.random() * trainingWords.length)];
        names.push(MarkovChain.capitalize(randSeed));
      }
    }
    setGeneratedNames(names);
  };

  // Save the training seeds as a dictionary to NameBank
  const handleSaveDictionary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dictTitle.trim() || trainingWords.length === 0) return;
    setIsSaving(true);
    try {
      await bank.saveEntry({
        type: "dictionary",
        title: dictTitle.trim(),
        values: trainingWords,
        isPublic: false,
      });
      setDictTitle("");
      setSuccessMsg("Dictionary saved to Name Bank successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Failed to save dictionary:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-1 border-b border-border/40 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Custom Markov Studio</h2>
        <p className="text-sm text-muted-foreground">
          Paste your own custom seed lists to train a dedicated Markov model.
        </p>
      </div>

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
                </div>
              </div>
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
            <form
              onSubmit={handleSaveDictionary}
              className="flex items-center gap-2 rounded-xl border border-[#0091ff]/25 bg-[#0091ff]/5 p-3.5"
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
                onClick={handleGenerate}
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
    </div>
  );
}

export default StudioSection;
