/**
 * The realm side of a map import: who may import, the realm's nations to match regions against (its countries
 * and the nation pages of its roster), and its map settings (georeference, planet radius).
 */
import type { PrismaClient } from "@prisma/client";
import type { NationCandidate } from "~/lib/maps/import/nation-names";
import {
  readRealmMapSettings,
  withRealmMapSettings,
  type MapGeoreference,
  type RealmMapSettings,
} from "~/lib/maps/realm-map-settings";
import type { RealmActor } from "~/server/modules/realms/realms.access";
import { canImportRealmMap } from "./map-import.access";

export type MapImportErrorCode = "NOT_FOUND" | "FORBIDDEN" | "BAD_REQUEST" | "CONFLICT";

export class MapImportError extends Error {
  constructor(
    public readonly code: MapImportErrorCode,
    message: string
  ) {
    super(message);
    this.name = "MapImportError";
  }
}

export interface ImportRealm {
  id: string;
  slug: string;
  name: string;
  ownerId: string;
  settings: unknown;
}

export async function findImportRealm(
  db: Pick<PrismaClient, "realm">,
  realmId: string
): Promise<ImportRealm> {
  const realm = await db.realm.findUnique({
    where: { id: realmId },
    select: { id: true, slug: true, name: true, ownerId: true, settings: true },
  });
  if (!realm) throw new MapImportError("NOT_FOUND", "Realm not found");
  return realm;
}

/** The realm, when `actor` may import its map; NOT_FOUND or FORBIDDEN otherwise. */
export async function loadImportRealm(
  db: Pick<PrismaClient, "realm">,
  actor: RealmActor,
  realmId: string
): Promise<ImportRealm> {
  const realm = await findImportRealm(db, realmId);
  if (!canImportRealmMap(actor, realm)) {
    throw new MapImportError("FORBIDDEN", "Only site admins and the realm's founder import its map");
  }
  return realm;
}

export interface RealmCountry {
  id: string;
  name: string;
  landArea: number | null;
}

/** The realm's countries and roster nation pages: what an imported region may be matched to. */
export async function realmNations(
  db: Pick<PrismaClient, "country" | "realmPage">,
  realmId: string
): Promise<{ countries: RealmCountry[]; candidates: NationCandidate[] }> {
  const [countries, pages] = await Promise.all([
    db.country.findMany({
      where: { realmId },
      select: { id: true, name: true, landArea: true },
      orderBy: { name: "asc" },
    }),
    db.realmPage.findMany({ where: { realmId, kind: "nation" }, select: { title: true } }),
  ]);
  const names = new Set(countries.map((c) => c.name));
  return {
    countries,
    candidates: [
      ...countries.map((c) => ({ name: c.name, countryId: c.id })),
      ...pages.filter((p) => !names.has(p.title)).map((p) => ({ name: p.title })),
    ],
  };
}

export const realmMapSettings = (realm: ImportRealm): RealmMapSettings => readRealmMapSettings(realm.settings);

/** Save a georeference as the realm's (Realm.settings.map); other settings keys are kept. */
export async function saveRealmGeoreference(
  db: Pick<PrismaClient, "realm">,
  realm: ImportRealm,
  georef: MapGeoreference
): Promise<void> {
  const settings = withRealmMapSettings(realm.settings, {
    projection: georef.projection ?? null,
    bounds: georef.bounds ?? null,
    controlPoints: georef.controlPoints ?? null,
  });
  await db.realm.update({ where: { id: realm.id }, data: { settings: settings as object } });
}
