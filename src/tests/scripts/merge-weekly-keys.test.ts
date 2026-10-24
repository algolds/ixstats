/** @jest-environment node */
/** The weekly merge script: its flags, what it reads, and one merge applied under the contest's locks. */
import type { PrismaClient } from "@prisma/client";
import {
  applyWeeklyMerge,
  loadWeeklyPlan,
  parseMergeArgs,
} from "../../../scripts/lorewards/merge-weekly-keys";
import { lorewardBonusKey } from "~/lib/vault/vault-bonus";
import { createMemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addPlayer, addRealm } from "~/tests/helpers/money-world";

type MemoryDb = ReturnType<typeof createMemoryPrisma>;
const asClient = (db: MemoryDb) => db as unknown as PrismaClient;

const W30 = { date: "2026-W30", dateStart: "2026-07-20", dateEnd: "2026-07-26" };

async function seedTwins(db: MemoryDb): Promise<void> {
  await db.lorewardEntry.create({
    data: { id: "b", date: "2026-07-20", type: "weekly", winnerUser: "Galata" },
  });
  await db.lorewardEntry.create({
    data: { id: "a", type: "weekly", ...W30, winnerUser: "Galata" },
  });
  await addRealm(asClient(db), "default");
}

async function seedCard(db: MemoryDb, entryId: string, edition: string): Promise<void> {
  await db.card.create({
    data: {
      id: `card-${entryId}-${edition}`,
      title: "Weekly Loreward",
      rarity: "LEGENDARY",
      cardType: "TROPHY",
      realmId: "default",
      lorewardEntryId: entryId,
      lorewardEdition: edition,
      metadata: { contest: "weekly", place: edition, entryId, wikiUser: "Galata" },
    },
  });
}

it("dry-runs unless --apply, and --dry-run wins", () => {
  expect(parseMergeArgs([])).toEqual({ apply: false });
  expect(parseMergeArgs(["--apply"])).toEqual({ apply: true });
  expect(parseMergeArgs(["--apply", "--dry-run"])).toEqual({ apply: false });
});

it("moves the loser's card to the survivor, deletes the loser and re-keys the survivor under the contest locks", async () => {
  const db = createMemoryPrisma();
  await seedTwins(db);
  await seedCard(db, "a", "winner");
  const merged = await applyWeeklyMerge(asClient(db), {
    key: W30,
    survivorId: "b",
    loserIds: ["a"],
    fill: { winnerPage: "Galatan Empire" },
  });
  expect(merged).toBe(true);
  expect(await db.lorewardEntry.findMany({ where: { type: "weekly" } })).toEqual([
    expect.objectContaining({ id: "b", ...W30, winnerPage: "Galatan Empire" }),
  ]);
  const card = await db.card.findFirst({ where: { lorewardEdition: "winner" } });
  expect(card?.lorewardEntryId).toBe("b");
  expect(card?.metadata).toEqual({
    contest: "weekly",
    place: "winner",
    entryId: "b",
    wikiUser: "Galata",
  });
  expect(db.store.log.filter((l) => l.kind === "advisory").map((l) => l.key)).toEqual([
    "weekly:2026-07-20:winner",
    "weekly:2026-07-20:runner-up",
  ]);
});

it("renames a lone row", async () => {
  const db = createMemoryPrisma();
  await db.lorewardEntry.create({ data: { id: "h", date: "2023-01-01", type: "weekly" } });
  const key = { date: "2023-W01", dateStart: "2023-01-01", dateEnd: "2023-01-07" };
  expect(
    await applyWeeklyMerge(asClient(db), { key, survivorId: "h", loserIds: [], fill: {} })
  ).toBe(true);
  expect(await db.lorewardEntry.findUnique({ where: { id: "h" } })).toEqual(
    expect.objectContaining(key)
  );
});

it("skips a merge whose rows changed since the plan, and writes nothing", async () => {
  const db = createMemoryPrisma();
  await seedTwins(db);
  const gone = { key: W30, survivorId: "b", loserIds: ["a", "c"], fill: {} };
  expect(await applyWeeklyMerge(asClient(db), gone)).toBe(false);
  expect(await db.lorewardEntry.count({ where: { type: "weekly" } })).toBe(2);
});

it("skips a merge whose loser was paid since the plan, so the payout keeps its entry", async () => {
  const db = createMemoryPrisma();
  await seedTwins(db);
  await addPlayer(asClient(db), "p1", 0);
  const vault = await db.myVault.findFirstOrThrow({ where: { userId: "p1" } });
  await db.vaultTransaction.create({
    data: {
      vaultId: vault.id,
      credits: 500,
      balanceAfter: 500,
      type: "EARN_BONUS",
      source: lorewardBonusKey("a", "runner-up"),
    },
  });
  expect(
    await applyWeeklyMerge(asClient(db), { key: W30, survivorId: "b", loserIds: ["a"], fill: {} })
  ).toBe(false);
  expect(await db.lorewardEntry.count({ where: { type: "weekly" } })).toBe(2);
});

it("skips a merge whose survivor gained a card of the loser's edition, and moves nothing", async () => {
  const db = createMemoryPrisma();
  await seedTwins(db);
  await seedCard(db, "a", "winner");
  await seedCard(db, "b", "winner");
  expect(
    await applyWeeklyMerge(asClient(db), { key: W30, survivorId: "b", loserIds: ["a"], fill: {} })
  ).toBe(false);
  expect((await db.card.findUnique({ where: { id: "card-a-winner" } }))?.lorewardEntryId).toBe("a");
});

it("plans from every weekly row, the payouts under either place and the cards on each row", async () => {
  const db = createMemoryPrisma();
  await seedTwins(db);
  await db.lorewardEntry.create({
    data: { id: "d", date: "2026-07-20", type: "daily", winnerUser: "Kir" },
  });
  await db.lorewardEntry.create({
    data: { id: "c", date: "2026-07-27", type: "weekly", status: "pending", winnerUser: "Urcea" },
  });
  await db.lorewardEntry.create({
    data: {
      id: "e",
      type: "weekly",
      date: "2026-W31",
      dateStart: "2026-07-27",
      dateEnd: "2026-08-02",
      winnerUser: "Urcea",
    },
  });
  await addPlayer(asClient(db), "p1", 0);
  const vault = await db.myVault.findFirstOrThrow({ where: { userId: "p1" } });
  await db.vaultTransaction.create({
    data: {
      vaultId: vault.id,
      credits: 1,
      balanceAfter: 1,
      type: "EARN_BONUS",
      source: lorewardBonusKey("c", "runner-up"),
    },
  });
  await seedCard(db, "b", "winner");

  const plan = await loadWeeklyPlan(asClient(db));
  expect(plan.merges).toEqual([
    { key: W30, survivorId: "b", loserIds: ["a"], fill: {} },
    {
      key: { date: "2026-W31", dateStart: "2026-07-27", dateEnd: "2026-08-02" },
      survivorId: "c",
      loserIds: ["e"],
      fill: {},
    },
  ]);
});
