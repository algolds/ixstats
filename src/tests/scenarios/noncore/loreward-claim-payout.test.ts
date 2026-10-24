/** @jest-environment node */
/**
 * A name claim pays and mints the name's Loreward places (design decisions 6, 7 and 19, and the owner's decision of
 * 2026-10-23 on revokes). "Old name" won a daily before the payout start (15 October 2026), a daily after it, and a
 * weekly that ends after it. The real claims service runs its default hooks on the in-memory Prisma:
 *
 * 1. a wrong claim is approved: the two places from 15 October are paid, and all three trophy cards are minted to it;
 * 2. the claim is revoked: the cards go back to the name, owned by no account, and the IxC stays paid;
 * 3. the right account's claim is approved: the cards move to it, and no place is paid a second time;
 * 4. running every hook and sync again changes nothing.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/cards/home-realm", () => ({
  articleHomeRealm: jest.fn().mockResolvedValue("default"),
}));

import type { ClaimApprovedEvent, ClaimRevokedEvent } from "~/lib/identity/claim-hooks";
import { lorewardsClaimHook, lorewardsRevokeHook } from "~/lib/lorewards/claim-hook";
import { settleLorewardPlaces } from "~/lib/lorewards/settle";
import { createNameClaimService } from "~/server/modules/identity/identity.name-claims";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addPlayer, addRealm, creditsOf } from "~/tests/helpers/money-world";

let db: MemoryPrisma;

const actor = (userId: string) => ({
  userId,
  clerkUserId: `${userId}-clerk`,
  isSystemOwner: false,
});
const admin = actor("admin");
/** The claims service with its default hooks: the Lorewards pay-and-mint and take-back hooks. */
const service = () => createNameClaimService(db);

const lorewardBonuses = () =>
  db.vaultTransaction.findMany({
    where: { type: "EARN_BONUS", source: { startsWith: "bonus:loreward:" } },
    select: { credits: true, source: true, vault: { select: { userId: true } } },
    orderBy: { credits: "asc" },
  });
const trophyCopies = () =>
  db.cardOwnership.findMany({
    where: { cards: { lorewardEntryId: { not: null } } },
    select: { id: true, cardId: true, ownerId: true, serialNumber: true },
    orderBy: { cardId: "asc" },
  });
const trophyCards = () =>
  db.card.findMany({
    where: { lorewardEntryId: { not: null } },
    select: { id: true, metadata: true, lorewardEntryId: true, lorewardEdition: true },
    orderBy: { id: "asc" },
  });
const ownersOfCopies = async () => (await trophyCopies()).map((copy) => copy.ownerId).sort();
const snapshot = async () => ({
  bonuses: await lorewardBonuses(),
  copies: await trophyCopies(),
  cards: await trophyCards(),
  credits: await creditsOf(db, ["wrong", "right", "other"]),
});

async function approveFor(userId: string) {
  const claim = await service().request(actor(userId), { name: "Old name", evidence: null });
  await service().approve(admin, { claimId: claim.id, note: null });
  return claim;
}

const approvedEvent = (claimId: string, userId: string): ClaimApprovedEvent => ({
  claimId,
  userId,
  source: "ixwiki",
  name: "Old name",
  approvedAt: new Date(),
  origin: "PLAYER",
});
const revokedEvent = (claimId: string, userId: string): ClaimRevokedEvent => ({
  claimId,
  userId,
  source: "ixwiki",
  name: "Old name",
  revokedAt: new Date(),
});

beforeEach(async () => {
  db = createMemoryPrisma();
  mockDb = db;
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  await addRealm(db, "default");
  for (const id of ["wrong", "right", "other", "admin"]) await addPlayer(db, id);
  const article = await db.wikiArticle.create({ data: { title: "Seneca front", wikitext: "" } });
  await db.wikiRevision.create({
    data: { id: "r1", articleId: article.id, author: "Old name", wikitext: "", source: "ixwiki" },
  });
  const won = { status: "approved", winnerUser: "Old name", winnerPage: "Seneca front" };
  await db.lorewardEntry.create({
    data: { id: "before", type: "daily", date: "2026-10-10", ...won },
  });
  await db.lorewardEntry.create({
    data: { id: "after", type: "daily", date: "2026-10-16", ...won },
  });
  await db.lorewardEntry.create({
    data: {
      id: "week",
      type: "weekly",
      date: "2026-W42",
      dateStart: "2026-10-12",
      dateEnd: "2026-10-18",
      ...won,
      // Another name's place in the same contest: the claim never pays or moves it
      runnerUpUser: "Bystander",
      runnerUpPage: "Other page",
    },
  });
});

