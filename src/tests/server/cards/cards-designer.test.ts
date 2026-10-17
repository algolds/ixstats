/** @jest-environment node */
/** Special card definitions: event cards, and the bound reward cards achievements award. */
import { Prisma } from "@prisma/client";
import {
  SpecialCardSchema,
  listSpecialCards,
  rewardAchievementOptions,
  saveSpecialCard,
} from "~/server/modules/cards/cards.designer";
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

/** A stored card as the edit's pre-read selects it: by default an event card nobody holds. */
const stored = (card: Record<string, unknown>, copies = 0) => ({
  id: "card_1",
  cardType: "SPECIAL",
  specialKind: "EVENT",
  isBound: false,
  rewardAchievementKey: null,
  _count: { CardOwnership: copies },
  ...card,
});

describe("SpecialCardSchema", () => {
  it("takes an event card, bound or not, with no achievement", () => {
    expect(SpecialCardSchema.safeParse(event).success).toBe(true);
    expect(SpecialCardSchema.safeParse({ ...event, isBound: true }).success).toBe(true);
    expect(
      SpecialCardSchema.safeParse({ ...event, rewardAchievementKey: "gen-one-year" }).success
    ).toBe(false);
  });

  it("needs an achievement reward to name its achievement and be bound", () => {
    const named = { ...reward, rewardAchievementKey: "gen-one-year" };
    expect(SpecialCardSchema.safeParse(named).success).toBe(true);
    expect(SpecialCardSchema.safeParse({ ...named, isBound: false }).success).toBe(false);
    expect(SpecialCardSchema.safeParse({ ...named, rewardAchievementKey: null }).success).toBe(
      false
    );
  });

  it("has no rarity outside the six", () => {
    expect(SpecialCardSchema.safeParse({ ...event, rarity: "MYTHIC" }).success).toBe(false);
  });

  it("takes art from an https address only", () => {
    const art = (artwork: string) => SpecialCardSchema.safeParse({ ...event, artwork }).success;
    expect(art("https://ixwiki.com/images/gala.png")).toBe(true);
    expect(art("javascript:alert(1)")).toBe(false);
    expect(art("http://example.com/gala.png")).toBe(false);
  });
});

describe("rewardAchievementOptions", () => {
  it("lists live achievements, leaving out retired ones and the recruiter ladder, which pays nothing", () => {
    const ids = rewardAchievementOptions().map((option) => option.id);
    expect(ids).toContain("gen-one-year");
    expect(ids).not.toContain("econ-first-million");
    expect(ids).not.toContain("social-recruiter");
  });
});

describe("listSpecialCards", () => {
  it("reads Special cards only", async () => {
    const db = createMockPrisma();
    await listSpecialCards(db as never);
    expect(db.card.findMany.mock.calls[0]![0].where).toEqual({ cardType: "SPECIAL" });
  });
});

