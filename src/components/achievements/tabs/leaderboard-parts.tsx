"use client";

import React from "react";
import { Crown, Medal, Trophy as Award } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { FacetRow } from "~/components/ui/facet-list";
import { Card } from "~/components/ui/card";

const PODIUM = {
  1: { icon: Crown, label: "Gold champion", badge: "warning" },
  2: { icon: Medal, label: "Silver runner-up", badge: "default" },
  3: { icon: Award, label: "Bronze podium", badge: "warning" },
} as const;

export function PodiumCard({
  rank,
  name,
  primary,
  secondary,
  lead,
}: {
  rank: 1 | 2 | 3;
  name: string;
  primary: string;
  secondary: string;
  /** A flag or avatar before the name. */
  lead?: React.ReactNode;
}) {
  const podium = PODIUM[rank];
  const Icon = podium.icon;

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={podium.badge} className="tabular-nums">
            #{rank}
          </Badge>
          <span className="text-label-secondary text-footnote">{podium.label}</span>
        </div>
        <Icon aria-hidden className="text-label-secondary size-5" />
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {lead}
          <div className="text-label text-title-3 truncate">{name}</div>
        </div>
        <div className="text-label text-title-1 tabular-nums">{primary}</div>
        <div className="text-label-secondary text-footnote">{secondary}</div>
      </div>
    </Card>
  );
}

export function Row({
  rank,
  name,
  primary,
  secondary,
  lead,
  trailingBadge,
}: {
  rank: number;
  name: string;
  primary: string;
  secondary: string;
  /** A flag or avatar after the rank. */
  lead?: React.ReactNode;
  /** A marker after the figure, such as "You". */
  trailingBadge?: React.ReactNode;
}) {
  return (
    <FacetRow
      leading={
        <span className="flex items-center gap-3">
          <span
            className={cn(
              "text-headline w-7 text-center tabular-nums",
              rank <= 3 ? "text-label" : "text-label-secondary"
            )}
          >
            {rank}
          </span>
          {lead}
        </span>
      }
      title={name}
      subtitle={secondary}
      trailing={
        <span className="flex items-center gap-2">
          {trailingBadge}
          <span className="text-headline text-label tabular-nums">{primary}</span>
        </span>
      }
    />
  );
}
