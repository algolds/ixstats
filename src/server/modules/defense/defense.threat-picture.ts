/**
 * The derived threat picture on the defense model: every nation's combat power from `nationalCombatPower` (synced on
 * its own realm clock; NPCs get their forces from their economy on first touch), foreign-policy expiry against the
 * nation's realm clock.
 */
import type { PrismaClient } from "@prisma/client";
import { loadThreatPicture } from "~/lib/military/threat-picture-loader";
import type { ThreatPicture } from "~/lib/military/threat-picture";
import { clockForCountry } from "~/server/shared/realm-time";
import { nationalCombatPower } from "./defense.sync";

export async function threatPictureFor(db: PrismaClient, countryId: string): Promise<ThreatPicture> {
  const clock = await clockForCountry(db, countryId);
  return loadThreatPicture(db, countryId, {
    readStrengths: (ids) => nationalCombatPower(db, ids),
    nowClockMs: clock.now(),
  });
}
