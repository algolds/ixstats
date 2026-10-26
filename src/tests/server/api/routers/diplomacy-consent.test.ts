/**
 * Diplomacy needs the other nation's consent, on an in-memory fake of the delegates the diplomatic-policies router
 * touches. A cooperative proposal waits for the target's owner, the only one who lists and answers it; accepting
 * applies both sides' effects once, declining applies nothing and lifts the block on proposing again, and a hostile
 * action applies at once. The proposer alone withdraws a pending proposal; one past its window expires (and the cron
 * sweep expires the rest). An alliance invite is pending until the invitee's owner answers; the inviting nation (or,
 * for a legacy invite, the alliance's leadership) alone withdraws it; an expired invite can be issued again; an NPC
 * answers at once, a nation someone plays waits for its player. Around them: following and goals only for the
 * caller's own nation, option analytics for admins, the embassy mission sweep the drift cron runs, and a diplomatic
 * scenario resolved once (and never paying IxCredits).
 *
 * Folds diplomacy-core, diplomacy-inbox-lifecycle, alliance-npc-invite, embassy-mission-sweep and
 * scenario-choice-atomic.
 */
const mockDriftDb = {
  embassyMission: { updateMany: jest.fn() },
  foreignPolicyAction: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  allianceMember: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  diplomaticRelation: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
};
jest.mock("~/server/db", () => ({
  get db() {
    return mockDriftDb;
  },
}));
jest.mock("~/lib/diplomacy/news-generator", () => ({
  generateDiplomaticNews: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue("n1") },
}));
jest.mock("~/lib/notifications/guard", () => ({
  guardNotificationEvent: jest.fn().mockResolvedValue(true),
}));
jest.mock("~/lib/vault/vault-service", () => ({
  __esModule: true,
  vaultService: { earnCredits: jest.fn().mockResolvedValue({ success: true, newBalance: 10 }) },
}));

