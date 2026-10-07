import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { parseInWorldDate, type InWorldDate } from "~/lib/realms/realm-community";

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
