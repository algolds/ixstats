"use client";

import { Command } from "lucide-react";
import { api } from "~/trpc/react";
import { IntentComposer } from "~/components/mycountry/shared/primitives/IntentComposer";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";

/**
 * EXECUTIVE mode — the Console.
 * The player states a goal in plain language; the government returns
 * Measured / Moderate / Extreme packages (see intent router). This is the
 * primary action surface of v2, replacing war-rooms/command-panels.
 */
export interface ExecutiveConsoleProps {
  countryId: string;
  initialGoal?: string;
  onDone?: (msg?: string) => void;
  onCommitted?: (res: any) => void;
}

export type V2ConsoleProps = ExecutiveConsoleProps;

export function ExecutiveConsole({
  countryId,
  initialGoal,
  onDone,
  onCommitted,
}: ExecutiveConsoleProps) {
  return (
    <FacetCard depth={1} className="bg-card/40 border-border/40 w-full p-5 backdrop-blur-xl">
      <IntentComposer
        countryId={countryId}
        initialGoal={initialGoal}
        onCommitted={(res: any) => {
          onCommitted?.(res);
          onDone?.(res?.summary ?? "Directive committed.");
        }}
      />
    </FacetCard>
  );
}

export const V2Console = ExecutiveConsole;
