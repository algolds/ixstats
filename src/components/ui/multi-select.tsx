"use client";

import * as React from "react";
import { Xmark as X, NavArrowDown as ChevronDown, Check } from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { fieldStyles } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

interface MultiSelectProps {
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  maxSelections?: number;
  className?: string;
  disabled?: boolean;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select items...",
  maxSelections,
  className,
  disabled = false,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter((v) => v !== option));
    } else {
      if (maxSelections && value.length >= maxSelections) {
        // Don't add more if max reached
        return;
      }
      onChange([...value, option]);
    }
  };

  const handleRemove = (option: string) => {
    onChange(value.filter((v) => v !== option));
  };

  const canSelectMore = !maxSelections || value.length < maxSelections;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        role="combobox"
        aria-expanded={open}
        className={cn(
          fieldStyles,
          "rounded-control text-callout inline-flex items-center justify-between gap-2 whitespace-nowrap disabled:pointer-events-none disabled:opacity-50",
          "h-auto min-h-(--control-height) w-full px-3 py-2",
          !value.length && "text-label-tertiary",
          className
        )}
        disabled={disabled}
      >
        <div className="flex flex-1 flex-wrap gap-1">
          {value.length === 0 ? (
            <span>{placeholder}</span>
          ) : (
            value.map((item) => (
              <Badge
                key={item}
                variant="default"
                className="mr-1 mb-1 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(item);
                }}
              >
                {item}
                <X aria-hidden="true" className="size-3" />
              </Badge>
            ))
          )}
        </div>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = value.includes(option);
                const isDisabled = !isSelected && !canSelectMore;

                return (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => {
                      if (!isDisabled) {
                        handleSelect(option);
                      }
                    }}
                    disabled={isDisabled}
                    className={cn("cursor-pointer", isDisabled && "cursor-not-allowed opacity-50")}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")}
                    />
                    {option}
                    {isDisabled && !isSelected && (
                      <span className="text-label-secondary text-caption ml-auto">
                        Max {maxSelections}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
