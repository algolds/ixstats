"use client";

import React from "react";
import { springGentle } from "~/lib/design/motion";
import { motion } from "motion/react";
import {
  MoreHoriz as MoreHorizontal,
  Pin,
  Bookmark,
  OpenBook as BookOpen,
  WhiteFlag as Flag,
  EditPencil as Edit,
  Trash as Trash2,
  Refresh as Repeat2,
  ChatBubble as MessageCircle,
} from "iconoir-react";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
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
import { PostEmbeds } from "./PostEmbeds";
import { PostModals } from "./PostModals";
import { RepostCard } from "./RepostCard";
import { ReactionPills } from "./ReactionPills";
import { ThreadReplies } from "./ThreadReplies";
import { PersonaAuthorCard } from "../PersonaAuthorCard";
import { formatThinkpagesContentForDisplay } from "~/lib/utils";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import {
  AccountAvatar,
  AccountTypeIcon,
  RelativeTimestamp,
  accountTypeColor,
} from "./ThinkpagesPostUtils";
import type { PostState, PostViewContext } from "./postViewTypes";

interface StandardPostViewProps {
  post: any;
  ctx: PostViewContext;
  state: PostState;
  compact?: boolean;
  showThread?: boolean;
  ThinkpagesPostComponent: React.ComponentType<any>;
}

function PostContextBanners({ post, blurbMeta }: { post: any; blurbMeta: PostState["blurbMeta"] }) {
  const parent = post.postType === "reply" ? post.parentPost : null;

  return (
    <>
      {post.pinned && (
        <div className="text-subhead text-yellow mb-3 flex items-center gap-2">
          <Pin className="size-4" aria-hidden="true" />
          <span>Pinned post</span>
        </div>
      )}

      {post.postType === "repost" && (
        <div className="text-subhead text-label-secondary mb-3 flex items-center gap-2">
          <Repeat2 className="size-4" aria-hidden="true" />
          <span>@{post.account?.username} reposted</span>
        </div>
      )}

      {parent && (
        <div className="mb-3">
          <div className="text-subhead text-label-secondary mb-2 flex items-center gap-2">
            <MessageCircle className="size-4" aria-hidden="true" />
            <span>Replying to @{parent.account?.username}</span>
          </div>
          <div className="border-separator ml-4 space-y-2 border-l-2 pl-4">
            <div className="flex items-center gap-2">
              <AccountAvatar
                account={parent.account}
                className="size-6"
                fallbackClassName="text-caption"
              />
              <span className="text-headline text-label">{parent.account?.displayName}</span>
              <span className="text-label-secondary text-footnote">
                @{parent.account?.username}
              </span>
            </div>
            <WikiHtmlContent
              html={formatThinkpagesContentForDisplay(parent.content)}
              className="text-label-secondary text-body line-clamp-3"
            />
          </div>
        </div>
      )}

      {blurbMeta.isBlurb && (
        <div className="text-subhead text-tint mb-3 flex items-center gap-2">
          <BookOpen className="size-4" aria-hidden="true" />
          <span>{blurbMeta.promptTitle ?? "Topic Tuesday"}</span>
          {blurbMeta.promptSlug && (
            <Link
              href={withBasePath(`/blurbs/${blurbMeta.promptSlug}`)}
              className="hover:underline"
            >
              View prompt →
            </Link>
          )}
        </div>
      )}
    </>
  );
}

