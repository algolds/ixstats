"use client";

import React from "react";
import { SystemRestart as Loader2 } from "iconoir-react";
import { Button } from "~/components/ui/button";
import type { PostState, PostViewContext } from "./postViewTypes";

interface ThreadRepliesProps {
  post: any;
  showThread?: boolean;
  state: Pick<PostState, "showReplies" | "setShowReplies" | "threadQuery">;
  ctx: PostViewContext;
  ThinkpagesPostComponent: React.ComponentType<any>;
}

export function ThreadReplies({
  post,
  showThread,
  state: { showReplies, setShowReplies, threadQuery },
  ctx,
  ThinkpagesPostComponent,
}: ThreadRepliesProps) {
  const replyCount = post.replyCount ?? 0;
  const loadedReplies = threadQuery.data?.replies ?? [];
  const effectiveCount = Math.max(replyCount, loadedReplies.length);
  const hasReplies = effectiveCount > 0;

  if (!showThread || (!hasReplies && !showReplies)) return null;

  return (
    <>
      {hasReplies && (
        <Button
          type="button"
          variant="link"
          onClick={() => setShowReplies(!showReplies)}
          aria-expanded={showReplies}
          className="mt-2 h-auto p-0"
        >
          {showReplies ? "Hide" : "Show"} {effectiveCount}{" "}
          {effectiveCount === 1 ? "reply" : "replies"}
        </Button>
      )}

      {showReplies && (
        <div className="border-separator relative mt-3 ml-5 space-y-3 border-l-2 pl-4">
          {threadQuery.isLoading ? (
            <div className="text-label-secondary text-footnote flex items-center gap-2 py-2">
              <Loader2 className="text-blue h-3.5 w-3.5 animate-spin" />
              <span>Loading replies...</span>
            </div>
          ) : threadQuery.error ? (
            <div className="text-footnote text-red py-1">Failed to load replies.</div>
          ) : threadQuery.data?.replies && threadQuery.data.replies.length > 0 ? (
            threadQuery.data.replies.map((reply: any) => (
              <ThinkpagesPostComponent
                key={reply.id}
                post={reply}
                {...ctx}
                compact={true}
                showThread={false}
              />
            ))
          ) : (
            <div className="text-label-secondary text-footnote py-1">No replies yet.</div>
          )}
        </div>
      )}
    </>
  );
}
