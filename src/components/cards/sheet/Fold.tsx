"use client";

import type { ReactNode } from "react";
import { NavArrowDown } from "iconoir-react";
import { cn } from "~/lib/utils/cn";
import { focusRing } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";

interface FoldProps {
  id: string;
  title: string;
  /** Beside the heading, outside it, so it stays out of the section's name. */
  aside?: ReactNode;
  children: ReactNode;
}

/** A section folded under its heading until opened: the sheet's Trail, Price history and Mint. */
export function Fold({ id, title, aside, children }: FoldProps) {
  return (
    <Collapsible asChild>
      <section aria-labelledby={id} className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 id={id} className="text-headline min-w-0 flex-1">
            <CollapsibleTrigger
              className={cn("group flex w-full items-center justify-between rounded-sm", focusRing)}
            >
              {title}
              <NavArrowDown
                aria-hidden
                className="text-label-secondary size-4 transition-transform group-data-[state=open]:rotate-180"
              />
            </CollapsibleTrigger>
          </h3>
          {aside}
        </div>
        <CollapsibleContent className="space-y-3">{children}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}
