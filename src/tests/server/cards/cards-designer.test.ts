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
    const db = createMockPrisma();
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

  it("edits a Special card in place, leaving its season, type and review alone", async () => {
    const db = createMockPrisma();
    db.card.findUnique.mockResolvedValue({ id: "card_1", cardType: "SPECIAL" });
    db.card.update.mockResolvedValue({ id: "card_1" });
    const key = rewardAchievementOptions()[0]!.id;
    await saveSpecialCard(
      db as never,
      actor,
      SpecialCardSchema.parse({ ...reward, id: "card_1", rewardAchievementKey: key })
    );
    const { where, data } = db.card.update.mock.calls[0]![0];
    expect(where).toEqual({ id: "card_1" });
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
    const db = createMockPrisma();
    const edit = SpecialCardSchema.parse({ ...event, id: "card_1" });
    await expect(saveSpecialCard(db as never, actor, edit)).rejects.toThrow(/no longer exists/);
    db.card.findUnique.mockResolvedValue({ id: "card_1", cardType: "LORE" });
    await expect(saveSpecialCard(db as never, actor, edit)).rejects.toThrow(/no longer exists/);
    expect(db.card.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses an achievement that does not exist, and a second card for one achievement", async () => {
    const db = createMockPrisma();
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

  it("says so when the chosen realm is gone", async () => {
    const db = createMockPrisma();
    db.card.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("fk", { code: "P2003", clientVersion: "6" })
    );
    await expect(
      saveSpecialCard(db as never, actor, SpecialCardSchema.parse(event))
    ).rejects.toThrow(/or its realm, no longer exists/);
  });

  it("passes on any other database error", async () => {
    const db = createMockPrisma();
    db.card.create.mockRejectedValue(duplicateKey("slug"));
    await expect(
      saveSpecialCard(db as never, actor, SpecialCardSchema.parse(event))
    ).rejects.toThrow("dup");
  });
});
