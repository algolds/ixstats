/**
 * Forum Widget Utilities
 *
 * Pure client-side formatting constants and helpers for forum widget pages.
 * Uses inline CSS values (not Tailwind) since widgets run outside the main app shell.
 *
 * Kept in src/shared so client components can import without pulling in the
 * server-side XenForo API integration from src/server/modules/forum.
 */

export const RARITY_INLINE_COLORS: Record<
  string,
  { primary: string; border: string; glow: string; bg: string; label: string }
> = {
  COMMON: {
    primary: "#94a3b8",
    border: "rgba(100,116,139,0.3)",
    glow: "none",
    bg: "rgba(100,116,139,0.08)",
    label: "Common",
  },
  UNCOMMON: {
    primary: "#34d399",
    border: "rgba(16,185,129,0.4)",
    glow: "0 0 8px rgba(16,185,129,0.3)",
    bg: "rgba(16,185,129,0.08)",
    label: "Uncommon",
  },
  RARE: {
    primary: "#22d3ee",
    border: "rgba(6,182,212,0.5)",
    glow: "0 0 12px rgba(6,182,212,0.35)",
    bg: "rgba(6,182,212,0.08)",
    label: "Rare",
  },
  ULTRA_RARE: {
    primary: "#a78bfa",
    border: "rgba(139,92,246,0.5)",
    glow: "0 0 15px rgba(139,92,246,0.4)",
    bg: "rgba(139,92,246,0.08)",
    label: "Ultra Rare",
  },
  EPIC: {
    primary: "#fb923c",
    border: "rgba(249,115,22,0.6)",
    glow: "0 0 18px rgba(249,115,22,0.45)",
    bg: "rgba(249,115,22,0.08)",
    label: "Epic",
  },
  LEGENDARY: {
    primary: "#fcd34d",
    border: "rgba(245,158,11,0.7)",
    glow: "0 0 22px rgba(245,158,11,0.5)",
    bg: "rgba(245,158,11,0.08)",
    label: "Legendary",
  },
};

const RARITY_ORDER: Record<string, number> = {
  LEGENDARY: 6,
  EPIC: 5,
  ULTRA_RARE: 4,
  RARE: 3,
  UNCOMMON: 2,
  COMMON: 1,
};

export function rarityRank(rarity: string): number {
  return RARITY_ORDER[rarity] ?? 0;
}

export function getRarityColors(rarity: string) {
  return RARITY_INLINE_COLORS[rarity] ?? RARITY_INLINE_COLORS.COMMON!;
}

export function formatValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M IX`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K IX`;
  return `${Math.round(value)} IX`;
}

export function resolveArtworkUrl(artwork: string | null, basePath = ""): string {
  if (!artwork) return `${basePath}/placeholder-card.png`;

  const normalizedBasePath = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;

  // Handle Wiki URLs
  const ixwikiMatch = artwork.match(/^https?:\/\/(?:www\.)?ixwiki\.com\/(.+)$/i);
  if (ixwikiMatch) {
    return `${normalizedBasePath}/api/mediawiki/ixwiki/${ixwikiMatch[1]}`;
  }

  const iiwikiMatch = artwork.match(/^https?:\/\/(?:www\.)?iiwiki\.(?:com|org|us|net)\/(.+)$/i);
  if (iiwikiMatch) {
    return `${normalizedBasePath}/api/mediawiki/iiwiki/${iiwikiMatch[1]}`;
  }

  const althistoryMatch = artwork.match(/^https?:\/\/(?:www\.)?althistory\.fandom\.com\/(.+)$/i);
  if (althistoryMatch) {
    return `${normalizedBasePath}/api/mediawiki/althistory/${althistoryMatch[1]}`;
  }

  // Handle NationStates URLs
  if (artwork.includes("nationstates.net")) {
    return `${normalizedBasePath}/api/proxy-ns-image?url=${encodeURIComponent(artwork)}`;
  }

  if (artwork.startsWith("http")) return artwork;
  return `${normalizedBasePath}${artwork.startsWith("/") ? artwork : `/${artwork}`}`;
}

export function computeRarityCounts(cards: Array<{ rarity: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of cards) {
    counts[c.rarity] = (counts[c.rarity] ?? 0) + 1;
  }
  return counts;
}
