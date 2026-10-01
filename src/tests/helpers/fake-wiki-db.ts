/**
 * A tiny in-memory stand-in for the Prisma client's WikiOS tables, for tests that run the real services
 * (PageManagementService, RightsAdminService, the rights engine) end to end. It understands the subset of
 * Prisma the WikiOS code uses: equality, `in`, `not`, `gt`, `contains`, `OR`, compound unique keys (`source_title`),
 * `orderBy`, `take`, `cursor`/`skip`; `select` is ignored (full rows come back). Reads return copies, as a
 * real client does: a row fetched before an update still shows the old values afterwards.
 */

export type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !(value instanceof Date) && !Array.isArray(value)
  );
}

function matches(row: Row, where: Where): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "OR") return (condition as Where[]).some((clause) => matches(row, clause));
    if (key === "AND") return (condition as Where[]).every((clause) => matches(row, clause));
    const value = row[key];
    if (!isPlainObject(condition)) return value === condition;
    if ("contains" in condition) {
      const text = String(value ?? "");
      const needle = String(condition.contains);
      return condition.mode === "insensitive"
        ? text.toLowerCase().includes(needle.toLowerCase())
        : text.includes(needle);
    }
    if (
      value === undefined &&
      !("in" in condition || "notIn" in condition || "not" in condition || "gt" in condition)
    ) {
      return matches(row, condition); // a compound unique key: { source_title: { source, title } }
    }
    if ("startsWith" in condition)
      return String(value ?? "").startsWith(String(condition.startsWith));
    if ("in" in condition) return (condition.in as unknown[]).includes(value);
    if ("notIn" in condition) return !(condition.notIn as unknown[]).includes(value);
    if ("not" in condition) return value !== condition.not;
    if ("gt" in condition) return value !== null && (value as Date) > (condition.gt as Date);
    return false;
  });
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  return (a as number | Date) < (b as number | Date) ? -1 : 1;
}

export interface FindManyArgs {
  where?: Where;
  orderBy?: Array<Record<string, "asc" | "desc">> | Record<string, "asc" | "desc">;
  take?: number;
  cursor?: { id: string };
  skip?: number;
}

export function createTable(defaults: () => Record<string, unknown> = () => ({})) {
  let rows: Row[] = [];
  let counter = 0;
  const table = {
    get rows() {
      return rows;
    },
    reset() {
      rows = [];
      counter = 0;
    },
    seed(...seed: Array<Record<string, unknown>>) {
      for (const data of seed) table.insert(data);
    },
    insert(data: Record<string, unknown>): Row {
      counter += 1;
      const row = {
        id: `row${counter}`,
        createdAt: new Date(Date.UTC(2026, 0, 1) + counter * 1000),
        ...defaults(),
        ...data,
      } as Row;
      rows.push(row);
      return row;
    },
    async create({ data }: { data: Record<string, unknown> }) {
      return { ...table.insert(data) };
    },
    async findMany({ where = {}, orderBy, take, cursor, skip = 0 }: FindManyArgs = {}) {
      let found = rows.filter((row) => matches(row, where));
      for (const order of [orderBy ?? []].flat().reverse()) {
        for (const [field, direction] of Object.entries(order)) {
          found = [...found].sort(
            (a, b) => compare(a[field], b[field]) * (direction === "desc" ? -1 : 1)
          );
        }
      }
      if (cursor) found = found.slice(found.findIndex((row) => row.id === cursor.id) + skip);
      return (take === undefined ? found : found.slice(0, take)).map((row) => ({ ...row }));
    },
    async findFirst(args: FindManyArgs = {}) {
      return (await table.findMany({ ...args, take: 1 }))[0] ?? null;
    },
    async findUnique({ where }: { where: Where }) {
      const row = rows.find((candidate) => matches(candidate, where));
      return row ? { ...row } : null;
    },
    async count({ where = {} }: { where?: Where } = {}) {
      return rows.filter((row) => matches(row, where)).length;
    },
    async update({ where, data }: { where: Where; data: Record<string, unknown> }) {
      const row = rows.find((candidate) => matches(candidate, where));
      if (!row) throw new Error("update: no such row");
      Object.assign(row, data);
      return { ...row };
    },
    async updateMany({ where, data }: { where: Where; data: Record<string, unknown> }) {
      const found = rows.filter((row) => matches(row, where));
      for (const row of found) Object.assign(row, data);
      return { count: found.length };
    },
    async upsert({
      where,
      create,
      update,
    }: {
      where: Where;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) {
      const row = rows.find((candidate) => matches(candidate, where));
      return { ...(row ? Object.assign(row, update) : table.insert(create)) };
    },
    async deleteMany({ where = {} }: { where?: Where } = {}) {
      const before = rows.length;
      rows = rows.filter((row) => !matches(row, where));
      return { count: before - rows.length };
    },
  };
  return table;
}

export type Table = ReturnType<typeof createTable>;

export interface FakeWikiDb {
  user: Table;
  wikiAccountLink: Table;
  wikiUserGroup: Table;
  wikiBlock: Table;
  wikiRestriction: Table;
  wikiArticle: Table;
  wikiRevision: Table;
  wikiLink: Table;
  wikiLog: Table;
  wikiMirrorJob: Table;
  wikiAsset: Table;
  wikiDiscussionThread: Table;
  wikiWatchlist: Table;
  stash: Table;
  stashItem: Table;
  $transaction<T>(work: (tx: FakeWikiDb) => Promise<T>): Promise<T>;
  /** Records the statement (its `?` placeholders) and its values; changes no table. */
  $executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<number>;
}

/** The raw statements run on the fake database since the last `reset`. */
export const executedSql: Array<{ sql: string; values: unknown[] }> = [];

/** The WikiOS tables plus `$transaction` (which just runs the callback against the same tables). */
export function createFakeWikiDb() {
  const tables = {
    user: createTable(),
    // a link the account proved itself, to a wiki account old and active enough to autoconfirm
    wikiAccountLink: createTable(() => ({
      verifiedById: null,
      mwRegisteredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      mwEditCount: 50,
    })),
    wikiUserGroup: createTable(() => ({ expiresAt: null })),
    wikiBlock: createTable(() => ({ allowUserTalk: true, reason: null, expiresAt: null })),
    wikiRestriction: createTable(() => ({ expiresAt: null, cascade: false, reason: null })),
    wikiArticle: createTable(() => ({
      status: "PUBLISHED",
      protectionLevel: "ALL",
      protectionExpiry: null,
    })),
    wikiRevision: createTable(),
    wikiLink: createTable(),
    wikiLog: createTable(() => ({ comment: null, params: null, articleId: null })),
    wikiMirrorJob: createTable(() => ({ state: "pending", attempts: 0, payload: null })),
    wikiAsset: createTable(() => ({
      thumbnailUrl: null,
      width: null,
      height: null,
      blurhash: null,
      sha1: null,
      uploaderId: null,
    })),
    wikiDiscussionThread: createTable(),
    wikiWatchlist: createTable(() => ({ notificationTime: null })),
    stash: createTable(),
    stashItem: createTable(),
  };
  const db: FakeWikiDb = {
    ...tables,
    $transaction: async (work) => work(db),
    $executeRaw: async (strings, ...values) => {
      executedSql.push({ sql: strings.join("?").replace(/\s+/g, " ").trim(), values });
      return 0;
    },
  };
  return {
    db,
    tables,
    reset() {
      for (const table of Object.values(tables)) table.reset();
      executedSql.length = 0;
    },
  };
}

/** The one fake database instance shared by the module registry (what `jest.mock("~/server/db")` hands out). */
export const fakeWikiDb = createFakeWikiDb();
