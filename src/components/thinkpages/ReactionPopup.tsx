"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Heart, Smile, Angry, ThumbsUp, ThumbsDown, Flame } from 'lucide-react';

const REACTION_ICONS: { [key: string]: React.ElementType } = {
  like: Heart,
  laugh: Smile,
  angry: Angry,
  fire: Flame,
  thumbsup: ThumbsUp,
  thumbsdown: ThumbsDown,
};

interface ReactionPopupProps {
  reactions: any[];
  onSelectReaction: (reactionType: string) => void;
}

export function ReactionPopup({ reactions, onSelectReaction }: ReactionPopupProps) {
  const availableReactions = Object.keys(REACTION_ICONS);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.9 }}
      className="absolute bottom-full left-0 mb-2 p-2 bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg z-10 flex gap-1"
    >
      {availableReactions.map((type) => {
        const Icon = REACTION_ICONS[type];
        if (!Icon) return null;
        return (
          <button
            key={type}
            onClick={() => onSelectReaction(type)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <Icon className="h-5 w-5" />
          </button>
        );
      })}
    </motion.div>
  );
}
