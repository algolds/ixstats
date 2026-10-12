/**
 * What applying a world would do, for the dry run: the changes layer by layer, the nation slots created, retired,
 * kept and reserved, and the warnings (work the world replaces, notes). Reads the realm and writes nothing.
 */
import type { PrismaClient } from "@prisma/client";
import type { PhysicalLayer } from "~/lib/maps/import/options";
import { WORLD_BUNDLE_LAYERS, type WorldBundleLayerName } from "~/lib/maps/import/world-bundle";
import { layerFeatures } from "./map-import.pipeline";
import type { ImportRealm } from "./map-import.realm";
import type { PreparedWorld } from "./world-import.prepare";
import { summarySource } from "./world-import.check";
import { dedupeNames, retirableSlots, unlinkedFeatures } from "./world-import.slots";

/** A feature edited this long after the last generation counts as a hand edit (the generation itself touches rows). */
const HAND_EDIT_GRACE_MS = 10 * 60_000;

export interface WorldLayerDiff {
  /** Features the layer gets that it has no feature of that key for. */
  create: number;
  /** Features that replace an existing feature of the same key. */
  change: number;
  /** Active features the world no longer has. */
  retire: number;
}

export interface WorldDiff {
  /** The realm's map version the check read: an apply of this check needs the map to still be at it */
  mapVersion: number;
  /** The map version the browser fitted the draft to; a world fitted to the realm's map is refused unless it is current */
  fittedMapVersion: number | null;
  source: PreparedWorld["bundle"]["source"];
  seed: number;
  developmentLevel: PreparedWorld["bundle"]["params"]["developmentLevel"];
  layers: Record<WorldBundleLayerName, WorldLayerDiff>;
  /** The layers the realm has that the world leaves as they are (a world fitted to the realm's map; else none). */
  kept: WorldBundleLayerName[];
  /** The admin's layer choice when this check is one: only these layers are written, and no nation is touched. */
  chosen: PhysicalLayer[] | null;
  slots: {
    create: number;
    /** Old generated slots no player has: retired. */
    retire: number;
    /** Old generated slots a player owns: kept as they are. */
    keep: number;
    /** Old generated slots with no owner that an old claim row or response keeps: kept, closed to claims, no land. */
    reserved: number;
    /** New slots whose name was taken in the realm and got a number. */
    renamed: number;
  };
  /** Every warning, the notes and the ones in `replaces` */
  warnings: string[];
  /**
   * The warnings about work the world replaces or takes from someone (hand edits, later map imports, the current
   * map, nations that keep their country but lose their border): the review shows these first. Each is also in
   * `warnings`.
   */
  replaces: string[];
}

interface MapRow {
  layerType: string;
  featureId: string;
  isActive: boolean;
  countryId: string | null;
  updatedAt: Date;
}

function layerDiff(
  prepared: PreparedWorld,
  layer: WorldBundleLayerName,
  rows: readonly MapRow[]
): WorldLayerDiff {
  const incoming = prepared.layers[layer];
  if (!incoming) return { create: 0, change: 0, retire: 0 };
  const keys = new Set(layerFeatures(layer, incoming).map((feature) => feature.key));
  const existing = rows.filter((row) => row.layerType === layer);
  const present = new Set(existing.map((row) => row.featureId));
  return {
    create: [...keys].filter((key) => !present.has(key)).length,
    change: [...keys].filter((key) => present.has(key)).length,
    retire: existing.filter((row) => row.isActive && !keys.has(row.featureId)).length,
  };
}

