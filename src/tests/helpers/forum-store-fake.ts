/**
 * An in-memory forum store for the moderation suites (mod-content, mod-reports). Rows live in arrays; where clauses
 * are interpreted (equality, `in`, `notIn`, `not`, `gt`, `OR`, `AND`, `NOT`, nested relation objects), relations are joined on
 * read (thread → category, post → thread → category, link → storyline), selects are ignored. `$transaction` hands
 * the callback `tx`, the only client whose `forumModLog.create` records a row, and rolls every store change and
 * log row back when the callback throws, so "refused → nothing written" is behaviour.
 */
export type Value =
  string | number | boolean | Date | null | undefined | Value[] | { [key: string]: Value };
export type Row = { [key: string]: Value };

export interface StoreState {
  categories: Row[];
  threads: Row[];
  posts: Row[];
  reports: Row[];
  links: Row[];
  realms: Row[];
  users: Row[];
}

const OPERATORS = ["in", "notIn", "not", "gt"];

const isRow = (value: Value): value is Row =>
  value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);

const isOperator = (cond: Row): boolean =>
  Object.keys(cond).length > 0 && Object.keys(cond).every((k) => OPERATORS.includes(k));

const same = (a: Value, b: Value): boolean =>
  a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;

function matchOperator(actual: Value, cond: Row): boolean {
  if (Array.isArray(cond.in) && !cond.in.some((v) => same(actual, v))) return false;
  if (Array.isArray(cond.notIn) && cond.notIn.some((v) => same(actual, v))) return false;
  if ("not" in cond && same(actual, cond.not)) return false;
  if (cond.gt instanceof Date && !(actual instanceof Date && actual > cond.gt)) return false;
  return true;
}

function matchValue(actual: Value, cond: Value): boolean {
  if (isRow(cond)) {
    if (isOperator(cond)) return matchOperator(actual, cond);
    return isRow(actual) && matches(actual, cond);
  }
  return same(actual ?? null, cond);
}

export function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return Array.isArray(cond) && cond.some((c) => isRow(c) && matches(row, c));
    if (key === "NOT") return isRow(cond) && !matches(row, cond);
    if (key === "AND") return Array.isArray(cond) && cond.every((c) => isRow(c) && matches(row, c));
    return matchValue(row[key], cond);
  });
}

function apply(row: Row, data: Row): void {
  for (const [key, value] of Object.entries(data)) {
    const current = row[key];
    row[key] =
      isRow(value) && typeof value.increment === "number" && typeof current === "number"
        ? current + value.increment
        : value;
  }
}

const byCreated = (a: Row, b: Row): number => {
  const at = (r: Row) => (r.createdAt instanceof Date ? r.createdAt.getTime() : 0);
  return at(a) - at(b) || String(a.id).localeCompare(String(b.id));
};

/** A deep copy whose Dates stay in this realm (structuredClone would make them the host's, and `instanceof` fails). */
function cloneValue(value: Value): Value {
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(cloneValue);
  return isRow(value) ? cloneRow(value) : value;
}
const cloneRow = (row: Row): Row =>
  Object.fromEntries(Object.entries(row).map(([key, value]) => [key, cloneValue(value)]));
const cloneRows = (rows: Row[] = []): Row[] => rows.map(cloneRow);

const cloneState = (state: Partial<StoreState>): StoreState => ({
  categories: cloneRows(state.categories),
  threads: cloneRows(state.threads),
  posts: cloneRows(state.posts),
  reports: cloneRows(state.reports),
  links: cloneRows(state.links),
  realms: cloneRows(state.realms),
  users: cloneRows(state.users),
});

interface Args {
  where?: Row;
  data?: Row;
  skip?: number;
  take?: number;
  orderBy?: Value;
}

let created = 0;

