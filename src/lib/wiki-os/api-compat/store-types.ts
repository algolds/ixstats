/**
 * store-types.ts — the data api.php modules read, as plain rows (plan 410).
 *
 * `ApiStore` is the only way modules reach the database; `store.ts` implements it with Prisma and a
 * test hands a module a fake. Rows carry MediaWiki's integers (`pageId`, `revId`), never cuids.
 */

import type { JsonValue } from "./format";

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
  /** The page properties MediaWiki reported for the last render (`defaultsort`, `displaytitle`, ...); null before a render. */
  pageProps: Record<string, string> | null;
  /** `{{DISPLAYTITLE}}` as sanitized HTML from the last render; null when the page sets none. */
  displayTitle: string | null;
}

/** A revision, with the page it belongs to. */
export interface RevisionRow {
  revId: number;
  /** The revision's public reference (`toRevisionRef`): what `detectEditConflict` compares. */
  ref: string;
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
  /** Bytes added (negative: removed) against the previous revision. */
  sizeDiff: number;
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

/** A page in a listing (no revision data). */
export interface PageListRow {
  pageId: number;
  title: string;
  namespace: number;
  isRedirect: boolean;
}

export interface ListPagesQuery {
  namespace: number;
  /** Canonical full titles (namespace prefix included): the listing starts at `start` (inclusive), runs in `dir`, stops at `end`. */
  start?: string;
  end?: string;
  prefix?: string;
  filterRedirects: "all" | "redirects" | "nonredirects";
  dir: "ascending" | "descending";
  limit: number;
}

export interface CategoryMemberQuery {
  /** Canonical title of the category ("Category:Cats"). */
  category: string;
  namespaces?: readonly number[];
  types: readonly ("page" | "subcat" | "file")[];
  sort: "sortkey" | "timestamp";
  dir: "ascending" | "descending";
  limit: number;
  /** The first row to return: its sort value (the sort key or an ISO time) and page id. */
  cursor?: { sortValue: string; pageId: number };
  /** For sort=timestamp: only members added within [start, end] (in `dir`'s order). */
  start?: Date;
  end?: Date;
}

export interface CategoryMemberRow extends PageListRow {
  sortKey: string | null;
  /** The value the listing sorts by: the sort key (or title) or the ISO time the page was added. */
  sortValue: string;
  addedAt: Date;
}

export interface BacklinkQuery {
  /** Canonical title the pages link to. */
  target: string;
  namespaces?: readonly number[];
  filterRedirects: "all" | "redirects" | "nonredirects";
  limit: number;
  /** The first page id to return. */
  cursor?: number;
}

export interface RandomPagesQuery {
  namespaces: readonly number[];
  filterRedirects: "all" | "redirects" | "nonredirects";
  limit: number;
}

export interface CategorySummaryRow {
  name: string;
  members: number;
  /** `__HIDDENCAT__`, as MediaWiki reported it. */
  hidden: boolean;
}

export interface CategoryListQuery {
  /** Category names (without the namespace prefix). */
  start?: string;
  end?: string;
  prefix?: string;
  dir: "ascending" | "descending";
  limit: number;
}

export interface LogRow {
  logId: number;
  type: string;
  action: string;
  /** Canonical title the entry is about. */
  title: string;
  namespace: number;
  /** The page's id when it is a page WikiOS holds, else 0. */
  pageId: number;
  actor: string;
  comment: string | null;
  params: JsonValue;
  timestamp: Date;
}

export interface LogQuery {
  type?: string;
  /** "block/reblock" style: the entry's action, with `type`. */
  action?: string;
  title?: string;
  /** Titles start with this (canonical). */
  titlePrefix?: string;
  user?: string;
  excludeUser?: string;
  dir: "older" | "newer";
  from?: Date;
  to?: Date;
  /** The first row to return. */
  cursor?: { timestamp: Date; logId: number };
  /** Returns up to limit + 1 rows. */
  limit: number;
}

export interface UserListQuery {
  start?: string;
  end?: string;
  prefix?: string;
  /** Only members of this explicit group. */
  group?: string;
  excludeGroup?: string;
  dir: "ascending" | "descending";
  limit: number;
  withEditCount: boolean;
}

export interface UserListRow {
  name: string;
  userId: number;
  registration: Date | null;
  editCount: number;
  /** Explicit groups (not `*`/`user`). */
  groups: string[];
}

export interface BlockListRow {
  target: string;
  reason: string | null;
  expiresAt: Date | null;
  allowUserTalk: boolean;
  blockedBy: string | null;
  createdAt: Date;
}

export interface ProtectedTitleQuery {
  namespaces?: readonly number[];
  level?: string;
  dir: "older" | "newer";
  from?: Date;
  to?: Date;
  cursor?: { timestamp: Date; id: string };
  limit: number;
}

export interface ProtectedTitleRow {
  /** Row id, for the continuation. */
  id: string;
  title: string;
  namespace: number;
  level: string;
  timestamp: Date;
  user: string | null;
  comment: string | null;
  expiresAt: Date | null;
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
  /** Templates (and Lua modules) pages transclude, from the last render, ordered by (page id, template title). */
  templatesOf(query: PerPageQuery): Promise<PerPageResult<LinkRow>>;
  /** Files pages use, from the last render, ordered by (page id, file name); the title is `File:Name`. */
  imagesOf(query: PerPageQuery): Promise<PerPageResult<LinkRow>>;
  /** Which of these category names (without the prefix) are hidden. */
  hiddenCategoryNames(names: readonly string[]): Promise<Set<string>>;
  /** A revision by its WikiOS row id (right after a save, which answers with the row id). */
  revisionByRowId(rowId: string): Promise<RevisionRow | null>;
  /** How many revisions a page has, deleted pages included (`action=undelete` reports it). */
  revisionCountOf(title: string): Promise<number>;
  /** The page's stored rendering: `fresh` when it matches the current wikitext. */
  pageHtml(articleId: string): Promise<{ html: string | null; fresh: boolean } | null>;
  /** The wikitext of pages, by WikiOS article id; with `maxChars`, only each page's first characters (a listing of 500 pages never loads 500 whole texts). */
  wikitextByArticle(articleIds: readonly string[], maxChars?: number): Promise<Map<string, string>>;

