/** In-memory stand-ins for the tables a map import touches (jobs, realms, countries, map layers, imports). */
type Row = Record<string, any>;

let counter = 0;
const newId = (prefix: string) => `${prefix}${(++counter).toString(36).padStart(8, "0")}`;

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Row[]).some((c) => matches(row, c));
    if (key === "NOT") return !matches(row, cond);
    const value = row[key];
    if (cond && typeof cond === "object" && !Array.isArray(cond) && !(cond instanceof Date)) {
      if ("in" in cond) return (cond.in as unknown[]).includes(value);
      if ("notIn" in cond) return !(cond.notIn as unknown[]).includes(value);
      if ("lt" in cond) return value !== null && value !== undefined && value < cond.lt;
      if ("gt" in cond) return value !== null && value !== undefined && value > cond.gt;
      if ("equals" in cond) return JSON.stringify(value) === JSON.stringify(cond.equals);
      return false;
    }
    return value === cond;
  });
}

function pick(row: Row, select?: Row): Row {
  if (!select) return { ...row };
  return Object.fromEntries(Object.keys(select).map((k) => [k, row[k]]));
}

function table(prefix: string, defaults: () => Row = () => ({})) {
  const rows: Row[] = [];
  const api = {
    rows,
    create: jest.fn(async ({ data, select }: Row) => {
      const row = {
        id: newId(prefix),
        createdAt: new Date(Date.now() + counter),
        ...defaults(),
        ...data,
      };
      rows.push(row);
      return pick(row, select);
    }),
    findUnique: jest.fn(async ({ where, select }: Row) => {
      const row = rows.find((r) => matches(r, where));
      return row ? pick(row, select) : null;
    }),
    findFirst: jest.fn(async ({ where, select, orderBy }: Row = {}) => {
      let list = rows.filter((r) => matches(r, where));
      if (orderBy?.createdAt) list = [...list].sort((a, b) => a.createdAt - b.createdAt);
      return list[0] ? pick(list[0], select) : null;
    }),
    findMany: jest.fn(async ({ where, select, orderBy, take }: Row = {}) => {
      let list = rows.filter((r) => matches(r, where));
      if (orderBy?.createdAt === "desc") list = [...list].sort((a, b) => b.createdAt - a.createdAt);
      return list.slice(0, take ?? list.length).map((r) => pick(r, select));
    }),
    count: jest.fn(async ({ where }: Row = {}) => rows.filter((r) => matches(r, where)).length),
    update: jest.fn(async ({ where, data, select }: Row) => {
      const row = rows.find((r) => matches(r, where));
      if (!row) throw new Error("not found");
      Object.assign(row, data);
      return pick(row, select);
    }),
    updateMany: jest.fn(async ({ where, data }: Row) => {
      const list = rows.filter((r) => matches(r, where));
      for (const row of list) Object.assign(row, data);
      return { count: list.length };
    }),
    deleteMany: jest.fn(async ({ where }: Row) => {
      const keep = rows.filter((r) => !matches(r, where));
      const count = rows.length - keep.length;
      rows.splice(0, rows.length, ...keep);
      return { count };
    }),
    upsert: jest.fn(async ({ where, create, update, select }: Row) => {
      const unique = where.realmId_layerType_featureId;
      const row = rows.find((r) => matches(r, unique ?? where));
      if (row) {
        Object.assign(row, update);
        return pick(row, select);
      }
      const created = { id: newId(prefix), createdAt: new Date(), isActive: true, ...create };
      rows.push(created);
      return pick(created, select);
    }),
  };
  return api;
}

/** Typed loosely on purpose: it stands in for PrismaClient and exposes each table's `rows` to the test. */
export function fakeDb(): any {
  const db: Row = {
    realm: table("r"),
    country: table("c"),
    realmPage: table("p"),
    mapLayer: table("m", () => ({
      isActive: true,
      countryId: null,
      displayName: null,
      neighbors: null,
    })),
    mapImportJob: table("j", () => ({
      status: "queued",
      progress: 0,
      stage: null,
      result: null,
      error: null,
      parentJobId: null,
      startedAt: null,
      heartbeatAt: null,
      finishedAt: null,
    })),
    mapImport: table("i", () => ({ rolledBackAt: null, rolledBackBy: null })),
    sharedVertex: table("v"),
    adminAuditLog: table("a"),
    realmSourceSync: table("s"),
    mapLabel: table("l"),
    user: table("u"),
    thinkpagesAccount: table("t"),
    $queryRawUnsafe: jest.fn(async () => []),
    $executeRawUnsafe: jest.fn(async () => 0),
  };
  db.$transaction = jest.fn(async (fn: (tx: Row) => unknown) => fn(db));
  return db;
}

export const admin = { id: "u_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } };
export const founder = {
  id: "u_founder",
  clerkUserId: "founder_1",
  role: { name: "user", level: 100 },
};
export const stranger = { id: "u_x", clerkUserId: "someone", role: { name: "user", level: 100 } };