export function forumStore(seed: Partial<StoreState>) {
  const state = cloneState(seed);
  const logs: Row[] = [];
  const categoryOf = (row: Row) => state.categories.find((c) => c.id === row.categoryId) ?? null;
  const thread = (row: Row): Row => ({ ...row, category: categoryOf(row) });
  const post = (row: Row): Row => {
    const parent = state.threads.find((t) => t.id === row.threadId);
    return { ...row, thread: parent ? thread(parent) : null };
  };
  const copy = (row: Row | undefined): Row | null => (row ? cloneRow(row) : null);

  function delegate(rows: () => Row[], join: (row: Row) => Row = (r) => r, defaults: Row = {}) {
    const hits = (where?: Row) => rows().filter((r) => matches(join(r), where));
    return {
      findUnique: jest.fn(async ({ where }: Args) => copy(hits(where).map(join)[0])),
      findFirst: jest.fn(async ({ where }: Args) =>
        copy([...hits(where)].sort(byCreated).map(join)[0])
      ),
      findMany: jest.fn(async ({ where, skip = 0, take }: Args = {}) =>
        hits(where)
          .map(join)
          .slice(skip, take === undefined ? undefined : skip + take)
          .map(cloneRow)
      ),
      count: jest.fn(async ({ where }: Args = {}) => hits(where).length),
      update: jest.fn(async ({ where, data = {} }: Args) => {
        const row = hits(where)[0];
        if (!row) throw new Error("Record to update not found.");
        apply(row, data);
        return copy(row);
      }),
      updateMany: jest.fn(async ({ where, data = {} }: Args) => {
        const found = hits(where);
        found.forEach((row) => apply(row, data));
        return { count: found.length };
      }),
      create: jest.fn(async ({ data = {} }: Args) => {
        created += 1;
        const row: Row = { id: `new_${created}`, createdAt: new Date(), ...defaults, ...data };
        rows().push(row);
        return copy(row);
      }),
      deleteMany: jest.fn(async ({ where }: Args) => {
        const keep = rows().filter((r) => !matches(join(r), where));
        const count = rows().length - keep.length;
        rows().splice(0, rows().length, ...keep);
        return { count };
      }),
    };
  }

  const reports = delegate(
    () => state.reports,
    (r) => r,
    {
      status: "open",
      handledBy: null,
      handledAt: null,
      note: null,
    }
  );
  const client = {
    forumCategory: delegate(() => state.categories),
    forumThread: delegate(() => state.threads, thread),
    forumPost: {
      ...delegate(() => state.posts, post),
      aggregate: jest.fn(async ({ where }: Args) => {
        const dates = state.posts
          .filter((r) => matches(r, where))
          .map((r) => r.createdAt)
          .filter((d): d is Date => d instanceof Date);
        const max = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
        return { _max: { createdAt: max } };
      }),
    },
    forumReport: {
      ...reports,
      findMany: jest.fn(async (args: Args = {}) => {
        const sorted = [...state.reports].sort((a, b) => byCreated(b, a));
        const skip = args.skip ?? 0;
        return sorted
          .filter((r) => matches(r, args.where))
          .slice(skip, args.take === undefined ? undefined : skip + args.take)
          .map(cloneRow);
      }),
    },
    postActionLink: delegate(() => state.links),
    realm: delegate(() => state.realms),
    user: delegate(() => state.users),
  };
  const tx = {
    ...client,
    forumModLog: {
      create: jest.fn(async ({ data = {} }: Args) => {
        logs.push(data);
        return data;
      }),
    },
    $executeRaw: jest.fn(async () => 1),
  };
  const db = {
    ...client,
    forumModLog: { create: jest.fn() },
    $executeRaw: jest.fn(async () => 1),
    $transaction: jest.fn(async <T>(fn: (client: typeof tx) => Promise<T>): Promise<T> => {
      const snapshot = cloneState(state);
      const logCount = logs.length;
      try {
        return await fn(tx);
      } catch (error) {
        Object.assign(state, snapshot);
        logs.length = logCount;
        throw error;
      }
    }),
  };
  return { db, tx, state, logs };
}

/** A log row's parsed detail. */
export const detailOf = (log: Row | undefined): Row =>
  typeof log?.detail === "string" ? (JSON.parse(log.detail) as Row) : {};
