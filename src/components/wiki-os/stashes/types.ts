// src/components/wiki-os/stashes/types.ts
// Shared types, preset colors, and discriminated models for the Stash system.
// Apple Design & WikiOS standard.

export const PRESET_COLORS = [
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Rose
  "#ef4444", // Coral Red
  "#f97316", // Amber
  "#eab308", // Saffron Gold
  "#22c55e", // Emerald
  "#06b6d4", // Cyan
] as const;

export type StashTab = "articles" | "quotes" | "images" | "threads";

export interface CommonsImage {
  pageid: number;
  title: string;
  thumbUrl: string;
  url: string;
  descriptionUrl: string;
  width: number;
  height: number;
  mime: string;
  description: string;
  artist: string;
  license: string;
}

export interface StashHeaderItem {
  id: string;
  name: string;
  color: string;
  icon?: string | null;
  isDefault: boolean;
  order?: number;
  itemCount: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface StashedAnnotationItem {
  id: string;
  selectedText: string;
  comment?: string | null;
  color: string;
  createdAt: string | Date;
}

export interface StashedPageItem {
  id: string;
  pageTitle: string;
  pageSlug: string;
  savedAt: string | Date;
  annotationCount?: number;
  note?: string | null;
  annotations?: StashedAnnotationItem[];
  contentType?: string;
}

export interface StashedQuoteItem {
  id: string;
  itemId: string;
  pageTitle: string;
  pageSlug: string;
  selectedText: string;
  comment?: string | null;
  color: string;
  savedAt: string | Date;
}

export interface StashedThreadItem {
  id: string;
  pageTitle: string;
  pageSlug: string;
  savedAt: string | Date;
  note?: string | null;
  threadId?: number;
}
