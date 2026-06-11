/**
 * story-pin-enrichment.ts — Server-side utility for enriching story pins
 * with wiki content. Reuses WikiBridge for all fetches.
 *
 * Used by:
 *  - geo.getStoryPinFull (modal data)
 *  - Editor "Auto-populate from wiki" feature
 */

import { getArticleIntro, getPageImages, getCoordinates, getPageSections } from "./wiki-bridge";

export interface WikiEnrichment {
  intro: string | null;
  thumbnailUrl: string | null;
  images: Array<{ title: string; url: string; thumbUrl: string; width: number; height: number }>;
  coordinates: { lat: number; lng: number } | null;
  sections: string[];
  wikiUrl: string | null;
}

/**
 * Fetch enrichment data for a story pin from its linked wiki page.
 * All calls go through WikiBridge's 3-tier cache.
 */
export async function enrichFromWiki(wikiPageTitle: string): Promise<WikiEnrichment> {
  const result: WikiEnrichment = {
    intro: null,
    thumbnailUrl: null,
    images: [],
    coordinates: null,
    sections: [],
    wikiUrl: null,
  };

  if (!wikiPageTitle?.trim()) return result;

  // Fire all fetches concurrently for speed
  const [intro, images, coords, sections] = await Promise.allSettled([
    getArticleIntro(wikiPageTitle),
    getPageImages(wikiPageTitle, {
      limit: 12,
      excludePatterns: [/Flag_of/i, /Coat_of_arms/i, /Icon/i, /Logo/i],
    }),
    getCoordinates(wikiPageTitle),
    getPageSections(wikiPageTitle),
  ]);

  if (intro.status === "fulfilled" && intro.value) {
    result.intro = intro.value.text;
  }

  if (images.status === "fulfilled" && images.value) {
    result.images = images.value;
    if (images.value.length > 0) {
      result.thumbnailUrl = images.value[0].thumbUrl || images.value[0].url;
    }
  }

  if (coords.status === "fulfilled" && coords.value) {
    result.coordinates = { lat: coords.value[0], lng: coords.value[1] };
  }

  if (sections.status === "fulfilled" && sections.value) {
    result.sections = sections.value.map((s: { title: string }) => s.title);
  }

  // Build wiki URL (try ixwiki first)
  const encoded = encodeURIComponent(wikiPageTitle.replace(/ /g, "_"));
  result.wikiUrl = `/wiki/${encoded}`;

  return result;
}
