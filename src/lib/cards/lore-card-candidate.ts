/** What the lore-card generator reads from an article, before the importer turns it into a card. */
import type { ArticleSignals } from "~/lib/cards/rarity-engine";
import type { CardArticleSource } from "~/lib/cards/card-sources";
import type { LoreCategory } from "~/lib/cards/category-enums";
import type { CardAuthorInfo } from "~/types/cards-display";

export interface LoreCardCandidate {
  title: string;
  /** The card-face summary, at most 250 characters. */
  description: string;
  /** Up to 2000 characters of article text, for the card's lore. */
  fullExcerpt: string;
  /** The lead image's URL, or null when the article has none. */
  artwork: string | null;
  /** The lead image's file name on its wiki, for the licence lookup. */
  imageFile: string | null;
  wikiSource: CardArticleSource;
  wikiArticleTitle: string;
  wikiUrl: string;
  category: LoreCategory;
  signals: ArticleSignals;
  qualityScore: number;
  authorInfo?: CardAuthorInfo;
}

/** The reason recorded for a page outside the main namespace (a portal, a user blog, a template). */
export const NOT_ARTICLE_REASON = "Not an article";

/** Why an article cannot become a card; the importer records the reason and skips the page. */
export class ArticleRejected extends Error {
  constructor(
    public readonly kind: "missing" | "not-article" | "no-image" | "too-short",
    message: string
  ) {
    super(message);
    this.name = "ArticleRejected";
  }
}
