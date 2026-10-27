/** @jest-environment node */
/**
 * The conflict log: one row per collision, whichever wiki's cycle notices it first. A later loser of the same winner
 * joins the row once, a notice is marked once per person and channel, the trail revision is claimed once, and a row
 * the old "parked" records became has nobody left to tell.
 */
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { seedWikiosMode, WIKIOS_MODES } from "~/tests/helpers/wikios-modes";

let mockDb: MemoryPrisma;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));

import {
  decideCollision,
  type ChangeAuthor,
  type PageChange,
} from "~/lib/wiki-os/services/conflict-rule";
import {
  listConflicts,
  markNotified,
  markSettled,
  pendingRecipients,
  recordConflict,
  setTrailRevision,
} from "~/lib/wiki-os/services/conflict-log";

const author = (over: Partial<ChangeAuthor> = {}): ChangeAuthor => ({
  userId: null,
  classicName: null,
  ip: null,
  label: null,
  ...over,
});
const change = (over: Partial<PageChange> & Pick<PageChange, "side" | "ref">): PageChange => ({
  action: "edit",
  at: new Date("2026-10-24T10:00:00.000Z"),
  author: author(),
  ...over,
});

const winner = change({
  side: "classic",
  ref: "900",
  at: new Date("2026-10-24T10:05:00.000Z"),
  author: author({ classicName: "Zed" }),
});
const mine = change({ side: "wikios", ref: "rev-a", author: author({ userId: "u1" }) });
const theirs = change({
  side: "wikios",
  ref: "rev-b",
  at: new Date("2026-10-24T10:02:00.000Z"),
  author: author({ userId: "u2", classicName: "Bee" }),
});

const verdict = (incoming: PageChange, standing: PageChange, branch: PageChange[]) =>
  decideCollision("ixwiki", "Alpha", {
    incoming,
    standing,
    incomingBranch: incoming === winner ? [winner] : branch,
    standingBranch: standing === winner ? [winner] : branch,
  });
const input = (v: ReturnType<typeof verdict>) => ({
  source: "ixwiki",
  articleId: "art-1",
  title: "Alpha",
  verdict: v,
  baseRef: "800",
});

