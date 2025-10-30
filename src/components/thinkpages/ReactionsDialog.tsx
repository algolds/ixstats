"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Heart,
  Smile,
  Angry,
  Flame,
  ThumbsUp,
  ThumbsDown,
  Verified,
  Crown,
  Newspaper,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import type { RouterOutputs } from "~/trpc/react";

interface ReactionsDialogProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
  onAccountClick?: (accountId: string) => void;
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

const REACTION_LABELS: { [key: string]: string } = {
  like: "Likes",
  laugh: "Laughs",
  angry: "Angry",
  fire: "Fire",
  thumbsup: "Thumbs Up",
  thumbsdown: "Thumbs Down",
};

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

export function ReactionsDialog({ postId, isOpen, onClose, onAccountClick }: ReactionsDialogProps) {
  const [selectedTab, setSelectedTab] = React.useState<string>("all");

  const { data: allReactions, isLoading } = api.thinkpages.getPostReactions.useQuery(
    { postId },
    { enabled: isOpen }
  );

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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-background border-border flex max-h-[600px] w-full max-w-md flex-col rounded-lg border"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-border flex items-center justify-between border-b p-4">
            <h3 className="text-lg font-semibold">Reactions</h3>
            <button onClick={onClose} className="hover:bg-muted rounded-full p-1 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="border-border flex items-center gap-2 overflow-x-auto border-b px-4 py-2">
            <button
              onClick={() => setSelectedTab("all")}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                selectedTab === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              All {allReactions?.length || 0}
            </button>
            {Object.entries(reactionsByType).map(([type, reactions]) => {
              const Icon = REACTION_ICONS[type];
              const colorClass = REACTION_COLORS[type];

              return (
                <button
                  key={type}
                  onClick={() => setSelectedTab(type)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                    selectedTab === type
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  {Icon &&
                    React.createElement(Icon, {
                      className: cn("h-3.5 w-3.5", selectedTab === type ? "" : colorClass),
                    })}
                  {reactions.length}
                </button>
              );
            })}
          </div>

          {/* Reactions List */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
              </div>
            ) : filteredReactions.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center justify-center py-8">
                <Heart className="mb-2 h-12 w-12 opacity-50" />
                <p className="text-sm">No reactions yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredReactions.map((reaction: PostReaction) => {
                  const ReactionIcon = REACTION_ICONS[reaction.reactionType];
                  const reactionColor = REACTION_COLORS[reaction.reactionType];
                  const AccountTypeIcon =
                    ACCOUNT_TYPE_ICONS[
                      reaction.account.accountType as keyof typeof ACCOUNT_TYPE_ICONS
                    ] || Users;
                  const accountTypeColor =
                    ACCOUNT_TYPE_COLORS[
                      reaction.account.accountType as keyof typeof ACCOUNT_TYPE_COLORS
                    ] || "text-gray-500 bg-gray-500/20";

                  return (
                    <motion.div
                      key={reaction.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="hover:bg-muted/50 flex items-center gap-3 rounded-lg p-2 transition-colors"
                    >
                      <button
                        onClick={() => onAccountClick?.(reaction.account.id)}
                        className="flex-shrink-0"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={reaction.account.profileImageUrl || undefined} />
                          <AvatarFallback className={`font-semibold ${accountTypeColor}`}>
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
                            className="truncate font-semibold hover:underline"
                          >
                            {reaction.account.displayName}
                          </button>
                          {reaction.account.verified && (
                            <Verified className="h-4 w-4 flex-shrink-0 fill-current text-blue-500" />
                          )}
                          <div className={`rounded p-1 ${accountTypeColor} flex-shrink-0`}>
                            <AccountTypeIcon className="h-3 w-3" />
                          </div>
                        </div>
                        <p className="text-muted-foreground truncate text-sm">
                          @{reaction.account.username}
                        </p>
                      </div>

                      {ReactionIcon && (
                        <div className={cn("bg-muted rounded-full p-2", reactionColor)}>
                          {React.createElement(ReactionIcon, { className: "h-4 w-4" })}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
