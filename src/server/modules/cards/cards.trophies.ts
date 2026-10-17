/**
 * Trophy fixes (cards refresh spec §2.4): an admin override of a Loreward winner or runner-up is written to every
 * entry of its contest, and each place it changes takes its trophy with it, with an audit row, a transfer event and a
 * provenance note on the card. This is the only way a bound card moves.
 *
 * A trophy is a one-of-one whose serial is never issued twice. A new holder the place resolves to
 * (`resolveLorewardPlace`) takes the copy in place. An emptied place, or a holder no account can be told for yet,
 * gives the copy up (`removeCopyTx`, a VOID), and `grantUnownedTrophyCards` reissues its serial once one can. Locks,
 * in the order the trophy mint and grant take them: the contest's place locks (7332), then each card's (7331).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { articleHomeRealm } from "~/lib/cards/home-realm";
import { isJsonObject } from "~/lib/cards/ns-facts";
import { removeCopyTx, type RemovableCopy } from "~/lib/cards/remove-copy";
import { lockCardSerialsTx } from "~/lib/cards/serial-number";
import {
  contestEntriesWhere,
  contestPlaceKey,
  type Contest,
} from "~/lib/lorewards/contest-identity";
import {
  CONTEST_ENTRY_SELECT,
  lockContestPlace,
  type StoredContestEntry,
} from "~/lib/lorewards/contest-store";
import { placeOf, resolveLorewardPlace, type LorewardPlaceRef } from "~/lib/lorewards/resolve-user";
import { mintTrophyCards, mintTrophyCopyTx, trophyCardText } from "~/lib/lorewards/trophy-cards";
import type { LorewardPlace, LorewardType } from "~/lib/vault/vault-bonus";
import { recordCardAudit, type CardAdminActor } from "./cards.audit";

/** What an override sets (`lorewards.overrideWinner`); a field it leaves out is cleared. */
export interface LorewardOverride {
  winnerUser?: string | null;
  winnerPage?: string | null;
  winnerScore?: number | null;
  winnerBytes?: number | null;
  runnerUpUser?: string | null;
  runnerUpPage?: string | null;
  runnerUpScore?: number | null;
  runnerUpBytes?: number | null;
}

type Tx = Prisma.TransactionClient;
type Outcome = "REASSIGNED" | "VOIDED";

/** Winner first: every override takes the two places' locks in this order. */
const PLACES: readonly LorewardPlace[] = ["winner", "runner-up"];

/** Every field the override writes: a blank name or page is none (the form sends ""), and a score of 0 stays. */
function entryFields(fields: LorewardOverride) {
  return {
    winnerUser: fields.winnerUser || null,
    winnerPage: fields.winnerPage || null,
    winnerScore: fields.winnerScore ?? null,
    winnerBytes: fields.winnerBytes ?? null,
    runnerUpUser: fields.runnerUpUser || null,
    runnerUpPage: fields.runnerUpPage || null,
    runnerUpScore: fields.runnerUpScore ?? null,
    runnerUpBytes: fields.runnerUpBytes ?? null,
  };
}
type EntryFields = ReturnType<typeof entryFields>;
type PlaceColumns = Pick<
  EntryFields,
  "winnerUser" | "winnerPage" | "runnerUpUser" | "runnerUpPage"
>;

/** Whether the entry already records the place as the override does: the same name and page. */
function samePlace(entry: PlaceColumns, fields: PlaceColumns, place: LorewardPlace): boolean {
  return place === "winner"
    ? entry.winnerUser === fields.winnerUser && entry.winnerPage === fields.winnerPage
    : entry.runnerUpUser === fields.runnerUpUser && entry.runnerUpPage === fields.runnerUpPage;
}

interface TrophyCard {
  id: string;
  metadata: Prisma.JsonValue;
}

/** A card of a changed place and its live copies, read under the card's serial lock. */
interface HeldTrophy {
  card: TrophyCard;
  copies: RemovableCopy[];
}

/** The place as the override records it, and how the audit row names it. */
interface NextHolder {
  type: LorewardType;
  place: LorewardPlace;
  ref: LorewardPlaceRef;
  label: string;
}

/** The name the card records its place's holder under. */
function recordedHolder(metadata: Prisma.JsonValue): string | null {
  const holder = isJsonObject(metadata) ? metadata.wikiUser : null;
  return typeof holder === "string" ? holder : null;
}

