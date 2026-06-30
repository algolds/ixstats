"use client";

// src/app/labs/onoma/components/shared/AdvancedConlangSettings.tsx
// Onoma Custom Studio Workshop — Advanced Generator Settings Component

import { SlidersHorizontal } from "lucide-react";
import { AppleSwitch } from "~/components/unlumen-ui/apple-switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { NameCategory } from "~/lib/onoma/types";

interface AdvancedConlangSettingsProps {
  gen: {
    includeWorldData: boolean;
    setIncludeWorldData: (v: boolean) => void;
    selectedPrefix: string;
    setSelectedPrefix: (v: string) => void;
    customPrefix: string;
    setCustomPrefix: (v: string) => void;
    selectedSuffix: string;
    setSelectedSuffix: (v: string) => void;
    customSuffix: string;
    setCustomSuffix: (v: string) => void;
    options: {
      minLength?: number;
      maxLength?: number;
      startsWith?: string;
      endsWith?: string;
      minSyllables?: number;
      maxSyllables?: number;
      cvTemplate?: string;
      mustEndWithVowel?: boolean;
      mustEndWithConsonant?: boolean;
      noInitialClusters?: boolean;
      noFinalClusters?: boolean;
    };
    setOptions: (opts: any) => void;
    order: number;
    setOrder: (v: number) => void;
  };
  category: NameCategory;
}

