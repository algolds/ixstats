"use client";

import Link from "next/link";
import { EditPencil } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { useUser } from "~/context/auth-context";
import { useNotify } from "~/hooks/useNotify";
import { usePageTitle } from "~/hooks/usePageTitle";
import { REALM_HUB_KEY } from "~/lib/thinkpages-forum/categories";
import { categoryHref, FORUM_HOME, hubHref, newThreadHref } from "~/lib/thinkpages-forum/links";
import { pageCount, THREADS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { sortHref, type ThreadSort } from "~/lib/thinkpages-forum/thread-sort";
import { api } from "~/trpc/react";
import { ForumNotice } from "../BanNotice";
import { ForumBreadcrumbs, forumTrail } from "../ForumBreadcrumbs";
import { ForumLoadError, ForumPageSkeleton } from "../ForumPageState";
import { Pagination, pageHref, useLastPageRedirect } from "../Pagination";
import { RealmSwitcher } from "../RealmSwitcher";
import { useReadStateRefresh } from "../useReadStateRefresh";
import { ForumPage } from "../shell";
import { AboutPanel, TopPostersPanel } from "./BoardRail";
import { SortMenu } from "./SortMenu";
import { ThreadTable } from "./ThreadTable";

interface BoardPageProps {
  categoryKey: string;
  page: number;
  sort: ThreadSort;
  /** The realm's slug for a realm board; absent for a sitewide one. */
  realm?: string;
}

/** A board: its thread table (pinned first, sortable), pagination above and below, and a rail about the board. */
export function BoardPage({ categoryKey, page, sort, realm }: BoardPageProps) {
  const { data, isLoading, error, refetch } = api.thinkpagesForum.category.useQuery({
    key: categoryKey,
    page,
    realm,
    sort,
  });
  const realms = api.thinkpagesForum.realms.useQuery(undefined, { enabled: !!realm });
  const boardPath = categoryHref({ key: categoryKey, realm: realm ? { slug: realm } : null });
  const sortedPath = sortHref(boardPath, sort);
  const totalPages = pageCount(data?.total ?? 0, THREADS_PER_PAGE);
  const redirecting = useLastPageRedirect(sortedPath, page, data?.total, totalPages);
  usePageTitle({ title: data?.category.name ?? "ThinkPages" });
  const { isSignedIn } = useUser();
  // The board's own unread count (the list below shows one page): the home's or the realm's board row.
  const sitewideBoards = api.thinkpagesForum.categories.useQuery(undefined, {
    enabled: !!isSignedIn && !realm,
  });
  const realmBoards = api.thinkpagesForum.realmSection.useQuery(
    { realm: realm ?? "" },
    { enabled: !!isSignedIn && !!realm }
  );
  const unreadThreads = (realm ? realmBoards.data?.categories : sitewideBoards.data)?.find(
    (b) => b.key === categoryKey
  )?.unreadThreads;
  const notify = useNotify();
  const refreshReadState = useReadStateRefresh();
  const { mutateAsync: markRead, isPending: marking } =
    api.thinkpagesForum.markCategoryRead.useMutation();
  const markBoardRead = async () => {
    try {
      await markRead({ key: categoryKey, realm });
    } catch (e) {
      notify.error("Could not mark the board read", e instanceof Error ? e.message : undefined);
      return;
    }
    // The mark is saved; a failed refresh of the lists is not an error to report.
    await refreshReadState().catch(() => undefined);
  };

  if (isLoading || redirecting) return <ForumPageSkeleton />;

  if (!data) {
    return (
      <ForumLoadError
        notFound={error?.data?.code === "NOT_FOUND"}
        notFoundTitle="Category not found"
        notFoundMessage="It may be private, or the link is incorrect."
        onRetry={() => void refetch()}
      />
    );
  }

  const { category } = data;
  const newThread = data.canStart ? (
    <Button asChild size="sm">
      <Link href={newThreadHref(category)}>
        <EditPencil aria-hidden />
        New thread
      </Link>
    </Button>
  ) : null;
  // A realm opened by URL may be unlisted (D14); keep it selectable so the trigger shows its name.
  const listed = realms.data?.realms.find((r) => r.slug === realm);
  const realmOptions =
    realm && realms.data
      ? listed
        ? realms.data.realms
        : [{ slug: realm, name: category.realm?.name ?? realm }, ...realms.data.realms]
      : undefined;
  // The trail scrolls away with the header; the compact bar keeps this way up: the realm's Hub, or the home
  // (from a sitewide board, and from a Hub, which is the top of its realm).
  const back =
    category.realm && category.key !== REALM_HUB_KEY
      ? { href: hubHref(category.realm.slug), label: category.realm.name }
      : { href: FORUM_HOME, label: "ThinkPages" };
  const hrefFor = (n: number) => pageHref(sortedPath, n);

  return (
    <ForumPage
      title={category.name}
      breadcrumbs={
        <>
          {/* Above a realm's board the trail has somewhere to go; a sitewide board's only step is the back link. */}
          {category.realm ? <ForumBreadcrumbs items={forumTrail(category.realm)} /> : null}
          {category.description ? <p>{category.description}</p> : null}
          <p className="text-footnote text-label-tertiary mt-1 flex items-center gap-2 tabular-nums">
            {category.style === "ic" ? <Badge variant="secondary">In character</Badge> : null}
            {data.total === 1 ? "1 thread" : `${data.total} threads`}
          </p>
        </>
      }
      back={back}
      wideActions={
        <>
          {realm && realmOptions ? <RealmSwitcher realms={realmOptions} value={realm} /> : null}
          <SortMenu basePath={boardPath} sort={sort} />
          {isSignedIn ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-label-secondary pointer-coarse:min-h-11"
              // Unknown (the count has not loaded) leaves it enabled.
              disabled={marking || unreadThreads === 0}
              onClick={() => void markBoardRead()}
            >
              Mark board read
            </Button>
          ) : null}
          {newThread}
        </>
      }
      rail={
        <>
          <AboutPanel category={category} />
          <TopPostersPanel categoryKey={categoryKey} realm={realm} />
        </>
      }
    >
      {!data.canStart && data.notice ? (
        <ForumNotice notice={data.notice} banned={data.banned} />
      ) : null}
      <Pagination page={page} last={totalPages} hrefFor={hrefFor} />
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
            message="Be the first to post"
            action={newThread}
          />
        )}
      </Card>
      <Pagination page={page} last={totalPages} hrefFor={hrefFor} />
    </ForumPage>
  );
}
