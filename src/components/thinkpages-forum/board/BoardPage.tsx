"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { isAdvertCategory } from "~/lib/thinkpages-forum/adverts";
import { categoryHref } from "~/lib/thinkpages-forum/links";
import { pageCount, THREADS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { sortHref, type ThreadSort } from "~/lib/thinkpages-forum/thread-sort";
import { api } from "~/trpc/react";
import { ForumNotice } from "../BanNotice";
import { ForumLoadError, ForumPageSkeleton } from "../ForumPageState";
import { Pagination, pageHref, useLastPageRedirect } from "../Pagination";
import { ForumPage } from "../shell";
import { PostingPanel, TopPostersPanel } from "./BoardRail";
import {
  AdvertNotice,
  BoardActions,
  boardBack,
  BoardThreads,
  BoardTrail,
  realmOptionsFor,
} from "./BoardParts";
import { useBoardUnread, useMarkBoardRead } from "./useBoardState";

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
  const unreadThreads = useBoardUnread(categoryKey, realm);
  const { markBoardRead, marking } = useMarkBoardRead(categoryKey, realm);

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
  const adverts = isAdvertCategory(category);
  const hrefFor = (n: number) => pageHref(sortedPath, n);

  return (
    <ForumPage
      title={category.name}
      breadcrumbs={<BoardTrail data={data} />}
      back={boardBack(category)}
      wideActions={
        <BoardActions
          data={data}
          adverts={adverts}
          boardPath={boardPath}
          sort={sort}
          realm={realm}
          realmOptions={realmOptionsFor(realm, realms.data?.realms, category)}
          unreadThreads={unreadThreads}
          marking={marking}
          onMarkRead={() => void markBoardRead()}
        />
      }
      rail={
        <>
          <PostingPanel category={category} />
          <TopPostersPanel categoryKey={categoryKey} realm={realm} />
        </>
      }
    >
      {!data.canStart && data.notice ? (
        <ForumNotice notice={data.notice} banned={data.banned} />
      ) : null}
      {adverts ? <AdvertNotice /> : null}
      <Pagination page={page} last={totalPages} hrefFor={hrefFor} />
      <BoardThreads data={data} adverts={adverts} boardPath={boardPath} sort={sort} />
      <Pagination page={page} last={totalPages} hrefFor={hrefFor} />
    </ForumPage>
  );
}
