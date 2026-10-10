"use client";

import Link from "next/link";
import { Bookmark } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { useNotify } from "~/hooks/useNotify";
import { usePageTitle } from "~/hooks/usePageTitle";
import { timeAgo } from "~/lib/format/compact";
import { FORUM_HOME } from "~/lib/thinkpages-forum/links";
import { api } from "~/trpc/react";
import { ForumLoadError, ForumPageSkeleton } from "../ForumPageState";
import { ForumPage } from "../shell";

/** Stashed: the threads the member saved, newest first, each with an Unstash control. */
export function StashedPage() {
  const notify = useNotify();
  const utils = api.useUtils();
  const { data, isLoading, refetch } = api.thinkpagesForum.stashedThreads.useQuery();
  const { mutateAsync: unstash, isPending } = api.thinkpagesForum.unstashThread.useMutation();
  usePageTitle({ title: "Stashed" });

  const remove = async (threadId: string) => {
    try {
      await unstash({ threadId });
    } catch (e) {
      notify.error("Could not update your stash", e instanceof Error ? e.message : undefined);
      return;
    }
    // The change is saved; a failed refresh of the list is not an error to report.
    await Promise.all([
      utils.thinkpagesForum.stashedThreads.invalidate(),
      utils.thinkpagesForum.isThreadStashed.invalidate({ threadId }),
    ]).catch(() => undefined);
  };

  if (isLoading) return <ForumPageSkeleton />;
  if (!data) {
    return (
      <ForumLoadError
        notFound={false}
        notFoundTitle=""
        notFoundMessage=""
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <ForumPage
      title="Stashed"
      breadcrumbs={
        <p className="text-footnote text-label-tertiary tabular-nums">
          {data.length === 1 ? "1 thread" : `${data.length} threads`}
        </p>
      }
      back={{ href: FORUM_HOME, label: "ThinkPages" }}
    >
      <Card content="data" className="overflow-hidden py-1">
        {data.length > 0 ? (
          <ul className="divide-separator divide-y">
            {data.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 px-4 py-3 sm:px-5 pointer-coarse:min-h-11"
              >
                <Bookmark aria-hidden className="text-tint size-4 shrink-0" />
                <Link
                  href={item.href}
                  className="text-title-3 text-label focus-visible:outline-tint min-w-0 flex-1 truncate focus-visible:outline-2"
                >
                  {item.title}
                </Link>
                <span className="text-footnote text-label-secondary shrink-0 tabular-nums">
                  {timeAgo(item.savedAt)}
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-label-secondary pointer-coarse:min-h-11"
                  aria-label={`Unstash ${item.title}`}
                  disabled={isPending}
                  onClick={() => void remove(item.threadId)}
                >
                  Unstash
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            compact
            icon={<Bookmark className="text-tint" />}
            title="Nothing stashed yet"
          />
        )}
      </Card>
    </ForumPage>
  );
}
