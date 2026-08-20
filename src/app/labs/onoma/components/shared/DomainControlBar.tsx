"use client";

// src/app/labs/onoma/components/shared/DomainControlBar.tsx
// Onoma Lab — Modular Domain Synthesis Control Bar (Horizontal Surface Layout)

import React from "react";
import { SlidersHorizontal, Loader2, ChevronDown } from "lucide-react";
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
import { OnomaGlyph } from "../glyphs/OnomaGlyph";
import type { NameCategory } from "~/lib/onoma/types";
import { cn } from "~/lib/utils";

interface DomainControlBarProps {
  category: NameCategory;
  onCategoryChange?: (cat: NameCategory) => void;
  categories?: Array<{ id: NameCategory; label: string; desc?: string }>;
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
  onCategoryChange,
  categories = [],
  subTypes = [],
  gen,
  batchCount,
  setBatchCount,
  showAdvanced,
  setShowAdvanced,
  handleGenerate,
}: DomainControlBarProps) {
  return (
    <FacetCard className="border-border/40 bg-secondary/5 space-y-3.5 border p-4 shadow-sm backdrop-blur-md rounded-2xl">
      {/* 1. Category / Type Selector (if categories are provided) */}
      {categories.length > 1 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-zinc-800 dark:text-zinc-200 text-xs font-semibold tracking-tight">
              Category
            </label>
            {/* Rules trigger */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={cn(
                "flex cursor-pointer items-center gap-1 text-xs font-medium tracking-tight transition-all px-2.5 py-0.5 rounded-lg border shadow-2xs active:scale-95",
                showAdvanced
                  ? "border-[#0091ff]/40 bg-[#0091ff]/10 text-[#0091ff]"
                  : "border-border/60 bg-background/80 text-muted-foreground hover:text-foreground"
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
          <Select
            value={category}
            onValueChange={(val) => onCategoryChange?.(val as NameCategory)}
          >
            <SelectTrigger className="border-border/60 bg-background/80 hover:bg-background text-foreground h-9 w-full rounded-xl border px-3 text-xs font-medium tracking-tight transition-all focus:border-[#0091ff]/60 focus:outline-none shadow-2xs">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="border-border/40 bg-popover/95 max-h-[300px] backdrop-blur-xl">
              {categories.map((cat) => (
                <SelectItem
                  key={cat.id}
                  value={cat.id}
                  className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer font-medium"
                >
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 2. SubType Variant Selector (if available) */}
      {subTypes.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-zinc-800 dark:text-zinc-200 text-xs font-semibold tracking-tight">
              Variant
            </label>
            {categories.length <= 1 && (
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={cn(
                  "flex cursor-pointer items-center gap-1 text-xs font-medium tracking-tight transition-all px-2.5 py-0.5 rounded-lg border shadow-2xs active:scale-95",
                  showAdvanced
                    ? "border-[#0091ff]/40 bg-[#0091ff]/10 text-[#0091ff]"
                    : "border-border/60 bg-background/80 text-muted-foreground hover:text-foreground"
                )}
                title="Toggle advanced conlang constraints"
              >
                <SlidersHorizontal className="h-3 w-3" />
                <span>Rules</span>
                <ChevronDown
                  className={cn("h-3 w-3 transition-transform duration-200", showAdvanced && "rotate-180")}
                />
              </button>
            )}
          </div>
          <Select
            value={gen.subType}
            onValueChange={(val) => gen.setSubType(val)}
          >
            <SelectTrigger className="border-border/60 bg-background/80 hover:bg-background text-foreground h-9 w-full rounded-xl border px-3 text-xs font-medium tracking-tight transition-all focus:border-[#0091ff]/60 focus:outline-none shadow-2xs">
              <SelectValue placeholder="Select variant" />
            </SelectTrigger>
            <SelectContent className="border-border/40 bg-popover/95 max-h-[300px] backdrop-blur-xl">
              <SelectGroup>
                <SelectLabel className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider px-2 py-1">
                  Variants
                </SelectLabel>
                {subTypes.map((st) => (
                  <SelectItem
                    key={st.value}
                    value={st.value}
                    className="focus:text-foreground text-xs focus:bg-[#0091ff]/10 cursor-pointer font-medium"
                  >
                    {st.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 3. Cultural Profile / Seed Selector */}
      <div className="space-y-1.5">
        <label className="text-foreground text-xs font-semibold">
          Cultural Seed
        </label>
        <Select value={gen.culture} onValueChange={gen.setCulture}>
          <SelectTrigger className="border-border/60 bg-background/80 hover:bg-background text-foreground h-9 w-full rounded-xl border px-3 text-xs font-medium transition-all focus:border-[#0091ff]/60 focus:outline-none shadow-2xs">
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

      {/* 3. Gender Modifier for People if applicable */}
      {category === "person" && gen.subType !== "generic" && (
        <div className="space-y-1">
          <label className="text-zinc-800 dark:text-zinc-200 text-xs font-semibold tracking-tight block">
            Gender Modifier
          </label>
          <div className="grid grid-cols-3 gap-1">
            {(["male", "female", "neutral"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => gen.setGender(g)}
                className={cn(
                  "cursor-pointer rounded-lg border py-1 text-center text-xs font-semibold capitalize transition-all active:scale-95 tracking-tight",
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

      {/* 4. Unified Generate Action & Quantity Pill */}
      <div className="relative flex h-11 w-full items-center rounded-xl bg-[#0091ff] hover:bg-[#0086eb] active:bg-[#007cdb] shadow-md shadow-[#0091ff]/25 border border-white/20 select-none overflow-hidden transition-all group">
        {/* Left / Center: Primary Generate Action Trigger */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={gen.isGenerating}
          className="flex h-full flex-1 cursor-pointer items-center justify-center gap-2 pl-4 pr-3 text-xs font-semibold tracking-tight text-white transition-all active:scale-[0.98] disabled:opacity-40 select-none"
        >
          {gen.isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <OnomaGlyph
              name="emerge-synthesis"
              size="xs"
              className="text-white transition-transform group-hover:scale-110"
            />
          )}
          <span className="text-sm font-semibold tracking-tight">Generate</span>
        </button>

        {/* Subtle Vertical Divider */}
        <div className="h-5 w-[1px] bg-white/25 shrink-0" />

        {/* Right: Quantity Stepper Pill */}
        <div className="flex h-full items-center pr-1.5 pl-1 text-white shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setBatchCount((c) =>
                c > 100 ? Math.max(100, c - 50) : c > 50 ? Math.max(50, c - 25) : Math.max(5, c - 5)
              )
            }}
            disabled={batchCount <= 5 || gen.isGenerating}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white/80 hover:text-white hover:bg-black/15 active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-all"
            title="Decrease count"
            aria-label="Decrease count"
          >
            -
          </button>
          <div className="flex items-center px-1 min-w-[28px] justify-center text-sm font-bold tracking-tight text-white leading-none">
            <NumberFlowDisplay value={batchCount} className="text-sm font-bold tracking-tight text-white" />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setBatchCount((c) =>
                c >= 100 ? Math.min(500, c + 50) : c >= 50 ? Math.min(100, c + 25) : c + 5
              )
            }}
            disabled={batchCount >= 500 || gen.isGenerating}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white/80 hover:text-white hover:bg-black/15 active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-all"
            title="Increase count"
            aria-label="Increase count"
          >
            +
          </button>
        </div>
      </div>

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
