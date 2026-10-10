"use client";

import Link from "next/link";
import { EditPencil } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { usePageTitle } from "~/hooks/usePageTitle";
import { categoryHref, forumHomeHref, newThreadHref } from "~/lib/thinkpages-forum/links";
import { pageCount, THREADS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { sortHref, type ThreadSort } from "~/lib/thinkpages-forum/thread-sort";
import { api } from "~/trpc/react";
import { ForumNotice } from "../BanNotice";
import { ForumBreadcrumbs, forumTrail } from "../ForumBreadcrumbs";
import { ForumLoadError, ForumPageSkeleton } from "../ForumPageState";
import { Pagination, pageHref, useLastPageRedirect } from "../Pagination";
import { RealmSwitcher } from "../RealmSwitcher";
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
  const hrefFor = (n: number) => pageHref(sortedPath, n);

  return (
    <ForumPage
      title={category.name}
      breadcrumbs={
        <>
          <ForumBreadcrumbs items={forumTrail(category.realm)} />
          {category.description ? <p>{category.description}</p> : null}
          {category.style === "ic" ? <Badge variant="secondary">In character</Badge> : null}
        </>
      }
      // The trail scrolls away with the header; the compact bar keeps this way up: the realm's section or the home.
      back={{
        href: forumHomeHref(category.realm?.slug),
        label: category.realm?.name ?? "ThinkPages",
      }}
      actions={
        <>
          {realm && realmOptions ? <RealmSwitcher realms={realmOptions} value={realm} /> : null}
          <SortMenu basePath={boardPath} sort={sort} />
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