describe("saveSpecialCard", () => {
  it("creates an approved Special card in its realm", async () => {
    const db = mockDb();
    db.systemConfig.findUnique.mockResolvedValue(null);
    db.card.create.mockResolvedValue({ id: "card_new" });
    await expect(
      saveSpecialCard(db as never, actor, SpecialCardSchema.parse(event))
    ).resolves.toEqual({ id: "card_new" });
    expect(db.card.create.mock.calls[0]![0].data).toMatchObject({
      title: "Founders' gala",
      cardType: "SPECIAL",
      category: "SPECIAL",
      season: 1,
      specialKind: "EVENT",
      realmId: "default",
      isBound: false,
      rewardAchievementKey: null,
      reviewState: "APPROVED",
    });
    expect(db.auditLog.create.mock.calls[0]![0].data).toMatchObject({
      action: "CARD_SPECIAL_SAVE",
      userId: "clerk_admin",
      target: "card_new",
    });
  });

  it("edits a Special card in place, leaving its season, type and review alone; with no copies, its kind can change", async () => {
    const db = mockDb();
    db.card.findUnique.mockResolvedValue(stored({}));
    db.card.update.mockResolvedValue({ id: "card_1" });
    const key = rewardAchievementOptions()[0]!.id;
    await saveSpecialCard(
      db as never,
      actor,
      SpecialCardSchema.parse({ ...reward, id: "card_1", rewardAchievementKey: key })
    );
    const { where, data } = db.card.update.mock.calls[0]![0];
    expect(where).toEqual({ id: "card_1" });
    // The serial lock is taken before the copies are counted, so no mint slips in between
    expect(db.$executeRaw).toHaveBeenCalled();
    expect(db.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.card.findUnique.mock.invocationCallOrder[0]!
    );
    expect(data).toMatchObject({
      specialKind: "ACHIEVEMENT_REWARD",
      rewardAchievementKey: key,
      isBound: true,
    });
    for (const field of ["season", "cardType", "reviewState"])
      expect(data).not.toHaveProperty(field);
    expect(db.card.create).not.toHaveBeenCalled();
    expect(db.auditLog.create.mock.calls[0]![0].data.details).toMatch(/^Edited/);
  });

  it("refuses to edit a card that is gone or not a Special card", async () => {
    const db = mockDb();
    const edit = SpecialCardSchema.parse({ ...event, id: "card_1" });
    await expect(saveSpecialCard(db as never, actor, edit)).rejects.toThrow(/no longer exists/);
    db.card.findUnique.mockResolvedValue(stored({ cardType: "LORE" }));
    await expect(saveSpecialCard(db as never, actor, edit)).rejects.toThrow(/no longer exists/);
    expect(db.card.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
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

  it("keeps a retired achievement on an edit that does not change it, and refuses one newly chosen", async () => {
    const db = mockDb();
    db.card.update.mockResolvedValue({ id: "card_1" });
    const retired = { ...reward, id: "card_1", rewardAchievementKey: "econ-first-million" };
    db.card.findUnique.mockResolvedValue(
      stored({
        specialKind: "ACHIEVEMENT_REWARD",
        isBound: true,
        rewardAchievementKey: "econ-first-million",
      })
    );
    await saveSpecialCard(
      db as never,
      actor,
      SpecialCardSchema.parse({ ...retired, title: "Renamed" })
    );
    expect(db.card.update.mock.calls[0]![0].data).toMatchObject({ title: "Renamed" });

    db.card.findUnique.mockResolvedValue(
      stored({
        specialKind: "ACHIEVEMENT_REWARD",
        isBound: true,
        rewardAchievementKey: "gen-one-year",
      })
    );
    await expect(
      saveSpecialCard(db as never, actor, SpecialCardSchema.parse(retired))
    ).rejects.toThrow(/No such achievement/);
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

  it("says so when the chosen realm is gone", async () => {
    const db = mockDb();
    db.card.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("fk", { code: "P2003", clientVersion: "6" })
    );
    await expect(
      saveSpecialCard(db as never, actor, SpecialCardSchema.parse(event))
    ).rejects.toThrow(/or its realm, no longer exists/);
  });

  it("passes on any other database error", async () => {
    const db = mockDb();
    db.card.create.mockRejectedValue(duplicateKey("slug"));
    await expect(
      saveSpecialCard(db as never, actor, SpecialCardSchema.parse(event))
    ).rejects.toThrow("dup");
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

  it("saves a held card with no kind as the event card it opens as", async () => {
    const db = mockDb();
    db.card.findUnique.mockResolvedValue(stored({ specialKind: null }, 2));
    db.card.update.mockResolvedValue({ id: "card_1" });
    await expect(
      saveSpecialCard(
        db as never,
        actor,
        SpecialCardSchema.parse({ ...event, id: "card_1", title: "Founders' ball" })
      )
    ).resolves.toEqual({ id: "card_1" });
    expect(db.card.update.mock.calls[0]![0].data).toMatchObject({ title: "Founders' ball" });
    db.card.findUnique.mockResolvedValue(stored({ specialKind: null }, 2));
    await expect(
      saveSpecialCard(
        db as never,
        actor,
        SpecialCardSchema.parse({ ...reward, id: "card_1", rewardAchievementKey: "gen-one-year" })
      )
    ).rejects.toMatchObject(fixed);
  });

  it("still saves every other field", async () => {
    const db = mockDb();
    db.card.findUnique.mockResolvedValue(heldReward);
    db.card.update.mockResolvedValue({ id: "card_1" });
    const edit = {
      ...sameReward,
      title: "Veteran of the realm",
      description: "Two years now.",
      rarity: "LEGENDARY",
      artwork: "https://ixwiki.com/images/veteran.png",
    } as const;
    await expect(
      saveSpecialCard(db as never, actor, SpecialCardSchema.parse(edit))
    ).resolves.toEqual({
      id: "card_1",
    });
    expect(db.card.update.mock.calls[0]![0].data).toMatchObject({
      title: "Veteran of the realm",
      description: "Two years now.",
      rarity: "LEGENDARY",
      artwork: "https://ixwiki.com/images/veteran.png",
      specialKind: "ACHIEVEMENT_REWARD",
      isBound: true,
      rewardAchievementKey: "gen-one-year",
    });
  });
});
