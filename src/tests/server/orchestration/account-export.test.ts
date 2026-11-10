/** @jest-environment node */
/**
 * The account export (Privacy 5.1 "Export"): one JSON object of everything the user put in or that
 * identifies them, read by `users.exportUserData`. Never tokens, verification codes, other users'
 * messages or other users' ids.
 */
import { buildAccountExport } from "~/server/orchestration/account-export";
import { addMember, addNation, addPersona, addRealm, forumDb } from "~/tests/helpers/forum-world";
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
    expect(out.stashes).toEqual([]);
    expect(out.comments).toEqual([]);
    expect(out.polls).toEqual({ created: [], pollsOnYourNations: [], votes: [] });
    expect(out.predictions).toEqual([]);
    expect(out.blurbs).toEqual([]);
    expect(out.documents).toEqual([]);
    expect(out.loreTeams).toEqual([]);
    expect(db.forumPost.findMany).not.toHaveBeenCalled();
    expect(db.cardOwnership.findMany).not.toHaveBeenCalled();
  });

  it("exports stashes, comments, polls, predictions, blurbs, documents and lore teams of the caller only", async () => {
    const mem = forumDb();
    const alice = await addMember(mem, "alice", { handle: "alice_h" });
    const bob = await addMember(mem, "bob", { handle: "bob_h" });
    await addRealm(mem, { id: "eurth", name: "Eurth", ownerClerkId: alice.clerkUserId });
    await addNation(mem, "n1", "eurth", "alice");
    await addNation(mem, "n2", "eurth", "bob");
    await addPersona(mem, "p-alice", alice, "n1", "Alice P");
    await addPersona(mem, "p-bob", bob, "n2", "Bob P");

    await mem.stash.create({
      data: {
        id: "st-alice",
        userId: alice.clerkUserId,
        name: "Saved",
        items: {
          create: {
            id: "si-alice",
            pageTitle: "Eurth",
            pageSlug: "eurth",
            annotations: {
              create: {
                id: "sa-alice",
                anchorSelector: "p",
                anchorOffset: 0,
                focusSelector: "p",
                focusOffset: 3,
                selectedText: "quote",
              },
            },
          },
        },
      },
    });
    await mem.stash.create({ data: { id: "st-bob", userId: bob.clerkUserId, name: "Bob Stash" } });

    await mem.wikiDiscussionThread.create({
      data: { id: "wdt-1", articleTitle: "Eurth", title: "Borders", createdBy: bob.id },
    });
    await mem.wikiDiscussionComment.create({
      data: { id: "wdc-alice", threadId: "wdt-1", userId: alice.id, content: "Alice comment" },
    });
    await mem.wikiDiscussionComment.create({
      data: { id: "wdc-bob", threadId: "wdt-1", userId: bob.id, content: "Bob comment" },
    });

    await mem.poll.create({
      data: {
        id: "poll-alice",
        question: "Alice poll?",
        options: { create: [{ id: "opt-a1", label: "Yes" }] },
      },
    });
    await mem.thinkpagesPost.create({
      data: {
        id: "post-alice",
        accountId: "p-alice",
        content: "Poll post",
        ixTimeTimestamp: new Date(0),
        pollId: "poll-alice",
      },
    });
    await mem.poll.create({
      data: {
        id: "poll-on-nation",
        question: "Made by a previous owner?",
        countryId: "n1",
        options: { create: [{ id: "opt-n1", label: "Yes" }] },
      },
    });
    await mem.poll.create({
      data: {
        id: "poll-bob",
        question: "Bob poll?",
        options: { create: [{ id: "opt-b1", label: "No" }] },
      },
    });
    await mem.thinkpagesPost.create({
      data: {
        id: "post-bob",
        accountId: "p-bob",
        content: "Bob poll post",
        ixTimeTimestamp: new Date(0),
        pollId: "poll-bob",
      },
    });
    await mem.pollVote.create({
      data: { id: "pv-alice", pollId: "poll-bob", optionId: "opt-b1", userId: alice.clerkUserId },
    });
    await mem.pollVote.create({
      data: { id: "pv-bob", pollId: "poll-alice", optionId: "opt-a1", userId: bob.clerkUserId },
    });

    await mem.sportLeague.create({
      data: {
        id: "lg-1",
        name: "League",
        sportPreset: "soccer",
        archetype: "league",
        teamCount: 2,
        createdByUserId: bob.id,
      },
    });
    await mem.sportTeam.create({ data: { id: "tm-1", leagueId: "lg-1", name: "Home" } });
    await mem.sportTeam.create({ data: { id: "tm-2", leagueId: "lg-1", name: "Away" } });
    await mem.sportSeason.create({
      data: { id: "sn-1", leagueId: "lg-1", seasonNumber: 1, startIxTime: 0 },
    });
    await mem.sportMatch.create({
      data: {
        id: "mt-1",
        seasonId: "sn-1",
        matchDay: 1,
        homeTeamId: "tm-1",
        awayTeamId: "tm-2",
        scheduledIxTime: 0,
      },
    });
    await mem.sportPrediction.create({
      data: {
        id: "sp-alice",
        matchId: "mt-1",
        seasonId: "sn-1",
        userId: alice.clerkUserId,
        outcome: "home",
        stake: 10,
        createdIxTime: 0,
      },
    });
    await mem.sportPrediction.create({
      data: {
        id: "sp-bob",
        matchId: "mt-1",
        seasonId: "sn-1",
        userId: bob.clerkUserId,
        outcome: "away",
        stake: 20,
        createdIxTime: 0,
      },
    });

    await mem.blurbPrompt.create({
      data: {
        id: "bp-1",
        title: "Prompt 1",
        question: "What happened?",
        slug: "prompt-1",
        createdBy: bob.id,
      },
    });
    await mem.blurbResponse.create({
      data: {
        id: "br-alice",
        promptId: "bp-1",
        userId: alice.id,
        countryId: "n1",
        content: "Alice blurb",
      },
    });
    await mem.blurbResponse.create({
      data: {
        id: "br-bob",
        promptId: "bp-1",
        userId: bob.id,
        countryId: "n2",
        content: "Bob blurb",
      },
    });

    await mem.thinktankGroup.create({
      data: { id: "tt-1", name: "Group", createdBy: bob.clerkUserId },
    });
    await mem.collaborativeDoc.create({
      data: {
        id: "doc-owned",
        groupId: "tt-1",
        title: "Owned Doc",
        content: "Owned body",
        createdBy: alice.clerkUserId,
        lastEditBy: bob.clerkUserId,
      },
    });
    await mem.collaborativeDoc.create({
      data: {
        id: "doc-edited",
        groupId: "tt-1",
        title: "Edited Doc",
        content: "Edited body",
        createdBy: bob.clerkUserId,
        lastEditBy: alice.clerkUserId,
      },
    });
    await mem.collaborativeDoc.create({
      data: {
        id: "doc-bob",
        groupId: "tt-1",
        title: "Bob Doc",
        content: "Bob body",
        createdBy: bob.clerkUserId,
        lastEditBy: bob.clerkUserId,
      },
    });

    await mem.countryLoreAuthor.create({
      data: { id: "cla-alice", countryId: "n2", userId: alice.id, addedById: bob.id },
    });
    await mem.countryLoreAuthor.create({
      data: { id: "cla-bob", countryId: "n1", userId: bob.id, addedById: alice.id },
    });

    const out = await buildAccountExport(mem as never, alice.clerkUserId, identity);

    expect(out.stashes.map((s) => s.id)).toEqual(["st-alice"]);
    expect(out.stashes[0]?.items[0]?.annotations[0]?.selectedText).toBe("quote");
    expect(out.comments.map((c) => c.id)).toEqual(["wdc-alice"]);
    expect(out.polls.created.map((p) => p.id)).toEqual(["poll-alice"]);
    expect(out.polls.pollsOnYourNations.map((p) => p.id)).toEqual(["poll-on-nation"]);
    expect(out.polls.votes.map((v) => v.id)).toEqual(["pv-alice"]);
    expect(out.predictions.map((p) => p.id)).toEqual(["sp-alice"]);
    expect(out.blurbs.map((b) => b.id)).toEqual(["br-alice"]);
    expect(
      out.documents.map((d) => [d.id, d.title, "content" in d ? d.content : undefined])
    ).toEqual([
      ["doc-owned", "Owned Doc", "Owned body"],
      ["doc-edited", "Edited Doc", undefined],
    ]);
    expect(out.documents[1]).not.toHaveProperty("content");
    expect(JSON.stringify(out.documents)).not.toContain("Edited body");
    expect(out.documents[0]).not.toHaveProperty("createdBy");
    expect(out.documents[0]).not.toHaveProperty("lastEditBy");
    expect(out.loreTeams.map((l) => [l.id, l.countryId])).toEqual([["cla-alice", "n2"]]);
    expect(out.loreTeams[0]).not.toHaveProperty("addedById");
  });
});
