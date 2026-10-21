/**
 * An in-memory Prisma client built from the schema itself (`Prisma.dmmf`): every model delegate with its relations,
 * defaults, unique keys, referential actions and enum order, so a scenario drives the real modules end to end with no
 * per-call stubs. It is a stateful fake, not a mock: a compare-and-swap `updateMany` that loses really loses, a unique
 * key really refuses (P2002), a missing row really throws (P2025), and a `$transaction` that throws puts every table
 * back as it was. Transactions run one at a time (each sees the last one's commit), which is how a race reads in a
 * serialisable world; the real interleavings belong to the Postgres variants (`scenario-db.ts`).
 *
 * Raw SQL has no engine here: the advisory locks, the `my_vault` row locks and the dust statement have handlers, and
 * `onRaw` adds one for a scenario. Every lock and write lands in `log`, in order, so a test can read the lock order.
 *
 * Unsupported query shapes throw ("memory-prisma: ...") rather than answer wrongly.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";

type Value = unknown;
type Row = Record<string, Value>;
type Args = Record<string, any>;

interface Field {
  name: string;
  kind: "scalar" | "object" | "enum" | "unsupported";
  type: string;
  isList: boolean;
  isRequired: boolean;
  isId: boolean;
  isUnique: boolean;
  isUpdatedAt: boolean;
  hasDefaultValue: boolean;
  default?: unknown;
  relationName?: string;
  relationFromFields?: readonly string[];
  relationToFields?: readonly string[];
  relationOnDelete?: string;
}

interface Relation {
  field: string;
  target: string;
  isList: boolean;
  /** This model's columns, matched to `targetFields` of the target. */
  localFields: string[];
  targetFields: string[];
  /** This side holds the foreign key. */
  owning: boolean;
  required: boolean;
  onDelete: string;
}

interface Model {
  name: string;
  delegate: string;
  scalars: Field[];
  fields: Map<string, Field>;
  relations: Map<string, Relation>;
  /** Every unique key: @id, @unique, @@id and @@unique, each as its fields. */
  uniques: string[][];
}

const ENUMS = new Map(
  Prisma.dmmf.datamodel.enums.map((e) => [e.name, e.values.map((v) => v.name)] as const)
);

function buildModels(): Map<string, Model> {
  const models = new Map<string, Model>();
  for (const m of Prisma.dmmf.datamodel.models) {
    const fields = m.fields as unknown as Field[];
    const uniques: string[][] = [];
    for (const f of fields) if (f.isId || f.isUnique) uniques.push([f.name]);
    if (m.primaryKey) uniques.push([...m.primaryKey.fields]);
    for (const u of m.uniqueFields) uniques.push([...u]);
    models.set(m.name, {
      name: m.name,
      delegate: m.name.charAt(0).toLowerCase() + m.name.slice(1),
      scalars: fields.filter((f) => f.kind === "scalar" || f.kind === "enum"),
      fields: new Map(fields.map((f) => [f.name, f])),
      relations: new Map(),
      uniques,
    });
  }
  for (const model of models.values()) {
    for (const f of model.fields.values()) {
      if (f.kind !== "object") continue;
      const target = models.get(f.type)!;
      if (f.relationFromFields?.length) {
        const required = f.relationFromFields.every((n) => model.fields.get(n)?.isRequired);
        model.relations.set(f.name, {
          field: f.name,
          target: f.type,
          isList: false,
          localFields: [...f.relationFromFields],
          targetFields: [...(f.relationToFields ?? [])],
          owning: true,
          required,
          onDelete: f.relationOnDelete ?? (required ? "Restrict" : "SetNull"),
        });
        continue;
      }
      const back = [...target.fields.values()].find(
        (o) =>
          o.kind === "object" &&
          o.relationName === f.relationName &&
          o.relationFromFields?.length &&
          (o.type !== model.name || o.name !== f.name)
      );
      if (!back) continue;
      model.relations.set(f.name, {
        field: f.name,
        target: f.type,
        isList: f.isList,
        localFields: [...(back.relationToFields ?? [])],
        targetFields: [...(back.relationFromFields ?? [])],
        owning: false,
        required: false,
        onDelete: "",
      });
    }
  }
  return models;
}

const MODELS = buildModels();
const BY_DELEGATE = new Map([...MODELS.values()].map((m) => [m.delegate, m]));

const known = (code: string, message: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: Prisma.prismaVersion.client,
    meta,
  });

const unsupported = (what: string): never => {
  throw new Error(`memory-prisma: unsupported ${what}`);
};

// --- values -------------------------------------------------------------------------------------------------------

const isDate = (v: Value): v is Date => v instanceof Date;
const isPlainObject = (v: Value): v is Args =>
  typeof v === "object" && v !== null && !Array.isArray(v) && !isDate(v);

const same = (a: Value, b: Value): boolean => {
  if (isDate(a) || isDate(b)) {
    return isDate(a) && isDate(b) ? a.getTime() === b.getTime() : toTime(a) === toTime(b);
  }
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return a === b;
};

const toTime = (v: Value): Value => (isDate(v) ? v.getTime() : typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? Date.parse(v) : v);

