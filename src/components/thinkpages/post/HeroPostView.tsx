"use client";

import React from "react";
import { motion } from "motion/react";
// oxlint-disable-next-line eslint/no-unused-vars
import { MoreHoriz as MoreHorizontal, Pin, Bookmark, WhiteFlag as Flag, EditPencil as Edit, Trash as Trash2, Journal as Newspaper, Group as Users } from "iconoir-react";
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
import { FeedPollWidget } from "~/components/ui/FeedPollWidget";
import { PostInlineLinkPreview, getInlinePreviewLink } from "./PostInlineLinkPreview";
import { LiveDataCard } from "../LiveDataCard";
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
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="group relative space-y-4 overflow-hidden rounded-2xl border border-border/60 bg-card/85 p-5 shadow-sm backdrop-blur-2xl transition-all duration-200 hover:border-border hover:bg-card/95 hover:shadow-md"
    >
      {/* Header section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onAccountClick?.(post.account.id)}
            className="shrink-0 transition-transform hover:scale-105"
          >
            <Avatar className="border-border/40 h-12 w-12 border">
              <AvatarImage src={proxyDiscordUrl(post.account.profileImageUrl)} />
              <AvatarFallback
                className={`text-sm font-semibold ${ACCOUNT_TYPE_COLORS[post.account.accountType as keyof typeof ACCOUNT_TYPE_COLORS] || "bg-gray-500/20 text-gray-500"}`}
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
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => onAccountClick?.(post.account.id)}
                className="text-base leading-snug font-bold text-slate-100 hover:underline"
              >
                {post.account.displayName}
              </button>
              {post.account.verified && (
                <span
                  className="inline-flex h-4 w-4 items-center justify-center text-sm"
                  title="Verified"
                >
                  ✅
                </span>
              )}
              {post.account.country && (
                <span className="border-border/40 bg-muted/40 text-muted-foreground inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium">
                  {post.account.country.flag && (
                    <img
                      src={normalizeFlagUrl(post.account.country.flag) ?? undefined}
                      alt=""
                      className="h-2.5 w-3.5 rounded-sm object-cover"
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
              <span className="text-muted-foreground text-sm">@{post.account.username}</span>
              <span className="text-muted-foreground/60 text-xs">·</span>
              <div
                className={cn(
                  "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase",
                  ACCOUNT_TYPE_COLORS[
                    post.account.accountType as keyof typeof ACCOUNT_TYPE_COLORS
                  ] || "bg-gray-500/20 text-gray-500"
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
                className="text-muted-foreground hover:bg-accent/20 hover:text-foreground h-9 w-9 rounded-full"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-border/60 bg-card/95 w-56 backdrop-blur-xl"
            >
              {canEdit && (
                <DropdownMenuItem onClick={handleEdit} className="text-foreground hover:bg-accent/20">
                  <Edit className="mr-2 h-4 w-4" />
                  <span>Edit Post</span>
                </DropdownMenuItem>
              )}
              {currentUserAccountId && (
                <>
                  <DropdownMenuItem
                    onClick={handlePin}
                    className="text-foreground hover:bg-accent/20"
                  >
                    <Pin className="mr-2 h-4 w-4" />
                    <span>{post.pinned ? "Unpin Post" : "Pin Post"}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleBookmark}
                    className="text-foreground hover:bg-accent/20"
                  >
                    <Bookmark className="mr-2 h-4 w-4" />
                    <span>Bookmark Post</span>
                  </DropdownMenuItem>
                </>
              )}
              {currentUserAccountId && !isOwnPost && (
                <DropdownMenuItem
                  onClick={handleFlag}
                  className="text-red-400 hover:bg-red-500/20 hover:text-red-300"
                >
                  <Flag className="mr-2 h-4 w-4" />
                  <span>Report Post</span>
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator className="bg-border/40" />
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="font-medium text-red-500 hover:bg-red-500/20 hover:text-red-400"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete Post</span>
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
              className="text-sm font-medium text-blue-400 hover:text-blue-300 hover:underline"
            >
              #{hashtag}
            </button>
          ))}
        </div>
      )}

      {/* Timestamp Row */}
      <div className="text-muted-foreground py-1 text-sm">
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
      <div className="border-border/40 text-muted-foreground flex gap-4 border-t border-b py-3 text-sm font-medium">
        <div>
          <span className="text-foreground font-bold">{post.likeCount || 0}</span>
          <span className="text-muted-foreground ml-1 font-normal">Likes</span>
        </div>
        <div>
          <span className="text-foreground font-bold">{post.repostCount || 0}</span>
          <span className="text-muted-foreground ml-1 font-normal">Reposts</span>
        </div>
        <div>
          <span className="text-foreground font-bold">{post.replyCount || 0}</span>
          <span className="text-muted-foreground ml-1 font-normal">Replies</span>
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
