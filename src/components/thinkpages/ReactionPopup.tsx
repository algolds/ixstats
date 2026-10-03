"use client";

import React, { useState, type FC } from "react";
import {
  Heart,
  Emoji as Smile,
  Emoji as Angry,
  ThumbsUp,
  ThumbsDown,
  FireFlame as Flame,
  Plus,
  Sparks as Sparkles,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/react";

const REACTION_ICONS: { [key: string]: FC<{ className?: string }> } = {
  like: Heart,
  laugh: Smile,
  angry: Angry,
  fire: Flame,
  thumbsup: ThumbsUp,
  thumbsdown: ThumbsDown,
};

// Common Discord emoji reactions including ixnay
const DISCORD_EMOJI_REACTIONS = [
  {
    name: "ixnay",
    url: "https://cdn.discordapp.com/emojis/559232409451888640.png",
    id: "559232409451888640",
  },
  {
    name: "heky_boi",
    url: "https://cdn.discordapp.com/emojis/580813300733157376.png",
    id: "580813300733157376",
  },
  {
    name: "pog",
    url: "https://cdn.discordapp.com/emojis/739969522139209748.png",
    id: "739969522139209748",
  },
];

interface DiscordEmoji {
  id: string;
  name: string;
  url: string;
}

interface ReactionPopupProps {
  onSelectReaction: (reactionType: string) => void;
  postReactionCounts?: Record<string, number>;
}

export function ReactionPopup({ onSelectReaction, postReactionCounts }: ReactionPopupProps) {
  const [showMoreEmojis, setShowMoreEmojis] = useState(false);
  const [activeTab, setActiveTab] = useState<"reactions" | "discord">("reactions");
  const [discordError, setDiscordError] = useState<string | null>(null);

  // Always load Discord emojis since they're prominently featured
  const {
    data: discordEmojis,
    isLoading,
    error,
  } = api.thinkpages.getDiscordEmojis.useQuery(
    {},
    {
      retry: 1,
      retryDelay: 1000,
    }
  );

  // Handle error state
  React.useEffect(() => {
    if (error) {
      console.warn("Discord emojis failed to load:", error);
      // oxlint-disable-next-line
      setDiscordError("Discord emojis unavailable");
    }
  }, [error]);

  const availableReactions = Object.keys(REACTION_ICONS);

  return (
    // Presented inside a Popover (material-thick), so this content stays opaque roles only.
    <div className="min-w-[290px]">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "reactions" | "discord")}
        className="w-full"
      >
        <TabsList className="mb-2 grid w-full grid-cols-2">
          <TabsTrigger value="reactions" className="gap-1">
            <Heart className="size-3.5" aria-hidden="true" />
            <span>Built-in</span>
          </TabsTrigger>
          <TabsTrigger value="discord" className="gap-1">
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>Discord</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reactions" className="mt-1">
          <div className="flex items-center justify-around gap-1 px-1">
            {availableReactions.map((type) => {
              const Icon = REACTION_ICONS[type];
              if (!Icon) return null;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onSelectReaction(type)}
                  className="text-label-secondary hover:text-label hover:bg-fill-3 rounded-full p-2 transition-[color,background-color,scale] duration-150 hover:scale-125"
                  title={type}
                  aria-label={type}
                >
                  <Icon className="size-5" />
                </button>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="discord" className="mt-1">
          <div className="flex flex-wrap gap-1 p-1">
            {/* Featured Discord Emojis (including ixnay) */}
            {DISCORD_EMOJI_REACTIONS.map((emoji) => (
              <button
                key={emoji.id}
                type="button"
                onClick={() => onSelectReaction(`discord:${emoji.name}`)}
                className="hover:bg-fill-3 rounded-control-sm p-2 transition-[background-color,scale] duration-150 hover:scale-125"
                title={`:${emoji.name}:`}
                aria-label={emoji.name}
              >
                <img src={emoji.url} alt={`:${emoji.name}:`} className="size-5" />
              </button>
            ))}

            {isLoading ? (
              <div className="flex w-full items-center justify-center p-3">
                <div className="border-tint size-4 animate-spin rounded-full border-b-2" />
                <span className="text-footnote text-label-secondary ml-2">Loading...</span>
              </div>
            ) : error || discordError ? (
              <div className="text-label-secondary text-footnote w-full p-2 text-center">
                <div className="mb-1">{discordError || "Discord emojis unavailable"}</div>
                <div className="text-footnote text-label-secondary">Using built-in reactions</div>
              </div>
            ) : discordEmojis?.emojis ? (
              <>
                {discordEmojis.emojis
                  .slice(0, showMoreEmojis ? discordEmojis.emojis.length : 16)
                  .map((emoji: DiscordEmoji) => (
                    <button
                      key={emoji.id}
                      type="button"
                      onClick={() => onSelectReaction(`discord:${emoji.name}`)}
                      className="hover:bg-fill-3 rounded-control-sm p-2 transition-[background-color,scale] duration-150 hover:scale-125"
                      title={`:${emoji.name}:`}
                      aria-label={emoji.name}
                    >
                      <img
                        src={emoji.url}
                        alt={`:${emoji.name}:`}
                        className="size-5"
                        onError={(e) => {
                          console.warn("Discord emoji failed to load:", emoji.name);
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </button>
                  ))}

                {discordEmojis.emojis.length > 16 && (
                  <button
                    type="button"
                    onClick={() => setShowMoreEmojis(!showMoreEmojis)}
                    className="border-separator-opaque hover:bg-fill-3 rounded-control-sm border border-dashed p-2 transition-colors"
                    title={
                      showMoreEmojis
                        ? "Show less"
                        : `Show all ${discordEmojis.emojis.length} emojis`
                    }
                  >
                    <Plus
                      className={`size-5 transition-transform ${showMoreEmojis ? "rotate-45" : ""}`}
                    />
                  </button>
                )}
              </>
            ) : (
              <div className="text-label-secondary text-footnote w-full p-2 text-center">
                No Discord emojis available
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {postReactionCounts && Object.keys(postReactionCounts).length > 0 && (
        <div className="border-separator mt-2 border-t pt-2">
          <div className="text-footnote text-label-secondary mb-1">Current reactions:</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(postReactionCounts).map(([type, count]) => {
              if ((count as number) === 0) return null;

              const Icon = REACTION_ICONS[type];
              const isDiscordEmoji = type.startsWith("discord:");

              return (
                <Badge key={type} variant="default">
                  {isDiscordEmoji ? (
                    <img
                      src={
                        DISCORD_EMOJI_REACTIONS.find((e) => type === `discord:${e.name}`)?.url ||
                        discordEmojis?.emojis?.find((e: any) => type === `discord:${e.name}`)
                          ?.url ||
                        ""
                      }
                      alt={type}
                      className="size-3.5"
                    />
                  ) : Icon ? (
                    <Icon className="size-3.5" />
                  ) : (
                    <span>{type}</span>
                  )}
                  <span className="tabular-nums">{count as number}</span>
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
