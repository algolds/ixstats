"use client";

import Link from "next/link";
import { ShieldCheck } from "iconoir-react";
import { motion } from "motion/react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { useUser } from "~/context/auth-context";
import { useForumNavFlags } from "~/components/shell/use-forum-nav-flags";
import { isArchiveCategory } from "~/lib/thinkpages-forum/categories";
import { modHref } from "~/lib/thinkpages-forum/links";
import { api } from "~/trpc/react";
import { ForumLoadError } from "../ForumPageState";
import { ForumPage, RISE_ITEM, RISE_LIST } from "../shell";
import { StandingPanel } from "../StandingPanel";
import { BoardList } from "./BoardList";
import { FindARealmPanel, LatestActivityPanel, ThinkTanksPanel, TrendingPanel } from "./HomeRail";
import { useHomeRail } from "./useHomeRail";
import { NewThreadMenu } from "./NewThreadMenu";
import { YourRealmPanel } from "./YourRealmPanel";

const TITLE = "ThinkPages";

const count = (n: number, one: string, many: string) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** "7 boards · 1,240 threads · 9,830 posts" over the sitewide boards; nothing until they load. */
function totals(boards: readonly { threadCount: number; postCount: number }[]) {
  if (boards.length === 0) return undefined;
  const threads = boards.reduce((sum, b) => sum + b.threadCount, 0);
  const posts = boards.reduce((sum, b) => sum + b.postCount, 0);
  return `${count(boards.length, "board", "boards")} · ${count(threads, "thread", "threads")} · ${count(posts, "post", "posts")}`;
}

/**
 * The Forums home: a plain header totalling the sitewide boards with a New thread menu, the sitewide boards with their latest threads,
 * the old forum's archive (collapsed), and a rail of Your realm, Latest activity, Trending threads, Find a Realm,
 * ThinkTanks and the member's own standing. The rail is only passed when a panel has content;
 * its panels rise in one after another.
 */
export function ForumHome() {
  const { isSignedIn } = useUser();
  const signedIn = isSignedIn === true;
  const { data: categories, isLoading, error, refetch } = api.thinkpagesForum.categories.useQuery();
  const { data: moderates } = api.thinkpagesForumMod.context.useQuery(undefined, {
    enabled: signedIn,
  });
  const rail = useHomeRail(signedIn);
  const { realmMember } = useForumNavFlags(signedIn);

  const regular = categories?.filter((c) => !isArchiveCategory(c.key)) ?? [];
  const archived = categories?.filter((c) => isArchiveCategory(c.key)) ?? [];
  const noBoards = regular.length === 0 && archived.length === 0;
  const moderator =
    signedIn &&
    !!moderates &&
    (moderates.isSiteAdmin || moderates.realms.length > 0 || moderates.categories.length > 0);
  const panels = [
    // Only for a realm member, so a viewer without a realm gets no empty rail (or Info button) for it.
    realmMember ? <YourRealmPanel key="realm" signedIn={signedIn} /> : null,
    rail.activity ? <LatestActivityPanel key="activity" items={rail.activity} /> : null,
    rail.trending ? <TrendingPanel key="trending" threads={rail.trending} /> : null,
    rail.adverts ? <FindARealmPanel key="adverts" adverts={rail.adverts} /> : null,
    rail.thinktanks ? (
      <ThinkTanksPanel
        key="thinktanks"
        thinktanks={rail.thinktanks}
        joined={rail.thinktanksJoined}
      />
    ) : null,
    rail.standing ? <StandingPanel key="standing" standing={rail.standing} /> : null,
  ].filter((panel) => panel !== null);

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
      breadcrumbs={totals(regular)}
      wideActions={
        <>
          <NewThreadMenu boards={regular} />
          {moderator ? (
            <Button asChild size="sm" variant="ghost" className="text-label-secondary">
              <Link href={modHref()}>
                <ShieldCheck aria-hidden />
                Moderation
              </Link>
            </Button>
          ) : null}
        </>
      }
      openRailOnHash="#standing"
      rail={
        panels.length > 0 ? (
          <motion.div initial="hidden" animate="show" variants={RISE_LIST} className="space-y-4">
            {panels.map((panel) => (
              <motion.div key={panel.key} variants={RISE_ITEM}>
                {panel}
              </motion.div>
            ))}
          </motion.div>
        ) : undefined
      }
    >
      {isLoading ? (
        <Skeleton className="rounded-card h-64 w-full" />
      ) : (
        <>
          {regular.length > 0 ? <BoardList boards={regular} title="Sitewide" /> : null}
          {noBoards ? (
            <Card content="data" className="overflow-hidden">
              <TextureOverlay texture="grid" className="[--facet-texture-color:var(--tint)]" />
              <EmptyState compact title="No boards yet" />
            </Card>
          ) : null}
          {archived.length > 0 ? (
            <BoardList boards={archived} title="From the old forum" collapsible />
          ) : null}
        </>
      )}
    </ForumPage>
  );
}
