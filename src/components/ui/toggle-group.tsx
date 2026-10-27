"use client";

import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import type { VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils/cn";
import { useControllableState } from "~/hooks/useControllableState";
import { toggleVariants } from "~/components/ui/toggle";

/**
 * A row of toggle buttons on Radix ToggleGroup (roving tab stop, arrow keys).
 *
 * - `type="multiple"`: multi-select filters; `value` is a `string[]`.
 * - `type="single"`: at most one pressed; pressing the pressed item clears it (`""`) unless
 *   `disallowEmpty` is set. For a required single choice between peer views, prefer
 *   `SegmentedControl`.
 * - `disallowEmpty` with `type="multiple"` keeps the last pressed item from being released.
 *
 * Name the group with `aria-label`.
 *
 * ```tsx
 * <ToggleGroup type="multiple" aria-label="Filters" value={filters} onValueChange={setFilters}>
 *   <ToggleGroupItem value="active">Active</ToggleGroupItem>
 * </ToggleGroup>
 * ```
 */

type ToggleVariantProps = VariantProps<typeof toggleVariants>;

const ToggleGroupContext = React.createContext<ToggleVariantProps>({});

interface ToggleGroupBaseProps
  extends
    Omit<React.ComponentProps<"div">, "defaultValue" | "onChange" | "dir">,
    ToggleVariantProps {
  disabled?: boolean;
  /** Arrow-key axis. @default "horizontal" */
  orientation?: "horizontal" | "vertical";
  /** Never let the selection become empty. */
  disallowEmpty?: boolean;
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

type ToggleGroupProps = ToggleGroupSingleProps | ToggleGroupMultipleProps;

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
    disallowEmpty = false,
    className,
    ...rest
  } = props;
  const [selected, setSelected] = useControllableState<string[]>({
    prop: controlledValue === undefined ? undefined : toArray(controlledValue),
    defaultProp: toArray(defaultValue),
  });

  const commit = (next: string[]) => {
    if (disallowEmpty && next.length === 0) return;
    setSelected(next);
    if (type === "single")
      (onValueChange as ToggleGroupSingleProps["onValueChange"])?.(next[0] ?? "");
    else (onValueChange as ToggleGroupMultipleProps["onValueChange"])?.(next);
  };

  const groupProps = {
    "data-slot": "toggle-group",
    className: cn(
      "inline-flex flex-wrap items-center gap-1 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
      className
    ),
    ...rest,
  };

  return (
    <ToggleGroupContext.Provider value={{ variant, size }}>
      {type === "single" ? (
        <ToggleGroupPrimitive.Root
          type="single"
          value={selected[0] ?? ""}
          onValueChange={(next) => commit(toArray(next))}
          {...groupProps}
        />
      ) : (
        <ToggleGroupPrimitive.Root
          type="multiple"
          value={selected}
          onValueChange={commit}
          {...groupProps}
        />
      )}
    </ToggleGroupContext.Provider>
  );
}

type ToggleGroupItemProps = React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
  ToggleVariantProps;

function ToggleGroupItem({ variant, size, className, ...props }: ToggleGroupItemProps) {
  const ctx = React.useContext(ToggleGroupContext);
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        toggleVariants({ variant: variant ?? ctx.variant, size: size ?? ctx.size }),
        className
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
