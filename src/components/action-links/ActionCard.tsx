"use client";

import { memo } from "react";
import { BadgeCheck } from "iconoir-react";
import { Card } from "~/components/ui/card";
import { IxTime } from "~/lib/ixtime";
import type { RouterOutputs } from "~/trpc/react";

export type ActionCardData = RouterOutputs["actionLinks"]["activityCards"][number];

/** A post's embedded `[ixaction=<id>]` as a card; `null` means the action is missing or not public. */
export const ActionCardView = memo(function ActionCardView({
  card,
}: {
  card: ActionCardData | null;
}) {
  if (!card) return <span className="text-label-secondary text-sm">Unverified action</span>;
  return (
    <Card content="entity" className="flex items-start gap-3 p-3">
      <BadgeCheck aria-label="Verified action" className="text-tint mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">
        <p className="text-label font-medium">{card.title}</p>
        <p className="text-label-secondary text-sm">
          {card.country ? <span>{card.country.name}</span> : null}
          {card.country ? " · " : null}
          {card.type}
          {" · "}
          {IxTime.formatIxTime(IxTime.convertToIxTime(new Date(card.createdAt).getTime()))}
        </p>
      </div>
    </Card>
  );
});
