import { diplomaticPoliciesRouter } from "~/server/api/routers/diplomacy/policies";
import { createCallerFactory } from "~/server/api/trpc";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createDiplomacyFakeDb } from "~/tests/helpers/diplomacy-fake-db";
import {
  PROPOSAL_TTL_DAYS,
  expireStaleDiplomaticProposals,
  isProposalExpired,
  proposalExpiresAt,
} from "~/lib/diplomacy/proposal-lifecycle";
import { notificationAPI } from "~/lib/notifications/api";

jest.mock("~/lib/diplomacy/news-generator", () => ({
  generateDiplomaticNews: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue("n1") },
}));
jest.mock("~/lib/notifications/guard", () => ({
  guardNotificationEvent: jest.fn().mockResolvedValue(true),
}));

const createCaller = createCallerFactory(diplomaticPoliciesRouter);
const notify = notificationAPI.create as jest.Mock;

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

const COUNTRIES = [
  { id: "A", name: "Alpha", owner: { clerkUserId: "clerk_uA" } },
  { id: "B", name: "Beta", owner: { clerkUserId: "clerk_uB" } },
  { id: "C", name: "Gamma", owner: { clerkUserId: "clerk_uC" } },
];

const callerFor = (db: any, userId: string, countryId: string | null) =>
  createCaller(
    createMockRouterContext({
      db,
      auth: { userId: `clerk_${userId}` },
      user: { id: userId, clerkUserId: `clerk_${userId}`, countryId, role: { name: "member" } },
    }) as any
  ) as any;

