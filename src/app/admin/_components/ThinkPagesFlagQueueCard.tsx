"use client";
// src/app/admin/_components/ThinkPagesFlagQueueCard.tsx
// ThinkPages flag moderation queue (SL-10): posts users flagged, most flagged first. Dismiss keeps
// the post; Remove deletes it. Either resolves every open flag on that post.

import Link from "next/link";
import { CheckCircle, Trash, OpenNewWindow as ExternalLink } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";

export function ThinkPagesFlagQueueCard() {
  const notify = useNotify();
  const utils = api.useUtils();
  const { data, isLoading } = api.admin.listFlaggedPosts.useQuery({ limit: 50 });

  const resolve = api.admin.resolveFlaggedPost.useMutation({
    onSuccess: (result, input) => {
      notify.success(
        input.action === "remove" ? "Post removed" : "Flags dismissed",
        `${result.resolved} flag${result.resolved === 1 ? "" : "s"} resolved.`
      );
      void utils.admin.listFlaggedPosts.invalidate();
    },
    onError: (err) => notify.error("Could not resolve the flags", err.message),
  });

  if (isLoading) {
    return (
      <Card className="space-y-3 p-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  }

  const items = data?.items ?? [];
  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<CheckCircle />}
          title="No flagged posts"
          message="Posts users flag for moderation appear here."
        />
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="border-separator border-b pb-4">
        <h3 className="text-label text-headline">Flagged posts</h3>
        <p className="text-label-secondary text-footnote mt-1">
          {data?.totalOpen ?? 0} open flag{data?.totalOpen === 1 ? "" : "s"} on {items.length} post
          {items.length === 1 ? "" : "s"}.
        </p>
      </div>

      <ul className="space-y-3">
        {items.map((item) => {
          const pending = resolve.isPending && resolve.variables?.postId === item.postId;
          return (
            <li
              key={item.postId}
              className="border-separator bg-surface rounded-card space-y-3 border p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-label text-callout">
                  {item.post
                    ? (item.post.authorDisplayName ?? `@${item.post.authorUsername ?? "unknown"}`)
                    : "Deleted post"}
                </p>
                <p className="text-label-secondary text-caption tabular-nums">
                  {item.flagCount} flag{item.flagCount === 1 ? "" : "s"}, last{" "}
                  {new Date(item.lastFlaggedAt).toLocaleString()}
                </p>
              </div>

              {item.post && (
                <p className="text-label text-body line-clamp-4 break-words whitespace-pre-wrap">
                  {item.post.content}
                </p>
              )}

              {item.reasons.length > 0 && (
                <ul className="text-label-secondary text-footnote list-disc space-y-1 pl-5">
                  {item.reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                {item.post && (
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/dashboard/post/${item.postId}`} target="_blank">
                      <ExternalLink aria-hidden="true" />
                      Open
                    </Link>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => resolve.mutate({ postId: item.postId, action: "dismiss" })}
                >
                  <CheckCircle aria-hidden="true" />
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pending || !item.post}
                  onClick={() => resolve.mutate({ postId: item.postId, action: "remove" })}
                >
                  <Trash aria-hidden="true" />
                  Remove post
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
