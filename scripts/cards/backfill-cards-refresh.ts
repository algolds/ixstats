// scripts/cards/backfill-cards-refresh.ts
/**
 * Cards refresh backfill (docs/specs/2026-10-15-cards-refresh-design.md §5.5 step 3). Run it with the app stopped,
 * after prisma/migrations/20261027120000_cards_foundations and before 20261027120001_cards_foundations_constraints:
 *
 *   bun scripts/cards/backfill-cards-refresh.ts            # dry run: prints the report, writes nothing
 *   bun scripts/cards/backfill-cards-refresh.ts --apply    # writes, in one transaction
 *
 * Idempotent: a second run plans nothing. Unknown card types or rarities, and copies held as quantity > 1 (the
 * constraint SQL drops quantity), fail the dry run (exit 1) and block --apply.
 * Raw SQL only: it runs on the in-between schema the Prisma models do not describe. Once the constraint SQL has
 * dropped the legacy columns, it only seeds missing realms (a fresh database, `db:bootstrap`), so every later deploy's
 * --apply is two small reads.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { RETIRED_NS_CATEGORY, SYSTEM_REALM_OWNER_ID } from "~/lib/cards/legacy-mapping";
import { getValuationConfig, rarityFloor } from "~/lib/cards/valuation";
import { runBackfill } from "./backfill-cards-refresh-plan";
import type {
  BackfillSnapshot,
  BackfillWriter,
  CardPatch,
  CopyPatch,
  Json,
  PackPatch,
  PlanOptions,
  PlanResult,
} from "./backfill-cards-refresh-types";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
const CHUNK = 5000;
const TRANSACTION = { timeout: 30 * 60_000, maxWait: 60_000 } as const;

type Tx = Prisma.TransactionClient;

const EMPTY: Omit<BackfillSnapshot, "realms"> = {
  cards: [],
  copies: [],
  packs: [],
  realmPages: [],
  countries: [],
  transfers: [],
  verifications: [],
  ledger: [],
  requestSuggestedRarities: [],
  requestNsImportCategories: 0,
  multiQuantityCopies: 0,
};

async function hasColumn(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = ${table} AND column_name = ${column}`;
  return (rows[0]?.n ?? 0) > 0;
}

async function loadSnapshot(): Promise<BackfillSnapshot> {
  if (!(await hasColumn("cards", "realmId"))) {
    throw new Error(
      "cards.realmId is missing: apply prisma/migrations/20261027120000_cards_foundations first."
    );
  }
  const realms = await prisma.$queryRaw<
    BackfillSnapshot["realms"]
  >`SELECT id, slug, "isSystem" FROM realms`;
  if (!(await hasColumn("cards", "stats"))) return { realms, ...EMPTY };
  const [
    cards,
    copies,
    packs,
    realmPages,
    countries,
    transfers,
    verifications,
    ledger,
    rarities,
    categories,
    multiQuantity,
  ] = await Promise.all([
    prisma.$queryRaw<BackfillSnapshot["cards"]>`
        SELECT id, "cardType"::text AS "cardType", rarity::text AS rarity, category::text AS category, title,
               "wikiSource", "wikiArticleTitle", "countryId", "lorewardEntryId", "nsCardId", "nsSeason", season,
               "realmId", "isBound", artwork, "artworkUrl", metadata, stats, "nsData", "createdAt"
        FROM cards`,
    prisma.$queryRaw<BackfillSnapshot["copies"]>`
        SELECT id, "cardId", "ownerId", "serialNumber", "acquiredAt", finish::text AS finish FROM "CardOwnership"`,
    prisma.$queryRaw<BackfillSnapshot["packs"]>`
        SELECT id, "cardType"::text AS "cardType", "themeFilter", "guaranteedRarity"::text AS "guaranteedRarity", season
        FROM "CardPack"`,
    prisma.$queryRaw<BackfillSnapshot["realmPages"]>`
        SELECT "realmId", "wikiSource", title, "importedAt" FROM realm_pages`,
    prisma.$queryRaw<BackfillSnapshot["countries"]>`
        SELECT id, "realmId" FROM "Country" WHERE id IN (SELECT "countryId" FROM cards WHERE "countryId" IS NOT NULL)`,
    prisma.$queryRaw<BackfillSnapshot["transfers"]>`
        SELECT e."ownershipId", e.action, e."fromUserId", e."createdAt"
        FROM card_transfer_events e
        JOIN "CardOwnership" o ON o.id = e."ownershipId"
        JOIN cards c ON c.id = o."cardId"
        WHERE c."nsCardId" IS NOT NULL`,
    prisma.$queryRaw<BackfillSnapshot["verifications"]>`
        SELECT "userId", "nationName" FROM ns_verifications WHERE verified`,
    prisma.$queryRaw<
      BackfillSnapshot["ledger"]
    >`SELECT "nsCardId", "nsSeason", nation FROM ns_import_ledger`,
    prisma.$queryRaw<Array<{ value: string }>>`
        SELECT DISTINCT "suggestedRarity"::text AS value FROM lore_card_requests WHERE "suggestedRarity" IS NOT NULL`,
    prisma.$queryRaw<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM lore_card_requests WHERE category::text = ${RETIRED_NS_CATEGORY}`,
    prisma.$queryRaw<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM "CardOwnership" WHERE quantity > 1`,
  ]);
  return {
    realms,
    cards,
    copies,
    packs,
    realmPages,
    countries,
    transfers,
    verifications,
    ledger,
    requestSuggestedRarities: rarities.map((row) => row.value),
    requestNsImportCategories: categories[0]?.n ?? 0,
    multiQuantityCopies: multiQuantity[0]?.n ?? 0,
  };
}

async function loadOptions(): Promise<PlanOptions> {
  const config = await getValuationConfig(prisma);
  return { nsPremium: config.nsPremium, floor: (rarity) => rarityFloor(config, rarity) };
}

/** One column a patch may set: its name, the SQL type its text casts to, and the patch's value (undefined: unset). */
interface Column<P> {
  name: string;
  cast: string;
  get: (patch: P) => Json | undefined;
}

