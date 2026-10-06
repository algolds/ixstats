/**
 * A small in-memory stand-in for the Prisma client, enough for the Exchange and vault
 * ledgers: where filters (equality, gte/gt/lte/lt, in, not, equals+insensitive,
 * startsWith, OR/AND), increment/decrement updates, unique indexes that raise P2002,
 * interactive transactions that roll back on throw, and `SELECT ... FOR UPDATE` row
 * locks held until the transaction ends. Every call yields to the event loop first, so
 * concurrent operations really interleave: a check-then-act bug shows up here.
 */
import { Prisma } from "@prisma/client";

type Row = Record<string, any>;
type Undo = () => void;

const UNIQUE: Record<string, string[][]> = {
  user: [["id"], ["clerkUserId"]],
  exchangeWallet: [["userId"]],
  exchangeTransaction: [["idempotencyKey"]],
  conversionLog: [["idempotencyKey"]],
  company: [["name"]],
  contract: [["idempotencyKey"]],
  contractBid: [["contractId", "companyId"]],
  shareholding: [["companyId", "ownerUserId"]],
  myVault: [["userId"]],
  vaultTransaction: [["idempotencyKey"]],
};

const DEFAULTS: Record<string, () => Row> = {
  exchangeWallet: () => ({ sovereigns: 0, lifetimeEarned: 0, lifetimeSpent: 0 }),
  company: () => ({
    capital: 0,
    standing: 0,
    fairValue: 0,
    sharesIssued: 0,
    sharesOutstanding: 0,
    contractsWonValue: 0,
    status: "ACTIVE",
  }),
  contract: () => ({
    status: "OPEN",
    winnerCompanyId: null,
    escrow: 0,
    awardedBidId: null,
    issuerCompanyId: null,
    issuerUserId: null,
    disputeReason: null,
    resolutionNote: null,
    idempotencyKey: null,
  }),
  contractBid: () => ({ outcome: null, standingDelta: 0 }),
  myVault: () => ({
    credits: 0,
    lifetimeEarned: 0,
    lifetimeSpent: 0,
    todayEarned: 0,
    vaultXp: 0,
    vaultLevel: 1,
    loginStreak: 0,
    lastDailyReset: new Date(),
  }),
};

/** Relations `include` can follow: model → field → [target model, foreign key on this row]. */
const RELATIONS: Record<string, Record<string, [string, string]>> = {
  contractBid: { company: ["company", "companyId"], contract: ["contract", "contractId"] },
  contract: { issuerCompany: ["company", "issuerCompanyId"] },
};

function p2002(model: string, fields: string[]) {
  return new Prisma.PrismaClientKnownRequestError(`Unique constraint failed on ${fields}`, {
    code: "P2002",
    clientVersion: "test",
    meta: { modelName: model, target: fields },
  });
}

function isPlainObject(v: unknown): v is Row {
  return typeof v === "object" && v !== null && !(v instanceof Date) && !Array.isArray(v);
}

function matchValue(actual: any, cond: any): boolean {
  if (!isPlainObject(cond)) return actual === cond;
  const insensitive = cond.mode === "insensitive";
  const norm = (v: any) => (insensitive && typeof v === "string" ? v.toLowerCase() : v);
  for (const [op, v] of Object.entries(cond)) {
    if (op === "mode") continue;
    if (op === "equals" && norm(actual) !== norm(v)) return false;
    if (op === "gte" && !(actual >= v)) return false;
    if (op === "gt" && !(actual > v)) return false;
    if (op === "lte" && !(actual <= v)) return false;
    if (op === "lt" && !(actual < v)) return false;
    if (op === "in" && !(v as any[]).includes(actual)) return false;
    if (op === "not" && actual === v) return false;
    if (op === "startsWith" && !(typeof actual === "string" && actual.startsWith(v as string))) {
      return false;
    }
  }
  return true;
}

function flattenWhere(where: Row = {}): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(where)) {
    // Compound unique selector, e.g. { contractId_companyId: { contractId, companyId } }
    if (k.includes("_") && isPlainObject(v) && !Object.keys(v).some((x) => x in OPS)) {
      Object.assign(out, v);
    } else out[k] = v;
  }
  return out;
}

