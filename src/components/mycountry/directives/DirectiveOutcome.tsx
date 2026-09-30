"use client";

import React from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { EffectList, type EffectItem } from "./EffectList";
import { ledgerToEffect, gdpShiftToEffect } from "./directive-model";

/**
 * What a directive actually changed, read from the ledger (`intent.getOutcome`): the bounded
 * stat changes the CountryEventSpine recorded and the GDP level effect, never a re-projection.
 */
export function DirectiveOutcome({ intentId }: { intentId: string }) {
  const outcome = api.intent.getOutcome.useQuery({ intentId }, { staleTime: 60_000 });

  if (outcome.isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    );
  }
  if (outcome.error) {
    return (
      <p className="text-muted-foreground text-sm">
        Recorded effects could not be loaded.{" "}
        <Button
          variant="link"
          size="xs"
          onClick={() => void outcome.refetch()}
          className="text-foreground h-auto px-0 underline"
        >
          Try again
        </Button>
      </p>
    );
  }

  const items: EffectItem[] = (outcome.data?.ledger ?? []).map(ledgerToEffect);
  for (const e of outcome.data?.gdpEffects ?? []) {
    items.push({
      ...gdpShiftToEffect(e.value, e.duration ?? 1, e.id),
      caption: e.isActive
        ? `Phasing in over ${e.duration ?? 1} IxTime year${(e.duration ?? 1) === 1 ? "" : "s"}, then kept`
        : "Effect ended",
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No stat changes were recorded. This directive worked through the budget and public
        signalling only, or predates effect tracking.
      </p>
    );
  }
  return <EffectList items={items} />;
}
