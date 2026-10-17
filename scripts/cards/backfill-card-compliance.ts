// scripts/cards/backfill-card-compliance.ts
/**
 * One-off: bring the cards from before the takedown queue into Compliance.
 *   1. Every NationStates takedown marker (`metadata.nsTakedown`) becomes a HIDDEN takedown, restorable from the flag.
 *   2. Every Lore card with art and no licence record gets one: UNKNOWN, or with --fetch the licence its wiki states
 *      (run --fetch on the production server: IIWiki answers only there).
 *   3. Every restricted licence whose art still shows, and whose card has no active request, gets a licence review
 *      takedown that hides the art. This step reads the database, so a re-run finishes what an earlier run left.
 *
 *   bun scripts/cards/backfill-card-compliance.ts                    # dry run: prints the counts, writes nothing
 *   bun scripts/cards/backfill-card-compliance.ts --apply            # write the takedowns and UNKNOWN records
 *   bun scripts/cards/backfill-card-compliance.ts --apply --fetch    # write the licences the wikis state
 *
 * Idempotent: a card with an active takedown or a licence record is skipped.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { parseCardWikiSource, type CardWikiSource } from "~/lib/cards/card-sources";
import { legacyTakedownRow, licenceBackfillRow } from "~/lib/cards/compliance-backfill";
import { captureArtLicence, wikiQueryFor } from "~/server/modules/cards/cards.art-licence";
import {
  fileLicenceTakedowns,
  type LicenceTakedownReport,
} from "~/server/modules/cards/cards.compliance";

const BATCH = 500;
/** One throttled client per wiki for the whole run. */
const FETCH_REQUEST_CAP = 10_000;
/** A request that is waiting or hiding the art; a declined or restored one leaves the card to these steps. */
const ACTIVE_REQUEST = {
  status: { in: ["OPEN", "HIDDEN"] },
} satisfies Prisma.CardTakedownWhereInput;

/** Step 1: the takedown rows for old markers; written with `apply`. Returns how many there are. */
export async function backfillTakedowns(db: PrismaClient, apply: boolean): Promise<number> {
  // Every hidden NS card was retired; a card a restore brought back has its marker cleared (legacyTakedownRow skips it)
  const cards = await db.card.findMany({
    where: { isRetired: true, takedowns: { none: ACTIVE_REQUEST } },
    select: { id: true, retiredAt: true, metadata: true },
  });
  const rows = cards.flatMap((card) => legacyTakedownRow(card) ?? []);
  // These HIDDEN rows are written without the card takedown lock (7335) every app hide takes, which the Library edit
  // relies on. That is safe for this one-off runbook step: the cards are already hidden and artless.
  if (apply && rows.length > 0) await db.cardTakedown.createMany({ data: rows });
  return rows.length;
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

/** Step 2: a licence record for every Lore card with art and none; checked on its wiki with `fetchLicences`. */
async function backfillLicences(db: PrismaClient, apply: boolean, fetchLicences: boolean) {
  const cards = await db.card.findMany({
    where: { cardType: "LORE", artwork: { not: null }, artLicence: { is: null } },
    select: { id: true, wikiSource: true, artwork: true },
  });
  let rows = cards.flatMap((card) => licenceBackfillRow(card) ?? []);
  const unnamed = rows.filter((row) => !row.fileTitle).length;
  console.log(
    `${rows.length} Lore cards with art and no licence record (${unnamed} whose art names no wiki file).`
  );
  if (!apply) return;
  if (fetchLicences) {
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
  const restricted = rows.filter((row) => row.status === "RESTRICTED").length;
  console.log(`Licence records written; ${restricted} restricted.`);
}

/** Restricted licences whose art still shows, on cards no request is waiting on or hiding. */
const RESTRICTED_ART_SHOWING = {
  status: "RESTRICTED",
  card: { artwork: { not: null }, takedowns: { none: ACTIVE_REQUEST } },
} satisfies Prisma.CardArtLicenceWhereInput;

/**
 * Step 3: hide every restricted art that still shows, read from the database and paged by card id. Without `apply`,
 * only counts them.
 */
export async function hideRestrictedArt(
  db: PrismaClient,
  apply: boolean,
  pageSize = BATCH
): Promise<LicenceTakedownReport & { pending: number }> {
  const report: LicenceTakedownReport & { pending: number } = {
    pending: 0,
    filed: 0,
    skipped: 0,
    failed: [],
  };
  if (!apply) {
    report.pending = await db.cardArtLicence.count({ where: RESTRICTED_ART_SHOWING });
    return report;
  }
  let last = "";
  for (;;) {
    const page = await db.cardArtLicence.findMany({
      where: { ...RESTRICTED_ART_SHOWING, cardId: { gt: last } },
      orderBy: { cardId: "asc" },
      take: pageSize,
      select: { cardId: true, licence: true },
    });
    report.pending += page.length;
    const result = await fileLicenceTakedowns(db, page);
    report.filed += result.filed;
    report.skipped += result.skipped;
    report.failed.push(...result.failed);
    if (page.length < pageSize) return report;
    last = page[page.length - 1]!.cardId;
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const db = new PrismaClient();
  try {
    const takedowns = await backfillTakedowns(db, apply);
    console.log(`${takedowns} NationStates takedowns to bring into the queue.`);
    await backfillLicences(db, apply, process.argv.includes("--fetch"));
    const hidden = await hideRestrictedArt(db, apply);
    console.log(
      apply
        ? `${hidden.filed} restricted cards hidden by a licence review takedown; ${hidden.skipped} already had a request.`
        : `${hidden.pending} restricted cards whose art still shows, to hide.`
    );
    for (const { cardId, reason } of hidden.failed) {
      console.error(`${cardId}: not hidden (${reason}). Re-run to try again.`);
    }
    if (!apply) console.log("Dry run: nothing written. Re-run with --apply.");
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
