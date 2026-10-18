import { Prisma, type PrismaClient } from "@prisma/client";
import { getEconomyConfig } from "~/lib/cards/economy-config";
import { CARD_LEVEL_CAP, XP_PER_LEVEL } from "~/lib/cards/levels";
import { utcDay } from "~/lib/vault/vault-dividend";
import { readConfigKeys } from "~/server/shared/config-kv";

/** SystemConfig key: the last UTC day the tick ran, so a re-run that day (or for an earlier one) adds nothing. */
const TICK_DAY_KEY = "cards_holding_tick_day";
const TICK_DAY_DESCRIPTION = "Last UTC day the card holding XP tick ran";
const DAY_MS = 86_400_000;

/**
 * Once per UTC day, every copy of a card still in circulation (not retired) held for a day or more gains the holding
 * tick, inside its daily XP cap. One set-based statement claims the day and ticks the copies, so a crash or a second
 * run can never tick a day twice; a run that finds the day claimed, before or during its statement, is skipped. The
 * grant is worked out from the row being updated, so a grant that lands on a copy while the tick runs still counts
 * against its cap. No event rows: there would be one per copy every day.
 */
export async function runHoldingXpTick(
  db: PrismaClient,
  now: Date = new Date()
): Promise<{ day: string; copies: number; skipped: boolean }> {
  const day = utcDay(now);
  const stored = (await readConfigKeys(db, [TICK_DAY_KEY]))[TICK_DAY_KEY];
  if (stored !== undefined && stored >= day) return { day, copies: 0, skipped: true };

  const cfg = await getEconomyConfig(db);
  const heldSince = new Date(now.getTime() - DAY_MS);
  const today = Prisma.sql`(CASE WHEN o."xpDay" = ${day}::date THEN o."xpToday" ELSE 0 END)`;
  const grant = Prisma.sql`LEAST(${cfg.xpHoldingTick}::int, ${cfg.xpDailyCapPerCopy}::int - ${today})`;
  const [ran] = await db.$queryRaw<Array<{ claimed: boolean; copies: number }>>`
    WITH claim AS (
      INSERT INTO "SystemConfig" ("id", "key", "value", "description", "updatedAt")
      VALUES (gen_random_uuid()::text, ${TICK_DAY_KEY}, ${day}, ${TICK_DAY_DESCRIPTION}, now())
      ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()
        WHERE "SystemConfig"."value" < EXCLUDED."value"
      RETURNING 1
    ), ticked AS (
      UPDATE "CardOwnership" o SET
        "experience" = o."experience" + ${grant},
        "level" = LEAST(${CARD_LEVEL_CAP}::int, (o."experience" + ${grant}) / ${XP_PER_LEVEL}::int + 1),
        "xpToday" = ${today} + ${grant},
        "xpDay" = ${day}::date
      FROM "cards" c
      WHERE EXISTS (SELECT 1 FROM claim)
        AND c."id" = o."cardId" AND NOT c."isRetired"
        AND o."acquiredAt" <= ${heldSince}
        AND ${grant} > 0
      RETURNING 1
    )
    SELECT EXISTS (SELECT 1 FROM claim) AS claimed, (SELECT count(*) FROM ticked)::int AS copies`;
  if (!ran?.claimed) return { day, copies: 0, skipped: true };
  return { day, copies: ran.copies, skipped: false };
}
