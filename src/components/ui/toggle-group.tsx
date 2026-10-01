"use client";

import * as React from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils/cn";
import { Toggle, toggleVariants } from "~/components/ui/toggle";

/**
 * ToggleGroup (spec §7.2): a row of toggle buttons.
 *
 * - `type="multiple"` — multi-select filters; `value` is a `string[]`.
 * - `type="single"` — at most one pressed; pressing the pressed item clears it (`""`) unless
 *   `disallowEmpty` (alias `required`) is set, in which case the pressed item stays pressed. For a
 *   required single choice between peer views, prefer `SegmentedControl`.
 * - `disallowEmpty` with `type="multiple"` keeps the last pressed item from being released.
 *
 * Renders `role="group"` (name it with `aria-label`); items are `aria-pressed` buttons. Arrow keys
 * (and Home/End) move focus between items; every item stays in the tab order.
 *
 * ```tsx
 * <ToggleGroup type="multiple" aria-label="Filters" value={filters} onValueChange={setFilters}>
 *   <ToggleGroupItem value="active">Active</ToggleGroupItem>
 *   <ToggleGroupItem value="archived">Archived</ToggleGroupItem>
 * </ToggleGroup>
 * ```
 */

type ToggleVariantProps = VariantProps<typeof toggleVariants>;

interface ToggleGroupContextValue extends ToggleVariantProps {
  isPressed: (value: string) => boolean;
  toggle: (value: string) => void;
  disabled?: boolean;
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue | null>(null);

interface ToggleGroupBaseProps
  extends
    Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "dir">,
    ToggleVariantProps {
  disabled?: boolean;
  /** Arrow-key axis. @default "horizontal" */
  orientation?: "horizontal" | "vertical";
  /**
   * Never let the selection become empty: pressing the only pressed item does nothing (single:
   * the active item stays pressed; multiple: the last pressed item stays pressed).
   */
  disallowEmpty?: boolean;
  /** Alias of `disallowEmpty`. */
  required?: boolean;
}

interface ToggleGroupSingleProps extends ToggleGroupBaseProps {
  type: "single";
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

interface ToggleGroupMultipleProps extends ToggleGroupBaseProps {
  type: "multiple";
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
}

export type ToggleGroupProps = ToggleGroupSingleProps | ToggleGroupMultipleProps;

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

function ToggleGroup(props: ToggleGroupProps) {
  const {
    type,
    value: controlledValue,
    defaultValue,
    onValueChange,
    variant,
    size,
    disabled,
    orientation = "horizontal",
    disallowEmpty: disallowEmptyProp,
    required,
    className,
    onKeyDown,
    children,
    ...rest
  } = props;
  const disallowEmpty = Boolean(disallowEmptyProp || required);

  const [uncontrolled, setUncontrolled] = React.useState<string[]>(() => toArray(defaultValue));
  const isControlled = controlledValue !== undefined;
  const selected = isControlled ? toArray(controlledValue) : uncontrolled;

  const toggle = (itemValue: string) => {
    if (disallowEmpty && selected.length === 1 && selected[0] === itemValue) return;
    let next: string[];
    if (type === "multiple") {
      next = selected.includes(itemValue)
        ? selected.filter((v) => v !== itemValue)
        : [...selected, itemValue];
      if (!isControlled) setUncontrolled(next);
      (onValueChange as ToggleGroupMultipleProps["onValueChange"])?.(next);
    } else {
      const nextValue = selected.includes(itemValue) ? "" : itemValue;
      next = toArray(nextValue);
      if (!isControlled) setUncontrolled(next);
      (onValueChange as ToggleGroupSingleProps["onValueChange"])?.(nextValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const group = e.currentTarget;
    const items = Array.from(
      group.querySelectorAll<HTMLButtonElement>('[data-slot="toggle-group-item"]:not(:disabled)')
    ).filter((item) => item.closest('[data-slot="toggle-group"]') === group);
    const current = items.indexOf(e.target as HTMLButtonElement);
    if (current === -1) return;
    const [prev, nextKey] =
      orientation === "vertical" ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
    let next: number | null = null;
    if (e.key === nextKey) next = (current + 1) % items.length;
    else if (e.key === prev) next = (current - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next === null) return;
    e.preventDefault();
    items[next]!.focus();
  };

  return (
    <ToggleGroupContext.Provider
      value={{ isPressed: (v) => selected.includes(v), toggle, variant, size, disabled }}
    >
      <div
        role="group"
        data-slot="toggle-group"
        data-type={type}
        data-orientation={orientation}
        aria-orientation={orientation}
        className={cn(
          "inline-flex flex-wrap items-center gap-1",
          orientation === "vertical" && "flex-col items-stretch",
          className
        )}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  );
}

interface ToggleGroupItemProps
  extends
    Omit<React.ComponentProps<typeof Toggle>, "pressed" | "defaultPressed" | "onPressedChange">,
    ToggleVariantProps {
  value: string;
}

function ToggleGroupItem({
  value,
  variant,
  size,
  disabled,
  className,
  ...props
}: ToggleGroupItemProps) {
  const ctx = React.useContext(ToggleGroupContext);
  if (!ctx) throw new Error("ToggleGroupItem must be used within ToggleGroup");
  return (
    <Toggle
      data-slot="toggle-group-item"
      data-value={value}
      variant={variant ?? ctx.variant}
      size={size ?? ctx.size}
      disabled={disabled ?? ctx.disabled}
      pressed={ctx.isPressed(value)}
      onPressedChange={() => ctx.toggle(value)}
      className={className}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem, type ToggleGroupItemProps };
