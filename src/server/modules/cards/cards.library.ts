/**
 * The Library: a realm-scoped explorer over every card (realm, type, rarity, source wiki, retired, art hidden,
 * bound), an edit with an audited rarity override, and bulk hide. Hiding retires a card: it leaves packs and Explore,
 * and owned copies stay. Art a takedown hides, or whose licence is restricted, is changed and shown again only from
 * Compliance, so the Library never un-hides it by accident.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { EXCLUDE_RESTRICTED_ART } from "~/lib/cards/art-licence";
import { cardWikiSourceSchema } from "~/lib/cards/card-sources";
import { cardCount, lacksRarityReason } from "~/lib/cards/curation-limits";
import { CardRarity, CardType } from "~/lib/cards/enums";
import { nsBankValue } from "~/lib/cards/ns-facts";
import { getValuationConfig, referenceValue } from "~/lib/cards/valuation";
import type { CardAdminActor } from "~/server/shared/admin-actor";
import { recordCardAudit } from "./cards.audit";
import { assertBulkRead, assertBulkRecountTx } from "./cards.bulk";
import {
  HIDDEN_TAKEDOWNS,
  artLicenceFollowsTx,
  assertArtNotHeld,
  lockCardTakedownsTx,
} from "./cards.compliance";

export const LibraryFilterSchema = z.object({
  realmId: z.string().min(1).max(100).optional(),
  cardType: z.enum(CardType).optional(),
  rarity: z.enum(CardRarity).optional(),
  source: cardWikiSourceSchema.optional(),
  show: z.enum(["all", "retired", "art_hidden", "bound"]).default("all"),
  search: z.string().trim().max(100).optional(),
});
export type LibraryFilter = z.infer<typeof LibraryFilterSchema>;

const SHOW_WHERE: Readonly<Record<LibraryFilter["show"], Prisma.CardWhereInput>> = {
  all: {},
  retired: { isRetired: true },
  art_hidden: { takedowns: { some: HIDDEN_TAKEDOWNS.where } },
  bound: { isBound: true },
};

/** Legacy IxWiki Lore cards may have no source; the natural key reads them as IxWiki too. */
function sourceWhere(source: LibraryFilter["source"]): Prisma.CardWhereInput {
  if (!source) return {};
  return source === "ixwiki"
    ? { OR: [{ wikiSource: "ixwiki" }, { wikiSource: null, cardType: "LORE" }] }
    : { wikiSource: source };
}

export function libraryWhere(
  filter: LibraryFilter
): Prisma.CardWhereInput & { AND: Prisma.CardWhereInput[] } {
  return {
    AND: [
      filter.realmId ? { realmId: filter.realmId } : {},
      filter.cardType ? { cardType: filter.cardType } : {},
      filter.rarity ? { rarity: filter.rarity } : {},
      filter.search ? { title: { contains: filter.search, mode: "insensitive" } } : {},
      sourceWhere(filter.source),
      SHOW_WHERE[filter.show],
    ],
  };
}

/** The cards a Library read showed: those matching the filter that existed at `asOf`. */
const shownWhere = (filter: LibraryFilter, asOf: Date): { AND: Prisma.CardWhereInput[] } => ({
  AND: [...libraryWhere(filter).AND, { createdAt: { lte: asOf } }],
});

/**
 * The shown cards a bulk hide (`retired`) or unhide would change: those not that way yet, less the cards whose art
 * Compliance holds and, for a hide, achievement reward cards (hiding one pauses its award, so that is done card by
 * card from the edit).
 */
function changeWhere(filter: LibraryFilter, asOf: Date, retired: boolean): Prisma.CardWhereInput {
  return {
    AND: [
      ...shownWhere(filter, asOf).AND,
      { isRetired: !retired },
      { takedowns: { none: HIDDEN_TAKEDOWNS.where } },
      EXCLUDE_RESTRICTED_ART,
      ...(retired ? [{ rewardAchievementKey: null }] : []),
    ],
  };
}

/**
 * The Library as of one moment, `asOf`: cards made later are left out of the page and the counts alike. `hideable`
 * and `unhideable` count what each bulk change would change; it sends `asOf` and its count back, so it acts on
 * exactly the cards the admin was shown. With no filter both are 0, as bulk changes need one.
 */