/** The card's metadata with `changes`, and one more provenance note: who moved the place, from and to whom, when. */
function withProvenance(
  metadata: Prisma.JsonValue,
  note: { action: "REASSIGN" | "VOID"; from: string | null; to: string | null; by: string },
  changes: Prisma.JsonObject
): Prisma.InputJsonObject {
  const meta = isJsonObject(metadata) ? metadata : {};
  const notes = Array.isArray(meta.provenance) ? meta.provenance : [];
  return { ...meta, ...changes, provenance: [...notes, { ...note, at: new Date().toISOString() }] };
}

/** A card's live copies, read under its serial lock (7331), which the transaction then holds. */
async function liveCopiesTx(tx: Tx, cardId: string): Promise<RemovableCopy[]> {
  await lockCardSerialsTx(tx, cardId);
  return tx.cardOwnership.findMany({
    where: { cardId },
    select: { id: true, cardId: true, ownerId: true, serialNumber: true },
  });
}

/** Moves a copy to `toUserId` in place: its serial and trail stay, and a REASSIGN row records the move. */
async function transferCopyTx(tx: Tx, copy: RemovableCopy, toUserId: string): Promise<void> {
  const moved = await tx.cardOwnership.updateMany({
    where: { id: copy.id, ownerId: copy.ownerId, isLocked: false },
    data: { ownerId: toUserId, acquiredAt: new Date() },
  });
  if (moved.count !== 1) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This trophy's copy changed hands or was locked. Reload and try again.",
    });
  }
  await tx.cardTransferEvent.create({
    data: {
      ownershipId: copy.id,
      cardId: copy.cardId,
      serialNumber: copy.serialNumber,
      fromUserId: copy.ownerId,
      toUserId,
      action: "REASSIGN",
    },
  });
}

/**
 * Gives the trophy's copy to `userId`: moved in place from its holder, minted (or its serial reissued) when there is
 * none, or given up (a VOID) when no account can be told for the place yet, so the card waits for its grant.
 */
async function settleCopyTx(
  tx: Tx,
  cardId: string,
  [copy]: RemovableCopy[],
  userId: string | null
): Promise<void> {
  if (!copy) {
    if (userId) await mintTrophyCopyTx(tx, cardId, userId);
  } else if (!userId) {
    await removeCopyTx(tx, copy, "VOID");
  } else if (copy.ownerId !== userId) {
    await transferCopyTx(tx, copy, userId);
  }
}

async function reassignTrophyTx(
  tx: Tx,
  actor: CardAdminActor,
  { card, copies }: HeldTrophy,
  next: NextHolder,
  userId: string | null
): Promise<Outcome> {
  const from = recordedHolder(card.metadata);
  const to = next.ref.wikiUser;
  await settleCopyTx(tx, card.id, copies, userId);
  const text = trophyCardText(next.type, next.ref.date, next.place, to, next.ref.page);
  await tx.card.update({
    where: { id: card.id },
    data: {
      ...text,
      realmId: await articleHomeRealm(tx, "ixwiki", text.title),
      isRetired: false,
      retiredAt: null,
      metadata: withProvenance(
        card.metadata,
        { action: "REASSIGN", from, to, by: actor.clerkId },
        { wikiUser: to, grantedTo: userId }
      ),
    },
  });
  await recordCardAudit(tx, {
    action: "TROPHY_REASSIGN",
    actor: actor.clerkId,
    target: card.id,
    details: `Reassigned the ${next.label} trophy from ${from ?? "nobody"} to ${to}, ${userId ? `granted to ${userId}` : "waiting for their account"}`,
  });
  return "REASSIGNED";
}

async function voidTrophyTx(
  tx: Tx,
  actor: CardAdminActor,
  { card, copies }: HeldTrophy,
  label: string
): Promise<Outcome> {
  const from = recordedHolder(card.metadata);
  for (const copy of copies) await removeCopyTx(tx, copy, "VOID");
  await tx.card.update({
    where: { id: card.id },
    data: {
      isRetired: true,
      retiredAt: new Date(),
      metadata: withProvenance(
        card.metadata,
        { action: "VOID", from, to: null, by: actor.clerkId },
        { grantedTo: null }
      ),
    },
  });
  await recordCardAudit(tx, {
    action: "TROPHY_VOID",
    actor: actor.clerkId,
    target: card.id,
    details: `Voided the ${label} trophy (was ${from ?? "nobody"})`,
  });
  return "VOIDED";
}

