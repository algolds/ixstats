"use client";

import { memo } from "react";
import { BadgeCheck } from "iconoir-react";
import { Card } from "~/components/ui/card";
import { IxTime } from "~/lib/ixtime";
import { api } from "~/trpc/react";

/** A post's embedded `[ixaction=<id>]`: the linked ActivityFeed entry, verified at post time. */
// ponytail: one query per card until a post renders many; the forum post renderer can batch ids.
export const ActionCard = memo(function ActionCard({ activityId }: { activityId: string }) {
  const { data, isLoading } = api.actionLinks.activityCards.useQuery({ ids: [activityId] });
  if (isLoading) return null;
  const action = data?.[0];
  if (!action) return <span className="text-label-secondary text-sm">Unverified action</span>;
  return (
    <Card content="entity" className="flex items-start gap-3 p-3">
      <BadgeCheck aria-label="Verified action" className="text-tint mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">
        <p className="text-label font-medium">{action.title}</p>
        <p className="text-label-secondary text-sm">
          {action.country ? <span>{action.country.name}</span> : null}
          {action.country ? " · " : null}
          {action.type}
          {" · "}
          {IxTime.formatIxTime(IxTime.convertToIxTime(new Date(action.createdAt).getTime()))}
        </p>
      </div>
    </Card>
  );
});
