import type { CardRarity } from "@prisma/client";
import type { CardAuthorInfo } from "~/types/cards-display";

export type WikiSource = "ixwiki" | "iiwiki";

export interface BatchCandidate {
  id: string;
  articleTitle: string;
  wikiSource: WikiSource;
  targetRarity: CardRarity | "AUTO";
  season: number;
  customPrompt?: string;
  imageUrl?: string | null;
  extract?: string;
  category?: string;
  authorInfo?: CardAuthorInfo | null;
  author?: string;
  status: "idle" | "generating" | "success" | "error";
  errorMessage?: string;
  generatedCardId?: string;
  mintedArtwork?: string | null;
}

export interface ArtworkPreview {
  title: string;
  imageUrl: string;
  extract?: string;
  wikiSource?: string;
  category?: string;
  rarity?: string;
  season?: number;
}

/** A wiki author worth crediting: known, and not the generic community fallback. */
export const isNamedAuthor = (author?: string): author is string =>
  !!author && author !== "Unknown" && !author.toLowerCase().includes("community");

export function toArtworkPreview(c: BatchCandidate): ArtworkPreview {
  return {
    title: c.articleTitle,
    imageUrl: c.mintedArtwork || c.imageUrl || "",
    extract: c.extract,
    wikiSource: c.wikiSource,
    category: c.category,
    rarity: c.targetRarity,
    season: c.season,
  };
}
