"use client";

import Link from "next/link";
import { EditPencil } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { useUser } from "~/context/auth-context";
import { REALM_HUB_KEY } from "~/lib/thinkpages-forum/categories";
import { FORUM_HOME, hubHref, newThreadHref } from "~/lib/thinkpages-forum/links";
import type { ThreadSort } from "~/lib/thinkpages-forum/thread-sort";
import type { RouterOutputs } from "~/trpc/react";
import { AdvertBoardAction } from "../advert/AdvertBoardAction";
import { ForumBreadcrumbs, forumTrail } from "../ForumBreadcrumbs";
import { RealmSwitcher } from "../RealmSwitcher";
import { SortMenu } from "./SortMenu";
import { ThreadTable } from "./ThreadTable";

type BoardData = RouterOutputs["thinkpagesForum"]["category"];
type RealmOption = { slug: string; name: string };

/** The New thread button for a board the viewer may start in; Find a Realm's header offers the advert action instead. */
export function NewThreadButton({ category }: { category: BoardData["category"] }) {
  return (
    <Button asChild size="sm">
      <Link href={newThreadHref(category)}>
        <EditPencil aria-hidden />
        New thread
      </Link>
    </Button>
  );
}

const startAction = (data: BoardData) =>
  data.canStart ? <NewThreadButton category={data.category} /> : null;

/** The trail scrolls away with the header; the compact bar keeps this way up: the realm's Hub, or the home. */
export function boardBack(category: BoardData["category"]): { href: string; label: string } {
  // From a sitewide board, and from a Hub, which is the top of its realm, the way up is the home.
  return category.realm && category.key !== REALM_HUB_KEY
    ? { href: hubHref(category.realm.slug), label: category.realm.name }
    : { href: FORUM_HOME, label: "ThinkPages" };
}

/** A realm opened by URL may be unlisted (D14); keep it selectable so the trigger shows its name. */
export function realmOptionsFor(
  realm: string | undefined,
  listed: RealmOption[] | undefined,
  category: BoardData["category"]
): RealmOption[] | undefined {
  if (!realm || !listed) return undefined;
  return listed.some((r) => r.slug === realm)
    ? listed
    : [{ slug: realm, name: category.realm?.name ?? realm }, ...listed];
}

/** Under the board's title: the realm trail, the description, the style badge and the thread count. */
export function BoardTrail({ data }: { data: BoardData }) {
  const { category } = data;
  return (
    <>
      {/* Above a realm's board the trail has somewhere to go; a sitewide board's only step is the back link. */}
      {category.realm ? <ForumBreadcrumbs items={forumTrail(category.realm)} /> : null}
      {category.description ? <p>{category.description}</p> : null}
      <p className="text-footnote text-label-tertiary mt-1 flex items-center gap-2 tabular-nums">
        {category.style === "ic" ? <Badge variant="secondary">In character</Badge> : null}
        {data.total === 1 ? "1 thread" : `${data.total} threads`}
      </p>
    </>
  );
}

interface BoardActionsProps {
  data: BoardData;
  adverts: boolean;
  boardPath: string;
  sort: ThreadSort;
  realm: string | undefined;
  realmOptions: RealmOption[] | undefined;
  /** Unknown (the count has not loaded) leaves Mark board read enabled. */
  unreadThreads: number | undefined;
  marking: boolean;
  onMarkRead: () => void;
}

/** The header actions: the realm picker, Sort, Mark board read, and New thread (Find a Realm: the advert action). */
export function BoardActions({
  data,
  adverts,
  boardPath,
  sort,
  realm,
  realmOptions,
  unreadThreads,
  marking,
  onMarkRead,
}: BoardActionsProps) {
  const { isSignedIn } = useUser();
  return (
    <>
      {realm && realmOptions ? <RealmSwitcher realms={realmOptions} value={realm} /> : null}
      <SortMenu basePath={boardPath} sort={sort} />
      {isSignedIn ? (
        <Button
          size="sm"
          variant="ghost"
          className="text-label-secondary pointer-coarse:min-h-11"
          disabled={marking || unreadThreads === 0}
          onClick={onMarkRead}
        >
          Mark board read
        </Button>
      ) : null}
      {adverts ? <AdvertBoardAction /> : startAction(data)}
    </>
  );
}

/** Find a Realm's note on who posts and how everyone else takes part. */
export function AdvertNotice() {
  return (
    <p className="text-callout text-label-secondary px-1">
      A realm&apos;s founder and officers post its advert. Reply to an advert to ask the realm a
      question.
    </p>
  );
}

/** The board's threads in a data card, or an empty state (with New thread, for those who may start one). */
export function BoardThreads({
  data,
  adverts,
  boardPath,
  sort,
}: {
  data: BoardData;
  adverts: boolean;
  boardPath: string;
  sort: ThreadSort;
}) {
  return (
    <Card content="data" className="overflow-hidden py-1">
      {data.threads.length > 0 ? (
        <ThreadTable
          threads={data.threads}
          authors={data.authors}
          basePath={boardPath}
          sort={sort}
        />
      ) : (
        <EmptyState
          compact
          title="No threads yet"
          message={adverts ? "Realm adverts will appear here" : "Be the first to post"}
          action={startAction(data)}
        />
      )}
    </Card>
  );
}
