/** @jest-environment node */
/**
 * SL-4: the server enforces the direct-message, mention and trade-offer audiences and muted
 * words. "followers" means the sender follows the recipient (a persona follow or a country
 * follow); "verified" means the sender owns a verified persona.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import {
  containsMutedKeyword,
  mutedKeywords,
  recipientsRefusing,
} from "~/server/shared/privacy-permissions";
import { createMessagingService } from "~/server/modules/messaging";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { dropMutedItems } from "~/server/api/routers/activities/feed/shared";

function withConfigs(configs: Record<string, Record<string, unknown> | string>) {
  const db = createMockPrisma();
  db.userConnection.findMany.mockImplementation(async (args: any) =>
    args.where.connectionType === "privacy_config"
      ? Object.entries(configs).map(([userId, cfg]) => ({
          userId,
          status: typeof cfg === "string" ? cfg : JSON.stringify(cfg),
        }))
      : []
  );
  return db;
}

describe("recipientsRefusing", () => {
  it("allows everyone by default and when no config is stored", async () => {
    const db = withConfigs({ r2: { directMessages: "everyone" }, r3: "not json" });
    expect(
      await recipientsRefusing(db as never, "s", ["r1", "r2", "r3"], "directMessages")
    ).toEqual([]);
  });

  it("refuses for nobody, but never refuses the sender themself", async () => {
    const db = withConfigs({ r1: { mentions: "nobody" }, s: { mentions: "nobody" } });
    expect(await recipientsRefusing(db as never, "s", ["s", "r1"], "mentions")).toEqual(["r1"]);
  });

  it("followers: accepts a persona follow or a country follow, refuses otherwise", async () => {
    const db = withConfigs({
      viaPersona: { directMessages: "followers" },
      viaCountry: { directMessages: "followers" },
      stranger: { directMessages: "followers" },
    });
    db.thinkpagesAccount.findMany.mockResolvedValue([
      { id: "acc_p", clerkUserId: "viaPersona" },
      { id: "acc_s", clerkUserId: "stranger" },
    ]);
    db.thinkpagesFollow.findMany.mockResolvedValue([{ followedAccountId: "acc_p" }]);
    db.user.findMany.mockResolvedValue([
      { clerkUserId: "s", countryId: "c_s" },
      { clerkUserId: "viaCountry", countryId: "c_v" },
      { clerkUserId: "stranger", countryId: "c_x" },
    ]);
    db.countryFollow.findMany.mockResolvedValue([{ followedCountryId: "c_v" }]);

    expect(
      await recipientsRefusing(
        db as never,
        "s",
        ["viaPersona", "viaCountry", "stranger"],
        "directMessages"
      )
    ).toEqual(["stranger"]);
    expect(db.thinkpagesFollow.findMany.mock.calls[0]![0].where).toEqual({
      followerClerkUserId: "s",
      followedAccountId: { in: ["acc_p", "acc_s"] },
    });
  });

  it("verified: needs a verified persona", async () => {
    const db = withConfigs({ r1: { directMessages: "verified" } });
    expect(await recipientsRefusing(db as never, "s", ["r1"], "directMessages")).toEqual(["r1"]);
    db.thinkpagesAccount.findFirst.mockResolvedValue({ id: "acc" });
    expect(await recipientsRefusing(db as never, "s", ["r1"], "directMessages")).toEqual([]);
  });
});

describe("muted words", () => {
  it("reads the viewer's keyword rows lower-cased", async () => {
    const db = createMockPrisma();
    db.userConnection.findMany.mockResolvedValue([
      { targetUserId: "election", status: "Election" },
      { targetUserId: null, status: "Tariffs" },
    ]);
    expect(await mutedKeywords(db as never, "viewer")).toEqual(["election", "tariffs"]);
    expect(db.userConnection.findMany.mock.calls[0]![0].where).toEqual({
      userId: "viewer",
      connectionType: "keyword",
    });
    expect(await mutedKeywords(db as never, null)).toEqual([]);
  });

  it("matches case-insensitively", () => {
    expect(containsMutedKeyword("The ELECTION is near", ["election"])).toBe(true);
    expect(containsMutedKeyword("Nothing here", ["election"])).toBe(false);
    expect(containsMutedKeyword(null, ["election"])).toBe(false);
  });
});

describe("messaging honours the direct-message setting", () => {
  function service(db: ReturnType<typeof createMockPrisma>) {
    return createMessagingService({
      db: db as never,
      notifications: { create: jest.fn() } as never,
      websocket: { broadcastToUsers: jest.fn() } as never,
    });
  }

  it("createConversation refuses a recipient who accepts DMs from nobody", async () => {
    const db = withConfigs({ r1: { directMessages: "nobody" } });
    await expect(
      service(db).createConversation("sender", { participantIds: ["r1"] } as never)
    ).rejects.toMatchObject({
      name: "MessagingBlockedError",
      message: "This user is not accepting direct messages from you",
    });
    expect(db.thinkshareConversation.create).not.toHaveBeenCalled();
  });

  it("sendMessage in a direct conversation is refused the same way", async () => {
    const db = withConfigs({ r1: { directMessages: "nobody" } });
    db.thinkshareConversation.findFirst.mockResolvedValue({ id: "c1", type: "direct" });
    db.conversationParticipant.findFirst.mockResolvedValue({ id: "p1", conversation: {} });
    db.conversationParticipant.findMany.mockResolvedValue([{ userId: "r1" }]);
    await expect(
      service(db).sendMessage("sender", { conversationId: "c1", content: "hi" } as never)
    ).rejects.toMatchObject({ name: "MessagingBlockedError" });
    expect(db.thinkshareMessage.create).not.toHaveBeenCalled();
  });
});

describe("dropMutedItems (activity and Following feeds)", () => {
  it("leaves out items whose title or text contains a muted word", () => {
    const items = [
      { id: "a", content: { title: "Election results", description: "..." } },
      { id: "b", content: { title: "Trade news", description: "tariffs rise" } },
      { id: "c", content: { title: "Sports", description: "a match" } },
    ];
    expect(dropMutedItems(items, ["election", "tariffs"]).map((i) => i.id)).toEqual(["c"]);
    expect(dropMutedItems(items, [])).toBe(items);
  });
});
