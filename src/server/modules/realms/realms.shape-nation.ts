/**
 * A nation from an unlinked political shape on a realm's map: site admins anywhere, the realm's founder and map
 * officers in their own realm (realmMapAccess; Ixnay stays with site admins, an archived realm is read-only). It is
 * built like a generated world's slot (the realm's nation defaults, a free slug), linked to the shape, and recorded
 * in AdminAuditLog so site admins see every nation realm staff create.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { buildBaselineCountryData } from "~/lib/countries/baseline-country";
import type { RealmActor } from "./realms.access";
import { freeNationSlug } from "./realms.claims";
import { realmMapAccess } from "./realms.map-access";
import { RealmRegionError } from "./realms.region";
import { realmNationDefaults } from "./realms.settings";

export const SHAPE_NATION_ACTION = "REALM_NATION_FROM_SHAPE";

const asInput = (value: Prisma.JsonValue | null) => (value ?? undefined) as Prisma.InputJsonValue;

export async function createNationFromShape(
  db: PrismaClient,
  actor: RealmActor,
  realmId: string,
  input: { featureId: string; name: string }
): Promise<{ countryId: string; name: string }> {
  const access = await realmMapAccess(db, actor, realmId);
  if (!access.canEdit) {
    throw new RealmRegionError("FORBIDDEN", access.reason ?? "You can't edit this map");
  }
  const realm = await db.realm.findUnique({
    where: { id: realmId },
    select: { id: true, slug: true, name: true, settings: true },
  });
  if (!realm) throw new RealmRegionError("NOT_FOUND", "Realm not found");
  const feature = await db.mapLayer.findFirst({
    where: { layerType: "political", featureId: input.featureId, isActive: true, realmId },
  });
  if (!feature) throw new RealmRegionError("NOT_FOUND", "Feature not found");
  if (feature.countryId) {
    throw new RealmRegionError("BAD_REQUEST", "Feature already linked to a country");
  }
  const name = input.name.trim();
  if (!name) throw new RealmRegionError("BAD_REQUEST", "Name the nation");
  if (await db.country.findFirst({ where: { realmId, name }, select: { id: true } })) {
    throw new RealmRegionError("CONFLICT", `${realm.name} already has a nation called ${name}`);
  }

  return db.$transaction(async (tx) => {
    const slug = await freeNationSlug(tx, { title: name, realmSlug: realm.slug });
    const area = feature.areaSqKm ?? undefined;
    const country = await tx.country.create({
      data: {
        ...buildBaselineCountryData(
          name,
          { landArea: area },
          realmNationDefaults(realm.settings as Prisma.JsonValue)
        ),
        slug,
        realmId,
        geometry: asInput(feature.geometry),
        centroid: asInput(feature.centroid),
        boundingBox: asInput(feature.boundingBox),
        ...(area && { areaSqMi: area * 0.386102 }),
      },
      select: { id: true, name: true },
    });
    await tx.mapLayer.update({ where: { id: feature.id }, data: { countryId: country.id } });
    await tx.adminAuditLog.create({
      data: {
        action: SHAPE_NATION_ACTION,
        targetType: "realm",
        targetId: realm.id,
        targetName: realm.name,
        changes: JSON.stringify({
          countryId: country.id,
          name,
          slug,
          featureId: feature.featureId,
        }),
        adminId: actor.id,
        adminName: actor.clerkUserId,
      },
    });
    return { countryId: country.id, name: country.name };
  });
}
