/**
 * A tiny in-memory stand-in for the Prisma client's WikiOS tables, for tests that run the real services
 * (PageManagementService, RightsAdminService, the rights engine) end to end. It understands the subset of
 * Prisma the WikiOS code uses: equality, `in`, `not`, `gt`, `contains`, a JSON `path`/`equals` filter, `OR`, compound unique keys (`source_title`),
 * `orderBy`, `take`, `cursor`/`skip`; `select` is ignored (full rows come back). Reads return copies, as a
 * real client does: a row fetched before an update still shows the old values afterwards.
 *
 * `createFakeWikiDb({ prisma: true })` (the scenario tests) is closer to Prisma: rows get the schema's column defaults,
 * `select`/`include`, `where` and `orderBy` follow the relations the WikiOS reads use (an article's revisions and
 * categories, a revision's article, a membership's category), `lt`/`lte`/`gte`/`equals` (with `mode`) and the
 * `increment`/`decrement` updates work, an update stamps `updatedAt`, `withJobLock`'s lease, `fillRevisionParents` and the
 * statements that mark a template's or a file's users stale are modelled, `createMany({ skipDuplicates })` honours the
 * unique columns of UNIQUE_COLUMNS (a conflict's key), and `onQueryRaw` answers raw queries a test models.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !(value instanceof Date) && !Array.isArray(value)
  );
}

/** A relation the Prisma mode follows: rows of `table` whose `foreign` column equals this row's `local` column. */
interface Relation {
  table: string;
  many: boolean;
  local: string;
  foreign: string;
}

const RELATIONS: Record<string, Record<string, Relation>> = {
  wikiArticle: {
    revisions: { table: "wikiRevision", many: true, local: "id", foreign: "articleId" },
    categories: { table: "wikiCategoryMember", many: true, local: "id", foreign: "articleId" },
    templateLinks: { table: "wikiTemplateLink", many: true, local: "id", foreign: "articleId" },
    imageLinks: { table: "wikiImageLink", many: true, local: "id", foreign: "articleId" },
    outgoingLinks: { table: "wikiLink", many: true, local: "id", foreign: "sourceArticleId" },
    watchers: { table: "wikiWatchlist", many: true, local: "id", foreign: "articleId" },
  },
  wikiRevision: {
    article: { table: "wikiArticle", many: false, local: "articleId", foreign: "id" },
  },
  wikiCategoryMember: {
    category: { table: "wikiCategory", many: false, local: "categoryId", foreign: "id" },
    article: { table: "wikiArticle", many: false, local: "articleId", foreign: "id" },
  },
  wikiCategory: {
    members: { table: "wikiCategoryMember", many: true, local: "id", foreign: "categoryId" },
  },
  wikiTemplateLink: {
    article: { table: "wikiArticle", many: false, local: "articleId", foreign: "id" },
  },
  wikiImageLink: {
    article: { table: "wikiArticle", many: false, local: "articleId", foreign: "id" },
  },
  wikiLink: {
    sourceArticle: { table: "wikiArticle", many: false, local: "sourceArticleId", foreign: "id" },
  },
  wikiWatchlist: {
    article: { table: "wikiArticle", many: false, local: "articleId", foreign: "id" },
    user: { table: "user", many: false, local: "userId", foreign: "id" },
  },
  wikiNameClaim: { user: { table: "user", many: false, local: "userId", foreign: "id" } },
  wikiAsset: {},
};

/** What a Prisma-mode table reads its relations from: every table of its database, by name. */
interface Schema {
  tables: () => Record<string, { rows: Row[] }>;
}

const time = (value: unknown) => (value instanceof Date ? value.getTime() : value);

/** The default mode's order: `<` on the raw values, as before the Prisma mode existed. */
function looseCompare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  return (a as number | Date) < (b as number | Date) ? -1 : 1;
}

