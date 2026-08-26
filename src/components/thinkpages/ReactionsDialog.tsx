"use client";

import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Virtuoso } from "react-virtuoso";
// oxlint-disable-next-line eslint/no-unused-vars
import { Xmark as X, Heart, Emoji as Smile, Emoji as Angry, FireFlame as Flame, ThumbsUp, ThumbsDown, Journal as Newspaper, Group as Users, ChatBubble as MessageSquare } from "iconoir-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

interface ReactionsDialogProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
  onAccountClick?: (accountId: string) => void;
  discordMsgId?: string | null;
}

const REACTION_ICONS: { [key: string]: React.ElementType } = {
  like: Heart,
  laugh: Smile,
  angry: Angry,
  fire: Flame,
  thumbsup: ThumbsUp,
  thumbsdown: ThumbsDown,
};

const REACTION_COLORS: { [key: string]: string } = {
  like: "text-red-500",
  laugh: "text-yellow-500",
  angry: "text-red-600",
  fire: "text-orange-500",
  thumbsup: "text-green-500",
  thumbsdown: "text-gray-500",
};

import {
  ACCOUNT_TYPE_ICONS,
  ACCOUNT_TYPE_COLORS,
  getDiscordEmojiUrl,
} from "./post/ThinkpagesPostUtils";

