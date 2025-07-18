"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

const TabsContext = React.createContext<{
  value: string;
  setValue: (value: string) => void;
} | null>(null);

export function Tabs({
  value: controlledValue,
  defaultValue,
  onValueChange,
  className,
  children,
  ...props
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue || "");
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const setValue = React.useCallback(
    (v: string) => {
      if (!isControlled) setUncontrolledValue(v);
      onValueChange?.(v);
    },
    [isControlled, onValueChange]
  );

  React.useEffect(() => {
    if (!value && defaultValue) setUncontrolledValue(defaultValue);
  }, [defaultValue]);

  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}
export function TabsList({ className, ...props }: TabsListProps) {
  return <div className={cn("flex", className)} {...props} />;
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}
export function TabsTrigger({ value, className, children, ...props }: TabsTriggerProps) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger must be used within Tabs");
  const isActive = ctx.value === value;
  return (
    <button
      type="button"
      className={cn(
        "px-4 py-2 rounded-full transition-colors",
        isActive ? "bg-gray-200 dark:bg-zinc-800 text-black dark:text-white" : "bg-transparent text-gray-500 dark:text-gray-400",
        className
      )}
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={() => ctx.setValue(value)}
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
    <div className={cn("w-full", className)} {...props}>
      {children}
    </div>
  );
}