/** Postgres order for one column: enums by declaration, strings by code unit (C collation), dates by time. */
function compareValues(field: Field | undefined, a: Value, b: Value): number {
  if (field?.kind === "enum") {
    const order = ENUMS.get(field.type) ?? [];
    return order.indexOf(a as string) - order.indexOf(b as string);
  }
  const x = toTime(a);
  const y = toTime(b);
  if (typeof x === "number" && typeof y === "number") return x - y;
  if (typeof x === "boolean" && typeof y === "boolean") return Number(x) - Number(y);
  const s = String(x);
  const t = String(y);
  return s < t ? -1 : s > t ? 1 : 0;
}

/** A deep copy made in this realm (structuredClone's Dates fail `instanceof Date` inside a Jest sandbox). */
function clone<T>(v: T): T {
  if (v instanceof Date) return new Date(v.getTime()) as T;
  if (Array.isArray(v)) return v.map(clone) as T;
  if (v instanceof Map) return new Map([...v].map(([k, x]) => [k, clone(x)])) as T;
  if (typeof v === "object" && v !== null) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) as T;
  }
  return v;
}

/** A Prisma.sql value (its class is not exported at runtime). */
const isSql = (v: Value): v is { strings: string[]; values: Value[] } =>
  typeof v === "object" && v !== null && Array.isArray((v as Args).strings) && Array.isArray((v as Args).values);

// --- the store ----------------------------------------------------------------------------------------------------

export type LogEntry =
  | { kind: "advisory"; ns: number; key: string }
  | { kind: "vaults"; userIds: string[] }
  | { kind: "write"; model: string; op: string; where?: Args };

export type RawHandler = (values: Value[], text: string, store: MemoryStore) => unknown;

export class MemoryStore {
  tables = new Map<string, Row[]>();
  log: LogEntry[] = [];
  private counter = 0;
  private autoinc = new Map<string, number>();
  private raws: Array<{ match: RegExp; run: RawHandler }> = [];

  constructor() {
    this.raws.push(
      {
        match: /pg_advisory_xact_lock\(\s*\?::int,\s*hashtext\(\?\)\)/,
        run: ([ns, key]) => {
          this.log.push({ kind: "advisory", ns: Number(ns), key: String(key) });
          return 1;
        },
      },
      {
        match: /FROM "my_vault" WHERE "userId" IN \(\?(?:,\s*\?)*\) ORDER BY "userId" FOR UPDATE/,
        run: (ids) => {
          const userIds = ids.map(String);
          this.log.push({ kind: "vaults", userIds });
          return this.rows("MyVault")
            .filter((v) => userIds.includes(v.userId as string))
            .map((v) => ({ id: v.id }));
        },
      },
      {
        match: /FROM "my_vault" WHERE id = \? FOR UPDATE/,
        run: ([id]) => {
          const vault = this.rows("MyVault").find((v) => v.id === id);
          this.log.push({ kind: "vaults", userIds: vault ? [vault.userId as string] : [] });
          return vault ? [{ id }] : [];
        },
      },
      {
        // creditDustTx: create the balance, or add only while the stored balance is at most the limit
        match: /INSERT INTO card_dust_balances/,
        run: ([userId, realmId, total, limit]) => {
          const rows = this.rows("CardDustBalance");
          const held = rows.find((r) => r.userId === userId && r.realmId === realmId);
          this.log.push({ kind: "write", model: "CardDustBalance", op: "upsertRaw" });
          if (!held) {
            const row = this.newRow(MODELS.get("CardDustBalance")!, {
              userId,
              realmId,
              balance: Number(total),
            });
            rows.push(row);
            return [{ balance: row.balance }];
          }
          if ((held.balance as number) > Number(limit)) return [];
          held.balance = (held.balance as number) + Number(total);
          held.updatedAt = new Date();
          return [{ balance: held.balance }];
        },
      }
    );
  }

  rows(model: string): Row[] {
    let rows = this.tables.get(model);
    if (!rows) this.tables.set(model, (rows = []));
    return rows;
  }

  /** Adds a raw SQL handler, matched against the statement's text with each value as `?`. */
  onRaw(match: RegExp, run: RawHandler): void {
    this.raws.unshift({ match, run });
  }

  raw(args: unknown[]): unknown {
    const [first, ...rest] = args as [Value, ...Value[]];
    let strings: readonly string[];
    let values: Value[];
    if (isSql(first)) {
      strings = first.strings;
      values = first.values;
    } else if (Array.isArray(first) && "raw" in (first as object)) {
      // A tagged template: nested Prisma.Sql values are flattened as Prisma does
      const sql = Prisma.sql(first as unknown as TemplateStringsArray, ...(rest as never[]));
      strings = sql.strings;
      values = sql.values;
    } else if (typeof first === "string") {
      strings = first.split(/\$\d+/);
      values = rest;
    } else {
      return unsupported("raw query argument");
    }
    const text = strings.join("?").replace(/\s+/g, " ");
    const handler = this.raws.find((h) => h.match.test(text));
    if (!handler) return unsupported(`raw SQL: ${text.slice(0, 160)}`);
    return handler.run(values, text, this);
  }

