import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { parseInWorldDate, type InWorldDate } from "~/lib/realms/realm-community";
import { readNationGrowthTable, type NationGrowthTable } from "~/lib/realms/nation-growth-defaults";

const RealmSettingsSchema = z.object({
  maxNationsPerUser: z.number().int().min(1).max(20).catch(1).default(1),
});

type RealmSettings = z.infer<typeof RealmSettingsSchema>;

/** Typed view of `Realm.settings`. Unknown keys are ignored; bad values fall back to defaults. */
export function realmSettings(settings: Prisma.JsonValue | null | undefined): RealmSettings {
  const parsed = RealmSettingsSchema.safeParse(settings ?? {});
  return parsed.success ? parsed.data : { maxNationsPerUser: 1 };
}

/** The stored settings object; a non-object becomes `{}`. */
function storedSettings(settings: Prisma.JsonValue | null | undefined): Prisma.JsonObject {
  return settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
}

/** `Realm.settings` with the nation cap set; every other stored key is kept (a non-object becomes `{}`). */
export function withMaxNationsPerUser(
  settings: Prisma.JsonValue | null | undefined,
  maxNationsPerUser: number
): Prisma.JsonObject {
  return { ...storedSettings(settings), maxNationsPerUser };
}

/** The realm's in-world date (`settings.inWorldDate`), or null when unset or malformed. */
export function realmInWorldDate(
  settings: Prisma.JsonValue | null | undefined
): InWorldDate | null {
  return parseInWorldDate(storedSettings(settings).inWorldDate);
}

/** `Realm.settings` with the in-world date set, or removed (`null`); every other stored key is kept. */
export function withInWorldDate(
  settings: Prisma.JsonValue | null | undefined,
  inWorldDate: InWorldDate | null
): Prisma.JsonObject {
  const { inWorldDate: _previous, ...rest } = storedSettings(settings);
  return inWorldDate ? { ...rest, inWorldDate } : rest;
}

/** The growth table the realm's new nations get (`settings.nationDefaults`), else IxStats's defaults. */
export function realmNationDefaults(
  settings: Prisma.JsonValue | null | undefined
): NationGrowthTable {
  return readNationGrowthTable(storedSettings(settings).nationDefaults);
}

/** Whether the realm stores its own growth table (otherwise it follows IxStats's defaults). */
export function hasNationDefaults(settings: Prisma.JsonValue | null | undefined): boolean {
  return storedSettings(settings).nationDefaults !== undefined;
}

/** `Realm.settings` with the growth table set, or removed (`null`: IxStats's defaults); other keys are kept. */
export function withNationDefaults(
  settings: Prisma.JsonValue | null | undefined,
  table: NationGrowthTable | null
): Prisma.JsonObject {
  const { nationDefaults: _previous, ...rest } = storedSettings(settings);
  return table ? { ...rest, nationDefaults: table } : rest;
}
