"use client";

// src/app/labs/onoma/components/shared/DomainControlBar.tsx
// Onoma Lab — Modular Domain Synthesis Control Bar (Horizontal Surface Layout)

import React from "react";
import { ControlSlider as SlidersHorizontal, NavArrowDown as ChevronDown } from "iconoir-react";
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
import { GenerateCountPill } from "./GenerateCountPill";
import type { NameCategory } from "~/lib/onoma/types";
import { cn } from "~/lib/utils";
import { Toggle } from "~/components/ui/toggle";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Card } from "~/components/ui/card";

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
    <Card variant="inset" padding="none" className="space-y-4 p-4">
      {/* 1. Category / Type Selector (if categories are provided) */}
      {categories.length > 1 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-footnote text-label font-semibold">Category</label>
            {/* Rules trigger */}
            <Toggle
              variant="outline"
              size="sm"
              pressed={showAdvanced}
              onPressedChange={setShowAdvanced}
              aria-expanded={showAdvanced}
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
            </Toggle>
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-footnote text-label font-semibold">Variant</label>
            {categories.length <= 1 && (
              <Toggle
                variant="outline"
                size="sm"
                pressed={showAdvanced}
                onPressedChange={setShowAdvanced}
                aria-expanded={showAdvanced}
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
              </Toggle>
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
      <div className="space-y-2">
        <label className="text-label text-footnote font-semibold">Cultural seed</label>
        <Select value={gen.culture} onValueChange={gen.setCulture}>
          <SelectTrigger className="text-footnote h-9 w-full">
            <SelectValue placeholder="Select culture family" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="any" className="text-footnote">
              Any / Mixed Profile
            </SelectItem>
            <SelectGroup>
              <SelectLabel className="text-label-secondary">Linguistic families</SelectLabel>
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
          <label className="text-footnote text-label block font-semibold">Gender modifier</label>
          <SegmentedControl
            size="sm"
            fullWidth
            aria-label="Gender modifier"
            itemClassName="capitalize"
            value={gen.gender}
            onValueChange={gen.setGender}
            options={(["male", "female", "neutral"] as const).map((g) => ({ value: g, label: g }))}
          />
        </div>
      )}

      {/* 4. Unified Generate Action & Quantity Pill */}
      <GenerateCountPill
        isGenerating={gen.isGenerating}
        onGenerate={handleGenerate}
        batchCount={batchCount}
        setBatchCount={setBatchCount}
      />

      {/* Collapsible Advanced Conlang Settings */}
      {showAdvanced && (
        <div className="animate-in fade-in slide-in-from-top-1 border-separator border-t pt-4 duration-200">
          <AdvancedConlangSettings gen={gen} category={category} />
        </div>
      )}
    </Card>
  );
}