  snapshot(): () => void {
    const tables = clone(this.tables);
    const counter = this.counter;
    const autoinc = new Map(this.autoinc);
    return () => {
      this.tables = tables;
      this.counter = counter;
      this.autoinc = autoinc;
    };
  }

  nextId(): string {
    this.counter += 1;
    return `cmem${this.counter.toString(36).padStart(21, "0")}`;
  }

  defaultFor(model: Model, f: Field): Value {
    const d = f.default as { name?: string } | Value;
    if (isPlainObject(d) && typeof d.name === "string") {
      switch (d.name) {
        case "cuid":
          return this.nextId();
        case "uuid":
          return randomUUID();
        case "now":
          return new Date();
        case "autoincrement": {
          const key = `${model.name}.${f.name}`;
          const next = (this.autoinc.get(key) ?? 0) + 1;
          this.autoinc.set(key, next);
          return next;
        }
        case "dbgenerated":
          return null;
        default:
          return unsupported(`default ${d.name}() on ${model.name}.${f.name}`);
      }
    }
    if (Array.isArray(d)) return clone(d);
    return d;
  }

  /** A full row from create data: defaults filled, required columns checked, unique keys and owning relations held. */
  newRow(model: Model, data: Row): Row {
    const row: Row = {};
    for (const f of model.scalars) {
      let v = data[f.name];
      if (v === Prisma.DbNull || v === Prisma.JsonNull) v = null;
      if (isPlainObject(v) && "set" in v && Object.keys(v).length === 1) v = v.set;
      if (v === undefined) {
        if (f.hasDefaultValue) v = this.defaultFor(model, f);
        else if (f.isUpdatedAt) v = new Date();
        else if (f.isList) v = [];
        else if (f.isRequired) {
          throw new Error(`memory-prisma: ${model.name}.create needs ${f.name}`);
        } else v = null;
      }
      if (f.type === "DateTime" && typeof v === "string") v = new Date(v);
      row[f.name] = clone(v);
    }
    for (const key of Object.keys(data)) {
      if (!model.fields.has(key)) unsupported(`${model.name}.${key} in create data`);
    }
    return row;
  }

  assertUnique(model: Model, row: Row, ignore?: Row): void {
    for (const key of model.uniques) {
      if (key.some((k) => row[k] === null || row[k] === undefined)) continue;
      const clash = this.rows(model.name).find(
        (other) => other !== ignore && key.every((k) => same(other[k], row[k]))
      );
      if (clash) {
        throw known("P2002", `Unique constraint failed on the fields: (${key.join(",")})`, {
          target: key,
          modelName: model.name,
        });
      }
    }
  }

  assertForeignKeys(model: Model, row: Row): void {
    for (const rel of model.relations.values()) {
      if (!rel.owning) continue;
      const values = rel.localFields.map((k) => row[k]);
      if (values.some((v) => v === null || v === undefined)) continue;
      const found = this.rows(rel.target).some((t) =>
        rel.targetFields.every((k, i) => same(t[k], values[i]))
      );
      if (!found) {
        throw known(
          "P2003",
          `Foreign key constraint violated: ${model.name}.${rel.localFields.join(",")}`,
          { field_name: rel.localFields.join(",") }
        );
      }
    }
  }

  /** Deletes rows, applying every referential action that points at them. */
  removeRows(model: Model, doomed: Row[]): void {
    if (doomed.length === 0) return;
    for (const other of MODELS.values()) {
      for (const rel of other.relations.values()) {
        if (!rel.owning || rel.target !== model.name) continue;
        const children = this.rows(other.name).filter((c) =>
          doomed.some((d) => rel.targetFields.every((k, i) => same(d[k], c[rel.localFields[i]!])))
        );
        if (children.length === 0) continue;
        if (rel.onDelete === "Cascade") this.removeRows(other, children);
        else if (rel.onDelete === "SetNull") {
          for (const c of children) for (const k of rel.localFields) c[k] = null;
        } else {
          throw known("P2003", `Foreign key constraint violated: ${other.name}.${rel.field}`, {
            field_name: rel.localFields.join(","),
          });
        }
      }
    }
    const left = this.rows(model.name).filter((r) => !doomed.includes(r));
    this.tables.set(model.name, left);
  }
}

// --- where --------------------------------------------------------------------------------------------------------

/** Three-valued SQL truth: null is unknown, which a WHERE drops and NOT keeps unknown. */
type Truth = boolean | null;
const and3 = (xs: Truth[]): Truth => (xs.includes(false) ? false : xs.includes(null) ? null : true);
const or3 = (xs: Truth[]): Truth => (xs.includes(true) ? true : xs.includes(null) ? null : false);
const not3 = (x: Truth): Truth => (x === null ? null : !x);

function related(store: MemoryStore, model: Model, rel: Relation, row: Row): Row[] {
  const values = rel.localFields.map((k) => row[k]);
  if (values.some((v) => v === null || v === undefined)) return [];
  return store
    .rows(rel.target)
    .filter((t) => rel.targetFields.every((k, i) => same(t[k], values[i])));
}