/** The Prisma mode's order: dates by time, nulls first. */
function compare(a: unknown, b: unknown): number {
  const left = time(a);
  const right = time(b);
  if (left === right) return 0;
  if (left === null || left === undefined) return -1;
  if (right === null || right === undefined) return 1;
  return (left as number) < (right as number) ? -1 : 1;
}

/** One column condition of the Prisma mode, or undefined when `condition` is none of its operators. */
function prismaOperator(value: unknown, condition: Record<string, unknown>): boolean | undefined {
  const insensitive = condition.mode === "insensitive";
  const fold = (text: unknown) => (insensitive ? String(text ?? "").toLowerCase() : text);
  if ("equals" in condition && !("path" in condition)) {
    return fold(value) === fold(condition.equals);
  }
  const bounds: Array<[string, (order: number) => boolean]> = [
    ["lt", (order) => order < 0],
    ["lte", (order) => order <= 0],
    ["gt", (order) => order > 0],
    ["gte", (order) => order >= 0],
  ];
  const set = bounds.filter(([key]) => key in condition);
  if (set.length > 0) {
    if (value === null || value === undefined) return false;
    return set.every(([key, holds]) => holds(compare(value, condition[key])));
  }
  return undefined;
}

const rowsOf = (schema: Schema, table: string): Row[] => schema.tables()[table]!.rows;

function relationMatches(
  schema: Schema,
  relation: Relation,
  row: Row,
  condition: Record<string, unknown>
): boolean {
  const linked = rowsOf(schema, relation.table).filter(
    (other) => other[relation.foreign] === row[relation.local]
  );
  const test = (other: Row, where: unknown) =>
    matchesIn(schema, relation.table, other, (where ?? {}) as Where);
  if (!relation.many) {
    const [one] = linked;
    if ("is" in condition) return condition.is === null ? !one : !!one && test(one, condition.is);
    if ("isNot" in condition)
      return condition.isNot === null ? !!one : !one || !test(one, condition.isNot);
    return !!one && test(one, condition);
  }
  if ("some" in condition) return linked.some((other) => test(other, condition.some));
  if ("none" in condition) return !linked.some((other) => test(other, condition.none));
  if ("every" in condition) return linked.every((other) => test(other, condition.every));
  return false;
}

/** `matches`, and in the Prisma mode (`schema` set) the relations and operators of `table` too. */
function matchesIn(schema: Schema | null, table: string, row: Row, where: Where): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "OR")
      return (condition as Where[]).some((clause) => matchesIn(schema, table, row, clause));
    if (key === "AND") {
      return [condition].flat().every((clause) => matchesIn(schema, table, row, clause as Where));
    }
    if (key === "NOT" && schema) {
      return ![condition].flat().some((clause) => matchesIn(schema, table, row, clause as Where));
    }
    const value = row[key];
    const relation = schema ? RELATIONS[table]?.[key] : undefined;
    if (relation && isPlainObject(condition))
      return relationMatches(schema!, relation, row, condition);
    // a boolean column with a false default reads as false on a row written without it (Prisma mode)
    if (schema && condition === false && value === undefined) return true;
    if (schema && condition === null) return value === null || value === undefined;
    if (!isPlainObject(condition))
      return (
        value === condition ||
        (schema !== null && time(value) === time(condition) && value instanceof Date)
      );
    if ("path" in condition && "equals" in condition) {
      // a JSON path filter: { path: ["sha1"], equals: "..." }
      const found = (condition.path as string[]).reduce<unknown>(
        (node, step) => (isPlainObject(node) ? node[step] : undefined),
        value
      );
      return found === condition.equals;
    }
    if ("contains" in condition) {
      const text = String(value ?? "");
      const needle = String(condition.contains);
      return condition.mode === "insensitive"
        ? text.toLowerCase().includes(needle.toLowerCase())
        : text.includes(needle);
    }
    if (schema) {
      const answer = prismaOperator(value, condition);
      if (answer !== undefined) return answer;
    }
    if (
      value === undefined &&
      !("in" in condition || "notIn" in condition || "not" in condition || "gt" in condition)
    ) {
      return matchesIn(schema, table, row, condition); // a compound unique key: { source_title: { source, title } }
    }
    if ("startsWith" in condition)
      return String(value ?? "").startsWith(String(condition.startsWith));
    if ("in" in condition) return (condition.in as unknown[]).includes(value);
    if ("notIn" in condition) return !(condition.notIn as unknown[]).includes(value);
    if ("not" in condition) {
      if (schema && isPlainObject(condition.not))
        return !matchesIn(schema, table, row, { [key]: condition.not });
      if (schema && condition.not === null) return value !== null && value !== undefined;
      return value !== condition.not;
    }
    if ("gt" in condition) return value !== null && (value as Date) > (condition.gt as Date);
    return false;
  });
}

