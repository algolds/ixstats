"use client";

/**
 * OptionSelect — the `Select` driven by an options array, for the many
 * value/label pickers in the map editor, Vexel and MyCountry that used native select elements.
 *
 * Radix Select reserves the empty string, so an option whose value is `""` (an "any"/"none"
 * choice) is carried internally as a sentinel and reported back as `""`. Name the control with
 * `aria-label` or `aria-labelledby` (a native `<label>` has nothing to point at).
 */

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const EMPTY = "__option-select-empty__";

interface OptionSelectOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
  /** Optional group heading; consecutive options with the same group render together. */
  group?: string;
}

interface OptionSelectProps<T extends string = string> {
  value: T | undefined;
  onValueChange: (value: T) => void;
  options: readonly OptionSelectOption<T>[];
  /** Shown when `value` matches no option. */
  placeholder?: string;
  disabled?: boolean;
  /** Trigger size: `sm` 28 · `default` 36 · `lg` 44. */
  size?: "sm" | "default" | "lg";
  /** Classes for the trigger (width defaults to the full container). */
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  title?: string;
}

const encode = (value: string) => (value === "" ? EMPTY : value);
const decode = (value: string) => (value === EMPTY ? "" : value);

export function OptionSelect<T extends string = string>({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  size = "default",
  className = "w-full",
  id,
  title,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: OptionSelectProps<T>): React.JSX.Element {
  const known = value !== undefined && options.some((o) => o.value === value);
  const groups: { group?: string; options: OptionSelectOption<T>[] }[] = [];
  for (const option of options) {
    const last = groups[groups.length - 1];
    if (last && last.group === option.group) last.options.push(option);
    else groups.push({ group: option.group, options: [option] });
  }

  return (
    <Select
      value={known ? encode(value) : undefined}
      onValueChange={(next) => onValueChange(decode(next) as T)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        size={size}
        className={className}
        title={title}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {groups.map((g, i) => {
          const items = g.options.map((o) => (
            <SelectItem key={encode(o.value)} value={encode(o.value)} disabled={o.disabled}>
              {o.label}
            </SelectItem>
          ));
          return g.group ? (
            <SelectGroup key={`${g.group}-${i}`}>
              <SelectLabel>{g.group}</SelectLabel>
              {items}
            </SelectGroup>
          ) : (
            <React.Fragment key={`ungrouped-${i}`}>{items}</React.Fragment>
          );
        })}
      </SelectContent>
    </Select>
  );
}
