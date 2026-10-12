/**
 * The map import fakes plus what Atlas reads: groupBy, richer filters (gte, not, dates, OR), ordering by createdAt
 * then id, the cron table, the grouped raw queries of the overview, and a log of every database call so a test can
 * count them. The shared map-import-fakes.ts is left as it is.
 */
import { fakeDb } from "./map-import-fakes";

type Row = Record<string, any>;

const time = (value: unknown) => (value instanceof Date ? value.getTime() : value);
const ms = (value: unknown): number => Number(time(value));

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Row[]).some((c) => matches(row, c));
    const value = row[key];
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      return Object.entries(cond as Row).every(([op, arg]) => {
        if (op === "in") return (arg as unknown[]).includes(value);
        if (op === "notIn") return !(arg as unknown[]).includes(value);
        if (op === "not") return arg === null ? value != null : value !== arg;
        if (op === "lt")
          return value != null && (time(value) as number | string) < (time(arg) as number | string);
        if (op === "gte")
          return (
            value != null && (time(value) as number | string) >= (time(arg) as number | string)
          );
        return false;
      });
    }
    // A column a test left out is null, as a row from the database would have it
    return (time(value) ?? null) === (time(cond) ?? null);
  });
}

function sorted(rows: Row[], orderBy: Row | Row[] | undefined) {
  const keys = ([] as Row[]).concat(orderBy ?? []).flatMap((o) => Object.entries(o));
  return [...rows].sort((a, b) => {
    for (const [key, dir] of keys) {
      const x = time(a[key]) as number | string;
      const y = time(b[key]) as number | string;
      if (x !== y) return (x < y ? -1 : 1) * (dir === "desc" ? -1 : 1);
    }
    return 0;
  });
}

function groupBy(rows: Row[], { by, where, _count, _max }: Row) {
  const groups = new Map<string, Row[]>();
  for (const row of rows.filter((r) => matches(r, where))) {
    const key = JSON.stringify((by as string[]).map((k) => row[k]));
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].map((list) => ({
    ...Object.fromEntries((by as string[]).map((k) => [k, list[0]![k]])),
    ...(_count && { _count: { _all: list.length } }),
    ...(_max && {
      _max: Object.fromEntries(
        Object.keys(_max).map((k) => [k, list.map((r) => r[k]).sort((a, b) => ms(b) - ms(a))[0]])
      ),
    }),
  }));
}

export function atlasFakeDb(): any {
  const db = fakeDb();
  db.country = { rows: [] as Row[] };
  db.cronRun = { rows: [] as Row[] };
  const tables = Object.entries(db).filter(([, v]) => Array.isArray((v as Row)?.rows));
  for (const [, table] of tables as Array<[string, Row]>) {
    table.groupBy = jest.fn(async (args: Row) => groupBy(table.rows, args));
    table.findMany = jest.fn(async ({ where, orderBy, take, select }: Row = {}) =>
      sorted(
        table.rows.filter((r: Row) => matches(r, where)),
        orderBy
      )
        .slice(0, take ?? table.rows.length)
        .map((r) =>
          select ? Object.fromEntries(Object.keys(select).map((k) => [k, r[k]])) : { ...r }
        )
    );
    if (table.findFirst) {
      table.findFirst = jest.fn(async ({ where, orderBy, select }: Row = {}) => {
        const [row] = sorted(
          table.rows.filter((r: Row) => matches(r, where)),
          orderBy
        );
        if (!row) return null;
        return select
          ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]]))
          : { ...row };
      });
    }
  }
  const raw = db.$queryRaw as (sql: TemplateStringsArray, ...args: unknown[]) => Promise<Row[]>;
  const rowsOf = (name: string) => db[name].rows as Row[];
  db.$queryRaw = jest.fn(async (sql: TemplateStringsArray, ...args: unknown[]) => {
    const text = sql.join("?");
    const ids = args[0] as string[];
    if (text.includes('FROM "Country"')) {
      return ids.flatMap((realmId) => {
        const list = rowsOf("country").filter((c) => c.realmId === realmId);
        if (list.length === 0) return [];
        const unowned = list.filter((c) => !c.ownerUserId);
        return [
          {
            realmId,
            total: list.length,
            owned: list.length - unowned.length,
            open: unowned.filter((c) => c.claimable !== false).length,
            reserved: unowned.filter((c) => c.claimable === false && c.worldgen).length,
            invalid: list.filter((c) => c.geometry && !c.geomPostgis).length,
          },
        ];
      });
    }
    if (text.includes('DISTINCT ON ("realmId")')) {
      return ids.flatMap((realmId) => {
        const [job] = sorted(
          rowsOf("mapImportJob").filter((j) => j.realmId === realmId),
          { createdAt: "desc" }
        );
        return job ? [{ ...job, finishedAt: job.finishedAt ?? null }] : [];
      });
    }
    if (text.includes("map_imports i")) {
      return ids.flatMap((realmId) => {
        const [job] = sorted(
          rowsOf("mapImportJob").filter(
            (j) =>
              j.realmId === realmId && j.kind === "world" && !j.dryRun && j.status === "succeeded"
          ),
          { createdAt: "desc" }
        );
        if (!job) return [];
        const record = rowsOf("mapImport").find((i) => i.jobId === job.id);
        return [
          {
            realmId,
            status: job.result?.relief?.status ?? null,
            rolledBack: Boolean(record?.rolledBackAt),
          },
        ];
      });
    }
    return raw(sql, ...args);
  });

  // Every call, as "table.method", for tests that count queries
  const calls: string[] = [];
  for (const [name, table] of tables as Array<[string, Row]>) {
    for (const method of Object.keys(table)) {
      const original = table[method];
      if (typeof original !== "function") continue;
      table[method] = (...args: unknown[]) => {
        calls.push(`${name}.${method}`);
        return original(...args);
      };
    }
  }
  const rawWithLog = db.$queryRaw;
  db.$queryRaw = (...args: unknown[]) => {
    calls.push("$queryRaw");
    return rawWithLog(...args);
  };
  db.calls = calls;
  return db;
}
