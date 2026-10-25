"use client";

import React from "react";
import type { FundingReport } from "~/lib/military/model";
import { formatCount, formatPercent } from "../forces/force-fields";

interface FundingPreviewProps {
  title: string;
  funding: FundingReport;
  /** The funding now, to compare a draft against; null when showing the funding now. */
  current: FundingReport | null;
  /** Active personnel today. */
  active: number;
}

function Row({ label, value, was }: { label: string; value: string; was?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-label-secondary text-callout">{label}</dt>
      <dd className="text-label text-callout text-right tabular-nums">
        {value}
        {was && was !== value && (
          <span className="text-label-secondary text-footnote ml-2">now {was}</span>
        )}
      </dd>
    </div>
  );
}

/** What a budget split or manpower model buys: headcount the pay supports, and how much of upkeep is funded. */
export const FundingPreview = React.memo(function FundingPreview({
  title,
  funding,
  current,
  active,
}: FundingPreviewProps) {
  return (
    <section aria-label={title} className="bg-fill-4 rounded-row px-4 py-3">
      <h4 className="text-subhead text-label mb-1 font-medium">{title}</h4>
      <dl className="divide-separator divide-y">
        <Row
          label="Personnel pay supports"
          value={formatCount(funding.headcountAfford)}
          was={current && formatCount(current.headcountAfford)}
        />
        <Row
          label="Strength the force moves toward"
          value={formatCount(funding.headcountTarget)}
          was={current ? formatCount(current.headcountTarget) : formatCount(active)}
        />
        <Row
          label="Maintenance funded"
          value={`${formatPercent(funding.maintenanceFunding)} of need`}
          was={current && `${formatPercent(current.maintenanceFunding)} of need`}
        />
        <Row
          label="Training funded"
          value={`${formatPercent(funding.trainingFunding)} of need`}
          was={current && `${formatPercent(current.trainingFunding)} of need`}
        />
        <Row
          label="Reserve refresher training funded"
          value={formatPercent(funding.reserveFunding)}
          was={current && formatPercent(current.reserveFunding)}
        />
      </dl>
      {funding.headcountTarget < funding.headcountAfford - 1 && (
        <p className="text-label-secondary text-footnote mt-2">
          Pay could support more, but the manpower pool limits recruiting. A mixed or conscript
          model, or longer service, enlarges the pool.
        </p>
      )}
    </section>
  );
});