function jsonAt(value: Value, path: readonly (string | number)[]): Value {
  let at: Value = value;
  for (const step of path) {
    if (at === null || at === undefined || typeof at !== "object") return undefined;
    at = (at as Record<string | number, Value>)[step];
  }
  return at;
}

function stringOp(op: string, value: string, arg: string, insensitive: boolean): boolean {
  const v = insensitive ? value.toLowerCase() : value;
  const a = insensitive ? arg.toLowerCase() : arg;
  if (op === "contains") return v.includes(a);
  if (op === "startsWith") return v.startsWith(a);
  return v.endsWith(a);
}

function scalarFilter(field: Field, value: Value, filter: Value): Truth {
  if (!isPlainObject(filter)) {
    if (filter === null) return value === null || value === undefined;
    if (value === null || value === undefined) return null;
    if (field.isList) return same(value, filter);
    return same(value, filter);
  }
  if (field.type === "Json") return jsonFilter(value, filter);
  const insensitive = filter.mode === "insensitive";
  const parts: Truth[] = [];
  for (const [op, arg] of Object.entries(filter)) {
    if (op === "mode") continue;
    const isNull = value === null || value === undefined;
    switch (op) {
      case "equals":
        parts.push(arg === null ? isNull : isNull ? null : insensitive && typeof value === "string" ? value.toLowerCase() === String(arg).toLowerCase() : same(value, arg));
        break;
      case "not":
        if (arg === null) parts.push(!isNull);
        else if (isPlainObject(arg)) parts.push(not3(scalarFilter(field, value, { ...arg, ...(insensitive ? { mode: "insensitive" } : {}) })));
        else parts.push(isNull ? null : !same(value, arg));
        break;
      case "in":
        parts.push(isNull ? null : (arg as Value[]).some((a) => same(value, a)));
        break;
      case "notIn":
        parts.push(isNull ? null : !(arg as Value[]).some((a) => same(value, a)));
        break;
      case "lt":
      case "lte":
      case "gt":
      case "gte": {
        if (isNull || arg === null || arg === undefined) {
          parts.push(null);
          break;
        }
        const c = compareValues(field, value, arg);
        parts.push(op === "lt" ? c < 0 : op === "lte" ? c <= 0 : op === "gt" ? c > 0 : c >= 0);
        break;
      }
      case "contains":
      case "startsWith":
      case "endsWith":
        parts.push(isNull ? null : stringOp(op, String(value), String(arg), insensitive));
        break;
      case "has":
        parts.push(isNull ? null : (value as Value[]).some((v) => same(v, arg)));
        break;
      case "hasSome":
        parts.push(isNull ? null : (arg as Value[]).some((a) => (value as Value[]).some((v) => same(v, a))));
        break;
      case "hasEvery":
        parts.push(isNull ? null : (arg as Value[]).every((a) => (value as Value[]).some((v) => same(v, a))));
        break;
      case "isEmpty":
        parts.push(isNull ? null : ((value as Value[]).length === 0) === arg);
        break;
      default:
        unsupported(`filter ${op} on ${field.name}`);
    }
  }
  return and3(parts);
}

function jsonFilter(value: Value, filter: Args): Truth {
  const at = filter.path ? jsonAt(value, filter.path as string[]) : value;
  const parts: Truth[] = [];
  for (const [op, arg] of Object.entries(filter)) {
    if (op === "path") continue;
    const missing = at === undefined || at === null;
    switch (op) {
      case "equals":
        if (arg === Prisma.DbNull || arg === Prisma.JsonNull || arg === Prisma.AnyNull) parts.push(missing);
        else parts.push(missing ? null : same(at, arg));
        break;
      case "not":
        parts.push(missing ? null : !same(at, arg));
        break;
      case "array_contains": {
        if (missing) parts.push(null);
        else if (!Array.isArray(at)) parts.push(false);
        else {
          const want = Array.isArray(arg) ? arg : [arg];
          parts.push(want.every((w) => (at as Value[]).some((v) => same(v, w))));
        }
        break;
      }
      case "string_contains":
        parts.push(typeof at === "string" ? at.includes(String(arg)) : null);
        break;
      default:
        unsupported(`json filter ${op}`);
    }
  }
  return and3(parts);
}

function whereTruth(store: MemoryStore, model: Model, row: Row, where: Args | undefined): Truth {
  if (!where) return true;
  const parts: Truth[] = [];
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === "AND") {
      const list = Array.isArray(cond) ? cond : [cond];
      parts.push(and3(list.map((w) => whereTruth(store, model, row, w))));
      continue;
    }
    if (key === "OR") {
      parts.push(or3((cond as Args[]).map((w) => whereTruth(store, model, row, w))));
      continue;
    }
    if (key === "NOT") {
      const list = Array.isArray(cond) ? cond : [cond];
      parts.push(and3(list.map((w) => not3(whereTruth(store, model, row, w)))));
      continue;
    }
    const compound = model.uniques.find((u) => u.length > 1 && u.join("_") === key);
    if (compound) {
      parts.push(and3(compound.map((k) => scalarFilter(model.fields.get(k)!, row[k], (cond as Args)[k]))));
      continue;
    }
    const rel = model.relations.get(key);
    if (rel) {
      parts.push(relationTruth(store, model, rel, row, cond));
      continue;
    }
    const field = model.fields.get(key);
    if (!field) return unsupported(`where ${model.name}.${key}`);
    parts.push(scalarFilter(field, row[key], cond));
  }
  return and3(parts);
}