type Order = Record<string, unknown>;

export interface FindManyArgs {
  where?: Where;
  orderBy?: Array<Record<string, "asc" | "desc">> | Record<string, "asc" | "desc">;
  take?: number;
  cursor?: { id: string };
  skip?: number;
  select?: Record<string, unknown>;
  include?: Record<string, unknown>;
}

/** The value `order` sorts `row` by, following a relation (`{ category: { name: "asc" } }`) in the Prisma mode. */
function orderKey(
  schema: Schema | null,
  table: string,
  row: Row,
  field: string,
  direction: unknown
): [unknown, string] {
  const relation = schema ? RELATIONS[table]?.[field] : undefined;
  if (relation && isPlainObject(direction)) {
    const [inner, innerDirection] = Object.entries(direction)[0]!;
    const linked = rowsOf(schema!, relation.table).find(
      (other) => other[relation.foreign] === row[relation.local]
    );
    return linked ? orderKey(schema, relation.table, linked, inner, innerDirection) : [null, "asc"];
  }
  if (schema && isPlainObject(direction)) return [row[field], String(direction.sort ?? "asc")];
  return [row[field], String(direction)];
}

function sortRows(schema: Schema | null, table: string, rows: Row[], orderBy: unknown): Row[] {
  let found = rows;
  for (const order of [orderBy ?? []].flat().reverse() as Order[]) {
    const entries = Object.entries(order);
    for (const [field, direction] of schema ? entries.reverse() : entries) {
      found = [...found].sort((a, b) => {
        const [left, dir] = orderKey(schema, table, a, field, direction);
        const [right] = orderKey(schema, table, b, field, direction);
        return (schema ? compare : looseCompare)(left, right) * (dir === "desc" ? -1 : 1);
      });
    }
  }
  return found;
}

/** `row` with the relations `shape` (a select or an include) names, read from the other tables (Prisma mode). */
function project(schema: Schema | null, table: string, row: Row, args: FindManyArgs): Row {
  const copy = { ...row };
  const shape = args.select ?? args.include;
  if (!schema || !shape) return copy;
  for (const [key, spec] of Object.entries(shape)) {
    if (!spec) continue;
    if (key === "_count" && isPlainObject(spec)) {
      const counted = (spec.select ?? {}) as Record<string, unknown>;
      copy._count = Object.fromEntries(
        Object.entries(counted).map(([name, inner]) => [
          name,
          related(schema, table, row, name, isPlainObject(inner) ? (inner as FindManyArgs) : {})
            .length,
        ])
      );
      continue;
    }
    const relation = RELATIONS[table]?.[key];
    if (!relation) continue;
    const nested = isPlainObject(spec) ? (spec as FindManyArgs) : {};
    const rows = related(schema, table, row, key, nested);
    copy[key] = relation.many ? rows : (rows[0] ?? null);
  }
  return copy;
}

