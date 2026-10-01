"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { REACTION_ICONS, getDiscordEmojiUrl } from "./ThinkpagesPostUtils";

export interface ReactionPillsProps {
  post: any;
  apiDiscordEmojis?: any[];
  onOpenReactionsDialog: () => void;
}

export function ReactionPills({
  post,
  apiDiscordEmojis,
  onOpenReactionsDialog,
}: ReactionPillsProps) {
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
    <div className="mb-2 flex w-full flex-wrap items-center gap-2">
      {Object.entries(reactionCounts).map(([type, count]) => {
        if ((count as number) <= 0) return null;

        const discordUrl = getDiscordEmojiUrl(type, apiDiscordEmojis);

        return (
          <div
            key={type}
            className={cn(
              "bg-fill-4 border-separator text-label-secondary hover:bg-fill-3 hover:border-separator text-footnote flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 hover:scale-[1.03]"
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
                className: "h-3.5 w-3.5 text-blue",
              })
            ) : (
              <span className="text-body">{type}</span>
            )}
            <span className="font-medium">{count as number}</span>
          </div>
        );
      })}
    </div>
  );
}