function relationTruth(store: MemoryStore, model: Model, rel: Relation, row: Row, cond: Value): Truth {
  const target = MODELS.get(rel.target)!;
  const rows = related(store, model, rel, row);
  const hit = (w: Args | null | undefined) => rows.some((r) => whereTruth(store, target, r, w ?? undefined) === true);
  if (rel.isList) {
    const c = cond as Args;
    const parts: boolean[] = [];
    if ("some" in c) parts.push(hit(c.some));
    if ("none" in c) parts.push(!hit(c.none));
    if ("every" in c) parts.push(rows.every((r) => whereTruth(store, target, r, c.every) === true));
    return parts.every(Boolean);
  }
  if (cond === null) return rows.length === 0;
  const c = cond as Args;
  if ("is" in c || "isNot" in c) {
    const parts: boolean[] = [];
    if ("is" in c) parts.push(c.is === null ? rows.length === 0 : hit(c.is));
    if ("isNot" in c) parts.push(c.isNot === null ? rows.length > 0 : !hit(c.isNot));
    return parts.every(Boolean);
  }
  return hit(c);
}

const matches = (store: MemoryStore, model: Model, row: Row, where: Args | undefined) =>
  whereTruth(store, model, row, where) === true;

// --- order, page, project -----------------------------------------------------------------------------------------

function sortKey(store: MemoryStore, model: Model, row: Row, spec: Args): { field?: Field; value: Value; dir: "asc" | "desc"; nulls?: string } {
  const [key, how] = Object.entries(spec)[0] ?? unsupported("empty orderBy");
  const rel = model.relations.get(key);
  if (rel) {
    if (rel.isList) {
      const count = related(store, model, rel, row).length;
      return { value: count, dir: (how as Args)._count };
    }
    const target = MODELS.get(rel.target)!;
    const other = related(store, model, rel, row)[0];
    return other ? sortKey(store, target, other, how as Args) : { value: null, dir: Object.values(how as Args)[0] as "asc" };
  }
  const field = model.fields.get(key) ?? unsupported(`orderBy ${model.name}.${key}`);
  if (isPlainObject(how)) return { field, value: row[key], dir: how.sort, nulls: how.nulls };
  return { field, value: row[key], dir: how as "asc" | "desc" };
}

function sortRows(store: MemoryStore, model: Model, rows: Row[], orderBy: Args | Args[] | undefined): Row[] {
  if (!orderBy) return rows;
  const specs = (Array.isArray(orderBy) ? orderBy : [orderBy]).flatMap((o) =>
    Object.entries(o).map(([k, v]) => ({ [k]: v }))
  );
  return [...rows].sort((a, b) => {
    for (const spec of specs) {
      const x = sortKey(store, model, a, spec);
      const y = sortKey(store, model, b, spec);
      const xn = x.value === null || x.value === undefined;
      const yn = y.value === null || y.value === undefined;
      if (xn || yn) {
        if (xn && yn) continue;
        // Postgres: nulls last ascending, first descending
        const nullsFirst = x.nulls ? x.nulls === "first" : x.dir === "desc";
        return (xn ? -1 : 1) * (nullsFirst ? 1 : -1);
      }
      const c = compareValues(x.field, x.value, y.value);
      if (c !== 0) return x.dir === "desc" ? -c : c;
    }
    return 0;
  });
}

