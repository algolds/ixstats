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
    <FacetCard variant="inset" padding="none" className="space-y-3.5 p-4">
      {/* 1. Category / Type Selector (if categories are provided) */}
      {categories.length > 1 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-footnote text-label font-semibold">Category</label>
            {/* Rules trigger */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={cn(
                "rounded-control text-footnote shadow-card flex cursor-pointer items-center gap-1 border px-2.5 py-0.5 font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-95",
                showAdvanced
                  ? "border-tint/40 bg-tint/10 text-tint"
                  : "border-separator bg-surface text-label-secondary hover:text-label"
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
            <SelectTrigger className="text-footnote h-9 w-full">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id} className="text-footnote font-medium">
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
            <label className="text-footnote text-label font-semibold">Variant</label>
            {categories.length <= 1 && (
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={cn(
                  "rounded-control text-footnote shadow-card flex cursor-pointer items-center gap-1 border px-2.5 py-0.5 font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-95",
                  showAdvanced
                    ? "border-tint/40 bg-tint/10 text-tint"
                    : "border-separator bg-surface text-label-secondary hover:text-label"
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
            <SelectTrigger className="text-footnote h-9 w-full">
              <SelectValue placeholder="Select variant" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectGroup>
                <SelectLabel className="text-label-secondary px-2 py-1">Variants</SelectLabel>
                {subTypes.map((st) => (
                  <SelectItem key={st.value} value={st.value} className="text-footnote font-medium">
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
        <label className="text-label text-footnote font-semibold">Cultural Seed</label>
        <Select value={gen.culture} onValueChange={gen.setCulture}>
          <SelectTrigger className="text-footnote h-9 w-full">
            <SelectValue placeholder="Select culture family" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="any" className="text-footnote">
              Any / Mixed Profile
            </SelectItem>
            <SelectGroup>
              <SelectLabel className="text-label-secondary">Linguistic Families</SelectLabel>
              <SelectItem value="latin" className="text-footnote">
                Latin / Romance
              </SelectItem>
              <SelectItem value="germanic" className="text-footnote">
                Germanic / Norse
              </SelectItem>
              <SelectItem value="celtic" className="text-footnote">
                Celtic / Gaelic
              </SelectItem>
              <SelectItem value="slavic" className="text-footnote">
                Slavic / Eastern European
              </SelectItem>
              <SelectItem value="arabic" className="text-footnote">
                Arabic / Semitic
              </SelectItem>
              <SelectItem value="persian" className="text-footnote">
                Persian / Iranian
              </SelectItem>
              <SelectItem value="turkic" className="text-footnote">
                Turkic / Central Asian
              </SelectItem>
              <SelectItem value="indic" className="text-footnote">
                Indic / South Asian
              </SelectItem>
              <SelectItem value="east-asian" className="text-footnote">
                East Asian / Romanized
              </SelectItem>
              <SelectItem value="austronesian" className="text-footnote">
                Austronesian / Polynesian
              </SelectItem>
              <SelectItem value="african" className="text-footnote">
                African / Sub-Saharan
              </SelectItem>
              <SelectItem value="uralic" className="text-footnote">
                Uralic / Finno-Ugric
              </SelectItem>
              <SelectItem value="constructed" className="text-footnote">
                Constructed / High Fantasy
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* 3. Gender Modifier for People if applicable */}
      {category === "person" && gen.subType !== "generic" && (
        <div className="space-y-1">
          <label className="text-footnote text-label block font-semibold">Gender Modifier</label>
          <div className="grid grid-cols-3 gap-1">
            {(["male", "female", "neutral"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => gen.setGender(g)}
                className={cn(
                  "rounded-control text-footnote cursor-pointer border py-1 text-center font-semibold capitalize transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-95",
                  gen.gender === g
                    ? "border-tint/40 bg-tint/15 text-tint font-semibold"
                    : "border-separator bg-surface text-label-secondary hover:bg-fill-3 hover:text-label"
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Unified Generate Action & Quantity Pill */}
      <div className="bg-tint hover:bg-tint-hover active:bg-tint-hover group rounded-row border-separator shadow-card relative flex h-11 w-full items-center overflow-hidden border transition-[color,background-color,border-color,box-shadow,opacity,transform] select-none">
        {/* Left / Center: Primary Generate Action Trigger */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={gen.isGenerating}
          className="text-footnote text-on-tint flex h-full flex-1 cursor-pointer items-center justify-center gap-2 pr-3 pl-4 font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] select-none active:scale-[0.98] disabled:opacity-40"
        >
          {gen.isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <OnomaGlyph
              name="emerge-synthesis"
              size="xs"
              className="text-on-tint transition-transform group-hover:scale-110"
            />
          )}
          <span className="text-body font-semibold">Generate</span>
        </button>

        {/* Subtle Vertical Divider */}
        <div className="bg-fill-3 h-5 w-[1px] shrink-0" />

        {/* Right: Quantity Stepper Pill */}
        <div className="text-on-tint flex h-full shrink-0 items-center pr-1.5 pl-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setBatchCount((c) =>
                c > 100 ? Math.max(100, c - 50) : c > 50 ? Math.max(50, c - 25) : Math.max(5, c - 5)
              );
            }}
            disabled={batchCount <= 5 || gen.isGenerating}
            className="rounded-control text-footnote text-on-tint/80 hover:bg-fill-4 hover:text-on-tint flex h-7 w-7 cursor-pointer items-center justify-center font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Decrease count"
            aria-label="Decrease count"
          >
            -
          </button>
          <div className="text-body text-on-tint flex min-w-[28px] items-center justify-center px-1 leading-none font-semibold">
            <NumberFlowDisplay
              value={batchCount}
              className="text-body text-on-tint font-semibold"
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
            className="rounded-control text-footnote text-on-tint/80 hover:bg-fill-4 hover:text-on-tint flex h-7 w-7 cursor-pointer items-center justify-center font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Increase count"
            aria-label="Increase count"
          >
            +
          </button>
        </div>
      </div>

      {/* Collapsible Advanced Conlang Settings */}
      {showAdvanced && (
        <div className="animate-in fade-in slide-in-from-top-1 border-separator border-t pt-3.5 duration-200">
          <AdvancedConlangSettings gen={gen} category={category} />
        </div>
      )}
    </FacetCard>
  );
}

export default DomainControlBar;
