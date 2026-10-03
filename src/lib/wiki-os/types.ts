// src/lib/wiki-os/types.ts
// Canonical type definitions and branded types for the standalone WikiOS engine.
export type ArticleMode = "reading" | "source" | "visual";

export interface MediaWikiImageInfoItem {
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

export interface MediaWikiRevisionItem {
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

interface MediaWikiCategoryMemberItem {
  pageid: number;
  ns: number;
  title: string;
  type?: string;
  timestamp?: string;
}

interface MediaWikiSearchItem {
  ns?: number;
  title: string;
  pageid?: number;
  size?: number;
  wordcount?: number;
  snippet?: string;
  timestamp?: string;
}

interface MediaWikiAllImagesItem {
  name?: string;
  title?: string;
  timestamp?: string;
  url?: string;
  descriptionurl?: string;
  size?: number;
  width?: number;
  height?: number;
  mime?: string;
  mediatype?: string;
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

export interface MediaWikiQueryResponse<TPages = Record<string, MediaWikiPageItem>> {
  batchcomplete?: boolean | string;
  continue?: Record<string, string>;
  error?: {
    code: string;
    info: string;
    docref?: string;
  };
  warnings?: Record<string, { "*": string }>;
  query?: {
    pages?: TPages;
    allimages?: MediaWikiAllImagesItem[];
    allcategories?: MediaWikiAllCategoriesItem[];
    categorymembers?: MediaWikiCategoryMemberItem[];
    search?: MediaWikiSearchItem[];
    usercontribs?: Array<{
      userid?: number;
      user?: string;
      pageid?: number;
      revid?: number;
      title?: string;
      timestamp?: string;
      comment?: string;
      size?: number;
      sizediff?: number;
    }>;
  };
}
