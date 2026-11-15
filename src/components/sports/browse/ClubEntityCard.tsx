"use client";

import Link from "next/link";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { TeamCrest } from "../TeamCrest";

export interface ClubSummary {
  id: string;
  name: string;
  logo?: string | null;
  color?: string | null;
  stadiumCapacity?: number | null;
  league?: { name: string } | null;
  currentStandings?: {
    position?: number | null;
    wins?: number | null;
    losses?: number | null;
    draws?: number | null;
  } | null;
  form?: string[];
}

const FORM: Record<string, { className: string; label: string }> = {
  W: { className: "bg-green text-on-green", label: "Win" },
  L: { className: "bg-red text-on-red", label: "Loss" },
  D: { className: "bg-yellow text-on-yellow", label: "Draw" },
};

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** The quiet line of facts under a club's name: league position, record and stadium size. */
export function clubFacts(club: ClubSummary): string {
  const standing = club.currentStandings;
  const facts: string[] = [];
  if (standing?.position) facts.push(`${ordinal(standing.position)} place`);
  if (standing) {
    const draws = standing.draws ?? 0;
    facts.push(`${standing.wins ?? 0}-${standing.losses ?? 0}${draws > 0 ? `-${draws}` : ""}`);
  }
  facts.push(`${(club.stadiumCapacity ?? 5000).toLocaleString()} seats`);
  return facts.join(" · ");
}

const CARD_FOCUS =
  "has-[[data-card-link]:focus-visible]:outline-tint has-[[data-card-link]:focus-visible]:outline-2 has-[[data-card-link]:focus-visible]:outline-offset-2";

/** A managed club. The card opens the club; "Roster" is the one shortcut beside it. */
export function ClubEntityCard({ club }: { club: ClubSummary }) {
  const form = (club.form ?? []).slice(0, 5);
  return (
    <Card content="entity" interactive padding="md" className={cn("group h-full", CARD_FOCUS)}>
      <div className="flex items-center gap-3">
        <div className="bg-tint-fill text-tint-ink rounded-row flex size-14 shrink-0 items-center justify-center p-2">
          <TeamCrest src={club.logo} alt="" color={club.color ?? undefined} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-headline text-label truncate">
            <Link
              data-card-link
              href={`/myclub/${club.id}`}
              className="outline-none after:absolute after:inset-0"
            >
              {club.name}
            </Link>
          </h3>
          <p className="text-footnote text-label-secondary truncate">
            {club.league?.name ?? "Independent"}
          </p>
        </div>
      </div>

      <p className="text-footnote text-label-secondary mt-3 tabular-nums">{clubFacts(club)}</p>

      <div className="mt-3 flex min-h-6 items-center justify-between gap-3">
        {form.length > 0 ? (
          <ol aria-label="Recent form, latest first" className="flex items-center gap-1">
            {form.map((result, i) => (
              <li
                key={i}
                aria-label={FORM[result]?.label ?? result}
                className={cn(
                  "text-caption rounded-control-sm flex size-6 items-center justify-center",
                  FORM[result]?.className ?? "bg-fill-3 text-label-secondary"
                )}
              >
                {result}
              </li>
            ))}
          </ol>
        ) : (
          <span className="text-footnote text-label-tertiary">No matches played</span>
        )}
        <Link
          href={`/myclub/${club.id}?tab=roster`}
          className="text-footnote text-label-secondary hover:text-label focus-visible:outline-tint rounded-control-sm duration-fast relative transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Roster
        </Link>
      </div>
    </Card>
  );
}

export function ClubEntityCardSkeleton() {
  return (
    <Card padding="md" aria-hidden>
      <div className="flex items-center gap-3">
        <Skeleton className="rounded-row size-14" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <Skeleton className="mt-3 h-4 w-3/5" />
      <Skeleton className="mt-3 h-6 w-32" />
    </Card>
  );
}
