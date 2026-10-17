/**
 * Trophy fixes (cards refresh spec §2.4): an admin override of a Loreward winner or runner-up is written to every
 * entry of its contest and marked (`overriddenAt`, so no sync writes over it), and each place it changes takes its
 * trophy with it, with an audit row, a transfer event and a provenance note on the card. This is the only way a bound
 * card moves.
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
import { CONTEST_ENTRY_SELECT, lockContestPlace } from "~/lib/lorewards/contest-store";
import { placeOf, resolveLorewardPlace, type LorewardPlaceRef } from "~/lib/lorewards/resolve-user";
import { mintTrophyCards, mintTrophyCopyTx, trophyCardText } from "~/lib/lorewards/trophy-cards";
import type { LorewardPlace, LorewardType } from "~/lib/vault/vault-bonus";
import type { CardAdminActor } from "~/server/shared/admin-actor";
import { recordCardAudit } from "./cards.audit";

/**
 * What an override sets (`lorewards.overrideWinner`, `admin.saveLorewardWinnerOverride`): a field left out keeps its
 * stored value, and null clears it. A new holder for a place starts with no page, score or bytes unless given.
 */
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

/** The columns an override writes. */
const ENTRY_FIELDS = {
  winnerUser: true,
  winnerPage: true,
  winnerScore: true,
  winnerBytes: true,
  runnerUpUser: true,
  runnerUpPage: true,
  runnerUpScore: true,
  runnerUpBytes: true,
} as const;
const CONTEST_ROW_SELECT = { ...CONTEST_ENTRY_SELECT, ...ENTRY_FIELDS } as const;
type ContestRow = Prisma.LorewardEntryGetPayload<{ select: typeof CONTEST_ROW_SELECT }>;
type EntryFields = Prisma.LorewardEntryGetPayload<{ select: typeof ENTRY_FIELDS }>;

/** One place's four fields. */
interface PlaceValues {
  user: string | null;
  page: string | null;
  score: number | null;
  bytes: number | null;
}
type PlaceInput = { [K in keyof PlaceValues]?: PlaceValues[K] };

const NO_PLACE: PlaceValues = { user: null, page: null, score: null, bytes: null };
const NOTHING_STORED: EntryFields = {
  winnerUser: null,
  winnerPage: null,
  winnerScore: null,
  winnerBytes: null,
  runnerUpUser: null,
  runnerUpPage: null,
  runnerUpScore: null,
  runnerUpBytes: null,
};

/** One place's four fields, as an override gives them (`PlaceInput`) or as an entry stores them (`PlaceValues`). */
function placeFieldsOf(fields: EntryFields, place: LorewardPlace): PlaceValues;
function placeFieldsOf(fields: LorewardOverride, place: LorewardPlace): PlaceInput;
function placeFieldsOf(fields: LorewardOverride, place: LorewardPlace): PlaceInput {
  return place === "winner"
    ? {
        user: fields.winnerUser,
        page: fields.winnerPage,
        score: fields.winnerScore,
        bytes: fields.winnerBytes,
      }
    : {
        user: fields.runnerUpUser,
        page: fields.runnerUpPage,
        score: fields.runnerUpScore,
        bytes: fields.runnerUpBytes,
      };
}
/** Whether the override sets any of the place's four fields. */
const placeTouched = (fields: LorewardOverride, place: LorewardPlace): boolean =>
  Object.values(placeFieldsOf(fields, place)).some((value) => value !== undefined);

const keep = <T>(value: T | undefined, stored: T): T => (value === undefined ? stored : value);

/**
 * One place over its stored fields: an omitted field keeps its value, null clears it, and a blank name or page is
 * none. A new holder starts with no page, score or bytes: the previous holder's are never kept for them.
 */
function placeValues(input: PlaceInput, stored: PlaceValues): PlaceValues {
  const user = keep(input.user, stored.user) || null;
  const base = user === stored.user ? stored : NO_PLACE;
  return {
    user,
    page: keep(input.page, base.page) || null,
    score: keep(input.score, base.score),
    bytes: keep(input.bytes, base.bytes),
  };
}

/** The fields the override writes, over those `stored` holds (`placeValues` for each place). */
function entryFields(fields: LorewardOverride, stored: EntryFields): EntryFields {
  const winner = placeValues(placeFieldsOf(fields, "winner"), placeFieldsOf(stored, "winner"));
  const runnerUp = placeValues(
    placeFieldsOf(fields, "runner-up"),
    placeFieldsOf(stored, "runner-up")
  );
  return {
    winnerUser: winner.user,
    winnerPage: winner.page,
    winnerScore: winner.score,
    winnerBytes: winner.bytes,
    runnerUpUser: runnerUp.user,
    runnerUpPage: runnerUp.page,
    runnerUpScore: runnerUp.score,
    runnerUpBytes: runnerUp.bytes,
  };
}

