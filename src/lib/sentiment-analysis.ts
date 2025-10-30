import type { ThinkpagesPost, PostReaction } from "@prisma/client";

interface PostWithReactions extends ThinkpagesPost {
  reactions: PostReaction[];
}

// Define sentiment values for each reaction type
const REACTION_SENTIMENT: Record<string, number> = {
  like: 0.5,
  laugh: 0.3,
  angry: -0.8,
  sad: -0.5,
  fire: 0.7, // Enthusiastic
  thumbsup: 1.0,
  thumbsdown: -1.0,
};

// Basic positive and negative keywords (can be expanded significantly)
const POSITIVE_KEYWORDS = [
  "great",
  "excellent",
  "good",
  "positive",
  "success",
  "growth",
  "strong",
  "thriving",
  "progress",
  "boom",
];
const NEGATIVE_KEYWORDS = [
  "bad",
  "poor",
  "crisis",
  "decline",
  "struggle",
  "negative",
  "recession",
  "unrest",
  "problem",
  "fall",
];

export function analyzePostSentiment(post: PostWithReactions): number {
  let sentimentScore = 0;
  let totalReactions = 0;

  // 1. Sentiment from reactions
  if (post.reactions && post.reactions.length > 0) {
    for (const reaction of post.reactions) {
      sentimentScore += REACTION_SENTIMENT[reaction.reactionType] || 0;
      totalReactions++;
    }
    // Average reaction sentiment
    if (totalReactions > 0) {
      sentimentScore /= totalReactions;
    }
  }

  // 2. Sentiment from keywords in content (basic)
  const contentLower = post.content.toLowerCase();
  let keywordSentiment = 0;
  let keywordCount = 0;

  for (const keyword of POSITIVE_KEYWORDS) {
    if (contentLower.includes(keyword)) {
      keywordSentiment += 0.2; // Small positive boost
      keywordCount++;
    }
  }
  for (const keyword of NEGATIVE_KEYWORDS) {
    if (contentLower.includes(keyword)) {
      keywordSentiment -= 0.2; // Small negative penalty
      keywordCount++;
    }
  }

  // Combine reaction and keyword sentiment
  // Give more weight to reactions as they are direct expressions of sentiment
  if (totalReactions > 0 && keywordCount > 0) {
    sentimentScore = sentimentScore * 0.7 + keywordSentiment * 0.3; // 70% reactions, 30% keywords
  } else if (keywordCount > 0) {
    sentimentScore = keywordSentiment; // Only keywords available
  }

  // Normalize to a -1 to 1 range (if not already there due to averaging)
  // This simple algorithm should naturally stay within a reasonable range
  return Math.max(-1, Math.min(1, sentimentScore));
}
