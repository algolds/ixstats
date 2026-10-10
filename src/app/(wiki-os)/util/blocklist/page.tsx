"use client";
// src/app/(wiki-os)/util/blocklist/page.tsx
// Special:BlockList — the blocks in force, with an unblock button for those who may.

import Link from "next/link";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { AdminPage, useWikiRights } from "~/components/wiki-os/admin/AdminPage";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { describeExpiry } from "~/lib/wiki-os/page-admin-ui";

export default function BlockListPage() {
  const notify = useNotify();
  const utils = api.useUtils();
  const { rights } = useWikiRights();
  const canBlock = rights.includes("block");

  const blocks = api.wikios.listBlocks.useInfiniteQuery(
    { limit: 50 },
    { getNextPageParam: (last) => last.nextCursor ?? undefined }
  );
  const rows = blocks.data?.pages.flatMap((page) => page.blocks) ?? [];

  const unblock = api.wikios.unblockUser.useMutation({
    onSuccess: (result) => {
      notify.success("User unblocked", `${result.target} can edit again.`);
      void utils.wikios.listBlocks.invalidate();
    },
    onError: (error) => notify.error("Unblock failed", error.message),
  });

  return (
    <AdminPage title="Blocked users" description="Accounts that cannot currently edit.">
      {blocks.isLoading && <Skeleton className="h-40 w-full rounded-xl" />}
      {blocks.error && <p className="text-destructive text-sm">{blocks.error.message}</p>}
      {!blocks.isLoading && rows.length === 0 && (
        <p className="text-muted-foreground text-sm">Nobody is blocked.</p>
      )}
      <ul className="divide-border border-border divide-y rounded-xl border">
        {rows.map((block) => (
          <li key={`${block.target}-${block.createdAt.toISOString()}`} className="space-y-1 p-3">
            <div className="flex items-center justify-between gap-3">
              <Link
                href={`/wiki/User:${encodeURIComponent(block.target.replace(/ /g, "_"))}`}
                className="text-foreground text-sm font-semibold hover:underline"
              >
                {block.target}
              </Link>
              {canBlock && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={unblock.isPending}
                  onClick={() => unblock.mutate({ target: { wikiUsername: block.target } })}
                >
                  Unblock
                </Button>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              Blocked {describeExpiry(block.expiresAt)}
              {block.blockedBy ? ` by ${block.blockedBy}` : ""}
              {block.allowUserTalk ? "" : "; cannot edit their talk page"}
            </p>
            {block.reason && <p className="text-muted-foreground text-xs">{block.reason}</p>}
          </li>
        ))}
      </ul>
      {blocks.hasNextPage && (
        <Button
          variant="outline"
          onClick={() => void blocks.fetchNextPage()}
          disabled={blocks.isFetchingNextPage}
        >
          {blocks.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </AdminPage>
  );
}
