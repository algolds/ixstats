"use client";

import * as React from "react";
import { cn } from "~/lib/utils/cn";

/**
 * Tabs (spec §7.2): page-level section switching only. Implements the WAI-ARIA tabs pattern —
 * `tablist` / `tab` / `tabpanel`, `aria-selected`, `aria-controls` ↔ `aria-labelledby`, a roving
 * tab stop and automatic activation with the arrow, Home and End keys. For a choice between 2–5
 * peer views inside a page, use `SegmentedControl`.
 */

type Orientation = "horizontal" | "vertical";

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
  orientation: Orientation;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

/** DOM-safe id fragment for a tab value. */
function idPart(value: string) {
  return value.replace(/[^\w-]/g, "_");
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Arrow keys follow the orientation (Left/Right or Up/Down). @default "horizontal" */
  orientation?: Orientation;
}

export function Tabs({
  value: controlledValue,
  defaultValue,
  onValueChange,
  orientation = "horizontal",
  className,
  children,
  ...props
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue || "");
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;
  const baseId = React.useId();

  const setValue = React.useCallback(
    (v: string) => {
      if (!isControlled) setUncontrolledValue(v);
      onValueChange?.(v);
    },
    [isControlled, onValueChange]
  );

  React.useEffect(() => {
    if (!value && defaultValue) setUncontrolledValue(defaultValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue]);

  const ctx = React.useMemo(
    () => ({ value, setValue, baseId, orientation }),
    [value, setValue, baseId, orientation]
  );

  return (
    <TabsContext.Provider value={ctx}>
      <div
        data-slot="tabs"
        data-orientation={orientation}
        className={cn("w-full", className)}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

const PREV_KEYS: Record<Orientation, string> = { horizontal: "ArrowLeft", vertical: "ArrowUp" };
const NEXT_KEYS: Record<Orientation, string> = { horizontal: "ArrowRight", vertical: "ArrowDown" };

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}
export function TabsList({ className, onKeyDown, ...props }: TabsListProps) {
  const ctx = React.useContext(TabsContext);
  const orientation = ctx?.orientation ?? "horizontal";

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || !ctx) return;
    const list = e.currentTarget;
    const tabs = Array.from(
      list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)')
    ).filter((tab) => tab.closest('[role="tablist"]') === list);
    const current = tabs.indexOf(e.target as HTMLButtonElement);
    if (current === -1 || tabs.length === 0) return;

    let next: number | null = null;
    if (e.key === NEXT_KEYS[orientation]) next = (current + 1) % tabs.length;
    else if (e.key === PREV_KEYS[orientation]) next = (current - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next === null) return;

    e.preventDefault();
    const target = tabs[next]!;
    target.focus();
    const nextValue = target.dataset.value;
    if (nextValue !== undefined && nextValue !== ctx.value) ctx.setValue(nextValue);
  };

  return (
    // The tabs carry focus (roving tab stop), not the tablist itself (WAI-ARIA tabs pattern).
    // oxlint-disable-next-line jsx-a11y/interactive-supports-focus
    <div
      role="tablist"
      aria-orientation={orientation}
      data-slot="tabs-list"
      data-orientation={orientation}
      className={cn("flex", orientation === "vertical" && "flex-col", className)}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}
export function TabsTrigger({
  value,
  className,
  children,
  onClick,
  disabled,
  ...props
}: TabsTriggerProps) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger must be used within Tabs");
  const isActive = ctx.value === value;
  // Roving tab stop: the selected tab; if nothing is selected yet, every tab stays reachable.
  const isTabStop = isActive || !ctx.value;
  return (
    <button
      type="button"
      role="tab"
      id={`${ctx.baseId}-tab-${idPart(value)}`}
      aria-controls={`${ctx.baseId}-panel-${idPart(value)}`}
      aria-selected={isActive}
      tabIndex={isTabStop ? 0 : -1}
      disabled={disabled}
      data-slot="tabs-trigger"
      data-value={value}
      data-state={isActive ? "active" : "inactive"}
      data-disabled={disabled ? "" : undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-body font-medium whitespace-nowrap",
        "transition-[color,background-color,box-shadow,transform] duration-150 ease-out-facet active:scale-[0.98] motion-reduce:active:scale-100",
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-tint",
        "disabled:pointer-events-none disabled:opacity-50",
        isActive
          ? "bg-surface text-label shadow-card"
          : "text-label-secondary hover:bg-fill-4 hover:text-label bg-transparent",
        className
      )}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) ctx.setValue(value);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}
export function TabsContent({ value, className, children, ...props }: TabsContentProps) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent must be used within Tabs");
  if (ctx.value !== value) return null;
  return (
    <div
      role="tabpanel"
      id={`${ctx.baseId}-panel-${idPart(value)}`}
      aria-labelledby={`${ctx.baseId}-tab-${idPart(value)}`}
      tabIndex={0}
      data-slot="tabs-content"
      data-state="active"
      className={cn(
        "w-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-tint",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
