import type { Prisma } from "@prisma/client";
import { z } from "zod";

const RealmSettingsSchema = z.object({
  maxNationsPerUser: z.number().int().min(1).max(20).catch(1).default(1),
});

export type RealmSettings = z.infer<typeof RealmSettingsSchema>;

/** Typed view of `Realm.settings`. Unknown keys are ignored; bad values fall back to defaults. */
export function realmSettings(settings: Prisma.JsonValue | null | undefined): RealmSettings {
  const parsed = RealmSettingsSchema.safeParse(settings ?? {});
  return parsed.success ? parsed.data : { maxNationsPerUser: 1 };
}

/** `Realm.settings` with the nation cap set; every other stored key is kept (a non-object becomes `{}`). */
export function withMaxNationsPerUser(
  settings: Prisma.JsonValue | null | undefined,
  maxNationsPerUser: number
): Prisma.JsonObject {
  const stored =
    settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  return { ...stored, maxNationsPerUser };
}
