// src/components/wiki-os/stashes/types.ts
// Shared types and color presets for the Lore Stash manager.

export const PRESET_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
];

export type StashTab = "pages" | "images" | "threads";

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

export interface StashedPageItem {
  id: string;
  pageTitle: string;
  pageSlug: string;
  savedAt: string | Date;
  annotationCount?: number;
  note?: string | null;
}
