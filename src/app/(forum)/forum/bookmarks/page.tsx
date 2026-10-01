"use client";
// src/app/(forum)/forum/bookmarks/page.tsx
// Forum stashes — shows threads saved via the LoreStash system.

import Link from "next/link";
import {
  Bookmark,
  ChatBubble as MessageSquare,
  Clock,
  OpenNewWindow as ExternalLink,
} from "iconoir-react";
import { ForumLayout } from "~/components/forum/shared/ForumLayout";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import { timeAgo as formatTimeAgo } from "~/lib/format/compact";
import { buttonVariants } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { FacetCard } from "~/components/ui/facet-container";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Skeleton } from "~/components/ui/skeleton";

export default function ForumStashesPage() {
  const { data, isLoading, error } = api.forum.getStashedThreads.useQuery(
    { limit: 50 },
    { staleTime: 30_000 }
  );

  const threads = data ?? [];

  return (
    <ForumLayout>
      <div className="mx-auto mb-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-large-title text-label">Stashed threads</h1>
            <p className="text-body text-label-secondary mt-1">
              Forum threads you&apos;ve saved for later
            </p>
          </div>
          <Link
            href={withBasePath("/stashes")}
            prefetch={false}
            className={buttonVariants({ variant: "gray", size: "sm" })}
          >
            All stashes
            <ExternalLink />
          </Link>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive text-body rounded-row px-4 py-3"
        >
          {error.message}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="rounded-row h-16 w-full" />
          ))}
        </div>
      ) : threads.length > 0 ? (
        <FacetList>
          <FacetListSection>
            {threads.map((thread) => (
              <FacetRow
                key={thread.id}
                href={withBasePath(thread.slug)}
                leading={
                  <span className="bg-tint-fill text-tint rounded-control flex size-9 items-center justify-center">
                    <MessageSquare className="size-4" />
                  </span>
                }
                title={thread.title}
                subtitle={
                  <span className="flex items-center gap-2">
                    <Clock className="size-3.5" />
                    Saved {formatTimeAgo(thread.savedAt)}
                  </span>
                }
                trailing={<Bookmark className="fill-tint text-tint size-4" />}
              />
            ))}
          </FacetListSection>
        </FacetList>
      ) : (
        <FacetCard>
          <EmptyState
            icon={<Bookmark />}
            title="No stashed threads yet"
            message="Click the bookmark icon on any forum post to save the thread to your stash for later."
          />
        </FacetCard>
      )}
    </ForumLayout>
  );
}
