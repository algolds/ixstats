"use client";

import type { ComponentProps, ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type ValueSelectOption = readonly [value: string, label: ReactNode];

interface ValueSelectProps extends Omit<
  ComponentProps<typeof SelectTrigger>,
  "value" | "defaultValue" | "onChange" | "children" | "disabled"
> {
  value?: string;
  onValueChange?: (value: string) => void;
  /** `[value, label]` pairs, in display order. */
  options: readonly ValueSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  contentClassName?: string;
  itemClassName?: string;
}

/** A `Select` over a static `[value, label]` list: trigger, value, content and items in one. */
export function ValueSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  contentClassName,
  itemClassName,
  ...trigger
}: ValueSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger {...trigger}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map(([optionValue, label]) => (
          <SelectItem key={optionValue} value={optionValue} className={itemClassName}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
