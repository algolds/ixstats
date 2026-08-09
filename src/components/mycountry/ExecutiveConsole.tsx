"use client";

import { Command } from "lucide-react";
import { api } from "~/trpc/react";
import { IntentComposer } from "../primitives/IntentComposer";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";

/**
 * EXECUTIVE mode — the Console.
 * The player states a goal in plain language; the government returns
 * Measured / Moderate / Extreme packages (see intent router). This is the
 * primary action surface of v2, replacing war-rooms/command-panels.
 */
export function V2Console({
  countryId,
  initialGoal,
  onCommitted,
}: {
  countryId: string;
  initialGoal?: string;
  onCommitted: (res: any) => void;
}) {
  return (
    <FacetCard depth={1} className="bg-card/40 border-border/40 w-full p-5 backdrop-blur-xl">
      <IntentComposer countryId={countryId} initialGoal={initialGoal} onCommitted={onCommitted} />
    </FacetCard>
  );
}
