"use client";

import React from "react";
import { HeroPostView } from "./post/HeroPostView";
import { StandardPostView } from "./post/StandardPostView";
import { useThinkpagesPost } from "./post/useThinkpagesPost";
import type { PostViewContext } from "./post/postViewTypes";

interface ThinkpagesPostProps extends PostViewContext {
  post: any;
  compact?: boolean;
  showThread?: boolean;
  isHero?: boolean;
}

const ThinkpagesPostComponent = ({
  post,
  compact = false,
  showThread = false,
  isHero = false,
  currentUserAccountId = "",
  accounts = [],
  countryId = "",
  isOwner = false,
  ...callbacks
}: ThinkpagesPostProps) => {
  const state = useThinkpagesPost(post, currentUserAccountId, showThread);
  const ctx: PostViewContext = { currentUserAccountId, accounts, countryId, isOwner, ...callbacks };

  return isHero ? (
    <HeroPostView post={post} ctx={ctx} state={state} />
  ) : (
    <StandardPostView
      post={post}
      ctx={ctx}
      state={state}
      compact={compact}
      showThread={showThread}
      ThinkpagesPostComponent={ThinkpagesPostComponent}
    />
  );
};

export const ThinkpagesPost = React.memo(ThinkpagesPostComponent, (prevProps, nextProps) => {
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.currentUserAccountId === nextProps.currentUserAccountId &&
    prevProps.post.updatedAt === nextProps.post.updatedAt &&
    JSON.stringify(prevProps.post.reactionCounts) ===
      JSON.stringify(nextProps.post.reactionCounts) &&
    prevProps.post._count?.replies === nextProps.post._count?.replies &&
    prevProps.isHero === nextProps.isHero
  );
});

ThinkpagesPost.displayName = "ThinkpagesPost";
