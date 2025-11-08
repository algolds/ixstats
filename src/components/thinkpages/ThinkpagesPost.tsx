"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { useRelativeTime } from "~/hooks/useRelativeTime";
import {
  MoreHorizontal,
  Pin,
  Bookmark,
  Flag,
  Verified,
  Smile,
  Angry,
  ThumbsUp,
  ThumbsDown,
  Flame,
  Heart,
  Edit,
  Trash2,
  Crown,
  Newspaper,
  Users,
  Repeat2,
  MessageCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { PostActions } from "./primitives/PostActions";
import { AccountIndicator } from "./primitives/AccountIndicator";
import { ReactionsDialog } from "./ReactionsDialog";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { formatContentEnhanced, extractHashtags, extractMentions } from "~/lib/text-formatter";

interface ThinkpagesPostProps {
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
}

function RelativeTimestamp({ timestamp }: { timestamp: Date | string | number }) {
  const relativeTime = useRelativeTime(timestamp);
  const date = new Date(timestamp);
  const now = new Date();
  const hoursDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  return (
    <span
      className="text-muted-foreground cursor-help text-sm"
      title={`IxTime: ${date.toLocaleString()}`}
    >
      {hoursDiff > 24 ? date.toLocaleDateString() : relativeTime}
    </span>
  );
}

const ACCOUNT_TYPE_ICONS = {
  government: Crown,
  media: Newspaper,
  citizen: Users,
};

const ACCOUNT_TYPE_COLORS = {
  government: "text-amber-500 bg-amber-500/20",
  media: "text-blue-500 bg-blue-500/20",
  citizen: "text-green-500 bg-green-500/20",
};

const REACTION_ICONS: { [key: string]: React.ElementType } = {
  like: Heart,
  laugh: Smile,
  angry: Angry,
  fire: Flame,
  thumbsup: ThumbsUp,
  thumbsdown: ThumbsDown,
};

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
}: ThinkpagesPostProps) => {
  const [showReplies, setShowReplies] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showReplyComposer, setShowReplyComposer] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showEditComposer, setShowEditComposer] = useState(false);
  const [editText, setEditText] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [showReactionsDialog, setShowReactionsDialog] = useState(false);

  // Close more options when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMoreOptions) {
        setShowMoreOptions(false);
      }
    };

    if (showMoreOptions) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showMoreOptions]);

  const addReactionMutation = api.thinkpages.addReaction.useMutation();
  const removeReactionMutation = api.thinkpages.removeReaction.useMutation();
  const createPostMutation = api.thinkpages.createPost.useMutation();
  const updatePostMutation = api.thinkpages.updatePost.useMutation();
  const deletePostMutation = api.thinkpages.deletePost.useMutation();
  const pinPostMutation = api.thinkpages.pinPost.useMutation();
  const bookmarkPostMutation = api.thinkpages.bookmarkPost.useMutation();
  const flagPostMutation = api.thinkpages.flagPost.useMutation();

  const handlePin = useCallback(async () => {
    if (!currentUserAccountId) return;
    try {
      await pinPostMutation.mutateAsync({
        postId: post.id,
        accountId: currentUserAccountId,
        pinned: !post.pinned,
      });
      toast.success(post.pinned ? "Post unpinned" : "Post pinned");
    } catch (error: any) {
      toast.error(error.message || "Failed to pin post");
    }
  }, [pinPostMutation, post.id, post.pinned, currentUserAccountId]);

  const handleBookmark = useCallback(async () => {
    if (!currentUserAccountId) return;
    try {
      await bookmarkPostMutation.mutateAsync({
        postId: post.id,
        userId: currentUserAccountId,
        bookmarked: true,
      });
      toast.success("Post bookmarked");
    } catch (error: any) {
      toast.error(error.message || "Failed to bookmark post");
    }
  }, [bookmarkPostMutation, post.id, currentUserAccountId]);

  const handleFlag = useCallback(() => {
    if (!currentUserAccountId) return;
    setShowFlagDialog(true);
    setShowMoreOptions(false);
  }, [currentUserAccountId]);

  const handleSubmitFlag = useCallback(async () => {
    if (!flagReason.trim()) return;

    try {
      await flagPostMutation.mutateAsync({
        postId: post.id,
        userId: currentUserAccountId,
        reason: flagReason,
      });
      toast.success("Post flagged");
      setShowFlagDialog(false);
      setFlagReason("");
    } catch (error: any) {
      toast.error(error.message || "Failed to flag post");
    }
  }, [flagPostMutation, post.id, currentUserAccountId, flagReason]);

  const handleEdit = useCallback(() => {
    if (!currentUserAccountId || post.account.id !== currentUserAccountId) return;
    setEditText(post.content);
    setShowEditComposer(true);
    setShowMoreOptions(false);
  }, [post.content, post.account.id, currentUserAccountId]);

  const handleSubmitEdit = useCallback(async () => {
    if (!editText.trim() || editText === post.content) {
      setShowEditComposer(false);
      return;
    }

    try {
      await updatePostMutation.mutateAsync({
        postId: post.id,
        content: editText,
      });
      toast.success("Post updated");
      setShowEditComposer(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update post");
    }
  }, [updatePostMutation, post.id, editText, post.content, currentUserAccountId]);

  const handleDelete = useCallback(() => {
    if (!currentUserAccountId || post.account.id !== currentUserAccountId) return;
    setShowDeleteConfirm(true);
    setShowMoreOptions(false);
  }, [post.account.id, currentUserAccountId]);

  const handleConfirmDelete = useCallback(async () => {
    try {
      await deletePostMutation.mutateAsync({
        postId: post.id,
      });
      toast.success("Post deleted");
      setShowDeleteConfirm(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete post");
    }
  }, [deletePostMutation, post.id, currentUserAccountId]);

  const handleReply = useCallback(() => {
    setShowReplyComposer(!showReplyComposer);
    if (!showReplyComposer) {
      // Enhanced @ mention with proper formatting
      const mentionText = `@${post.account.username} `;
      setReplyText(mentionText);
      // Auto-focus the reply input after a short delay
      setTimeout(() => {
        const replyInput = document.querySelector("[data-reply-input]") as HTMLTextAreaElement;
        if (replyInput) {
          replyInput.focus();
          replyInput.setSelectionRange(mentionText.length, mentionText.length);
        }
      }, 100);
    }
  }, [showReplyComposer, post.account.username]);

  const handleSubmitReply = useCallback(async () => {
    if (!replyText.trim() || !currentUserAccountId) return;

    try {
      // Enhanced reply with hashtag and mention extraction
      await createPostMutation.mutateAsync({
        accountId: currentUserAccountId,
        content: replyText,
        parentPostId: post.id,
        visibility: "public",
        hashtags: extractHashtags(replyText),
        mentions: extractMentions(replyText),
      });
      toast.success("Reply posted!");
      setReplyText("");
      setShowReplyComposer(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to post reply");
    }
  }, [createPostMutation, replyText, currentUserAccountId, post.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm transition-all hover:bg-white/10",
        compact ? "p-3" : "p-4",
        post.pinned && "border-amber-500/30 bg-amber-500/5"
      )}
    >
      {post.pinned && (
        <div className="mb-3 flex items-center gap-2 text-sm text-amber-500">
          <Pin className="h-4 w-4" />
          <span>Pinned Post</span>
        </div>
      )}

      {post.postType === "repost" && (
        <div className="mb-3 flex items-center gap-2 text-sm text-green-500">
          <Repeat2 className="h-4 w-4" />
          <span>@{post.account.username} reposted</span>
        </div>
      )}

      {post.postType === "reply" && post.parentPost && (
        <div className="mb-3">
          <div className="mb-2 flex items-center gap-2 text-sm text-blue-500">
            <MessageCircle className="h-4 w-4" />
            <span>Replying to @{post.parentPost.account.username}</span>
          </div>
          {/* Twitter-style parent post context */}
          <div className="ml-4 space-y-2 border-l-2 border-blue-500/30 pl-4">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={post.parentPost.account.profileImageUrl} />
                <AvatarFallback
                  className={`text-xs font-semibold ${ACCOUNT_TYPE_COLORS[post.parentPost.account.accountType as keyof typeof ACCOUNT_TYPE_COLORS] || "bg-gray-500/20 text-gray-500"}`}
                >
                  {post.parentPost.account.displayName
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-semibold">{post.parentPost.account.displayName}</span>
              <span className="text-muted-foreground text-xs">
                @{post.parentPost.account.username}
              </span>
            </div>
            <div
              className="text-muted-foreground line-clamp-3 text-sm"
              // SECURITY: formatContentEnhanced now includes sanitizeUserContent to prevent XSS
              dangerouslySetInnerHTML={{ __html: formatContentEnhanced(post.parentPost.content) }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => onAccountClick?.(post.account.id)} className="flex-shrink-0">
          <Avatar className={compact ? "h-8 w-8" : "h-10 w-10"}>
            <AvatarImage src={post.account.profileImageUrl} />
            <AvatarFallback
              className={`font-semibold ${ACCOUNT_TYPE_COLORS[post.account.accountType as keyof typeof ACCOUNT_TYPE_COLORS] || "bg-gray-500/20 text-gray-500"}`}
            >
              {post.account.displayName
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </button>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <button
              onClick={() => onAccountClick?.(post.account.id)}
              className="font-semibold hover:underline"
            >
              {post.account.displayName}
            </button>

            {post.account.verified && <Verified className="h-4 w-4 fill-current text-blue-500" />}

            <div
              className={`rounded p-1 ${ACCOUNT_TYPE_COLORS[post.account.accountType as keyof typeof ACCOUNT_TYPE_COLORS] || "bg-gray-500/20 text-gray-500"}`}
            >
              {React.createElement(
                ACCOUNT_TYPE_ICONS[post.account.accountType as keyof typeof ACCOUNT_TYPE_ICONS] ||
                  Users,
                { className: "h-3 w-3" }
              )}
            </div>

            <span className="text-muted-foreground text-sm">@{post.account.username}</span>

            <span className="text-muted-foreground text-sm">·</span>

            <RelativeTimestamp timestamp={post.timestamp} />

            {post.trending && (
              <Badge variant="secondary" className="bg-orange-500/20 text-xs text-orange-400">
                Trending
              </Badge>
            )}
          </div>

          <div className={cn("mb-3", compact ? "text-sm" : "text-base")}>
            {post.repostOf ? (
              <Card className="rounded-lg border-green-500/30 bg-green-500/10 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={post.repostOf.account.profileImageUrl} />
                    <AvatarFallback className="text-xs font-semibold">
                      {post.repostOf.account.displayName
                        ?.split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-semibold">{post.repostOf.account.displayName}</span>
                  <span className="text-muted-foreground text-xs">
                    @{post.repostOf.account.username}
                  </span>
                </div>
                {/* SECURITY: formatContentEnhanced now includes sanitizeUserContent to prevent XSS */}
                <div
                  dangerouslySetInnerHTML={{ __html: formatContentEnhanced(post.repostOf.content) }}
                />
              </Card>
            ) : (
              /* SECURITY: formatContentEnhanced now includes sanitizeUserContent to prevent XSS */
              <div dangerouslySetInnerHTML={{ __html: formatContentEnhanced(post.content) }} />
            )}
          </div>

          {/* Media Attachments */}
          {post.mediaAttachments && post.mediaAttachments.length > 0 && (
            <div
              className={cn(
                "mt-3 overflow-hidden rounded-lg",
                post.mediaAttachments.length === 1 && "max-w-md",
                post.mediaAttachments.length === 2 && "grid grid-cols-2 gap-1",
                post.mediaAttachments.length === 3 && "grid grid-cols-2 gap-1",
                post.mediaAttachments.length === 4 && "grid grid-cols-2 gap-1"
              )}
            >
              {post.mediaAttachments.map((media: any, index: number) => (
                <div
                  key={media.id}
                  className={cn(
                    "bg-muted relative overflow-hidden rounded-lg",
                    post.mediaAttachments.length === 1 && "aspect-video",
                    post.mediaAttachments.length === 2 && "aspect-square",
                    post.mediaAttachments.length === 3 && index === 0
                      ? "col-span-2 aspect-video"
                      : "aspect-square",
                    post.mediaAttachments.length === 4 && "aspect-square"
                  )}
                >
                  <img
                    src={media.url}
                    alt={media.filename || `Image ${index + 1}`}
                    className="h-full w-full cursor-pointer object-cover transition-opacity hover:opacity-90"
                    onClick={() => {
                      // Open image in new tab
                      window.open(media.url, "_blank");
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {post.hashtags && post.hashtags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {post.hashtags.map((hashtag: string, index: number) => (
                <button key={index} className="text-sm text-blue-500 hover:underline">
                  #{hashtag}
                </button>
              ))}
            </div>
          )}

          {/* Debug PostActions props */}
          {(() => {
            const isLikedValue = post.reactions?.some(
              (r: any) => r.accountId === currentUserAccountId && r.reactionType === "like"
            );
            const reactionCountsValue = (() => {
              try {
                if (typeof post.reactionCounts === "string") {
                  return JSON.parse(post.reactionCounts);
                }
                return post.reactionCounts || {};
              } catch (error) {
                console.warn("Failed to parse reactionCounts:", error);
                return {};
              }
            })();

            console.log("📤 ThinkpagesPost passing props to PostActions:", {
              postId: post.id,
              currentUserAccountId,
              isLiked: isLikedValue,
              likeCount: post.likeCount,
              reactionsCount: post.reactions?.length || 0,
              reactions: post.reactions,
              reactionCounts: reactionCountsValue,
              hasOnLike: !!onLike,
              hasOnReaction: !!onReaction,
              postAccountId: post.account?.id,
              postAccountUsername: post.account?.username,
            });

            return null;
          })()}

          <PostActions
            postId={post.id}
            currentUserAccountId={currentUserAccountId}
            post={post}
            accounts={accounts}
            countryId={countryId}
            isOwner={isOwner}
            onAccountSelect={onAccountSelect}
            onAccountSettings={onAccountSettings}
            onCreateAccount={onCreateAccount}
            isLiked={post.reactions?.some(
              (r: any) => r.accountId === currentUserAccountId && r.reactionType === "like"
            )}
            isReposted={false} // TODO: Track repost status
            likeCount={post.likeCount}
            repostCount={post.repostCount}
            replyCount={post.replyCount}
            reactions={post.reactions || []}
            reactionCounts={(() => {
              try {
                if (typeof post.reactionCounts === "string") {
                  return JSON.parse(post.reactionCounts);
                }
                return post.reactionCounts || {};
              } catch (error) {
                console.warn("Failed to parse reactionCounts:", error);
                return {};
              }
            })()}
            onLike={onLike}
            onRepost={onRepost}
            onReply={() => handleReply()}
            onShare={() => {
              const postUrl = `${window.location.origin}/thinkpages/post/${post.id}`;
              if (navigator.share) {
                navigator
                  .share({
                    title: `Post by @${post.account.username}`,
                    text: post.content.substring(0, 100),
                    url: postUrl,
                  })
                  .catch(() => {
                    // Fallback to clipboard if share fails
                    navigator.clipboard.writeText(postUrl);
                    toast.success("Post link copied to clipboard!");
                  });
              } else {
                navigator.clipboard.writeText(postUrl);
                toast.success("Post link copied to clipboard!");
              }
              onShare?.(post.id);
            }}
            onReaction={onReaction}
            showCounts={true}
            size="md"
          />

          <div className="flex items-center justify-end">
            <div className="relative">
              <button
                onClick={() => setShowMoreOptions(!showMoreOptions)}
                className="text-muted-foreground hover:text-foreground rounded-full p-2 transition-colors hover:bg-white/10"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              <AnimatePresence>
                {showMoreOptions && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                    className="bg-background border-border absolute right-0 z-[60] mt-2 w-48 rounded-lg border shadow-lg backdrop-blur-sm"
                    style={{ zIndex: 60 }}
                  >
                    {currentUserAccountId === post.account.id && (
                      <>
                        <button
                          onClick={handlePin}
                          className="hover:bg-muted flex w-full items-center gap-2 px-4 py-2 text-left text-sm"
                        >
                          <Pin className="h-4 w-4" />
                          {post.pinned ? "Unpin" : "Pin"}
                        </button>
                        <button
                          onClick={handleEdit}
                          className="hover:bg-muted flex w-full items-center gap-2 px-4 py-2 text-left text-sm"
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          onClick={handleDelete}
                          className="hover:bg-muted text-destructive flex w-full items-center gap-2 px-4 py-2 text-left text-sm"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                        <div className="border-border my-1 border-t"></div>
                      </>
                    )}
                    <button
                      onClick={handleBookmark}
                      className="hover:bg-muted flex w-full items-center gap-2 px-4 py-2 text-left text-sm"
                    >
                      <Bookmark className="h-4 w-4" />
                      Bookmark
                    </button>
                    <button
                      onClick={handleFlag}
                      className="hover:bg-muted flex w-full items-center gap-2 px-4 py-2 text-left text-sm"
                    >
                      <Flag className="h-4 w-4" />
                      Flag
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {(() => {
            try {
              const reactionCounts =
                typeof post.reactionCounts === "string"
                  ? JSON.parse(post.reactionCounts)
                  : post.reactionCounts || {};

              if (reactionCounts && Object.keys(reactionCounts).length > 0) {
                return (
                  <button
                    onClick={() => setShowReactionsDialog(true)}
                    className="hover:bg-muted/30 mt-2 flex w-full items-center gap-2 rounded border-t border-white/10 px-2 py-1 pt-2 transition-colors"
                  >
                    {Object.entries(reactionCounts).map(([type, count]) => {
                      const Icon = REACTION_ICONS[type];
                      if (!Icon || (count as number) === 0) return null;
                      return (
                        <div
                          key={type}
                          className="text-muted-foreground flex items-center gap-1 text-sm"
                        >
                          {React.createElement(Icon, { className: "h-4 w-4" })}
                          <span>{typeof count === "number" ? count : 0}</span>
                        </div>
                      );
                    })}
                  </button>
                );
              }
              return null;
            } catch (error) {
              console.warn("Failed to display reaction counts:", error);
              return null;
            }
          })()}

          {/* Edit Composer */}
          <AnimatePresence>
            {showEditComposer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 rounded-lg border border-amber-500/50 bg-amber-500/5 p-3"
              >
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={post.account.profileImageUrl} />
                    <AvatarFallback
                      className={`font-semibold ${ACCOUNT_TYPE_COLORS[post.account.accountType as keyof typeof ACCOUNT_TYPE_COLORS] || "bg-gray-500/20 text-gray-500"}`}
                    >
                      {post.account.displayName
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <div className="mb-2 flex items-center gap-2 text-amber-600">
                      <Edit className="h-4 w-4" />
                      <span className="text-sm font-medium">Editing post</span>
                    </div>
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      placeholder="Edit your post..."
                      className="min-h-[80px] resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleSubmitEdit();
                        }
                        if (e.key === "Escape") {
                          setShowEditComposer(false);
                        }
                      }}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowEditComposer(false)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSubmitEdit}
                        disabled={
                          !editText.trim() ||
                          editText === post.content ||
                          updatePostMutation.isPending
                        }
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        {updatePostMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reply Composer */}
          <AnimatePresence>
            {showReplyComposer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border-border bg-muted/30 mt-3 rounded-lg border p-3"
              >
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>You</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <Textarea
                      data-reply-input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={`Reply to @${post.account.username}`}
                      className="min-h-[60px] resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleSubmitReply();
                        }
                      }}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowReplyComposer(false)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSubmitReply}
                        disabled={!replyText.trim() || createPostMutation.isPending}
                      >
                        {createPostMutation.isPending ? "Replying..." : "Reply"}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {showThread && post.replyCount > 0 && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="mt-2 text-sm text-blue-500 hover:underline"
            >
              {showReplies ? "Hide" : "Show"} {post.replyCount}{" "}
              {post.replyCount === 1 ? "reply" : "replies"}
            </button>
          )}

          {/* Delete Confirmation Dialog */}
          <AnimatePresence>
            {showDeleteConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                onClick={() => setShowDeleteConfirm(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-background border-border mx-4 max-w-md rounded-lg border p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="rounded-full bg-red-500/20 p-2">
                      <Trash2 className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Delete Post</h3>
                      <p className="text-muted-foreground text-sm">This action cannot be undone.</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleConfirmDelete}
                      disabled={deletePostMutation.isPending}
                    >
                      {deletePostMutation.isPending ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Flag Dialog */}
          <AnimatePresence>
            {showFlagDialog && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                onClick={() => setShowFlagDialog(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-background border-border mx-4 max-w-md rounded-lg border p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="rounded-full bg-orange-500/20 p-2">
                      <Flag className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Flag Post</h3>
                      <p className="text-muted-foreground text-sm">
                        Help us understand what's wrong.
                      </p>
                    </div>
                  </div>
                  <Textarea
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    placeholder="Why are you flagging this post?"
                    className="mb-4"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowFlagDialog(false);
                        setFlagReason("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmitFlag}
                      disabled={!flagReason.trim() || flagPostMutation.isPending}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      {flagPostMutation.isPending ? "Flagging..." : "Flag Post"}
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reactions Dialog */}
          <ReactionsDialog
            postId={post.id}
            isOpen={showReactionsDialog}
            onClose={() => setShowReactionsDialog(false)}
            onAccountClick={onAccountClick}
          />
        </div>
      </div>
    </motion.div>
  );
};

// Memoize the component for better performance in virtualized lists
export const ThinkpagesPost = React.memo(ThinkpagesPostComponent, (prevProps, nextProps) => {
  // Custom comparison function to optimize re-renders
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.currentUserAccountId === nextProps.currentUserAccountId &&
    prevProps.post.updatedAt === nextProps.post.updatedAt &&
    JSON.stringify(prevProps.post.reactionCounts) ===
      JSON.stringify(nextProps.post.reactionCounts) &&
    prevProps.post._count?.replies === nextProps.post._count?.replies
  );
});

ThinkpagesPost.displayName = "ThinkpagesPost";
