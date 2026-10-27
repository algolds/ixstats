"use client";

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { FORUM_HOME } from "~/lib/thinkpages-forum/links";
import { cn } from "~/lib/utils/cn";

/** The column every forum page sits in (see ForumPage), so a loading or failed page does not jump when it arrives. */
const STATE_COLUMN = "flex min-w-0 flex-col gap-4 px-4 pt-4 pb-8 md:pt-8";
/** The header toolbar's height (`PageHeader`, 3.5rem), which a state keeps clear where the real page has its title. */
const HEADER_CLEARANCE = "mt-14";

/** Loading placeholder for a forum page: a title bar, then `blocks` card-sized skeletons. */
export function ForumPageSkeleton({ blocks = 1 }: { blocks?: number }) {
  return (
    <div className={STATE_COLUMN} aria-busy="true">
      <Skeleton className={cn(HEADER_CLEARANCE, "mb-2 h-9 w-64 max-w-full")} />
      {Array.from({ length: blocks }, (_, i) => (
        <Skeleton key={i} className="rounded-card h-48 w-full" />
      ))}
    </div>
  );
}

interface ForumLoadErrorProps {
  /** The server said NOT_FOUND (missing, hidden or private); anything else may be transient. */
  notFound: boolean;
  notFoundTitle: string;
  notFoundMessage: string;
  onRetry: () => void;
}

/** A forum page that did not load: "not found" with a way back, or a neutral failure with Retry. */
export function ForumLoadError({
  notFound,
  notFoundTitle,
  notFoundMessage,
  onRetry,
}: ForumLoadErrorProps) {
  return (
    <div className={STATE_COLUMN}>
      <Card className={HEADER_CLEARANCE}>
        {notFound ? (
          <EmptyState
            title={notFoundTitle}
            message={notFoundMessage}
            action={
              <Button asChild variant="secondary">
                <Link href={FORUM_HOME}>Back to the forum</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="Could not load this page"
            message="Check your connection and try again."
            action={
              <Button variant="secondary" onClick={onRetry}>
                Retry
              </Button>
            }
          />
        )}
      </Card>
    </div>
  );
}
