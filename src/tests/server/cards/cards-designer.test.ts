/** @jest-environment node */
/** Special card definitions: event cards, and the bound reward cards achievements award. */
import { Prisma } from "@prisma/client";
import {
  SpecialCardSchema,
  rewardAchievementOptions,
  saveSpecialCard,
} from "~/server/modules/cards/cards.designer";
import { CARD_VALUATION_DEFAULTS, referenceValue } from "~/lib/cards/valuation";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const actor = { dbId: "db_admin", clerkId: "clerk_admin" };
const event = {
  title: "Founders' gala",
  rarity: "EPIC",
  kind: "EVENT",
  realmId: "default",
  isBound: false,
} as const;
const reward = { ...event, kind: "ACHIEVEMENT_REWARD", isBound: true } as const;

const duplicateKey = (field: string) =>
  new Prisma.PrismaClientKnownRequestError("dup", {
    code: "P2002",
    clientVersion: "6",
    meta: { target: [field] },
  });

/** A client whose `$executeRaw` takes the card's serial lock, as an edit does. */
const mockDb = () => createMockPrisma({ $executeRaw: jest.fn().mockResolvedValue(1) });

/** A stored card as the edit's pre-read selects it: by default an epic event card nobody holds. */
const stored = (card: Record<string, unknown>, copies = 0) => ({
  id: "card_1",
  cardType: "SPECIAL",
  rarity: "EPIC",
  specialKind: "EVENT",
  isBound: false,
  rewardAchievementKey: null,
  artwork: null,
  wikiSource: null,
  artLicence: null,
  _count: { CardOwnership: copies, takedowns: 0 },
  ...card,
});

describe("SpecialCardSchema", () => {
  it("needs an achievement reward to name its achievement and be bound", () => {
    const named = { ...reward, rewardAchievementKey: "gen-one-year" };
    expect(SpecialCardSchema.safeParse(named).success).toBe(true);
    expect(SpecialCardSchema.safeParse({ ...named, isBound: false }).success).toBe(false);
    expect(SpecialCardSchema.safeParse({ ...named, rewardAchievementKey: null }).success).toBe(
      false
    );
  });
  it("takes art from an https address only", () => {
    const art = (artwork: string) => SpecialCardSchema.safeParse({ ...event, artwork }).success;
    expect(art("https://ixwiki.com/images/gala.png")).toBe(true);
    expect(art("javascript:alert(1)")).toBe(false);
    expect(art("http://example.com/gala.png")).toBe(false);
  });
});
describe("saveSpecialCard", () => {
  it("leaves art a takedown or a restricted licence hides to Compliance, and saves the rest", async () => {
    const db = mockDb();
    db.card.update.mockResolvedValue({ id: "card_1" });
    const edit = (artwork: string | null) =>
      saveSpecialCard(
        db as never,
        actor,
        SpecialCardSchema.parse({ ...event, id: "card_1", artwork })
      );
    const art = "https://ixwiki.com/images/gala.png";
    for (const held of [
      stored({ _count: { CardOwnership: 0, takedowns: 1 } }),
      stored({ artwork: art, artLicence: { status: "RESTRICTED" } }),
    ]) {
      db.card.findUnique.mockResolvedValue(held);
      await expect(edit("https://ixwiki.com/images/other.png")).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: expect.stringMatching(/from Compliance/),
      });
    }
    expect(db.card.update).not.toHaveBeenCalled();
    await expect(edit(art)).resolves.toEqual({ id: "card_1" });
    db.card.findUnique.mockResolvedValue(stored({ _count: { CardOwnership: 0, takedowns: 1 } }));
    await expect(edit(null)).resolves.toEqual({ id: "card_1" });
  });
  it("refuses an achievement that does not exist, and a second card for one achievement", async () => {
    const db = mockDb();
    await expect(
      saveSpecialCard(
        db as never,
        actor,
        SpecialCardSchema.parse({ ...reward, rewardAchievementKey: "no-such-achievement" })
      )
    ).rejects.toThrow(/No such achievement/);

    db.card.create.mockRejectedValue(duplicateKey("rewardAchievementKey"));
    const key = rewardAchievementOptions()[0]!.id;
    await expect(
      saveSpecialCard(
        db as never,
        actor,
        SpecialCardSchema.parse({ ...reward, rewardAchievementKey: key })
      )
    ).rejects.toThrow(/already this achievement's reward/);
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
  it("leaves the old seed's rows alone until the Special card import has run", async () => {
    const db = mockDb();
    db.card.findUnique.mockResolvedValue(
      stored({ id: "card-achievement-veteran", specialKind: null, isBound: true }, 0)
    );
    await expect(
      saveSpecialCard(
        db as never,
        actor,
        SpecialCardSchema.parse({ ...event, id: "card-achievement-veteran" })
      )
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringMatching(/Special card import/),
    });
    expect(db.card.update).not.toHaveBeenCalled();
  });
});

