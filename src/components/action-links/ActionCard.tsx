"use client";

import { memo } from "react";
import { BadgeCheck } from "iconoir-react";
import { Card } from "~/components/ui/card";
import { useNationClockFor } from "~/hooks/useNationClock";
import { formatStampAsClockDate } from "~/lib/realms/nation-time";
import type { RouterOutputs } from "~/trpc/react";

export type ActionCardData = RouterOutputs["actionLinks"]["activityCards"][number];

/**
 * A post's embedded `[ixaction=<id>]` as a card; `null` means the action is missing or not public. The action is
 * dated on its nation's realm clock, in its calendar.
 */
export const ActionCardView = memo(function ActionCardView({
  card,
}: {
  card: ActionCardData | null;
}) {
  const clock = useNationClockFor(card?.country ?? null);
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
          {formatStampAsClockDate(card.createdAt, card.country ? clock : null)}
        </p>
      </div>
    </Card>
  );
});
