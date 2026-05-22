"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Virtuoso } from "react-virtuoso";
import {
  X,
  Heart,
  Smile,
  Angry,
  Flame,
  ThumbsUp,
  ThumbsDown,
  Crown,
  Newspaper,
  Users,
  MessageSquare,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import type { RouterOutputs } from "~/trpc/react";

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

const DISCORD_EMOJI_REACTIONS = [
  { name: "ixnay", url: "https://cdn.discordapp.com/emojis/559232409451888640.png" },
  { name: "heky_boi", url: "https://cdn.discordapp.com/emojis/580813300733157376.png" },
  { name: "pog", url: "https://cdn.discordapp.com/emojis/739969522139209748.png" },
];

function getDiscordEmojiUrl(reactionType: string, apiEmojis?: Array<{ name: string; url: string }>): string | null {
  if (!reactionType.startsWith("discord:")) return null;
  const parts = reactionType.split(":");
  const emojiId = parts[2] || "";
  if (emojiId) {
    return `https://cdn.discordapp.com/emojis/${emojiId}.png`;
  }
  const emojiName = parts[1] || reactionType.replace("discord:", "");
  const hardcoded = DISCORD_EMOJI_REACTIONS.find((e) => e.name === emojiName);
  if (hardcoded) return hardcoded.url;
  const fromApi = apiEmojis?.find((e) => e.name === emojiName);
  if (fromApi) return fromApi.url;
  return null;
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

export function ReactionsDialog({ postId, isOpen, onClose, onAccountClick, discordMsgId }: ReactionsDialogProps) {
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
  type PostReaction = RouterOutputs["thinkpages"]["getPostReactions"][number];
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

  if (!isOpen) return null;

  const discordMsgUrl = discordMsgId 
    ? `https://discord.com/channels/552179975769161729/557223534418722818/${discordMsgId}`
    : null;

  return (
    <AnimatePresence>
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
          className="relative w-full max-w-md rounded-2xl p-[1px] bg-gradient-to-b from-black/10 to-black/5 dark:from-white/15 dark:to-white/5 shadow-xl dark:shadow-[0_25px_60px_-15px_rgba(139,92,246,0.3)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Inner glass card with overflow-hidden */}
          <div className="relative overflow-hidden flex max-h-[580px] w-full flex-col rounded-2xl bg-white dark:bg-[#0e0c15]/95 text-foreground dark:text-white backdrop-blur-2xl">
            {/* Ambient inner glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-violet-500/10 via-transparent to-transparent pointer-events-none" />

            {/* Header */}
            <div className="relative flex items-center justify-between border-b border-border dark:border-white/10 px-6 py-4.5 bg-muted/20 dark:bg-white/5">
              <div>
                <h3 className="text-lg font-bold tracking-wide text-foreground dark:text-white">Post Activity</h3>
                <p className="text-xs text-muted-foreground">View interactions and reactions</p>
              </div>
              <button 
                onClick={onClose} 
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted dark:hover:bg-white/10 hover:text-foreground dark:hover:text-white transition-all cursor-pointer flex items-center justify-center"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Portal */}
            {discordMsgUrl && (!allReactions || allReactions.length === 0) && !isLoading ? (
              <div className="relative flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
                {/* Glowing Discord Icon container */}
                <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-[#5865F2]/15 border border-[#5865F2]/30 shadow-[0_0_35px_rgba(88,101,242,0.25)]">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[#5865F2]/20 to-transparent animate-pulse" />
                  <svg className="w-8 h-8 text-[#5865F2] relative z-10" fill="currentColor" viewBox="0 0 127.14 96.36">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.87-.64,1.71-1.32,2.51-2a75.46,75.46,0,0,0,73,0c.8.7,1.64,1.38,2.51,2a68.43,68.43,0,0,1-10.5,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31.58-18.83C129.24,48.72,123.36,25.9,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.88,46,53.7,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.12,46,95.94,53,91,65.69,84.69,65.69Z" />
                  </svg>
                </div>

                <div className="space-y-2.5 max-w-sm">
                  <h4 className="text-base font-bold text-foreground dark:text-white tracking-wide">Imported from Discord</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
                    These reactions were synchronized directly from our official <span className="text-[#5865F2] font-semibold">#ixtwitter</span> Discord channel! Local profile directories aren't stored on the website, but you can view all reaction profiles directly inside Discord.
                  </p>
                </div>

                <a
                  href={discordMsgUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-[#5865F2] hover:from-indigo-600 hover:to-[#4752C4] active:scale-98 px-6 py-3 font-semibold text-white shadow-lg shadow-[#5865F2]/20 transition-all duration-200 cursor-pointer w-full max-w-[260px]"
                >
                  <MessageSquare className="h-4 w-4" />
                  Open Original Discord Post
                </a>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto border-b border-border dark:border-white/10 px-4 py-2.5 bg-muted/20 dark:bg-neutral-900/30 scrollbar-none">
                  <button
                    onClick={() => setSelectedTab("all")}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
                      selectedTab === "all"
                        ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
                        : "bg-muted dark:bg-white/5 text-muted-foreground hover:bg-muted/80 dark:hover:bg-white/10 dark:hover:text-white"
                    )}
                  >
                    All ({allReactions?.length || 0})
                  </button>
                  {(Object.entries(reactionsByType) as [string, PostReaction[]][]).map(([type, reactions]) => {
                    const discordUrl = getDiscordEmojiUrl(type, apiDiscordEmojis);
                    const Icon = REACTION_ICONS[type];
                    const colorClass = REACTION_COLORS[type];

                    return (
                      <button
                        key={type}
                        onClick={() => setSelectedTab(type)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
                          selectedTab === type
                            ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
                            : "bg-muted dark:bg-white/5 text-muted-foreground hover:bg-muted/80 dark:hover:bg-white/10 dark:hover:text-white"
                        )}
                      >
                        {discordUrl ? (
                          <img src={discordUrl} alt={type} className="h-3.5 w-3.5 object-contain" />
                        ) : Icon ? (
                          React.createElement(Icon, {
                            className: cn("h-3.5 w-3.5", selectedTab === type ? "text-white" : colorClass),
                          })
                        ) : (
                          <span className="text-sm">{type}</span>
                        )}
                        <span>{reactions.length}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Reactions List */}
                <div className="flex-1 p-4 scrollbar-thin scrollbar-thumb-white/10">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-3">
                      <div className="border-t-2 border-violet-500 h-8 w-8 animate-spin rounded-full"></div>
                      <span className="text-xs text-muted-foreground">Loading reactions...</span>
                    </div>
                  ) : filteredReactions.length === 0 ? (
                    <div className="text-muted-foreground flex flex-col items-center justify-center py-16">
                      <Heart className="mb-2 h-10 w-10 text-muted-foreground/30 dark:text-white/20" />
                      <p className="text-sm">No local reactions yet</p>
                    </div>
                  ) : (
                    <Virtuoso
                      style={{ height: 350 }}
                      data={filteredReactions}
                      overscan={50}
                      itemContent={(_index, reaction: PostReaction) => {
                        const discordUrl = getDiscordEmojiUrl(reaction.reactionType, apiDiscordEmojis);
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
                          <div
                            className="hover:bg-muted/40 dark:hover:bg-white/5 border border-transparent hover:border-border/30 dark:hover:border-white/5 flex items-center gap-3 rounded-xl p-2 mb-2.5 transition-all"
                          >
                            <button
                              onClick={() => onAccountClick?.(reaction.account.id)}
                              className="flex-shrink-0 active:scale-95 transition-transform"
                            >
                              <Avatar className="h-10 w-10 border border-border/50 dark:border-white/10">
                                <AvatarImage src={reaction.account.profileImageUrl || undefined} />
                                <AvatarFallback className={cn("font-bold text-xs", accountTypeColor)}>
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
                                  onClick={() => onAccountClick?.(reaction.account.id)}
                                  className="truncate text-sm font-semibold hover:underline text-foreground dark:text-white hover:text-violet-500 dark:hover:text-violet-400 text-left transition-colors"
                                >
                                  {reaction.account.displayName}
                                </button>
                                {reaction.account.verified && (
                                  <span className="inline-flex items-center justify-center h-4 w-4 text-xs leading-none flex-shrink-0" title="Verified">
                                    ✅
                                  </span>
                                )}
                                {(reaction.account as any).bio?.startsWith("Former Nation") && (
                                  <span className="text-[10px] text-muted-foreground flex-shrink-0">[Former Nation]</span>
                                )}
                                <div className={cn("rounded px-1 py-0.5 text-[9px] font-bold flex-shrink-0 flex items-center justify-center", accountTypeColor)}>
                                  <AccountTypeIcon className="h-2.5 w-2.5" />
                                </div>
                              </div>
                              <p className="text-muted-foreground truncate text-xs text-left">
                                @{reaction.account.username}
                              </p>
                            </div>

                            {discordUrl ? (
                              <div className="bg-muted/50 dark:bg-white/5 rounded-full p-2 border border-border/30 dark:border-white/5">
                                <img src={discordUrl} alt={reaction.reactionType} className="h-4.5 w-4.5 object-contain" />
                              </div>
                            ) : ReactionIcon ? (
                              <div className={cn("bg-muted/50 dark:bg-white/5 rounded-full p-2 border border-border/30 dark:border-white/5", reactionColor)}>
                                {React.createElement(ReactionIcon, { className: "h-4.5 w-4.5" })}
                              </div>
                            ) : (
                              <div className="bg-muted/50 dark:bg-white/5 rounded-full px-2 py-1 border border-border/30 dark:border-white/5 text-xs text-violet-500 dark:text-violet-400 font-bold">
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
                  <div className="border-t border-border dark:border-white/10 p-3.5 bg-muted/20 dark:bg-white/5 text-center">
                    <a
                      href={discordMsgUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 text-xs text-[#5865F2] hover:text-[#4752C4] hover:underline font-semibold transition-colors"
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
    </AnimatePresence>
  );
}
