"use client";

import React from "react";
import { motion } from "motion/react";
import {
  MoreHorizontal,
  Pin,
  Bookmark,
  Flag,
  Edit,
  Trash2,
  Crown,
  Newspaper,
  Users,
} from "lucide-react";
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
      className="relative space-y-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-6 shadow-xl backdrop-blur-xl"
    >
      {/* Header section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onAccountClick?.(post.account.id)}
            className="shrink-0 transition-transform hover:scale-105"
          >
            <Avatar className="h-12 w-12 border border-white/10">
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
                <span className="inline-flex items-center gap-1 rounded border border-white/5 bg-white/5 px-1.5 py-0.5 text-[11px] font-medium text-slate-300">
                  {post.account.country.flag && (
                    <img
                      src={normalizeFlagUrl(post.account.country.flag)}
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
              <span className="text-sm text-slate-400">@{post.account.username}</span>
              <span className="text-xs text-slate-600">·</span>
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
                className="h-9 w-9 rounded-full text-slate-400 hover:bg-white/10 hover:text-slate-200"
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 border-white/10 bg-slate-900/90 backdrop-blur-xl"
            >
              {canEdit && (
                <DropdownMenuItem onClick={handleEdit} className="text-slate-200 hover:bg-white/10">
                  <Edit className="mr-2 h-4 w-4" />
                  <span>Edit Post</span>
                </DropdownMenuItem>
              )}
              {currentUserAccountId && (
                <>
                  <DropdownMenuItem
                    onClick={handlePin}
                    className="text-slate-200 hover:bg-white/10"
                  >
                    <Pin className="mr-2 h-4 w-4" />
                    <span>{post.pinned ? "Unpin Post" : "Pin Post"}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleBookmark}
                    className="text-slate-200 hover:bg-white/10"
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
                  <DropdownMenuSeparator className="bg-white/10" />
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
      {post.hashtags && post.hashtags.length > 0 && (
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
      <div className="py-1 text-sm text-slate-400">
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
      <div className="flex gap-4 border-t border-b border-white/5 py-3 text-sm font-medium text-slate-300">
        <div>
          <span className="font-bold text-slate-100">{post.likeCount || 0}</span>
          <span className="ml-1 font-normal text-slate-400">Likes</span>
        </div>
        <div>
          <span className="font-bold text-slate-100">{post.repostCount || 0}</span>
          <span className="ml-1 font-normal text-slate-400">Reposts</span>
        </div>
        <div>
          <span className="font-bold text-slate-100">{post.replyCount || 0}</span>
          <span className="ml-1 font-normal text-slate-400">Replies</span>
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
          showCounts={false}
          size="lg"
          className="w-full justify-around"
        />
      </div>
    </motion.div>
  );
}
