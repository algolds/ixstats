import * as React from "react";
import { cn } from "~/lib/utils/cn";

interface EntityHeaderProps {
  /** Identity art: flag, emblem or portrait. The one place identity art is allowed. */
  art?: React.ReactNode;
  name: React.ReactNode;
  /** Short facts under the name (government, capital, founded). */
  facts?: React.ReactNode;
  /** At most one primary action. */
  action?: React.ReactNode;
  className?: string;
}

/** The header of an entity page (country, person, organisation), on the canvas with no card around it. */
export function EntityHeader({ art, name, facts, action, className }: EntityHeaderProps) {
  return (
    <header data-content="entity" className={cn("flex items-end gap-4 py-4", className)}>
      {art != null && <div className="shrink-0">{art}</div>}
      <div className="min-w-0 flex-1">
        <h1 className="text-large-title text-label truncate">{name}</h1>
        {facts != null && <div className="text-callout text-label-secondary mt-1">{facts}</div>}
      </div>
      {action != null && <div className="shrink-0">{action}</div>}
    </header>
  );
}
