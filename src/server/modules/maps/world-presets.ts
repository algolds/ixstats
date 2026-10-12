/**
 * World presets in the database (docs/specs/2026-10-12-atlas-studio-design.md, "Presets"). A preset is a named
 * recipe without a seed. Its draft is an unpublished version; publishing stamps that version and makes it the one
 * founders get, and a published version is never changed (the next save starts a new draft). The three built-ins are
 * seeded from `WORLD_PRESETS` on first read, with fixed ids and `skipDuplicates`, so concurrent first reads and a
 * half-finished seed both settle on the same rows. Founders only ever get published, unarchived presets.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { worldPresetParamsSchema } from "~/lib/maps/import/world-bundle";
import type { WorldPresetParams } from "~/lib/worldgen/v2/types";
import { FACTORY_PRESETS, type WorldPresetOption } from "~/lib/worldgen/world-presets";

type WorldPresetErrorCode = "NOT_FOUND" | "BAD_REQUEST" | "CONFLICT";

export class WorldPresetError extends Error {
  constructor(
    public readonly code: WorldPresetErrorCode,
    message: string
  ) {
    super(message);
    this.name = "WorldPresetError";
  }
}

export interface PresetSummary {
  slug: string;
  name: string;
  description: string;
  builtIn: boolean;
  sortOrder: number;
  published: { versionId: string; params: WorldPresetParams; publishedAt: Date } | null;
  draft: { versionId: string; params: WorldPresetParams; savedAt: Date } | null;
  archived: boolean;
}

export interface PresetVersion {
  versionId: string;
  params: WorldPresetParams;
  note: string | null;
  createdBy: string;
  publishedAt: Date;
  /** The version founders get now */
  current: boolean;
}

export interface CreatePresetInput {
  name: string;
  description?: string;
  params?: WorldPresetParams;
}

const FACTORY_USER = "system";
const factoryPresetId = (slug: string) => `world-preset-${slug}`;
const factoryVersionId = (slug: string) => `world-preset-${slug}-factory`;

const toJson = (value: object): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));

/** Stored params, as long as they still pass the schema; a row the schema has since outgrown reads as no overrides. */
function storedParams(json: Prisma.JsonValue): WorldPresetParams {
  const parsed = worldPresetParamsSchema.safeParse(json);
  return parsed.success ? parsed.data : {};
}

/** Params for a write: the bounded schema, which rejects a `seed` and any key it does not know. */
function checkedParams(value: WorldPresetParams): WorldPresetParams {
  const parsed = worldPresetParamsSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.join(".") || "params";
    throw new WorldPresetError(
      "BAD_REQUEST",
      `Preset params are not valid (${where}): ${issue?.message ?? ""}`
    );
  }
  return parsed.data;
}

// Seeding

/** Creates the built-in presets, each published with its factory recipe, where they are missing. Idempotent. */
export async function seedWorldPresets(db: PrismaClient): Promise<void> {
  const seeded = await db.worldPreset.count({
    where: { slug: { in: FACTORY_PRESETS.map((p) => p.slug) }, publishedVersionId: { not: null } },
  });
  if (seeded === FACTORY_PRESETS.length) return;
  await db.worldPreset.createMany({
    data: FACTORY_PRESETS.map(({ slug, name, description }, sortOrder) => ({
      id: factoryPresetId(slug),
      slug,
      name,
      description,
      sortOrder,
      builtIn: true,
    })),
    skipDuplicates: true,
  });
  const publishedAt = new Date();
  await db.worldPresetVersion.createMany({
    data: FACTORY_PRESETS.map(({ slug, params }) => ({
      id: factoryVersionId(slug),
      presetId: factoryPresetId(slug),
      params: toJson(params),
      note: "Factory",
      createdBy: FACTORY_USER,
      publishedAt,
    })),
    skipDuplicates: true,
  });
  for (const { slug } of FACTORY_PRESETS) {
    await db.worldPreset.updateMany({
      where: { slug, publishedVersionId: null },
      data: { publishedVersionId: factoryVersionId(slug) },
    });
  }
}

// Reads

const withVersions = { publishedVersion: true, draftVersion: true } as const;
type PresetRow = Prisma.WorldPresetGetPayload<{ include: typeof withVersions }>;
const inOrder = [{ sortOrder: "asc" }, { createdAt: "asc" }] as const;

function summarize(row: PresetRow): PresetSummary {
  const { publishedVersion: published, draftVersion: draft } = row;
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    builtIn: row.builtIn,
    sortOrder: row.sortOrder,
    published:
      published && published.publishedAt
        ? {
            versionId: published.id,
            params: storedParams(published.params),
            publishedAt: published.publishedAt,
          }
        : null,
    draft: draft
      ? { versionId: draft.id, params: storedParams(draft.params), savedAt: draft.updatedAt }
      : null,
    archived: row.archivedAt !== null,
  };
}