it("pays the places from 15 October once and gives every place's trophy on approval, takes the trophies back on revoke, and hands them to the next owner without paying again", async () => {
  // 1. The wrong account's claim is approved
  const wrong = await approveFor("wrong");
  expect((await lorewardBonuses()).map((t) => [t.credits, t.vault.userId])).toEqual([
    [500, "wrong"],
    [1500, "wrong"],
  ]);
  expect(await ownersOfCopies()).toEqual(["wrong", "wrong", "wrong"]);
  expect(await db.card.count({ where: { lorewardEntryId: { not: null } } })).toBe(4); // the runner-up's waits
  expect(console.log).toHaveBeenCalledWith(
    `[Lorewards] claim ${wrong.id} (Old name): paid 2, minted 4, granted 0`
  );

  // 2. The claim is revoked: the cards are held for the name, and the IxC stays
  await service().revoke(admin, { claimId: wrong.id, note: "Wrong person" });
  expect(await trophyCopies()).toEqual([]);
  const nameCards = (await trophyCards()).filter((card) => card.lorewardEdition === "winner");
  expect(nameCards).toHaveLength(3);
  for (const card of nameCards) {
    expect(card.metadata).toMatchObject({ wikiUser: "Old name", grantedTo: null, grantedAt: null });
  }
  expect(await creditsOf(db, ["wrong"])).toEqual({ wrong: 2000 });
  expect(await lorewardBonuses()).toHaveLength(2);
  expect(console.log).toHaveBeenCalledWith(
    `[Lorewards] claim ${wrong.id} (Old name) revoked: took back 3, granted 0`
  );

  // 3. The right account's claim is approved: the cards move, nothing is paid again
  const right = await approveFor("right");
  const copies = await trophyCopies();
  expect(copies.map((copy) => copy.ownerId)).toEqual(["right", "right", "right"]);
  expect(copies.map((copy) => copy.serialNumber)).toEqual([1, 1, 1]); // a one-of-one's serial, reissued
  const paid = await lorewardBonuses();
  expect(paid.map((t) => t.vault.userId)).toEqual(["wrong", "wrong"]);
  expect(await creditsOf(db, ["wrong", "right"])).toEqual({ wrong: 2000, right: 0 });

  // 4. Every hook and sync again changes nothing
  const before = await snapshot();
  jest.mocked(console.log).mockClear();
  await lorewardsClaimHook(approvedEvent(right.id, "right"));
  await lorewardsRevokeHook(revokedEvent(wrong.id, "wrong"));
  await settleLorewardPlaces();
  await settleLorewardPlaces({ entryIds: ["before", "after", "week"] });
  expect(await snapshot()).toEqual(before);
  expect(console.log).not.toHaveBeenCalledWith(expect.stringMatching(/^\[Lorewards\] claim /));
});

it("pays nothing for a pending claim, and mints the trophies to wait unowned", async () => {
  await service().request(actor("right"), { name: "Old name", evidence: null });
  await settleLorewardPlaces();
  expect(await lorewardBonuses()).toEqual([]);
  expect(await trophyCopies()).toEqual([]);
  expect(await db.card.count({ where: { lorewardEntryId: { not: null } } })).toBe(4);
});

