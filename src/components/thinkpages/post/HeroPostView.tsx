"use client";

import React from "react";
import { springGentle } from "~/lib/design/motion";
import { motion } from "motion/react";
// oxlint-disable-next-line eslint/no-unused-vars
import {
  MoreHoriz as MoreHorizontal,
  Pin,
  Bookmark,
  WhiteFlag as Flag,
  EditPencil as Edit,
  Trash as Trash2,
  Journal as Newspaper,
  Group as Users,
} from "iconoir-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import { PostBody } from "./PostBody";
import { PostMediaGrid } from "./PostMediaGrid";
import { PostActions } from "../primitives/PostActions";
import { FeedPollWidget } from "~/components/shared/polls/FeedPollWidget";
import { PostInlineLinkPreview, getInlinePreviewLink } from "./PostInlineLinkPreview";
import { LiveDataCard } from "../LiveDataCard";
import { PersonaAuthorCard } from "../PersonaAuthorCard";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { cn } from "~/lib/utils";

import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_COLORS } from "./ThinkpagesPostUtils";

export interface HeroPostViewProps {
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
  blurbMeta: any;
  cleanPostContent: string;
  sportsBulletin: any;
  mediaAttachments: any[];
  visualizations: any[];
  setLightboxMedia: (media: { url: string; id: string } | null) => void;
  showMoreOptions: boolean;
  setShowMoreOptions: (val: boolean) => void;
  canEdit: boolean;
  canDelete: boolean;
  isOwnPost: boolean;
  handleEdit: () => void;
  handlePin: () => void;
  handleBookmark: () => void;
  handleFlag: () => void;
  handleDelete: () => void;
  proxyDiscordUrl: (url: string) => string;
}