  /** Up to `limit + 1` pages of a namespace, in title order. */
  listPages(query: ListPagesQuery): Promise<PageListRow[]>;
  /** Up to `limit + 1` members of a category. */
  listCategoryMembers(query: CategoryMemberQuery): Promise<CategoryMemberRow[]>;
  /** Up to `limit + 1` pages that link to a title, in page id order. */
  listBacklinks(query: BacklinkQuery): Promise<PageListRow[]>;
  /** Up to `limit + 1` pages that transclude the template (or module) `query.target`, in page id order. */
  listEmbeddedIn(query: BacklinkQuery): Promise<PageListRow[]>;
  /** Up to `limit + 1` pages that use the file `query.target` (`File:Name`), in page id order. */
  listImageUsage(query: BacklinkQuery): Promise<PageListRow[]>;
  randomPages(query: RandomPagesQuery): Promise<PageListRow[]>;
  /** Up to `limit + 1` categories, in name order. */
  listCategories(query: CategoryListQuery): Promise<CategorySummaryRow[]>;
  /** Up to `limit + 1` log entries. */
  findLogs(query: LogQuery): Promise<LogRow[]>;
  /** Up to `limit + 1` users with a verified wiki account, in name order. */
  listUsers(query: UserListQuery): Promise<UserListRow[]>;
  /** The blocks in force now, newest first: a page and the continuation. */
  listBlocks(limit: number, cursor?: string): Promise<{ blocks: BlockListRow[]; nextCursor: string | null }>;
  /** Up to `limit + 1` create-protected titles that have no page. */
  listProtectedTitles(query: ProtectedTitleQuery): Promise<ProtectedTitleRow[]>;
}
