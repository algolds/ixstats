"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { Signal } from "~/components/ui/signal";

/**
 * Crises affecting this nation as a persistent Signal at the top of the Overview (the old
 * dashboard player widget showed the same count). The query is scoped to the player's country, so
 * the count is the nation's, not the world's. Renders nothing while there are none; critical
 * crises escalate the tone.
 */
export function CrisisSignal({ countryId }: { countryId: string }) {
  const { data } = api.crisisEvents.getStatistics.useQuery(
    { timeframe: "month", countryId },
    { enabled: !!countryId }
  );
  const active = data?.activeEvents ?? 0;
  if (active === 0) return null;
  const critical = (data?.criticalEvents ?? 0) > 0;
  return (
    <Signal
      tone={critical ? "destructive" : "warning"}
      title={`${active} active ${active === 1 ? "crisis" : "crises"}`}
    >
      {critical ? "At least one is rated critical. " : null}
      <Link href="/mycountry/executive" className="text-tint underline underline-offset-2">
        Review in Directives
      </Link>
    </Signal>
  );
}
