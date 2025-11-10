// src/types/pack-opening.ts
// Type definitions for pack opening system

import type { CardRarity } from "@prisma/client";

/**
 * Pack Opening Stage - Animation sequence stages
 */
export type PackOpeningStage = "reveal" | "explosion" | "cardReveal" | "actions";

/**
 * Particle data for explosion effect
 */
export interface Particle {
  id: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  color: string;
  size: number;
}

/**
 * Pack opening state management
 */
export interface PackOpeningState {
  stage: PackOpeningStage;
  cards: CardInstance[];
  selectedCards: string[]; // card IDs for bulk actions
}

/**
 * Card instance from pack opening (minimal data for animation)
 */
export interface CardInstance {
  id: string;
  name?: string;
  title?: string;
  rarity: CardRarity;
  cardType: string;
  artwork: string;
  season: number;
}

/**
 * Quick action types for post-reveal
 */
export type QuickActionType = "junk" | "keep" | "list" | "collect";

/**
 * Quick action event data
 */
export interface QuickActionEvent {
  cardId: string;
  action: QuickActionType;
}

/**
 * Haptic feedback patterns
 */
export type HapticPattern = "light" | "medium" | "heavy";