describe("saveSpecialCard's card value", () => {
  /** A client whose transaction runs on its own client, so a read inside it is told apart from one outside. */
  const transacting = () => {
    const tx = mockDb();
    const db = createMockPrisma({
      $transaction: jest.fn((work: (client: typeof tx) => Promise<object>) => work(tx)),
    });
    return { db, tx };
  };

  it("values a new card as the revalue does, at its rarity's floor times the Special multiplier", async () => {
    const { db, tx } = transacting();
    tx.card.create.mockResolvedValue({ id: "card_new" });
    await saveSpecialCard(
      db as never,
      actor,
      SpecialCardSchema.parse({ ...event, rarity: "RARE" })
    );
    await saveSpecialCard(db as never, actor, SpecialCardSchema.parse(event));
    // The default config: rare 100 × 2, epic 1,000 × 2
    expect(tx.card.create.mock.calls[0]![0].data).toMatchObject({
      rarity: "RARE",
      marketValue: 200,
    });
    expect(tx.card.create.mock.calls[1]![0].data).toMatchObject({
      rarity: "EPIC",
      marketValue: 2000,
    });
    expect(tx.card.create.mock.calls[0]![0].data.marketValue).toBe(
      referenceValue(
        {
          rarity: "RARE",
          cardType: "SPECIAL",
          firstSoldAt: null,
          nsBankValue: null,
          isRetired: false,
        },
        null,
        CARD_VALUATION_DEFAULTS
      )
    );
  });

  it("reads the valuation config inside the transaction, past the cache", async () => {
    const { db, tx } = transacting();
    tx.card.create.mockResolvedValue({ id: "card_new" });
    tx.systemConfig.findMany.mockResolvedValue([
      { key: "card_valuation_mult_special", value: "3" },
    ]);
    await saveSpecialCard(
      db as never,
      actor,
      SpecialCardSchema.parse({ ...event, rarity: "RARE" })
    );
    expect(tx.card.create.mock.calls[0]![0].data.marketValue).toBe(300);
    expect(db.systemConfig.findMany).not.toHaveBeenCalled();
  });

  it("revalues an edit that changes the rarity, and leaves the value of one that does not", async () => {
    const { db, tx } = transacting();
    tx.card.update.mockResolvedValue({ id: "card_1" });
    tx.card.findUnique.mockResolvedValue(stored({}));
    await saveSpecialCard(
      db as never,
      actor,
      SpecialCardSchema.parse({
        ...event,
        id: "card_1",
        rarity: "LEGENDARY",
        reason: "Finale prize",
      })
    );
    expect(tx.card.update.mock.calls[0]![0].data).toMatchObject({
      rarity: "LEGENDARY",
      marketValue: 6000,
    });

    await saveSpecialCard(
      db as never,
      actor,
      SpecialCardSchema.parse({ ...event, id: "card_1", title: "Renamed gala" })
    );
    expect(tx.card.update.mock.calls[1]![0].data).not.toHaveProperty("marketValue");
    expect(tx.systemConfig.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("saveSpecialCard's rarity override", () => {
  const edit = (input: Record<string, unknown>) =>
    SpecialCardSchema.parse({ ...event, id: "card_1", rarity: "LEGENDARY", ...input });

  it("asks why an edit changes the rarity, and saves nothing without a reason", async () => {
    const db = mockDb();
    db.card.findUnique.mockResolvedValue(stored({}));
    for (const reason of [undefined, "", "   ", " a "]) {
      await expect(saveSpecialCard(db as never, actor, edit({ reason }))).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Say why the rarity changes.",
      });
    }
    expect(db.card.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("audits the override with its reason, as the Library does", async () => {
    const db = mockDb();
    db.card.findUnique.mockResolvedValue(stored({}));
    db.card.update.mockResolvedValue({ id: "card_1" });
    await saveSpecialCard(db as never, actor, edit({ reason: "  Season finale prize " }));
    expect(db.auditLog.create.mock.calls.map(([arg]: [{ data: object }]) => arg.data)).toEqual([
      expect.objectContaining({ action: "CARD_SPECIAL_SAVE", target: "card_1" }),
      expect.objectContaining({
        action: "CARD_RARITY_OVERRIDE",
        userId: "clerk_admin",
        target: "card_1",
        details: "Rarity EPIC → LEGENDARY: Season finale prize",
      }),
    ]);
  });
});

describe("saveSpecialCard on a card players hold", () => {
  const fixed = {
    code: "PRECONDITION_FAILED",
    message: "Players hold copies of this card, so its kind and binding are fixed.",
  };
  const heldReward = stored(
    { specialKind: "ACHIEVEMENT_REWARD", isBound: true, rewardAchievementKey: "gen-one-year" },
    3
  );
  const sameReward = { ...reward, id: "card_1", rewardAchievementKey: "gen-one-year" };

  it("refuses a switch of kind", async () => {
    const db = mockDb();
    db.card.findUnique.mockResolvedValue(heldReward);
    await expect(
      saveSpecialCard(db as never, actor, SpecialCardSchema.parse({ ...event, id: "card_1" }))
    ).rejects.toMatchObject(fixed);
    expect(db.card.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses a bound flip, either way", async () => {
    const db = mockDb();
    db.card.findUnique.mockResolvedValue(stored({}, 1));
    await expect(
      saveSpecialCard(
        db as never,
        actor,
        SpecialCardSchema.parse({ ...event, id: "card_1", isBound: true })
      )
    ).rejects.toMatchObject(fixed);
    db.card.findUnique.mockResolvedValue(stored({ isBound: true }, 1));
    await expect(
      saveSpecialCard(db as never, actor, SpecialCardSchema.parse({ ...event, id: "card_1" }))
    ).rejects.toMatchObject(fixed);
    expect(db.card.update).not.toHaveBeenCalled();
  });

  it("refuses pointing its reward at another achievement", async () => {
    const db = mockDb();
    db.card.findUnique.mockResolvedValue(heldReward);
    await expect(
      saveSpecialCard(
        db as never,
        actor,
        SpecialCardSchema.parse({ ...sameReward, rewardAchievementKey: "gen-first-country" })
      )
    ).rejects.toMatchObject(fixed);
  });
});
