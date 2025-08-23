"use client";

import React, { useState, type FC } from 'react';
import { motion } from 'framer-motion';
import { Heart, Smile, Angry, ThumbsUp, ThumbsDown, Flame, Plus } from 'lucide-react';
import { api } from '~/trpc/react';

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
  { name: 'ixnay', url: 'https://cdn.discordapp.com/emojis/559232409451888640.png', id: '559232409451888640' },
  { name: 'heky_boi', url: 'https://cdn.discordapp.com/emojis/580813300733157376.png', id: '580813300733157376' },
  { name: 'pog', url: 'https://cdn.discordapp.com/emojis/739969522139209748.png', id: '739969522139209748' },
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
  
  // Always load Discord emojis since they're prominently featured
  const { data: discordEmojis, isLoading } = api.thinkpages.getDiscordEmojis.useQuery({});

  const availableReactions = Object.keys(REACTION_ICONS);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.9 }}
      className="absolute bottom-full left-0 mb-2 p-2 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[280px]"
    >
      {/* Standard Icon Reactions */}
      <div className="flex gap-1 mb-2">
        {availableReactions.map((type) => {
          const Icon = REACTION_ICONS[type];
          if (!Icon) return null;
          return (
            <button
              key={type}
              onClick={() => onSelectReaction(type)}
              className="p-2 rounded-full hover:bg-accent transition-colors"
              title={type}
            >
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
      </div>

      {/* Discord Emoji Reactions */}
      <div className="border-t pt-2">
        <div className="text-xs text-muted-foreground mb-2 font-medium">Discord Emojis</div>
        <div className="flex flex-wrap gap-1">
          {/* Featured Discord Emojis (including ixnay) */}
          {DISCORD_EMOJI_REACTIONS.map((emoji) => (
            <button
              key={emoji.id}
              onClick={() => onSelectReaction(`discord:${emoji.name}`)}
              className="p-1 rounded hover:bg-accent transition-colors"
              title={`:${emoji.name}:`}
            >
              <img 
                src={emoji.url} 
                alt={`:${emoji.name}:`}
                className="h-5 w-5"
              />
            </button>
          ))}
          
          {/* All Discord Emojis */}
          {isLoading ? (
            <div className="flex items-center justify-center p-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            </div>
          ) : discordEmojis?.emojis ? (
            <>
              {discordEmojis.emojis.slice(0, showMoreEmojis ? discordEmojis.emojis.length : 16).map((emoji: DiscordEmoji) => (
                <button
                  key={emoji.id}
                  onClick={() => onSelectReaction(`discord:${emoji.name}`)}
                  className="p-1 rounded hover:bg-accent transition-colors"
                  title={`:${emoji.name}:`}
                >
                  <img 
                    src={emoji.url} 
                    alt={`:${emoji.name}:`}
                    className="h-5 w-5"
                  />
                </button>
              ))}
              
              {/* Show More/Less Button */}
              {discordEmojis.emojis.length > 16 && (
                <button
                  onClick={() => setShowMoreEmojis(!showMoreEmojis)}
                  className="p-1 rounded hover:bg-accent transition-colors border border-dashed border-muted-foreground/30"
                  title={showMoreEmojis ? "Show less" : `Show all ${discordEmojis.emojis.length} emojis`}
                >
                  <Plus className={`h-5 w-5 transition-transform ${showMoreEmojis ? 'rotate-45' : ''}`} />
                </button>
              )}
            </>
          ) : (
            <div className="text-xs text-muted-foreground p-2">No Discord emojis available</div>
          )}
        </div>
      </div>

      {/* Current Reaction Counts */}
      {postReactionCounts && Object.keys(postReactionCounts).length > 0 && (
        <div className="border-t pt-2 mt-2">
          <div className="text-xs text-muted-foreground mb-1">Current reactions:</div>
          <div className="flex flex-wrap gap-1 text-xs">
            {Object.entries(postReactionCounts).map(([type, count]) => {
              if ((count as number) === 0) return null;
              
              const Icon = REACTION_ICONS[type];
              const isDiscordEmoji = type.startsWith('discord:');
              
              return (
                <div key={type} className="flex items-center gap-1 bg-muted px-2 py-1 rounded">
                  {isDiscordEmoji ? (
                    <img 
                      src={DISCORD_EMOJI_REACTIONS.find(e => type === `discord:${e.name}`)?.url || ''} 
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
