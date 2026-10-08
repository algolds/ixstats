"use client";

import React from "react";
import { api } from "~/trpc/react";
import { EyeClosed } from "iconoir-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { NationSwitcher } from "~/components/navigation/NationSwitcher";
import { PassportCollectionTab } from "./tabs/PassportCollectionTab";
import { PassportHistoryTab } from "./tabs/PassportHistoryTab";
import { PassportRealmsTab } from "./tabs/PassportRealmsTab";
import { PassportWorkTab } from "./tabs/PassportWorkTab";
import type { PassportForum, PassportPayload, PassportTabType, PassportWiki } from "./types";
import { Card } from "~/components/ui/card";

const HISTORY_PAGE_SIZE = 50;

function TabSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="rounded-row h-28 w-full" />
      <Skeleton className="rounded-row h-28 w-full" />
    </div>
  );
}

/** Shown in place of a section the owner hid (the server did not send its data). */
function HiddenSection({
  what,
  handle,
  isOwner,
}: {
  what: string;
  handle: string;
  isOwner: boolean;
}) {
  return (
    <Card variant="well" padding="none">
      <EmptyState
        compact
        icon={<EyeClosed />}
        title={isOwner ? `Your ${what} is hidden` : "Private"}
        message={
          isOwner
            ? `You hide your ${what} from your passport. Change it on the back of your passport.`
            : `@${handle} keeps their ${what} private.`
        }
      />
    </Card>
  );
}

function RealmsPanel({ handle, isOwner }: { handle: string; isOwner: boolean }) {
  const { data, isLoading } = api.ixnayid.getRealms.useQuery({ handle });
  if (isLoading) return <TabSkeleton />;
  return (
    <>
      {/* The owner's own nations across realms, to switch which one they play as. */}
      {isOwner && <NationSwitcher className="border-separator rounded-row mb-6 border py-2" />}
      <PassportRealmsTab realms={data ?? []} handle={handle} />
    </>
  );
}

const EMPTY_WORK = {
  authoredArticles: [],
  conlangs: [],
  sportTeams: [],
  directives: [],
  wikiActivityFeed: [],
};

function WorkPanel({
  handle,
  wiki,
  forum,
}: {
  handle: string;
  wiki: PassportWiki;
  forum: PassportForum;
}) {
  const { data, isLoading } = api.ixnayid.getWork.useQuery({ handle });
  if (isLoading) return <TabSkeleton />;
  return <PassportWorkTab work={data ?? EMPTY_WORK} wiki={wiki} forum={forum} handle={handle} />;
}

function HistoryPanel({ handle, enabled }: { handle: string; enabled: boolean }) {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    api.ixnayid.getHistory.useInfiniteQuery(
      { handle, limit: HISTORY_PAGE_SIZE },
      { enabled, getNextPageParam: (lastPage) => lastPage.nextCursor }
    );
  if (enabled && isLoading) return <TabSkeleton />;
  const history = enabled ? (data?.pages.flatMap((page) => page.items) ?? []) : [];

  return (
    <div className="space-y-6">
      <PassportHistoryTab history={history} handle={handle} />
      {enabled && hasNextPage && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading…" : "Load older activity"}
          </Button>
        </div>
      )}
    </div>
  );
}

interface PassportTabBodyProps {
  activeTab: PassportTabType;
  handle: string;
  data: PassportPayload;
}

/**
 * Renders the active passport tab. Collection reuses the passport payload the front face already
 * loaded; Realms, Work and History each fetch their own focused procedure on first open.
 */
export const PassportTabBody = React.memo(function PassportTabBody({
  activeTab,
  handle,
  data,
}: PassportTabBodyProps) {
  const isOwner = data.account.isOwner;
  switch (activeTab) {
    case "realms":
      return <RealmsPanel handle={handle} isOwner={isOwner} />;
    case "work":
      return <WorkPanel handle={handle} wiki={data.wiki} forum={data.forum} />;
    case "collection":
      return (
        <PassportCollectionTab
          vault={data.vault}
          achievements={data.showcase.achievements}
          handle={handle}
          isOwner={isOwner}
        />
      );
    case "history":
      // The server returns an empty stream when the owner hides it; skip the fetch entirely.
      return data.privacy.historyStream ? (
        <HistoryPanel handle={handle} enabled />
      ) : (
        <HiddenSection what="activity history" handle={handle} isOwner={isOwner} />
      );
  }
});
