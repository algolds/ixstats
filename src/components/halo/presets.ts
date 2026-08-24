export type SizePresets =
  | "reset"
  | "empty"
  | "default"
  | "compact"
  | "compactLong"
  | "compactTall"
  | "large"
  | "long"
  | "minimalLeading"
  | "minimalTrailing"
  | "compactMedium"
  | "medium"
  | "tall"
  | "ultra"
  | "massive"
  | "extraWide"
  | "fullWidth"
  | "wikiInline"
  | "wikiCompact";

export const SIZE_PRESETS = {
  RESET: "reset",
  EMPTY: "empty",
  DEFAULT: "default",
  COMPACT: "compact",
  COMPACT_LONG: "compactLong",
  COMPACT_TALL: "compactTall",
  LARGE: "large",
  LONG: "long",
  MINIMAL_LEADING: "minimalLeading",
  MINIMAL_TRAILING: "minimalTrailing",
  COMPACT_MEDIUM: "compactMedium",
  MEDIUM: "medium",
  TALL: "tall",
  ULTRA: "ultra",
  MASSIVE: "massive",
  EXTRA_WIDE: "extraWide",
  FULL_WIDTH: "fullWidth",
  WIKI_INLINE: "wikiInline",
  WIKI_COMPACT: "wikiCompact",
} as const;

export type Preset = {
  width: number;
  height?: number;
  aspectRatio: number;
  borderRadius: number;
};

export const DynamicIslandSizePresets: Record<SizePresets, Preset> = {
  [SIZE_PRESETS.RESET]: {
    width: 150,
    aspectRatio: 1,
    borderRadius: 20,
  },
  [SIZE_PRESETS.EMPTY]: {
    width: 0,
    aspectRatio: 0,
    borderRadius: 0,
  },
  [SIZE_PRESETS.DEFAULT]: {
    width: 150,
    aspectRatio: 44 / 150,
    borderRadius: 46,
  },
  [SIZE_PRESETS.MINIMAL_LEADING]: {
    width: 52.33,
    aspectRatio: 44 / 52.33,
    borderRadius: 22,
  },
  [SIZE_PRESETS.MINIMAL_TRAILING]: {
    width: 52.33,
    aspectRatio: 44 / 52.33,
    borderRadius: 22,
  },
  [SIZE_PRESETS.COMPACT]: {
    width: 240,
    height: 40,
    aspectRatio: 40 / 240,
    borderRadius: 9999,
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
  [SIZE_PRESETS.COMPACT_MEDIUM]: {
    width: 351,
    aspectRatio: 44 / 351,
    borderRadius: 9999,
  },
  [SIZE_PRESETS.LONG]: {
    width: 371,
    aspectRatio: 84 / 371,
    borderRadius: 42,
  },
  [SIZE_PRESETS.MEDIUM]: {
    width: 371,
    aspectRatio: 210 / 371,
    borderRadius: 22,
  },
  [SIZE_PRESETS.LARGE]: {
    width: 371,
    aspectRatio: 84 / 371,
    borderRadius: 42,
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
  [SIZE_PRESETS.MASSIVE]: {
    width: 891,
    height: 1900,
    aspectRatio: 891 / 891,
    borderRadius: 42,
  },
  [SIZE_PRESETS.EXTRA_WIDE]: {
    width: 1200,
    aspectRatio: 64 / 1200,
    borderRadius: 32,
  },
  [SIZE_PRESETS.FULL_WIDTH]: {
    width: 1400,
    aspectRatio: 80 / 1400,
    borderRadius: 28,
  },
  [SIZE_PRESETS.WIKI_INLINE]: {
    width: 260,
    height: 44,
    aspectRatio: 44 / 260,
    borderRadius: 9999,
  },
  [SIZE_PRESETS.WIKI_COMPACT]: {
    width: 180,
    height: 40,
    aspectRatio: 40 / 180,
    borderRadius: 9999,
  },
};
