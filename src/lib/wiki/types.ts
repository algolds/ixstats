/**
 * MediaWiki Canonical API & Type Definitions
 *
 * Strongly-typed contracts for MediaWiki Action API responses, image metadata,
 * page queries, category structures, and search results.
 */

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

export interface MediaWikiCategoryMemberItem {
  pageid: number;
  ns: number;
  title: string;
  type?: string;
  timestamp?: string;
}

export interface MediaWikiSearchItem {
  ns?: number;
  title: string;
  pageid?: number;
  size?: number;
  wordcount?: number;
  snippet?: string;
  timestamp?: string;
}

export interface MediaWikiAllImagesItem {
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

export interface MediaWikiQueryResponse<
  TPages = Record<string, MediaWikiPageItem>,
> {
  batchcomplete?: boolean | string;
  continue?: Record<string, string>;
  error?: {
    code: string;
    info: string;
    docref?: string;
  };
  query?: {
    pages?: TPages;
    allimages?: MediaWikiAllImagesItem[];
    allcategories?: MediaWikiAllCategoriesItem[];
    categorymembers?: MediaWikiCategoryMemberItem[];
    search?: MediaWikiSearchItem[];
    [key: string]: unknown;
  };
}

export interface MediaWikiParseResponse {
  parse?: {
    title?: string;
    pageid?: number;
    revid?: number;
    text?: {
      "*"?: string;
    };
    wikitext?: {
      "*"?: string;
    };
    categories?: Array<{ sortkey?: string; "*"?: string }>;
    links?: Array<{ ns?: number; exists?: string; "*"?: string }>;
    sections?: Array<{
      toclevel?: number;
      level?: string;
      line?: string;
      number?: string;
      index?: string;
      fromtitle?: string;
      byteoffset?: number;
      anchor?: string;
    }>;
    images?: string[];
  };
  error?: {
    code: string;
    info: string;
  };
}

export interface WikiFileSearchResult {
  name: string;
  size: number;
  width: number;
  height: number;
  mediaType: string;
  mime: string;
  url: string;
  pageUrl: string;
}
