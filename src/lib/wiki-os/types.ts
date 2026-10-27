// src/lib/wiki-os/types.ts
// Canonical type definitions and branded types for the standalone WikiOS engine.
export type ArticleMode = "reading" | "source" | "visual";

interface MediaWikiImageInfoItem {
  url?: string;
  descriptionurl?: string;
  descriptionshorturl?: string;
  size?: number;
  width?: number;
  height?: number;
  mime?: string;
  mediatype?: string;
  timestamp?: string;
  user?: string;
}

interface MediaWikiRevisionItem {
  revid?: number;
  parentid?: number;
  user?: string;
  userid?: number;
  timestamp?: string;
  size?: number;
  comment?: string;
  contentformat?: string;
  contentmodel?: string;
  slots?: {
    main?: {
      contentformat?: string;
      contentmodel?: string;
      content?: string;
      "*"?: string;
    };
  };
  "*"?: string;
}

export interface MediaWikiCategoryItem {
  ns?: number;
  title: string;
  sortkey?: string;
  timestamp?: string;
}

export interface MediaWikiAllCategoriesItem {
  ns?: number;
  title?: string;
  category?: string;
  size?: number;
  pages?: number;
  files?: number;
  subcats?: number;
  "*"?: string;
}

export interface MediaWikiPageItem {
  pageid?: number;
  ns?: number;
  title: string;
  missing?: boolean | string;
  invalid?: boolean | string;
  invalidreason?: string;
  touched?: string;
  lastrevid?: number;
  length?: number;
  extract?: string;
  fullurl?: string;
  original?: {
    source?: string;
    width?: number;
    height?: number;
  };
  images?: Array<{ ns?: number; title: string }>;
  imageinfo?: MediaWikiImageInfoItem[];
  revisions?: MediaWikiRevisionItem[];
  categories?: MediaWikiCategoryItem[];
  contributors?: Array<{ userid?: number; name?: string }>;
  extlinks?: Array<{ "*": string }>;
  linkshere?: Array<{ pageid?: number; ns?: number; title: string }>;
  links?: Array<{ ns?: number; title: string }>;
}
