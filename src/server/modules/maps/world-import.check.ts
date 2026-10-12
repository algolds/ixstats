/**
 * A world's check (its dry run) is a diff against the realm's map as it was: it names the map version it read, and the
 * apply refuses when the map has moved since (an edit, an import, another world), whatever the world's source. The
 * version is read from the realm's row, not from the memoised copy the map readers use (that one may lag another
 * process by a few seconds).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { MapImportError } from "./map-import.realm";

export const MAP_CHANGED = "The map changed since the check. Check the world again.";

/** The realm's map version now. */
export async function currentMapVersion(
  db: Pick<PrismaClient, "realm">,
  realmId: string
): Promise<number> {
  const row = await db.realm.findUnique({ where: { id: realmId }, select: { mapVersion: true } });
  return row?.mapVersion ?? 0;
}

function checkedVersion(result: Prisma.JsonValue | null): number | null {
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const version = result.mapVersion;
  return typeof version === "number" ? version : null;
}

/**
 * Refuse (CONFLICT, nothing written) unless the realm's map is the version the check `result` read. A check that
 * recorded no version is as good as a stale one.
 */
export async function assertMapUnchangedSince(
  db: Pick<PrismaClient, "realm">,
  realmId: string,
  result: Prisma.JsonValue | null
): Promise<void> {
  const checked = checkedVersion(result);
  if (checked === null || checked !== (await currentMapVersion(db, realmId))) {
    throw new MapImportError("CONFLICT", MAP_CHANGED);
  }
}

/** The map version the browser fitted a world to, as `start` was given it (stored in the job's options). */
export function fittedMapVersionOf(options: Prisma.JsonValue | undefined): number | null {
  if (!options || typeof options !== "object" || Array.isArray(options)) return null;
  const version = options.fittedMapVersion;
  return typeof version === "number" ? version : null;
}

/**
 * A world fitted to the realm's own map (its land and borders) is only good for the map it was fitted to: refuse one
 * made for another version (CONFLICT, the same reason as a stale check), and one that does not say which.
 */
export function assertFittedToMap(fitted: number | null, current: number): void {
  if (fitted === null) {
    throw new MapImportError(
      "BAD_REQUEST",
      "A world fitted to the realm's map needs the map version it was fitted to"
    );
  }
  if (fitted !== current) throw new MapImportError("CONFLICT", MAP_CHANGED);
}

/** The finished check that an apply job was queued from. */
export async function loadCheck(
  db: Pick<PrismaClient, "mapImportJob">,
  job: { realmId: string; parentJobId?: string | null }
): Promise<Prisma.JsonValue | null> {
  if (!job.parentJobId) {
    throw new MapImportError("BAD_REQUEST", "A world is applied from its check");
  }
  const check = await db.mapImportJob.findUnique({
    where: { id: job.parentJobId },
    select: { realmId: true, kind: true, dryRun: true, result: true },
  });
  if (!check || check.realmId !== job.realmId || check.kind !== "world" || !check.dryRun) {
    throw new MapImportError("NOT_FOUND", "The check of this world was not found");
  }
  return check.result;
}

/** Where a map import came from, as its recorded summary says ("world", "pipeline", ...); null when it says nothing. */
export const summarySource = (summary: Prisma.JsonValue | null | undefined): string | null =>
  summary && typeof summary === "object" && !Array.isArray(summary) && "source" in summary
    ? String(summary.source)
    : null;