/** What replacing the realm's current map loses: hand edits since the last generation, or the map itself. */
async function replacedWarnings(
  db: PrismaClient,
  realmId: string,
  rows: readonly MapRow[],
  survivorLinks: number
): Promise<string[]> {
  const active = rows.filter((row) => row.isActive);
  const imports = await db.mapImport.findMany({
    where: { realmId, rolledBackAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { createdAt: true, summary: true },
  });
  const last = imports.find((record) => summarySource(record.summary) === "world");
  const warnings: string[] = [];
  if (!last) {
    if (active.length > 0)
      warnings.push(`The realm's current map (${active.length} features) will be replaced`);
  } else {
    const since = last.createdAt.getTime() + HAND_EDIT_GRACE_MS;
    const edited = active.filter((row) => row.updatedAt.getTime() > since).length;
    const later = imports.filter((record) => record.createdAt > last.createdAt).length;
    if (edited > 0)
      warnings.push(
        `${edited} features were edited by hand since the last generation and will be replaced`
      );
    if (later > 0)
      warnings.push(
        `${later} map imports were applied since the last generation and will be replaced`
      );
  }
  if (survivorLinks > 0) {
    warnings.push(
      `${survivorLinks} nations that are not generated slots, or that a player holds, keep their country but lose their border`
    );
  }
  return warnings;
}

/** What replacing the ticked layers loses: the realm's current features in each. */
function chosenWarnings(chosen: readonly PhysicalLayer[], rows: readonly MapRow[]): string[] {
  return chosen.flatMap((layer) => {
    const active = rows.filter((row) => row.layerType === layer && row.isActive).length;
    return active > 0 ? [`The realm's ${active} ${layer} features will be replaced`] : [];
  });
}

const reservedWarning = (count: number) =>
  `${count} earlier ${count === 1 ? "nation has an old claim on file and is" : "nations have old claims on file and are"} kept as reserved, with no land`;

export async function diffWorld(
  db: PrismaClient,
  realm: ImportRealm,
  prepared: PreparedWorld,
  versions: { mapVersion: number; fittedMapVersion: number | null }
): Promise<WorldDiff> {
  const { bundle } = prepared;
  const preset = bundle.source === "preset";
  const [rows, countries] = await Promise.all([
    db.mapLayer.findMany({
      where: { realmId: realm.id },
      select: {
        layerType: true,
        featureId: true,
        isActive: true,
        countryId: true,
        updatedAt: true,
      },
    }),
    db.country.findMany({
      where: { realmId: realm.id },
      select: { id: true, name: true, worldgen: true, ownerUserId: true },
    }),
  ]);
  const retirable = preset ? await retirableSlots(db, realm.id) : [];
  const unlinked = preset || prepared.chosen ? [] : await unlinkedFeatures(db, realm.id);
  const retiredIds = new Set(retirable.map((slot) => slot.id));
  const survivors = countries.filter((country) => !retiredIds.has(country.id));
  // A regeneration closes the unowned generated slots it keeps: no territory is left for them
  const reservedIds = new Set(
    preset ? survivors.filter((c) => c.worldgen && !c.ownerUserId).map((country) => country.id) : []
  );
  const wanted = preset
    ? prepared.slots.map((planned) => planned.slot.name)
    : unlinked.map((n) => n.name);
  const names = dedupeNames(
    wanted,
    survivors.map((country) => country.name)
  );
  const renamed = names.filter((name, i) => name.toLowerCase() !== wanted[i]!.trim().toLowerCase());

  const warnings = [...prepared.warnings];
  const replaces: string[] = [];
  if (preset) {
    const links = rows.filter(
      (row) => row.layerType === "political" && row.isActive && row.countryId !== null
    );
    const kept = links.filter(
      (row) => !retiredIds.has(row.countryId!) && !reservedIds.has(row.countryId!)
    ).length;
    replaces.push(...(await replacedWarnings(db, realm.id, rows, kept)));
    if (reservedIds.size > 0) replaces.push(reservedWarning(reservedIds.size));
    warnings.push(...replaces);
    const empty = prepared.slots.filter((planned) => planned.slot.population === 0).length;
    if (empty > 0)
      warnings.push(`${empty} slots have no habitable land and start as token nations`);
  } else if (prepared.chosen) {
    replaces.push(...chosenWarnings(prepared.chosen, rows));
    warnings.push(
      ...replaces,
      "Land, borders and nations are not touched, and no nation is created"
    );
  } else {
    warnings.push(
      `The realm's borders are kept: ${unlinked.length} regions with no nation become claimable nations`
    );
  }
  if (renamed.length > 0) {
    warnings.push(`${renamed.length} names were already taken in this realm and got a number`);
  }

  return {
    ...versions,
    source: bundle.source,
    seed: bundle.seed,
    developmentLevel: bundle.params.developmentLevel,
    layers: Object.fromEntries(
      WORLD_BUNDLE_LAYERS.map((layer) => [layer, layerDiff(prepared, layer, rows)])
    ) as WorldDiff["layers"],
    kept: prepared.kept,
    chosen: prepared.chosen,
    slots: {
      create: wanted.length,
      retire: retirable.length,
      keep: survivors.filter((country) => country.worldgen).length - reservedIds.size,
      reserved: reservedIds.size,
      renamed: renamed.length,
    },
    warnings,
    replaces,
  };
}

/**
 * Whether a world fitted to the realm's map would write no feature and create no nation. A layer choice replaces
 * what the realm has, so it always has something to do.
 */
export const hasNothingToAdd = (diff: WorldDiff): boolean =>
  diff.chosen === null &&
  diff.slots.create === 0 &&
  Object.values(diff.layers).every(({ create, change }) => create === 0 && change === 0);