import { diplomaticPoliciesRouter } from "~/server/api/routers/diplomacy/policies";
import { diplomaticCoreRouter } from "~/server/api/routers/diplomacy/core";
import { diplomaticScenariosChoicesRouter } from "~/server/api/routers/diplomaticScenarios/choices";
import { createCallerFactory } from "~/server/api/trpc";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createDiplomacyFakeDb, type DiplomacyFakeState } from "~/tests/helpers/diplomacy-fake-db";
import { createMockDb, createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";
import {
  expireStaleDiplomaticProposals,
  isProposalExpired,
  proposalExpiresAt,
} from "~/lib/diplomacy/proposal-lifecycle";
import { closeDueEmbassyMissions } from "~/lib/diplomacy/embassy-mission-sweep";
import { notificationAPI } from "~/lib/notifications/api";
import { vaultService } from "~/lib/vault/vault-service";

const notify = notificationAPI.create as jest.Mock;
const policies = createCallerFactory(diplomaticPoliciesRouter);
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

const COUNTRIES = [
  { id: "A", name: "Alpha", ownerUserId: "uA", owner: { clerkUserId: "clerk_uA" } },
  { id: "B", name: "Beta", ownerUserId: "uB", owner: { clerkUserId: "clerk_uB" } },
  { id: "C", name: "Gamma", ownerUserId: "uC", owner: { clerkUserId: "clerk_uC" } },
];

type FakeDb = ReturnType<typeof createDiplomacyFakeDb>["db"];
const as = (db: FakeDb, userId: string, countryId: string | null) =>
  policies(
    createMockRouterContext({
      db,
      auth: { userId: `clerk_${userId}` },
      user: { id: userId, clerkUserId: `clerk_${userId}`, countryId, role: { name: "member" } },
    }) as never
  );

const pendingProposal = (over: Record<string, unknown> = {}) => ({
  id: "fp-x",
  initiatorId: "A",
  targetId: "B",
  actionType: "free_trade",
  category: "trade",
  severity: "moderate",
  status: "proposed",
  initiatorGdpImpact: 0.5,
  targetGdpImpact: 0.5,
  relationshipDelta: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const world = (seed: Partial<DiplomacyFakeState> = {}) =>
  createDiplomacyFakeDb({ countries: COUNTRIES, ...seed });

beforeEach(() => notify.mockClear());

describe("foreign-policy proposals", () => {
  it("wait for the target's owner, who alone lists and answers them; accepting applies both sides once", async () => {
    const { db, state } = world();
    db.diplomaticRelation.findFirst.mockResolvedValue({
      id: "rel1",
      strength: 60,
      tradeVolume: 100,
    });
    db.bilateralTrade.findUnique.mockResolvedValue({
      id: "t1",
      tradeVolume: 100,
      exportsFrom1: 60,
      exportsFrom2: 40,
    });
    const proposal = await as(db, "uA", "A").proposeForeignPolicyAction({
      targetId: "B",
      actionType: "free_trade",
    });
    expect(proposal).toMatchObject({ status: "proposed", pendingConsent: true });
    expect(db.storytellerEffect.createMany).not.toHaveBeenCalled();

    // Only the target's owner sees it; the initiator and a third party cannot answer it, and nobody else reads the
    // initiator's outgoing list
    const incoming = await as(db, "uB", "B").getForeignPolicyProposals({ countryId: "B" });
    expect(incoming.map((p: { initiator: { name: string } }) => p.initiator.name)).toEqual([
      "Alpha",
    ]);
    await expect(
      as(db, "uA", "A").getForeignPolicyProposals({ countryId: "B" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      as(db, "uC", "C").getOutgoingForeignPolicyProposals({ countryId: "A" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const [user, country] of [
      ["uA", "A"],
      ["uC", "C"],
    ] as const) {
      await expect(
        as(db, user, country).respondToForeignPolicyProposal({
          actionId: proposal.id,
          choice: "accept",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(state.foreignPolicyActions[0]!.status).toBe("proposed");

    // Accepted: both sides' effects, the relation and the trade volume, once
    const accepted = await as(db, "uB", "B").respondToForeignPolicyProposal({
      actionId: proposal.id,
      choice: "accept",
    });
    expect(accepted.status).toBe("active");
    const effects = db.storytellerEffect.createMany.mock.calls[0][0].data as Array<{
      countryId: string;
      inputType: string;
    }>;
    expect(effects.map((e) => [e.countryId, e.inputType])).toEqual([
      ["A", "trade_agreement"],
      ["B", "trade_agreement"],
    ]);
    expect(db.diplomaticRelation.update).toHaveBeenCalledTimes(1);
    expect(db.bilateralTrade.update.mock.calls[0][0].data.tradeVolume).toBeCloseTo(125);
    await expect(
      as(db, "uB", "B").respondToForeignPolicyProposal({ actionId: proposal.id, choice: "accept" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.storytellerEffect.createMany).toHaveBeenCalledTimes(1);
  });

  it("apply a hostile action at once, to both sides and the relation", async () => {
    const { db } = world();
    db.diplomaticRelation.findFirst.mockResolvedValue({
      id: "rel1",
      strength: 50,
      tradeVolume: 100,
    });
    db.bilateralTrade.findUnique.mockResolvedValue({
      id: "t1",
      tradeVolume: 100,
      exportsFrom1: 60,
      exportsFrom2: 40,
    });
    const res = await as(db, "uA", "A").proposeForeignPolicyAction({
      targetId: "B",
      actionType: "embargo",
    });
    expect(res.status).toBe("active");
    expect(db.storytellerEffect.createMany).toHaveBeenCalledTimes(1);
    expect(db.diplomaticRelation.update).toHaveBeenCalled();
    expect(db.bilateralTrade.update).toHaveBeenCalled();
  });

  it("decline: nothing applies, and the block on proposing again lifts", async () => {
    const { db, state } = world();
    const alpha = as(db, "uA", "A");
    await alpha.proposeForeignPolicyAction({ targetId: "B", actionType: "military_alliance" });
    await expect(
      alpha.proposeForeignPolicyAction({ targetId: "B", actionType: "military_alliance" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const res = await as(db, "uB", "B").respondToForeignPolicyProposal({
      actionId: state.foreignPolicyActions[0]!.id,
      choice: "decline",
    });
    expect(res.status).toBe("declined");
    expect(db.storytellerEffect.createMany).not.toHaveBeenCalled();
    await expect(
      alpha.proposeForeignPolicyAction({ targetId: "B", actionType: "military_alliance" })
    ).resolves.toMatchObject({ status: "proposed" });
  });

  it("the proposer alone withdraws a pending one; it leaves both inboxes and can be proposed again", async () => {
    const { db, state } = world({
      foreignPolicyActions: [
        pendingProposal({ id: "answered", actionType: "military_alliance", status: "active" }),
      ],
    });
    const alpha = as(db, "uA", "A");
    const created = await alpha.proposeForeignPolicyAction({
      targetId: "B",
      actionType: "free_trade",
    });
    for (const [user, country] of [
      ["uB", "B"],
      ["uC", "C"],
    ] as const) {
      await expect(
        as(db, user, country).withdrawForeignPolicyProposal({ actionId: created.id })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }

    expect(await alpha.withdrawForeignPolicyProposal({ actionId: created.id })).toMatchObject({
      status: "withdrawn",
    });
    expect(await alpha.getOutgoingForeignPolicyProposals({ countryId: "A" })).toHaveLength(0);
    expect(await as(db, "uB", "B").getForeignPolicyProposals({ countryId: "B" })).toHaveLength(0);
    await expect(
      as(db, "uB", "B").respondToForeignPolicyProposal({ actionId: created.id, choice: "accept" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      alpha.proposeForeignPolicyAction({ targetId: "B", actionType: "free_trade" })
    ).resolves.toMatchObject({ status: "proposed" });

    // An answered proposal cannot be withdrawn; an unknown one is NOT_FOUND
    await expect(
      alpha.withdrawForeignPolicyProposal({ actionId: "answered" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(alpha.withdrawForeignPolicyProposal({ actionId: "nope" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(state.foreignPolicyActions.find((r) => r.id === "answered")!.status).toBe("active");
  });

  it("expire after their window: hidden, marked expired, refused on answer, never blocking a new one", async () => {
    const { db, state } = world({
      foreignPolicyActions: [
        pendingProposal({ id: "live", createdAt: daysAgo(13) }),
        pendingProposal({ id: "stale", actionType: "military_alliance", createdAt: daysAgo(15) }),
        pendingProposal({ id: "answer-late", actionType: "research_pact", createdAt: daysAgo(15) }),
      ],
    });
    // Answering first, before any list marks it: refused with a clear error, nothing applied
    await expect(
      as(db, "uB", "B").respondToForeignPolicyProposal({
        actionId: "answer-late",
        choice: "accept",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringMatching(/expired/) });
    expect(db.storytellerEffect.createMany).not.toHaveBeenCalled();

    const incoming = await as(db, "uB", "B").getForeignPolicyProposals({ countryId: "B" });
    expect(incoming.map((p: { id: string }) => p.id)).toEqual(["live"]);
    expect(incoming[0].expiresAt).toEqual(
      proposalExpiresAt(state.foreignPolicyActions[0]!.createdAt)
    );
    expect(state.foreignPolicyActions.map((r) => r.status)).toEqual([
      "proposed",
      "expired",
      "expired",
    ]);
    await expect(
      as(db, "uA", "A").proposeForeignPolicyAction({
        targetId: "B",
        actionType: "military_alliance",
      })
    ).resolves.toMatchObject({ status: "proposed" });
  });

  it("the cron sweep expires every stale proposal and invite, and nothing else", async () => {
    const invite = (id: string, countryId: string, invitedAt: Date | null, updatedAt: Date) => ({
      id,
      allianceId: "al",
      countryId,
      status: "invited",
      isActive: false,
      invitedAt,
      updatedAt,
    });
    const { db, state } = createDiplomacyFakeDb({
      foreignPolicyActions: [
        pendingProposal({ id: "old", createdAt: daysAgo(15) }),
        pendingProposal({ id: "fresh", createdAt: daysAgo(3) }),
        pendingProposal({ id: "done", status: "active", createdAt: daysAgo(40) }),
      ],
      allianceMembers: [
        invite("i1", "B", daysAgo(20), new Date()),
        invite("i2", "C", null, daysAgo(20)),
        invite("i3", "D", daysAgo(1), daysAgo(1)),
      ],
    });
    expect(await expireStaleDiplomaticProposals(db)).toEqual({
      proposalsExpired: 1,
      invitesExpired: 2,
    });
    expect(state.foreignPolicyActions.map((r) => r.status)).toEqual([
      "expired",
      "proposed",
      "active",
    ]);
    expect(state.allianceMembers.map((m) => m.status)).toEqual(["expired", "expired", "invited"]);
  });

  it("never fail because a notification failed", async () => {
    notify.mockRejectedValueOnce(new Error("db down"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const { db } = world();
    await expect(
      as(db, "uA", "A").proposeForeignPolicyAction({ targetId: "B", actionType: "free_trade" })
    ).resolves.toMatchObject({ status: "proposed" });
    warn.mockRestore();
  });
});

describe("alliance invites", () => {
  const founder = {
    id: "mA",
    allianceId: "al1",
    countryId: "A",
    role: "founder",
    isActive: true,
    status: "active",
    updatedAt: daysAgo(100),
  };
  const alliance = (extraMembers: Array<Record<string, unknown>> = []) =>
    world({
      alliances: [{ id: "al1", name: "League", memberCount: 1 }],
      allianceMembers: [{ ...founder }, ...extraMembers],
    });
  const member = (state: DiplomacyFakeState, countryId: string) =>
    state.allianceMembers.find((m) => m.countryId === countryId)!;

  it("are pending until the invitee's owner answers: accepting joins and counts, declining allows a fresh invite", async () => {
    const { db, state } = alliance();
    const alpha = as(db, "uA", "A");
    const beta = as(db, "uB", "B");
    expect(await alpha.inviteMember({ allianceId: "al1", targetCountryId: "B" })).toMatchObject({
      pending: true,
    });
    expect(member(state, "B")).toMatchObject({
      isActive: false,
      status: "invited",
      invitedByCountryId: "A",
      invitedAt: expect.any(Date),
    });
    expect(notify.mock.calls[0][0]).toMatchObject({
      userId: "clerk_uB",
      title: "Alliance Invitation",
      href: "/mycountry/diplomacy",
    });

    // Only the invitee's owner lists and answers it
    const invites = await beta.getAllianceInvites({ countryId: "B" });
    expect(invites[0]).toMatchObject({ invitedBy: { id: "A", name: "Alpha" } });
    expect(invites[0].expiresAt).toEqual(proposalExpiresAt(member(state, "B").invitedAt));
    await expect(alpha.getAllianceInvites({ countryId: "B" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      alpha.respondToAllianceInvite({ allianceId: "al1", countryId: "B", choice: "accept" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Declined, the nation stays out and can be invited again; accepted, it joins and the count follows
    await beta.respondToAllianceInvite({ allianceId: "al1", countryId: "B", choice: "decline" });
    expect(member(state, "B")).toMatchObject({ isActive: false, status: "declined" });
    expect(await beta.getAllianceInvites({ countryId: "B" })).toHaveLength(0);
    await alpha.inviteMember({ allianceId: "al1", targetCountryId: "B" });
    expect(
      await beta.respondToAllianceInvite({ allianceId: "al1", countryId: "B", choice: "accept" })
    ).toMatchObject({ status: "active" });
    expect(member(state, "B")).toMatchObject({ isActive: true, status: "active" });
    expect(state.alliances[0]!.memberCount).toBe(2);
    await expect(
      beta.respondToAllianceInvite({ allianceId: "al1", countryId: "B", choice: "accept" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("are withdrawn by the inviting nation alone, or for a legacy invite by the alliance's leadership", async () => {
    const legacy = {
      id: "mC",
      allianceId: "al1",
      countryId: "C",
      role: "member",
      isActive: false,
      status: "invited",
      invitedByCountryId: null,
      invitedAt: null,
      updatedAt: daysAgo(2),
    };
    const { db, state } = alliance([legacy]);
    const alpha = as(db, "uA", "A");
    await alpha.inviteMember({ allianceId: "al1", targetCountryId: "B" });
    for (const [user, country] of [
      ["uB", "B"],
      ["uC", "C"],
    ] as const) {
      await expect(
        as(db, user, country).withdrawAllianceInvite({ allianceId: "al1", countryId: "B" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(member(state, "B").status).toBe("invited");
    expect(await alpha.getOutgoingAllianceInvites({ countryId: "A" })).toHaveLength(2);

    await alpha.withdrawAllianceInvite({ allianceId: "al1", countryId: "B" });
    await alpha.withdrawAllianceInvite({ allianceId: "al1", countryId: "C" });
    expect([member(state, "B").status, member(state, "C").status]).toEqual([
      "withdrawn",
      "withdrawn",
    ]);
    expect(await alpha.getOutgoingAllianceInvites({ countryId: "A" })).toHaveLength(0);
    await expect(
      as(db, "uB", "B").respondToAllianceInvite({
        allianceId: "al1",
        countryId: "B",
        choice: "accept",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("expire: hidden, marked expired, refused on answer, and can be issued again", async () => {
    const { db, state } = alliance([
      {
        id: "mB",
        allianceId: "al1",
        countryId: "B",
        role: "member",
        isActive: false,
        status: "invited",
        invitedByCountryId: "A",
        invitedAt: daysAgo(15),
        updatedAt: daysAgo(15),
      },
    ]);
    const beta = as(db, "uB", "B");
    await expect(
      beta.respondToAllianceInvite({ allianceId: "al1", countryId: "B", choice: "accept" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringMatching(/expired/) });
    expect(member(state, "B")).toMatchObject({ status: "expired", isActive: false });
    expect(await beta.getAllianceInvites({ countryId: "B" })).toHaveLength(0);
    expect(await as(db, "uA", "A").getOutgoingAllianceInvites({ countryId: "A" })).toHaveLength(0);

    await as(db, "uA", "A").inviteMember({ allianceId: "al1", targetCountryId: "B" });
    expect(member(state, "B").status).toBe("invited");
    expect(isProposalExpired(member(state, "B").invitedAt)).toBe(false);
  });

  describe("to a nation nobody plays", () => {
    const rel = (other: string, relationship: string, strength: number) => ({
      country1: "N",
      country2: other,
      relationship,
      strength,
    });
    /** Many warm ties and an alliance-grade bond with the inviter. */
    const FRIENDLY = [
      rel("X1", "friendly", 80),
      rel("X2", "friendly", 80),
      rel("X3", "cooperative", 80),
      rel("X4", "friendly", 80),
      rel("A", "alliance", 90),
    ];
    const npcWorld = (opts: { npcOwner?: string; actingUsers?: Array<Record<string, unknown>> }) =>
      createDiplomacyFakeDb({
        countries: [
          COUNTRIES[0]!,
          { id: "N", name: "Nordia", ownerUserId: opts.npcOwner ?? null, owner: null },
        ],
        alliances: [{ id: "al1", name: "League", memberCount: 1 }],
        allianceMembers: [{ ...founder }],
        relations: FRIENDLY,
        actingUsers: opts.actingUsers ?? [],
      });

    it("are answered at once: an NPC that accepts joins, and the inviter is told", async () => {
      const { db, state } = npcWorld({});
      expect(
        await as(db, "uA", "A").inviteMember({ allianceId: "al1", targetCountryId: "N" })
      ).toMatchObject({ pending: false, status: "active" });
      expect(member(state, "N")).toMatchObject({ isActive: true, status: "active" });
      expect(state.alliances[0]!.memberCount).toBe(2);
      expect(notify.mock.calls.at(-1)![0]).toMatchObject({
        userId: "clerk_uA",
        title: "Alliance Invitation Accepted",
      });
    });

    it.each([
      ["a nation with an owner", { npcOwner: "uN" }],
      ["a nation a user acts as", { actingUsers: [{ id: "uN", countryId: "N" }] }],
    ])("wait for a player when sent to %s", async (_label, opts) => {
      const { db, state } = npcWorld(opts);
      expect(
        await as(db, "uA", "A").inviteMember({ allianceId: "al1", targetCountryId: "N" })
      ).toMatchObject({ pending: true });
      expect(member(state, "N")).toMatchObject({ isActive: false, status: "invited" });
    });
  });
});

describe("diplomatic core", () => {
  const core = createCallerFactory(diplomaticCoreRouter);
  const coreAs = (
    db: MockPrismaProxy,
    id: string | null,
    countryId: string | null,
    role = { name: "user", level: 100 }
  ) =>
    core(
      createMockRouterContext({
        db,
        auth: id ? { userId: `clerk_${id}` } : null,
        user: id ? { id, clerkUserId: `clerk_${id}`, countryId, role } : null,
        rateLimitIdentifier: `${id}_${Math.random()}`,
      }) as never
    );
  let db: MockPrismaProxy;
  beforeEach(() => {
    db = createMockPrisma();
    db.user.findUnique.mockResolvedValue(null);
    db.country.findUnique.mockImplementation(async (args: { where: { id: string } }) =>
      args.where.id === "nope" ? null : { id: args.where.id, ownerUserId: "owner", name: "Urcea" }
    );
    db.countryFollow.create.mockResolvedValue({ id: "f1" });
  });

  it("refuses following or unfollowing on behalf of another nation, and a signed-out caller", async () => {
    const caller = coreAs(db, "u1", "c_mine");
    await expect(
      caller.followCountry({ followerCountryId: "c_other", followedCountryId: "c_mine" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.unfollowCountry({ followerCountryId: "c_other", followedCountryId: "c_third" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      coreAs(db, null, null).followCountry({
        followerCountryId: "c_mine",
        followedCountryId: "c_other",
      })
    ).rejects.toThrow(/Authentication required/);
    expect(db.countryFollow.create).not.toHaveBeenCalled();
    expect(db.countryFollow.delete).not.toHaveBeenCalled();
  });

  it("sets a goal on the caller's own side of a relation only", async () => {
    db.diplomaticRelation.findUnique.mockResolvedValue({
      id: "r1",
      country1: "c_a",
      country2: "c_b",
    });
    await coreAs(db, "u1", "c_b").setDiplomaticGoal({ relationId: "r1", goal: "RIVAL" });
    expect(db.diplomaticRelation.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { goalCountry2: "RIVAL" },
    });
    db.diplomaticRelation.update.mockClear();
    await expect(
      coreAs(db, "u1", "c_c").setDiplomaticGoal({ relationId: "r1", goal: "ALLY" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      coreAs(db, "u1", null).setDiplomaticGoal({ relationId: "r1", goal: "ALLY" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      coreAs(db, "u1", "c_a").setDiplomaticGoal({ relationId: "r1", goal: "WAR" as never })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.diplomaticRelation.update).not.toHaveBeenCalled();
  });

  it("keeps option usage analytics to admins", async () => {
    await expect(coreAs(db, "u1", "c_mine").getOptionUsageStats()).rejects.toThrow(
      /Admin privileges required/
    );
    db.diplomaticOption.findMany.mockResolvedValue([
      { id: "o1", type: "t", value: "A", category: null, isActive: true, usage: [{}, {}] },
      { id: "o2", type: "t", value: "B", category: "X", isActive: false, usage: [] },
    ]);
    db.diplomaticOptionUsage.count.mockResolvedValue(2);
    const stats = await coreAs(db, "admin", null, {
      name: "admin",
      level: 10,
    }).getOptionUsageStats();
    expect(stats.summary).toEqual({
      totalOptions: 2,
      activeOptions: 1,
      inactiveOptions: 1,
      totalCurrentUsage: 2,
    });
  });
});

describe("the embassy mission sweep", () => {
  it("completes due missions once, paying their rewards into the embassy, and cancels those of cancelled exchanges", async () => {
    const now = new Date("2026-10-05T00:00:00Z");
    type Mission = {
      id: string;
      embassyId: string;
      status: string;
      progress: number;
      culturalExchangeId: string | null;
      exchangeStatus: string;
      completesAt: Date;
      experienceReward: number;
      influenceReward: number;
      reputationReward: number;
    };
    const mission = (over: Partial<Mission> & { id: string }): Mission => ({
      embassyId: "emb1",
      status: "active",
      progress: 0,
      culturalExchangeId: "ex1",
      exchangeStatus: "active",
      completesAt: new Date(now.getTime() + DAY),
      experienceReward: 100,
      influenceReward: 30,
      reputationReward: 20,
      ...over,
    });
    const rows = [
      mission({ id: "due", completesAt: new Date(now.getTime() - DAY) }),
      mission({ id: "running" }),
      mission({ id: "cancelled", exchangeStatus: "cancelled" }),
      mission({ id: "done", status: "completed", completesAt: new Date(now.getTime() - DAY) }),
    ];
    const embassy = { id: "emb1", experience: 0, influence: 10, reputation: 90 };
    type Where = {
      id?: string;
      status: string;
      culturalExchange?: { is: { status: string } };
      culturalExchangeId?: object;
      completesAt?: { lte: Date };
    };
    const matches = (m: Mission, where: Where) =>
      (where.id ? m.id === where.id : true) &&
      m.status === where.status &&
      (where.culturalExchange ? m.exchangeStatus === where.culturalExchange.is.status : true) &&
      (where.culturalExchangeId ? m.culturalExchangeId != null : true) &&
      (where.completesAt ? m.completesAt.getTime() <= where.completesAt.lte.getTime() : true);
    const tables = {
      embassyMission: {
        findMany: jest.fn(async ({ where }: { where: Where }) =>
          rows.filter((m) => matches(m, where)).map((m) => ({ ...m }))
        ),
        updateMany: jest.fn(async ({ where, data }: { where: Where; data: Partial<Mission> }) => {
          const hit = rows.filter((m) => matches(m, where));
          hit.forEach((m) => Object.assign(m, data));
          return { count: hit.length };
        }),
      },
      embassy: {
        findUnique: jest.fn(async () => ({ ...embassy })),
        update: jest.fn(
          async ({
            data,
          }: {
            data: {
              experience: { increment: number };
              influence: { increment: number };
              reputation: number;
            };
          }) => {
            embassy.experience += data.experience.increment;
            embassy.influence += data.influence.increment;
            embassy.reputation = data.reputation;
            return embassy;
          }
        ),
      },
    };
    const missionDb = {
      ...tables,
      $transaction: jest.fn(<T>(work: (tx: typeof tables) => Promise<T>) => work(tables)),
    };
    expect(await closeDueEmbassyMissions(missionDb as never, now)).toEqual({
      missionsCompleted: 1,
      missionsCancelled: 1,
    });
    expect(Object.fromEntries(rows.map((r) => [r.id, [r.status, r.progress]]))).toEqual({
      due: ["completed", 100],
      running: ["active", 0],
      cancelled: ["cancelled", 0],
      done: ["completed", 0],
    });
    // Rewards land once; reputation stays on its 0-100 scale
    expect(embassy).toEqual({ id: "emb1", experience: 100, influence: 40, reputation: 100 });
    expect(await closeDueEmbassyMissions(missionDb as never, now)).toEqual({
      missionsCompleted: 0,
      missionsCancelled: 0,
    });
    expect(embassy.experience).toBe(100);
  });
});

describe("diplomaticScenarios.recordChoice", () => {
  const COUNTRY_A = "ckcountrya0000000000001";
  const SCENARIO_ID = "ckscenario00000000000004";
  const scenario = (overrides: Record<string, unknown> = {}) => ({
    id: SCENARIO_ID,
    type: "cultural_exchange",
    title: "Test Scenario",
    narrative: "Narrative",
    country1Id: COUNTRY_A,
    country2Id: "ckcountryb0000000000002",
    status: "active",
    createdAt: new Date(Date.now() - DAY),
    expiresAt: new Date(Date.now() + DAY),
    responseOptions: JSON.stringify([
      { id: "choice_1", label: "Choice 1", riskLevel: "low", effects: { culturalImpact: 10 } },
    ]),
    tags: JSON.stringify([]),
    culturalImpact: 10,
    diplomaticRisk: 5,
    ...overrides,
  });
  function recordChoice(claimed: number) {
    const db = createMockDb();
    db.culturalScenario.findUnique = jest.fn().mockResolvedValue(scenario() as never);
    db.culturalScenario.findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue(scenario({ status: "completed" }) as never);
    db.culturalScenario.updateMany = jest.fn().mockResolvedValue({ count: claimed } as never);
    db.country.findUnique = jest
      .fn()
      .mockResolvedValue({ id: COUNTRY_A, name: "Country A", flag: null } as never);
    const ctx = createMockRouterContext({
      auth: { userId: "user_owns_a" },
      user: {
        id: "db_user_a",
        clerkUserId: "user_owns_a",
        countryId: COUNTRY_A,
        role: { name: "user", level: 100 },
      },
      db,
    });
    const run = createCallerFactory(diplomaticScenariosChoicesRouter)(ctx as never).recordChoice({
      scenarioId: SCENARIO_ID,
      countryId: COUNTRY_A,
      choiceId: "choice_1",
      choiceLabel: "Choice 1",
    });
    return { db, run };
  }
  beforeEach(() => {
    jest.mocked(vaultService.earnCredits).mockClear();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("resolves a scenario once, through a conditional update while it is open, and pays no IxCredits", async () => {
    const { db, run } = recordChoice(1);
    const result = await run;
    expect(result.scenario.status).toBe("completed");
    expect(db.culturalScenario.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: SCENARIO_ID,
          status: { in: ["active", "pending"] },
          expiresAt: { gt: expect.any(Date) },
        },
        data: expect.objectContaining({ status: "completed", chosenOption: "choice_1" }),
      })
    );
    expect(db.culturalScenario.update).not.toHaveBeenCalled();
    expect(db.culturalExchange.create).toHaveBeenCalledTimes(1);
    expect(vaultService.earnCredits).not.toHaveBeenCalled();
    expect(result).not.toHaveProperty("creditsEarned");
  });

  it("is a CONFLICT when another request resolved the scenario first, writing nothing else", async () => {
    const { db, run } = recordChoice(0);
    await expect(run).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.culturalExchange.create).not.toHaveBeenCalled();
    expect(vaultService.earnCredits).not.toHaveBeenCalled();
  });
});
