/**
 * An in-memory database for the XenForo importer suites (import-db, import-rollback): the tables the importer
 * touches, where clauses interpreted by forum-store-fake's `matches` (post → thread → category joined on read),
 * unique keys enforced (`create` throws P2002, `createMany({ skipDuplicates })` skips), thread deletes cascading to
 * posts, and `$transaction` rolling every table back when its callback throws. `failWhen` makes a call throw, to
 * interrupt a run part way. Seeded rows take the column defaults. Selects and orderBy are ignored (findFirst returns the earliest createdAt).
 */
import { Prisma } from "@prisma/client";
import { matches, type Row, type Value } from "./forum-store-fake";

export interface ImportTables {
  users: Row[];
  realms: Row[];
  categories: Row[];
  threads: Row[];
  posts: Row[];
  links: Row[];
  configs: Row[];
  assets: Row[];
}

type TableName = keyof ImportTables;

interface Args {
  where?: Row;
  data?: Row | Row[];
  create?: Row;
  update?: Row;
  skipDuplicates?: boolean;
}

const TABLES: readonly TableName[] = [
  "users",
  "realms",
  "categories",
  "threads",
  "posts",
  "links",
  "configs",
  "assets",
];

/** Column sets that must be unique, per table: a null never collides, except in a column marked "?" (the site partial index). */
const UNIQUE: Record<TableName, string[][]> = {
  users: [["id"]],
  realms: [["id"], ["slug"]],
  categories: [["id"], ["scope", "realmId?", "key"]],
  threads: [["id"], ["xenforoThreadId"], ["sourceRef"]],
  posts: [["id"], ["xenforoPostId"], ["sourceRef"]],
  links: [["id"], ["postSource", "postRef", "activityId"]],
  configs: [["id"], ["key"]],
  assets: [["id"], ["source", "sourceRef"]],
};

const DEFAULTS: Record<TableName, Row> = {
  users: { forumUserId: null },
  realms: {},
  categories: {
    scope: "site",
    realmId: null,
    description: null,
    order: 0,
    visibility: "public",
    postRole: "any",
    icAllowed: false,
  },
  threads: {
    authorUserId: null,
    authorPersonaId: null,
    importedAuthorName: null,
    xenforoUserId: null,
    pinned: false,
    locked: false,
    hidden: false,
    archived: false,
    postCount: 0,
    xenforoThreadId: null,
    sourceRef: null,
  },
  posts: {
    authorUserId: null,
    authorPersonaId: null,
    hidden: false,
    editedAt: null,
    importedAuthorName: null,
    xenforoPostId: null,
    xenforoUserId: null,
    sourceRef: null,
  },
  links: { storylineId: null, chainOrder: null },
  configs: { description: null },
  assets: {},
};

const cloneValue = (value: Value): Value =>
  value instanceof Date
    ? new Date(value.getTime())
    : Array.isArray(value)
      ? value.map(cloneValue)
      : value !== null && typeof value === "object"
        ? cloneRow(value)
        : value;
const cloneRow = (row: Row): Row =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, cloneValue(v)]));
const cloneTables = (tables: Partial<ImportTables>): ImportTables =>
  Object.fromEntries(TABLES.map((t) => [t, (tables[t] ?? []).map(cloneRow)])) as ImportTables;

const at = (row: Row) => (row.createdAt instanceof Date ? row.createdAt.getTime() : 0);
const column = (c: string) => c.replace(/\?$/, "");
const keyOf = (row: Row, columns: string[]) =>
  columns.some((c) => !c.endsWith("?") && (row[c] === null || row[c] === undefined))
    ? null
    : JSON.stringify(columns.map((c) => row[column(c)] ?? null));

function uniqueError(table: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(`Unique constraint failed on ${table}`, {
    code: "P2002",
    clientVersion: "test",
  });
}

let sequence = 0;

