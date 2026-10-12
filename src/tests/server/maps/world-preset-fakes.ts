/** In-memory stand-ins for the `world_presets` and `world_preset_versions` tables, with the Prisma calls the module makes. */
import type { PrismaClient } from "@prisma/client";

type Json = object;

export interface PresetRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  builtIn: boolean;
  publishedVersionId: string | null;
  draftVersionId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VersionRow {
  id: string;
  presetId: string;
  params: Json;
  note: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

type Condition = null | string | number | { in?: string[]; not?: null; startsWith?: string };
type Where = Record<string, Condition | undefined>;
type Order = Record<string, "asc" | "desc">;

function matches(row: object, where: Where = {}): boolean {
  const values: Record<string, unknown> = { ...row };
  return Object.entries(where).every(([key, cond]) => {
    const value = values[key];
    if (cond === undefined) return true;
    if (cond === null || typeof cond !== "object") return value === cond;
    if (cond.in) return cond.in.includes(String(value));
    if ("not" in cond) return value !== null && value !== undefined;
    if (cond.startsWith !== undefined) return String(value).startsWith(cond.startsWith);
    return false;
  });
}

function sorted<T extends object>(rows: T[], orderBy: Order | Order[] = []): T[] {
  const keys = (Array.isArray(orderBy) ? orderBy : [orderBy]).flatMap((o) => Object.entries(o));
  return [...rows].sort((a, b) => {
    for (const [key, dir] of keys) {
      const left = (a as Record<string, unknown>)[key] as number | Date;
      const right = (b as Record<string, unknown>)[key] as number | Date;
      if (left < right) return dir === "asc" ? -1 : 1;
      if (left > right) return dir === "asc" ? 1 : -1;
    }
    return 0;
  });
}

export function createPresetDb() {
  let counter = 0;
  const tick = () => new Date(Date.now() + ++counter);
  const presets: PresetRow[] = [];
  const versions: VersionRow[] = [];

  const withRelations = (row: PresetRow) => ({
    ...row,
    publishedVersion: versions.find((v) => v.id === row.publishedVersionId) ?? null,
    draftVersion: versions.find((v) => v.id === row.draftVersionId) ?? null,
  });
  const newPreset = (data: Partial<PresetRow> & Pick<PresetRow, "slug" | "name">): PresetRow => ({
    id: `p${++counter}`,
    description: "",
    sortOrder: 0,
    builtIn: false,
    publishedVersionId: null,
    draftVersionId: null,
    archivedAt: null,
    createdAt: tick(),
    updatedAt: tick(),
    ...data,
  });
  const newVersion = (
    data: Partial<VersionRow> & Pick<VersionRow, "presetId" | "params" | "createdBy">
  ): VersionRow => ({
    id: `v${++counter}`,
    note: null,
    createdAt: tick(),
    updatedAt: tick(),
    publishedAt: null,
    ...data,
  });

  const worldPreset = {
    count: jest.fn(
      async ({ where }: { where: Where }) => presets.filter((r) => matches(r, where)).length
    ),
    createMany: jest.fn(
      async ({ data }: { data: Partial<PresetRow>[]; skipDuplicates: boolean }) => {
        const fresh = data.filter((d) => !presets.some((r) => r.id === d.id || r.slug === d.slug));
        for (const d of fresh) presets.push(newPreset({ slug: "", name: "", ...d }));
        return { count: fresh.length };
      }
    ),
    updateMany: jest.fn(async ({ where, data }: { where: Where; data: Partial<PresetRow> }) => {
      const hit = presets.filter((r) => matches(r, where));
      for (const row of hit) Object.assign(row, data, { updatedAt: tick() });
      return { count: hit.length };
    }),
    findMany: jest.fn(
      async ({ where, orderBy }: { where?: Where; orderBy?: Order | Order[] } = {}) =>
        sorted(
          presets.filter((r) => matches(r, where)),
          orderBy
        ).map(withRelations)
    ),
    findFirst: jest.fn(async ({ orderBy }: { orderBy?: Order } = {}) => {
      const row = sorted(presets, orderBy)[0];
      return row ? withRelations(row) : null;
    }),
    findUnique: jest.fn(async ({ where }: { where: { id?: string; slug?: string } }) => {
      const row = presets.find((r) => matches(r, where));
      return row ? withRelations(row) : null;
    }),
    create: jest.fn(
      async ({ data }: { data: Partial<PresetRow> & Pick<PresetRow, "slug" | "name"> }) => {
        if (presets.some((r) => r.slug === data.slug))
          throw new Error("Unique constraint failed on slug");
        const row = newPreset(data);
        presets.push(row);
        return row;
      }
    ),
    update: jest.fn(
      async ({ where, data }: { where: { id: string }; data: Partial<PresetRow> }) => {
        const row = presets.find((r) => r.id === where.id);
        if (!row) throw new Error("Record to update not found");
        return Object.assign(row, data, { updatedAt: tick() });
      }
    ),
  };

  const worldPresetVersion = {
    createMany: jest.fn(
      async ({
        data,
      }: {
        data: (Partial<VersionRow> & Pick<VersionRow, "presetId" | "params" | "createdBy">)[];
      }) => {
        const fresh = data.filter((d) => !versions.some((v) => v.id === d.id));
        for (const d of fresh) versions.push(newVersion(d));
        return { count: fresh.length };
      }
    ),
    create: jest.fn(
      async ({
        data,
      }: {
        data: Partial<VersionRow> & Pick<VersionRow, "presetId" | "params" | "createdBy">;
      }) => {
        const row = newVersion(data);
        versions.push(row);
        return row;
      }
    ),
    update: jest.fn(
      async ({ where, data }: { where: { id: string }; data: Partial<VersionRow> }) => {
        const row = versions.find((v) => v.id === where.id);
        if (!row) throw new Error("Record to update not found");
        return Object.assign(row, data, { updatedAt: tick() });
      }
    ),
    updateMany: jest.fn(async ({ where, data }: { where: Where; data: Partial<VersionRow> }) => {
      const hit = versions.filter((v) => matches(v, where));
      for (const row of hit) Object.assign(row, data, { updatedAt: tick() });
      return { count: hit.length };
    }),
    findFirst: jest.fn(
      async ({ where }: { where: Where }) => versions.find((v) => matches(v, where)) ?? null
    ),
    findMany: jest.fn(
      async ({ where, orderBy }: { where?: Where; orderBy?: Order | Order[] } = {}) =>
        sorted(
          versions.filter((v) => matches(v, where)),
          orderBy
        )
    ),
  };

  const db = { worldPreset, worldPresetVersion, $transaction: jest.fn() };
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
  return { db, presets, versions, asClient: (): PrismaClient => db as never };
}

export type PresetDb = ReturnType<typeof createPresetDb>;