export function AdvancedConlangSettings({ gen, category }: AdvancedConlangSettingsProps) {
  return (
    <div className="animate-in fade-in mt-3.5 space-y-3.5 duration-200">
      {/* Include Live World Data Toggle */}
      <div className="border-border/40 flex items-center justify-between border-b pb-3">
        <div className="space-y-0.5 pr-2">
          <label className="text-muted-foreground text-[10px] font-bold uppercase">
            Include Live World Data
          </label>
          <p className="text-muted-foreground text-[9px] leading-normal">
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
        <div className="border-border/40 space-y-1.5 border-b pb-3">
          <label className="text-muted-foreground text-[10px] font-bold uppercase">
            Title Prefix
          </label>
          <Select
            value={gen.selectedPrefix || "none"}
            onValueChange={(val) => gen.setSelectedPrefix(val === "none" ? "" : val)}
          >
            <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground flex w-full items-center justify-between rounded-lg border px-2.5 py-1 text-xs transition-colors focus:outline-none">
              <SelectValue placeholder="Select prefix" />
            </SelectTrigger>
            <SelectContent className="border-border/40 bg-background/95 max-h-[250px] backdrop-blur-md">
              <SelectItem
                value="none"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                None
              </SelectItem>
              <SelectItem
                value="King"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                King
              </SelectItem>
              <SelectItem
                value="Queen"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Queen
              </SelectItem>
              <SelectItem
                value="Prince"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Prince
              </SelectItem>
              <SelectItem
                value="Princess"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Princess
              </SelectItem>
              <SelectItem
                value="Lord"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Lord
              </SelectItem>
              <SelectItem
                value="Lady"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Lady
              </SelectItem>
              <SelectItem
                value="Sir"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Sir
              </SelectItem>
              <SelectItem
                value="General"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                General
              </SelectItem>
              <SelectItem
                value="President"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                President
              </SelectItem>
              <SelectItem
                value="Governor"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Governor
              </SelectItem>
              <SelectItem
                value="Minister"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Minister
              </SelectItem>
              <SelectItem
                value="Dr."
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Dr.
              </SelectItem>
              <SelectItem
                value="custom"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Custom Prefix...
              </SelectItem>
            </SelectContent>
          </Select>

          {gen.selectedPrefix === "custom" && (
            <input
              type="text"
              placeholder="e.g. Grand Duke"
              value={gen.customPrefix}
              onChange={(e) => gen.setCustomPrefix(e.target.value)}
              className="border-border/60 bg-background text-foreground animate-in slide-in-from-top-1 mt-1 w-full rounded-lg border px-2.5 py-1 text-xs duration-150 focus:outline-none"
            />
          )}
        </div>
      )}

      {/* Category-aware Suffix Select (Organization, Country, Province categories only) */}
      {(category === "organization" || category === "country" || category === "province") && (
        <div className="border-border/40 space-y-1.5 border-b pb-3">
          <label className="text-muted-foreground text-[10px] font-bold uppercase">
            Name Suffix
          </label>
          <Select
            value={gen.selectedSuffix || "none"}
            onValueChange={(val) => gen.setSelectedSuffix(val === "none" ? "" : val)}
          >
            <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground flex w-full items-center justify-between rounded-lg border px-2.5 py-1 text-xs transition-colors focus:outline-none">
              <SelectValue placeholder="Select suffix" />
            </SelectTrigger>
            <SelectContent className="border-border/40 bg-background/95 max-h-[250px] backdrop-blur-md">
              <SelectItem
                value="none"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                None
              </SelectItem>
              <SelectItem
                value="Association"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Association
              </SelectItem>
              <SelectItem
                value="Committee"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Committee
              </SelectItem>
              <SelectItem
                value="Society"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Society
              </SelectItem>
              <SelectItem
                value="Alliance"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Alliance
              </SelectItem>
              <SelectItem
                value="Union"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Union
              </SelectItem>
              <SelectItem
                value="Club"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Club
              </SelectItem>
              <SelectItem
                value="Company"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Company
              </SelectItem>
              <SelectItem
                value="Party"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Party
              </SelectItem>
              <SelectItem
                value="Organization"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Organization
              </SelectItem>
              <SelectItem
                value="custom"
                className="focus:text-foreground text-xs focus:bg-[#0091ff]/10"
              >
                Custom Suffix...
              </SelectItem>
            </SelectContent>
          </Select>

          {gen.selectedSuffix === "custom" && (
            <input
              type="text"
              placeholder="e.g. Guild"
              value={gen.customSuffix}
              onChange={(e) => gen.setCustomSuffix(e.target.value)}
              className="border-border/60 bg-background text-foreground animate-in slide-in-from-top-1 mt-1 w-full rounded-lg border px-2.5 py-1 text-xs duration-150 focus:outline-none"
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-muted-foreground text-[10px] font-bold uppercase">
            Min Length
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={gen.options.minLength || 4}
            onChange={(e) =>
              gen.setOptions({
                ...gen.options,
                minLength: parseInt(e.target.value) || 0,
              })
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
            value={gen.options.maxLength || 12}
            onChange={(e) =>
              gen.setOptions({
                ...gen.options,
                maxLength: parseInt(e.target.value) || 0,
              })
            }
            className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1 text-xs focus:outline-none"
          />
        </div>
      </div>

      {/* Substring constraint filters */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-muted-foreground text-[10px] font-bold uppercase">
            Starts With
          </label>
          <input
            type="text"
            placeholder="e.g. Ae"
            value={gen.options.startsWith || ""}
            onChange={(e) => gen.setOptions({ ...gen.options, startsWith: e.target.value })}
            className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1 text-xs focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-muted-foreground text-[10px] font-bold uppercase">Ends With</label>
          <input
            type="text"
            placeholder="e.g. th"
            value={gen.options.endsWith || ""}
            onChange={(e) => gen.setOptions({ ...gen.options, endsWith: e.target.value })}
            className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1 text-xs focus:outline-none"
          />
        </div>
      </div>

      {/* Markov Order Look-back */}
      <div className="space-y-1 pb-1">
        <div className="flex justify-between">
          <label className="text-muted-foreground text-[10px] font-bold uppercase">
            Markov Order (Depth)
          </label>
          <span className="text-[10px] font-bold text-[#0091ff]">{gen.order} char</span>
        </div>
        <input
          type="range"
          min={1}
          max={4}
          step={1}
          value={gen.order}
          onChange={(e) => gen.setOrder(parseInt(e.target.value))}
          className="bg-secondary/80 h-1.5 w-full cursor-pointer rounded-lg accent-[#0091ff]"
        />
      </div>

      {/* Advanced conlang & phonotactics */}
      <div className="border-border/20 space-y-3.5 border-t pt-3.5">
        <h5 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
          Advanced conlang & phonotactics
        </h5>

        {/* Syllable Counts */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-muted-foreground text-[10px] font-bold uppercase">
              Min Syllables
            </label>
            <input
              type="number"
              min={0}
              max={5}
              value={gen.options.minSyllables || 0}
              onChange={(e) =>
                gen.setOptions({
                  ...gen.options,
                  minSyllables: parseInt(e.target.value) || 0,
                })
              }
              className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1 text-xs focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-muted-foreground text-[10px] font-bold uppercase">
              Max Syllables
            </label>
            <input
              type="number"
              min={-1}
              max={10}
              placeholder="No limit"
              value={
                gen.options.maxSyllables === undefined || gen.options.maxSyllables === -1
                  ? ""
                  : gen.options.maxSyllables
              }
              onChange={(e) =>
                gen.setOptions({
                  ...gen.options,
                  maxSyllables: e.target.value === "" ? -1 : parseInt(e.target.value) || -1,
                })
              }
              className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1 text-xs focus:outline-none"
            />
          </div>
        </div>

        {/* CV Template Input */}
        <div className="space-y-1">
          <label className="text-muted-foreground text-[10px] font-bold uppercase">
            Strict CV Template
          </label>
          <input
            type="text"
            placeholder="e.g. CVCV (C=consonant, V=vowel)"
            value={gen.options.cvTemplate || ""}
            onChange={(e) =>
              gen.setOptions({
                ...gen.options,
                cvTemplate: e.target.value.replace(/[^cvCV]/g, "").toUpperCase(),
              })
            }
            className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1 font-mono text-xs uppercase focus:outline-none"
          />
        </div>

        {/* Switches Grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Must End With Vowel */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[10px] font-semibold">
              Must End With Vowel
            </span>
            <AppleSwitch
              checked={gen.options.mustEndWithVowel || false}
              onCheckedChange={(checked) =>
                gen.setOptions({
                  ...gen.options,
                  mustEndWithVowel: checked,
                  mustEndWithConsonant: checked ? false : gen.options.mustEndWithConsonant,
                })
              }
              size="sm"
            />
          </div>

          {/* Must End With Consonant */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[10px] font-semibold">
              Must End With Consonant
            </span>
            <AppleSwitch
              checked={gen.options.mustEndWithConsonant || false}
              onCheckedChange={(checked) =>
                gen.setOptions({
                  ...gen.options,
                  mustEndWithConsonant: checked,
                  mustEndWithVowel: checked ? false : gen.options.mustEndWithVowel,
                })
              }
              size="sm"
            />
          </div>

          {/* No Initial Clusters */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[10px] font-semibold">
              No Initial CC Clusters
            </span>
            <AppleSwitch
              checked={gen.options.noInitialClusters || false}
              onCheckedChange={(checked) =>
                gen.setOptions({
                  ...gen.options,
                  noInitialClusters: checked,
                })
              }
              size="sm"
            />
          </div>

          {/* No Final Clusters */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[10px] font-semibold">
              No Final CC Clusters
            </span>
            <AppleSwitch
              checked={gen.options.noFinalClusters || false}
              onCheckedChange={(checked) =>
                gen.setOptions({
                  ...gen.options,
                  noFinalClusters: checked,
                })
              }
              size="sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdvancedConlangSettings;
