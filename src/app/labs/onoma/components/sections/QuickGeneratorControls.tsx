"use client";

// src/app/labs/onoma/components/sections/QuickGeneratorControls.tsx
// Onoma Lab — Quick Generator Controls subcomponent

import { BookOpen, SlidersHorizontal, Wand2, Loader2 } from "lucide-react";
import { FacetCard } from "~/components/ui/facet-container";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { GenerateOptions } from "~/lib/onoma/types";

interface QuickGeneratorControlsProps {
  selectedDictId: string;
  setSelectedDictId: (id: string) => void;
  publicDicts: any[];
  batchCount: number;
  setBatchCount: (c: number | ((prev: number) => number)) => void;
  showAdvanced: boolean;
  setShowAdvanced: (show: boolean) => void;
  options: GenerateOptions;
  setOptions: (opts: GenerateOptions) => void;
  order: number;
  setOrder: (o: number) => void;
  isGenerating: boolean;
  handleGenerate: () => void;
}

export function QuickGeneratorControls({
  selectedDictId,
  setSelectedDictId,
  publicDicts,
  batchCount,
  setBatchCount,
  showAdvanced,
  setShowAdvanced,
  options,
  setOptions,
  order,
  setOrder,
  isGenerating,
  handleGenerate,
}: QuickGeneratorControlsProps) {
  return (
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
        <Select value={selectedDictId} onValueChange={setSelectedDictId}>
          <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors focus:border-[#0091ff]/50 focus:ring-1 focus:ring-[#0091ff]/50 focus:outline-none">
            <SelectValue placeholder="Select a dictionary profile" />
          </SelectTrigger>
          <SelectContent className="border-border/40 bg-background/95 max-h-[300px] backdrop-blur-md">
            {publicDicts.map((dict) => (
              <SelectItem
                key={dict.id}
                value={dict.id}
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                {dict.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Batch Count Select */}
      <div className="space-y-1.5">
        <label className="text-muted-foreground text-xs font-bold">Generated Batch Size</label>
        <div className="border-border/60 bg-background flex h-9 w-full items-center justify-between rounded-lg border p-1 select-none">
          <button
            type="button"
            onClick={() => setBatchCount((c) => Math.max(5, c - 5))}
            disabled={batchCount <= 5}
            className="text-muted-foreground hover:text-foreground flex h-full cursor-pointer items-center px-3 text-sm font-bold disabled:opacity-30"
          >
            -
          </button>
          <div className="flex items-center gap-1 font-mono text-sm font-semibold">
            <NumberFlowDisplay value={batchCount} className="text-foreground" />
            <span className="text-muted-foreground font-sans text-xs">names</span>
          </div>
          <button
            type="button"
            onClick={() => setBatchCount((c) => Math.min(100, c + 5))}
            disabled={batchCount >= 100}
            className="text-muted-foreground hover:text-foreground flex h-full cursor-pointer items-center px-3 text-sm font-bold disabled:opacity-30"
          >
            +
          </button>
        </div>
      </div>

      {/* Advanced Settings Accordion */}
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
                onChange={(e) => setOptions({ ...options, allowDuplicates: e.target.checked })}
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
  );
}

export default QuickGeneratorControls;
