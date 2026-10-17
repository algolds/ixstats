// scripts/cards/backfill-card-compliance.ts
/**
 * One-off: bring the cards from before the takedown queue into Compliance.
 *   1. Every NationStates takedown marker (`metadata.nsTakedown`) becomes a HIDDEN takedown, restorable from the flag.
 *   2. Every Lore card with art and no licence record gets one: UNKNOWN, or with --fetch the licence its wiki states
 *      (run --fetch on the production server: IIWiki answers only there). Each restricted one also gets a licence
 *      review takedown that hides its art, unless the card already has an active request.
 *
 *   bun scripts/cards/backfill-card-compliance.ts                    # dry run: prints the counts, writes nothing
 *   bun scripts/cards/backfill-card-compliance.ts --apply            # write the takedowns and UNKNOWN records
 *   bun scripts/cards/backfill-card-compliance.ts --apply --fetch    # write the licences the wikis state
 *
 * Idempotent: a card with a takedown or a licence record is skipped.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { parseCardWikiSource, type CardWikiSource } from "~/lib/cards/card-sources";
import { legacyTakedownRow, licenceBackfillRow } from "~/lib/cards/compliance-backfill";
import { captureArtLicence, wikiQueryFor } from "~/server/modules/cards/cards.art-licence";
import { fileLicenceTakedowns } from "~/server/modules/cards/cards.compliance";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const FETCH = process.argv.includes("--fetch");
const BATCH = 500;
/** One throttled client per wiki for the whole run. */
const FETCH_REQUEST_CAP = 10_000;

async function backfillTakedowns() {
  // Every hidden NS card was retired; a card a restore brought back has its marker cleared (legacyTakedownRow skips it)
  const cards = await db.card.findMany({
    where: { isRetired: true, takedowns: { none: {} } },
    select: { id: true, retiredAt: true, metadata: true },
  });
  const rows = cards.flatMap((card) => legacyTakedownRow(card) ?? []);
  console.log(`${rows.length} NationStates takedowns to bring into the queue.`);
  if (APPLY && rows.length > 0) await db.cardTakedown.createMany({ data: rows });
}

/** The licence the file's wiki states, over the UNKNOWN row; the row as it was when the wiki gives nothing. */
async function withFetchedLicence(
  row: Prisma.CardArtLicenceCreateManyInput,
  queries: Map<CardWikiSource, ReturnType<typeof wikiQueryFor>>
): Promise<Prisma.CardArtLicenceCreateManyInput> {
  const wiki = parseCardWikiSource(row.wiki);
  if (!wiki || !row.fileTitle) return row;
  const query = queries.get(wiki) ?? wikiQueryFor(wiki, FETCH_REQUEST_CAP);
  queries.set(wiki, query);
  const captured = await captureArtLicence(query, wiki, row.fileTitle).catch((error: Error) => {
    console.warn(`${row.cardId}: ${row.fileTitle} not checked (${error.message})`);
    return null;
  });
  if (!captured) return row;
  return {
    ...row,
    fileTitle: captured.fileTitle,
    descriptionUrl: captured.descriptionUrl,
    licence: captured.licence,
    licenceUrl: captured.licenceUrl,
    status: captured.status,
    artist: captured.artist,
    attribution: captured.attribution,
    note: "Checked when Compliance started",
  };
}

async function backfillLicences() {
  const cards = await db.card.findMany({
    where: { cardType: "LORE", artwork: { not: null }, artLicence: { is: null } },
    select: { id: true, wikiSource: true, artwork: true },
  });
  let rows = cards.flatMap((card) => licenceBackfillRow(card) ?? []);
  const unnamed = rows.filter((row) => !row.fileTitle).length;
  console.log(
    `${rows.length} Lore cards with art and no licence record (${unnamed} whose art names no wiki file).`
  );
  if (!APPLY) return;
  if (FETCH) {
    const queries = new Map<CardWikiSource, ReturnType<typeof wikiQueryFor>>();
    const fetched: Prisma.CardArtLicenceCreateManyInput[] = [];
    for (const row of rows) fetched.push(await withFetchedLicence(row, queries));
    rows = fetched;
  }
  for (let start = 0; start < rows.length; start += BATCH) {
    await db.cardArtLicence.createMany({
      data: rows.slice(start, start + BATCH),
      skipDuplicates: true,
    });
  }
  const restricted = rows.filter((row) => row.status === "RESTRICTED");
  console.log(`Licence records written; ${restricted.length} restricted.`);
  if (restricted.length === 0) return;
  const { filed, skipped } = await fileLicenceTakedowns(
    db,
    restricted.map((row) => ({ cardId: row.cardId, licence: row.licence ?? null }))
  );
  console.log(
    `${filed} restricted cards hidden by a licence review takedown; ${skipped} already had a request, listed in Compliance.`
  );
}

async function main() {
  await backfillTakedowns();
  await backfillLicences();
  if (!APPLY) console.log("Dry run: nothing written. Re-run with --apply.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
