"use client";

import { Reply, Shield } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { sanitizeMessageContent } from "~/lib/utils/sanitize-html";
import {
  displayNameOf,
  highlightMatches,
  humanizeEnum,
  stripTags,
  type DisplayNamePreference,
} from "~/lib/messages/format";
import type { ThreadMessage, ThreadReply } from "~/lib/messages/thread";

/** The quoted message a reply answers, sitting on top of the bubble. */
export function ReplyQuote({
  replyTo,
  isOwn,
  preference,
}: {
  replyTo: ThreadReply;
  isOwn: boolean;
  preference?: DisplayNamePreference;
}) {
  const sender = replyTo.account ? displayNameOf(replyTo.account, preference) : "Original message";
  return (
    <div
      className={cn(
        "rounded-t-row text-footnote flex w-fit max-w-full items-center gap-2 px-3 py-1",
        isOwn ? "bg-tint-hover text-on-tint" : "bg-fill-4 text-label-secondary"
      )}
    >
      <Reply className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">
        <span className="font-medium">{sender}</span>: {stripTags(replyTo.content).slice(0, 60)}
      </span>
    </div>
  );
}

interface MessageContentProps {
  message: ThreadMessage;
  isOwn: boolean;
  /** Last of its run: the corner nearest the sender squares off into a tail. */
  hasTail: boolean;
  hasReply: boolean;
  pending: boolean;
  searchQuery?: string;
}

/** The bubble itself. It sizes to its text, up to the width its column allows. */
export function MessageContent({
  message,
  isOwn,
  hasTail,
  hasReply,
  pending,
  searchQuery,
}: MessageContentProps) {
  const deleted = !!message.deletedAt;
  return (
    <div
      className={cn(
        "text-callout rounded-card w-fit max-w-full px-3.5 py-2 break-words",
        isOwn ? "bg-tint text-on-tint" : "border-separator bg-surface-secondary text-label border",
        hasTail && (isOwn ? "rounded-br-control-sm" : "rounded-bl-control-sm"),
        hasReply && "rounded-t-none",
        pending && "opacity-70",
        deleted && "italic opacity-70"
      )}
    >
      {message.classification && (
        <div className="mb-1 flex items-center gap-1">
          <Badge variant="warning">
            <Shield aria-hidden="true" />
            {humanizeEnum(message.classification)}
          </Badge>
        </div>
      )}
      <div
        className="[&_a]:underline [&>p]:mb-0"
        dangerouslySetInnerHTML={{
          __html: sanitizeMessageContent(highlightMatches(message.content, searchQuery)),
        }}
      />
    </div>
  );
}