function related(schema: Schema, table: string, row: Row, key: string, args: FindManyArgs): Row[] {
  const relation = RELATIONS[table]![key]!;
  let rows = rowsOf(schema, relation.table).filter(
    (other) =>
      other[relation.foreign] === row[relation.local] &&
      matchesIn(schema, relation.table, other, args.where ?? {})
  );
  rows = sortRows(schema, relation.table, rows, args.orderBy);
  rows = rows.slice(args.skip ?? 0);
  if (args.take !== undefined) rows = rows.slice(0, args.take);
  return rows.map((other) => project(schema, relation.table, other, args));
}

/** `data` applied to `row`: plain values, and in the Prisma mode `increment`/`decrement`/`set` and the `updatedAt` stamp. */
function applyUpdate(schema: Schema | null, row: Row, data: Record<string, unknown>): void {
  if (!schema) {
    Object.assign(row, data);
    return;
  }
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (isPlainObject(value) && "increment" in value)
      row[key] = Number(row[key] ?? 0) + Number(value.increment);
    else if (isPlainObject(value) && "decrement" in value)
      row[key] = Number(row[key] ?? 0) - Number(value.decrement);
    else if (isPlainObject(value) && "set" in value) row[key] = value.set;
    else row[key] = value;
  }
  if ("updatedAt" in row && !("updatedAt" in data)) row.updatedAt = new Date();
}

let lastStamp = 0;
/** The time now, never the same twice. */
function monotonicNow(): Date {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return new Date(lastStamp);
}

/** The unique column `createMany({ skipDuplicates })` checks in the Prisma mode, by table (only where a test needs it). */
const UNIQUE_COLUMNS: Record<string, string> = { wikiConflict: "key" };

