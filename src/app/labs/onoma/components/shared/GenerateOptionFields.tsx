"use client";

import type { ReactNode } from "react";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import type { GenerateOptions } from "~/lib/onoma/types";

/** The inspector forms use one look; the studio workshop panels use another. */
const LOOKS = {
  inspector: {
    label: "text-caption text-label block font-medium",
    input: "text-footnote w-full font-mono",
    switchLabel: "text-caption text-label font-medium",
  },
  studio: {
    label: "text-label-secondary text-subhead",
    input: "text-footnote w-full",
    switchLabel: "text-label-secondary text-caption font-semibold",
  },
} as const;

export interface OptionFieldContext {
  options: GenerateOptions;
  onChange: (options: GenerateOptions) => void;
  look: keyof typeof LOOKS;
}

type TextField = "startsWith" | "endsWith" | "contains" | "excludes";
type NumberField = "minLength" | "maxLength" | "minSyllables";
type SwitchField =
  "mustEndWithVowel" | "mustEndWithConsonant" | "noInitialClusters" | "noFinalClusters";

function LabeledInput({
  ctx,
  label,
  hint,
  className,
  ...input
}: {
  ctx: OptionFieldContext;
  label: ReactNode;
  hint?: string;
  className?: string;
} & React.ComponentProps<typeof Input>) {
  const look = LOOKS[ctx.look];
  return (
    <div className="space-y-1">
      <label className={look.label}>
        {label}
        {hint && (
          <>
            {" "}
            <span className="text-label-secondary text-caption font-mono">{hint}</span>
          </>
        )}
      </label>
      <Input className={className ?? look.input} {...input} />
    </div>
  );
}

export function OptionText({
  ctx,
  field,
  label,
  hint,
  placeholder,
}: {
  ctx: OptionFieldContext;
  field: TextField;
  label: ReactNode;
  hint?: string;
  placeholder: string;
}) {
  return (
    <LabeledInput
      ctx={ctx}
      label={label}
      hint={hint}
      type="text"
      placeholder={placeholder}
      value={ctx.options[field] || ""}
      onChange={(e) => ctx.onChange({ ...ctx.options, [field]: e.target.value })}
    />
  );
}

function OptionNumber({
  ctx,
  field,
  label,
  min,
  max,
  fallback = 0,
}: {
  ctx: OptionFieldContext;
  field: NumberField;
  label: string;
  min: number;
  max: number;
  /** Shown while the stored value is 0 or unset. */
  fallback?: number;
}) {
  return (
    <LabeledInput
      ctx={ctx}
      label={label}
      type="number"
      min={min}
      max={max}
      value={ctx.options[field] || fallback}
      onChange={(e) => ctx.onChange({ ...ctx.options, [field]: parseInt(e.target.value) || 0 })}
    />
  );
}

export function LengthFields({
  ctx,
  className = "grid grid-cols-2 gap-3",
}: {
  ctx: OptionFieldContext;
  className?: string;
}) {
  return (
    <div className={className}>
      <OptionNumber ctx={ctx} field="minLength" label="Min length" min={1} max={20} fallback={4} />
      <OptionNumber ctx={ctx} field="maxLength" label="Max length" min={1} max={30} fallback={12} />
    </div>
  );
}

/** Syllable limits; an empty maximum means "no limit" (stored as -1). */
export function SyllableFields({ ctx }: { ctx: OptionFieldContext }) {
  const { maxSyllables } = ctx.options;
  return (
    <div className="grid grid-cols-2 gap-3">
      <OptionNumber ctx={ctx} field="minSyllables" label="Min syllables" min={0} max={5} />
      <LabeledInput
        ctx={ctx}
        label="Max syllables"
        type="number"
        min={-1}
        max={10}
        placeholder="No limit"
        value={maxSyllables === undefined || maxSyllables === -1 ? "" : maxSyllables}
        onChange={(e) =>
          ctx.onChange({
            ...ctx.options,
            maxSyllables: e.target.value === "" ? -1 : parseInt(e.target.value) || -1,
          })
        }
      />
    </div>
  );
}

export function CvTemplateField({ ctx }: { ctx: OptionFieldContext }) {
  return (
    <LabeledInput
      ctx={ctx}
      label="Strict CV Template"
      className="w-full font-mono"
      type="text"
      placeholder="e.g. CVCV (C=consonant, V=vowel)"
      value={ctx.options.cvTemplate || ""}
      onChange={(e) =>
        ctx.onChange({
          ...ctx.options,
          cvTemplate: e.target.value.replace(/[^cvCV]/g, "").toUpperCase(),
        })
      }
    />
  );
}

/** Vowel/consonant endings exclude each other; the cluster switches are independent. */
const EXCLUSIVE_ENDING: Partial<Record<SwitchField, SwitchField>> = {
  mustEndWithVowel: "mustEndWithConsonant",
  mustEndWithConsonant: "mustEndWithVowel",
};

export function OptionSwitches({
  ctx,
  labels,
}: {
  ctx: OptionFieldContext;
  labels: Record<SwitchField, string>;
}) {
  const { options, onChange } = ctx;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(Object.keys(labels) as SwitchField[]).map((field) => {
        const opposite = EXCLUSIVE_ENDING[field];
        return (
          <div key={field} className="flex items-center justify-between">
            <span className={LOOKS[ctx.look].switchLabel}>{labels[field]}</span>
            <Switch
              checked={options[field] || false}
              onCheckedChange={(checked) =>
                onChange({
                  ...options,
                  [field]: checked,
                  ...(opposite && checked && { [opposite]: false }),
                })
              }
              size="sm"
            />
          </div>
        );
      })}
    </div>
  );
}