const pendingProposal = (over: Record<string, any> = {}) => ({
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

beforeEach(() => notify.mockClear());

describe("proposal lifecycle helpers", () => {
  it("expires exactly PROPOSAL_TTL_DAYS after issue", () => {
    expect(PROPOSAL_TTL_DAYS).toBe(14);
    const issued = new Date("2026-09-01T00:00:00Z");
    expect(proposalExpiresAt(issued).toISOString()).toBe("2026-09-15T00:00:00.000Z");
    expect(isProposalExpired(issued, new Date("2026-09-14T23:59:59Z"))).toBe(false);
    expect(isProposalExpired(issued, new Date("2026-09-15T00:00:00Z"))).toBe(true);
  });

  it("the cron sweep marks every stale proposal and invite expired, and nothing else", async () => {
    const { db, state } = createDiplomacyFakeDb({
      foreignPolicyActions: [
        pendingProposal({ id: "old", createdAt: daysAgo(15) }),
        pendingProposal({ id: "fresh", createdAt: daysAgo(3) }),
        pendingProposal({ id: "done", status: "active", createdAt: daysAgo(40) }),
      ],
      allianceMembers: [
        {
          id: "i1",
          allianceId: "al",
          countryId: "B",
          status: "invited",
          isActive: false,
          invitedAt: daysAgo(20),
          updatedAt: new Date(),
        },
        {
          id: "i2",
          allianceId: "al",
          countryId: "C",
          status: "invited",
          isActive: false,
          invitedAt: null,
          updatedAt: daysAgo(20),
        },
        {
          id: "i3",
          allianceId: "al",
          countryId: "D",
          status: "invited",
          isActive: false,
          invitedAt: daysAgo(1),
          updatedAt: daysAgo(1),
        },
      ],
    });
    const res = await expireStaleDiplomaticProposals(db);
    expect(res).toEqual({ proposalsExpired: 1, invitesExpired: 2 });
    expect(state.foreignPolicyActions.map((r) => r.status)).toEqual([
      "expired",
      "proposed",
      "active",
    ]);
    expect(state.allianceMembers.map((m) => m.status)).toEqual(["expired", "expired", "invited"]);
  });
});

describe("foreign-policy proposals: withdraw", () => {
  it("the proposer can withdraw a pending proposal; it leaves both inboxes and can be re-proposed", async () => {
    const { db, state } = createDiplomacyFakeDb({ countries: COUNTRIES });
    const alpha = callerFor(db, "uA", "A");
    const created = await alpha.proposeForeignPolicyAction({
      targetId: "B",
      actionType: "free_trade",
    });
    expect(await alpha.getOutgoingForeignPolicyProposals({ countryId: "A" })).toHaveLength(1);

    const res = await alpha.withdrawForeignPolicyProposal({ actionId: created.id });
    expect(res.status).toBe("withdrawn");
    expect(state.foreignPolicyActions[0]!.status).toBe("withdrawn");
    expect(await alpha.getOutgoingForeignPolicyProposals({ countryId: "A" })).toHaveLength(0);
    expect(
      await callerFor(db, "uB", "B").getForeignPolicyProposals({ countryId: "B" })
    ).toHaveLength(0);

    // The target can no longer answer it.
    await expect(
      callerFor(db, "uB", "B").respondToForeignPolicyProposal({
        actionId: created.id,
        choice: "accept",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const again = await alpha.proposeForeignPolicyAction({
      targetId: "B",
      actionType: "free_trade",
    });
    expect(again.status).toBe("proposed");
  });

  it("only the proposing country's owner may withdraw (not the target, not a third party)", async () => {
    const { db, state } = createDiplomacyFakeDb({
      countries: COUNTRIES,
      foreignPolicyActions: [pendingProposal()],
    });
    await expect(
      callerFor(db, "uB", "B").withdrawForeignPolicyProposal({ actionId: "fp-x" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      callerFor(db, "uC", "C").withdrawForeignPolicyProposal({ actionId: "fp-x" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.foreignPolicyActions[0]!.status).toBe("proposed");
  });

  it("refuses to withdraw a proposal that was already answered, and 404s an unknown one", async () => {
    const { db } = createDiplomacyFakeDb({
      countries: COUNTRIES,
      foreignPolicyActions: [pendingProposal({ status: "active" })],
    });
    const alpha = callerFor(db, "uA", "A");
    await expect(alpha.withdrawForeignPolicyProposal({ actionId: "fp-x" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(alpha.withdrawForeignPolicyProposal({ actionId: "nope" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("only the country's owner may read its outgoing proposals", async () => {
    const { db } = createDiplomacyFakeDb({
      countries: COUNTRIES,
      foreignPolicyActions: [pendingProposal()],
    });
    await expect(
      callerFor(db, "uC", "C").getOutgoingForeignPolicyProposals({ countryId: "A" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("foreign-policy proposals: expiry", () => {
  it("lists live proposals with their expiry, hides stale ones and marks them expired", async () => {
    const { db, state } = createDiplomacyFakeDb({
      countries: COUNTRIES,
      foreignPolicyActions: [
        pendingProposal({ id: "live", createdAt: daysAgo(13) }),
        pendingProposal({ id: "stale", actionType: "military_alliance", createdAt: daysAgo(15) }),
      ],
    });
    const incoming = await callerFor(db, "uB", "B").getForeignPolicyProposals({ countryId: "B" });
    expect(incoming.map((p: any) => p.id)).toEqual(["live"]);
    expect(incoming[0].expiresAt).toEqual(
      proposalExpiresAt(state.foreignPolicyActions[0]!.createdAt)
    );
    expect(state.foreignPolicyActions.find((r) => r.id === "stale")!.status).toBe("expired");

    const outgoing = await callerFor(db, "uA", "A").getOutgoingForeignPolicyProposals({
      countryId: "A",
    });
    expect(outgoing.map((p: any) => p.id)).toEqual(["live"]);
  });

  it("rejects a response to an expired proposal with a clear error and applies nothing", async () => {
    const { db, state } = createDiplomacyFakeDb({
      countries: COUNTRIES,
      foreignPolicyActions: [pendingProposal({ createdAt: daysAgo(15) })],
    });
    await expect(
      callerFor(db, "uB", "B").respondToForeignPolicyProposal({
        actionId: "fp-x",
        choice: "accept",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringMatching(/expired/) });
    expect(state.foreignPolicyActions[0]!.status).toBe("expired");
    expect(db.storytellerEffect.createMany).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("a stale pending proposal no longer blocks a new one", async () => {
    const { db, state } = createDiplomacyFakeDb({
      countries: COUNTRIES,
      foreignPolicyActions: [pendingProposal({ createdAt: daysAgo(20) })],
    });
    const res = await callerFor(db, "uA", "A").proposeForeignPolicyAction({
      targetId: "B",
      actionType: "free_trade",
    });
    expect(res.status).toBe("proposed");
    expect(state.foreignPolicyActions.map((r) => r.status)).toEqual(["expired", "proposed"]);
  });

  it("the public active-policies list hides stale proposals", async () => {
    const { db } = createDiplomacyFakeDb({
      countries: COUNTRIES,
      foreignPolicyActions: [
        pendingProposal({ id: "stale", createdAt: daysAgo(15) }),
        pendingProposal({ id: "live" }),
        pendingProposal({
          id: "embargo",
          actionType: "embargo",
          status: "active",
          createdAt: daysAgo(30),
        }),
      ],
    });
    const list = await callerFor(db, "uC", "C").getActiveForeignPolicies({ countryId: "A" });
    expect(list.map((p: any) => p.id).sort()).toEqual(["embargo", "live"]);
  });
});

describe("foreign-policy proposals: notifications", () => {
  it("notifies the target's owner on arrival and the proposer's owner on accept / decline", async () => {
    const { db, state } = createDiplomacyFakeDb({ countries: COUNTRIES });
    const alpha = callerFor(db, "uA", "A");
    await alpha.proposeForeignPolicyAction({ targetId: "B", actionType: "military_alliance" });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0]).toMatchObject({
      userId: "clerk_uB",
      countryId: "B",
      href: "/mycountry/diplomacy",
      category: "diplomatic",
    });

    await callerFor(db, "uB", "B").respondToForeignPolicyProposal({
      actionId: state.foreignPolicyActions[0]!.id,
      choice: "decline",
    });
    expect(notify.mock.calls[1][0]).toMatchObject({
      userId: "clerk_uA",
      title: "Proposal Declined",
      href: "/mycountry/diplomacy",
    });

    await alpha.proposeForeignPolicyAction({ targetId: "B", actionType: "military_alliance" });
    await callerFor(db, "uB", "B").respondToForeignPolicyProposal({
      actionId: state.foreignPolicyActions[1]!.id,
      choice: "accept",
    });
    expect(notify.mock.calls[3][0]).toMatchObject({
      userId: "clerk_uA",
      title: "Proposal Accepted",
    });
  });

  it("hostile actions do not send a proposal notification", async () => {
    const { db } = createDiplomacyFakeDb({ countries: COUNTRIES });
    await callerFor(db, "uA", "A").proposeForeignPolicyAction({
      targetId: "B",
      actionType: "sanction",
    });
    expect(notify).not.toHaveBeenCalled();
  });

  it("a notification failure never fails the mutation", async () => {
    notify.mockRejectedValueOnce(new Error("db down"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const { db } = createDiplomacyFakeDb({ countries: COUNTRIES });
    const res = await callerFor(db, "uA", "A").proposeForeignPolicyAction({
      targetId: "B",
      actionType: "free_trade",
    });
    expect(res.status).toBe("proposed");
    warn.mockRestore();
  });
});

describe("alliance invites: withdraw, expiry, notifications", () => {
  const seedAlliance = (extraMembers: any[] = []) =>
    createDiplomacyFakeDb({
      countries: COUNTRIES,
      alliances: [{ id: "al1", name: "League", memberCount: 1 }],
      allianceMembers: [
        {
          id: "mA",
          allianceId: "al1",
          countryId: "A",
          role: "founder",
          isActive: true,
          status: "active",
          updatedAt: daysAgo(100),
        },
        ...extraMembers,
      ],
    });

  it("an invite records who sent it and when, and notifies the invitee's owner", async () => {
    const { db, state } = seedAlliance();
    await callerFor(db, "uA", "A").inviteMember({ allianceId: "al1", targetCountryId: "B" });
    const invite = state.allianceMembers.find((m) => m.countryId === "B")!;
    expect(invite).toMatchObject({ status: "invited", isActive: false, invitedByCountryId: "A" });
    expect(invite.invitedAt).toBeInstanceOf(Date);
    expect(notify.mock.calls[0][0]).toMatchObject({
      userId: "clerk_uB",
      title: "Alliance Invitation",
      href: "/mycountry/diplomacy",
    });

    const incoming = await callerFor(db, "uB", "B").getAllianceInvites({ countryId: "B" });
    expect(incoming).toHaveLength(1);
    expect(incoming[0].invitedBy).toMatchObject({ id: "A", name: "Alpha" });
    expect(incoming[0].expiresAt).toEqual(proposalExpiresAt(invite.invitedAt));
  });

  it("the inviting country can withdraw; the invite leaves both lists", async () => {
    const { db, state } = seedAlliance();
    const alpha = callerFor(db, "uA", "A");
    await alpha.inviteMember({ allianceId: "al1", targetCountryId: "B" });
    expect(await alpha.getOutgoingAllianceInvites({ countryId: "A" })).toHaveLength(1);

    const res = await alpha.withdrawAllianceInvite({ allianceId: "al1", countryId: "B" });
    expect(res.status).toBe("withdrawn");
    expect(state.allianceMembers.find((m) => m.countryId === "B")).toMatchObject({
      status: "withdrawn",
      isActive: false,
    });
    expect(await alpha.getOutgoingAllianceInvites({ countryId: "A" })).toHaveLength(0);
    expect(await callerFor(db, "uB", "B").getAllianceInvites({ countryId: "B" })).toHaveLength(0);
    await expect(
      callerFor(db, "uB", "B").respondToAllianceInvite({
        allianceId: "al1",
        countryId: "B",
        choice: "accept",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("neither the invitee nor a third party can withdraw an invite", async () => {
    const { db, state } = seedAlliance();
    await callerFor(db, "uA", "A").inviteMember({ allianceId: "al1", targetCountryId: "B" });
    for (const [user, country] of [
      ["uB", "B"],
      ["uC", "C"],
    ] as const) {
      await expect(
        callerFor(db, user, country).withdrawAllianceInvite({ allianceId: "al1", countryId: "B" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(state.allianceMembers.find((m) => m.countryId === "B")!.status).toBe("invited");
  });

  it("legacy invites with no recorded inviter belong to the alliance's leadership", async () => {
    const legacy = {
      id: "mB",
      allianceId: "al1",
      countryId: "B",
      role: "member",
      isActive: false,
      status: "invited",
      invitedByCountryId: null,
      invitedAt: null,
      updatedAt: daysAgo(2),
    };
    const member = {
      id: "mC",
      allianceId: "al1",
      countryId: "C",
      role: "member",
      isActive: true,
      status: "active",
      updatedAt: daysAgo(50),
    };
    const { db, state } = seedAlliance([legacy, member]);

    expect(
      await callerFor(db, "uA", "A").getOutgoingAllianceInvites({ countryId: "A" })
    ).toHaveLength(1);
    expect(
      await callerFor(db, "uC", "C").getOutgoingAllianceInvites({ countryId: "C" })
    ).toHaveLength(0);
    await expect(
      callerFor(db, "uC", "C").withdrawAllianceInvite({ allianceId: "al1", countryId: "B" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await callerFor(db, "uA", "A").withdrawAllianceInvite({ allianceId: "al1", countryId: "B" });
    expect(state.allianceMembers.find((m) => m.id === "mB")!.status).toBe("withdrawn");
  });

  it("expired invites are hidden, marked expired, rejected on response and can be re-issued", async () => {
    const stale = {
      id: "mB",
      allianceId: "al1",
      countryId: "B",
      role: "member",
      isActive: false,
      status: "invited",
      invitedByCountryId: "A",
      invitedAt: daysAgo(15),
      updatedAt: daysAgo(15),
    };
    const { db, state } = seedAlliance([{ ...stale }]);
    const beta = callerFor(db, "uB", "B");

    // Respond first (before any list call marks it): the lazy check rejects it clearly.
    await expect(
      beta.respondToAllianceInvite({ allianceId: "al1", countryId: "B", choice: "accept" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringMatching(/expired/) });
    const row = state.allianceMembers.find((m) => m.id === "mB")!;
    expect(row).toMatchObject({ status: "expired", isActive: false });

    expect(await beta.getAllianceInvites({ countryId: "B" })).toHaveLength(0);
    expect(
      await callerFor(db, "uA", "A").getOutgoingAllianceInvites({ countryId: "A" })
    ).toHaveLength(0);

    await callerFor(db, "uA", "A").inviteMember({ allianceId: "al1", targetCountryId: "B" });
    expect(row.status).toBe("invited");
    expect(isProposalExpired(row.invitedAt)).toBe(false);
  });

  it("a stale invite that was never marked does not block a fresh one", async () => {
    const { db, state } = seedAlliance([
      {
        id: "mB",
        allianceId: "al1",
        countryId: "B",
        role: "member",
        isActive: false,
        status: "invited",
        invitedByCountryId: "A",
        invitedAt: daysAgo(30),
        updatedAt: daysAgo(30),
      },
    ]);
    const res = await callerFor(db, "uA", "A").inviteMember({
      allianceId: "al1",
      targetCountryId: "B",
    });
    expect(res.pending).toBe(true);
    expect(isProposalExpired(state.allianceMembers.find((m) => m.id === "mB")!.invitedAt)).toBe(
      false
    );
  });

  it("notifies the inviter's owner when the invite is accepted or declined", async () => {
    const { db } = seedAlliance();
    const alpha = callerFor(db, "uA", "A");
    await alpha.inviteMember({ allianceId: "al1", targetCountryId: "B" });
    await callerFor(db, "uB", "B").respondToAllianceInvite({
      allianceId: "al1",
      countryId: "B",
      choice: "decline",
    });
    expect(notify.mock.calls[1][0]).toMatchObject({
      userId: "clerk_uA",
      title: "Alliance Invitation Declined",
      href: "/mycountry/diplomacy",
    });

    await alpha.inviteMember({ allianceId: "al1", targetCountryId: "B" });
    await callerFor(db, "uB", "B").respondToAllianceInvite({
      allianceId: "al1",
      countryId: "B",
      choice: "accept",
    });
    expect(notify.mock.calls[3][0]).toMatchObject({
      userId: "clerk_uA",
      title: "Alliance Invitation Accepted",
    });
  });
});
