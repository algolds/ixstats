/** @jest-environment node */
/**
 * The account export (Privacy 5.1 "Export"): one JSON object of everything the user put in or that
 * identifies them, read by `users.exportUserData`. Never tokens, verification codes, other users'
 * messages or other users' ids.
 */
import { buildAccountExport } from "~/server/orchestration/account-export";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const CLERK = "user_clerk1";
const DB_ID = "db_1";
const identity = jest.fn(async () => ({ email: "alex@example.com", username: "alex" }));

function seededDb() {
  const db = createMockPrisma();
  db.user.findUnique.mockResolvedValue({
    id: DB_ID,
    clerkUserId: CLERK,
    countryId: "c_1",
    handle: "alex",
    membershipTier: "basic",
    createdAt: new Date(0),
    discordUserId: "123",
    discordUsername: "alex#1",
    lastDiscordSync: null,
    forumUsername: "Alex",
    forumUserId: 7,
    lastForumSync: null,
    role: { name: "user" },
  });
  db.thinkpagesAccount.findMany.mockResolvedValue([{ id: "p_1" }, { id: "p_2" }]);
  return db;
}

async function exportOf(db: ReturnType<typeof createMockPrisma>) {
  return buildAccountExport(db as never, CLERK, identity);
}

function selectOf(mock: jest.Mock) {
  return mock.mock.calls[0]?.[0]?.select as Record<string, unknown> | undefined;
}

describe("buildAccountExport", () => {
  beforeEach(() => identity.mockClear());

  it("puts the Clerk email and username on the account, without internal ids", async () => {
    const out = await exportOf(seededDb());
    expect(identity).toHaveBeenCalledWith(CLERK);
    expect(out.account).toMatchObject({
      email: "alex@example.com",
      username: "alex",
      handle: "alex",
      role: "user",
    });
    for (const key of ["id", "clerkUserId", "countryId", "roleId"]) {
      expect(out.account).not.toHaveProperty(key);
    }
  });

  it("lists linked accounts without wiki tokens or NationStates codes", async () => {
    const db = seededDb();
    db.wikiAccountLink.findMany.mockResolvedValue([
      { source: "iiwiki", username: "Alex", verifiedAt: null, createdAt: new Date(0) },
    ]);
    db.nSVerification.findMany.mockResolvedValue([{ nationName: "Alexia", verified: true }]);
    const out = await exportOf(db);

    expect(out.linkedAccounts.discord).toEqual({
      userId: "123",
      username: "alex#1",
      lastSync: null,
    });
    expect(out.linkedAccounts.forum).toMatchObject({ username: "Alex" });
    expect(out.linkedAccounts.wikis).toEqual([expect.objectContaining({ username: "Alex" })]);
    expect(out.linkedAccounts.nationStates).toEqual([
      expect.objectContaining({ nationName: "Alexia" }),
    ]);
    expect(selectOf(db.wikiAccountLink.findMany)).not.toHaveProperty("token");
    expect(selectOf(db.wikiAccountLink.findMany)).not.toHaveProperty("tokenExpiresAt");
    expect(selectOf(db.nSVerification.findMany)).not.toHaveProperty("verificationCode");
    expect(db.wikiAccountLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: DB_ID } })
    );
  });

  it("exports every ThinkPages post of every persona, with no cap", async () => {
    const db = seededDb();
    const out = await exportOf(db);
    expect(db.thinkpagesAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clerkUserId: CLERK } })
    );
    const [args] = db.thinkpagesPost.findMany.mock.calls[0];
    expect(args.where).toEqual({ accountId: { in: ["p_1", "p_2"] } });
    expect(args).not.toHaveProperty("take");
    expect(out.personas).toHaveLength(2);
  });

  it("matches sent messages by both the Clerk id and the database id", async () => {
    const db = seededDb();
    await exportOf(db);
    for (const mock of [db.thinkshareMessage.findMany, db.thinktankMessage.findMany]) {
      expect(mock).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: { in: [CLERK, DB_ID] } } })
      );
    }
  });

  it("reads forum, onoma, cards, claims and nations by the database id", async () => {
    const db = seededDb();
    await exportOf(db);
    expect(db.forumThread.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { authorUserId: DB_ID } })
    );
    expect(db.forumPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { authorUserId: DB_ID } })
    );
    for (const model of [
      "languagePack",
      "etymologyRoot",
      "grammarProfile",
      "writingSystem",
      "nameBank",
    ]) {
      expect(db[model].findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: DB_ID }, omit: { userId: true } })
      );
    }
    expect(db.cardOwnership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: DB_ID } })
    );
    expect(selectOf(db.cardOwnership.findMany)).not.toHaveProperty("inscribedById");
    expect(db.realmClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: DB_ID } })
    );
    expect(selectOf(db.realmClaim.findMany)).not.toHaveProperty("reviewedBy");
    expect(db.country.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ ownerUserId: DB_ID }, { id: "c_1" }] } })
    );
  });

  it("names the user's side of a trade and keeps only the message they wrote", async () => {
    const db = seededDb();
    db.tradeOffer.findMany.mockResolvedValue([
      {
        id: "t_1",
        initiatorId: DB_ID,
        recipientId: "db_2",
        proposerId: DB_ID,
        message: "mine",
        status: "PENDING",
      },
      {
        id: "t_2",
        initiatorId: "db_3",
        recipientId: DB_ID,
        proposerId: "db_3",
        message: "theirs",
        status: "PENDING",
      },
      // A counter rewrites the message and the proposer: the counterer wrote it, not the initiator.
      {
        id: "t_3",
        initiatorId: DB_ID,
        recipientId: "db_4",
        proposerId: "db_4",
        message: "counter",
        status: "COUNTERED",
      },
      {
        id: "t_4",
        initiatorId: "db_5",
        recipientId: DB_ID,
        proposerId: DB_ID,
        message: "my counter",
        status: "COUNTERED",
      },
    ]);
    const out = await exportOf(db);
    expect(out.trades).toEqual([
      expect.objectContaining({ id: "t_1", side: "initiator", message: "mine" }),
      expect.objectContaining({ id: "t_2", side: "recipient", message: null }),
      expect.objectContaining({ id: "t_3", side: "initiator", message: null }),
      expect.objectContaining({ id: "t_4", side: "recipient", message: "my counter" }),
    ]);
    expect(JSON.stringify(out.trades)).not.toMatch(/db_[2-5]/);
  });

  it("still exports when Clerk cannot be reached", async () => {
    const out = await buildAccountExport(seededDb() as never, CLERK, async () => ({
      email: null,
      username: null,
    }));
    expect(out.account).toMatchObject({ email: null, username: null, handle: "alex" });
  });

  it("returns empty sections for a Clerk user with no account row", async () => {
    const db = createMockPrisma();
    const out = await exportOf(db);
    expect(out.account).toMatchObject({ email: "alex@example.com" });
    expect(out.nations).toEqual([]);
    expect(out.trades).toEqual([]);
    expect(db.forumPost.findMany).not.toHaveBeenCalled();
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
  });
});