export function createTable(
  defaults: () => Record<string, unknown> = () => ({}),
  name = "",
  schema: Schema | null = null
) {
  let rows: Row[] = [];
  let counter = 0;
  const matches = (row: Row, where: Where) => matchesIn(schema, name, row, where);
  const table = {
    get rows() {
      return rows;
    },
    reset() {
      rows = [];
      counter = 0;
    },
    /** The rows as they are now, for `restore` (a transaction that fails puts them back). */
    snapshot() {
      return { rows: rows.map((row) => ({ ...row })), counter };
    },
    restore(saved: { rows: Row[]; counter: number }) {
      rows = saved.rows;
      counter = saved.counter;
    },
    seed(...seed: Array<Record<string, unknown>>) {
      for (const data of seed) table.insert(data);
    },
    insert(data: Record<string, unknown>): Row {
      counter += 1;
      // Prisma mode: `now()`, a millisecond apart at least, so rows written in one test keep their order
      const stamp = schema ? monotonicNow() : new Date(Date.UTC(2026, 0, 1) + counter * 1000);
      const row = {
        id: `${schema && name ? `${name}-` : "row"}${counter}`,
        createdAt: stamp,
        ...(schema ? { updatedAt: stamp } : {}),
        ...defaults(),
        ...(schema
          ? Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))
          : data),
      } as Row;
      rows.push(row);
      return row;
    },
    async create(args: { data: Record<string, unknown> } & FindManyArgs) {
      return project(schema, name, table.insert(args.data), args);
    },
    async createMany({
      data,
      skipDuplicates = false,
    }: {
      data: Array<Record<string, unknown>>;
      skipDuplicates?: boolean;
    }) {
      // Prisma mode: `skipDuplicates` leaves out a row whose unique column (UNIQUE_COLUMNS) another row already holds
      const unique = schema && skipDuplicates ? UNIQUE_COLUMNS[name] : undefined;
      const fresh = unique
        ? data.filter((item) => !rows.some((row) => row[unique] === item[unique]))
        : data;
      for (const item of fresh) table.insert(item);
      return { count: fresh.length };
    },
    async findMany(args: FindManyArgs = {}) {
      const { where = {}, orderBy, take, cursor, skip = 0 } = args;
      let found = sortRows(
        schema,
        name,
        rows.filter((row) => matches(row, where)),
        orderBy
      );
      if (cursor) found = found.slice(found.findIndex((row) => row.id === cursor.id) + skip);
      else found = found.slice(skip);
      return (take === undefined ? found : found.slice(0, take)).map((row) =>
        project(schema, name, row, args)
      );
    },
    async findFirst(args: FindManyArgs = {}) {
      return (await table.findMany({ ...args, take: 1 }))[0] ?? null;
    },
    async findUnique(args: { where: Where } & FindManyArgs) {
      const row = rows.find((candidate) => matches(candidate, args.where));
      return row ? project(schema, name, row, args) : null;
    },
    async findUniqueOrThrow(args: { where: Where } & FindManyArgs) {
      const found = await table.findUnique(args);
      if (!found) throw new Error("findUniqueOrThrow: no such row");
      return found;
    },
    async count({ where = {} }: { where?: Where } = {}) {
      return rows.filter((row) => matches(row, where)).length;
    },
    async update(args: { where: Where; data: Record<string, unknown> } & FindManyArgs) {
      const row = rows.find((candidate) => matches(candidate, args.where));
      if (!row) throw new Error("update: no such row");
      applyUpdate(schema, row, args.data);
      return project(schema, name, row, args);
    },
    async updateMany({ where, data }: { where: Where; data: Record<string, unknown> }) {
      const found = rows.filter((row) => matches(row, where));
      for (const row of found) applyUpdate(schema, row, data);
      return { count: found.length };
    },
    async upsert(
      args: {
        where: Where;
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      } & FindManyArgs
    ) {
      const row = rows.find((candidate) => matches(candidate, args.where));
      if (row) applyUpdate(schema, row, args.update);
      return project(schema, name, row ?? table.insert(args.create), args);
    },
    async delete({ where }: { where: Where }) {
      const row = rows.find((candidate) => matches(candidate, where));
      if (!row) throw new Error("delete: no such row");
      rows = rows.filter((candidate) => candidate !== row);
      return { ...row };
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
  wikiTemplateLink: Table;
  wikiImageLink: Table;
  wikiCategory: Table;
  wikiCategoryMember: Table;
  wikiLog: Table;
  wikiMirrorJob: Table;
  wikiConflict: Table;
  wikiAsset: Table;
  wikiDiscussionThread: Table;
  wikiWatchlist: Table;
  wikiNameClaim: Table;
  wikiRevisionClaimTag: Table;
  stash: Table;
  stashItem: Table;
  systemConfig: Table;
  notification: Table;
  $transaction<T>(work: (tx: FakeWikiDb) => Promise<T>, options?: TransactionOptions): Promise<T>;
  /**
   * Records the statement (its `?` placeholders) and its values; changes no table. `pg_advisory_xact_lock(hashtext(key))`
   * is understood: it waits for the transaction that holds the key, and holds it until its own ends.
   */
  $executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<number>;
  /**
   * Returns no rows, but for `SELECT "id" FROM wiki_articles ... FOR NO KEY UPDATE` (a save's row lock): it waits for the
   * transaction that holds the row, holds it until its own ends, and answers the row's id (none: no row, no lock). The real
   * client cannot read the `void` the advisory lock returns: asking it to is an error here too.
   */
  $queryRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
}

/** What Prisma's interactive `$transaction` takes after the callback (the fake only records it). */
export interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
}

/** The options of each `$transaction` since the last `reset`, in order (`undefined` where none were given). */
export const transactionOptions: Array<TransactionOptions | undefined> = [];

/** The raw statements run on the fake database since the last `reset`. */
export const executedSql: Array<{ sql: string; values: unknown[] }> = [];
/** The keys of the advisory locks taken since the last `reset`, in order. */
export const advisoryLocks: string[] = [];

