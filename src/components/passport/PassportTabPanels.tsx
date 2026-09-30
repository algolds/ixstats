"use client";

import React from "react";
import { api } from "~/trpc/react";
import { EyeClosed } from "iconoir-react";
import { Skeleton } from "~/components/ui/skeleton";
import { NationSwitcher } from "~/components/navigation/NationSwitcher";
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

/** Shown in place of a section the owner hid (the server did not send its data). */
export function HiddenSection({
  what,
  handle,
  isOwner,
}: {
  what: string;
  handle: string;
  isOwner: boolean;
}) {
  return (
    <div className="space-y-2 rounded-3xl border border-black/8 bg-black/[0.015] p-10 text-center dark:border-white/10 dark:bg-white/[0.02]">
      <EyeClosed className="text-muted-foreground mx-auto h-6 w-6" />
      <p className="text-muted-foreground mx-auto max-w-md text-xs">
        {isOwner
          ? `You hide your ${what} from your passport. Change it on the back of your passport.`
          : `@${handle} keeps their ${what} private.`}
      </p>
    </div>
  );
}

function RealmsPanel({ handle, isOwner }: { handle: string; isOwner: boolean }) {
  const { data, isLoading } = api.ixnayid.getRealms.useQuery({ handle });
  if (isLoading) return <TabSkeleton />;
  return (
    <>
      {/* The owner's own nations across realms, to switch which one they play as. */}
      {isOwner && (
        <NationSwitcher className="mb-6 rounded-2xl border border-black/8 py-2 dark:border-white/10" />
      )}
      <PassportRealmsTab realms={data ?? []} cleanUsername={handle} />
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
  onOpenVault?: () => void;
}

/**
 * Renders the active passport tab. Overview and Vault reuse the passport payload the header
 * already loaded; Realms, Work and History each fetch their own focused procedure on first open.
 */
export const PassportTabBody = React.memo(function PassportTabBody({
  activeTab,
  handle,
  data,
  onOpenVault,
}: PassportTabBodyProps) {
  const isOwner = data.account.isOwner;
  switch (activeTab) {
    case "overview":
      return <PassportOverviewTab data={data} cleanUsername={handle} onOpenVault={onOpenVault} />;
    case "realms":
      return <RealmsPanel handle={handle} isOwner={isOwner} />;
    case "work":
      return <WorkPanel handle={handle} wiki={data.wiki} />;
    case "vault":
      return data.vault ? (
        <PassportVaultTab vault={data.vault} cleanUsername={handle} />
      ) : (
        <HiddenSection what="Vault collection" handle={handle} isOwner={isOwner} />
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
