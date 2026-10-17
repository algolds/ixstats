/**
 * Stage one card from a wiki (cards refresh spec §2.1, §2.4): the page becomes a Lore card in its home realm,
 * PENDING review, with its art's licence recorded (licensing drafts §2.5(b)). Art licensed non-commercial or
 * no-derivatives blocks it; a page with a card, or a realm's nation page, is skipped. Every outcome is a value, so
 * one bad page never stops an import job. Two things are thrown: DiscoveryStopped, when a wiki stops answering the
 * article or licence reads (so the job runner can stop the job), and a database failure.
 */
import { Prisma, type CardRarity, type CardReviewState, type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { isUniqueViolation } from "~/lib/prisma-error";
import type { WikiQuery } from "~/lib/realms/lore-import";
import { DiscoveryStopped } from "~/lib/realms/sources/wiki-discovery-client";
import { titleKey } from "~/lib/wiki-os/core/title";
import { commonsCardTitle } from "~/lib/cards/art-licence";
import {
  canonicalCardTitle,
  cardSourceLabel,
  type CardArticleSource,
  type CardWikiSource,
} from "~/lib/cards/card-sources";
import { classifyLoreArticle } from "~/lib/cards/category-classifier";
import { articleHomePage } from "~/lib/cards/home-realm";
import { wikiFallbackRealm } from "~/lib/cards/legacy-mapping";
import { ArticleRejected, type LoreCardCandidate } from "~/lib/cards/lore-card-candidate";
import { wikiLoreCardGenerator } from "~/lib/cards/lore-card-generator";
import { rarityForScore, type RarityThresholds } from "~/lib/cards/rarity-engine";
import { getCurrentIxCardSeason } from "~/lib/cards/season";
import { computeCardValue, getValuationConfig } from "~/lib/cards/valuation";
import type { CardAuthorInfo } from "~/types/cards-display";
import { captureArtLicence, wikiQueryFor, type CapturedLicence } from "./cards.art-licence";
import { getRarityThresholds } from "./cards.config";

export interface ImportContext {
  /** Licence reads for the source: one throttled client per import run. */
  query: WikiQuery;
  /** The source's rarity table. */
  thresholds: RarityThresholds;
}

export interface StageInput {
  title: string;
  /** DB user id of the admin; null for the daily cron. */
  requestedBy: string | null;
  jobId: string | null;
  requireImage?: boolean;
  /** Accepting a suggestion may skip the length gate, never the licence gate. */
  bypassLengthGate?: boolean;
  /** PENDING unless the admin approves in the same act (accepting a suggestion). */
  reviewState?: CardReviewState;
}

export type StageOutcome =
  | { status: "STAGED"; cardId: string; rarity: CardRarity; licence: string | null }
  | { status: "SKIPPED" | "BLOCKED" | "FAILED"; reason: string };

const ALREADY_CARDED: StageOutcome = { status: "SKIPPED", reason: "Already a card" };

/**
 * A context for staging pages outside a job (a procedure, an accepted suggestion, the daily cron), with the
 * source's stored rarity table. `maxRequests` caps its licence reads (wikiQueryFor's default when omitted).
 */
export async function oneOffImportContext(
  db: PrismaClient,
  source: CardWikiSource,
  maxRequests?: number
): Promise<ImportContext> {
  return {
    query: wikiQueryFor(source, maxRequests),
    thresholds: (await getRarityThresholds(db))[source],
  };
}

/**
 * The keys among `titles` that already have a Lore card from `source` (the natural key). Each key is
 * `titleKey(title, source)`, which is what callers compare with.
 */
export async function cardedTitleKeys(
  db: PrismaClient,
  source: CardWikiSource,
  titles: readonly string[]
): Promise<Set<string>> {
  const keys = [...new Set(titles.map((title) => titleKey(title, source)))];
  if (keys.length === 0) return new Set();
  const rows = await db.$queryRaw<Array<{ key: string }>>`
    SELECT lower("wikiArticleTitle") AS "key" FROM "cards"
    WHERE COALESCE("wikiSource", 'ixwiki') = ${source} AND "cardType" = 'LORE'
      AND lower("wikiArticleTitle") IN (${Prisma.join(keys)})`;
  return new Set(rows.map((row) => row.key));
}

/** The realm that imported the page first (its home), else the source's system realm. */
export async function resolveImportRealm(
  db: PrismaClient,
  source: CardWikiSource,
  title: string
): Promise<{ realmId: string; nationPage: boolean }> {
  const page = source === "commons" ? null : await articleHomePage(db, source, title);
  if (page) return { realmId: page.realmId, nationPage: page.kind === "nation" };
  return { realmId: wikiFallbackRealm(source), nationPage: false };
}

/** Author info as stored JSON (no undefined values). */
function authorJson(info: CardAuthorInfo): Prisma.InputJsonObject {
  return {
    creator: info.creator,
    displayAuthor: info.displayAuthor,
    createdAt: info.createdAt ?? null,
    primaryContributor: info.primaryContributor ?? null,
    contributorCount: info.contributorCount ?? null,
    isBotFiltered: info.isBotFiltered ?? false,
  };
}

function blocked(licence: CapturedLicence): StageOutcome {
  return {
    status: "BLOCKED",
    reason: `Its art is licensed ${licence.licence ?? "restrictively"}, which does not allow commercial use or changes`,
  };
}

/** The review an import records: PENDING, or APPROVED by the admin importing it. */
function reviewOf(
  input: StageInput
): Pick<Prisma.CardUncheckedCreateInput, "reviewState" | "reviewedAt" | "reviewedBy"> {
  const reviewState = input.reviewState ?? "PENDING";
  if (reviewState === "PENDING") return { reviewState };
  return { reviewState, reviewedAt: new Date(), reviewedBy: input.requestedBy };
}

function licenceRecord(
  source: CardWikiSource,
  artwork: string,
  licence: CapturedLicence | null,
  input: StageInput
): Prisma.CardArtLicenceUncheckedCreateWithoutCardInput {
  const imported = { wiki: source, importedBy: input.requestedBy, importJobId: input.jobId };
  if (!licence) {
    return {
      ...imported,
      fileUrl: artwork,
      status: "UNKNOWN",
      note: "No file page found for the art",
    };
  }
  return {
    ...imported,
    fileTitle: licence.fileTitle,
    fileUrl: licence.fileUrl,
    descriptionUrl: licence.descriptionUrl,
    licence: licence.licence,
    licenceUrl: licence.licenceUrl,
    status: licence.status,
    artist: licence.artist,
    attribution: licence.attribution,
  };
}

/** Create the card (and its licence record); a natural-key race lost to another import is "already a card". */
async function createStagedCard(
  db: PrismaClient,
  data: Prisma.CardUncheckedCreateInput,
  licence: CapturedLicence | null
): Promise<StageOutcome> {
  try {
    const card = await db.card.create({ data, select: { id: true, rarity: true } });
    return {
      status: "STAGED",
      cardId: card.id,
      rarity: card.rarity,
      licence: licence?.licence ?? null,
    };
  } catch (error) {
    if (isUniqueViolation(error)) return ALREADY_CARDED;
    throw error;
  }
}

/** The article read into a candidate, or the skip or failure that stopped it. */
async function readArticle(
  source: CardArticleSource,
  title: string,
  input: StageInput
): Promise<LoreCardCandidate | StageOutcome> {
  try {
    return await wikiLoreCardGenerator.generateCard(title, source, {
      requireImage: input.requireImage,
      minLength: input.bypassLengthGate ? 0 : undefined,
    });
  } catch (error) {
    if (error instanceof DiscoveryStopped) throw error;
    if (error instanceof ArticleRejected) return { status: "SKIPPED", reason: error.message };
    return { status: "FAILED", reason: error instanceof Error ? error.message : String(error) };
  }
}

async function cardValue(db: PrismaClient, rarity: CardRarity): Promise<number> {
  return computeCardValue({ rarity, cardType: "LORE" }, await getValuationConfig(db));
}

export async function stageArticleCard(
  db: PrismaClient,
  source: CardArticleSource,
  input: StageInput,
  context: ImportContext
): Promise<StageOutcome> {
  const title = canonicalCardTitle(source, input.title);
  if (!title) return { status: "FAILED", reason: "Not a valid page title" };
  if ((await cardedTitleKeys(db, source, [title])).size > 0) return ALREADY_CARDED;
  const home = await resolveImportRealm(db, source, title);
  if (home.nationPage) {
    return { status: "SKIPPED", reason: "A realm's nation page does not become a Lore card" };
  }

  const read = await readArticle(source, title, input);
  if ("status" in read) return read;
  const licence = read.imageFile
    ? await captureArtLicence(context.query, source, read.imageFile)
    : null;
  if (licence?.status === "RESTRICTED") return blocked(licence);

  const rarity = rarityForScore(read.qualityScore, context.thresholds);
  return createStagedCard(
    db,
    {
      title: read.title,
      description: read.description,
      artwork: read.artwork,
      artworkSource: read.artwork ? "WIKI_FETCHED" : "PROCEDURAL",
      artworkCredit: licence?.attribution ?? null,
      category: read.category,
      cardType: "LORE",
      rarity,
      season: await getCurrentIxCardSeason(db),
      wikiSource: source,
      wikiArticleTitle: title,
      wikiExcerpt: read.fullExcerpt || null,
      realmId: home.realmId,
      ...reviewOf(input),
      marketValue: await cardValue(db, rarity),
      metadata: {
        wikiUrl: read.wikiUrl,
        category: read.category,
        qualityScore: read.qualityScore,
        fullExcerpt: read.fullExcerpt,
        ...(read.authorInfo
          ? { authorInfo: authorJson(read.authorInfo), author: read.authorInfo.displayAuthor }
          : {}),
      },
      ...(read.artwork
        ? { artLicence: { create: licenceRecord(source, read.artwork, licence, input) } }
        : {}),
    },
    licence
  );
}

export async function stageCommonsFile(
  db: PrismaClient,
  input: StageInput,
  context: ImportContext
): Promise<StageOutcome> {
  const fileTitle = canonicalCardTitle("commons", `File:${input.title.replace(/^file:/i, "")}`);
  if (!fileTitle) return { status: "FAILED", reason: "Not a valid file name" };
  if ((await cardedTitleKeys(db, "commons", [fileTitle])).size > 0) return ALREADY_CARDED;

  const licence = await captureArtLicence(context.query, "commons", fileTitle);
  if (!licence) return { status: "FAILED", reason: "Wikimedia Commons has no such file" };
  if (licence.status === "RESTRICTED") return blocked(licence);

  const title = commonsCardTitle(fileTitle);
  const rarity = rarityForScore(0, context.thresholds);
  const category = classifyLoreArticle({ title, text: "", categories: [] });
  return createStagedCard(
    db,
    {
      title,
      artwork: licence.fileUrl,
      artworkSource: "WIKI_FETCHED",
      artworkCredit: licence.attribution,
      category,
      cardType: "LORE",
      rarity,
      season: await getCurrentIxCardSeason(db),
      wikiSource: "commons",
      wikiArticleTitle: fileTitle,
      realmId: wikiFallbackRealm("commons"),
      ...reviewOf(input),
      marketValue: await cardValue(db, rarity),
      metadata: { category, descriptionUrl: licence.descriptionUrl },
      artLicence: { create: licenceRecord("commons", licence.fileUrl, licence, input) },
    },
    licence
  );
}

/**
 * Stage one page for an admin procedure, with a one-off context: the card, or a TRPCError saying why not (the
 * skip, block or failure, or which wiki stopped answering).
 */
export async function stageForAdmin(
  db: PrismaClient,
  source: CardArticleSource,
  input: StageInput
): Promise<{ cardId: string; rarity: CardRarity }> {
  let outcome: StageOutcome;
  try {
    outcome = await stageArticleCard(db, source, input, await oneOffImportContext(db, source));
  } catch (error) {
    if (!(error instanceof DiscoveryStopped)) throw error;
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `${cardSourceLabel(source)} stopped answering: ${error.message}`,
      cause: error,
    });
  }
  if (outcome.status !== "STAGED")
    throw new TRPCError({ code: "BAD_REQUEST", message: outcome.reason });
  return { cardId: outcome.cardId, rarity: outcome.rarity };
}
