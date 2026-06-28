"use client";

// src/app/labs/onoma/components/shared/AdvancedConlangSettings.tsx
// Onoma Custom Studio Workshop — Advanced Generator Settings Component

import { SlidersHorizontal } from "lucide-react";
import { AppleSwitch } from "~/components/unlumen-ui/apple-switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
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

export function AdvancedConlangSettings({
  gen,
  category,
}: AdvancedConlangSettingsProps) {
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
            <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground w-full rounded-lg border px-2.5 py-1 text-xs focus:outline-none flex justify-between items-center transition-colors">
              <SelectValue placeholder="Select prefix" />
            </SelectTrigger>
            <SelectContent className="border-border/40 bg-background/95 backdrop-blur-md max-h-[250px]">
              <SelectItem value="none" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                None
              </SelectItem>
              <SelectItem value="King" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                King
              </SelectItem>
              <SelectItem value="Queen" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                Queen
              </SelectItem>
              <SelectItem value="Prince" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                Prince
              </SelectItem>
              <SelectItem value="Princess" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                Princess
              </SelectItem>
              <SelectItem value="Lord" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                Lord
              </SelectItem>
              <SelectItem value="Lady" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                Lady
              </SelectItem>
              <SelectItem value="Sir" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                Sir
              </SelectItem>
              <SelectItem value="General" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                General
              </SelectItem>
              <SelectItem value="President" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                President
              </SelectItem>
              <SelectItem value="Governor" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                Governor
              </SelectItem>
              <SelectItem value="Minister" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                Minister
              </SelectItem>
              <SelectItem value="Dr." className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                Dr.
              </SelectItem>
              <SelectItem value="custom" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
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
      {(category === "organization" ||
        category === "country" ||
        category === "province") && (
        <div className="border-border/40 space-y-1.5 border-b pb-3">
          <label className="text-muted-foreground text-[10px] font-bold uppercase">
            Name Suffix
          </label>
          <Select
            value={gen.selectedSuffix || "none"}
            onValueChange={(val) => gen.setSelectedSuffix(val === "none" ? "" : val)}
          >
            <SelectTrigger className="border-border/60 bg-background/50 hover:bg-background/80 text-foreground w-full rounded-lg border px-2.5 py-1 text-xs focus:outline-none flex justify-between items-center transition-colors">
              <SelectValue placeholder="Select suffix" />
            </SelectTrigger>
            <SelectContent className="border-border/40 bg-background/95 backdrop-blur-md max-h-[250px]">
              <SelectItem value="none" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                None
              </SelectItem>
              <SelectItem value="Association" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                Association
              </SelectItem>
              <SelectItem value="Committee" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                Committee
              </SelectItem>
              <SelectItem value="Society" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                Society
              </SelectItem>
              <SelectItem value="Alliance" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                Alliance
              </SelectItem>
              <SelectItem value="Union" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                Union
              </SelectItem>
              <SelectItem value="Club" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                Club
              </SelectItem>
              <SelectItem value="Company" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                Company
              </SelectItem>
              <SelectItem value="Party" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                Party
              </SelectItem>
              <SelectItem value="Organization" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
                Organization
              </SelectItem>
              <SelectItem value="custom" className="text-xs focus:bg-[#0091ff]/10 focus:text-foreground">
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
          <label className="text-muted-foreground text-[10px] font-bold uppercase">Min Length</label>
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
          <label className="text-muted-foreground text-[10px] font-bold uppercase">Max Length</label>
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
          <label className="text-muted-foreground text-[10px] font-bold uppercase">Starts With</label>
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
      <div className="border-border/20 border-t pt-3.5 space-y-3.5">
        <h5 className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
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
            className="border-border/60 bg-background text-foreground w-full rounded-lg border px-2.5 py-1 text-xs focus:outline-none font-mono uppercase"
          />
        </div>

        {/* Switches Grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Must End With Vowel */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground">Must End With Vowel</span>
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
            <span className="text-[10px] font-semibold text-muted-foreground">Must End With Consonant</span>
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
            <span className="text-[10px] font-semibold text-muted-foreground">No Initial CC Clusters</span>
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
            <span className="text-[10px] font-semibold text-muted-foreground">No Final CC Clusters</span>
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