/** The locks the running transaction holds (transaction-scoped advisory locks are released when it ends). */
const transactions = new AsyncLocalStorage<{ releases: Array<() => void> }>();
/** For each key, the end of the queue of transactions waiting for it. */
const lockQueues = new Map<string, Promise<void>>();

async function acquireAdvisoryLock(key: string, record = true): Promise<void> {
  if (record) advisoryLocks.push(key);
  const transaction = transactions.getStore();
  if (!transaction) return;
  const before = lockQueues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((resolve) => (release = resolve));
  lockQueues.set(
    key,
    before.then(() => mine)
  );
  transaction.releases.push(release);
  await before;
}

/** The schema's column defaults the Prisma mode gives a row written without them. */
const PRISMA_DEFAULTS: Record<string, () => Record<string, unknown>> = {
  user: () => ({ clerkUserId: null, roleId: null, countryId: null }),
  wikiArticle: () => ({
    slug: "",
    source: "ixwiki",
    status: "PUBLISHED",
    format: "STRUCTURED_JSON",
    namespace: 0,
    namespacePrefix: null,
    wikitext: "",
    contentHtml: null,
    contentJson: null,
    renderedView: null,
    htmlSyncedAt: null,
    summary: null,
    readingTime: 1,
    wordCount: 0,
    viewCount: 0,
    protectionLevel: "ALL",
    protectionExpiry: null,
    redirectTargetSlug: null,
    redirectTargetFragment: null,
    leadImageUrl: null,
    displayTitle: null,
    pageProps: null,
    mwPageId: null,
    mwLatestRevId: null,
    pageId: null,
    authorId: null,
    lastEditorId: null,
    syncedAt: new Date(Date.UTC(2026, 0, 1)),
  }),
  wikiRevision: () => ({
    format: "STRUCTURED_JSON",
    source: "ixwiki",
    mwRevId: null,
    revId: null,
    author: null,
    authorId: null,
    summary: null,
    minor: false,
    contentHtml: null,
    byteSize: 0,
    byteDelta: 0,
    sha1: null,
    textDeleted: false,
    commentDeleted: false,
    userDeleted: false,
    parked: false,
    parkReason: null,
    parentRevisionId: null,
  }),
  wikiCategory: () => ({ hidden: false, parentId: null, description: null }),
  wikiLink: () => ({ isExternal: false, targetArticleId: null, sectionAnchor: null }),
  wikiMirrorJob: () => ({
    source: "ixwiki",
    state: "pending",
    attempts: 0,
    payload: null,
    articleId: null,
    revisionId: null,
    logId: null,
    mwRevId: null,
    lastError: null,
    nextAttemptAt: new Date(Date.UTC(2026, 0, 1)),
    finishedAt: null,
  }),
  wikiWatchlist: () => ({ notificationTime: null, lastViewedTime: new Date(Date.UTC(2026, 0, 1)) }),
  wikiConflict: () => ({
    source: "ixwiki",
    articleId: null,
    baseRef: null,
    notified: [],
    trailRevisionId: null,
    legacyPark: false,
    settledAt: null,
  }),
  notification: () => ({ read: false, dismissed: false }),
};

export interface FakeWikiDbOptions {
  /** Prisma's column defaults, relations and operators (see the file comment). */
  prisma?: boolean;
}

