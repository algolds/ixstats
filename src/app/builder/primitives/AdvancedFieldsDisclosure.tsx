"use client";

import React, { useState, useSyncExternalStore } from "react";
import { Settings, NavArrowDown } from "iconoir-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";
import { shouldAutoOpenAdvanced, type FieldValue } from "~/app/builder/lib/field-importance";

const STORAGE_PREFIX = "builder-advanced:";

function readRemembered(key: string): boolean | null {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? null : stored === "open";
  } catch {
    return null;
  }
}

function remember(key: string, open: boolean): void {
  try {
    window.localStorage.setItem(key, open ? "open" : "closed");
  } catch {
    // Storage unavailable: the choice simply is not remembered.
  }
}

function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

interface AdvancedFieldsDisclosureProps<K extends string> {
  /** FIELD_IMPORTANCE section the wrapped fields belong to. */
  section: string;
  /** Distinguishes disclosures within a section; part of the remembered-state key. */
  id: string;
  /** Current values of the fields inside the disclosure. */
  values: Readonly<Record<K, FieldValue>>;
  /** Baseline values; a field that differs from its default counts as filled. */
  defaults?: Readonly<Partial<Record<NoInfer<K>, FieldValue>>>;
  /** Fields with a validation error. */
  errorFields?: readonly string[];
  /** Open state when the user has never toggled this disclosure (e.g. expert mode). */
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * "Show advanced options" disclosure for builder forms. Collapsed by default,
 * remembers the user's choice per section, and opens by itself whenever an
 * advanced field has a validation error or a non-default value.
 */
export function AdvancedFieldsDisclosure<K extends string>({
  section,
  id,
  values,
  defaults,
  errorFields,
  defaultOpen = false,
  className,
  children,
}: AdvancedFieldsDisclosureProps<K>) {
  const storageKey = `${STORAGE_PREFIX}${section}:${id}`;
  const remembered = useSyncExternalStore(
    subscribeToStorage,
    () => readRemembered(storageKey),
    () => null
  );
  const autoOpen = shouldAutoOpenAdvanced(section, values, { defaults, errorFields });

  const [choice, setChoice] = useState<boolean | null>(null);
  const [prevAutoOpen, setPrevAutoOpen] = useState(autoOpen);
  if (autoOpen !== prevAutoOpen) {
    // A new error or value opens the disclosure; losing one never collapses it mid-edit.
    setPrevAutoOpen(autoOpen);
    setChoice(autoOpen || (choice ?? true));
  }

  const open = choice ?? (autoOpen || (remembered ?? defaultOpen));

  const handleOpenChange = (next: boolean) => {
    setChoice(next);
    remember(storageKey, next);
  };

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange} className={className}>
      <CollapsibleTrigger
        data-cuelume-press="toggle"
        data-cuelume-hover="tick"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex items-center gap-1.5 rounded-md text-xs font-semibold transition-[color,transform] active:scale-[0.98] focus-visible:ring-2 focus-visible:outline-none"
      >
        <Settings className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{open ? "Hide advanced options" : "Show advanced options"}</span>
        <NavArrowDown
          className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")}
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
