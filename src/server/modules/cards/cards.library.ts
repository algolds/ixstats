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
import { MAX_FILTER_REVIEW } from "~/lib/cards/curation-limits";
import { CardRarity, CardType } from "~/lib/cards/enums";
import { nsBankValue } from "~/lib/cards/ns-facts";
import { computeCardValue, getValuationConfig } from "~/lib/cards/valuation";
import { recordCardAudit, type CardAdminActor } from "./cards.audit";

export const LibraryFilterSchema = z.object({
  realmId: z.string().min(1).max(100).optional(),
  cardType: z.enum(CardType).optional(),
  rarity: z.enum(CardRarity).optional(),
  source: cardWikiSourceSchema.optional(),
  show: z.enum(["all", "retired", "art_hidden", "bound"]).default("all"),
  search: z.string().trim().max(100).optional(),
});
export type LibraryFilter = z.infer<typeof LibraryFilterSchema>;

const ART_HIDDEN = { status: "HIDDEN" } as const;
const SHOW_WHERE: Readonly<Record<LibraryFilter["show"], Prisma.CardWhereInput>> = {
  all: {},
  retired: { isRetired: true },
  art_hidden: { takedowns: { some: ART_HIDDEN } },
  bound: { isBound: true },
};
const NO_HIDDEN_TAKEDOWN: Prisma.CardWhereInput = { takedowns: { none: ART_HIDDEN } };

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
 * The Library as of one moment, `asOf`: cards made later are left out of the page and the total alike. Bulk hide
 * sends `asOf` and the total back, so it acts on exactly the cards the admin was shown.
 */
export async function listLibrary(
  db: PrismaClient,
  input: { filter: LibraryFilter; offset: number; limit: number }
) {
  const asOf = new Date();
  const where = shownWhere(input.filter, asOf);
  const [rows, total] = await Promise.all([
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
        reviewState: true,
        marketValue: true,
        realm: { select: { name: true } },
        artLicence: { select: { status: true } },
        _count: { select: { CardOwnership: true, takedowns: { where: ART_HIDDEN } } },
      },
    }),
    db.card.count({ where }),
  ]);
  return { rows, total, asOf };
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
      isRetired: true,
      metadata: true,
      artLicence: { select: { status: true } },
      _count: { select: { takedowns: { where: ART_HIDDEN } } },
    },
  });
}

function assertEditable(card: EditedCard, input: LibraryEdit) {
  if (input.rarity !== card.rarity && (input.reason ?? "").trim().length < 3) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Say why the rarity changes" });
  }
  const artChanged = input.artwork !== card.artwork;
  if (artChanged && input.artwork !== null && !HTTPS_URL.safeParse(input.artwork).success) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Art is an https:// address" });
  }
  const heldByCompliance = card._count.takedowns > 0 || card.artLicence?.status === "RESTRICTED";
  if (heldByCompliance && (artChanged || input.retired !== card.isRetired)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "A takedown or a restricted licence hides this card's art. Change it from Compliance.",
    });
  }
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
    edited.push("art");
  }
  return { data, edited };
}

/**
 * Edit one card: its words, art, rarity (with a reason, re-priced and audited) and whether it is hidden. The write
 * holds only over the art, visibility and rarity it read, so a takedown hiding the art meanwhile makes it miss.
 */
export async function updateLibraryCard(
  db: PrismaClient,
  actor: CardAdminActor,
  input: LibraryEdit
): Promise<void> {
  await db.$transaction(async (tx) => {
    const card = await editedCard(tx, input.cardId);
    if (!card) throw new TRPCError({ code: "NOT_FOUND", message: "Card not found" });
    assertEditable(card, input);
    const { data, edited } = wordsAndArt(card, input);
    const rarityChanged = input.rarity !== card.rarity;
    const retiredChanged = input.retired !== card.isRetired;
    if (rarityChanged) {
      const value = {
        rarity: input.rarity,
        cardType: card.cardType,
        nsMarketValue: nsBankValue(card.metadata),
      };
      data.rarity = input.rarity;
      data.marketValue = computeCardValue(value, await getValuationConfig(db));
    }
    if (retiredChanged) {
      data.isRetired = input.retired;
      data.retiredAt = input.retired ? new Date() : null;
    }
    if (Object.keys(data).length === 0) return;

    const written = await tx.card.updateMany({
      where: {
        id: card.id,
        artwork: card.artwork,
        isRetired: card.isRetired,
        rarity: card.rarity,
        ...(edited.includes("art") || retiredChanged ? NO_HIDDEN_TAKEDOWN : {}),
      },
      data,
    });
    if (written.count !== 1) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This card changed while you edited it. Reload and try again.",
      });
    }
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
  /** When the admin's Library was read (`listLibrary`'s `asOf`), and the total it showed. */
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

const cardCount = (count: number) => `${count.toLocaleString()} ${count === 1 ? "card" : "cards"}`;

/**
 * Hide or unhide the cards a Library read showed (its `asOf` and total), at most MAX_FILTER_REVIEW of them. Cards
 * already that way are left as they are, and so are cards whose art a takedown or a restricted licence hides.
 */
export async function bulkSetRetired(
  db: PrismaClient,
  actor: CardAdminActor,
  input: BulkSetRetiredInput
): Promise<{ count: number }> {
  const scope = filterScope(input.filter);
  if (!scope) throw new TRPCError({ code: "BAD_REQUEST", message: "Narrow the filter first" });
  // A read time after now would let the change take cards made after the admin's read.
  if (input.asOf.getTime() > Date.now()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The Library's read time is in the future. Reload and try again.",
    });
  }
  if (input.expected > MAX_FILTER_REVIEW) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Hide or unhide at most ${MAX_FILTER_REVIEW.toLocaleString()} cards at once. Narrow the filter.`,
    });
  }
  const shown = shownWhere(input.filter, input.asOf);
  return db.$transaction(async (tx) => {
    const matching = await tx.card.count({ where: shown });
    if (matching !== input.expected) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "The matching cards changed since you loaded the Library. Reload and try again.",
      });
    }
    const result = await tx.card.updateMany({
      where: {
        AND: [
          ...shown.AND,
          { isRetired: !input.retired },
          NO_HIDDEN_TAKEDOWN,
          EXCLUDE_RESTRICTED_ART,
        ],
      },
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
