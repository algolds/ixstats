"use client";

import React from "react";
import { withBasePath } from "~/lib/base-path";
import { HeroPostView } from "./post/HeroPostView";
import { StandardPostView } from "./post/StandardPostView";
import { useThinkpagesPost } from "./post/useThinkpagesPost";
import { LiveDataCard } from "./LiveDataCard";

import { proxyDiscordUrl } from "./post/ThinkpagesPostUtils";

export interface ThinkpagesPostProps {
  post: any;
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
  compact?: boolean;
  showThread?: boolean;
  isHero?: boolean;
}

const ThinkpagesPostComponent = ({
  post,
  currentUserAccountId = "",
  accounts = [],
  countryId = "",
  isOwner = false,
  onAccountSelect,
  onAccountSettings,
  onCreateAccount,
  onLike,
  onRepost,
  onReply,
  onShare,
  onReaction,
  onAccountClick,
  compact = false,
  showThread = false,
  isHero = false,
}: ThinkpagesPostProps) => {
  const {
    blurbMeta,
    isOwnPost,
    canEdit,
    canDelete,
    visualizations,
    mediaAttachments,
    cleanPostContent,
    sportsBulletin,
    repostMediaAttachments,
    cleanRepostContent,
    showReplies,
    setShowReplies,
    threadQuery,
    showMoreOptions,
    setShowMoreOptions,
    showReplyComposer,
    setShowReplyComposer,
    replyText,
    setReplyText,
    showEditComposer,
    setShowEditComposer,
    editText,
    setEditText,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showFlagDialog,
    setShowFlagDialog,
    flagReason,
    setFlagReason,
    showReactionsDialog,
    setShowReactionsDialog,
    lightboxMedia,
    setLightboxMedia,
    apiDiscordEmojis,
    createPostMutation,
    updatePostMutation,
    deletePostMutation,
    flagPostMutation,
    handlePin,
    handleBookmark,
    handleFlag,
    handleSubmitFlag,
    handleEdit,
    handleSubmitEdit,
    handleDelete,
    handleConfirmDelete,
    handleReply,
    handleSubmitReply,
    notify,
  } = useThinkpagesPost(post, currentUserAccountId, showThread);

  if (isHero) {
    return (
      <HeroPostView
        post={post}
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
        blurbMeta={blurbMeta}
        cleanPostContent={cleanPostContent}
        sportsBulletin={sportsBulletin}
        mediaAttachments={mediaAttachments}
        visualizations={visualizations}
        setLightboxMedia={setLightboxMedia}
        showMoreOptions={showMoreOptions}
        setShowMoreOptions={setShowMoreOptions}
        canEdit={canEdit}
        canDelete={canDelete}
        isOwnPost={isOwnPost}
        handleEdit={handleEdit}
        handlePin={handlePin}
        handleBookmark={handleBookmark}
        handleFlag={handleFlag}
        handleDelete={handleDelete}
        proxyDiscordUrl={proxyDiscordUrl}
      />
    );
  }

  return (
    <StandardPostView
      post={post}
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
      compact={compact}
      showThread={showThread}
      blurbMeta={blurbMeta}
      isOwnPost={isOwnPost}
      canEdit={canEdit}
      canDelete={canDelete}
      visualizations={visualizations}
      mediaAttachments={mediaAttachments}
      cleanPostContent={cleanPostContent}
      sportsBulletin={sportsBulletin}
      repostMediaAttachments={repostMediaAttachments}
      cleanRepostContent={cleanRepostContent}
      showReplies={showReplies}
      setShowReplies={setShowReplies}
      threadQuery={threadQuery}
      showMoreOptions={showMoreOptions}
      setShowMoreOptions={setShowMoreOptions}
      showReplyComposer={showReplyComposer}
      setShowReplyComposer={setShowReplyComposer}
      replyText={replyText}
      setReplyText={setReplyText}
      showEditComposer={showEditComposer}
      setShowEditComposer={setShowEditComposer}
      editText={editText}
      setEditText={setEditText}
      showDeleteConfirm={showDeleteConfirm}
      setShowDeleteConfirm={setShowDeleteConfirm}
      showFlagDialog={showFlagDialog}
      setShowFlagDialog={setShowFlagDialog}
      flagReason={flagReason}
      setFlagReason={setFlagReason}
      showReactionsDialog={showReactionsDialog}
      setShowReactionsDialog={setShowReactionsDialog}
      lightboxMedia={lightboxMedia}
      setLightboxMedia={setLightboxMedia}
      apiDiscordEmojis={apiDiscordEmojis}
      createPostMutation={createPostMutation}
      updatePostMutation={updatePostMutation}
      deletePostMutation={deletePostMutation}
      flagPostMutation={flagPostMutation}
      handlePin={handlePin}
      handleBookmark={handleBookmark}
      handleFlag={handleFlag}
      handleSubmitFlag={handleSubmitFlag}
      handleEdit={handleEdit}
      handleSubmitEdit={handleSubmitEdit}
      handleDelete={handleDelete}
      handleConfirmDelete={handleConfirmDelete}
      handleReply={handleReply}
      handleSubmitReply={handleSubmitReply}
      notify={notify}
      proxyDiscordUrl={proxyDiscordUrl}
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
