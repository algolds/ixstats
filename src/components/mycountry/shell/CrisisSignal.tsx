"use client";

import { api } from "~/trpc/react";
import { Signal } from "~/components/ui/signal";

/**
 * Crises affecting this nation as a persistent Signal at the top of the Overview (the old
 * dashboard player widget showed the same count). The query is scoped to the player's country, so
 * the count is the nation's, not the world's. Active crises of any age count; resolved ones never
 * do. Renders nothing while there are none; an active critical crisis escalates the tone. There is
 * no crisis view to link to yet, so the Signal only reports.
 */
export function CrisisSignal({ countryId }: { countryId: string }) {
  const { data } = api.crisisEvents.getStatistics.useQuery(
    { timeframe: "all", countryId },
    { enabled: !!countryId }
  );
  const active = data?.activeEvents ?? 0;
  if (active === 0) return null;
  const critical = (data?.activeCriticalEvents ?? 0) > 0;
  return (
    <Signal
      tone={critical ? "destructive" : "warning"}
      title={`${active} active ${active === 1 ? "crisis" : "crises"}`}
    >
      {critical ? "At least one is rated critical." : null}
    </Signal>
  );
}