/** Every preset in order, drafts included; archived ones only when asked for. */
export async function listWorldPresets(
  db: PrismaClient,
  { includeArchived = false }: { includeArchived?: boolean } = {}
): Promise<PresetSummary[]> {
  await seedWorldPresets(db);
  const rows = await db.worldPreset.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: [...inOrder],
    include: withVersions,
  });
  return rows.map(summarize);
}

/** What founders pick from: the published recipe of each unarchived preset, in order. Never a draft. */
export async function listPublishedWorldPresets(db: PrismaClient): Promise<WorldPresetOption[]> {
  await seedWorldPresets(db);
  const rows = await db.worldPreset.findMany({
    where: { archivedAt: null, publishedVersionId: { not: null } },
    orderBy: [...inOrder],
    select: { slug: true, name: true, publishedVersion: { select: { params: true } } },
  });
  return rows.flatMap(({ slug, name, publishedVersion }) =>
    publishedVersion ? [{ slug, name, params: storedParams(publishedVersion.params) }] : []
  );
}

async function summaryOf(db: PrismaClient, slug: string): Promise<PresetSummary> {
  const row = await db.worldPreset.findUnique({ where: { slug }, include: withVersions });
  if (!row) throw new WorldPresetError("NOT_FOUND", "Preset not found");
  return summarize(row);
}

interface PresetHandle {
  id: string;
  slug: string;
  builtIn: boolean;
  draftVersionId: string | null;
}

async function loadPreset(db: PrismaClient, slug: string): Promise<PresetHandle> {
  await seedWorldPresets(db);
  const row = await db.worldPreset.findUnique({
    where: { slug },
    select: { id: true, slug: true, builtIn: true, draftVersionId: true },
  });
  if (!row) throw new WorldPresetError("NOT_FOUND", "Preset not found");
  return row;
}

// Presets

const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "preset";