const OPS: Record<string, true> = {
  equals: true,
  gte: true,
  gt: true,
  lte: true,
  lt: true,
  in: true,
  not: true,
  mode: true,
  startsWith: true,
};

function matches(row: Row, where: Row = {}): boolean {
  for (const [k, v] of Object.entries(flattenWhere(where))) {
    if (k === "OR") {
      if (!(v as Row[]).some((w) => matches(row, w))) return false;
    } else if (k === "AND") {
      if (!(v as Row[]).every((w) => matches(row, w))) return false;
    } else if (!matchValue(row[k], v)) return false;
  }
  return true;
}

function applyData(row: Row, data: Row) {
  for (const [k, v] of Object.entries(data)) {
    if (isPlainObject(v) && ("increment" in v || "decrement" in v)) {
      row[k] = (row[k] ?? 0) + (v.increment ?? 0) - (v.decrement ?? 0);
    } else if (v !== undefined) row[k] = v;
  }
}

let idSeq = 0;
/** Yield so other pending operations run before this one continues (works in jsdom too). */
const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

export interface FakeDb {
  tables: Record<string, Row[]>;
  client: any;
}

export function createFakeExchangeDb(seed: Record<string, Row[]> = {}): FakeDb {
  const tables: Record<string, Row[]> = {};
  for (const [m, rows] of Object.entries(seed)) tables[m] = rows.map((r) => ({ ...r }));
  const table = (m: string) => (tables[m] ??= []);
  const locks = new Map<string, Promise<void>>();

  function checkUnique(model: string, row: Row, ignore?: Row) {
    for (const fields of UNIQUE[model] ?? []) {
      if (fields.some((f) => row[f] == null)) continue;
      const clash = table(model).some(
        (r) => r !== ignore && r !== row && fields.every((f) => r[f] === row[f])
      );
      if (clash) throw p2002(model, fields);
    }
  }

  function withIncludes(model: string, row: Row, include?: Row): Row {
    if (!include) return { ...row };
    const out: Row = { ...row };
    for (const [field, spec] of Object.entries(include)) {
      const rel = RELATIONS[model]?.[field];
      if (rel) {
        const [target, fk] = rel;
        out[field] = table(target).find((r) => r.id === row[fk]) ?? null;
      } else if (spec) {
        out[field] = [];
      }
    }
    return out;
  }

  function delegate(model: string, journal: Undo[] | null) {
    const record = (undo: Undo) => journal?.push(undo);
    const insert = (data: Row) => {
      const row: Row = {
        id: data.id ?? `${model}_${++idSeq}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...(DEFAULTS[model]?.() ?? {}),
        ...data,
      };
      checkUnique(model, row);
      table(model).push(row);
      record(() => {
        const i = table(model).indexOf(row);
        if (i >= 0) table(model).splice(i, 1);
      });
      return row;
    };
    const mutate = (row: Row, data: Row) => {
      const before = { ...row };
      const next = { ...row };
      applyData(next, data);
      checkUnique(model, next, row);
      Object.assign(row, next);
      // Undo only this write: reverse deltas, restore plain sets. A snapshot restore would
      // also wipe other transactions' committed changes to the row.
      record(() => {
        for (const [k, v] of Object.entries(data)) {
          if (isPlainObject(v) && ("increment" in v || "decrement" in v)) {
            row[k] -= (v.increment ?? 0) - (v.decrement ?? 0);
          } else if (v !== undefined) row[k] = before[k];
        }
      });
      return row;
    };

    return {
      async findUnique(args: Row) {
        await tick();
        const row = table(model).find((r) => matches(r, args.where));
        return row ? withIncludes(model, row, args.include) : null;
      },
      async findUniqueOrThrow(args: Row) {
        await tick();
        const row = table(model).find((r) => matches(r, args.where));
        if (!row) throw new Error(`${model} not found`);
        return withIncludes(model, row, args.include);
      },
      async findFirst(args: Row = {}) {
        await tick();
        const row = table(model).find((r) => matches(r, args.where));
        return row ? withIncludes(model, row, args.include) : null;
      },
      async findMany(args: Row = {}) {
        await tick();
        const rows = table(model).filter((r) => matches(r, args.where));
        return rows
          .slice(0, args.take ?? rows.length)
          .map((r) => withIncludes(model, r, args.include));
      },
      async count(args: Row = {}) {
        await tick();
        return table(model).filter((r) => matches(r, args.where)).length;
      },
      async create(args: Row) {
        await tick();
        return { ...insert(args.data) };
      },
      async createMany(args: Row) {
        await tick();
        let count = 0;
        for (const data of args.data as Row[]) {
          try {
            insert(data);
            count++;
          } catch (e) {
            if (!args.skipDuplicates) throw e;
          }
        }
        return { count };
      },
      async update(args: Row) {
        await tick();
        const row = table(model).find((r) => matches(r, args.where));
        if (!row) throw new Error(`${model} to update not found`);
        return { ...mutate(row, args.data) };
      },
      async updateMany(args: Row) {
        await tick();
        const rows = table(model).filter((r) => matches(r, args.where));
        for (const r of rows) mutate(r, args.data);
        return { count: rows.length };
      },
      async upsert(args: Row) {
        await tick();
        const row = table(model).find((r) => matches(r, args.where));
        return { ...(row ? mutate(row, args.update) : insert(args.create)) };
      },
      async delete(args: Row) {
        await tick();
        const row = table(model).find((r) => matches(r, args.where));
        if (!row) throw new Error(`${model} to delete not found`);
        const i = table(model).indexOf(row);
        table(model).splice(i, 1);
        record(() => table(model).splice(i, 0, row));
        return row;
      },
      async deleteMany(args: Row = {}) {
        await tick();
        const rows = table(model).filter((r) => matches(r, args.where));
        for (const r of rows) {
          const i = table(model).indexOf(r);
          table(model).splice(i, 1);
          record(() => table(model).push(r));
        }
        return { count: rows.length };
      },
      async aggregate(args: Row) {
        await tick();
        const rows = table(model).filter((r) => matches(r, args.where));
        const _sum: Row = {};
        for (const f of Object.keys(args._sum ?? {})) {
          _sum[f] = rows.length ? rows.reduce((s, r) => s + (r[f] ?? 0), 0) : null;
        }
        return { _sum };
      },
      async groupBy(args: Row) {
        await tick();
        const rows = table(model).filter((r) => matches(r, args.where));
        const groups = new Map<string, Row[]>();
        for (const r of rows) {
          const key = JSON.stringify((args.by as string[]).map((b) => r[b]));
          groups.set(key, [...(groups.get(key) ?? []), r]);
        }
        return [...groups.values()].map((g) => {
          const out: Row = {};
          for (const b of args.by as string[]) out[b] = g[0]![b];
          out._sum = {};
          for (const f of Object.keys(args._sum ?? {})) {
            out._sum[f] = g.reduce((s, r) => s + (r[f] ?? 0), 0);
          }
          return out;
        });
      },
    };
  }

  function makeClient(journal: Undo[] | null, held: Array<() => void> | null): any {
    const heldKeys = new Set<string>();
    return new Proxy(
      {},
      {
        // An interactive transaction client has no $transaction, like Prisma's.
        has: (_t, prop) => prop !== "$transaction" || held === null,
        get(_t, prop: string) {
          if (prop === "then") return undefined;
          if (prop === "$transaction") {
            if (held !== null) return undefined;
            return async (arg: any) => {
              if (Array.isArray(arg)) return Promise.all(arg);
              const txJournal: Undo[] = [];
              const txHeld: Array<() => void> = [];
              try {
                return await arg(makeClient(txJournal, txHeld));
              } catch (e) {
                for (const undo of txJournal.reverse()) undo();
                throw e;
              } finally {
                for (const release of txHeld) release();
              }
            };
          }
          if (prop === "$queryRaw") {
            return async (strings: TemplateStringsArray, ...values: unknown[]) => {
              await tick();
              if (held && strings.join("?").includes("FOR UPDATE")) {
                const key = String(values[0]);
                // Row locks are re-entrant within one transaction, as in Postgres.
                if (heldKeys.has(key)) return [];
                heldKeys.add(key);
                const prev = locks.get(key) ?? Promise.resolve();
                let release!: () => void;
                const mine = new Promise<void>((r) => (release = r));
                locks.set(
                  key,
                  prev.then(() => mine)
                );
                await prev;
                held.push(release);
              }
              return [];
            };
          }
          return delegate(prop, journal);
        },
      }
    );
  }

  return { tables, client: makeClient(null, null) };
}