const CARD_COLUMNS: Array<Column<CardPatch>> = [
  { name: "cardType", cast: "text", get: (patch) => patch.cardType },
  { name: "rarity", cast: "text", get: (patch) => patch.rarity },
  { name: "realmId", cast: "text", get: (patch) => patch.realmId },
  { name: "category", cast: '"LoreCategory"', get: (patch) => patch.category },
  { name: "isBound", cast: "boolean", get: (patch) => patch.isBound },
  { name: "metadata", cast: "jsonb", get: (patch) => patch.metadata },
  { name: "artwork", cast: "text", get: (patch) => patch.artwork },
  { name: "wikiArticleTitle", cast: "text", get: (patch) => patch.wikiArticleTitle },
];
const PACK_COLUMNS: Array<Column<PackPatch>> = [
  { name: "cardType", cast: "text", get: (patch) => patch.cardType },
  { name: "themeFilter", cast: "jsonb", get: (patch) => patch.themeFilter },
  { name: "guaranteedRarity", cast: "text", get: (patch) => patch.guaranteedRarity },
];
const COPY_COLUMNS: Array<Column<CopyPatch>> = [
  { name: "cardId", cast: "text", get: (patch) => patch.cardId },
  { name: "serialNumber", cast: "integer", get: (patch) => patch.serialNumber },
  { name: "finish", cast: '"CardFinish"', get: (patch) => patch.finish },
];

/** A value as the text the column's cast reads: JSON for jsonb (null is SQL NULL), the plain value otherwise. */
function asText(value: Json, cast: string): string | null {
  if (value === null) return null;
  return cast === "jsonb" || typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** Every patch that sets `column`, in chunks: `UPDATE t SET c = v.value::cast FROM unnest(ids, values)`. */
async function updateColumn<P extends { id: string }>(
  tx: Tx,
  table: string,
  column: Column<P>,
  patches: P[]
) {
  const rows = patches.flatMap((patch) => {
    const value = column.get(patch);
    return value === undefined ? [] : [{ id: patch.id, value: asText(value, column.cast) }];
  });
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await tx.$executeRawUnsafe(
      `UPDATE "${table}" AS t SET "${column.name}" = v.value::${column.cast}
       FROM unnest($1::text[], $2::text[]) AS v(id, value) WHERE t.id = v.id`,
      chunk.map((row) => row.id),
      chunk.map((row) => row.value)
    );
  }
}

