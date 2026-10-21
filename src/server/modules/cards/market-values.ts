/**
 * The card-values cron (every 6 hours): the market median per card and finish from the last sales in the window,
 * then each card's reference value (`Card.marketValue`, a Standard copy at level 1) and a history row when it moved.
 * The admin's Revalue runs it too. Besides the admin's rarity edits, it is the only writer of `Card.marketValue`
 * after a card is created.
 */
import { Prisma, type CardFinish, type PrismaClient } from "@prisma/client";
import { nsBankValueSql } from "~/lib/cards/ns-bank-sql";
import { SALE_ACTIONS } from "~/lib/cards/transfer-events";
import { medianOf, readValuationConfig, type CardValuationConfig } from "~/lib/cards/valuation";

type Tx = Prisma.TransactionClient;

const DAY_MS = 86_400_000;
/** Arbitrary constant; identifies the revalue lock in pg_locks. */
const REVALUE_LOCK_NAMESPACE = 7336;
/** An update of every card can take seconds, past the interactive transaction's default 5 s. */
const REVALUE_TIMEOUT_MS = 60_000;

export interface SaleRow {
  cardId: string;
  finish: CardFinish;
  price: number;
}

export interface MarketValuesResult {
  /** Card and finish pairs with a market median. */
  prices: number;
  /** Cards whose reference value moved. */
  updated: number;
}

/**
 * The last `medianSales` priced sales of each card and finish within `medianDays`; the id breaks a tie between sales
 * at the same moment, so every run takes the same ones. Only cards that still exist: an event's `cardId` has no
 * foreign key, and a median for a gone card would fail the price rebuild on every run.
 */
function recentSales(tx: Tx, cfg: CardValuationConfig, now: Date): Promise<SaleRow[]> {
  const since = new Date(now.getTime() - cfg.medianDays * DAY_MS);
  return tx.$queryRaw<SaleRow[]>`
    SELECT "cardId", "finish", "price" FROM (
      SELECT e."cardId", e.finish, e.price,
        row_number() OVER (PARTITION BY e."cardId", e.finish ORDER BY e."createdAt" DESC, e.id DESC) AS rn
      FROM card_transfer_events e
      JOIN cards c ON c.id = e."cardId"
      WHERE e.action IN (${Prisma.join([...SALE_ACTIONS])})
        AND e.price IS NOT NULL AND e.finish IS NOT NULL
        AND e."createdAt" >= ${since}
    ) s
    WHERE rn <= ${cfg.medianSales}::int`;
}

export function mediansBySale(
  rows: readonly SaleRow[]
): Array<{ cardId: string; finish: CardFinish; median: number; sales: number }> {
  const groups = new Map<string, { cardId: string; finish: CardFinish; prices: number[] }>();
  for (const row of rows) {
    const key = `${row.cardId}:${row.finish}`;
    const group = groups.get(key) ?? { cardId: row.cardId, finish: row.finish, prices: [] };
    group.prices.push(Number(row.price));
    groups.set(key, group);
  }
  return [...groups.values()].flatMap(({ cardId, finish, prices }) => {
    const median = medianOf(prices);
    return median === null ? [] : [{ cardId, finish, median, sales: prices.length }];
  });
}

/**
 * Writes every card's reference value in one statement: the highest of floor × type, the Standard median and (NS
 * cards before their first sale) bank value × premium, rounded to the cent as `Math.round(n * 100) / 100` does. It
 * is `referenceValue` in valuation.ts in SQL, in float8 as JavaScript numbers are, so the two agree to the bit; the
 * tests in market-values.test.ts keep them in step. A retired card is revalued too, as it keeps its value for a
 * restore. Only cards whose value moved are written (and locked); returns them.
 */
function updateReferenceValues(tx: Tx, cfg: CardValuationConfig) {
  return tx.$queryRaw<Array<{ id: string; value: number }>>`
    UPDATE cards c SET "marketValue" = v.value, "updatedAt" = now()
    FROM (
      SELECT c2.id, FLOOR(GREATEST(
        (CASE c2.rarity::text
          WHEN 'LEGENDARY' THEN ${cfg.floorLegendary}::float8
          WHEN 'EPIC' THEN ${cfg.floorEpic}::float8
          WHEN 'ULTRA_RARE' THEN ${cfg.floorUltraRare}::float8
          WHEN 'RARE' THEN ${cfg.floorRare}::float8
          WHEN 'UNCOMMON' THEN ${cfg.floorUncommon}::float8
          ELSE ${cfg.floorCommon}::float8 END)
        * (CASE c2."cardType"::text
          WHEN 'SPECIAL' THEN ${cfg.multSpecial}::float8
          WHEN 'NATION' THEN ${cfg.multNation}::float8
          WHEN 'TROPHY' THEN ${cfg.multTrophy}::float8
          ELSE 1 END),
        COALESCE(p.median, 0),
        CASE WHEN c2."cardType"::text = 'NS' AND c2."firstSoldAt" IS NULL
          THEN COALESCE(${nsBankValueSql("c2")}, 0) * ${cfg.nsPremium}::float8
          ELSE 0 END
      ) * 100 + 0.5) / 100 AS value
      FROM cards c2
      LEFT JOIN card_market_prices p ON p."cardId" = c2.id AND p.finish = 'STANDARD'
    ) v
    WHERE v.id = c.id AND c."marketValue" IS DISTINCT FROM v.value
    RETURNING c.id, v.value`;
}

async function rebuildValuesTx(tx: Tx, now: Date): Promise<MarketValuesResult> {
  const cfg = await readValuationConfig(tx);
  const prices = mediansBySale(await recentSales(tx, cfg, now));
  await tx.cardMarketPrice.deleteMany({});
  await tx.cardMarketPrice.createMany({ data: prices.map((p) => ({ ...p, computedAt: now })) });
  const changed = await updateReferenceValues(tx, cfg);
  if (changed.length > 0) {
    await tx.cardValueHistory.createMany({
      data: changed.map((c) => ({ cardId: c.id, value: c.value, recordedAt: now })),
    });
  }
  return { prices: prices.length, updated: changed.length };
}

/**
 * Rebuilds the medians and every card's reference value. One runs at a time, in one transaction under the revalue
 * lock, and reads the config after taking it, past the cache: an admin save and the cron cannot interleave, and a
 * run never values cards under an older config.
 */
export function recomputeMarketValues(
  db: PrismaClient,
  now: Date = new Date()
): Promise<MarketValuesResult> {
  return db.$transaction(
    async (tx) => {
      // $executeRaw, not $queryRaw: Prisma cannot deserialize the void pg_advisory_xact_lock returns.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${REVALUE_LOCK_NAMESPACE}::int, 0)`;
      return rebuildValuesTx(tx, now);
    },
    { timeout: REVALUE_TIMEOUT_MS }
  );
}

/** The cron entry; loads the client lazily so the job table stays importable without Prisma. */
export async function runCardMarketValues(): Promise<MarketValuesResult> {
  const { db } = await import("~/server/db");
  return recomputeMarketValues(db);
}