/** Whether the entry already records the place as the override does: the same name and page. */
function samePlace(entry: EntryFields, fields: EntryFields, place: LorewardPlace): boolean {
  return place === "winner"
    ? entry.winnerUser === fields.winnerUser && entry.winnerPage === fields.winnerPage
    : entry.runnerUpUser === fields.runnerUpUser && entry.runnerUpPage === fields.runnerUpPage;
}

interface TrophyCard {
  id: string;
  title: string;
  isRetired: boolean;
  metadata: Prisma.JsonValue;
}

/** A card of a changed place and its live copies, read under the card's serial lock. */
interface HeldTrophy {
  card: TrophyCard;
  copies: RemovableCopy[];
}

/** The place's holder as the override records it, and the card text that follows. */
interface PlaceTarget {
  ref: LorewardPlaceRef;
  text: ReturnType<typeof trophyCardText>;
}

/** The place as the override records it, the card's realm that follows, and the audit's name for the place. */
interface NextHolder extends PlaceTarget {
  realmId: string;
  label: string;
}

const metadataOf = (card: TrophyCard): Prisma.JsonObject =>
  isJsonObject(card.metadata) ? card.metadata : {};

/** The name the card records its place's holder under. */
function recordedHolder(meta: Prisma.JsonObject): string | null {
  return typeof meta.wikiUser === "string" ? meta.wikiUser : null;
}

/**
 * Whether the card already shows the place as the override records it: the same holder and title, or voided (by an
 * override, `voidedAt`) for an empty place. A card that disagrees is reconciled even when the entries do not change.
 */
function cardRecords(card: TrophyCard, target: PlaceTarget | null): boolean {
  const meta = metadataOf(card);
  if (!target) return Boolean(meta.voidedAt);
  return (
    !meta.voidedAt && meta.wikiUser === target.ref.wikiUser && card.title === target.text.title
  );
}