function sqlWriter(tx: Tx): BackfillWriter {
  return {
    async insertRealms(rows) {
      for (const realm of rows) {
        await tx.$executeRaw`
          INSERT INTO realms (id, slug, name, description, "ownerId", status, visibility, "isSystem", "updatedAt")
          VALUES (${realm.id}, ${realm.slug}, ${realm.name}, ${realm.description}, ${SYSTEM_REALM_OWNER_ID},
                  'active', 'public', ${realm.isSystem}, now())
          ON CONFLICT (id) DO NOTHING`;
      }
    },
    async updateCards(patches) {
      for (const column of CARD_COLUMNS) await updateColumn(tx, "cards", column, patches);
    },
    async updatePacks(patches) {
      for (const column of PACK_COLUMNS) await updateColumn(tx, "CardPack", column, patches);
    },
    async updateCopies(patches) {
      for (const column of COPY_COLUMNS) await updateColumn(tx, "CardOwnership", column, patches);
    },
    async insertLedger(rows) {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        await tx.$executeRawUnsafe(
          `INSERT INTO ns_import_ledger (id, "nsCardId", "nsSeason", nation, "userId", "ownershipId")
           SELECT gen_random_uuid()::text, v.card, v.season, v.nation, v.owner, v.copy
           FROM unnest($1::int[], $2::int[], $3::text[], $4::text[], $5::text[]) AS v(card, season, nation, owner, copy)
           ON CONFLICT DO NOTHING`,
          chunk.map((row) => row.nsCardId),
          chunk.map((row) => row.nsSeason),
          chunk.map((row) => row.nation),
          chunk.map((row) => row.userId),
          chunk.map((row) => row.ownershipId)
        );
      }
    },
    async clearRequestCategories() {
      await tx.$executeRaw`
        UPDATE lore_card_requests SET category = NULL WHERE category::text = ${RETIRED_NS_CATEGORY}`;
    },
    /** Throws, rolling everything back, unless every loser copy has moved and exactly the losers are deleted. */
    async mergeCards({ survivorId, loserIds }) {
      const [left] = await tx.$queryRaw<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM "CardOwnership" WHERE "cardId" = ANY(${loserIds}::text[])`;
      if ((left?.n ?? 0) > 0) {
        throw new Error(
          `Merge onto ${survivorId}: ${left?.n} copies still point at ${loserIds.join(", ")}, and deleting the ` +
            "cards would cascade-delete them. Nothing was written; re-run the backfill."
        );
      }
      await tx.$executeRaw`UPDATE card_value_history SET "cardId" = ${survivorId} WHERE "cardId" = ANY(${loserIds}::text[])`;
      await tx.$executeRaw`
        DELETE FROM card_watchlist w WHERE w."cardId" = ANY(${loserIds}::text[]) AND EXISTS (
          SELECT 1 FROM card_watchlist s WHERE s."userId" = w."userId" AND s."cardId" = ${survivorId})`;
      await tx.$executeRaw`
        DELETE FROM card_watchlist w WHERE w."cardId" = ANY(${loserIds}::text[]) AND EXISTS (
          SELECT 1 FROM card_watchlist o
          WHERE o."userId" = w."userId" AND o."cardId" = ANY(${loserIds}::text[]) AND o.id < w.id)`;
      await tx.$executeRaw`UPDATE card_watchlist SET "cardId" = ${survivorId} WHERE "cardId" = ANY(${loserIds}::text[])`;
      await tx.$executeRaw`UPDATE lore_card_requests SET "cardId" = ${survivorId} WHERE "cardId" = ANY(${loserIds}::text[])`;
      const deleted = await tx.$executeRaw`DELETE FROM cards WHERE id = ANY(${loserIds}::text[])`;
      if (deleted !== loserIds.length) {
        throw new Error(
          `Merge onto ${survivorId}: deleted ${deleted} of ${loserIds.length} cards. Nothing was written; re-run the backfill.`
        );
      }
    },
  };
}

function printReport(result: PlanResult & { applied: boolean }) {
  console.log(JSON.stringify(result.report, null, 2));
  const plan = result.plan;
  console.log(
    `Plan: ${plan.realms.length} realms, ${plan.cards.length} cards, ${plan.packs.length} packs, ` +
      `${plan.copies.length} copies, ${plan.ledger.length} ledger rows, ${plan.merges.length} merges, ` +
      `request categories ${plan.clearRequestCategories ? "cleared" : "untouched"}.`
  );
  for (const error of result.errors) console.error(`✗ ${error}`);
  if (result.errors.length > 0)
    console.error("Dry run failed: nothing written. Fix the values above, then re-run.");
  else if (result.applied) console.log("Applied in one transaction.");
  else if (!APPLY) console.log("Dry run: nothing written. Re-run with --apply to write.");
  else console.log("Nothing to do: the backfill has already run.");
}

async function main() {
  const result = await runBackfill(
    {
      load: loadSnapshot,
      options: loadOptions,
      write: (apply) => prisma.$transaction((tx) => apply(sqlWriter(tx)), TRANSACTION),
    },
    APPLY
  );
  printReport(result);
  if (result.errors.length > 0) process.exitCode = 1;
}

main()
  .catch((error: Error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