/**
 * Takes one changed place's trophy with the override. Every card of the contest's place follows the entry, and the
 * place keeps one copy at most, on the card that holds it: a contest stored twice may have a card per entry, minted
 * before contests were told apart. The place is named and resolved through the state-keyed entry, as the mint does.
 */
async function reconcilePlaceTx(
  tx: Tx,
  actor: CardAdminActor,
  contest: Contest<StoredContestEntry>,
  override: { type: LorewardType; fields: EntryFields },
  place: LorewardPlace
): Promise<Outcome[]> {
  const cards = await tx.card.findMany({
    where: { lorewardEntryId: { in: contest.map((entry) => entry.id) }, lorewardEdition: place },
    select: { id: true, metadata: true },
    orderBy: { id: "asc" },
  });
  const held: HeldTrophy[] = [];
  for (const card of cards) held.push({ card, copies: await liveCopiesTx(tx, card.id) });
  const lead = contest.find((entry) => entry.dateStart !== null) ?? contest[0];
  const label = `${override.type} ${place} of ${lead.date}`;
  const ref = placeOf({ ...lead, ...override.fields }, place);

  const outcomes: Outcome[] = [];
  if (!ref) {
    for (const trophy of held) outcomes.push(await voidTrophyTx(tx, actor, trophy, label));
    return outcomes;
  }
  if (held.length === 0) return outcomes;
  const userId = await resolveLorewardPlace(tx, ref);
  const keeper = held.find((trophy) => trophy.copies.length > 0) ?? held[0];
  const next = { type: override.type, place, ref, label };
  for (const trophy of held) {
    outcomes.push(
      await reassignTrophyTx(tx, actor, trophy, next, trophy === keeper ? userId : null)
    );
  }
  return outcomes;
}

/**
 * Writes the override to every entry of its contest (creating the entry, approved, when the contest has none), under
 * both places' contest locks, then reconciles the trophy of each place it changes.
 */
async function overrideTx(
  tx: Tx,
  actor: CardAdminActor,
  input: { date: string; type: LorewardType },
  fields: EntryFields
): Promise<{ entryIds: string[]; outcomes: Outcome[] }> {
  const key = { date_type: { date: input.date, type: input.type } };
  const keyed = await tx.lorewardEntry.findUnique({
    where: key,
    select: { type: true, date: true, dateStart: true },
  });
  const identity = keyed ?? { type: input.type, date: input.date, dateStart: null };
  for (const place of PLACES) await lockContestPlace(tx, contestPlaceKey(identity, place));
  const [first, ...rest] = await tx.lorewardEntry.findMany({
    where: contestEntriesWhere(identity),
    select: CONTEST_ENTRY_SELECT,
    orderBy: { id: "asc" },
  });
  if (!first) {
    const created = await tx.lorewardEntry.upsert({
      where: key,
      create: { date: input.date, type: input.type, ...fields, status: "approved" },
      update: fields,
      select: { id: true },
    });
    return { entryIds: [created.id], outcomes: [] };
  }

  const contest: Contest<StoredContestEntry> = [first, ...rest];
  const entryIds = contest.map((entry) => entry.id);
  await tx.lorewardEntry.updateMany({ where: { id: { in: entryIds } }, data: fields });
  const outcomes: Outcome[] = [];
  for (const place of PLACES) {
    if (contest.every((entry) => samePlace(entry, fields, place))) continue;
    outcomes.push(
      ...(await reconcilePlaceTx(tx, actor, contest, { type: input.type, fields }, place))
    );
  }
  return { entryIds, outcomes };
}

/**
 * Overrides a Loreward contest's winner and runner-up, and takes each changed place's trophy with it (reassigned or
 * voided, in one transaction with the write), then mints the trophy of any recorded place that has none.
 */
export async function overrideLorewardEntry(
  db: PrismaClient,
  actor: CardAdminActor,
  input: { date: string; type: LorewardType; fields: LorewardOverride }
): Promise<{ reassigned: number; voided: number; minted: number }> {
  const fields = entryFields(input.fields);
  const { entryIds, outcomes } = await db.$transaction((tx) =>
    overrideTx(tx, actor, input, fields)
  );
  const { minted } = await mintTrophyCards(db, entryIds);
  return {
    reassigned: outcomes.filter((outcome) => outcome === "REASSIGNED").length,
    voided: outcomes.filter((outcome) => outcome === "VOIDED").length,
    minted,
  };
}
