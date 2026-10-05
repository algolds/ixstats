"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { Signal } from "~/components/ui/signal";

/**
 * Active crises as a persistent Signal at the top of the Overview (the old dashboard player widget
 * showed the same count). Renders nothing while there are none. Critical crises escalate the tone.
 */
export function CrisisSignal() {
  const { data } = api.crisisEvents.getStatistics.useQuery({ timeframe: "month" });
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
