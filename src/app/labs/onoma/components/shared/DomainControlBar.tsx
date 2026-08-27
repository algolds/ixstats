"use client";

// src/app/labs/onoma/components/shared/DomainControlBar.tsx
// Onoma Lab — Modular Domain Synthesis Control Bar (Horizontal Surface Layout)

import React from "react";
import {
  ControlSlider as SlidersHorizontal,
  SystemRestart as Loader2,
  NavArrowDown as ChevronDown,
} from "iconoir-react";
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
    <FacetCard className="border-border/40 bg-secondary/5 space-y-3.5 rounded-2xl border p-4 shadow-sm backdrop-blur-md">
      {/* 1. Category / Type Selector (if categories are provided) */}
      {categories.length > 1 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold tracking-tight text-zinc-800 dark:text-zinc-200">
              Category
            </label>
            {/* Rules trigger */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={cn(
                "flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-0.5 text-xs font-medium tracking-tight shadow-2xs transition-all active:scale-95",
                showAdvanced
                  ? "border-onoma-primary/40 bg-onoma-primary/10 text-onoma-primary"
                  : "border-border/60 bg-background/80 text-muted-foreground hover:text-foreground"
              )}
              title="Toggle advanced conlang constraints"
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span>Rules</span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  showAdvanced && "rotate-180"
                )}
              />
            </button>
          </div>
          <Select value={category} onValueChange={(val) => onCategoryChange?.(val as NameCategory)}>
            <SelectTrigger className="border-border/60 bg-background/80 hover:bg-background text-foreground focus:border-onoma-primary/60 h-9 w-full rounded-xl border px-3 text-xs font-medium tracking-tight shadow-2xs transition-all focus:outline-none">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="border-border/40 bg-popover/95 max-h-[300px] backdrop-blur-xl">
              {categories.map((cat) => (
                <SelectItem
                  key={cat.id}
                  value={cat.id}
                  className="focus:text-foreground focus:bg-onoma-primary/10 cursor-pointer text-xs font-medium"
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
            <label className="text-xs font-semibold tracking-tight text-zinc-800 dark:text-zinc-200">
              Variant
            </label>
            {categories.length <= 1 && (
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={cn(
                  "flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-0.5 text-xs font-medium tracking-tight shadow-2xs transition-all active:scale-95",
                  showAdvanced
                    ? "border-onoma-primary/40 bg-onoma-primary/10 text-onoma-primary"
                    : "border-border/60 bg-background/80 text-muted-foreground hover:text-foreground"
                )}
                title="Toggle advanced conlang constraints"
              >
                <SlidersHorizontal className="h-3 w-3" />
                <span>Rules</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform duration-200",
                    showAdvanced && "rotate-180"
                  )}
                />
              </button>
            )}
          </div>
          <Select value={gen.subType} onValueChange={(val) => gen.setSubType(val)}>
            <SelectTrigger className="border-border/60 bg-background/80 hover:bg-background text-foreground focus:border-onoma-primary/60 h-9 w-full rounded-xl border px-3 text-xs font-medium tracking-tight shadow-2xs transition-all focus:outline-none">
              <SelectValue placeholder="Select variant" />
            </SelectTrigger>
            <SelectContent className="border-border/40 bg-popover/95 max-h-[300px] backdrop-blur-xl">
              <SelectGroup>
                <SelectLabel className="text-muted-foreground px-2 py-1 text-[10px] font-semibold tracking-wider uppercase">
                  Variants
                </SelectLabel>
                {subTypes.map((st) => (
                  <SelectItem
                    key={st.value}
                    value={st.value}
                    className="focus:text-foreground focus:bg-onoma-primary/10 cursor-pointer text-xs font-medium"
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
        <label className="text-foreground text-xs font-semibold">Cultural Seed</label>
        <Select value={gen.culture} onValueChange={gen.setCulture}>
          <SelectTrigger className="border-border/60 bg-background/80 hover:bg-background text-foreground focus:border-onoma-primary/60 h-9 w-full rounded-xl border px-3 text-xs font-medium shadow-2xs transition-all focus:outline-none">
            <SelectValue placeholder="Select culture family" />
          </SelectTrigger>
          <SelectContent className="border-border/40 bg-popover/95 max-h-[300px] backdrop-blur-xl">
            <SelectItem
              value="any"
              className="focus:text-foreground focus:bg-onoma-primary/10 cursor-pointer text-xs"
            >
              Any / Mixed Profile
            </SelectItem>
            <SelectGroup>
              <SelectLabel className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Linguistic Families
              </SelectLabel>
              <SelectItem
                value="latin"
                className="focus:text-foreground focus:bg-onoma-primary/10 cursor-pointer text-xs"
              >
                Latin / Romance
              </SelectItem>
              <SelectItem
                value="germanic"
                className="focus:text-foreground focus:bg-onoma-primary/10 cursor-pointer text-xs"
              >
                Germanic / Norse
              </SelectItem>
              <SelectItem
                value="celtic"
                className="focus:text-foreground focus:bg-onoma-primary/10 cursor-pointer text-xs"
              >
                Celtic / Gaelic
              </SelectItem>
              <SelectItem
                value="slavic"
                className="focus:text-foreground focus:bg-onoma-primary/10 cursor-pointer text-xs"
              >
                Slavic / Eastern European
              </SelectItem>
              <SelectItem
                value="arabic"
                className="focus:text-foreground focus:bg-onoma-primary/10 cursor-pointer text-xs"
              >
                Arabic / Semitic
              </SelectItem>
              <SelectItem
                value="persian"
                className="focus:text-foreground focus:bg-onoma-primary/10 cursor-pointer text-xs"
              >
                Persian / Iranian
              </SelectItem>
              <SelectItem
                value="turkic"
                className="focus:text-foreground focus:bg-onoma-primary/10 cursor-pointer text-xs"
              >
                Turkic / Central Asian
              </SelectItem>
              <SelectItem
                value="indic"
                className="focus:text-foreground focus:bg-onoma-primary/10 cursor-pointer text-xs"
              >
                Indic / South Asian
              </SelectItem>
              <SelectItem
                value="east-asian"
                className="focus:text-foreground focus:bg-onoma-primary/10 cursor-pointer text-xs"
              >
                East Asian / Romanized
              </SelectItem>
              <SelectItem
                value="austronesian"
                className="focus:text-foreground focus:bg-onoma-primary/10 cursor-pointer text-xs"
              >
                Austronesian / Polynesian
              </SelectItem>
              <SelectItem
                value="african"
                className="focus:text-foreground focus:bg-onoma-primary/10 cursor-pointer text-xs"
              >
                African / Sub-Saharan
              </SelectItem>
              <SelectItem
                value="uralic"
                className="focus:text-foreground focus:bg-onoma-primary/10 cursor-pointer text-xs"
              >
                Uralic / Finno-Ugric
              </SelectItem>
              <SelectItem
                value="constructed"
                className="focus:text-foreground focus:bg-onoma-primary/10 cursor-pointer text-xs"
              >
                Constructed / High Fantasy
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* 3. Gender Modifier for People if applicable */}
      {category === "person" && gen.subType !== "generic" && (
        <div className="space-y-1">
          <label className="block text-xs font-semibold tracking-tight text-zinc-800 dark:text-zinc-200">
            Gender Modifier
          </label>
          <div className="grid grid-cols-3 gap-1">
            {(["male", "female", "neutral"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => gen.setGender(g)}
                className={cn(
                  "cursor-pointer rounded-lg border py-1 text-center text-xs font-semibold tracking-tight capitalize transition-all active:scale-95",
                  gen.gender === g
                    ? "border-onoma-primary/40 bg-onoma-primary/15 text-onoma-primary font-bold"
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
      <div className="bg-onoma-primary hover:bg-onoma-primary-hover active:bg-onoma-primary-active shadow-onoma-primary/25 group relative flex h-11 w-full items-center overflow-hidden rounded-xl border border-white/20 shadow-md transition-all select-none">
        {/* Left / Center: Primary Generate Action Trigger */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={gen.isGenerating}
          className="flex h-full flex-1 cursor-pointer items-center justify-center gap-2 pr-3 pl-4 text-xs font-semibold tracking-tight text-white transition-all select-none active:scale-[0.98] disabled:opacity-40"
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
        <div className="h-5 w-[1px] shrink-0 bg-white/25" />

        {/* Right: Quantity Stepper Pill */}
        <div className="flex h-full shrink-0 items-center pr-1.5 pl-1 text-white">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setBatchCount((c) =>
                c > 100 ? Math.max(100, c - 50) : c > 50 ? Math.max(50, c - 25) : Math.max(5, c - 5)
              );
            }}
            disabled={batchCount <= 5 || gen.isGenerating}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-xs font-bold text-white/80 transition-all hover:bg-black/15 hover:text-white active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Decrease count"
            aria-label="Decrease count"
          >
            -
          </button>
          <div className="flex min-w-[28px] items-center justify-center px-1 text-sm leading-none font-bold tracking-tight text-white">
            <NumberFlowDisplay
              value={batchCount}
              className="text-sm font-bold tracking-tight text-white"
            />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setBatchCount((c) =>
                c >= 100 ? Math.min(500, c + 50) : c >= 50 ? Math.min(100, c + 25) : c + 5
              );
            }}
            disabled={batchCount >= 500 || gen.isGenerating}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-xs font-bold text-white/80 transition-all hover:bg-black/15 hover:text-white active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent"
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
