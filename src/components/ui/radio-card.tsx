"use client";

import * as React from "react";
import { cn } from "~/lib/utils/cn";

/**
 * RadioCardGroup / RadioCard (spec §7.2 `Radio`): a single choice among options that need more than
 * a word each — a title, a description, an icon — laid out as cards (mode pickers, event types,
 * presets). For 2–5 short peer options use `SegmentedControl`; for long lists use `FacetRow`.
 *
 * ARIA: a `radiogroup` of `radio`s with one roving tab stop (the checked card, else the first
 * enabled one). Arrow keys move focus *and* selection (wrapping), Home/End jump to the ends,
 * Space checks the focused card. Name the group with `aria-label` or `aria-labelledby`.
 *
 * The checked card takes a `tint-fill` background, a tint border and a 1px tint ring, plus a
 * filled radio dot — never colour alone.
 *
 * ```tsx
 * <RadioCardGroup aria-label="Delivery" value={mode} onValueChange={setMode} columns={3}>
 *   <RadioCard value="alert" icon={<Bell />} title="Platform alert" description="Everyone" />
 *   <RadioCard value="dm" title="Direct message" description="One user" />
 * </RadioCardGroup>
 * ```
 */

interface RadioCardGroupContextValue {
  value: string | undefined;
  select: (value: string) => void;
  disabled: boolean;
  tabStop: string | undefined;
  register: (value: string, disabled: boolean) => () => void;
}

const RadioCardGroupContext = React.createContext<RadioCardGroupContextValue | null>(null);

export interface RadioCardGroupProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue" | "role" | "dir"
> {
  /** The checked value; `null` keeps the group controlled with nothing checked. */
  value?: string | null;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  /** Fixed column count from `sm` up (one column on phones). Omit to lay out cards yourself. */
  columns?: 1 | 2 | 3 | 4;
  /** Marks the choice as required (`aria-required`). */
  required?: boolean;
}

const COLUMNS: Record<NonNullable<RadioCardGroupProps["columns"]>, string> = {
  1: "grid grid-cols-1 gap-2",
  2: "grid grid-cols-1 gap-2 sm:grid-cols-2",
  3: "grid grid-cols-1 gap-2 sm:grid-cols-3",
  4: "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4",
};

export const RadioCardGroup = React.forwardRef<HTMLDivElement, RadioCardGroupProps>(
  (
    {
      value: controlledValue,
      defaultValue,
      onValueChange,
      disabled = false,
      columns,
      required,
      className,
      onKeyDown,
      children,
      ...props
    },
    ref
  ) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
    const isControlled = controlledValue !== undefined;
    const value = (isControlled ? controlledValue : uncontrolledValue) ?? undefined;

    // Registration order follows mount order; the DOM order (used for arrow keys) is read at
    // key-press time, so conditional cards still navigate in visual order.
    const [items, setItems] = React.useState<{ value: string; disabled: boolean }[]>([]);
    const register = React.useCallback((itemValue: string, itemDisabled: boolean) => {
      setItems((prev) => [
        ...prev.filter((i) => i.value !== itemValue),
        { value: itemValue, disabled: itemDisabled },
      ]);
      return () => setItems((prev) => prev.filter((i) => i.value !== itemValue));
    }, []);

    const enabledItems = items.filter((i) => !disabled && !i.disabled);
    const tabStop =
      value !== undefined && enabledItems.some((i) => i.value === value)
        ? value
        : enabledItems[0]?.value;

    const select = React.useCallback(
      (next: string) => {
        if (next === value) return;
        if (!isControlled) setUncontrolledValue(next);
        onValueChange?.(next);
      },
      [isControlled, onValueChange, value]
    );

    const groupRef = React.useRef<HTMLDivElement | null>(null);
    const setRefs = (el: HTMLDivElement | null) => {
      groupRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(e);
      if (e.defaultPrevented || !groupRef.current) return;
      const radios = Array.from(
        groupRef.current.querySelectorAll<HTMLButtonElement>('[data-slot="radio-card"]')
      ).filter((el) => !el.disabled);
      const position = radios.findIndex((el) => el === e.target);
      if (position === -1 || radios.length === 0) return;
      let next: number | null = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (position + 1) % radios.length;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
        next = (position - 1 + radios.length) % radios.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = radios.length - 1;
      if (next === null) return;
      e.preventDefault();
      const target = radios[next]!;
      target.focus();
      const nextValue = target.dataset.value;
      if (nextValue !== undefined) select(nextValue);
    };

    const context = React.useMemo<RadioCardGroupContextValue>(
      () => ({ value, select, disabled, tabStop, register }),
      [value, select, disabled, tabStop, register]
    );

    return (
      <RadioCardGroupContext.Provider value={context}>
        {/* oxlint-disable-next-line jsx-a11y/interactive-supports-focus -- roving focus lives on the radios */}
        <div
          ref={setRefs}
          role="radiogroup"
          aria-disabled={disabled || undefined}
          aria-required={required || undefined}
          data-slot="radio-card-group"
          className={cn(columns ? COLUMNS[columns] : undefined, className)}
          onKeyDown={handleKeyDown}
          {...props}
        >
          {children}
        </div>
      </RadioCardGroupContext.Provider>
    );
  }
);
RadioCardGroup.displayName = "RadioCardGroup";

export interface RadioCardProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "value" | "title" | "role" | "type"
> {
  value: string;
  /** Leading icon (16–20px). Takes the tint when checked. */
  icon?: React.ReactNode;
  /** Card title (`text-headline`). Use `children` for fully custom content. */
  title?: React.ReactNode;
  /** Secondary text (`text-footnote`). */
  description?: React.ReactNode;
  /** Show the radio dot in the top trailing corner (default true). */
  indicator?: boolean;
}

export const RadioCard = React.forwardRef<HTMLButtonElement, RadioCardProps>(
  (
    {
      value,
      icon,
      title,
      description,
      indicator = true,
      disabled,
      className,
      onClick,
      children,
      ...props
    },
    ref
  ) => {
    const group = React.useContext(RadioCardGroupContext);
    if (!group) throw new Error("RadioCard must be used inside a RadioCardGroup");
    const { register } = group;
    const isDisabled = group.disabled || !!disabled;
    React.useEffect(() => register(value, !!disabled), [register, value, disabled]);

    const checked = group.value === value;

    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={checked}
        tabIndex={group.tabStop === value ? 0 : -1}
        disabled={isDisabled}
        data-slot="radio-card"
        data-value={value}
        data-state={checked ? "checked" : "unchecked"}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) group.select(value);
        }}
        className={cn(
          "group/radio-card rounded-row relative flex w-full min-w-0 cursor-pointer items-start gap-3 border p-3 text-left",
          "ease-out-facet transition-[color,background-color,border-color,box-shadow] duration-150",
          "focus-visible:outline-tint outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked
            ? "border-tint bg-tint-fill ring-tint text-label ring-1"
            : "border-separator bg-surface text-label hover:bg-fill-4",
          className
        )}
        {...props}
      >
        {icon != null && icon !== false && (
          <span
            data-slot="radio-card-icon"
            aria-hidden
            className={cn(
              "flex shrink-0 items-center justify-center pt-0.5 [:where(&)_svg]:size-5",
              checked ? "text-tint" : "text-label-secondary"
            )}
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
            data-slot="radio-card-indicator"
            className={cn(
              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
              checked ? "border-tint bg-tint" : "border-label-tertiary bg-surface"
            )}
          >
            {checked && <span className="bg-on-tint size-1.5 rounded-full" />}
          </span>
        )}
      </button>
    );
  }
);
RadioCard.displayName = "RadioCard";
