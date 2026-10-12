/** In-memory stand-ins for the tables a map import touches (jobs, realms, countries, map layers, imports). */
type Row = Record<string, any>;

/** The guarded client's cap on an unbounded findMany (UNBOUNDED_FIND_MANY_CAP in src/server/db.ts). */
const GUARD_CAP = 1000;

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
    // Like the guarded client (src/server/db.ts): a findMany with no `take` answers at most GUARD_CAP rows
    findMany: jest.fn(async ({ where, select, orderBy, take }: Row = {}) => {
      let list = rows.filter((r) => matches(r, where));
      if (orderBy?.createdAt === "desc") list = [...list].sort((a, b) => b.createdAt - a.createdAt);
      return list.slice(0, take ?? GUARD_CAP).map((r) => pick(r, select));
    }),
    createMany: jest.fn(async ({ data }: Row) => {
      for (const item of data as Row[])
        rows.push({ id: newId(prefix), createdAt: new Date(), ...item });
      return { count: (data as Row[]).length };
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
      const created = {
        id: newId(prefix),
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        ...create,
      };
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
    realmClaim: table("q", () => ({ status: "pending", countryId: null })),
    blurbResponse: table("b"),
    mapLayer: table("m", () => ({
      isActive: true,
      countryId: null,
      displayName: null,
      neighbors: null,
      updatedAt: new Date(),
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
    // invalidateRealmMap's version bump: UPDATE "realms" SET "mapVersion" = "mapVersion" + 1 WHERE id = $1 RETURNING;
    // a world import's row locks (SELECT ... FOR UPDATE) change nothing here, the test reads them from the calls
    $queryRaw: jest.fn(async (sql: TemplateStringsArray, realmId: string) => {
      if (sql.join("?").includes("FOR UPDATE")) return [];
      const realm = db.realm.rows.find((r: Row) => r.id === realmId);
      if (!realm) return [];
      realm.mapVersion = (realm.mapVersion ?? 0) + 1;
      return [{ mapVersion: realm.mapVersion }];
    }),
  };
  // A country's claims go with it (RealmClaim.country cascades) and its map features lose the link (SetNull)
  const deleteCountries = db.country.deleteMany.getMockImplementation()!;
  db.country.deleteMany = jest.fn(async (args: Row) => {
    const gone = db.country.rows.filter((r: Row) => matches(r, args.where)).map((r: Row) => r.id);
    const out = await deleteCountries(args);
    db.realmClaim.rows.splice(
      0,
      db.realmClaim.rows.length,
      ...db.realmClaim.rows.filter((q: Row) => !gone.includes(q.countryId))
    );
    for (const feature of db.mapLayer.rows)
      if (gone.includes(feature.countryId)) feature.countryId = null;
    return out;
  });
  // A transaction that throws changes nothing: every table goes back as it was when it began
  db.$transaction = jest.fn(async (fn: (tx: Row) => unknown) => {
    const tables: Row[] = Object.values(db).filter((v: Row) => Array.isArray(v?.rows));
    const before = tables.map((t) => structuredClone(t.rows));
    try {
      return await fn(db);
    } catch (error) {
      tables.forEach((t, i) => t.rows.splice(0, t.rows.length, ...before[i]!));
      throw error;
    }
  });
  return db;
}

export const admin = { id: "u_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } };
export const founder = {
  id: "u_founder",
  clerkUserId: "founder_1",
  role: { name: "user", level: 100 },
};
export const stranger = { id: "u_x", clerkUserId: "someone", role: { name: "user", level: 100 } };
