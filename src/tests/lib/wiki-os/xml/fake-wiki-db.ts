/**
 * An in-memory stand-in for the Prisma delegates the XML importer touches (WikiArticle,
 * WikiRevision, WikiAccountLink, $transaction), with the behaviour the importer relies on: the
 * (source, mwRevId) uniqueness, where-filters of the shapes it uses, and a transaction that rolls
 * back everything when its callback throws.
 */

export interface ArticleRow {
  id: string;
  source: string;
  title: string;
  slug: string;
  status: string;
  format: string;
  namespace: number;
  namespacePrefix: string | null;
  wikitext: string;
  contentHtml: string | null;
  htmlSyncedAt: Date | null;
  summary: string | null;
  wordCount: number;
  readingTime: number;
  mwPageId: number | null;
  mwLatestRevId: number | null;
  redirectTargetSlug: string | null;
  redirectTargetFragment: string | null;
  protectionLevel: string;
  updatedAt: Date;
}

export interface RevisionRow {
  id: string;
  articleId: string;
  source: string;
  mwRevId: number | null;
  author: string | null;
  authorId: string | null;
  summary: string | null;
  minor: boolean;
  byteSize: number;
  byteDelta: number;
  sha1: string | null;
  createdAt: Date;
  wikitext: string;
  format: string;
}

export interface AccountLinkRow {
  source: string;
  username: string;
  userId: string;
  verifiedAt: Date | null;
}

type Where = Record<string, unknown>;
type Row = Record<string, unknown>;

export const store = {
  articles: [] as ArticleRow[],
  revisions: [] as RevisionRow[],
  accountLinks: [] as AccountLinkRow[],
  writes: 0,
  nextId: 1,
};

export function resetStore(): void {
  store.articles = [];
  store.revisions = [];
  store.accountLinks = [];
  store.writes = 0;
  store.nextId = 1;
}

const newId = (prefix: string): string => `${prefix}${store.nextId++}`;

function matchesValue(actual: unknown, expected: unknown): boolean {
  if (expected !== null && typeof expected === "object" && !(expected instanceof Date)) {
    const condition = expected as { in?: unknown[]; not?: unknown };
    if (condition.in) return condition.in.includes(actual);
    if ("not" in condition) return actual !== condition.not;
  }
  return actual === expected;
}

const matches = (row: Row, where: Where): boolean =>
  Object.entries(where).every(([key, expected]) =>
    key === "OR"
      ? (expected as Where[]).some((alternative) => matches(row, alternative))
      : matchesValue(row[key], expected)
  );

interface Query {
  where?: Where;
  orderBy?: Record<string, "asc" | "desc"> | Array<Record<string, "asc" | "desc">>;
  take?: number;
  skip?: number;
  cursor?: { id: string };
  select?: Record<string, boolean>;
}

const comparable = (value: unknown): number | string =>
  value instanceof Date ? value.getTime() : (value as number | string);

/** where + orderBy + cursor/skip/take over `rows`, like Prisma's findMany. */
function runQuery<T extends Row>(rows: T[], query: Query): T[] {
  const orderings = [query.orderBy ?? []].flat().flatMap((order) => Object.entries(order));
  let found = rows.filter((row) => matches(row, query.where ?? {}));
  found = [...found].sort((a, b) => {
    for (const [key, direction] of orderings) {
      const left = comparable(a[key]);
      const right = comparable(b[key]);
      if (left !== right) return (left < right ? -1 : 1) * (direction === "asc" ? 1 : -1);
    }
    return 0;
  });
  // The app's read-only db guard (src/server/db.ts) caps a findMany without take or cursor at 1000.
  if (query.take === undefined && !query.cursor) query = { ...query, take: 1000 };
  if (query.cursor) {
    const at = found.findIndex((row) => row.id === query.cursor?.id);
    found = found.slice(at === -1 ? 0 : at);
  }
  found = found.slice(query.skip ?? 0);
  return query.take === undefined ? found : found.slice(0, query.take);
}

function pick<T extends Row>(row: T, select?: Record<string, boolean>): Partial<T> {
  if (!select) return { ...row };
  return Object.fromEntries(Object.entries(row).filter(([key]) => select[key]));
}

function checkRevisionUnique(candidate: RevisionRow, ignoreId?: string): void {
  if (candidate.mwRevId === null) return;
  const clash = store.revisions.find(
    (row) =>
      row.id !== ignoreId && row.source === candidate.source && row.mwRevId === candidate.mwRevId
  );
  if (clash)
    throw new Error(`Unique constraint failed on (source, mwRevId) = ${candidate.mwRevId}`);
}