export function ReactionsDialog({
  postId,
  isOpen,
  onClose,
  onAccountClick,
  discordMsgId,
}: ReactionsDialogProps) {
  const [selectedTab, setSelectedTab] = React.useState<string>("all");

  const { data: allReactions, isLoading } = api.thinkpages.getPostReactions.useQuery(
    { postId },
    { enabled: isOpen }
  );

  const { data: discordEmojisData } = api.thinkpages.getDiscordEmojis.useQuery(
    {},
    { enabled: isOpen, staleTime: 5 * 60_000 }
  );
  const apiDiscordEmojis = discordEmojisData?.emojis;

  // Group reactions by type
  type PostReaction = any;
  const reactionsByType = React.useMemo(() => {
    if (!allReactions) return {} as Record<string, PostReaction[]>;
    return allReactions.reduce(
      (acc: Record<string, PostReaction[]>, reaction: PostReaction) => {
        if (!acc[reaction.reactionType]) {
          acc[reaction.reactionType] = [];
        }
        acc[reaction.reactionType].push(reaction);
        return acc;
      },
      {} as Record<string, PostReaction[]>
    );
  }, [allReactions]);

  // Get filtered reactions based on selected tab
  const filteredReactions: PostReaction[] = React.useMemo(() => {
    if (selectedTab === "all") return allReactions || [];
    return reactionsByType[selectedTab] || [];
  }, [selectedTab, allReactions, reactionsByType]);

  const discordMsgUrl = discordMsgId
    ? `https://discord.com/channels/552179975769161729/557223534418722818/${discordMsgId}`
    : undefined;

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Shadow Wrapper to prevent shadow-clipping by overflow-hidden */}
          <motion.div
            initial={{ scale: 0.95, y: 15, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 15, opacity: 0 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="relative w-full max-w-md rounded-2xl bg-gradient-to-b from-black/10 to-black/5 p-[1px] shadow-xl dark:from-white/15 dark:to-white/5 dark:shadow-[0_25px_60px_-15px_rgba(139,92,246,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Inner glass card with overflow-hidden */}
            <div className="text-foreground relative flex max-h-[580px] w-full flex-col overflow-hidden rounded-2xl bg-card/95 backdrop-blur-2xl dark:border-white/10 dark:bg-card/95">
              {/* Ambient inner glow */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-500/10 via-transparent to-transparent" />

              {/* Header */}
              <div className="border-border bg-muted/20 relative flex items-center justify-between border-b px-6 py-4.5 dark:border-white/10 dark:bg-white/5">
                <div>
                  <h3 className="text-foreground text-lg font-bold tracking-wide">
                    Post Activity
                  </h3>
                  <p className="text-muted-foreground text-xs">View interactions and reactions</p>
                </div>
                <button
                  onClick={onClose}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground flex cursor-pointer items-center justify-center rounded-full p-1.5 transition-all active:scale-95 dark:hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content Portal */}
              {discordMsgUrl &&
              (!allReactions || allReactions.length === 0) &&
              !isLoading &&
              false ? (
                <div className="relative flex flex-1 flex-col items-center justify-center space-y-6 p-8 text-center">
                  {/* Glowing Discord Icon container */}
                  <div className="border-discord/30 bg-discord/15 shadow-discord/25 relative flex h-16 w-16 items-center justify-center rounded-2xl border shadow-lg">
                    <div className="from-discord/20 absolute inset-0 animate-pulse rounded-2xl bg-gradient-to-tr to-transparent" />
                    <svg
                      className="text-discord relative z-10 h-8 w-8"
                      fill="currentColor"
                      viewBox="0 0 127.14 96.36"
                    >
                      <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.87-.64,1.71-1.32,2.51-2a75.46,75.46,0,0,0,73,0c.8.7,1.64,1.38,2.51,2a68.43,68.43,0,0,1-10.5,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31.58-18.83C129.24,48.72,123.36,25.9,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.88,46,53.7,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.12,46,95.94,53,91,65.69,84.69,65.69Z" />
                    </svg>
                  </div>

                  <div className="max-w-sm space-y-2.5">
                    <h4 className="text-foreground text-base font-bold tracking-wide">
                      Imported from Discord
                    </h4>
                    <p className="text-muted-foreground mx-auto max-w-[280px] text-xs leading-relaxed">
                      These reactions were synchronized directly from our official{" "}
                      <span className="text-discord font-semibold">#ixtwitter</span> Discord
                      channel! Local profile directories aren't stored on the website, but you can
                      view all reaction profiles directly inside Discord.
                    </p>
                  </div>

                  <a
                    href={discordMsgUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="from-discord to-discord-hover shadow-discord/20 inline-flex w-full max-w-[260px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r px-6 py-3 font-semibold text-white shadow-lg transition-all duration-200 active:scale-[0.98]"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Open Original Discord Post
                  </a>
                </div>
              ) : (
                <>
                  {/* Tabs */}
                  <div className="border-border bg-muted/20 flex scrollbar-none items-center gap-2 overflow-x-auto border-b px-4 py-2.5 dark:border-white/10 dark:bg-neutral-900/30">
                    <button
                      onClick={() => setSelectedTab("all")}
                      className={cn(
                        "cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all",
                        selectedTab === "all"
                          ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 dark:bg-white/5 dark:hover:bg-white/10 dark:hover:text-white"
                      )}
                    >
                      All ({allReactions?.length || 0})
                    </button>
                    {(Object.entries(reactionsByType) as [string, PostReaction[]][]).map(
                      ([type, reactions]) => {
                        const discordUrl = getDiscordEmojiUrl(type, apiDiscordEmojis);
                        const Icon = REACTION_ICONS[type];
                        const colorClass = REACTION_COLORS[type];

                        return (
                          <button
                            key={type}
                            onClick={() => setSelectedTab(type)}
                            className={cn(
                              "flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all",
                              selectedTab === type
                                ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
                                : "bg-muted text-muted-foreground hover:bg-muted/80 dark:bg-white/5 dark:hover:bg-white/10 dark:hover:text-white"
                            )}
                          >
                            {discordUrl ? (
                              <img
                                src={discordUrl}
                                alt={type}
                                className="h-3.5 w-3.5 object-contain"
                              />
                            ) : Icon ? (
                              React.createElement(Icon, {
                                className: cn(
                                  "h-3.5 w-3.5",
                                  selectedTab === type ? "text-white" : colorClass
                                ),
                              })
                            ) : (
                              <span className="text-sm">{type}</span>
                            )}
                            <span>{reactions.length}</span>
                          </button>
                        );
                      }
                    )}
                  </div>

                  {/* Reactions List */}
                  <div className="flex-1 scrollbar-thin scrollbar-thumb-white/10 p-4">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center space-y-3 py-16">
                        <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-violet-500"></div>
                        <span className="text-muted-foreground text-xs">Loading reactions...</span>
                      </div>
                    ) : filteredReactions.length === 0 ? (
                      <div className="text-muted-foreground flex flex-col items-center justify-center py-16">
                        <Heart className="text-muted-foreground/30 mb-2 h-10 w-10 dark:text-white/20" />
                        <p className="text-sm">No local reactions yet</p>
                      </div>
                    ) : (
                      <Virtuoso
                        style={{ height: 350 }}
                        data={filteredReactions}
                        overscan={50}
                        itemContent={(_index, reaction: PostReaction) => {
                          const discordUrl = getDiscordEmojiUrl(
                            reaction.reactionType,
                            apiDiscordEmojis
                          );
                          const ReactionIcon = REACTION_ICONS[reaction.reactionType];
                          const reactionColor = REACTION_COLORS[reaction.reactionType];
                          const AccountTypeIcon =
                            ACCOUNT_TYPE_ICONS[
                              reaction.account.accountType as keyof typeof ACCOUNT_TYPE_ICONS
                            ] || Users;
                          const accountTypeColor =
                            ACCOUNT_TYPE_COLORS[
                              reaction.account.accountType as keyof typeof ACCOUNT_TYPE_COLORS
                            ] || "text-gray-400 bg-white/5 border border-white/10";

                          return (
                            <div className="hover:bg-muted/40 hover:border-border/30 mb-2.5 flex items-center gap-3 rounded-xl border border-transparent p-2 transition-all dark:hover:border-white/5 dark:hover:bg-white/5">
                              <button
                                onClick={
                                  reaction.account.isDiscordUser
                                    ? undefined
                                    : () => onAccountClick?.(reaction.account.id)
                                }
                                className={cn(
                                  "shrink-0 transition-transform",
                                  reaction.account.isDiscordUser
                                    ? "cursor-default"
                                    : "active:scale-95"
                                )}
                                disabled={!!reaction.account.isDiscordUser}
                              >
                                <Avatar className="border-border/50 h-10 w-10 border dark:border-white/10">
                                  <AvatarImage
                                    src={reaction.account.profileImageUrl || undefined}
                                  />
                                  <AvatarFallback
                                    className={cn("text-xs font-bold", accountTypeColor)}
                                  >
                                    {reaction.account.displayName
                                      .split(" ")
                                      .map((n: string) => n[0])
                                      .join("")
                                      .toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={
                                      reaction.account.isDiscordUser
                                        ? undefined
                                        : () => onAccountClick?.(reaction.account.id)
                                    }
                                    className={cn(
                                      "text-foreground truncate text-left text-sm font-semibold transition-colors dark:text-white",
                                      reaction.account.isDiscordUser
                                        ? "cursor-default"
                                        : "hover:text-violet-500 hover:underline dark:hover:text-violet-400"
                                    )}
                                    disabled={!!reaction.account.isDiscordUser}
                                  >
                                    {reaction.account.displayName}
                                  </button>
                                  {reaction.account.verified && (
                                    <span
                                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-xs leading-none"
                                      title="Verified"
                                    >
                                      ✅
                                    </span>
                                  )}
                                  {(reaction.account as any).bio?.startsWith("Former Nation") && (
                                    <span className="text-muted-foreground shrink-0 text-[10px]">
                                      [Former Nation]
                                    </span>
                                  )}
                                  {reaction.account.isDiscordUser ? (
                                    <div className="border-discord/30 bg-discord/20 text-discord flex shrink-0 items-center gap-0.5 rounded border px-1 py-0.5 text-[9px] font-bold">
                                      <svg
                                        className="h-2.5 w-2.5"
                                        fill="currentColor"
                                        viewBox="0 0 127.14 96.36"
                                      >
                                        <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.87-.64,1.71-1.32,2.51-2a75.46,75.46,0,0,0,73,0c.8.7,1.64,1.38,2.51,2a68.43,68.43,0,0,1-10.5,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31.58-18.83C129.24,48.72,123.36,25.9,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.88,46,53.7,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.12,46,95.94,53,91,65.69,84.69,65.69Z" />
                                      </svg>
                                      <span>Discord</span>
                                    </div>
                                  ) : (
                                    <div
                                      className={cn(
                                        "flex shrink-0 items-center justify-center rounded px-1 py-0.5 text-[9px] font-bold",
                                        accountTypeColor
                                      )}
                                    >
                                      <AccountTypeIcon className="h-2.5 w-2.5" />
                                    </div>
                                  )}
                                </div>
                                <p className="text-muted-foreground truncate text-left text-xs">
                                  @{reaction.account.username}
                                </p>
                              </div>

                              {discordUrl ? (
                                <div className="bg-muted/50 border-border/30 rounded-full border p-2 dark:border-white/5 dark:bg-white/5">
                                  <img
                                    src={discordUrl}
                                    alt={reaction.reactionType}
                                    className="h-4.5 w-4.5 object-contain"
                                  />
                                </div>
                              ) : ReactionIcon ? (
                                <div
                                  className={cn(
                                    "bg-muted/50 border-border/30 rounded-full border p-2 dark:border-white/5 dark:bg-white/5",
                                    reactionColor
                                  )}
                                >
                                  {React.createElement(ReactionIcon, { className: "h-4.5 w-4.5" })}
                                </div>
                              ) : (
                                <div className="bg-muted/50 border-border/30 rounded-full border px-2 py-1 text-xs font-bold text-violet-500 dark:border-white/5 dark:bg-white/5 dark:text-violet-400">
                                  {reaction.reactionType}
                                </div>
                              )}
                            </div>
                          );
                        }}
                      />
                    )}
                  </div>

                  {/* Discord reference link at bottom for posts that have it */}
                  {discordMsgUrl && (
                    <div className="border-border bg-muted/20 border-t p-3.5 text-center dark:border-white/10 dark:bg-white/5">
                      <a
                        href={discordMsgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-discord hover:text-discord-hover inline-flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors hover:underline"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Open original conversation in Discord
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
