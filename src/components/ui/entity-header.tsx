import * as React from "react";
import { cn } from "~/lib/utils/cn";

interface EntityHeaderProps {
  /** Identity art: flag, emblem or portrait. The one place identity art is allowed. */
  art?: React.ReactNode;
  name: React.ReactNode;
  /** One sentence saying what the entity is, when the name alone does not. */
  description?: React.ReactNode;
  /** Short facts under the name (government, capital, founded). */
  facts?: React.ReactNode;
  /** At most one primary action. */
  action?: React.ReactNode;
  className?: string;
}

/** The header of an entity page (country, person, organisation), on the canvas with no card around it. */
export function EntityHeader({
  art,
  name,
  description,
  facts,
  action,
  className,
}: EntityHeaderProps) {
  return (
    <header data-content="entity" className={cn("flex flex-wrap items-end gap-4 py-4", className)}>
      {art != null && <div className="shrink-0">{art}</div>}
      {/* The basis lets the action wrap under the name on narrow screens instead of squeezing it. */}
      <div className="min-w-0 flex-1 basis-60">
        <h1 className="text-large-title text-label truncate">{name}</h1>
        {description != null && (
          <p className="text-body text-label-secondary mt-1 max-w-[70ch]">{description}</p>
        )}
        {facts != null && <div className="text-callout text-label-secondary mt-1">{facts}</div>}
      </div>
      {action != null && <div className="shrink-0">{action}</div>}
    </header>
  );
}
