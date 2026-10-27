"use client";

import React from "react";
import { Industry } from "iconoir-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Stat } from "~/components/ui/stat";
import { formatCompactCurrency } from "~/lib/utils/format-utils";
import type { OwnerDefense } from "~/hooks/useDefenseConsole";

/** Domestic industry: how much of its monthly capacity open orders use, and the newest design it can build. */
export const IndustryCard = React.memo(function IndustryCard({ overview }: { overview: OwnerDefense }) {
  const { procurement, policy } = overview;
  const used = procurement.capacityUsedMonthly;
  const capacity = procurement.capacityMonthly;
  const share = capacity > 0 ? Math.min(1, used / capacity) : 1;
  return (
    <Card content="data">
      <CardHeader className="p-5 pb-3">
        <CardTitle icon={<Industry />}>Domestic industry</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        <div className="space-y-2">
          <div className="text-callout flex justify-between gap-2">
            <span className="text-label-secondary">Production capacity in use</span>
            <span className="text-label tabular-nums">
              {formatCompactCurrency(used)} of {formatCompactCurrency(capacity)} a month
            </span>
          </div>
          <Progress value={share * 100} tone={share > 0.9 ? "warning" : "tint"} className="h-1.5" aria-label="Capacity in use" />
          <p className="text-label-secondary text-footnote">
            Domestic orders draw their cost spread over their lead time. Imports use none of it but
            cost 15% more and take half as long again.
            {policy.surging ? " A production surge is raising capacity." : ""}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Stat
            size="sm"
            label="Newest design it can build"
            value={Math.floor(procurement.accessibleYear)}
            hint="Newer designs must be imported"
          />
          <Stat
            size="sm"
            label="Realm's newest designs"
            value={Math.floor(procurement.frontierYear)}
            hint="Research closes the gap"
          />
        </div>
      </CardContent>
    </Card>
  );
});
