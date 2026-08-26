"use client";

import React from "react";
import { motion } from "motion/react";
// oxlint-disable-next-line eslint/no-unused-vars
import { MoreHoriz as MoreHorizontal, Pin, Bookmark, OpenBook as BookOpen, WhiteFlag as Flag, EditPencil as Edit, Trash as Trash2, Journal as Newspaper, Group as Users, Refresh as Repeat2, ChatBubble as MessageCircle } from "iconoir-react";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import { PostActions } from "../primitives/PostActions";
import { PostBody } from "./PostBody";
import { PostMediaGrid } from "./PostMediaGrid";
import { PostComposers } from "./PostComposers";
import { PostModals } from "./PostModals";
import { RepostCard } from "./RepostCard";
import { ReactionPills } from "./ReactionPills";
import { ThreadReplies } from "./ThreadReplies";
import { LiveDataCard } from "../LiveDataCard";
import { FeedPollWidget } from "~/components/ui/FeedPollWidget";
import { PostInlineLinkPreview, getInlinePreviewLink } from "./PostInlineLinkPreview";
import { formatThinkpagesContentForDisplay } from "~/lib/utils";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";

import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_COLORS, RelativeTimestamp } from "./ThinkpagesPostUtils";

export interface StandardPostViewProps {
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

  blurbMeta: any;
  isOwnPost: boolean;
  canEdit: boolean;
  canDelete: boolean;
  visualizations?: any[];
  mediaAttachments?: any[];
  cleanPostContent: string;
  sportsBulletin?: any;
  repostMediaAttachments?: any[];
  cleanRepostContent: string;
  showReplies: boolean;
  setShowReplies: (val: boolean) => void;
  threadQuery: any;
  showMoreOptions: boolean;
  setShowMoreOptions: (val: boolean) => void;
  showReplyComposer: boolean;
  setShowReplyComposer: (val: boolean) => void;
  replyText: string;
  setReplyText: (val: string) => void;
  showEditComposer: boolean;
  setShowEditComposer: (val: boolean) => void;
  editText: string;
  setEditText: (val: string) => void;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (val: boolean) => void;
  showFlagDialog: boolean;
  setShowFlagDialog: (val: boolean) => void;
  flagReason: string;
  setFlagReason: (val: string) => void;
  showReactionsDialog: boolean;
  setShowReactionsDialog: (val: boolean) => void;
  lightboxMedia: { url: string; id: string } | null;
  setLightboxMedia: (val: { url: string; id: string } | null) => void;
  apiDiscordEmojis?: any[];
  createPostMutation: any;
  updatePostMutation: any;
  deletePostMutation: any;
  flagPostMutation: any;

  handlePin: () => void;
  handleBookmark: () => void;
  handleFlag: () => void;
  handleSubmitFlag: () => void;
  handleEdit: () => void;
  handleSubmitEdit: () => void;
  handleDelete: () => void;
  handleConfirmDelete: () => void;
  handleReply: () => void;
  handleSubmitReply: () => void;
  notify: any;
  proxyDiscordUrl: (url: string) => string;
  ThinkpagesPostComponent: React.ComponentType<any>;
}