describe.each(WIKIOS_MODES)("the conflict log [%s]", (mode) => {
  let restoreMode: () => void = () => undefined;
  beforeEach(async () => {
    mockDb = createMemoryPrisma();
    restoreMode = await seedWikiosMode(mockDb, mode);
  });
  afterEach(() => restoreMode());

  describe("recordConflict", () => {
    describe("a classic loser that another WikiOS winner already overwrote", () => {
      const classicLoser = change({
        side: "classic",
        ref: "900",
        author: author({ classicName: "Zed" }),
      });
      const later = (ref: string, minutes: number) =>
        change({ side: "wikios", ref, at: new Date(Date.UTC(2026, 9, 24, 10, minutes)) });
      const wonBy = (wikios: PageChange) =>
        decideCollision("ixwiki", "art-1", {
          incoming: wikios,
          standing: classicLoser,
          incomingBranch: [wikios],
          standingBranch: [classicLoser],
        });

      it("joins that row, settled or not: the winner stays, nobody is told twice", async () => {
        const first = await recordConflict(mockDb, input(wonBy(later("w1", 10))));
        await markNotified(first.id, "name:Zed", "talk-page");
        await expect(markSettled(first.id)).resolves.toBe(true);

        const second = await recordConflict(mockDb, input(wonBy(later("w2", 20))));

        expect(second).toEqual({ id: first.id, created: false });
        expect(await mockDb.wikiConflict.count()).toBe(1);
        const row = await mockDb.wikiConflict.findUniqueOrThrow({ where: { id: first.id } });
        expect(row).toMatchObject({ winnerRef: "w1" });
        expect(row.settledAt).toBeInstanceOf(Date);
        expect(pendingRecipients(row)).toEqual([]);
      });

      it("only looks at rows of the same article", async () => {
        await recordConflict(mockDb, { ...input(wonBy(later("w1", 10))), articleId: "art-2" });

        const here = await recordConflict(mockDb, input(wonBy(later("w2", 20))));

        expect(here.created).toBe(true);
      });

      it("never joins an old park's row, which tells nobody", async () => {
        const legacy = await recordConflict(mockDb, input(wonBy(later("w1", 10))));
        await mockDb.wikiConflict.update({ where: { id: legacy.id }, data: { legacyPark: true } });

        const fresh = await recordConflict(mockDb, input(wonBy(later("w2", 20))));

        expect(fresh.created).toBe(true);
      });

      it("is another collision when the winner is classic's, or the loser another change", async () => {
        await recordConflict(mockDb, input(wonBy(later("w1", 10))));
        const otherLoser = change({
          side: "classic",
          ref: "901",
          author: author({ classicName: "Zed" }),
        });
        await recordConflict(
          mockDb,
          input(
            decideCollision("ixwiki", "art-1", {
              incoming: later("w2", 20),
              standing: otherLoser,
              incomingBranch: [later("w2", 20)],
              standingBranch: [otherLoser],
            })
          )
        );
        await recordConflict(mockDb, input(verdict(winner, mine, [mine])));

        expect(await mockDb.wikiConflict.count()).toBe(3);
      });
    });

    it("records one row per collision whichever side records it first", async () => {
      const fromMirror = verdict(winner, mine, [mine]);
      const fromInbound = verdict(mine, winner, [mine]);
      expect(fromMirror.key).toBe(fromInbound.key);

      const first = await recordConflict(mockDb, input(fromMirror));
      const second = await recordConflict(mockDb, input(fromInbound));

      expect(first.created).toBe(true);
      expect(second).toEqual({ id: first.id, created: false });
      expect(await mockDb.wikiConflict.count()).toBe(1);
      const row = await mockDb.wikiConflict.findUniqueOrThrow({ where: { id: first.id } });
      expect(row).toMatchObject({
        key: "ixwiki:Alpha:900",
        winnerSide: "classic",
        winnerAction: "edit",
        winnerRef: "900",
        baseRef: "800",
        articleId: "art-1",
        title: "Alpha",
        legacyPark: false,
        trailRevisionId: null,
      });
      expect(row.winnerAt).toEqual(winner.at);
    });

    it("a second loser of the same winner joins the row once", async () => {
      const first = await recordConflict(mockDb, input(verdict(winner, mine, [mine])));
      const joined = { ...input(verdict(winner, theirs, [mine, theirs])) };
      await recordConflict(mockDb, joined);
      await recordConflict(mockDb, joined);

      const { items } = await listConflicts({ limit: 10 });
      expect(items).toHaveLength(1);
      expect(items[0]!.id).toBe(first.id);
      expect(items[0]!.overwritten.map((c) => c.ref)).toEqual(["rev-a", "rev-b"]);
      expect(items[0]!.overwritten[1]!.at).toEqual(theirs.at);
      expect(items[0]!.winner.ref).toBe("900");
    });

    it("never rewrites the winner when a later record carries another one", async () => {
      const first = await recordConflict(mockDb, input(verdict(winner, mine, [mine])));
      const impostor = { ...winner, at: new Date("2026-10-24T11:00:00.000Z") };
      await recordConflict(mockDb, input(verdict(impostor, theirs, [theirs])));
      const row = await mockDb.wikiConflict.findUniqueOrThrow({ where: { id: first.id } });
      expect(row.winnerAt).toEqual(winner.at);
    });

    it("works inside a transaction", async () => {
      const made = await mockDb.$transaction((tx) =>
        recordConflict(tx, input(verdict(winner, mine, [mine])))
      );
      expect(made.created).toBe(true);
    });
  });

  describe("notices", () => {
    it("markNotified twice keeps one entry", async () => {
      const { id } = await recordConflict(mockDb, input(verdict(winner, mine, [mine])));
      await markNotified(id, "user:u1", "in-app");
      await markNotified(id, "user:u1", "in-app");
      await markNotified(id, "user:u1", "discord");
      const row = await mockDb.wikiConflict.findUniqueOrThrow({ where: { id } });
      const entries = row.notified as { key: string; channel: string; at: string }[];
      expect(entries.map((e) => `${e.key}/${e.channel}`)).toEqual([
        "user:u1/in-app",
        "user:u1/discord",
      ]);
      expect(Number.isNaN(Date.parse(entries[0]!.at))).toBe(false);
    });

    it("pendingRecipients leaves out the channels already told and the people with none left", async () => {
      const { id } = await recordConflict(mockDb, input(verdict(winner, theirs, [mine, theirs])));
      let row = await mockDb.wikiConflict.findUniqueOrThrow({ where: { id } });
      expect(pendingRecipients(row).map((r) => [r.key, r.channels])).toEqual([
        ["user:u1", ["in-app", "discord"]],
        ["user:u2", ["in-app", "discord", "talk-page"]],
      ]);

      await markNotified(id, "user:u1", "in-app");
      await markNotified(id, "user:u2", "in-app");
      await markNotified(id, "user:u2", "discord");
      await markNotified(id, "user:u2", "talk-page");
      row = await mockDb.wikiConflict.findUniqueOrThrow({ where: { id } });
      expect(pendingRecipients(row).map((r) => [r.key, r.channels])).toEqual([
        ["user:u1", ["discord"]],
      ]);
    });

    it("legacy rows have no pending recipients", async () => {
      const { id } = await recordConflict(mockDb, input(verdict(winner, mine, [mine])));
      await mockDb.wikiConflict.update({ where: { id }, data: { legacyPark: true } });
      const row = await mockDb.wikiConflict.findUniqueOrThrow({ where: { id } });
      expect(pendingRecipients(row)).toEqual([]);
    });
  });

  describe("settling", () => {
    it("markSettled settles a row only once nobody is left to tell", async () => {
      const { id } = await recordConflict(mockDb, input(verdict(winner, mine, [mine])));
      expect(await markSettled(id)).toBe(false);
      expect((await mockDb.wikiConflict.findUniqueOrThrow({ where: { id } })).settledAt).toBeNull();

      await markNotified(id, "user:u1", "in-app");
      await markNotified(id, "user:u1", "discord");
      expect(await markSettled(id)).toBe(true);
      expect(
        (await mockDb.wikiConflict.findUniqueOrThrow({ where: { id } })).settledAt
      ).toBeInstanceOf(Date);
    });

    it("a merge that adds a loser reopens a settled row; one that adds nothing leaves it settled", async () => {
      const { id } = await recordConflict(mockDb, input(verdict(winner, mine, [mine])));
      await markNotified(id, "user:u1", "in-app");
      await markNotified(id, "user:u1", "discord");
      await markSettled(id);

      await recordConflict(mockDb, input(verdict(winner, mine, [mine])));
      expect(
        (await mockDb.wikiConflict.findUniqueOrThrow({ where: { id } })).settledAt
      ).not.toBeNull();

      await recordConflict(mockDb, input(verdict(winner, theirs, [mine, theirs])));
      expect((await mockDb.wikiConflict.findUniqueOrThrow({ where: { id } })).settledAt).toBeNull();
    });
  });

  describe("setTrailRevision", () => {
    it("succeeds once", async () => {
      const { id } = await recordConflict(mockDb, input(verdict(winner, mine, [mine])));
      expect(await mockDb.$transaction((tx) => setTrailRevision(tx, id, "trail-1"))).toBe(true);
      expect(await mockDb.$transaction((tx) => setTrailRevision(tx, id, "trail-2"))).toBe(false);
      const row = await mockDb.wikiConflict.findUniqueOrThrow({ where: { id } });
      expect(row.trailRevisionId).toBe("trail-1");
    });
  });

  describe("listConflicts", () => {
    it("pages newest first, and by article", async () => {
      for (let n = 1; n <= 3; n += 1) {
        const w = change({
          side: "classic",
          ref: String(900 + n),
          at: new Date(2026, 9, 24, 10, n),
        });
        await recordConflict(mockDb, {
          ...input(verdict(w, mine, [mine])),
          articleId: n === 3 ? "art-2" : "art-1",
        });
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      const page1 = await listConflicts({ limit: 2 });
      expect(page1.items.map((c) => c.winner.ref)).toEqual(["903", "902"]);
      expect(page1.nextCursor).not.toBeNull();
      const page2 = await listConflicts({ limit: 2, cursor: page1.nextCursor! });
      expect(page2.items.map((c) => c.winner.ref)).toEqual(["901"]);
      expect(page2.nextCursor).toBeNull();
      const one = await listConflicts({ limit: 10, articleId: "art-2" });
      expect(one.items.map((c) => c.winner.ref)).toEqual(["903"]);
    });
  });
});