export async function listLibrary(
  db: PrismaClient,
  input: { filter: LibraryFilter; offset: number; limit: number }
) {
  const asOf = new Date();
  const where = shownWhere(input.filter, asOf);
  const bulkable = filterScope(input.filter) !== "";
  const changing = (retired: boolean) =>
    bulkable ? db.card.count({ where: changeWhere(input.filter, asOf, retired) }) : 0;
  const [rows, total, hideable, unhideable] = await Promise.all([
    db.card.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: input.offset,
      take: input.limit,
      select: {
        id: true,
        title: true,
        description: true,
        cardType: true,
        rarity: true,
        realmId: true,
        wikiSource: true,
        artwork: true,
        isRetired: true,
        isBound: true,
        rewardAchievementKey: true,
        reviewState: true,
        marketValue: true,
        realm: { select: { name: true } },
        artLicence: { select: { status: true } },
        _count: { select: { CardOwnership: true, takedowns: HIDDEN_TAKEDOWNS } },
      },
    }),
    db.card.count({ where }),
    changing(true),
    changing(false),
  ]);
  return { rows, total, hideable, unhideable, asOf };
}

export const LibraryEditSchema = z.object({
  cardId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000),
  /** The card's stored art is kept whatever its form; new art is an https address. */
  artwork: z.string().trim().min(1).max(2000).nullable(),
  rarity: z.enum(CardRarity),
  retired: z.boolean(),
  reason: z.string().trim().max(500).optional(),
  /** The card as the admin opened it: an edit over anything changed since is refused. */
  expected: z.object({
    artwork: z.string().max(2000).nullable(),
    isRetired: z.boolean(),
    rarity: z.enum(CardRarity),
  }),
});
export type LibraryEdit = z.infer<typeof LibraryEditSchema>;

const HTTPS_URL = z.url({ protocol: /^https$/ });

type EditedCard = NonNullable<Awaited<ReturnType<typeof editedCard>>>;

function editedCard(tx: Prisma.TransactionClient, id: string) {
  return tx.card.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      artwork: true,
      rarity: true,
      cardType: true,
      wikiSource: true,
      isRetired: true,
      firstSoldAt: true,
      metadata: true,
      artLicence: { select: { status: true } },
      _count: { select: { takedowns: HIDDEN_TAKEDOWNS } },
    },
  });
}

function assertEditable(card: EditedCard, input: LibraryEdit) {
  const { expected } = input;
  if (
    card.artwork !== expected.artwork ||
    card.isRetired !== expected.isRetired ||
    card.rarity !== expected.rarity
  ) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This card changed since you opened it. Reopen it and try again.",
    });
  }
  if (input.rarity !== card.rarity && lacksRarityReason(input.reason)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Say why the rarity changes" });
  }
  const artChanged = input.artwork !== card.artwork;
  if (artChanged && input.artwork !== null && !HTTPS_URL.safeParse(input.artwork).success) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Art is an https:// address" });
  }
  if (artChanged || input.retired !== card.isRetired) assertArtNotHeld(card);
}

/** The words and art an edit changes, as written and as the audit row names them. */
function wordsAndArt(card: EditedCard, input: LibraryEdit) {
  const description = input.description || null;
  const data: Prisma.CardUpdateManyMutationInput = {};
  const edited: string[] = [];
  if (input.title !== card.title) {
    data.title = input.title;
    edited.push("title");
  }
  if (description !== card.description) {
    data.description = description;
    edited.push("description");
  }
  if (input.artwork !== card.artwork) {
    data.artwork = input.artwork;
    data.artworkSource = input.artwork ? "UPLOADED" : "PROCEDURAL";
    // The credit named the old file's artist
    data.artworkCredit = null;
    edited.push("art");
  }
  return { data, edited };
}

/**
 * A rarity override's new reference value, with the Standard median the card-values cron stored, so its next run
 * does not move the value back.
 */
async function valueAtRarity(
  tx: Prisma.TransactionClient,
  db: PrismaClient,
  card: EditedCard,
  rarity: LibraryEdit["rarity"]
): Promise<number> {
  const price = await tx.cardMarketPrice.findUnique({
    where: { cardId_finish: { cardId: card.id, finish: "STANDARD" } },
    select: { median: true },
  });
  const value = {
    rarity,
    cardType: card.cardType,
    firstSoldAt: card.firstSoldAt,
    nsBankValue: nsBankValue(card.metadata),
    isRetired: card.isRetired,
  };
  return referenceValue(value, price?.median ?? null, await getValuationConfig(db));
}

/**
 * Edit one card: its words, art, rarity (with a reason, re-priced and audited) and whether it is hidden. It runs
 * under the card's takedown lock, which every hide takes, so the hold it reads stands until it commits; the write
 * holds only over the art, visibility and rarity it read, which a bulk hide or a sync may change meanwhile.
 */