async function freeSlug(db: PrismaClient, name: string): Promise<string> {
  const base = slugOf(name);
  const taken = new Set(
    (
      await db.worldPreset.findMany({
        where: { slug: { startsWith: base } },
        select: { slug: true },
      })
    ).map((row) => row.slug)
  );
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/** A new preset, last in order, as an unpublished draft (founders do not see it until it is published). */
export async function createWorldPreset(
  db: PrismaClient,
  userId: string,
  input: CreatePresetInput
): Promise<PresetSummary> {
  await seedWorldPresets(db);
  const params = checkedParams(input.params ?? {});
  const slug = await freeSlug(db, input.name);
  const last = await db.worldPreset.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  await db.$transaction(async (tx) => {
    const preset = await tx.worldPreset.create({
      data: {
        slug,
        name: input.name,
        description: input.description ?? "",
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    const draft = await tx.worldPresetVersion.create({
      data: { presetId: preset.id, params: toJson(params), createdBy: userId },
    });
    await tx.worldPreset.update({ where: { id: preset.id }, data: { draftVersionId: draft.id } });
  });
  return summaryOf(db, slug);
}

export async function renameWorldPreset(
  db: PrismaClient,
  slug: string,
  name: string,
  description?: string
): Promise<PresetSummary> {
  const preset = await loadPreset(db, slug);
  await db.worldPreset.update({
    where: { id: preset.id },
    data: description === undefined ? { name } : { name, description },
  });
  return summaryOf(db, slug);
}

/**
 * Puts the presets in the given order; any not named (archived ones the caller did not list) follow, in the order
 * they had.
 */
export async function reorderWorldPresets(
  db: PrismaClient,
  slugs: string[]
): Promise<PresetSummary[]> {
  await seedWorldPresets(db);
  if (new Set(slugs).size !== slugs.length)
    throw new WorldPresetError("BAD_REQUEST", "A preset is listed twice");
  const all = await db.worldPreset.findMany({
    orderBy: [...inOrder],
    select: { id: true, slug: true, sortOrder: true },
  });
  const known = new Map(all.map((row) => [row.slug, row]));
  const unknown = slugs.find((slug) => !known.has(slug));
  if (unknown) throw new WorldPresetError("NOT_FOUND", `Preset ${unknown} not found`);
  const ordered = [
    ...slugs.map((slug) => known.get(slug)!),
    ...all.filter((row) => !slugs.includes(row.slug)),
  ];
  await db.$transaction(async (tx) => {
    for (const [sortOrder, row] of ordered.entries()) {
      if (row.sortOrder !== sortOrder)
        await tx.worldPreset.update({ where: { id: row.id }, data: { sortOrder } });
    }
  });
  return listWorldPresets(db, { includeArchived: true });
}

/** Archives a preset (founders stop seeing it) or brings it back. The built-ins cannot be archived. */
export async function setWorldPresetArchived(
  db: PrismaClient,
  slug: string,
  archived: boolean
): Promise<PresetSummary> {
  const preset = await loadPreset(db, slug);
  if (archived && preset.builtIn)
    throw new WorldPresetError("CONFLICT", "A built-in preset cannot be archived");
  await db.worldPreset.update({
    where: { id: preset.id },
    data: { archivedAt: archived ? new Date() : null },
  });
  return summaryOf(db, slug);
}

// Drafts, versions

/** Writes `params` as the preset's draft: the draft version is updated in place, or one is started. */
async function writeDraft(
  db: PrismaClient,
  preset: PresetHandle,
  userId: string,
  params: WorldPresetParams,
  note: string | null
): Promise<PresetSummary> {
  const data = { params: toJson(checkedParams(params)), note };
  if (preset.draftVersionId) {
    await db.worldPresetVersion.update({ where: { id: preset.draftVersionId }, data });
  } else {
    await db.$transaction(async (tx) => {
      const draft = await tx.worldPresetVersion.create({
        data: { ...data, presetId: preset.id, createdBy: userId },
      });
      await tx.worldPreset.update({ where: { id: preset.id }, data: { draftVersionId: draft.id } });
    });
  }
  return summaryOf(db, preset.slug);
}

export async function saveWorldPresetDraft(
  db: PrismaClient,
  userId: string,
  slug: string,
  params: WorldPresetParams,
  note?: string
): Promise<PresetSummary> {
  return writeDraft(db, await loadPreset(db, slug), userId, params, note ?? null);
}

/** Makes the draft the published version; the preset then has no draft until the next save. */
export async function publishWorldPreset(
  db: PrismaClient,
  slug: string,
  note?: string
): Promise<PresetSummary> {
  const preset = await loadPreset(db, slug);
  if (!preset.draftVersionId)
    throw new WorldPresetError("CONFLICT", "The preset has no draft to publish");
  const draftId = preset.draftVersionId;
  await db.$transaction(async (tx) => {
    await tx.worldPresetVersion.update({
      where: { id: draftId },
      data: note === undefined ? { publishedAt: new Date() } : { publishedAt: new Date(), note },
    });
    await tx.worldPreset.update({
      where: { id: preset.id },
      data: { publishedVersionId: draftId, draftVersionId: null },
    });
  });
  return summaryOf(db, slug);
}

/** Every published version of a preset, newest first. */
export async function listWorldPresetVersions(
  db: PrismaClient,
  slug: string
): Promise<PresetVersion[]> {
  const preset = await loadPreset(db, slug);
  const current = await db.worldPreset.findUnique({
    where: { id: preset.id },
    select: { publishedVersionId: true },
  });
  const rows = await db.worldPresetVersion.findMany({
    where: { presetId: preset.id, publishedAt: { not: null } },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
  return rows.flatMap((row) =>
    row.publishedAt
      ? [
          {
            versionId: row.id,
            params: storedParams(row.params),
            note: row.note,
            createdBy: row.createdBy,
            publishedAt: row.publishedAt,
            current: row.id === current?.publishedVersionId,
          },
        ]
      : []
  );
}

/** A new draft from a published version (an existing draft is replaced). */
export async function restoreWorldPresetVersion(
  db: PrismaClient,
  userId: string,
  slug: string,
  versionId: string
): Promise<PresetSummary> {
  const preset = await loadPreset(db, slug);
  const version = await db.worldPresetVersion.findFirst({
    where: { id: versionId, presetId: preset.id, publishedAt: { not: null } },
  });
  if (!version?.publishedAt) throw new WorldPresetError("NOT_FOUND", "Version not found");
  const note = `Restored from ${version.publishedAt.toISOString().slice(0, 10)}`;
  return writeDraft(db, preset, userId, storedParams(version.params), note);
}

/** A new draft from the code values in `WORLD_PRESETS` (built-ins only; an existing draft is replaced). */
export async function resetWorldPresetToFactory(
  db: PrismaClient,
  userId: string,
  slug: string
): Promise<PresetSummary> {
  const preset = await loadPreset(db, slug);
  const factory = FACTORY_PRESETS.find((p) => p.slug === slug);
  if (!preset.builtIn || !factory)
    throw new WorldPresetError("BAD_REQUEST", "Only a built-in preset has factory values");
  return writeDraft(db, preset, userId, factory.params, "Reset to factory");
}
