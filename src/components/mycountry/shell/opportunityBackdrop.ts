import {
  Bank as Landmark,
  Building,
  Globe,
  Leaf,
  Shield,
  StatUp as TrendingUp,
  Group as Users,
} from "iconoir-react";
import type { CardImageType } from "~/lib/cards/image-presets";

export type OpportunityCategory =
  | "economic"
  | "political"
  | "social"
  | "military"
  | "diplomatic"
  | "infrastructure"
  | "environmental";

type WikiCoverBlock = "economy" | "state" | "foreign";

export interface CategoryBackdropMeta {
  label: string;
  icon: typeof TrendingUp;
  /** Standard Facet categorical token (`--color-chart-1..8`) for the ambient edge wash. */
  accentVar: string;
  /** Owner-pinned `card_background_images` slots checked first. */
  pinnedSlots: readonly CardImageType[];
  /** Country WikiOS cover-article bucket checked second. */
  wikiBlock: WikiCoverBlock;
  /** Curated editorial photography pool checked third (deterministically picked per item id). */
  editorialPool: readonly string[];
}

export const OPPORTUNITY_CATEGORY_META: Record<OpportunityCategory, CategoryBackdropMeta> = {
  economic: {
    label: "Economic",
    icon: TrendingUp,
    accentVar: "var(--color-chart-3)",
    pinnedSlots: ["economic_indicators", "fiscal", "trade"],
    wikiBlock: "economy",
    editorialPool: [
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1000&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?w=1000&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=1000&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=1000&q=80&auto=format&fit=crop",
    ],
  },
  political: {
    label: "Political",
    icon: Landmark,
    accentVar: "var(--color-chart-4)",
    pinnedSlots: ["government", "national_identity", "head_of_government"],
    wikiBlock: "state",
    editorialPool: [
      "https://images.unsplash.com/photo-1555848962-6e79363ec58f?w=1000&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1529180979161-06b8b6d6f2be?w=1000&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1577495508326-19a1b3cf65b7?w=1000&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1564939558297-fc396f18e5c7?w=1000&q=80&auto=format&fit=crop",
    ],
  },
  social: {
    label: "Social",
    icon: Users,
    accentVar: "var(--color-chart-5)",
    pinnedSlots: ["demographics", "labor"],
    wikiBlock: "economy",
    editorialPool: [
      "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1000&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1531206715517-5c0ba140b2b8?w=1000&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?w=1000&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1000&q=80&auto=format&fit=crop",
    ],
  },
  military: {
    label: "Defense",
    icon: Shield,
    accentVar: "var(--color-chart-8)",
    pinnedSlots: ["defense"],
    wikiBlock: "foreign",
    editorialPool: [
      "https://images.unsplash.com/photo-1579912437766-7896df6d3cd3?w=1000&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1580752300992-559f8e4f8b93?w=1000&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1569074187119-c87815b476da?w=1000&q=80&auto=format&fit=crop",
    ],
  },
  diplomatic: {
    label: "Diplomatic",
    icon: Globe,
    accentVar: "var(--color-chart-1)",
    pinnedSlots: ["diplomacy"],
    wikiBlock: "foreign",
    editorialPool: [
      "https://images.unsplash.com/photo-1577495508048-b635879837f1?w=1000&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1000&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1560523159-4a9692d222f9?w=1000&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1000&q=80&auto=format&fit=crop",
    ],
  },
  infrastructure: {
    label: "Infrastructure",
    icon: Building,
    accentVar: "var(--color-chart-2)",
    pinnedSlots: ["productivity", "trade"],
    wikiBlock: "economy",
    editorialPool: [
      "https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?w=1000&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=1000&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1000&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1000&q=80&auto=format&fit=crop",
    ],
  },
  environmental: {
    label: "Environmental",
    icon: Leaf,
    accentVar: "var(--color-chart-6)",
    pinnedSlots: ["national_identity"],
    wikiBlock: "state",
    editorialPool: [
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1000&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1000&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1000&q=80&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1000&q=80&auto=format&fit=crop",
    ],
  },
};

const RAW_TO_CATEGORY: Record<string, OpportunityCategory> = {
  economic: "economic",
  economy: "economic",
  fiscal: "economic",
  trade: "economic",
  political: "political",
  politics: "political",
  governance: "political",
  social: "social",
  demographics: "social",
  labor: "social",
  military: "military",
  security: "military",
  defense: "military",
  diplomatic: "diplomatic",
  diplomacy: "diplomatic",
  foreign: "diplomatic",
  infrastructure: "infrastructure",
  environmental: "environmental",
  environment: "environmental",
  crisis: "environmental",
};

/** Normalize an issue's `domain` and Prisma `category` enum into one canonical backdrop category. */
export function resolveOpportunityCategory(
  domain?: string | null,
  category?: string | null
): OpportunityCategory {
  const fromDomain = domain ? RAW_TO_CATEGORY[domain.trim().toLowerCase()] : undefined;
  if (fromDomain) return fromDomain;
  const fromCategory = category ? RAW_TO_CATEGORY[category.trim().toLowerCase()] : undefined;
  return fromCategory ?? "political";
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const isRasterUrl = (url: string): boolean => !/\.svg(?:$|\?)/i.test(url);

/**
 * Ordered candidate image URLs for the priority card's backdrop:
 * 1. Owner-pinned custom image in `card_background_images` for the matching category slot.
 * 2. Country's canonical WikiOS cover-article raster photo for that domain.
 * 3. Deterministic category editorial pool rotated by `id` so distinct issues get distinct art.
 */
export function resolveOpportunityBackdropUrls({
  id,
  category,
  pinnedImages,
  coverArticles,
}: {
  id: string;
  category: OpportunityCategory;
  pinnedImages?: Record<string, { imageUrl?: string | null } | undefined> | null;
  coverArticles?: Partial<Record<WikiCoverBlock, readonly { imageUrl?: string | null }[]>> | null;
}): string[] {
  const meta = OPPORTUNITY_CATEGORY_META[category];
  const candidates: string[] = [];
  const pushUnique = (raw: string | null | undefined) => {
    const trimmed = raw?.trim();
    if (trimmed && !candidates.includes(trimmed)) candidates.push(trimmed);
  };

  for (const slot of meta.pinnedSlots) {
    pushUnique(pinnedImages?.[slot]?.imageUrl);
  }

  const wikiList = coverArticles?.[meta.wikiBlock] ?? [];
  for (const article of wikiList) {
    if (article.imageUrl && isRasterUrl(article.imageUrl)) {
      pushUnique(article.imageUrl);
      break;
    }
  }

  const pool = meta.editorialPool;
  if (pool.length > 0) {
    const offset = hashSeed(id) % pool.length;
    for (let i = 0; i < pool.length; i++) {
      pushUnique(pool[(offset + i) % pool.length]);
    }
  }

  return candidates;
}