export function StandardPostView({
  post,
  currentUserAccountId,
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
  // oxlint-disable-next-line eslint/no-unused-vars
  showMoreOptions,
  // oxlint-disable-next-line eslint/no-unused-vars
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
  proxyDiscordUrl,
  ThinkpagesPostComponent,
}: StandardPostViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/50 bg-card/75 backdrop-blur-xl shadow-xs transition-all duration-200 hover:border-border/80 hover:bg-card/95 hover:shadow-md",
        compact ? "p-3" : "p-4",
        post.pinned &&
          "border-amber-500/40 bg-amber-500/5 shadow-amber-500/5 dark:border-amber-500/30 dark:bg-amber-500/5"
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
          <span>@{post.account?.username} reposted</span>
        </div>
      )}

      {post.postType === "reply" && post.parentPost && (
        <div className="mb-3">
          <div className="mb-2 flex items-center gap-2 text-sm text-blue-500">
            <MessageCircle className="h-4 w-4" />
            <span>Replying to @{post.parentPost.account?.username}</span>
          </div>
          <div className="ml-4 space-y-2 border-l-2 border-blue-500/30 pl-4">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage
                  src={proxyDiscordUrl(post.parentPost.account?.profileImageUrl || "")}
                />
                <AvatarFallback
                  className={`text-xs font-semibold ${ACCOUNT_TYPE_COLORS[post.parentPost.account?.accountType as keyof typeof ACCOUNT_TYPE_COLORS] || "bg-gray-500/20 text-gray-500"}`}
                >
                  {(post.parentPost.account?.displayName ?? "U")
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-semibold">{post.parentPost.account?.displayName}</span>
              <span className="text-muted-foreground text-xs">
                @{post.parentPost.account?.username}
              </span>
            </div>
            <WikiHtmlContent
              html={formatThinkpagesContentForDisplay(post.parentPost.content)}
              className="text-muted-foreground line-clamp-3 text-sm"
            />
          </div>
        </div>
      )}

      {blurbMeta.isBlurb && (
        <div className="mb-3 flex items-center gap-2 text-sm text-purple-400">
          <BookOpen className="h-4 w-4" />
          <span className="font-medium">{blurbMeta.promptTitle ?? "Topic Tuesday"}</span>
          {blurbMeta.promptSlug && (
            <Link
              href={withBasePath(`/blurbs/${blurbMeta.promptSlug}`)}
              className="text-purple-400/70 transition-colors hover:text-purple-300"
            >
              View prompt →
            </Link>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => onAccountClick?.(post.account?.id)} className="shrink-0">
          <Avatar className={compact ? "h-8 w-8" : "h-10 w-10"}>
            <AvatarImage src={proxyDiscordUrl(post.account?.profileImageUrl || "")} />
            <AvatarFallback
              className={`font-semibold ${ACCOUNT_TYPE_COLORS[post.account?.accountType as keyof typeof ACCOUNT_TYPE_COLORS] || "bg-gray-500/20 text-gray-500"}`}
            >
              {(post.account?.displayName ?? "U")
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
              onClick={() => onAccountClick?.(post.account?.id)}
              className="font-semibold hover:underline"
            >
              {post.account?.displayName}
            </button>

            {post.account?.verified && (
              <span
                className="inline-flex h-4 w-4 items-center justify-center text-sm leading-none"
                title="Verified"
              >
                ✅
              </span>
            )}

            {post.account?.bio?.startsWith("Former Nation") && (
              <Badge
                variant="secondary"
                className="border-gray-500/30 bg-gray-500/20 text-xs text-gray-400"
              >
                Former Nation
              </Badge>
            )}

            <div
              className={`rounded p-1 ${ACCOUNT_TYPE_COLORS[post.account?.accountType as keyof typeof ACCOUNT_TYPE_COLORS] || "bg-gray-500/20 text-gray-500"}`}
            >
              {React.createElement(
                ACCOUNT_TYPE_ICONS[post.account?.accountType as keyof typeof ACCOUNT_TYPE_ICONS] ||
                  Users,
                { className: "h-3 w-3" }
              )}
            </div>

            <span className="text-muted-foreground text-sm">@{post.account?.username}</span>

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
              <RepostCard
                post={post}
                cleanRepostContent={cleanRepostContent}
                repostMediaAttachments={repostMediaAttachments}
                proxyDiscordUrl={proxyDiscordUrl}
                setLightboxMedia={setLightboxMedia}
              />
            ) : (
              <PostBody
                content={post.content}
                cleanContent={cleanPostContent}
                blurbMeta={blurbMeta}
                sportsBulletin={sportsBulletin}
                account={post.account}
                isHero={false}
              />
            )}
          </div>

          {/* Media Attachments */}
          <PostMediaGrid
            mediaAttachments={mediaAttachments ?? []}
            postId={post.id}
            onOpenLightbox={(m) => setLightboxMedia(m)}
          />

          {/* Embedded Visualizations */}
          {visualizations && visualizations.length > 0 && (
            <div className="mt-3 space-y-2.5">
              {visualizations.map((viz: any, index: number) => (
                <LiveDataCard
                  key={viz.id || index}
                  type={viz.type}
                  title={viz.title}
                  countryId={post.account?.countryId || post.account?.country?.id || ""}
                />
              ))}
            </div>
          )}

          {/* Embedded Poll */}
          {post.poll && <FeedPollWidget poll={post.poll} />}

          {/* Inline Link Previews */}
          {(() => {
            if (sportsBulletin) return null;
            const matchedLink = getInlinePreviewLink(post.content);
            if (matchedLink) {
              return <PostInlineLinkPreview url={matchedLink} />;
            }
            return null;
          })()}

          {Array.isArray(post.hashtags) && post.hashtags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {post.hashtags.map((hashtag: string, index: number) => (
                <button key={index} className="text-sm text-blue-500 hover:underline">
                  #{hashtag}
                </button>
              ))}
            </div>
          )}

          {/* Reactions Row */}
          <ReactionPills
            post={post}
            apiDiscordEmojis={apiDiscordEmojis}
            onOpenReactionsDialog={() => setShowReactionsDialog(true)}
          />

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
            isReposted={
              post.reposts?.some((r: any) => r.accountId === currentUserAccountId) ?? false
            }
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
            onShare={onShare}
            onReaction={onReaction}
            showCounts={true}
            size="md"
          />

          <div className="flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="text-muted-foreground hover:text-foreground rounded-full p-2 transition-colors hover:bg-white/10"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {isOwnPost && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePin();
                    }}
                  >
                    <Pin className="h-4 w-4" />
                    {post.pinned ? "Unpin" : "Pin"}
                  </DropdownMenuItem>
                )}
                {canEdit && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit();
                    }}
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete();
                    }}
                    variant="destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
                {(isOwnPost || canEdit || canDelete) && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBookmark();
                  }}
                >
                  <Bookmark className="h-4 w-4" />
                  Bookmark
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFlag();
                  }}
                >
                  <Flag className="h-4 w-4" />
                  Flag
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Edit & Reply Composers */}
          <PostComposers
            post={post}
            showEditComposer={showEditComposer}
            setShowEditComposer={setShowEditComposer}
            editText={editText}
            setEditText={setEditText}
            handleSubmitEdit={handleSubmitEdit}
            isEditPending={updatePostMutation.isPending}
            showReplyComposer={showReplyComposer}
            setShowReplyComposer={setShowReplyComposer}
            replyText={replyText}
            setReplyText={setReplyText}
            handleSubmitReply={handleSubmitReply}
            isReplyPending={createPostMutation.isPending}
            currentUserAccountId={currentUserAccountId}
            accounts={accounts}
            onAccountSelect={onAccountSelect}
            onCreateAccount={onCreateAccount}
            isOwner={isOwner}
            proxyDiscordUrl={proxyDiscordUrl}
          />

          {/* Thread Replies */}
          <ThreadReplies
            post={post}
            showThread={showThread}
            showReplies={showReplies}
            setShowReplies={setShowReplies}
            threadQuery={threadQuery}
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
            ThinkpagesPostComponent={ThinkpagesPostComponent}
          />

          {/* Modals & Dialogs (Delete, Flag, Reactions, Lightbox) */}
          <PostModals
            post={post}
            showDeleteConfirm={showDeleteConfirm}
            setShowDeleteConfirm={setShowDeleteConfirm}
            handleConfirmDelete={handleConfirmDelete}
            isDeletePending={deletePostMutation.isPending}
            showFlagDialog={showFlagDialog}
            setShowFlagDialog={setShowFlagDialog}
            flagReason={flagReason}
            setFlagReason={setFlagReason}
            handleSubmitFlag={handleSubmitFlag}
            isFlagPending={flagPostMutation.isPending}
            showReactionsDialog={showReactionsDialog}
            setShowReactionsDialog={setShowReactionsDialog}
            onAccountClick={onAccountClick}
            lightboxMedia={lightboxMedia}
            setLightboxMedia={setLightboxMedia}
            notify={notify}
          />
        </div>
      </div>
    </motion.div>
  );
}
