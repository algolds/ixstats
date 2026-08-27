"use client";

import * as React from "react";
import { type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";
import { toggleVariants } from "~/components/ui/toggle";

const ToggleGroupContext = React.createContext<{
  size?: VariantProps<typeof toggleVariants>["size"];
  variant?: VariantProps<typeof toggleVariants>["variant"];
  value?: string | string[];
  onItemClick?: (itemValue: string) => void;
}>({});

function ToggleGroup({
  className,
  variant,
  size,
  children,
  value,
  onValueChange,
  ...props
}: React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof toggleVariants> & {
    type?: "single" | "multiple";
    value?: string | string[];
    onValueChange?: (value: any) => void;
  }) {
  const onItemClick = React.useCallback(
    (itemValue: string) => {
      onValueChange?.(itemValue);
    },
    [onValueChange]
  );

  return (
    <ToggleGroupContext.Provider value={{ variant, size, value, onItemClick }}>
      <div
        data-slot="toggle-group"
        className={cn("flex items-center justify-center gap-1", className)}
        {...props}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  );
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  value: itemValue,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof toggleVariants> & {
    value: string;
  }) {
  const context = React.useContext(ToggleGroupContext);
  const isSelected = Array.isArray(context.value)
    ? context.value.includes(itemValue)
    : context.value === itemValue;

  return (
    <button
      type="button"
      data-slot="toggle-group-item"
      data-cuelume-press="tick"
      data-cuelume-hover="tick"
      data-state={isSelected ? "on" : "off"}
      aria-pressed={isSelected}
      onClick={() => context.onItemClick?.(itemValue)}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        "min-w-0 shrink-0",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export { ToggleGroup, ToggleGroupItem };