export function HeroPostView({
  post,
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
  blurbMeta,
  cleanPostContent,
  sportsBulletin,
  mediaAttachments,
  visualizations,
  setLightboxMedia,
  showMoreOptions,
  setShowMoreOptions,
  canEdit,
  canDelete,
  isOwnPost,
  handleEdit,
  handlePin,
  handleBookmark,
  handleFlag,
  handleDelete,
  proxyDiscordUrl,
}: HeroPostViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springGentle}
      className="group bg-surface border-separator shadow-card text-label rounded-card relative space-y-4 overflow-hidden border p-5"
    >
      {/* Header section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onAccountClick?.(post.account.id)}
            className="shrink-0 transition-transform hover:scale-105"
          >
            <Avatar className="border-separator h-12 w-12 border">
              <AvatarImage src={proxyDiscordUrl(post.account.profileImageUrl)} />
              <AvatarFallback
                className={`text-headline ${ACCOUNT_TYPE_COLORS[post.account.accountType as keyof typeof ACCOUNT_TYPE_COLORS] || "bg-fill-2 text-label-secondary"}`}
              >
                {post.account.displayName
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <PersonaAuthorCard username={post.account.username ?? ""}>
                <button
                  onClick={() => onAccountClick?.(post.account.id)}
                  className="text-headline text-label leading-snug hover:underline"
                >
                  {post.account.displayName}
                </button>
              </PersonaAuthorCard>
              {post.account.verified && (
                <span
                  className="text-body inline-flex h-4 w-4 items-center justify-center"
                  title="Verified"
                >
                  ✅
                </span>
              )}
              {post.account.country && (
                <span className="border-separator bg-fill-4 text-label-secondary rounded-control-sm text-caption inline-flex items-center gap-1 border px-2 py-0.5">
                  {post.account.country.flag && (
                    <img
                      src={normalizeFlagUrl(post.account.country.flag) ?? undefined}
                      alt=""
                      className="rounded-control-sm h-2.5 w-3.5 object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  {post.account.country.name}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-label-secondary text-body">@{post.account.username}</span>
              <span className="text-label-tertiary text-footnote">·</span>
              <div
                className={cn(
                  "rounded-control-sm text-caption flex items-center gap-1 px-2 py-0.5",
                  ACCOUNT_TYPE_COLORS[
                    post.account.accountType as keyof typeof ACCOUNT_TYPE_COLORS
                  ] || "bg-fill-2 text-label-secondary"
                )}
              >
                {React.createElement(
                  ACCOUNT_TYPE_ICONS[post.account.accountType as keyof typeof ACCOUNT_TYPE_ICONS] ||
                    Users,
                  { className: "h-2.5 w-2.5" }
                )}
                <span>{post.account.accountType}</span>
              </div>
            </div>
          </div>
        </div>

        {/* More options dropdown menu */}
        <div className="relative">
          <DropdownMenu open={showMoreOptions} onOpenChange={setShowMoreOptions}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-label-secondary hover:bg-fill-4 hover:text-label size-9 rounded-full"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-separator bg-surface w-56">
              {canEdit && (
                <DropdownMenuItem onClick={handleEdit} className="text-label hover:bg-fill-4">
                  <Edit />
                  <span>Edit post</span>
                </DropdownMenuItem>
              )}
              {currentUserAccountId && (
                <>
                  <DropdownMenuItem onClick={handlePin} className="text-label hover:bg-fill-4">
                    <Pin />
                    <span>{post.pinned ? "Unpin post" : "Pin post"}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBookmark} className="text-label hover:bg-fill-4">
                    <Bookmark />
                    <span>Bookmark post</span>
                  </DropdownMenuItem>
                </>
              )}
              {currentUserAccountId && !isOwnPost && (
                <DropdownMenuItem
                  onClick={handleFlag}
                  className="text-red hover:bg-red/20 hover:text-red"
                >
                  <Flag />
                  <span>Report post</span>
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator className="bg-border/40" />
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-red hover:bg-red/20 hover:text-red font-medium"
                  >
                    <Trash2 />
                    <span>Delete post</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content body */}
      <PostBody
        content={post.content}
        cleanContent={cleanPostContent}
        blurbMeta={blurbMeta}
        sportsBulletin={sportsBulletin}
        account={post.account}
        isHero={true}
      />

      {/* Media attachments */}
      <PostMediaGrid
        mediaAttachments={mediaAttachments}
        postId={post.id}
        onOpenLightbox={(m) => setLightboxMedia(m)}
      />

      {/* Embedded Visualizations */}
      {visualizations && visualizations.length > 0 && (
        <div className="mt-3 space-y-3">
          {visualizations.map((viz: any, index: number) => (
            <LiveDataCard
              key={viz.id || index}
              type={viz.type}
              title={viz.title}
              countryId={post.account.countryId || post.account.country?.id || ""}
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

      {/* Hashtags */}
      {Array.isArray(post.hashtags) && post.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {post.hashtags.map((hashtag: string, index: number) => (
            <button
              key={index}
              className="text-body text-blue hover:text-blue font-medium hover:underline"
            >
              #{hashtag}
            </button>
          ))}
        </div>
      )}

      {/* Timestamp Row */}
      <div className="text-label-secondary text-body py-1">
        {new Date(post.timestamp).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })}
        {" · "}
        {new Date(post.timestamp).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
        {" · ixTime"}
      </div>

      {/* Status Counters Row */}
      <div className="border-separator text-label-secondary text-body flex gap-4 border-t border-b py-3 font-medium">
        <div>
          <span className="text-label font-semibold">{post.likeCount || 0}</span>
          <span className="text-label-secondary ml-1 font-normal">Likes</span>
        </div>
        <div>
          <span className="text-label font-semibold">{post.repostCount || 0}</span>
          <span className="text-label-secondary ml-1 font-normal">Reposts</span>
        </div>
        <div>
          <span className="text-label font-semibold">{post.replyCount || 0}</span>
          <span className="text-label-secondary ml-1 font-normal">Replies</span>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="py-1">
        <PostActions
          postId={post.id}
          currentUserAccountId={currentUserAccountId}
          post={post}
          accounts={accounts ?? []}
          countryId={countryId ?? ""}
          isOwner={isOwner ?? false}
          onAccountSelect={onAccountSelect}
          onAccountSettings={onAccountSettings}
          onCreateAccount={onCreateAccount}
          isLiked={post.reactions?.some(
            (r: any) => r.accountId === currentUserAccountId && r.reactionType === "like"
          )}
          isReposted={post.reposts?.some((r: any) => r.accountId === currentUserAccountId) ?? false}
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
            } catch {
              return {};
            }
          })()}
          onLike={onLike}
          onRepost={onRepost}
          onReply={onReply}
          onShare={onShare}
          onReaction={onReaction}
          showCounts={false}
          size="lg"
          className="w-full justify-around"
        />
      </div>
    </motion.div>
  );
}