it("settles only the approved name's contests: a claim no hook ran for waits for the next sync", async () => {
  // A converted claim (the conversion runs no hooks) on a name with its own unpaid place
  await db.wikiNameClaim.create({
    data: {
      userId: "other",
      name: "Lone name",
      status: "APPROVED",
      origin: "ADMIN_LINK",
      requestedById: "admin",
    },
  });
  await db.lorewardEntry.create({
    data: {
      id: "lone",
      type: "daily",
      date: "2026-10-17",
      status: "approved",
      winnerUser: "Lone name",
    },
  });
  await approveFor("wrong");
  expect(await creditsOf(db, ["other"])).toEqual({ other: 0 });
  expect(await db.card.count({ where: { lorewardEntryId: "lone" } })).toBe(0);

  await settleLorewardPlaces();
  expect(await creditsOf(db, ["other"])).toEqual({ other: 500 });
});

it("leaves the trophies of an account that holds the name again when a stale revoke hook runs", async () => {
  const first = await approveFor("wrong");
  await createNameClaimService(db, { revokedHooks: [] }).revoke(admin, {
    claimId: first.id,
    note: null,
  });
  await approveFor("wrong");
  expect(await ownersOfCopies()).toEqual(["wrong", "wrong", "wrong"]);

  const before = await snapshot();
  await lorewardsRevokeHook(revokedEvent(first.id, "wrong"));
  expect(await snapshot()).toEqual(before);
});

it("hands the trophies to the next owner when the revoke hook runs only after the next approval", async () => {
  const wrong = await approveFor("wrong");
  await createNameClaimService(db, { revokedHooks: [] }).revoke(admin, {
    claimId: wrong.id,
    note: null,
  });
  await approveFor("right"); // its hook finds the cards still on the wrong account, granted
  expect(await ownersOfCopies()).toEqual(["wrong", "wrong", "wrong"]);

  await lorewardsRevokeHook(revokedEvent(wrong.id, "wrong"));
  expect(await ownersOfCopies()).toEqual(["right", "right", "right"]);
  expect((await lorewardBonuses()).map((t) => t.vault.userId)).toEqual(["wrong", "wrong"]);
});

it("never moves another name's trophy in the same contest", async () => {
  const bystander = await service().request(actor("other"), { name: "Bystander", evidence: null });
  await service().approve(admin, { claimId: bystander.id, note: null });
  const wrong = await approveFor("wrong");
  await service().revoke(admin, { claimId: wrong.id, note: null });
  const left = await trophyCopies();
  expect(left.map((copy) => copy.ownerId)).toEqual(["other"]);
  expect((await creditsOf(db, ["other"])).other).toBe(400);
});

describe("an override that lands while the take-back waits for its locks", () => {
  /** Runs `work` once, just before the first transaction the next call opens: inside its read, before its locks. */
  function beforeFirstTransaction(work: () => Promise<void>) {
    const transaction = db.$transaction.bind(db);
    jest.spyOn(db, "$transaction").mockImplementationOnce((async (
      ...args: Parameters<typeof transaction>
    ) => {
      await work();
      return transaction(...args);
    }) as typeof transaction);
  }

  async function revokedWithCardsHeld() {
    const wrong = await approveFor("wrong");
    await createNameClaimService(db, { revokedHooks: [] }).revoke(admin, {
      claimId: wrong.id,
      note: null,
    });
    return wrong;
  }

  it("leaves a place the override gave to another name the account holds", async () => {
    await service().adminLink(admin, {
      userId: "wrong",
      name: "Second name",
      note: null,
      mwUserId: null,
    });
    const wrong = await revokedWithCardsHeld();
    const before = await trophyCopies();
    beforeFirstTransaction(async () => {
      await db.lorewardEntry.updateMany({ data: { winnerUser: "Second name" } });
    });
    await lorewardsRevokeHook(revokedEvent(wrong.id, "wrong"));
    expect(await trophyCopies()).toEqual(before); // the same copies: none voided and reissued
  });

  it("never takes a copy the override moved to another account", async () => {
    const wrong = await revokedWithCardsHeld();
    beforeFirstTransaction(async () => {
      await db.cardOwnership.updateMany({ data: { ownerId: "other" } });
    });
    await lorewardsRevokeHook(revokedEvent(wrong.id, "wrong"));
    expect(await ownersOfCopies()).toEqual(["other", "other", "other"]);
  });
});