/** The card's metadata with `changes`, and one more provenance note: who moved the place, from and to whom, when. */
function withProvenance(
  meta: Prisma.JsonObject,
  note: { action: "REASSIGN" | "VOID"; from: string | null; to: string | null; by: string },
  changes: Prisma.JsonObject
): Prisma.InputJsonObject {
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
 * Gives the trophy's copy to `userId`: moved in place from its holder, or minted (or its serial reissued) when there
 * is none. With no account to tell for the place yet, the copy is given up (a VOID) and the card waits for its grant.
 * Returns whether the copy came to `userId` now.
 */
async function settleCopyTx(
  tx: Tx,
  cardId: string,
  [copy]: RemovableCopy[],
  userId: string | null
): Promise<boolean> {
  if (!userId) {
    if (copy) await removeCopyTx(tx, copy, "VOID");
    return false;
  }
  if (!copy) {
    await mintTrophyCopyTx(tx, cardId, userId);
    return true;
  }
  if (copy.ownerId === userId) return false;
  await transferCopyTx(tx, copy, userId);
  return true;
}

/** The grant date that follows: now for a copy that just came to its holder, none while it waits, else unchanged. */
const grantedAtChange = (userId: string | null, granted: boolean): Prisma.JsonObject => {
  if (!userId) return { grantedAt: null };
  return granted ? { grantedAt: new Date().toISOString() } : {};
};

async function reassignTrophyTx(
  tx: Tx,
  actor: CardAdminActor,
  { card, copies }: HeldTrophy,
  next: NextHolder,
  userId: string | null
): Promise<Outcome> {
  const meta = metadataOf(card);
  const from = recordedHolder(meta);
  const to = next.ref.wikiUser;
  const granted = await settleCopyTx(tx, card.id, copies, userId);
  await tx.card.update({
    where: { id: card.id },
    data: {
      ...next.text,
      realmId: next.realmId,
      // Only a card an override voided comes back; one retired for another reason stays retired
      ...(meta.voidedAt ? { isRetired: false, retiredAt: null } : {}),
      metadata: withProvenance(
        meta,
        { action: "REASSIGN", from, to, by: actor.clerkId },
        { wikiUser: to, grantedTo: userId, ...grantedAtChange(userId, granted), voidedAt: null }
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

/**
 * A second card of the place (one per entry of a contest stored twice, minted before contests were told apart): its
 * text follows the place, a copy on it is voided, and it is never granted. The place's trophy is `keeperId`.
 */
async function duplicateTrophyTx(
  tx: Tx,
  actor: CardAdminActor,
  { card, copies }: HeldTrophy,
  next: NextHolder,
  keeperId: string
): Promise<Outcome> {
  const meta = metadataOf(card);
  const from = recordedHolder(meta);
  const to = next.ref.wikiUser;
  for (const copy of copies) await removeCopyTx(tx, copy, "VOID");
  const voided = copies.length > 0;
  await tx.card.update({
    where: { id: card.id },
    data: {
      ...next.text,
      realmId: next.realmId,
      metadata: withProvenance(
        meta,
        { action: voided ? "VOID" : "REASSIGN", from, to, by: actor.clerkId },
        // A refilled place's duplicate stays retired, but is no longer voided: it follows the place again
        { wikiUser: to, grantedTo: null, grantedAt: null, voidedAt: null }
      ),
    },
  });
  const holders = copies.map((copy) => copy.ownerId).join(", ");
  await recordCardAudit(tx, {
    action: voided ? "TROPHY_VOID" : "TROPHY_REASSIGN",
    actor: actor.clerkId,
    target: card.id,
    details: voided
      ? `Voided the duplicate copy of the ${next.label} trophy held by ${holders}: the place's trophy is ${keeperId}`
      : `Reassigned the duplicate ${next.label} trophy card from ${from ?? "nobody"} to ${to}: the place's trophy is ${keeperId}`,
  });
  return voided ? "VOIDED" : "REASSIGNED";
}

async function voidTrophyTx(
  tx: Tx,
  actor: CardAdminActor,
  { card, copies }: HeldTrophy,
  label: string
): Promise<Outcome> {
  const meta = metadataOf(card);
  const from = recordedHolder(meta);
  const voidedAt = new Date();
  for (const copy of copies) await removeCopyTx(tx, copy, "VOID");
  await tx.card.update({
    where: { id: card.id },
    data: {
      isRetired: true,
      retiredAt: voidedAt,
      metadata: withProvenance(
        meta,
        { action: "VOID", from, to: null, by: actor.clerkId },
        { grantedTo: null, grantedAt: null, voidedAt: voidedAt.toISOString() }
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
 * The card the place's trophy stays on: the one whose copy the new holder already owns, else the one holding a copy,
 * else the first that is not retired, else the first. The rest are duplicates (`duplicateTrophyTx`).
 */
const keeperOf = (held: HeldTrophy[], userId: string | null): HeldTrophy =>
  held.find((trophy) => trophy.copies.some((copy) => copy.ownerId === userId)) ??
  held.find((trophy) => trophy.copies.length > 0) ??
  held.find((trophy) => !trophy.card.isRetired) ??
  held[0];

/** The contest an override writes: its entries, the one it names and resolves its places through, and the fields. */
interface OverriddenContest {
  contest: Contest<ContestRow>;
  lead: ContestRow;
  type: LorewardType;
  fields: EntryFields;
}

/**
 * Takes one place the override sets with its trophy, when the override changes it or a card of it disagrees. Every
 * card of the contest's place follows the entry, and the place keeps one copy at most (`keeperOf`). The place is named
 * and resolved through the state-keyed entry, as the mint does.
 */
async function reconcilePlaceTx(
  tx: Tx,
  actor: CardAdminActor,
  { contest, lead, type, fields }: OverriddenContest,
  place: LorewardPlace
): Promise<Outcome[]> {
  const cards = await tx.card.findMany({
    where: { lorewardEntryId: { in: contest.map((entry) => entry.id) }, lorewardEdition: place },
    select: { id: true, title: true, isRetired: true, metadata: true },
    orderBy: { id: "asc" },
  });
  const ref = placeOf({ ...lead, ...fields }, place);
  const target = ref && {
    ref,
    text: trophyCardText(type, lead.date, place, ref.wikiUser, ref.page),
  };
  const entriesAgree = contest.every((entry) => samePlace(entry, fields, place));
  if (entriesAgree && cards.every((card) => cardRecords(card, target))) return [];

  const held: HeldTrophy[] = [];
  for (const card of cards) held.push({ card, copies: await liveCopiesTx(tx, card.id) });
  const label = `${type} ${place} of ${lead.date}`;
  const outcomes: Outcome[] = [];
  if (!target) {
    for (const trophy of held) outcomes.push(await voidTrophyTx(tx, actor, trophy, label));
    return outcomes;
  }
  if (held.length === 0) return outcomes;
  const userId = await resolveLorewardPlace(tx, target.ref);
  const keeper = keeperOf(held, userId);
  const realmId = await articleHomeRealm(tx, "ixwiki", target.text.title);
  const next = { ...target, realmId, label };
  for (const trophy of held) {
    outcomes.push(
      trophy === keeper
        ? await reassignTrophyTx(tx, actor, trophy, next, userId)
        : await duplicateTrophyTx(tx, actor, trophy, next, keeper.card.id)
    );
  }
  return outcomes;
}

/** One override: the contest's key, the fields, and the status to give its entries (kept when left out). */
interface OverrideInput {
  date: string;
  type: LorewardType;
  fields: LorewardOverride;
  status?: string;
}

/**
 * Refuses an override that leaves out a place its entries disagree on: keeping "the stored value" would silently pick
 * one record's holder, and the mark would then freeze it.
 */
function assertPlacesSettled(contest: Contest<ContestRow>, fields: LorewardOverride): void {
  for (const place of PLACES) {
    if (placeTouched(fields, place)) continue;
    if (contest.every((entry) => samePlace(entry, contest[0], place))) continue;
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `The two records of this contest disagree on the ${place}. Set the ${place} too.`,
    });
  }
}

/**
 * Writes the override to every entry of its contest, marked `overriddenAt` (creating the entry, approved, when the
 * contest has none), under both places' contest locks, then reconciles the trophy of each place it sets.
 */
async function overrideTx(
  tx: Tx,
  actor: CardAdminActor,
  input: OverrideInput
): Promise<{ entryIds: string[]; outcomes: Outcome[]; written: EntryFields }> {
  const key = { date_type: { date: input.date, type: input.type } };
  const keyed = await tx.lorewardEntry.findUnique({
    where: key,
    select: { type: true, date: true, dateStart: true },
  });
  const identity = keyed ?? { type: input.type, date: input.date, dateStart: null };
  for (const place of PLACES) await lockContestPlace(tx, contestPlaceKey(identity, place));
  const [first, ...rest] = await tx.lorewardEntry.findMany({
    where: contestEntriesWhere(identity),
    select: CONTEST_ROW_SELECT,
    orderBy: { id: "asc" },
  });
  const marked = { overriddenAt: new Date(), ...(input.status ? { status: input.status } : {}) };
  if (!first) {
    const written = entryFields(input.fields, NOTHING_STORED);
    const created = await tx.lorewardEntry.upsert({
      where: key,
      create: { date: input.date, type: input.type, status: "approved", ...written, ...marked },
      update: { ...written, ...marked },
      select: { id: true },
    });
    return { entryIds: [created.id], outcomes: [], written };
  }

  const contest: Contest<ContestRow> = [first, ...rest];
  assertPlacesSettled(contest, input.fields);
  const lead = contest.find((entry) => entry.dateStart !== null) ?? first;
  const written = entryFields(input.fields, lead);
  const entryIds = contest.map((entry) => entry.id);
  await tx.lorewardEntry.updateMany({
    where: { id: { in: entryIds } },
    data: { ...written, ...marked },
  });
  const outcomes: Outcome[] = [];
  for (const place of PLACES) {
    // A place the override leaves out is left alone: its entries agree (`assertPlacesSettled`), and its card too
    if (!placeTouched(input.fields, place)) continue;
    const overridden = { contest, lead, type: input.type, fields: written };
    outcomes.push(...(await reconcilePlaceTx(tx, actor, overridden, place)));
  }
  return { entryIds, outcomes, written };
}

/** What an override did: the trophies it moved, voided and minted, and the eight fields it wrote. */
export interface LorewardOverrideResult {
  reassigned: number;
  voided: number;
  minted: number;
  mintDeferred: boolean;
  written: EntryFields;
}

/**
 * Overrides a Loreward contest's winner and runner-up, and takes each place's trophy with it (reassigned or voided,
 * in one transaction with the write), then mints the trophy of any recorded place that has none. A failed mint only
 * defers it to the next sync (`mintDeferred`): the override and the trophies it moved stand.
 */
export async function overrideLorewardEntry(
  db: PrismaClient,
  actor: CardAdminActor,
  input: OverrideInput
): Promise<LorewardOverrideResult> {
  const { entryIds, outcomes, written } = await db.$transaction((tx) =>
    overrideTx(tx, actor, input)
  );
  let minted = 0;
  let mintDeferred = false;
  try {
    ({ minted } = await mintTrophyCards(db, entryIds));
  } catch (error) {
    console.error(
      "[cards.trophies] Minting the override's trophies failed; the next sync mints them:",
      error
    );
    mintDeferred = true;
  }
  return {
    reassigned: outcomes.filter((outcome) => outcome === "REASSIGNED").length,
    voided: outcomes.filter((outcome) => outcome === "VOIDED").length,
    minted,
    mintDeferred,
    written,
  };
}
