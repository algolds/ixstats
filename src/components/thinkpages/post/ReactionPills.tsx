"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { REACTION_ICONS, getDiscordEmojiUrl } from "./ThinkpagesPostUtils";

export interface ReactionPillsProps {
  post: any;
  apiDiscordEmojis?: any[];
  onOpenReactionsDialog: () => void;
}

export function ReactionPills({ post, apiDiscordEmojis, onOpenReactionsDialog }: ReactionPillsProps) {
  let reactionCounts: Record<string, number> = {};
  try {
    reactionCounts =
      typeof post.reactionCounts === "string"
        ? JSON.parse(post.reactionCounts)
        : post.reactionCounts || {};
  } catch (error) {
    console.warn("Failed to parse reactionCounts in ReactionPills:", error);
    return null;
  }

  if (!reactionCounts || Object.keys(reactionCounts).length === 0) return null;

  let hasVisible = false;
  for (const count of Object.values(reactionCounts)) {
    if ((count as number) > 0) hasVisible = true;
  }
  if (!hasVisible) return null;

  return (
    <div className="mb-2 flex w-full flex-wrap items-center gap-1.5">
      {Object.entries(reactionCounts).map(([type, count]) => {
        if ((count as number) <= 0) return null;

        const discordUrl = getDiscordEmojiUrl(type, apiDiscordEmojis);

        return (
          <div
            key={type}
            className={cn(
              "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted hover:border-border flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs shadow-xs transition-all duration-200 hover:scale-[1.03] dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10"
            )}
            onClick={onOpenReactionsDialog}
          >
            {discordUrl ? (
              <img
                src={discordUrl}
                alt={type.split(":")[1] || type}
                className="h-3.5 w-3.5 object-contain"
              />
            ) : REACTION_ICONS[type] ? (
              React.createElement(REACTION_ICONS[type]!, {
                className: "h-3.5 w-3.5 text-purple-400",
              })
            ) : (
              <span className="text-sm">{type}</span>
            )}
            <span className="font-medium">{count as number}</span>
          </div>
        );
      })}
    </div>
  );
}