export async function updateLibraryCard(
  db: PrismaClient,
  actor: CardAdminActor,
  input: LibraryEdit
): Promise<void> {
  await db.$transaction(async (tx) => {
    await lockCardTakedownsTx(tx, input.cardId);
    const card = await editedCard(tx, input.cardId);
    if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
    assertEditable(card, input);
    const { data, edited } = wordsAndArt(card, input);
    const rarityChanged = input.rarity !== card.rarity;
    const retiredChanged = input.retired !== card.isRetired;
    if (rarityChanged) {
      data.rarity = input.rarity;
      data.marketValue = await valueAtRarity(tx, db, card, input.rarity);
    }
    if (retiredChanged) {
      data.isRetired = input.retired;
      data.retiredAt = input.retired ? new Date() : null;
    }
    if (Object.keys(data).length === 0) return;

    // No `takedowns none HIDDEN` term: every hide in the app holds the lock this edit holds. The one exception is the
    // compliance backfill (scripts/cards/backfill-card-compliance.ts), a one-off runbook step that writes HIDDEN rows
    // without it, for cards already hidden and artless.
    const written = await tx.card.updateMany({
      where: { id: card.id, artwork: card.artwork, isRetired: card.isRetired, rarity: card.rarity },
      data,
    });
    if (written.count !== 1) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This card changed while you edited it. Reload and try again.",
      });
    }
    if (edited.includes("art")) await artLicenceFollowsTx(tx, card, input.artwork, "Library");
    const audit = (action: "CARD_RARITY_OVERRIDE" | "CARD_UPDATE" | "CARD_HIDE", details: string) =>
      recordCardAudit(tx, { action, actor: actor.clerkId, target: card.id, details });
    if (rarityChanged) {
      await audit(
        "CARD_RARITY_OVERRIDE",
        `Rarity ${card.rarity} → ${input.rarity}: ${input.reason?.trim()}`
      );
    }
    if (edited.length > 0)
      await audit("CARD_UPDATE", `Edited the ${edited.join(", ")} of ${input.title}`);
    if (retiredChanged)
      await audit("CARD_HIDE", `${input.retired ? "Hid" : "Unhid"} ${input.title}`);
  });
}

export interface BulkSetRetiredInput {
  filter: LibraryFilter;
  retired: boolean;
  /** When the admin's Library was read (`listLibrary`'s `asOf`), and its count for this change. */
  asOf: Date;
  expected: number;
  reason: string;
}

/** The filter as the audit row names it ("realm eurth, type NS"); empty for a filter that matches every card. */
function filterScope(filter: LibraryFilter): string {
  return [
    filter.realmId && `realm ${filter.realmId}`,
    filter.cardType && `type ${filter.cardType}`,
    filter.rarity && `rarity ${filter.rarity}`,
    filter.source && `source ${filter.source}`,
    filter.show !== "all" && `showing ${filter.show}`,
    filter.search && `title "${filter.search}"`,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Hide or unhide the cards a Library read counted for this change (its `asOf` and `hideable` or `unhideable`), at
 * least one and at most MAX_FILTER_REVIEW of them.
 *
 * One race is accepted: this takes no takedown lock, so an unhide racing `hideTakedownArt` on a card that was already
 * hidden can un-hide it just as its art is hidden. The art stays hidden (it moved onto the takedown); the card shows
 * the placeholder face in packs until an admin hides it again.
 */
export async function bulkSetRetired(
  db: PrismaClient,
  actor: CardAdminActor,
  input: BulkSetRetiredInput
): Promise<{ count: number }> {
  const scope = filterScope(input.filter);
  if (!scope) throw new TRPCError({ code: "BAD_REQUEST", message: "Narrow the filter first" });
  if (input.expected < 1) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "No matching card would change" });
  }
  assertBulkRead(input, { list: "The Library's", verb: "Hide or unhide" });
  const where = changeWhere(input.filter, input.asOf, input.retired);
  return db.$transaction(async (tx) => {
    await assertBulkRecountTx(
      tx,
      where,
      input.expected,
      () => "The matching cards changed since you loaded the Library. Reload and try again."
    );
    const result = await tx.card.updateMany({
      where,
      data: { isRetired: input.retired, retiredAt: input.retired ? new Date() : null },
    });
    await recordCardAudit(tx, {
      action: "CARD_HIDE",
      actor: actor.clerkId,
      details: `${input.retired ? "Hid" : "Unhid"} ${cardCount(result.count)} matching ${scope}: ${input.reason}`,
    });
    return { count: result.count };
  });
}
