"use client";

import Link from "next/link";
import { Trophy } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";

interface MarginRaceChipProps {
  isAuthenticated: boolean;
  /** The drawer is open: neither read runs while it is closed. */
  enabled: boolean;
}

interface Standing {
  user: string;
  score: number;
}

interface MyPlace {
  rank: number;
  score: number;
}

const pts = (score: number) => `${score.toLocaleString()} pts`;

function raceText(leader: Standing | undefined, mine: MyPlace | null): string {
  if (mine?.rank === 1) return `Today's race: you lead with ${pts(mine.score)}`;
  if (!leader) return "Today's race: no scoring edits yet";
  if (mine) {
    return `Today's race: you #${mine.rank} · ${pts(mine.score)} · leader ${leader.user} ${pts(leader.score)}`;
  }
  return `Today's race: ${leader.user} leads with ${pts(leader.score)}`;
}

/** Today's Loreward race in a line: the viewer's place and the leader, linking to the Lorewards page. */
export function MarginRaceChip({ isAuthenticated, enabled }: MarginRaceChipProps) {
  const race = api.lorewards.getTodayRace.useQuery(undefined, { enabled, staleTime: 5 * 60_000 });
  const myRace = api.lorewards.getMyRace.useQuery(undefined, {
    enabled: enabled && isAuthenticated,
    staleTime: 5 * 60_000,
  });

  // Loading, failed or closed: nothing.
  if (!race.data || (isAuthenticated && !myRace.data)) return null;

  const mine = isAuthenticated ? (myRace.data?.entry ?? null) : null;
  return (
    <Link href="/util/lorewards" className="block max-w-full">
      <Badge variant="secondary" className="max-w-full justify-start">
        <Trophy aria-hidden="true" />
        <span className="truncate">{raceText(race.data.entries[0], mine)}</span>
      </Badge>
    </Link>
  );
}
