"use client";

import Link from "next/link";
import { Trophy } from "iconoir-react";
import { api } from "~/trpc/react";
import { useUser, SignInButton } from "~/context/auth-context";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { ixstatesLinkHref } from "~/lib/system/wikios-standalone";
import { AwardHistory } from "./AwardHistory";
import { LorewardsSection } from "./LorewardsSection";
import { StreakCalendar } from "./StreakCalendar";
import { TrophyCards } from "./TrophyCards";

interface YourLorewardsProps {
  /** Another author's wiki name (the Passport): their public trophies instead of the viewer's. */
  username?: string;
  highlightCardId?: string;
  /** Leave out the streak calendar and the history. */
  trophiesOnly?: boolean;
}

function TrophyFigures({
  trophies,
  userStats,
  paid,
  todayRank,
}: {
  trophies: {
    wins: { daily: number; weekly: number; monthly: number };
    runnerUps: number;
    streak: number;
  };
  userStats: { rank: number | null; longestStreak: number; totalScore: number } | null;
  paid?: number;
  todayRank?: number | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat size="sm" label="Daily wins" value={trophies.wins.daily.toLocaleString()} />
      <Stat size="sm" label="Weekly wins" value={trophies.wins.weekly.toLocaleString()} />
      <Stat size="sm" label="Monthly wins" value={trophies.wins.monthly.toLocaleString()} />
      <Stat size="sm" label="Runner-ups" value={trophies.runnerUps.toLocaleString()} />
      <Stat
        size="sm"
        label="Streak"
        value={trophies.streak.toLocaleString()}
        hint={userStats ? `Best ${userStats.longestStreak}` : undefined}
      />
      <Stat size="sm" label="Rank" value={userStats?.rank ? `#${userStats.rank}` : "Unranked"} />
      <Stat size="sm" label="Total score" value={(userStats?.totalScore ?? 0).toLocaleString()} />
      {paid !== undefined && (
        <Stat size="sm" label="IxCredits paid" value={paid.toLocaleString()} />
      )}
      {todayRank !== undefined && (
        <Stat
          size="sm"
          label="Today's race"
          value={todayRank ? `#${todayRank}` : "Not in the top 10"}
        />
      )}
    </div>
  );
}

interface ViewerTrophies {
  wins: { daily: number; weekly: number; monthly: number };
  runnerUps: number;
  cards: ReadonlyArray<{ id: string }>;
  unmatched: number;
}

/** Places sit under the viewer's wiki name, but none could be tied to their account, and they hold nothing. */
const onlyUnmatched = (mine: ViewerTrophies) =>
  mine.unmatched > 0 &&
  mine.cards.length === 0 &&
  mine.runnerUps + mine.wins.daily + mine.wins.weekly + mine.wins.monthly === 0;

/** The trophies pane and what hangs off it: calendar and history, for the viewer or for `username`. */
export function YourLorewards({ username, highlightCardId, trophiesOnly }: YourLorewardsProps) {
  const { user, isLoaded } = useUser();
  const signedIn = Boolean(user);

  const mine = api.lorewards.getMyTrophies.useQuery(undefined, {
    enabled: !username && signedIn,
  });
  const theirs = api.lorewards.getTrophies.useQuery(
    { username: username ?? "" },
    { enabled: Boolean(username), staleTime: 60_000 }
  );

  // The name's public record (stats row, calendar, history) is the viewer's only through a verified link.
  const recordName = username ?? (mine.data?.verified ? mine.data.wikiUsername : null) ?? undefined;
  const { data: userStats } = api.lorewards.getUserStats.useQuery(
    { username: recordName ?? "" },
    { enabled: Boolean(recordName), staleTime: 60_000 }
  );

  if (!username && isLoaded && !signedIn) {
    return (
      <EmptyState
        icon={<Trophy />}
        title="Sign in to see your trophies"
        message="Your Loreward wins, trophy cards and payouts appear here."
        action={
          <SignInButton>
            <Button>Sign in</Button>
          </SignInButton>
        }
      />
    );
  }

  const trophies = username ? theirs.data : mine.data;
  if (!trophies) {
    return (username ? theirs : mine).isError ? (
      <p className="text-label-secondary text-callout">Trophies are unavailable right now.</p>
    ) : (
      <Skeleton className="h-48" />
    );
  }

  if (!username && !mine.data?.wikiUsername) {
    return (
      <EmptyState
        icon={<Trophy />}
        title="No wiki edits yet"
        message="Lorewards score your edits on the wiki. Your wins, trophy cards and payouts appear here after your first edit."
      />
    );
  }

  if (!username && mine.data && onlyUnmatched(mine.data)) {
    return (
      <EmptyState
        icon={<Trophy />}
        title="Your wiki name isn't matched to your account"
        message={`Lorewards recorded under ${mine.data.wikiUsername} could not be tied to your account. Verify your wiki account in Settings to claim them.`}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={ixstatesLinkHref("/settings?tab=account")}>Verify your wiki account</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <LorewardsSection
        title={username ? `Trophies of ${username}` : "Your trophies"}
        content="collectible"
      >
        <TrophyFigures
          trophies={trophies}
          userStats={
            userStats?.stats
              ? {
                  rank: userStats.rank,
                  longestStreak: userStats.stats.longestStreak,
                  totalScore: userStats.stats.totalScore,
                }
              : null
          }
          paid={mine.data && !username ? mine.data.paid : undefined}
          todayRank={mine.data && !username ? mine.data.todayRank : undefined}
        />
        {trophies.cards.length > 0 ? (
          <TrophyCards cards={trophies.cards} highlightCardId={highlightCardId} />
        ) : (
          <Card variant="well" padding="sm">
            <p className="text-label-secondary text-callout">
              No trophy cards yet. Every Loreward place mints a one-of-one card of the winning page.
            </p>
          </Card>
        )}
      </LorewardsSection>
      {recordName && !trophiesOnly && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <StreakCalendar username={recordName} />
          </div>
          <div className="lg:col-span-3">
            <AwardHistory username={recordName} />
          </div>
        </div>
      )}
    </div>
  );
}
