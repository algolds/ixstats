export type SizePresets =
  "default" | "compactLong" | "compactTall" | "medium" | "tall" | "ultra" | "wikiInline";

export const SIZE_PRESETS = {
  DEFAULT: "default",
  COMPACT_LONG: "compactLong",
  COMPACT_TALL: "compactTall",
  MEDIUM: "medium",
  TALL: "tall",
  ULTRA: "ultra",
  WIKI_INLINE: "wikiInline",
} as const;

export type Preset = {
  width: number;
  height?: number;
  aspectRatio: number;
  borderRadius: number;
};

export const DynamicIslandSizePresets: Record<SizePresets, Preset> = {
  [SIZE_PRESETS.DEFAULT]: {
    width: 150,
    aspectRatio: 44 / 150,
    borderRadius: 46,
  },
  [SIZE_PRESETS.COMPACT_LONG]: {
    width: 300,
    height: 44,
    aspectRatio: 44 / 300,
    borderRadius: 9999,
  },
  [SIZE_PRESETS.COMPACT_TALL]: {
    width: 340,
    height: 44,
    aspectRatio: 44 / 340,
    borderRadius: 9999,
  },
  [SIZE_PRESETS.MEDIUM]: {
    width: 371,
    aspectRatio: 210 / 371,
    borderRadius: 22,
  },
  [SIZE_PRESETS.TALL]: {
    width: 371,
    aspectRatio: 210 / 371,
    borderRadius: 42,
  },
  [SIZE_PRESETS.ULTRA]: {
    width: 630,
    aspectRatio: 630 / 800,
    borderRadius: 42,
  },
  [SIZE_PRESETS.WIKI_INLINE]: {
    width: 260,
    height: 44,
    aspectRatio: 44 / 260,
    borderRadius: 9999,
  },
};