const articleDelegate = {
  findUnique: async ({
    where,
    select,
  }: {
    where: { source_title: { source: string; title: string } };
    select?: Record<string, boolean>;
  }) => {
    const { source, title } = where.source_title;
    const row = store.articles.find((a) => a.source === source && a.title === title);
    return row ? pick(row, select) : null;
  },
  findMany: async (query: Query) =>
    runQuery(store.articles as unknown as Row[], query).map((row) => pick(row, query.select)),
  findFirst: async (query: Query) => {
    const [row] = runQuery(store.articles as unknown as Row[], query);
    return row ? pick(row, query.select) : null;
  },
  create: async ({
    data,
    select,
  }: {
    data: Partial<ArticleRow>;
    select?: Record<string, boolean>;
  }) => {
    store.writes += 1;
    const row: ArticleRow = {
      id: newId("article-"),
      source: "ixwiki",
      title: "",
      slug: "",
      status: "PUBLISHED",
      format: "STRUCTURED_JSON",
      namespace: 0,
      namespacePrefix: null,
      wikitext: "",
      contentHtml: null,
      htmlSyncedAt: null,
      summary: null,
      wordCount: 0,
      readingTime: 1,
      mwPageId: null,
      mwLatestRevId: null,
      redirectTargetSlug: null,
      redirectTargetFragment: null,
      protectionLevel: "ALL",
      updatedAt: new Date(),
      ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
    };
    if (store.articles.some((a) => a.source === row.source && a.title === row.title)) {
      throw new Error(`Unique constraint failed on (source, title) = ${row.title}`);
    }
    store.articles.push(row);
    return pick(row, select);
  },
  update: async ({ where, data }: { where: { id: string }; data: Partial<ArticleRow> }) => {
    store.writes += 1;
    const row = store.articles.find((a) => a.id === where.id);
    if (!row) throw new Error(`No article ${where.id}`);
    Object.assign(row, data);
    return { ...row };
  },
};

const revisionDelegate = {
  findMany: async (query: Query) =>
    runQuery(store.revisions as unknown as Row[], query).map((row) => pick(row, query.select)),
  findFirst: async (query: Query) => {
    const [row] = runQuery(store.revisions as unknown as Row[], query);
    return row ? pick(row, query.select) : null;
  },
  createMany: async ({ data }: { data: Array<Partial<RevisionRow>> }) => {
    store.writes += 1;
    for (const item of data) {
      const row: RevisionRow = {
        id: newId("rev-"),
        articleId: "",
        source: "ixwiki",
        mwRevId: null,
        author: null,
        authorId: null,
        summary: null,
        minor: false,
        byteSize: 0,
        byteDelta: 0,
        sha1: null,
        createdAt: new Date(),
        wikitext: "",
        format: "STRUCTURED_JSON",
        ...item,
      };
      checkRevisionUnique(row);
      store.revisions.push(row);
    }
    return { count: data.length };
  },
  update: async ({ where, data }: { where: { id: string }; data: Partial<RevisionRow> }) => {
    store.writes += 1;
    const row = store.revisions.find((r) => r.id === where.id);
    if (!row) throw new Error(`No revision ${where.id}`);
    checkRevisionUnique({ ...row, ...data }, row.id);
    Object.assign(row, data);
    return { ...row };
  },
};

const accountLinkDelegate = {
  findMany: async ({ where, select }: { where: Where; select?: Record<string, boolean> }) =>
    store.accountLinks
      .filter((row) => matches(row as unknown as Row, where))
      .map((row) => pick(row, select)),
};

/** The `db` module: transactions snapshot the store and restore it if the callback throws. */
export function createFakeDbModule() {
  const db = {
    wikiArticle: articleDelegate,
    wikiRevision: revisionDelegate,
    wikiAccountLink: accountLinkDelegate,
    $transaction: async <T>(
      callback: (tx: typeof db) => Promise<T>,
      options?: { maxWait?: number; timeout?: number }
    ): Promise<T> => {
      transactionOptions.push(options);
      const snapshot = {
        articles: store.articles.map((a) => ({ ...a })),
        revisions: store.revisions.map((r) => ({ ...r })),
      };
      try {
        return await callback(db);
      } catch (error) {
        store.articles = snapshot.articles;
        store.revisions = snapshot.revisions;
        throw error;
      }
    },
  };
  return { db };
}

/** The options each `$transaction` call was given. */
export const transactionOptions: Array<{ maxWait?: number; timeout?: number } | undefined> = [];

/** A deep copy of the stored articles and revisions, to compare before/after. */
export function snapshotStore() {
  return JSON.parse(JSON.stringify({ articles: store.articles, revisions: store.revisions }));
}
