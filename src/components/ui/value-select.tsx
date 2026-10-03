"use client";

import type { ComponentProps, ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type ValueSelectOption<T extends string> = readonly [value: T, label: ReactNode];

interface ValueSelectProps<T extends string> extends Omit<
  ComponentProps<typeof SelectTrigger>,
  "value" | "defaultValue" | "onChange" | "children" | "disabled"
> {
  value?: T;
  onValueChange?: (value: T) => void;
  /** `[value, label]` pairs, in display order. */
  options: readonly ValueSelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  contentClassName?: string;
  itemClassName?: string;
}

/** A `Select` over a static `[value, label]` list: trigger, value, content and items in one. */
export function ValueSelect<T extends string = string>({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  contentClassName,
  itemClassName,
  ...trigger
}: ValueSelectProps<T>) {
  return (
    <Select
      value={value}
      onValueChange={onValueChange as ((value: string) => void) | undefined}
      disabled={disabled}
    >
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
