// src/components/wiki-os/reader/hero/types.ts

export type WikiHeroVariant =
  | "command-dock"
  | "typographic"
  | "halo-hub"
  | "split-horizon"
  | "sculpted-emblem";

export interface WikiHeroProps {
  siteStats?: {
    articles?: number;
    edits?: number;
    users?: number;
    activeUsers?: number;
    images?: number;
  };
  activePrompt?: {
    title: string;
    question: string;
    featured?: boolean;
  } | null;
  featuredArticleHtml?: string | null;
  onOpenSearch?: () => void;
  onOpenBlurbs?: () => void;
}
