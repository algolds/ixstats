"use client";

import React from "react";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { PassportHistoryTab } from "./tabs/PassportHistoryTab";
import { PassportOverviewTab } from "./tabs/PassportOverviewTab";
import { PassportRealmsTab } from "./tabs/PassportRealmsTab";
import { PassportVaultTab } from "./tabs/PassportVaultTab";
import { PassportWorkTab } from "./tabs/PassportWorkTab";
import type { PassportPayload, PassportTabType, PassportWiki } from "./types";

const HISTORY_PAGE_SIZE = 50;

function TabSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-28 w-full rounded-3xl" />
      <Skeleton className="h-28 w-full rounded-3xl" />
    </div>
  );
}

function RealmsPanel({ handle }: { handle: string }) {
  const { data, isLoading } = api.ixnayid.getRealms.useQuery({ handle });
  if (isLoading) return <TabSkeleton />;
  return <PassportRealmsTab realms={data ?? []} cleanUsername={handle} />;
}

const EMPTY_WORK = {
  authoredArticles: [],
  conlangs: [],
  sportTeams: [],
  directives: [],
  wikiActivityFeed: [],
};

function WorkPanel({ handle, wiki }: { handle: string; wiki: PassportWiki }) {
  const { data, isLoading } = api.ixnayid.getWork.useQuery({ handle });
  if (isLoading) return <TabSkeleton />;
  return <PassportWorkTab work={data ?? EMPTY_WORK} wiki={wiki} cleanUsername={handle} />;
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
      <PassportHistoryTab history={history} cleanUsername={handle} />
      {enabled && hasNextPage && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            data-cuelume-press="soft"
            className="text-foreground inline-flex cursor-pointer items-center rounded-xl border border-black/10 px-4 py-2 text-xs font-semibold transition-[background-color,opacity,transform] hover:bg-black/[0.04] active:scale-[0.97] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.05]"
          >
            {isFetchingNextPage ? "Loading…" : "Load older activity"}
          </button>
        </div>
      )}
    </div>
  );
}

interface PassportTabBodyProps {
  activeTab: PassportTabType;
  handle: string;
  data: PassportPayload;
  /** Owner's session toggle: when off, the History stream is hidden and not fetched. */
  showHistory: boolean;
}

/**
 * Renders the active passport tab. Overview and Vault reuse the passport payload the header
 * already loaded; Realms, Work and History each fetch their own focused procedure on first open.
 */
export const PassportTabBody = React.memo(function PassportTabBody({
  activeTab,
  handle,
  data,
  showHistory,
}: PassportTabBodyProps) {
  switch (activeTab) {
    case "overview":
      return <PassportOverviewTab data={data} cleanUsername={handle} />;
    case "realms":
      return <RealmsPanel handle={handle} />;
    case "work":
      return <WorkPanel handle={handle} wiki={data.wiki} />;
    case "vault":
      return <PassportVaultTab vault={data.vault} cleanUsername={handle} />;
    case "history":
      return <HistoryPanel handle={handle} enabled={showHistory} />;
  }
});
