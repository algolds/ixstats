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
  onCommitted,
}: {
  countryId: string;
  onCommitted: (res: any) => void;
}) {
  const { data: status } = api.intent.getStatus.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const canCommit = status?.canCommit ?? true;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Command className="h-4 w-4 text-amber-500" />
          <h2 className="text-foreground text-lg font-bold tracking-tight">
            What is your government trying to do?
          </h2>
        </div>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-[10px] font-bold tracking-wider uppercase",
            canCommit
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-amber-500/30 bg-amber-500/10 text-amber-400"
          )}
        >
          {canCommit
            ? "Directive slot available"
            : `Cooldown — ${status?.usedThisWeek ?? 0}/${status?.cap ?? 0} this week`}
        </span>
      </div>

      <FacetCard depth={1} className="bg-card/30 p-4 backdrop-blur-md">
        <IntentComposer countryId={countryId} onCommitted={onCommitted} />
      </FacetCard>
    </div>
  );
}