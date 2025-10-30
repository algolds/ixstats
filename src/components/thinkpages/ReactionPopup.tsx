"use client";

import React, { useState, type FC } from "react";
import { motion } from "framer-motion";
import { Heart, Smile, Angry, ThumbsUp, ThumbsDown, Flame, Plus, Sparkles } from "lucide-react";
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
  console.log("🎭 ReactionPopup component rendered:", {
    onSelectReaction: !!onSelectReaction,
    postReactionCounts,
  });

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
      setDiscordError("Discord emojis unavailable");
    }
  }, [error]);

  const availableReactions = Object.keys(REACTION_ICONS);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.9 }}
      className="bg-background border-border min-w-[280px] rounded-lg border p-2 shadow-lg"
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "reactions" | "discord")}
        className="w-full"
      >
        <TabsList className="bg-muted mb-2 grid w-full grid-cols-2">
          <TabsTrigger value="reactions" className="flex items-center gap-1 text-xs">
            <Heart className="h-3 w-3" />
            <span>Built-in</span>
          </TabsTrigger>
          <TabsTrigger value="discord" className="flex items-center gap-1 text-xs">
            <Sparkles className="h-3 w-3" />
            <span>Discord</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reactions" className="mt-2">
          <div className="flex gap-1">
            {availableReactions.map((type) => {
              const Icon = REACTION_ICONS[type];
              if (!Icon) return null;
              return (
                <button
                  key={type}
                  onClick={() => onSelectReaction(type)}
                  className="hover:bg-accent rounded-full p-2 transition-colors"
                  title={type}
                >
                  <Icon className="h-5 w-5" />
                </button>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="discord" className="mt-2">
          <div className="flex flex-wrap gap-1">
            {/* Featured Discord Emojis (including ixnay) */}
            {DISCORD_EMOJI_REACTIONS.map((emoji) => (
              <button
                key={emoji.id}
                onClick={() => onSelectReaction(`discord:${emoji.name}`)}
                className="hover:bg-accent rounded p-1 transition-colors"
                title={`:${emoji.name}:`}
              >
                <img src={emoji.url} alt={`:${emoji.name}:`} className="h-5 w-5" />
              </button>
            ))}

            {/* All Discord Emojis */}
            {isLoading ? (
              <div className="flex items-center justify-center p-2">
                <div className="border-primary h-4 w-4 animate-spin rounded-full border-b-2"></div>
                <span className="text-muted-foreground ml-2 text-xs">Loading...</span>
              </div>
            ) : error || discordError ? (
              <div className="text-muted-foreground p-2 text-center text-xs">
                <div className="mb-1">{discordError || "Discord emojis unavailable"}</div>
                <div className="text-xs opacity-75">Using built-in reactions</div>
              </div>
            ) : discordEmojis?.emojis ? (
              <>
                {discordEmojis.emojis
                  .slice(0, showMoreEmojis ? discordEmojis.emojis.length : 16)
                  .map((emoji: DiscordEmoji) => (
                    <button
                      key={emoji.id}
                      onClick={() => onSelectReaction(`discord:${emoji.name}`)}
                      className="hover:bg-accent rounded p-1 transition-colors"
                      title={`:${emoji.name}:`}
                    >
                      <img
                        src={emoji.url}
                        alt={`:${emoji.name}:`}
                        className="h-5 w-5"
                        onError={(e) => {
                          console.warn("Discord emoji failed to load:", emoji.name);
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </button>
                  ))}

                {/* Show More/Less Button */}
                {discordEmojis.emojis.length > 16 && (
                  <button
                    onClick={() => setShowMoreEmojis(!showMoreEmojis)}
                    className="hover:bg-accent border-muted-foreground/30 rounded border border-dashed p-1 transition-colors"
                    title={
                      showMoreEmojis
                        ? "Show less"
                        : `Show all ${discordEmojis.emojis.length} emojis`
                    }
                  >
                    <Plus
                      className={`h-5 w-5 transition-transform ${showMoreEmojis ? "rotate-45" : ""}`}
                    />
                  </button>
                )}
              </>
            ) : (
              <div className="text-muted-foreground p-2 text-xs">No Discord emojis available</div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Current Reaction Counts */}
      {postReactionCounts && Object.keys(postReactionCounts).length > 0 && (
        <div className="border-border mt-2 border-t pt-2">
          <div className="text-muted-foreground mb-1 text-xs">Current reactions:</div>
          <div className="flex flex-wrap gap-1 text-xs">
            {Object.entries(postReactionCounts).map(([type, count]) => {
              if ((count as number) === 0) return null;

              const Icon = REACTION_ICONS[type];
              const isDiscordEmoji = type.startsWith("discord:");

              return (
                <div key={type} className="bg-muted flex items-center gap-1 rounded px-2 py-1">
                  {isDiscordEmoji ? (
                    <img
                      src={
                        DISCORD_EMOJI_REACTIONS.find((e) => type === `discord:${e.name}`)?.url || ""
                      }
                      alt={type}
                      className="h-3 w-3"
                    />
                  ) : Icon ? (
                    <Icon className="h-3 w-3" />
                  ) : (
                    <span>{type}</span>
                  )}
                  <span>{count as number}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