export function importStore(
  seed: Partial<ImportTables>,
  opts: {
    lockHeld?: boolean;
    failWhen?: (table: TableName, method: string, args: Args) => boolean;
  } = {}
) {
  // Seeded rows get the column defaults a real insert would, so `{ not: null }` and `hidden: false` read alike.
  let state = cloneTables(
    Object.fromEntries(
      TABLES.map((t) => [
        t,
        (seed[t] ?? []).map((row) => ({ createdAt: new Date(0), ...DEFAULTS[t], ...row })),
      ])
    )
  );
  const category = (row: Row) => state.categories.find((c) => c.id === row.categoryId) ?? null;
  const join: Partial<Record<TableName, (row: Row) => Row>> = {
    threads: (row) => ({ ...row, category: category(row) }),
    posts: (row) => {
      const parent = state.threads.find((t) => t.id === row.threadId);
      return { ...row, thread: parent ? { ...parent, category: category(parent) } : null };
    },
  };

  const collides = (name: TableName, row: Row, ignore?: Row) =>
    UNIQUE[name].some((columns) => {
      const key = keyOf(row, columns);
      return key !== null && state[name].some((r) => r !== ignore && keyOf(r, columns) === key);
    });

  function table(name: TableName) {
    const rows = () => state[name];
    const joined = (row: Row) => (join[name] ? join[name](row) : row);
    const hits = (where?: Row) => rows().filter((r) => matches(joined(r), where));
    const guard = (method: string, args: Args) => {
      if (opts.failWhen?.(name, method, args))
        throw new Error(`injected failure: ${name}.${method}`);
    };
    const insert = (data: Row): Row => {
      sequence += 1;
      const row: Row = {
        id: `${name}_${sequence}`,
        createdAt: new Date(),
        ...DEFAULTS[name],
        ...data,
      };
      if (collides(name, row)) throw uniqueError(name);
      rows().push(row);
      return row;
    };
    const update = (row: Row, data: Row) => {
      const next = { ...row, ...data };
      if (collides(name, next, row)) throw uniqueError(name);
      Object.assign(row, data);
    };
    return {
      findMany: jest.fn(async (args: Args = {}) => hits(args.where).map(joined).map(cloneRow)),
      findFirst: jest.fn(async (args: Args = {}) => {
        const row = [...hits(args.where)].sort((a, b) => at(a) - at(b))[0];
        return row ? cloneRow(joined(row)) : null;
      }),
      findUnique: jest.fn(async (args: Args) => {
        const row = hits(args.where)[0];
        return row ? cloneRow(joined(row)) : null;
      }),
      count: jest.fn(async (args: Args = {}) => hits(args.where).length),
      create: jest.fn(async (args: Args) => {
        guard("create", args);
        return cloneRow(insert(args.data as Row));
      }),
      createMany: jest.fn(async (args: Args) => {
        guard("createMany", args);
        let count = 0;
        for (const data of args.data as Row[]) {
          if (args.skipDuplicates && collides(name, { ...DEFAULTS[name], ...data })) continue;
          insert(data);
          count += 1;
        }
        return { count };
      }),
      update: jest.fn(async (args: Args) => {
        guard("update", args);
        const row = hits(args.where)[0];
        if (!row) throw new Error(`${name}: record to update not found`);
        update(row, args.data as Row);
        return cloneRow(row);
      }),
      updateMany: jest.fn(async (args: Args) => {
        guard("updateMany", args);
        const found = hits(args.where);
        found.forEach((row) => update(row, args.data as Row));
        return { count: found.length };
      }),
      upsert: jest.fn(async (args: Args) => {
        guard("upsert", args);
        const row = hits(args.where)[0];
        if (row) update(row, args.update ?? {});
        return cloneRow(row ?? insert(args.create ?? {}));
      }),
      deleteMany: jest.fn(async (args: Args = {}) => {
        guard("deleteMany", args);
        const gone = new Set(hits(args.where));
        state[name] = rows().filter((r) => !gone.has(r));
        if (name === "threads") {
          const ids = new Set([...gone].map((t) => t.id));
          state.posts = state.posts.filter((p) => !ids.has(p.threadId as string));
        }
        return { count: gone.size };
      }),
      aggregate: jest.fn(async (args: Args) => {
        const dates = hits(args.where).map((r) => at(r));
        return { _max: { createdAt: dates.length ? new Date(Math.max(...dates)) : null } };
      }),
    };
  }

  const client = {
    user: table("users"),
    realm: table("realms"),
    forumCategory: table("categories"),
    forumThread: table("threads"),
    forumPost: table("posts"),
    postActionLink: table("links"),
    systemConfig: table("configs"),
    uploadedAsset: table("assets"),
    $executeRaw: jest.fn(async (_sql: TemplateStringsArray, ..._values: Value[]) => 1),
    $queryRaw: jest.fn(async (_sql: TemplateStringsArray, ..._values: Value[]) => [
      { locked: !opts.lockHeld },
    ]),
  };
  const db = {
    ...client,
    $transaction: jest.fn(async <T>(fn: (tx: typeof client) => Promise<T>): Promise<T> => {
      const before = cloneTables(state);
      try {
        return await fn(client);
      } catch (error) {
        state = before;
        throw error;
      }
    }),
  };
  return { db, tables: () => state };
}
