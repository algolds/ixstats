/** @jest-environment node */
/** Special card definitions: event cards, and the bound reward cards achievements award. */
import { Prisma } from "@prisma/client";
import {
  SpecialCardSchema,
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
});

describe("saveSpecialCard on a card players hold", () => {
  const fixed = {
    code: "PRECONDITION_FAILED",
    message: "Players hold copies of this card, so its kind and binding are fixed.",
  };
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
});
