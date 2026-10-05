"use client";
// Thread title, facts and the Reply / Share actions (in the page header toolbar).

import {
  Lock,
  Eye,
  ChatBubble as MessageSquare,
  Reply,
  ShareAndroid as Share,
} from "iconoir-react";
import { PageHeader } from "~/components/shell/PageHeader";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";

interface ThreadHeaderProps {
  thread: {
    title: string;
    authorName: string;
    replyCount: number;
    viewCount: number;
    isOpen: boolean;
  };
  /** Moves the reader to the reply composer. */
  onReply: () => void;
}

export function ThreadHeader({ thread, onReply }: ThreadHeaderProps) {
  const notify = useNotify();

  const copyLink = (url: string) => {
    // `navigator.clipboard` is missing outside secure contexts; a refused write rejects.
    const written = navigator.clipboard
      ? navigator.clipboard.writeText(url)
      : Promise.reject(new Error("Clipboard unavailable"));
    written.then(
      () => notify.success("Link copied to clipboard"),
      () => notify.error("Couldn't copy the link", "Copy the address from your browser instead.")
    );
  };

  const handleShare = () => {
    const url = window.location.href;
    if (!navigator.share) {
      copyLink(url);
      return;
    }
    navigator.share({ title: thread.title, url }).catch((error: unknown) => {
      // Dismissing the share sheet rejects with AbortError; any other failure falls back to copying.
      if (error instanceof DOMException && error.name === "AbortError") return;
      copyLink(url);
    });
  };

  return (
    <PageHeader
      bleed
      title={thread.title}
      subtitle={
        <div className="text-footnote flex flex-wrap items-center gap-3 tabular-nums">
          <span>by {thread.authorName}</span>
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3" />
            {thread.replyCount.toLocaleString()} replies
          </span>
          <span className="flex items-center gap-1">
            <Eye className="size-3" />
            {thread.viewCount.toLocaleString()} views
          </span>
          {!thread.isOpen && (
            <Badge variant="destructive">
              <Lock />
              Closed
            </Badge>
          )}
        </div>
      }
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={handleShare}>
            <Share />
            Share
          </Button>
          {thread.isOpen && (
            <Button size="sm" onClick={onReply}>
              <Reply />
              Reply
            </Button>
          )}
        </>
      }
    />
  );
}
