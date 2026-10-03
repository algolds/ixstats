"use client";

import React from "react";
import { Search, Xmark as X } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export type SelectOptions = Array<[value: string, label: string]>;

export const RARITY_OPTIONS: SelectOptions = [
  ["all", "All rarities"],
  ["COMMON", "Common"],
  ["UNCOMMON", "Uncommon"],
  ["RARE", "Rare"],
  ["ULTRA_RARE", "Ultra rare"],
  ["EPIC", "Epic"],
  ["LEGENDARY", "Legendary"],
];

export const SEASON_OPTIONS: SelectOptions = [
  ["all", "All seasons"],
  ["1", "Season 1"],
  ["2", "Season 2"],
  ["3", "Season 3"],
];

const ACTIVE_CLASS = "bg-tint-fill text-tint font-medium";

/** Compact search box with a clear button. */
export function SidebarSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <Search className="text-label-secondary pointer-events-none absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search cards..."
        className="border-separator placeholder:text-label-tertiary bg-fill-4 focus:bg-background text-footnote h-7 pr-6 pl-6"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="text-label-secondary absolute top-1/2 right-1 size-5 -translate-y-1/2"
        >
          <X className="text-label-secondary hover:text-label h-3 w-3 transition-colors" />
        </Button>
      )}
    </div>
  );
}

/** Compact filter select; highlighted while it holds a non-default value. */
export function SidebarSelect({
  value,
  onValueChange,
  options,
  placeholder,
  icon: Icon,
  active,
  activeClass = ACTIVE_CLASS,
  triggerClass = "px-2",
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOptions;
  placeholder?: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Highlight the trigger (the filter is set). */
  active?: boolean;
  activeClass?: string;
  triggerClass?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn("text-footnote h-7 w-full", triggerClass, active && activeClass)}
      >
        {Icon && <Icon className="mr-2 h-3 w-3 shrink-0" />}
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(([optionValue, label]) => (
          <SelectItem key={optionValue} value={optionValue}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** "Sort by" label above a plain select. */
export function SidebarSort({
  value,
  onValueChange,
  options,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOptions;
}) {
  return (
    <div>
      <p className="text-label-secondary text-eyebrow mb-1">Sort by</p>
      <SidebarSelect
        value={value}
        onValueChange={onValueChange}
        options={options}
        triggerClass=""
      />
    </div>
  );
}

export function ClearFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="text-label-secondary w-full">
      <X className="h-3 w-3" /> Clear Filters
    </Button>
  );
}
