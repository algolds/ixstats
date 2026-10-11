"use client";

import Link from "next/link";
import { ChatBubble, Heart } from "iconoir-react";
import { plural } from "~/app/realms/_components/realm-directory";
import { RealmAvatar } from "~/components/realms/RealmAvatar";
import { Badge } from "~/components/ui/badge";
import { buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { AuthorFlag } from "~/components/thinkpages-forum/AuthorMark";
import { ForumAvatar } from "~/components/thinkpages-forum/ForumAvatar";
import { timeAgo } from "~/lib/format/compact";
import type { ForumFeedPreview } from "~/lib/thinkpages-forum/preview";
import { cn } from "~/lib/utils";

interface ForumFeedCardProps {
  activity: { timestamp: string | Date; forum: ForumFeedPreview };
}

/**
 * A native forum thread in the Home feed as the post it refers to: who wrote it and where, the thread title (in the
 * wiki reading font on an in-character board, as on the thread page), three lines of the text, the reply and
 * reaction counts and a way in. The server shapes the persona-safe preview (`forumActivityItems`), so nothing here
 * decides who the author is.
 */
export function ForumFeedCard({ activity }: ForumFeedCardProps) {
  const { forum } = activity;
  const ic = forum.style === "ic";
  const when = new Date(activity.timestamp);
  // A timestamp that does not parse has no time to show (toISOString would throw on it).
  const posted = !Number.isNaN(when.getTime());
  return (
    <Card padding="md" content="feed">
      <article className="min-w-0">
        <div className="text-footnote flex flex-wrap items-center gap-x-2 gap-y-1">
          <ForumAvatar name={forum.author.name} avatarUrl={forum.author.avatarUrl} size="sm" />
          {forum.author.flagUrl ? <AuthorFlag url={forum.author.flagUrl} /> : null}
          <p className="text-label-secondary min-w-0 flex-1 basis-48 break-words">
            <span className="text-label font-medium">{forum.author.name}</span>{" "}
            {forum.kind === "thread" ? "started a thread in" : "replied in"}{" "}
            <Link
              href={forum.board.href}
              className="text-tint focus-visible:outline-tint inline-flex items-center hover:underline focus-visible:outline-2 pointer-coarse:min-h-11"
            >
              {forum.board.name}
            </Link>
          </p>
          {forum.realm ? (
            <span className="text-label-secondary flex max-w-32 shrink-0 items-center gap-2">
              <RealmAvatar
                thumbnail={forum.realm.emblemUrl || forum.realm.thumbnail}
                className="rounded-control-sm size-6"
              />
              <span className="truncate">{forum.realm.name}</span>
            </span>
          ) : null}
          {posted ? (
            <time
              dateTime={when.toISOString()}
              className="text-label-secondary shrink-0 tabular-nums"
            >
              {timeAgo(when)}
            </time>
          ) : null}
        </div>

        <h3
          className={cn(
            "text-label text-headline mt-2 break-words",
            ic && "font-(family-name:--wikios-font-reading)"
          )}
        >
          <Link
            href={forum.threadHref}
            className="focus-visible:outline-tint block hover:underline focus-visible:outline-2 pointer-coarse:min-h-11"
          >
            {forum.title}
          </Link>
        </h3>

        {forum.excerpt ? (
          <p className="text-label-secondary text-callout mt-1 line-clamp-3 break-words">
            {forum.excerpt}
          </p>
        ) : null}

        <div className="text-label-secondary text-footnote mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <ChatBubble aria-hidden className="size-4" />
            {plural(forum.replyCount, "reply", "replies")}
          </span>
          {forum.reactionTotal > 0 ? (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Heart aria-hidden className="size-4" />
              {plural(forum.reactionTotal, "reaction", "reactions")}
            </span>
          ) : null}
          {ic ? <Badge variant="outline">In character</Badge> : null}
          <Link
            href={forum.postHref}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "ml-auto pointer-coarse:min-h-11"
            )}
          >
            Open thread
          </Link>
        </div>
      </article>
    </Card>
  );
}
