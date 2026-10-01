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

export interface ApiStore {
  statistics(): Promise<SiteStatistics>;
  /** Edit count and registration date of a WikiOS user (by internal id) and wiki name. */
  userStats(internalUserId: string | null, wikiName: string): Promise<UserStats>;
}
