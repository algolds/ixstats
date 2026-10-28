/**
 * Abandoning a directive stops its effects at the current share (owner ruling 2026-10-28): whatever of its GDP level
 * shift has phased in by the time the abandon takes hold stays, and the remainder never lands. Level rows are never
 * edited (that would rewrite the projected past), so a counter row is appended: it takes hold the next IxTime day,
 * like every effect, and ramps over exactly what was left of the directive's phase-in, so the two together hold the
 * level reached that day. Abandoned the day it was committed, the directive leaves nothing applied.
 */
import type { Prisma } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import { nextIxDayStart } from "~/lib/ixtime/day";
import { levelPhaseIn } from "~/lib/economy/calculations";
import { createStorytellerEffects, LEVEL_EFFECT_TYPES } from "~/lib/economy/storyteller-effects";

type EffectDb = Pick<
  Prisma.TransactionClient,
  "storytellerEffect" | "country" | "realm" | "systemConfig"
>;

/** Appends the counter rows that hold each of the directive's still-ramping level effects where they are. */
export async function stopDirectiveEffectsAt(
  db: EffectDb,
  intent: { id: string; countryId: string },
  now: number
): Promise<number> {
  const rows = await db.storytellerEffect.findMany({
    where: { countryId: intent.countryId, createdBy: `intent:${intent.id}`, isActive: true },
    select: {
      inputType: true,
      value: true,
      duration: true,
      phaseYears: true,
      ixTimeTimestamp: true,
      description: true,
    },
  });
  const holdsFrom = nextIxDayStart(now);
  const counters = rows.flatMap((row) => {
    const years = row.phaseYears ?? row.duration;
    if (!LEVEL_EFFECT_TYPES.has(row.inputType.toLowerCase()) || !years || years <= 0) return [];
    const kept = levelPhaseIn(row, holdsFrom);
    if (kept >= 1) return [];
    const rampEnd = IxTime.addYears(nextIxDayStart(row.ixTimeTimestamp.getTime()), years);
    return [
      {
        countryId: intent.countryId,
        inputType: row.inputType,
        // (1 + value) * (1 + counter) = 1 + value * kept once both have phased in
        value: (1 + row.value * kept) / (1 + row.value) - 1,
        phaseYears: IxTime.getYearsElapsed(holdsFrom, rampEnd),
        description: `Abandoned: ${row.description ?? row.inputType}`,
        createdBy: `intent:${intent.id}`,
        ixTime: now,
      },
    ];
  });
  return createStorytellerEffects(db, counters);
}
