/**
 * wiki-name.ts: a wiki's name as readers know it, for labels that name where an article is from (search results, embed
 * cards, Discord). `WIKI_SOURCES` names IxWiki after the product (`siteName`, "WikiOS"); here IxWiki is "IxWiki", and
 * a sister wiki keeps its own name ("IIWiki", "AltHistory Wiki"). Client-safe and pure.
 */
import { WIKI_SOURCES, type WikiSource } from "./config";

/** The name a label gives the wiki an article is on. */
export function wikiName(source: WikiSource): string {
  return source === "ixwiki" ? "IxWiki" : WIKI_SOURCES[source].name;
}
