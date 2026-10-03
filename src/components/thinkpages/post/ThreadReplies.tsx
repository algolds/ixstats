"use client";

import React from "react";
import { SystemRestart as Loader2 } from "iconoir-react";
import { Button } from "~/components/ui/button";

interface ThreadRepliesProps {
  post: any;
  showThread?: boolean;
  showReplies: boolean;
  setShowReplies: (val: boolean) => void;
  threadQuery: any;
  currentUserAccountId: string;
  accounts?: any[];
  countryId?: string;
  isOwner?: boolean;
  onAccountSelect?: (account: any) => void;
  onAccountSettings?: (account: any) => void;
  onCreateAccount?: () => void;
  onLike?: (postId: string) => void;
  onRepost?: (postId: string) => void;
  onReply?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onReaction?: (postId: string, reactionType: string) => void;
  onAccountClick?: (accountId: string) => void;
  ThinkpagesPostComponent: React.ComponentType<any>;
}

export function ThreadReplies({
  post,
  showThread,
  showReplies,
  setShowReplies,
  threadQuery,
  currentUserAccountId,
  accounts,
  countryId,
  isOwner,
  onAccountSelect,
  onAccountSettings,
  onCreateAccount,
  onLike,
  onRepost,
  onReply,
  onShare,
  onReaction,
  onAccountClick,
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
                currentUserAccountId={currentUserAccountId}
                accounts={accounts}
                countryId={countryId}
                isOwner={isOwner}
                onAccountSelect={onAccountSelect}
                onAccountSettings={onAccountSettings}
                onCreateAccount={onCreateAccount}
                onLike={onLike}
                onRepost={onRepost}
                onReply={onReply}
                onShare={onShare}
                onReaction={onReaction}
                onAccountClick={onAccountClick}
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
