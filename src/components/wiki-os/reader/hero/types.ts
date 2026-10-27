export type WikiHeroVariant = "editorial-masthead" | "sculpted-emblem";

interface FeaturedArticleData {
  title: string;
  slug: string;
  imgSrc: string | null;
  summary: string;
  authorInfo?: {
    creator?: string | null;
    creatorAvatar?: string | null;
    createdAt?: string | null;
    lastEditor?: string | null;
    lastEditorAvatar?: string | null;
    lastEditedAt?: string | null;
  } | null;
}

export interface WikiHeroProps {
  /** Counts from the database; a count that could not be read is null and left out of the page. */
  siteStats?: {
    articles?: number | null;
    edits?: number | null;
    users?: number | null;
    activeUsers?: number | null;
    images?: number | null;
    countries?: number | null;
  };
  activePrompt?: {
    title: string;
    question: string;
    featured?: boolean;
    _count?: { responses: number };
  } | null;
  latestChange?: {
    title: string;
    user: string;
    timestamp: string;
    comment?: string;
  } | null;
  featuredArticleHtml?: string | null;
  featuredArticleData?: FeaturedArticleData | null;
  variant?: WikiHeroVariant;
  onSelectVariant?: (variant: WikiHeroVariant) => void;
  onOpenBlurbs?: () => void;
}
