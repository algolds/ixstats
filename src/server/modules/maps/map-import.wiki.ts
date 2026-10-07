/**
 * "Import this map": the world map chosen from the realm's wiki ("Use this map") fetched in its original size and
 * queued for analysis, with the realm's stored credit line and georeference. The wiki refuses (CONFLICT) when its
 * file changed since it was chosen.
 */
import type { PrismaClient } from "@prisma/client";
import { parseRealmMapSettings } from "~/lib/maps/realm-map-settings";
import type { RealmActor } from "~/server/modules/realms/realms.access";
import {
  fetchChosenWikiMapOriginal,
  RealmWikiError,
  type RealmWikiDeps,
} from "~/server/modules/realms/realms.wiki";
import { startMapImport, type MapImportDeps } from "./map-import.jobs";
import { importGeoreference } from "./map-import.apply";
import { loadImportRealm, MapImportError } from "./map-import.realm";

export async function startWikiMapImport(
  db: PrismaClient,
  actor: RealmActor,
  realmId: string,
  deps: MapImportDeps & { wiki?: RealmWikiDeps } = {}
): Promise<{ jobId: string; filename: string }> {
  const realm = await loadImportRealm(db, actor, realmId);
  let original: Awaited<ReturnType<typeof fetchChosenWikiMapOriginal>>;
  try {
    original = await fetchChosenWikiMapOriginal(db, realm.id, deps.wiki);
  } catch (error) {
    if (error instanceof RealmWikiError) throw new MapImportError(error.code, error.message);
    throw error;
  }
  const settings = parseRealmMapSettings(realm.settings);
  const georef = importGeoreference(realm, undefined);
  const jobId = await startMapImport(
    {
      realmId: realm.id,
      source: {
        kind: original.mime === "image/svg+xml" ? "svg" : "png",
        bytes: new Uint8Array(original.buffer),
        filename: original.filename,
      },
      options: {
        attribution: settings.attribution ?? original.attribution,
        ...(georef.projection || georef.bounds || georef.controlPoints ? { georef } : {}),
      },
      requestedBy: actor.clerkUserId,
    },
    { ...deps, db }
  );
  return { jobId, filename: original.filename };
}
