"use client";

import React from "react";
import { Shield } from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Stat } from "~/components/ui/stat";
import type { RealmClockReader } from "~/lib/realms/realm-clock";
import { formatCompactCurrency } from "~/lib/utils/format-utils";
import { pendingAlert } from "~/lib/military/defense-console";
import type { OwnerDefense } from "~/hooks/useDefenseConsole";
import { ALERT_COPY, BUDGET_SOURCE_COPY, DOCTRINE_COPY } from "../defense-copy";
import { formatCount } from "../forces/force-fields";
import { formatWhen } from "../clock-text";

interface NationalForceCardProps {
  overview: OwnerDefense;
  reader: RealmClockReader | null;
  nowClockMs: number;
}

const sum = (rows: readonly OwnerDefense["branches"][number][], pick: (b: OwnerDefense["branches"][number]) => number) =>
  rows.reduce((total, b) => total + pick(b), 0);

function frontierText(lagYears: number) {
  if (lagYears < 0.05) return "At the frontier";
  return `${lagYears.toFixed(1)} years behind`;
}

/** The nation's force in one card: strength, people, money, posture, and the human and technology factors. */
export const NationalForceCard = React.memo(function NationalForceCard({
  overview,
  reader,
  nowClockMs,
}: NationalForceCardProps) {
  const { branches, policy, budget } = overview;
  const active = sum(branches, (b) => b.active);
  const mobilised = sum(branches, (b) => b.mobilised);
  const reserves = sum(branches, (b) => b.reserves);
  const pending = pendingAlert(policy);

  return (
    <Card content="data">
      <CardHeader className="p-5 pb-3">
        <CardTitle icon={<Shield />}>National force</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-4 gap-y-5 px-5 pb-5 sm:grid-cols-3">
        <Stat
          label="Combat power"
          value={formatCount(overview.combatPower)}
          hint={`Across ${branches.length} ${branches.length === 1 ? "branch" : "branches"}`}
        />
        <Stat
          label="Active personnel"
          value={formatCount(active + mobilised)}
          hint={
            mobilised > 0
              ? `${formatCount(mobilised)} mobilised reservists`
              : `${formatCount(reserves)} in reserve`
          }
        />
        <Stat
          label="Defense burden"
          value={`${(budget.burden * 100).toFixed(1)}% of GDP`}
          hint={`${formatCompactCurrency(budget.annual)} a year. ${BUDGET_SOURCE_COPY[budget.source]}.`}
        />
        <Stat
          label="Alert in effect"
          value={ALERT_COPY[policy.alertInEffect].label}
          hint={
            pending
              ? `${ALERT_COPY[pending.level].label} from ${formatWhen(pending.effectiveAtClockMs, nowClockMs, reader)}`
              : ALERT_COPY[policy.alertInEffect].detail
          }
        />
        <Stat
          label="Doctrine"
          value={DOCTRINE_COPY[policy.doctrine].label}
          hint={DOCTRINE_COPY[policy.doctrine].detail}
        />
        <Stat
          label="Human factor"
          value={`×${overview.cev.toFixed(2)}`}
          hint="Combat effectiveness against your realm's average nation (CEV)"
        />
        <Stat
          label="Technology"
          value={frontierText(overview.frontierLagYears)}
          hint="Your industry's lag behind the realm's newest designs. Research narrows it."
        />
        {overview.mobilisationSupplement > 0 && (
          <Stat
            label="Emergency supplement"
            value={`${formatCompactCurrency(overview.mobilisationSupplement)} a year`}
            hint="Pay for mobilised reservists, outside the defense budget"
          />
        )}
      </CardContent>
    </Card>
  );
});
