"use client";

import type { ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

/**
 * An inline term whose explanation opens on click or tap. A popover, not a hover card: hover cards
 * open on focus (a dialog's first focus would pop one unasked) and ignore touch.
 */
export function GlossaryTerm({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger className="text-label-secondary focus-visible:outline-tint cursor-help font-semibold underline decoration-dotted focus-visible:outline-2">
        {label}
      </PopoverTrigger>
      <PopoverContent className="w-72">{children}</PopoverContent>
    </Popover>
  );
}