function page(store: MemoryStore, model: Model, rows: Row[], args: Args): Row[] {
  let out = sortRows(store, model, rows, args.orderBy);
  if (args.distinct) {
    const keys = Array.isArray(args.distinct) ? args.distinct : [args.distinct];
    const seen = new Set<string>();
    out = out.filter((r) => {
      const k = JSON.stringify(keys.map((f: string) => r[f]));
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  if (args.cursor) {
    const at = out.findIndex((r) => matches(store, model, r, args.cursor));
    out = at < 0 ? [] : out.slice(at);
  }
  const skip = args.skip ?? 0;
  if (args.take !== undefined && args.take < 0) {
    const end = out.length - skip;
    return out.slice(Math.max(0, end + args.take), end);
  }
  out = out.slice(skip);
  return args.take === undefined ? out : out.slice(0, args.take);
}

function countOf(store: MemoryStore, model: Model, row: Row, spec: Args): Record<string, number> {
  const select = (spec.select ?? {}) as Args;
  const out: Record<string, number> = {};
  for (const [name, how] of Object.entries(select)) {
    if (!how) continue;
    const rel = model.relations.get(name) ?? unsupported(`_count ${model.name}.${name}`);
    const target = MODELS.get(rel.target)!;
    const rows = related(store, model, rel, row);
    out[name] = isPlainObject(how) ? rows.filter((r) => matches(store, target, r, how.where)).length : rows.length;
  }
  return out;
}

function project(store: MemoryStore, model: Model, row: Row, args: Args): Row {
  const out: Row = {};
  if (args.select) {
    for (const [key, how] of Object.entries(args.select as Args)) {
      if (!how) continue;
      if (key === "_count") {
        out._count = countOf(store, model, row, how === true ? { select: Object.fromEntries([...model.relations.values()].filter((r) => r.isList).map((r) => [r.field, true])) } : how);
        continue;
      }
      if (model.relations.has(key)) out[key] = projectRelation(store, model, row, key, how);
      else if (model.fields.has(key)) out[key] = clone(row[key]);
      else unsupported(`select ${model.name}.${key}`);
    }
    return out;
  }
  const omit = (args.omit ?? {}) as Args;
  for (const f of model.scalars) if (!omit[f.name]) out[f.name] = clone(row[f.name]);
  for (const [key, how] of Object.entries((args.include ?? {}) as Args)) {
    if (!how) continue;
    if (key === "_count") out._count = countOf(store, model, row, how);
    else out[key] = projectRelation(store, model, row, key, how);
  }
  return out;
}

function projectRelation(store: MemoryStore, model: Model, row: Row, key: string, how: Value): Value {
  const rel = model.relations.get(key) ?? unsupported(`relation ${model.name}.${key}`);
  const target = MODELS.get(rel.target)!;
  const nested = (how === true ? {} : how) as Args;
  let rows = related(store, model, rel, row);
  if (rel.isList) {
    rows = rows.filter((r) => matches(store, target, r, nested.where));
    return page(store, target, rows, nested).map((r) => project(store, target, r, nested));
  }
  const one = rows[0];
  return one ? project(store, target, one, nested) : null;
}

// --- writes -------------------------------------------------------------------------------------------------------

function applyData(store: MemoryStore, model: Model, row: Row, data: Args): void {
  for (const [key, change] of Object.entries(data)) {
    if (change === undefined) continue;
    const rel = model.relations.get(key);
    if (rel) {
      applyRelationWrite(store, model, rel, row, change as Args);
      continue;
    }
    const field = model.fields.get(key) ?? unsupported(`data ${model.name}.${key}`);
    let next: Value = change;
    if (change === Prisma.DbNull || change === Prisma.JsonNull) next = null;
    else if (isPlainObject(change) && field.type !== "Json") {
      const [op, by] = Object.entries(change)[0] ?? unsupported("empty update op");
      const cur = row[key] as number;
      if (op === "set") next = by;
      else if (op === "increment") next = cur + (by as number);
      else if (op === "decrement") next = cur - (by as number);
      else if (op === "multiply") next = cur * (by as number);
      else if (op === "divide") next = cur / (by as number);
      else if (op === "push") next = [...((row[key] as Value[]) ?? []), ...(Array.isArray(by) ? by : [by])];
      else unsupported(`update op ${op}`);
    }
    if (field.type === "DateTime" && typeof next === "string") next = new Date(next);
    if (field.type === "Int" && typeof next === "number" && (next > 2_147_483_647 || next < -2_147_483_648)) {
      throw known("P2020", `Value out of range for the type: ${model.name}.${key}`);
    }
    row[key] = clone(next);
  }
  for (const f of model.scalars) if (f.isUpdatedAt && !(f.name in data)) row[f.name] = new Date();
}

function applyRelationWrite(store: MemoryStore, model: Model, rel: Relation, row: Row, write: Args): void {
  if (!rel.owning) return unsupported(`nested write on ${model.name}.${rel.field}`);
  const target = MODELS.get(rel.target)!;
  if (write.connect) {
    const other = store.rows(target.name).find((t) => matches(store, target, t, write.connect));
    if (!other) throw known("P2025", `No ${target.name} found to connect`);
    rel.localFields.forEach((k, i) => (row[k] = other[rel.targetFields[i]!]));
  } else if (write.disconnect) {
    for (const k of rel.localFields) row[k] = null;
  } else unsupported(`nested ${Object.keys(write).join(",")} on ${model.name}.${rel.field}`);
}

function createRow(store: MemoryStore, model: Model, data: Args): Row {
  const scalars: Row = {};
  const nested: Array<[Relation, Args]> = [];
  for (const [key, v] of Object.entries(data)) {
    const rel = model.relations.get(key);
    if (!rel) {
      scalars[key] = v;
      continue;
    }
    if (v === undefined) continue;
    if (rel.owning) {
      const target = MODELS.get(rel.target)!;
      if (v.connect) {
        const other = store.rows(target.name).find((t) => matches(store, target, t, v.connect));
        if (!other) throw known("P2025", `No ${target.name} found to connect`);
        rel.localFields.forEach((k, i) => (scalars[k] = other[rel.targetFields[i]!]));
      } else if (v.create) {
        const other = createRow(store, target, v.create);
        rel.localFields.forEach((k, i) => (scalars[k] = other[rel.targetFields[i]!]));
      } else unsupported(`nested create on ${model.name}.${key}`);
    } else nested.push([rel, v]);
  }
  const row = store.newRow(model, scalars);
  store.assertUnique(model, row);
  store.assertForeignKeys(model, row);
  store.rows(model.name).push(row);
  for (const [rel, v] of nested) {
    const target = MODELS.get(rel.target)!;
    const link = Object.fromEntries(rel.targetFields.map((k, i) => [k, row[rel.localFields[i]!]]));
    const creates = v.create ? (Array.isArray(v.create) ? v.create : [v.create]) : v.createMany ? v.createMany.data : unsupported(`nested ${Object.keys(v)} on ${model.name}.${rel.field}`);
    for (const child of creates as Args[]) createRow(store, target, { ...child, ...link });
  }
  return row;
}

// --- aggregate ----------------------------------------------------------------------------------------------------

function aggregateOf(model: Model, rows: Row[], args: Args): Row {
  const out: Row = {};
  for (const op of ["_sum", "_min", "_max", "_avg"] as const) {
    if (!args[op]) continue;
    const part: Row = {};
    for (const [key, on] of Object.entries(args[op] as Args)) {
      if (!on) continue;
      const field = model.fields.get(key)!;
      const vs = rows.map((r) => r[key]).filter((v) => v !== null && v !== undefined);
      if (op === "_sum") part[key] = vs.length ? vs.reduce((s: number, v) => s + (v as number), 0) : null;
      else if (op === "_avg") part[key] = vs.length ? (vs as number[]).reduce((s, v) => s + v, 0) / vs.length : null;
      else part[key] = vs.length ? vs.reduce((m, v) => ((op === "_min" ? compareValues(field, v, m) < 0 : compareValues(field, v, m) > 0) ? v : m)) : null;
    }
    out[op] = part;
  }
  if (args._count) {
    if (args._count === true) out._count = rows.length;
    else {
      const part: Row = {};
      for (const [key, on] of Object.entries(args._count as Args)) {
        if (!on) continue;
        part[key] = key === "_all" ? rows.length : rows.filter((r) => r[key] !== null && r[key] !== undefined).length;
      }
      out._count = part;
    }
  }
  return out;
}

// --- the client ---------------------------------------------------------------------------------------------------

/** Serialises transactions: one runs at a time, the rest wait their turn. */
class Mutex {
  private tail: Promise<void> = Promise.resolve();
  async run<T>(work: () => Promise<T>): Promise<T> {
    const prev = this.tail;
    let release!: () => void;
    this.tail = new Promise((r) => (release = r));
    await prev;
    try {
      return await work();
    } finally {
      release();
    }
  }
}

const notFound = (model: Model) => known("P2025", `No ${model.name} found`, { modelName: model.name });

function delegate(store: MemoryStore, model: Model, guard: <T>(work: () => T) => Promise<T>) {
  const all = () => store.rows(model.name);
  const filtered = (where?: Args) => all().filter((r) => matches(store, model, r, where));
  const one = (args: Args) => page(store, model, filtered(args.where), { ...args, take: 1 })[0];
  /** A unique read or write needs a where that names something (Prisma refuses an empty one). */
  const unique = (args: Args) => {
    if (!args?.where || !Object.values(args.where).some((v) => v !== undefined)) {
      unsupported(`${model.name} unique where without a value`);
    }
    return one({ where: args.where });
  };
  const out = (row: Row | undefined, args: Args) => (row ? project(store, model, row, args) : null);
  const write = (op: string, where?: Args) => store.log.push({ kind: "write", model: model.name, op, where });
  const updateRow = (row: Row, data: Args) => {
    const before = clone(row);
    applyData(store, model, row, data);
    try {
      store.assertUnique(model, row, row);
      store.assertForeignKeys(model, row);
    } catch (error) {
      Object.assign(row, before);
      throw error;
    }
  };

  return {
    findUnique: (args: Args) => guard(() => out(unique(args), args)),
    findFirst: (args: Args = {}) => guard(() => out(one(args), args)),
    findUniqueOrThrow: (args: Args) =>
      guard(() => {
        const row = unique(args);
        if (!row) throw notFound(model);
        return project(store, model, row, args);
      }),
    findFirstOrThrow: (args: Args = {}) =>
      guard(() => {
        const row = one(args);
        if (!row) throw notFound(model);
        return project(store, model, row, args);
      }),
    findMany: (args: Args = {}) =>
      guard(() => page(store, model, filtered(args.where), args).map((r) => project(store, model, r, args))),
    count: (args: Args = {}) =>
      guard(() => {
        const rows = page(store, model, filtered(args.where), args);
        if (!args.select) return rows.length;
        return aggregateOf(model, rows, { _count: args.select })._count;
      }),
    aggregate: (args: Args) => guard(() => aggregateOf(model, page(store, model, filtered(args.where), args), args)),
    groupBy: (args: Args) =>
      guard(() => {
        const by: string[] = Array.isArray(args.by) ? args.by : [args.by];
        const groups = new Map<string, Row[]>();
        for (const r of filtered(args.where)) {
          const k = JSON.stringify(by.map((f) => r[f]));
          groups.set(k, [...(groups.get(k) ?? []), r]);
        }
        if (args.having) unsupported("groupBy having");
        const rows = [...groups.values()].map((rs) => ({
          ...Object.fromEntries(by.map((f) => [f, clone(rs[0]![f])])),
          ...aggregateOf(model, rs, args),
        }));
        return page(store, model, rows, { orderBy: args.orderBy, take: args.take, skip: args.skip });
      }),
    create: (args: Args) =>
      guard(() => {
        write("create");
        return project(store, model, createRow(store, model, args.data), args);
      }),
    createMany: (args: Args) =>
      guard(() => {
        write("createMany");
        let count = 0;
        for (const data of Array.isArray(args.data) ? args.data : [args.data]) {
          try {
            createRow(store, model, data);
            count++;
          } catch (error) {
            if (!(args.skipDuplicates && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
          }
        }
        return { count };
      }),
    createManyAndReturn: (args: Args) =>
      guard(() => {
        write("createMany");
        return (args.data as Args[]).map((d) => project(store, model, createRow(store, model, d), args));
      }),
    update: (args: Args) =>
      guard(() => {
        write("update", args.where);
        const row = unique(args);
        if (!row) throw notFound(model);
        updateRow(row, args.data);
        return project(store, model, row, args);
      }),
    updateMany: (args: Args) =>
      guard(() => {
        write("updateMany", args.where);
        const rows = filtered(args.where);
        for (const row of rows) updateRow(row, args.data);
        return { count: rows.length };
      }),
    upsert: (args: Args) =>
      guard(() => {
        write("upsert", args.where);
        const row = unique(args);
        if (row) {
          updateRow(row, args.update);
          return project(store, model, row, args);
        }
        return project(store, model, createRow(store, model, args.create), args);
      }),
    delete: (args: Args) =>
      guard(() => {
        write("delete", args.where);
        const row = unique(args);
        if (!row) throw notFound(model);
        const shown = project(store, model, row, args);
        store.removeRows(model, [row]);
        return shown;
      }),
    deleteMany: (args: Args = {}) =>
      guard(() => {
        write("deleteMany", args.where);
        const rows = filtered(args.where);
        store.removeRows(model, rows);
        return { count: rows.length };
      }),
  };
}

export interface MemoryPrisma {
  /** The tables, the lock and write log, and `onRaw`. */
  store: MemoryStore;
  [delegate: string]: any;
}

/**
 * A fresh in-memory Prisma client. Use it where the code wants a `PrismaClient` (`as never` at the call site); its
 * interactive transaction client has the same delegates and raw methods, and no `$transaction`.
 */
export function createMemoryPrisma(store: MemoryStore = new MemoryStore()): MemoryPrisma {
  const mutex = new Mutex();
  const inTx = new AsyncLocalStorage<boolean>();
  // A call outside any transaction waits for the running one; a call inside it (from its async flow) goes straight in
  const outside = <T>(work: () => T): Promise<T> =>
    inTx.getStore() ? Promise.resolve().then(work) : mutex.run(async () => work());
  const inside = <T>(work: () => T): Promise<T> => Promise.resolve().then(work);

  const client = (guard: <T>(work: () => T) => Promise<T>, withTx: boolean): MemoryPrisma => {
    const delegates = new Map<string, ReturnType<typeof delegate>>();
    const base: Record<string, unknown> = {
      store,
      $executeRaw: (...a: unknown[]) => guard(() => store.raw(a)),
      $queryRaw: (...a: unknown[]) => guard(() => store.raw(a)),
      $executeRawUnsafe: (...a: unknown[]) => guard(() => store.raw(a)),
      $queryRawUnsafe: (...a: unknown[]) => guard(() => store.raw(a)),
      $connect: async () => undefined,
      $disconnect: async () => undefined,
      $on: () => undefined,
    };
    if (withTx) {
      base.$transaction = (work: unknown) => {
        if (Array.isArray(work)) return Promise.all(work);
        if (typeof work !== "function") return unsupported("$transaction argument");
        if (inTx.getStore()) return (work as (tx: MemoryPrisma) => Promise<unknown>)(txClient);
        return mutex.run(() =>
          inTx.run(true, async () => {
            const restore = store.snapshot();
            try {
              return await (work as (tx: MemoryPrisma) => Promise<unknown>)(txClient);
            } catch (error) {
              restore();
              throw error;
            }
          })
        );
      };
    }
    return new Proxy(base, {
      get(target, prop) {
        if (typeof prop === "symbol" || prop in target) return target[prop as string];
        if (prop === "then" || prop.startsWith("$") || prop.startsWith("_")) return undefined;
        const model = BY_DELEGATE.get(prop);
        if (!model) return unsupported(`client property ${prop}`);
        let d = delegates.get(prop);
        if (!d) delegates.set(prop, (d = delegate(store, model, guard)));
        return d;
      },
      has(target, prop) {
        return prop in target || (typeof prop === "string" && BY_DELEGATE.has(prop));
      },
    }) as MemoryPrisma;
  };

  const txClient = client(inside, false);
  return client(outside, true);
}
