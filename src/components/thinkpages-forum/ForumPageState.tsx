"use client";

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { FORUM_HOME } from "~/lib/thinkpages-forum/links";

/** Loading placeholder for a forum page: `blocks` card-sized skeletons. */
export function ForumPageSkeleton({ blocks = 1 }: { blocks?: number }) {
  return (
    <div className="container mx-auto max-w-3xl space-y-4 px-4 py-8">
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
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Card>
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
