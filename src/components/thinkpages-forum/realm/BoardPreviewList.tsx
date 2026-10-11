import Link from "next/link";
import { timeAgo } from "~/lib/format/compact";
import type { BoardPreviewMessage } from "~/lib/thinkpages-forum/preview";
import { cn } from "~/lib/utils";
import { AuthorFlag } from "../AuthorMark";
import { ForumAvatar } from "../ForumAvatar";

/**
 * A realm board's newest messages as compact rows (Home's "Your realm", the realm overview's board block): the
 * author (a persona by name and picture only, as the server shaped it), how long ago, and about 90 characters of the
 * text. Each row is one link to the message on the live board, by the href the server built from the realm's own slug.
 */
export function BoardPreviewList({
  messages,
  className,
}: {
  messages: readonly BoardPreviewMessage[];
  className?: string;
}) {
  return (
    <ul className={cn("divide-separator flex flex-col divide-y", className)}>
      {messages.map((message) => (
        <li key={message.id} className="py-2 first:pt-0 last:pb-0">
          <Link
            href={message.href}
            className="hover:bg-fill-4 focus-visible:outline-tint rounded-control-sm -mx-2 flex items-start gap-2 px-2 py-1 focus-visible:outline-2 pointer-coarse:min-h-11"
          >
            <ForumAvatar
              name={message.author.name}
              avatarUrl={message.author.avatarUrl}
              size="xs"
            />
            <span className="min-w-0 flex-1">
              <span className="text-footnote flex min-w-0 items-center gap-1.5">
                <span className="text-label min-w-0 truncate font-medium">
                  {message.author.name}
                </span>
                {message.author.flagUrl ? <AuthorFlag url={message.author.flagUrl} /> : null}
                <span className="text-label-secondary shrink-0 tabular-nums">
                  {timeAgo(message.createdAt)}
                </span>
              </span>
              {message.excerpt ? (
                <span className="text-label-secondary text-footnote line-clamp-2 block break-words">
                  {message.excerpt}
                </span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