function PostMoreMenu({ post, state }: { post: any; state: PostState }) {
  const { isOwnPost, canEdit, canDelete } = state;
  const manage = [
    { show: isOwnPost, Icon: Pin, label: post.pinned ? "Unpin" : "Pin", onClick: state.handlePin },
    { show: canEdit, Icon: Edit, label: "Edit", onClick: state.handleEdit },
    { show: canDelete, Icon: Trash2, label: "Delete", onClick: state.handleDelete, danger: true },
  ].filter((item) => item.show);
  const always = [
    { Icon: Bookmark, label: "Bookmark", onClick: state.handleBookmark },
    { Icon: Flag, label: "Flag", onClick: state.handleFlag },
  ];

  const renderItem = ({ Icon, label, onClick, danger }: (typeof manage)[number]) => (
    <DropdownMenuItem
      key={label}
      variant={danger ? "destructive" : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Icon />
      {label}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="text-label-secondary hover:text-label hover:bg-fill-3 rounded-full p-2 transition-colors"
        aria-label="More post actions"
        onClick={(e) => e.stopPropagation()}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {manage.map(renderItem)}
        {manage.length > 0 && <DropdownMenuSeparator />}
        {always.map((item) => renderItem({ ...item, show: true }))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function StandardPostView({
  post,
  ctx,
  state,
  compact = false,
  showThread = false,
  ThinkpagesPostComponent,
}: StandardPostViewProps) {
  const { onAccountClick } = ctx;
  const { account } = post;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springGentle}
      className={cn(
        "group border-separator bg-surface rounded-card shadow-card relative overflow-hidden border",
        compact ? "p-3" : "p-4",
        post.pinned && "border-yellow/40"
      )}
    >
      <PostContextBanners post={post} blurbMeta={state.blurbMeta} />

      <div className="flex gap-3">
        <button onClick={() => onAccountClick?.(account?.id)} className="shrink-0">
          <AccountAvatar
            account={account}
            className={compact ? "size-8" : "size-10"}
            fallbackClassName="font-medium"
          />
        </button>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <PersonaAuthorCard username={account?.username ?? ""}>
              <button
                onClick={() => onAccountClick?.(account?.id)}
                className="text-headline text-label hover:underline"
              >
                {account?.displayName}
              </button>
            </PersonaAuthorCard>

            {account?.verified && (
              <span
                className="text-body inline-flex size-4 items-center justify-center leading-none"
                title="Verified"
              >
                ✅
              </span>
            )}

            {account?.bio?.startsWith("Former Nation") && (
              <Badge variant="default">Former nation</Badge>
            )}

            <div className={cn("rounded-control-sm p-1", accountTypeColor(account?.accountType))}>
              <AccountTypeIcon type={account?.accountType} className="size-3.5" />
            </div>

            <span className="text-body text-label-secondary">@{account?.username}</span>

            <span className="text-body text-label-secondary" aria-hidden="true">
              ·
            </span>

            <RelativeTimestamp timestamp={post.timestamp} />

            {post.trending && <Badge variant="warning">Trending</Badge>}
          </div>

          <div className="text-body mb-3">
            {post.repostOf ? (
              <RepostCard
                post={post}
                cleanRepostContent={state.cleanRepostContent}
                repostMediaAttachments={state.repostMediaAttachments}
                setLightboxMedia={state.setLightboxMedia}
              />
            ) : (
              <PostBody
                content={post.content}
                cleanContent={state.cleanPostContent}
                blurbMeta={state.blurbMeta}
                sportsBulletin={state.sportsBulletin}
                account={account}
                isHero={false}
              />
            )}
          </div>

          <PostMediaGrid
            mediaAttachments={state.mediaAttachments}
            postId={post.id}
            onOpenLightbox={state.setLightboxMedia}
          />

          <PostEmbeds post={post} state={state} vizSpacing="mt-3 space-y-2" />

          {Array.isArray(post.hashtags) && post.hashtags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {post.hashtags.map((hashtag: string, index: number) => (
                <button key={index} type="button" className="text-body text-tint hover:underline">
                  #{hashtag}
                </button>
              ))}
            </div>
          )}

          <ReactionPills
            post={post}
            apiDiscordEmojis={state.apiDiscordEmojis}
            onOpenReactionsDialog={() => state.setShowReactionsDialog(true)}
          />

          <PostActions
            {...ctx}
            postId={post.id}
            post={post}
            onReply={() => state.handleReply()}
            showCounts={true}
            size="md"
          />

          <div className="flex items-center justify-end">
            <PostMoreMenu post={post} state={state} />
          </div>

          <PostComposers post={post} state={state} ctx={ctx} />

          <ThreadReplies
            post={post}
            showThread={showThread}
            state={state}
            ctx={ctx}
            ThinkpagesPostComponent={ThinkpagesPostComponent}
          />

          <PostModals post={post} state={state} onAccountClick={onAccountClick} />
        </div>
      </div>
    </motion.div>
  );
}
