"use client";

// src/app/labs/onoma/components/shared/DomainControlBar.tsx
// Onoma Lab — Modular Domain Synthesis Control Bar (Horizontal Surface Layout)

import React from "react";
import { SlidersHorizontal, Loader2, ChevronDown, Layers } from "lucide-react";
import { ScienceGameIcon } from "../nav/onoma-tabs";
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
import type { NameCategory } from "~/lib/onoma/types";
import { cn } from "~/lib/utils";

interface DomainControlBarProps {
  category: NameCategory;
  subTypes?: Array<{ value: string; label: string }>;
  gen: any;
  batchCount: number;
  setBatchCount: (c: number | ((prev: number) => number)) => void;
  showAdvanced: boolean;
  setShowAdvanced: (val: boolean) => void;
  handleGenerate: () => void;
}

export function DomainControlBar({
  category,
  subTypes = [],
  gen,
  batchCount,
  setBatchCount,
  showAdvanced,
  setShowAdvanced,
  handleGenerate,
}: DomainControlBarProps) {
  return (
    <FacetCard className="border-border/40 bg-secondary/5 space-y-4 border p-4 shadow-sm backdrop-blur-md rounded-2xl">
      {/* Top Header Row */}
      <div className="border-border/30 flex items-center justify-between border-b pb-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#0091ff]" />
          <h3 className="text-foreground text-xs font-bold tracking-tight">
            Domain Parameters
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            "flex cursor-pointer items-center gap-1 text-[11px] font-medium transition-colors px-2 py-0.5 rounded-md border",
            showAdvanced
              ? "border-[#0091ff]/30 bg-[#0091ff]/10 text-[#0091ff]"
              : "border-border/50 bg-secondary/30 text-muted-foreground hover:text-foreground"
          )}
          title="Toggle advanced conlang constraints"
        >
          <SlidersHorizontal className="h-3 w-3" />
          <span>Rules</span>
          <ChevronDown
            className={cn("h-3 w-3 transition-transform duration-200", showAdvanced && "rotate-180")}
          />
        </button>
      </div>

      {/* 1. SubType Preset Selector (if available) */}
      {subTypes.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-foreground flex items-center gap-1.5 text-xs font-medium">
            <Layers className="h-3.5 w-3.5 text-[#0091ff]" />
            <span>Synthesis Preset</span>
          </label>
          <Select value={gen.subType} onValueChange={gen.setSubType}>
            <SelectTrigger className="border-border/60 bg-background/80 hover:bg-background text-foreground h-9 w-full rounded-xl border px-3 text-xs font-medium transition-all focus:border-[#0091ff]/60 focus:outline-none">
              <SelectValue placeholder="Select preset" />
            </SelectTrigger>
            <SelectContent className="border-border/40 bg-popover/95 max-h-[300px] backdrop-blur-xl">
              {subTypes.map((type) => (
                <SelectItem
                  key={type.value}
                  value={type.value}
                  className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer"
                >
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 2. Cultural Profile / Seed Selector */}
      <div className="space-y-1.5">
        <label className="text-foreground flex items-center gap-1.5 text-xs font-medium">
          <span className="font-mono text-[10px] text-[#0091ff]">⟨Phonology⟩</span>
          <span>Cultural Seed</span>
        </label>
        <Select value={gen.culture} onValueChange={gen.setCulture}>
          <SelectTrigger className="border-border/60 bg-background/80 hover:bg-background text-foreground h-9 w-full rounded-xl border px-3 text-xs font-medium transition-all focus:border-[#0091ff]/60 focus:outline-none">
            <SelectValue placeholder="Select culture family" />
          </SelectTrigger>
          <SelectContent className="border-border/40 bg-popover/95 max-h-[300px] backdrop-blur-xl">
            <SelectItem value="any" className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer">
              Any / Mixed Profile
            </SelectItem>
            <SelectGroup>
              <SelectLabel className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Linguistic Families
              </SelectLabel>
              <SelectItem value="latin" className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer">
                Latin / Romance
              </SelectItem>
              <SelectItem value="germanic" className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer">
                Germanic / Norse
              </SelectItem>
              <SelectItem value="celtic" className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer">
                Celtic / Gaelic
              </SelectItem>
              <SelectItem value="slavic" className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer">
                Slavic / Eastern European
              </SelectItem>
              <SelectItem value="arabic" className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer">
                Arabic / Semitic
              </SelectItem>
              <SelectItem value="persian" className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer">
                Persian / Iranian
              </SelectItem>
              <SelectItem value="turkic" className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer">
                Turkic / Central Asian
              </SelectItem>
              <SelectItem value="indic" className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer">
                Indic / South Asian
              </SelectItem>
              <SelectItem value="east-asian" className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer">
                East Asian / Romanized
              </SelectItem>
              <SelectItem value="austronesian" className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer">
                Austronesian / Polynesian
              </SelectItem>
              <SelectItem value="african" className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer">
                African / Sub-Saharan
              </SelectItem>
              <SelectItem value="uralic" className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer">
                Uralic / Finno-Ugric
              </SelectItem>
              <SelectItem value="constructed" className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer">
                Constructed / High Fantasy
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* 3. Batch Size Stepper */}
      <div className="space-y-1">
        <label className="text-muted-foreground font-mono text-[10px] font-semibold uppercase block">
          Batch Size
        </label>
        <div className="border-border/60 bg-background/80 flex h-8.5 w-full items-center justify-between rounded-xl border px-2 select-none">
          <button
            type="button"
            onClick={() => setBatchCount((c) => Math.max(5, c - 5))}
            disabled={batchCount <= 5}
            className="text-muted-foreground hover:text-foreground flex h-full cursor-pointer items-center px-1 text-xs font-bold transition-colors disabled:opacity-30"
          >
            -
          </button>
          <div className="flex items-center gap-1 font-mono text-xs font-semibold">
            <NumberFlowDisplay value={batchCount} className="text-foreground text-xs font-bold" />
          </div>
          <button
            type="button"
            onClick={() => setBatchCount((c) => Math.min(50, c + 5))}
            disabled={batchCount >= 50}
            className="text-muted-foreground hover:text-foreground flex h-full cursor-pointer items-center px-1 text-xs font-bold transition-colors disabled:opacity-30"
          >
            +
          </button>
        </div>
      </div>

      {/* 4. Gender Modifier for People if applicable */}
      {category === "person" && gen.subType !== "generic" && (
        <div className="space-y-1">
          <label className="text-muted-foreground text-[10px] font-semibold uppercase block">
            Gender Modifier
          </label>
          <div className="grid grid-cols-3 gap-1">
            {(["male", "female", "neutral"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => gen.setGender(g)}
                className={cn(
                  "cursor-pointer rounded-lg border py-1 text-center text-xs font-semibold capitalize transition-all active:scale-95",
                  gen.gender === g
                    ? "border-[#0091ff]/40 bg-[#0091ff]/15 font-bold text-[#0091ff]"
                    : "border-border/60 bg-background/80 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 5. Primary Synthesize Button */}
      <button
        onClick={handleGenerate}
        disabled={gen.isGenerating}
        className="flex h-9.5 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0091ff] px-4 font-mono text-xs font-bold text-white shadow-md shadow-[#0091ff]/20 transition-all hover:bg-[#33a7ff] active:scale-[0.96] disabled:opacity-40"
      >
        {gen.isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ScienceGameIcon className="h-4 w-4" />
        )}
        <span>⟨Synthesize⟩</span>
      </button>

      {/* Collapsible Advanced Conlang Settings */}
      {showAdvanced && (
        <div className="animate-in fade-in slide-in-from-top-1 border-border/30 border-t pt-3.5 duration-200">
          <AdvancedConlangSettings gen={gen} category={category} />
        </div>
      )}
    </FacetCard>
  );
}

export default DomainControlBar;
