/**
 * store-types.ts — the data api.php modules read, as plain rows (plan 410).
 *
 * `ApiStore` is the only way modules reach the database; `store.ts` implements it with Prisma and a
 * test hands a module a fake. Rows carry MediaWiki's integers (`pageId`, `revId`), never cuids.
 */

export interface SiteStatistics {
  pages: number;
  /** Content pages: main-namespace pages that are not redirects. */
  articles: number;
  edits: number;
  images: number;
  users: number;
  activeUsers: number;
  admins: number;
}

export interface UserStats {
  editCount: number;
  registration: Date | null;
}

/** A page as api.php describes it. */
export interface PageRow {
  /** WikiArticle.id (cuid): for the store's own follow-up queries, never shown to a bot. */
  articleId: string;
  pageId: number;
  /** Canonical title ("Template:Foo bar"). */
  title: string;
  namespace: number;
  isRedirect: boolean;
  redirectTitle: string | null;
  redirectFragment: string | null;
  touched: Date;
  wordCount: number;
  /** The page's newest revision. */
  headRevId: number | null;
  headTimestamp: Date | null;
  /** Size of the newest revision's text in bytes. */
  length: number;
}

/** A revision, with the page it belongs to. */
export interface RevisionRow {
  revId: number;
  /** The previous revision of the page; 0 for the first. */
  parentId: number;
  pageId: number;
  title: string;
  namespace: number;
  timestamp: Date;
  /** The author's wiki name (null when unknown). */
  user: string | null;
  /** The author's MediaWiki user id when WikiOS knows it, else 0. */
  userId: number;
  comment: string | null;
  minor: boolean;
  size: number;
  sha1: string | null;
  /** The wikitext; null unless asked for. */
  content: string | null;
  textHidden: boolean;
  commentHidden: boolean;
  userHidden: boolean;
  /** This is the page's newest revision. */
  isHead: boolean;
}

export type RevisionDirection = "older" | "newer";

/** A point in a revision listing: a time, and the revision when it was named by id. */
export interface RevisionBound {
  timestamp: Date;
  revId?: number;
}

/** Where a revision listing continues: the first row of the next page (inclusive). */
export interface RevisionCursor {
  timestamp: Date;
  revId: number;
}

export interface RevisionQuery {
  /** Only revisions of this page (WikiArticle.id). */
  articleId?: string;
  namespaces?: readonly number[];
  /** Only revisions by these wiki names. */
  users?: readonly string[];
  excludeUser?: string;
  minor?: boolean;
  dir: RevisionDirection;
  /** The listing starts here (inclusive) and runs in `dir`. */
  from?: RevisionBound;
  /** ... and stops here (inclusive). */
  to?: RevisionBound;
  cursor?: RevisionCursor;
  /** How many rows to return; the store may return one more, for the caller to read as "there is more". */
  limit: number;
  withContent: boolean;
}

export interface PageRestrictionRow {
  action: string;
  level: string;
  expiresAt: Date | null;
}

/** One link out of a page (`prop=links`). */
export interface LinkRow {
  /** The page the link is on. */
  pageId: number;
  title: string;
  namespace: number;
}

export interface CategoryRow {
  pageId: number;
  /** "Category:Name". */
  title: string;
  sortKey: string | null;
  timestamp: Date;
  hidden: boolean;
}

/** A listing across several pages (links, categories): ordered by (pageId, key); `cursor` is the first row to return. */
export interface PerPageQuery {
  articleIds: readonly string[];
  /** Restrict to these target titles (canonical). */
  titles?: readonly string[];
  namespaces?: readonly number[];
  dir: "ascending" | "descending";
  limit: number;
  cursor?: { pageId: number; key: string };
}

/** One page of such a listing and where the next one starts (null when this was the last). */
export interface PerPageResult<T> {
  rows: T[];
  next: { pageId: number; key: string } | null;
}

export interface ApiStore {
  statistics(): Promise<SiteStatistics>;
  /** Edit count and registration date of a WikiOS user (by internal id) and wiki name. */
  userStats(internalUserId: string | null, wikiName: string): Promise<UserStats>;

  /** Existing pages by canonical title (a deleted page, or one without text, does not exist). */
  pagesByTitle(titles: readonly string[]): Promise<PageRow[]>;
  pagesById(pageIds: readonly number[]): Promise<PageRow[]>;
  /** Revisions by id, with their page; `withContent` also reads the text. A hidden-text revision has none. */
  revisionsById(revIds: readonly number[], withContent: boolean): Promise<RevisionRow[]>;
  /** One page of a revision listing in the query's order (up to `limit + 1` rows). */
  findRevisions(query: RevisionQuery): Promise<RevisionRow[]>;
  /** The restrictions in force on pages, by canonical title. */
  restrictionsByTitle(titles: readonly string[]): Promise<Map<string, PageRestrictionRow[]>>;
  /** Links out of pages (article links only), ordered by (page id, target slug). */
  linksFrom(query: PerPageQuery): Promise<PerPageResult<LinkRow>>;
  /** Categories of pages, ordered by (page id, category name). */
  categoriesOf(query: PerPageQuery & { hidden?: boolean }): Promise<PerPageResult<CategoryRow>>;
  /** The wikitext of pages, by WikiOS article id (for `prop=pageprops`). */
  wikitextByArticle(articleIds: readonly string[]): Promise<Map<string, string>>;
}
