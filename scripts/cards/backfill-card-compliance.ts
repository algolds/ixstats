// scripts/cards/backfill-card-compliance.ts
/**
 * One-off: bring the cards from before the takedown queue into Compliance.
 *   1. Every NationStates takedown marker (`metadata.nsTakedown`) becomes a HIDDEN takedown, restorable from the flag.
 *   2. Every Lore card with art and no licence record gets one: UNKNOWN, or with --fetch the licence its wiki states
 *      (run --fetch on the production server: IIWiki answers only there). With --fetch, a card its wiki did not
 *      answer for gets no record, so a re-run reads it.
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
import {
  cardSourceLabel,
  parseCardWikiSource,
  type CardWikiSource,
} from "~/lib/cards/card-sources";
import { legacyTakedownRow, licenceBackfillRow } from "~/lib/cards/compliance-backfill";
import type { WikiQuery } from "~/lib/realms/lore-import";
import {
  createDiscoveryClient,
  DiscoveryStopped,
  type DiscoveryStopKind,
} from "~/lib/realms/sources/wiki-discovery-client";
import { captureArtLicence, type CapturedLicence } from "~/server/modules/cards/cards.art-licence";
import {
  fileLicenceTakedowns,
  type LicenceTakedownReport,
} from "~/server/modules/cards/cards.compliance";

const BATCH = 500;
/** One throttled client per wiki, replaced after a read it gave up on; this cap is far above a run's reads. */
const FETCH_REQUEST_CAP = 10_000;
/** The stops that lose only the read in hand (an HTTP error, a timeout), as in the import runner. */
const READ_STOPS: ReadonlySet<DiscoveryStopKind> = new Set(["error", "unreachable"]);
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

type LicenceRow = Prisma.CardArtLicenceCreateManyInput;

/** A fresh client's query. Its first request waits too: it may replace a client whose last request just failed. */
const freshWikiQuery = (wiki: CardWikiSource): WikiQuery =>
  createDiscoveryClient(wiki, { maxRequests: FETCH_REQUEST_CAP, pauseFirst: true }).query;

/** The licence the file's wiki states, over the UNKNOWN row; the row as it was when the wiki has no such file. */
function withCapturedLicence(row: LicenceRow, captured: CapturedLicence | null): LicenceRow {
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

interface FetchedLicences {
  rows: LicenceRow[];
  /** Per wiki, the cards whose licence was not read. They get no row, so a re-run reads them. */
  unread: Map<CardWikiSource, number>;
}

/**
 * Each row checked on its file's wiki, one client per wiki, as the import runner reads. A read the client gave up on
 * (an HTTP error, a timeout) leaves that card unread, and the next card gets a fresh client. A wiki that refuses,
 * rate-limits or reaches the cap is read no more in this run. A row that names no wiki file is kept, unchecked.
 */
async function fetchLicenceRows(rows: LicenceRow[]): Promise<FetchedLicences> {
  const queries = new Map<CardWikiSource, WikiQuery>();
  const parked = new Set<CardWikiSource>();
  const fetched: FetchedLicences = { rows: [], unread: new Map() };
  const leaveUnread = (wiki: CardWikiSource) =>
    fetched.unread.set(wiki, (fetched.unread.get(wiki) ?? 0) + 1);
  for (const row of rows) {
    const wiki = parseCardWikiSource(row.wiki);
    if (!wiki || !row.fileTitle) {
      fetched.rows.push(row);
      continue;
    }
    if (parked.has(wiki)) {
      leaveUnread(wiki);
      continue;
    }
    const query = queries.get(wiki) ?? freshWikiQuery(wiki);
    queries.set(wiki, query);
    try {
      fetched.rows.push(
        withCapturedLicence(row, await captureArtLicence(query, wiki, row.fileTitle))
      );
    } catch (error) {
      leaveUnread(wiki);
      console.warn(`${row.cardId}: ${row.fileTitle} not checked (${String(error)})`);
      if (!(error instanceof DiscoveryStopped)) continue;
      queries.delete(wiki);
      if (!READ_STOPS.has(error.stop.kind)) parked.add(wiki);
    }
  }
  return fetched;
}

/** Step 2: a licence record for every Lore card with art and none; checked on its wiki with `fetchLicences`. */
export async function backfillLicences(db: PrismaClient, apply: boolean, fetchLicences: boolean) {
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
    const fetched = await fetchLicenceRows(rows);
    rows = fetched.rows;
    for (const [wiki, count] of fetched.unread) {
      console.log(
        `${count} ${cardSourceLabel(wiki)} cards not checked, so not recorded. Re-run --apply --fetch to read them.`
      );
    }
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
