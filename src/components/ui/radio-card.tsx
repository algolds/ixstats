"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "~/lib/utils/cn";

/**
 * A single choice among options that need more than a word each (a title, a description, an icon)
 * laid out as cards, on Radix RadioGroup. For 2-5 short peer options use `SegmentedControl`.
 * Name the group with `aria-label` or `aria-labelledby`.
 *
 * ```tsx
 * <RadioCardGroup aria-label="Delivery" value={mode} onValueChange={setMode} columns={3}>
 *   <RadioCard value="alert" icon={<Bell />} title="Platform alert" description="Everyone" />
 * </RadioCardGroup>
 * ```
 */

export interface RadioCardGroupProps extends Omit<
  React.ComponentProps<typeof RadioGroupPrimitive.Root>,
  "value"
> {
  /** The checked value; `null` keeps the group controlled with nothing checked. */
  value?: string | null;
  /** Fixed column count from `sm` up (one column on phones). Omit to lay out cards yourself. */
  columns?: 1 | 2 | 3 | 4;
}

const COLUMNS: Record<NonNullable<RadioCardGroupProps["columns"]>, string> = {
  1: "grid grid-cols-1 gap-2",
  2: "grid grid-cols-1 gap-2 sm:grid-cols-2",
  3: "grid grid-cols-1 gap-2 sm:grid-cols-3",
  4: "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4",
};

export function RadioCardGroup({ value, columns, className, ...props }: RadioCardGroupProps) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-card-group"
      value={value === null ? "" : value}
      className={cn(columns ? COLUMNS[columns] : undefined, className)}
      {...props}
    />
  );
}

export interface RadioCardProps extends Omit<
  React.ComponentProps<typeof RadioGroupPrimitive.Item>,
  "title"
> {
  /** Leading icon (16-20px). Takes the tint when checked. */
  icon?: React.ReactNode;
  /** Card title. Use `children` for fully custom content. */
  title?: React.ReactNode;
  /** Secondary text. */
  description?: React.ReactNode;
  /** Show the radio dot in the trailing corner. @default true */
  indicator?: boolean;
}

export function RadioCard({
  icon,
  title,
  description,
  indicator = true,
  className,
  children,
  ...props
}: RadioCardProps) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-card"
      className={cn(
        "group/radio-card rounded-row relative flex w-full min-w-0 cursor-pointer items-start gap-3 border p-3 text-left",
        "ease-out-facet transition-[color,background-color,border-color,box-shadow] duration-150",
        "focus-visible:outline-tint outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "text-label border-separator bg-surface hover:bg-fill-4",
        "data-[state=checked]:border-tint data-[state=checked]:bg-tint-fill data-[state=checked]:ring-tint data-[state=checked]:hover:bg-tint-fill data-[state=checked]:ring-1",
        className
      )}
      {...props}
    >
      {icon != null && icon !== false && (
        <span
          aria-hidden
          className="text-label-secondary group-data-[state=checked]/radio-card:text-tint flex shrink-0 items-center justify-center pt-0.5 [:where(&)_svg]:size-5"
        >
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title != null && title !== false && (
          <span className="text-headline text-label break-words">{title}</span>
        )}
        {description != null && description !== false && (
          <span className="text-footnote text-label-secondary break-words">{description}</span>
        )}
        {children}
      </span>
      {indicator && (
        <span
          aria-hidden
          className="border-label-tertiary bg-surface group-data-[state=checked]/radio-card:border-tint group-data-[state=checked]/radio-card:bg-tint mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border"
        >
          <span className="bg-on-tint hidden size-1.5 rounded-full group-data-[state=checked]/radio-card:block" />
        </span>
      )}
    </RadioGroupPrimitive.Item>
  );
}
