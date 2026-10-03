import { NextResponse } from "next/server";
import type { wikiLoreCardGenerator } from "~/lib/wiki-os/adapters/ixstates/lore-card-generator";
import type { WikiSource } from "~/lib/wiki-os/config";

type ArticlePreview = Awaited<
  ReturnType<typeof wikiLoreCardGenerator.fetchArticleMetadataBatch>
>[number];

/** The `source` query parameter when it names a supported wiki, else null. */
export function parseWikiSource(raw: string | null): WikiSource | null {
  return raw === "ixwiki" || raw === "iiwiki" ? raw : null;
}

export function invalidSourceResponse(): NextResponse {
  return NextResponse.json(
    { error: "Invalid wiki source. Must be 'ixwiki' or 'iiwiki'" },
    { status: 400 }
  );
}

/** Quality-filtered article candidates for lore card generation, images first when preferred. */
export function toArticleCandidates(
  previews: ArticlePreview[],
  source: WikiSource,
  { minQuality, preferImages }: { minQuality: number; preferImages: boolean }
) {
  return previews
    .filter((p) => p.estimatedQuality >= minQuality)
    .map((p) => ({
      title: p.title,
      excerpt: p.extract,
      qualityScore: p.estimatedQuality,
      estimatedRarity: p.estimatedRarity,
      wikiSource: source,
      artwork: p.imageUrl,
      hasImage: p.hasImage,
      length: p.length,
      categoryCount: p.categoryCount,
      estimatedValue: p.estimatedValue,
    }))
    .sort((a, b) => {
      if (preferImages && (b.hasImage ? 1 : 0) !== (a.hasImage ? 1 : 0)) {
        return (b.hasImage ? 1 : 0) - (a.hasImage ? 1 : 0);
      }
      return b.qualityScore - a.qualityScore;
    });
}
