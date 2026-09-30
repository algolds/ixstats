import type { RefractionMode } from "./FeaturedImageRefraction";

export type WikiHeroVariant = "editorial-masthead" | "sculpted-emblem";

export interface FeaturedArticleData {
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
  siteStats?: {
    articles?: number;
    edits?: number;
    users?: number;
    activeUsers?: number;
    images?: number;
    countries?: number;
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
  totalNations?: number;
  featuredArticleHtml?: string | null;
  featuredArticleData?: FeaturedArticleData | null;
  variant?: WikiHeroVariant;
  onSelectVariant?: (variant: WikiHeroVariant) => void;
  refractionMode?: RefractionMode;
  onSelectRefractionMode?: (mode: RefractionMode) => void;
  onOpenSearch?: () => void;
  onOpenBlurbs?: () => void;
}
