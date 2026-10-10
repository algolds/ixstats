"use client";

import Link from "next/link";
import { ShieldCheck } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { useUser } from "~/context/auth-context";
import { isArchiveCategory } from "~/lib/thinkpages-forum/categories";
import { modHref } from "~/lib/thinkpages-forum/links";
import { api } from "~/trpc/react";
import { ForumLoadError } from "../ForumPageState";
import { ForumPage } from "../shell";
import { hasStanding, StandingPanel } from "../StandingPanel";
import { BoardTable } from "./BoardTable";
import { StatsPanel, TrendingPanel } from "./HomeRail";
import { YourRealmCard } from "./YourRealmCard";

const TITLE = "ThinkPages";

/**
 * The Forums home: Your realm, the sitewide boards as one table, the old forum's archive (collapsed), and a rail of
 * Trending threads, Forum statistics and the member's own standing. The rail is only passed when a panel has content.
 */
export function ForumHome() {
  const { isSignedIn } = useUser();
  const signedIn = isSignedIn === true;
  const { data: categories, isLoading, error, refetch } = api.thinkpagesForum.categories.useQuery();
  const { data: moderates } = api.thinkpagesForumMod.context.useQuery(undefined, {
    enabled: signedIn,
  });
  const { data: trending } = api.thinkpagesForum.trending.useQuery();
  const { data: stats } = api.thinkpagesForum.forumStats.useQuery();
  const { data: standing } = api.thinkpagesForum.myStanding.useQuery(undefined, {
    enabled: signedIn,
  });

  const regular = categories?.filter((c) => !isArchiveCategory(c.key)) ?? [];
  const archived = categories?.filter((c) => isArchiveCategory(c.key)) ?? [];
  const noBoards = regular.length === 0 && archived.length === 0;
  const moderator =
    signedIn &&
    !!moderates &&
    (moderates.isSiteAdmin || moderates.realms.length > 0 || moderates.categories.length > 0);
  const activeThreads = trending && trending.length > 0 ? trending : undefined;
  const ownStanding = signedIn && hasStanding(standing) ? standing : undefined;
  const hasRail = !!activeThreads || !!stats || !!ownStanding;

  // A failed query is not "no boards": say so and offer a retry (a refetch that fails over cached boards keeps them).
  if (!categories && error) {
    return (
      <ForumLoadError
        notFound={false}
        notFoundTitle=""
        notFoundMessage=""
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <ForumPage
      title={TITLE}
      wideActions={
        moderator ? (
          <Button asChild size="sm" variant="ghost" className="text-label-secondary">
            <Link href={modHref()}>
              <ShieldCheck aria-hidden />
              Moderation
            </Link>
          </Button>
        ) : null
      }
      openRailOnHash="#standing"
      rail={
        hasRail ? (
          <>
            {activeThreads ? <TrendingPanel threads={activeThreads} /> : null}
            {stats ? <StatsPanel stats={stats} /> : null}
            {ownStanding ? <StandingPanel standing={ownStanding} /> : null}
          </>
        ) : undefined
      }
    >
      <YourRealmCard signedIn={signedIn} />
      {isLoading ? (
        <Skeleton className="rounded-card h-64 w-full" />
      ) : (
        <>
          {regular.length > 0 ? <BoardTable boards={regular} title="Sitewide" /> : null}
          {noBoards ? (
            <Card content="data">
              <EmptyState compact title="No boards yet" />
            </Card>
          ) : null}
          {archived.length > 0 ? (
            <BoardTable boards={archived} title="From the old forum" collapsible />
          ) : null}
        </>
      )}
    </ForumPage>
  );
}
