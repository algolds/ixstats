"use client";

import { Switch } from "~/components/ui/switch";
import { PatternDepthControl } from "./PatternDepthControl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { GenerateOptions, NameCategory } from "~/lib/onoma/types";
import { Input } from "~/components/ui/input";
import {
  CvTemplateField,
  LengthFields,
  OptionSwitches,
  OptionText,
  SyllableFields,
  type OptionFieldContext,
} from "./GenerateOptionFields";

const TITLE_PREFIXES = [
  "King",
  "Queen",
  "Prince",
  "Princess",
  "Lord",
  "Lady",
  "Sir",
  "General",
  "President",
  "Governor",
  "Minister",
  "Dr.",
];

const NAME_SUFFIXES = [
  "Association",
  "Committee",
  "Society",
  "Alliance",
  "Union",
  "Club",
  "Company",
  "Party",
  "Organization",
];

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
    options: GenerateOptions;
    setOptions: (opts: GenerateOptions) => void;
    order: number;
    setOrder: (v: number) => void;
  };
  category: NameCategory;
}

interface AffixSelectProps {
  label: string;
  borderClassName?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  options: readonly string[];
  customLabel: string;
  customValue: string;
  onCustomChange: (value: string) => void;
  customPlaceholder: string;
  labelClassName: string;
  customInputClassName: string;
}

/** A "none / presets / custom" select; choosing custom reveals a free-text input. */
function AffixSelect(props: AffixSelectProps) {
  return (
    <div className="border-separator space-y-2 border-b pb-3">
      <label className={props.labelClassName}>{props.label}</label>
      <Select
        value={props.value || "none"}
        onValueChange={(val) => props.onValueChange(val === "none" ? "" : val)}
      >
        <SelectTrigger className="text-footnote w-full">
          <SelectValue placeholder={props.placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-[250px]">
          {[
            { value: "none", label: "None" },
            ...props.options.map((option) => ({ value: option, label: option })),
            { value: "custom", label: props.customLabel },
          ].map(({ value, label }) => (
            <SelectItem key={value} value={value} className="text-footnote">
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {props.value === "custom" && (
        <Input
          type="text"
          placeholder={props.customPlaceholder}
          value={props.customValue}
          onChange={(e) => props.onCustomChange(e.target.value)}
          className={props.customInputClassName}
        />
      )}
    </div>
  );
}

export function AdvancedConlangSettings({ gen, category }: AdvancedConlangSettingsProps) {
  const ctx: OptionFieldContext = {
    options: gen.options,
    onChange: gen.setOptions,
    look: "inspector",
  };
  const hasSuffix =
    category === "organization" || category === "country" || category === "province";

  return (
    <div className="animate-in fade-in mt-4 space-y-4 duration-200">
      <div className="border-separator flex items-center justify-between border-b pb-3">
        <div className="space-y-0.5 pr-2">
          <label className="text-label-secondary text-subhead">Include live world data</label>
          <p className="text-label-secondary text-caption leading-normal">
            Blend live database records (cities, leaders) into training seeds.
          </p>
        </div>
        <Switch
          checked={gen.includeWorldData}
          onCheckedChange={gen.setIncludeWorldData}
          size="sm"
        />
      </div>

      {category === "person" && (
        <AffixSelect
          label="Title prefix"
          labelClassName="text-label-secondary text-subhead"
          value={gen.selectedPrefix}
          onValueChange={gen.setSelectedPrefix}
          placeholder="Select prefix"
          options={TITLE_PREFIXES}
          customLabel="Custom Prefix..."
          customValue={gen.customPrefix}
          onCustomChange={gen.setCustomPrefix}
          customPlaceholder="e.g. Grand Duke"
          customInputClassName="text-footnote mt-1 w-full"
        />
      )}

      {hasSuffix && (
        <AffixSelect
          label="Name suffix"
          labelClassName="text-caption text-label block font-medium"
          value={gen.selectedSuffix}
          onValueChange={gen.setSelectedSuffix}
          placeholder="Select suffix"
          options={NAME_SUFFIXES}
          customLabel="Custom Suffix..."
          customValue={gen.customSuffix}
          onCustomChange={gen.setCustomSuffix}
          customPlaceholder="e.g. Guild"
          customInputClassName="text-footnote mt-1 w-full font-mono"
        />
      )}

      <LengthFields ctx={ctx} />

      <div className="grid grid-cols-2 gap-3">
        <OptionText
          ctx={ctx}
          field="startsWith"
          label="Starts with"
          hint="(#_)"
          placeholder="e.g. Ae"
        />
        <OptionText
          ctx={ctx}
          field="endsWith"
          label="Ends with"
          hint="(_#)"
          placeholder="e.g. th"
        />
      </div>

      <PatternDepthControl
        value={gen.order}
        onChange={(val) => gen.setOrder(val)}
        variant="inspector"
        className="pb-1"
      />

      <div className="border-separator space-y-4 border-t pt-4">
        <h5 className="text-subhead text-label">Advanced conlang & phonotactics</h5>
        <SyllableFields ctx={ctx} />
        <CvTemplateField ctx={ctx} />
        <OptionSwitches
          ctx={ctx}
          labels={{
            mustEndWithVowel: "Must end with vowel",
            mustEndWithConsonant: "Must end with consonant",
            noInitialClusters: 'No Initial Clusters (e.g. "str-")',
            noFinalClusters: 'No Final Clusters (e.g. "-rts")',
          }}
        />
      </div>
    </div>
  );
}
