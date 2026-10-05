"use client";

import Link from "next/link";

import React from "react";
import { springGentle } from "~/lib/design/motion";
import { motion } from "motion/react";
import {
  MoreHoriz as MoreHorizontal,
  Pin,
  Bookmark,
  WhiteFlag as Flag,
  EditPencil as Edit,
  Trash as Trash2,
} from "iconoir-react";
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
import { PostEmbeds } from "./PostEmbeds";
import { PostComposers } from "./PostComposers";
import { PostModals } from "./PostModals";
import { PostActions } from "../primitives/PostActions";
import { PersonaAuthorCard } from "../PersonaAuthorCard";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { cn } from "~/lib/utils";
import type { PostState, PostViewContext } from "./postViewTypes";
import { AccountAvatar, AccountTypeIcon, accountTypeColor } from "./ThinkpagesPostUtils";

interface HeroPostViewProps {
  post: any;
  ctx: PostViewContext;
  state: PostState;
}

const timeFormat: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
const dateFormat: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };

export function HeroPostView({ post, ctx, state }: HeroPostViewProps) {
  const { currentUserAccountId, onAccountClick } = ctx;
  const { account } = post;
  const timestamp = new Date(post.timestamp);

  const menuItems = [
    { show: state.canEdit, Icon: Edit, label: "Edit post", onClick: state.handleEdit },
    {
      show: !!currentUserAccountId,
      Icon: Pin,
      label: post.pinned ? "Unpin post" : "Pin post",
      onClick: state.handlePin,
    },
    {
      show: !!currentUserAccountId,
      Icon: Bookmark,
      label: "Bookmark post",
      onClick: state.handleBookmark,
    },
    {
      show: !!currentUserAccountId && !state.isOwnPost,
      Icon: Flag,
      label: "Report post",
      onClick: state.handleFlag,
      danger: true,
    },
    {
      show: state.canDelete,
      Icon: Trash2,
      label: "Delete post",
      onClick: state.handleDelete,
      danger: true,
      separated: true,
    },
  ].filter((item) => item.show);

  const stats = [
    { label: "Likes", value: post.likeCount },
    { label: "Reposts", value: post.repostCount },
    { label: "Replies", value: post.replyCount },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springGentle}
      className="group bg-surface border-separator shadow-card text-label rounded-card relative space-y-4 overflow-hidden border p-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onAccountClick?.(account.id)}
            className="shrink-0 transition-transform hover:scale-105"
          >
            <AccountAvatar
              account={account}
              className="border-separator h-12 w-12 border"
              fallbackClassName="text-headline"
            />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <PersonaAuthorCard username={account.username ?? ""}>
                <button
                  onClick={() => onAccountClick?.(account.id)}
                  className="text-headline text-label leading-snug hover:underline"
                >
                  {account.displayName}
                </button>
              </PersonaAuthorCard>
              {account.verified && (
                <span
                  className="text-body inline-flex h-4 w-4 items-center justify-center"
                  title="Verified"
                >
                  ✅
                </span>
              )}
              {account.country && (
                <span className="border-separator bg-fill-4 text-label-secondary rounded-control-sm text-caption inline-flex items-center gap-1 border px-2 py-0.5">
                  {account.country.flag && (
                    <img
                      src={normalizeFlagUrl(account.country.flag) ?? undefined}
                      alt=""
                      className="rounded-control-sm h-2.5 w-3.5 object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  {account.country.name}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-label-secondary text-body">@{account.username}</span>
              <span className="text-label-tertiary text-footnote">·</span>
              <div
                className={cn(
                  "rounded-control-sm text-caption flex items-center gap-1 px-2 py-0.5",
                  accountTypeColor(account.accountType)
                )}
              >
                <AccountTypeIcon type={account.accountType} className="h-2.5 w-2.5" />
                <span>{account.accountType}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative">
          <DropdownMenu open={state.showMoreOptions} onOpenChange={state.setShowMoreOptions}>
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
              {menuItems.map(({ Icon, label, onClick, danger, separated }) => (
                <React.Fragment key={label}>
                  {separated && <DropdownMenuSeparator className="bg-border/40" />}
                  <DropdownMenuItem
                    onClick={onClick}
                    className={
                      danger
                        ? cn("text-red hover:bg-red/20 hover:text-red", separated && "font-medium")
                        : "text-label hover:bg-fill-4"
                    }
                  >
                    <Icon />
                    <span>{label}</span>
                  </DropdownMenuItem>
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <PostBody
        content={post.content}
        cleanContent={state.cleanPostContent}
        blurbMeta={state.blurbMeta}
        sportsBulletin={state.sportsBulletin}
        account={account}
        isHero={true}
      />

      <PostMediaGrid
        mediaAttachments={state.mediaAttachments}
        postId={post.id}
        onOpenLightbox={state.setLightboxMedia}
      />

      <PostEmbeds post={post} state={state} vizSpacing="mt-3 space-y-3" />

      {Array.isArray(post.hashtags) && post.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {post.hashtags.map((hashtag: string, index: number) => (
            <Link
              key={index}
              href={`/hashtags/${encodeURIComponent(hashtag.replace(/^#/, ""))}`}
              onClick={(e) => e.stopPropagation()}
              className="text-body text-blue hover:text-blue font-medium hover:underline"
            >
              #{hashtag}
            </Link>
          ))}
        </div>
      )}

      <div className="text-label-secondary text-body py-1">
        {timestamp.toLocaleTimeString(undefined, timeFormat)}
        {" · "}
        {timestamp.toLocaleDateString(undefined, dateFormat)}
        {" · ixTime"}
      </div>

      <div className="border-separator text-label-secondary text-body flex gap-4 border-t border-b py-3 font-medium">
        {stats.map(({ label, value }) => (
          <div key={label}>
            <span className="text-label font-semibold">{value || 0}</span>
            <span className="text-label-secondary ml-1 font-normal">{label}</span>
          </div>
        ))}
      </div>

      <div className="py-1">
        <PostActions
          {...ctx}
          postId={post.id}
          post={post}
          showCounts={false}
          size="lg"
          className="w-full justify-around"
        />
      </div>

      <PostComposers post={post} state={state} ctx={ctx} />

      <PostModals post={post} state={state} onAccountClick={onAccountClick} />
    </motion.div>
  );
}
