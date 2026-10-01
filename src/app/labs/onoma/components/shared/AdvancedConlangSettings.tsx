"use client";

// src/app/labs/onoma/components/shared/AdvancedConlangSettings.tsx
// Onoma Custom Studio Workshop — Advanced Generator Settings Component

import { AppleSwitch } from "~/components/ui/apple-switch";
import { PatternDepthControl } from "./PatternDepthControl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { NameCategory } from "~/lib/onoma/types";
import { Input } from "~/components/ui/input";

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
    <div className="animate-in fade-in mt-4 space-y-4 duration-200">
      {/* Include Live World Data Toggle */}
      <div className="border-separator flex items-center justify-between border-b pb-3">
        <div className="space-y-0.5 pr-2">
          <label className="text-label-secondary text-subhead">Include Live World Data</label>
          <p className="text-label-secondary text-caption leading-normal">
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
        <div className="border-separator space-y-2 border-b pb-3">
          <label className="text-label-secondary text-subhead">Title Prefix</label>
          <Select
            value={gen.selectedPrefix || "none"}
            onValueChange={(val) => gen.setSelectedPrefix(val === "none" ? "" : val)}
          >
            <SelectTrigger className="text-footnote w-full">
              <SelectValue placeholder="Select prefix" />
            </SelectTrigger>
            <SelectContent className="max-h-[250px]">
              <SelectItem value="none" className="text-footnote">
                None
              </SelectItem>
              <SelectItem value="King" className="text-footnote">
                King
              </SelectItem>
              <SelectItem value="Queen" className="text-footnote">
                Queen
              </SelectItem>
              <SelectItem value="Prince" className="text-footnote">
                Prince
              </SelectItem>
              <SelectItem value="Princess" className="text-footnote">
                Princess
              </SelectItem>
              <SelectItem value="Lord" className="text-footnote">
                Lord
              </SelectItem>
              <SelectItem value="Lady" className="text-footnote">
                Lady
              </SelectItem>
              <SelectItem value="Sir" className="text-footnote">
                Sir
              </SelectItem>
              <SelectItem value="General" className="text-footnote">
                General
              </SelectItem>
              <SelectItem value="President" className="text-footnote">
                President
              </SelectItem>
              <SelectItem value="Governor" className="text-footnote">
                Governor
              </SelectItem>
              <SelectItem value="Minister" className="text-footnote">
                Minister
              </SelectItem>
              <SelectItem value="Dr." className="text-footnote">
                Dr.
              </SelectItem>
              <SelectItem value="custom" className="text-footnote">
                Custom Prefix...
              </SelectItem>
            </SelectContent>
          </Select>

          {gen.selectedPrefix === "custom" && (
            <Input
              type="text"
              placeholder="e.g. Grand Duke"
              value={gen.customPrefix}
              onChange={(e) => gen.setCustomPrefix(e.target.value)}
              className="text-footnote mt-1 w-full"
            />
          )}
        </div>
      )}

      {/* Category-aware Suffix Select (Organization, Country, Province categories only) */}
      {(category === "organization" || category === "country" || category === "province") && (
        <div className="border-separator space-y-2 border-b pb-3">
          <label className="text-caption text-label block font-medium">Name Suffix</label>
          <Select
            value={gen.selectedSuffix || "none"}
            onValueChange={(val) => gen.setSelectedSuffix(val === "none" ? "" : val)}
          >
            <SelectTrigger className="text-footnote w-full">
              <SelectValue placeholder="Select suffix" />
            </SelectTrigger>
            <SelectContent className="max-h-[250px]">
              <SelectItem value="none" className="text-footnote">
                None
              </SelectItem>
              <SelectItem value="Association" className="text-footnote">
                Association
              </SelectItem>
              <SelectItem value="Committee" className="text-footnote">
                Committee
              </SelectItem>
              <SelectItem value="Society" className="text-footnote">
                Society
              </SelectItem>
              <SelectItem value="Alliance" className="text-footnote">
                Alliance
              </SelectItem>
              <SelectItem value="Union" className="text-footnote">
                Union
              </SelectItem>
              <SelectItem value="Club" className="text-footnote">
                Club
              </SelectItem>
              <SelectItem value="Company" className="text-footnote">
                Company
              </SelectItem>
              <SelectItem value="Party" className="text-footnote">
                Party
              </SelectItem>
              <SelectItem value="Organization" className="text-footnote">
                Organization
              </SelectItem>
              <SelectItem value="custom" className="text-footnote">
                Custom Suffix...
              </SelectItem>
            </SelectContent>
          </Select>

          {gen.selectedSuffix === "custom" && (
            <Input
              type="text"
              placeholder="e.g. Guild"
              value={gen.customSuffix}
              onChange={(e) => gen.setCustomSuffix(e.target.value)}
              className="text-footnote mt-1 w-full font-mono"
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-caption text-label block font-medium">Min Length</label>
          <Input
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
            className="text-footnote w-full font-mono"
          />
        </div>
        <div className="space-y-1">
          <label className="text-caption text-label block font-medium">Max Length</label>
          <Input
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
            className="text-footnote w-full font-mono"
          />
        </div>
      </div>

      {/* Substring constraint filters */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-caption text-label block font-medium">
            Starts With <span className="text-label-secondary text-caption font-mono">(#_)</span>
          </label>
          <Input
            type="text"
            placeholder="e.g. Ae"
            value={gen.options.startsWith || ""}
            onChange={(e) => gen.setOptions({ ...gen.options, startsWith: e.target.value })}
            className="text-footnote w-full font-mono"
          />
        </div>
        <div className="space-y-1">
          <label className="text-caption text-label block font-medium">
            Ends With <span className="text-label-secondary text-caption font-mono">(_#)</span>
          </label>
          <Input
            type="text"
            placeholder="e.g. th"
            value={gen.options.endsWith || ""}
            onChange={(e) => gen.setOptions({ ...gen.options, endsWith: e.target.value })}
            className="text-footnote w-full font-mono"
          />
        </div>
      </div>

      {/* Pattern Depth Control */}
      <PatternDepthControl
        value={gen.order}
        onChange={(val) => gen.setOrder(val)}
        variant="inspector"
        className="pb-1"
      />

      {/* Advanced conlang & phonotactics */}
      <div className="border-separator space-y-4 border-t pt-4">
        <h5 className="text-subhead text-label">Advanced Conlang & Phonotactics</h5>

        {/* Syllable Counts */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-caption text-label block font-medium">Min Syllables</label>
            <Input
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
              className="text-footnote w-full font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-caption text-label block font-medium">Max Syllables</label>
            <Input
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
              className="text-footnote w-full font-mono"
            />
          </div>
        </div>

        {/* CV Template Input */}
        <div className="space-y-1">
          <label className="text-caption text-label block font-medium">Strict CV Template</label>
          <Input
            type="text"
            placeholder="e.g. CVCV (C=consonant, V=vowel)"
            value={gen.options.cvTemplate || ""}
            onChange={(e) =>
              gen.setOptions({
                ...gen.options,
                cvTemplate: e.target.value.replace(/[^cvCV]/g, "").toUpperCase(),
              })
            }
            className="w-full font-mono"
          />
        </div>

        {/* Switches Grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Must End With Vowel */}
          <div className="flex items-center justify-between">
            <span className="text-caption text-label font-medium">Must End With Vowel</span>
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
            <span className="text-caption text-label font-medium">Must End With Consonant</span>
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
            <span className="text-caption text-label font-medium">
              No Initial Clusters (e.g. "str-")
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
            <span className="text-caption text-label font-medium">
              No Final Clusters (e.g. "-rts")
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