/** The WikiOS tables plus `$transaction` (which just runs the callback against the same tables). */
export function createFakeWikiDb({ prisma = false }: FakeWikiDbOptions = {}) {
  const schema: Schema | null = prisma ? { tables: () => tables } : null;
  // Typed, not inferred: inferring it reads `schema`, whose initializer reads `tables`, and that cycle silently made
  // every table (and so every row a test reads) `any`
  const table = (name: string, defaults: () => Record<string, unknown> = () => ({})): Table =>
    createTable(
      prisma ? () => ({ ...PRISMA_DEFAULTS[name]?.(), ...defaults() }) : defaults,
      name,
      schema
    );
  const tables = {
    user: table("user"),
    // a link the account proved itself, to a wiki account old and active enough to autoconfirm
    wikiAccountLink: table("wikiAccountLink", () => ({
      verifiedById: null,
      mwRegisteredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      mwEditCount: 50,
    })),
    wikiUserGroup: table("wikiUserGroup", () => ({ expiresAt: null })),
    wikiBlock: table("wikiBlock", () => ({ allowUserTalk: true, reason: null, expiresAt: null })),
    wikiRestriction: table("wikiRestriction", () => ({
      expiresAt: null,
      cascade: false,
      reason: null,
    })),
    wikiArticle: table("wikiArticle", () => ({
      status: "PUBLISHED",
      protectionLevel: "ALL",
      protectionExpiry: null,
    })),
    wikiRevision: table("wikiRevision"),
    wikiLink: table("wikiLink"),
    wikiTemplateLink: table("wikiTemplateLink"),
    wikiImageLink: table("wikiImageLink"),
    wikiCategory: table("wikiCategory"),
    wikiCategoryMember: table("wikiCategoryMember"),
    wikiLog: table("wikiLog", () => ({ comment: null, params: null, articleId: null })),
    wikiMirrorJob: table("wikiMirrorJob", () => ({ state: "pending", attempts: 0, payload: null })),
    wikiConflict: table("wikiConflict"),
    wikiAsset: table("wikiAsset", () => ({
      thumbnailUrl: null,
      width: null,
      height: null,
      blurhash: null,
      sha1: null,
      uploaderId: null,
    })),
    wikiDiscussionThread: table("wikiDiscussionThread"),
    wikiWatchlist: table("wikiWatchlist", () => ({ notificationTime: null })),
    // an approved, shown IxWiki name claim (src/lib/identity/wiki-names.ts reads only APPROVED ones)
    wikiNameClaim: table("wikiNameClaim", () => ({
      status: "APPROVED",
      visible: true,
      rightsPass: false,
      source: "ixwiki",
      decidedAt: null,
      mwUserId: null,
    })),
    wikiRevisionClaimTag: table("wikiRevisionClaimTag", () => ({ undoneAt: null })),
    stash: table("stash"),
    stashItem: table("stashItem"),
    systemConfig: table("systemConfig"),
    notification: table("notification"),
  };
  /** withJobLock's leases (Prisma mode), by name. */
  const leases = new Map<string, { holder: string; expiresAt: number }>();
  /** A raw query the test models: return its rows, or undefined to fall through to the fake's own. */
  const rawQueryHandlers: Array<(sql: string, values: unknown[]) => unknown[] | undefined> = [];
  const db: FakeWikiDb = {
    ...tables,
    // a transaction that throws changes nothing, as in PostgreSQL
    $transaction: async (work, options) => {
      if (Array.isArray(work)) return Promise.all(work) as never; // the batch form: $transaction([a, b])
      transactionOptions.push(options);
      const saved = Object.values(tables).map((one) => [one, one.snapshot()] as const);
      const transaction = { releases: [] as Array<() => void> };
      try {
        return await transactions.run(transaction, () => work(db));
      } catch (error) {
        for (const [one, snapshot] of saved) one.restore(snapshot);
        throw error;
      } finally {
        for (const release of transaction.releases) release();
      }
    },
    $queryRaw: async (strings, ...values) => {
      const sql = strings.join("?").replace(/\s+/g, " ");
      if (sql.includes("pg_advisory_xact_lock")) {
        // what Prisma does with a `SELECT` of a `void` column: the lock must be taken with $executeRaw
        throw new Error("Failed to deserialize column of type 'void'");
      }
      if (/FROM wiki_articles WHERE "source" = \? AND "title" = \? FOR NO KEY UPDATE/.test(sql)) {
        // `ArticleRepository.saveArticle`'s row lock: held until the transaction ends; no row, no lock (and no row back)
        const [source, title] = values;
        const row = tables.wikiArticle.rows.find((a) => a.source === source && a.title === title);
        if (!row) return [];
        await acquireAdvisoryLock(`row:${row.id}`, false);
        return [{ id: row.id }];
      }
      for (const handle of rawQueryHandlers) {
        const answer = handle(sql, values);
        if (answer !== undefined) return answer;
      }
      if (prisma && sql.includes('INSERT INTO "job_leases"')) {
        // withJobLock's lease: taken when free or expired, by the holder that asked
        const [name, holder, seconds] = values as [string, string, number];
        const lease = leases.get(name);
        if (lease && lease.expiresAt > Date.now()) return [];
        leases.set(name, { holder, expiresAt: Date.now() + seconds * 1000 });
        return [{ holder }];
      }
      return [];
    },
    $executeRaw: async (strings, ...values) => {
      if (strings.join("?").includes("pg_advisory_xact_lock")) {
        // the two-int form `(namespace, hashtext(key))`: the single-int keys are another space, which the services avoid
        if (values.length !== 2) throw new Error("an advisory lock takes a namespace and a key");
        await acquireAdvisoryLock(values.join(":"));
        return 0;
      }
      const sql = strings.join("?").replace(/\s+/g, " ").trim();
      executedSql.push({ sql, values });
      if (prisma && sql.startsWith('DELETE FROM "job_leases"')) {
        const [name, holder] = values as [string, string];
        if (leases.get(name)?.holder === holder) leases.delete(name);
        return 1;
      }
      const users =
        /UPDATE wiki_articles SET "htmlSyncedAt" = NULL WHERE source = \? AND "htmlSyncedAt" IS NOT NULL AND id IN \(SELECT "articleId" FROM (wiki_template_links|wiki_image_links) WHERE "(templateTitle|fileName)" = \?\)/.exec(
          sql
        );
      if (prisma && users) {
        // invalidateDependents and the mirror's upload: the pages that transclude a page, or show a file, go stale
        const [source, name] = values as [string, string];
        const linked = (
          users[1] === "wiki_template_links" ? tables.wikiTemplateLink : tables.wikiImageLink
        ).rows;
        const ids = new Set(
          linked.filter((row) => row[users[2]!] === name).map((row) => row.articleId)
        );
        const stale = tables.wikiArticle.rows.filter(
          (row) => row.source === source && row.htmlSyncedAt && ids.has(row.id)
        );
        for (const row of stale) row.htmlSyncedAt = null;
        return stale.length;
      }
      if (prisma && sql.includes('SET "parentRevisionId" = chain."previousId"')) {
        // fillRevisionParents: each live revision without a parent gets the live one before it, by (createdAt, id)
        const live = sortRows(
          schema,
          "wikiRevision",
          tables.wikiRevision.rows.filter(
            (row) => row.articleId === values[0] && row.parked !== true
          ),
          [{ createdAt: "asc" }, { id: "asc" }]
        );
        let set = 0;
        live.forEach((row, at) => {
          if (at > 0 && !row.parentRevisionId) {
            row.parentRevisionId = live[at - 1]!.id;
            set += 1;
          }
        });
        return set;
      }
      return 0;
    },
  };
  return {
    db,
    tables,
    /** Answers a raw query the fake does not model (Prisma mode tests: a job lease, a counted listing). */
    onQueryRaw(handle: (sql: string, values: unknown[]) => unknown[] | undefined) {
      rawQueryHandlers.push(handle);
    },
    reset() {
      for (const one of Object.values(tables)) one.reset();
      rawQueryHandlers.length = 0;
      leases.clear();
      executedSql.length = 0;
      advisoryLocks.length = 0;
      transactionOptions.length = 0;
    },
  };
}

/** The one fake database instance shared by the module registry (what `jest.mock("~/server/db")` hands out). */
export const fakeWikiDb = createFakeWikiDb();
