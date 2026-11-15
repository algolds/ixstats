"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Link as LinkIcon, NavArrowRight } from "iconoir-react";
import { Badge, type BadgeVariant } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { LensCard } from "~/components/ui/lens-card";
import { Skeleton } from "~/components/ui/skeleton";
import { withBasePath } from "~/lib/base-path";
import { ARCHETYPE_LABELS, SPORT_LABELS } from "~/lib/sports/theming";
import { LeagueCover } from "../LeagueCover";

export interface LeagueSummary {
  id: string;
  name: string;
  sportPreset: string;
  archetype: string;
  status: string;
  isCanonical: boolean;
  coverImage?: string | null;
  logo?: string | null;
  teamCount: number;
  seasonCount: number;
}

const STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  active: { label: "Active", variant: "success" },
  in_progress: { label: "In progress", variant: "success" },
  paused: { label: "Paused", variant: "warning" },
  completed: { label: "Completed", variant: "info" },
  archived: { label: "Archived", variant: "default" },
};

const plural = (count: number, one: string, many: string) =>
  `${count.toLocaleString()} ${count === 1 ? one : many}`;

/** The quiet line of facts under a competition's name: sport, format, size and age. */
export function leagueFacts(league: LeagueSummary): string {
  return [
    SPORT_LABELS[league.sportPreset] ?? league.sportPreset,
    ARCHETYPE_LABELS[league.archetype] ?? league.archetype,
    plural(league.teamCount, "team", "teams"),
    plural(league.seasonCount, "season", "seasons"),
    ...(league.isCanonical ? [] : ["Community made"]),
  ].join(" · ");
}

function StatusChip({ status }: { status: string }) {
  const known = STATUS[status];
  return <Badge variant={known?.variant ?? "default"}>{known?.label ?? status}</Badge>;
}

/** The link that makes its whole card the target; anything else in the card sits above it with `relative`. */
const STRETCHED_LINK = "outline-none after:absolute after:inset-0";
const CARD_FOCUS =
  "has-[[data-card-link]:focus-visible]:outline-tint has-[[data-card-link]:focus-visible]:outline-2 has-[[data-card-link]:focus-visible]:outline-offset-2";

function CopyInviteButton({ leagueId }: { leagueId: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const url = window.location.origin + withBasePath(`/myleague/${leagueId}`);
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  const label = copied ? "Invite link copied" : "Copy invite link";
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="relative shrink-0"
      onClick={copy}
      title={label}
      aria-label={label}
    >
      {copied ? <Check className="text-success" /> : <LinkIcon />}
    </Button>
  );
}

/** A competition in the browse grid. The card is the link; the invite button is the one control beside it. */
export function LeagueEntityCard({ league }: { league: LeagueSummary }) {
  return (
    <Card
      content="entity"
      interactive
      className={`group flex h-full flex-col overflow-hidden ${CARD_FOCUS}`}
    >
      <LeagueCover
        name={league.name}
        sportPreset={league.sportPreset}
        coverImage={league.coverImage}
        logo={league.logo}
        seed={league.id}
        className="h-36"
      />
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="text-headline text-label line-clamp-1">
          <Link data-card-link href={`/myleague/${league.id}`} className={STRETCHED_LINK}>
            {league.name}
          </Link>
        </h3>
        <p className="text-footnote text-label-secondary">{leagueFacts(league)}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <StatusChip status={league.status} />
          <CopyInviteButton leagueId={league.id} />
        </div>
      </div>
    </Card>
  );
}

/** The featured competition, on Lens glass above the grid. The page titles its section, so the card does not. */
export function FeaturedLeagueCard({ league }: { league: LeagueSummary }) {
  return (
    <LensCard
      content="entity"
      className={`group flex flex-col overflow-hidden md:flex-row ${CARD_FOCUS}`}
    >
      <LeagueCover
        name={league.name}
        sportPreset={league.sportPreset}
        coverImage={league.coverImage}
        logo={league.logo}
        seed={league.id}
        className="h-44 shrink-0 md:h-auto md:min-h-48 md:w-80"
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-5 md:p-6">
        <h3 className="text-title-1 text-label">
          <Link data-card-link href={`/myleague/${league.id}`} className={STRETCHED_LINK}>
            {league.name}
          </Link>
        </h3>
        <p className="text-callout text-label-secondary">{leagueFacts(league)}</p>
        <div className="flex items-center justify-between gap-3 pt-2">
          <StatusChip status={league.status} />
          <span className="text-footnote text-label-secondary group-hover:text-label duration-fast inline-flex items-center gap-0.5 transition-colors">
            Open
            <NavArrowRight aria-hidden className="size-4" />
          </span>
        </div>
      </div>
    </LensCard>
  );
}

export function LeagueEntityCardSkeleton() {
  return (
    <Card className="overflow-hidden" aria-hidden>
      <Skeleton className="h-36 w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="mt-3 h-5 w-16 rounded-full" />
      </div>
    </Card>
  );
}

export function FeaturedLeagueCardSkeleton() {
  return (
    <LensCard className="flex flex-col overflow-hidden md:flex-row" aria-hidden>
      <Skeleton className="h-44 w-full shrink-0 rounded-none md:h-48 md:w-80" />
      <div className="flex flex-1 flex-col justify-center gap-3 p-5 md:p-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </LensCard>
  );
}
