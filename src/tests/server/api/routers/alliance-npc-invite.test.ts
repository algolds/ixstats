import { diplomaticPoliciesRouter } from "~/server/api/routers/diplomacy/policies";
import { createCallerFactory } from "~/server/api/trpc";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createDiplomacyFakeDb } from "~/tests/helpers/diplomacy-fake-db";
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

const callerFor = (db: any) =>
  createCaller(
    createMockRouterContext({
      db,
      auth: { userId: "clerk_uA" },
      user: { id: "uA", clerkUserId: "clerk_uA", countryId: "A", role: { name: "member" } },
    }) as any
  ) as any;

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

function seed(opts: { relations?: any[]; npcOwner?: string; actingUsers?: any[] } = {}) {
  return createDiplomacyFakeDb({
    countries: [
      { id: "A", name: "Alpha", ownerUserId: "uA", owner: { clerkUserId: "clerk_uA" } },
      { id: "N", name: "Nordia", ownerUserId: opts.npcOwner ?? null, owner: null },
    ],
    alliances: [{ id: "al1", name: "League", memberCount: 1 }],
    allianceMembers: [
      {
        id: "mA",
        allianceId: "al1",
        countryId: "A",
        role: "founder",
        isActive: true,
        status: "active",
      },
    ],
    relations: opts.relations ?? [],
    actingUsers: opts.actingUsers ?? [],
  });
}

beforeEach(() => notify.mockClear());
describe("inviteMember: NPC targets answer at once", () => {
  it("an NPC that accepts joins the alliance and the inviter is told", async () => {
    const { db, state } = seed({ relations: FRIENDLY });
    const res = await callerFor(db).inviteMember({ allianceId: "al1", targetCountryId: "N" });
    expect(res).toMatchObject({ pending: false, status: "active" });
    expect(state.allianceMembers.find((m) => m.countryId === "N")).toMatchObject({
      isActive: true,
      status: "active",
    });
    expect(state.alliances[0]!.memberCount).toBe(2);
    expect(notify.mock.calls.at(-1)![0]).toMatchObject({
      userId: "clerk_uA",
      title: "Alliance Invitation Accepted",
    });
  });
  it("a nation with an owner, or a user acting as it, waits for a player answer", async () => {
    for (const opts of [{ npcOwner: "uN" }, { actingUsers: [{ id: "uN", countryId: "N" }] }]) {
      const { db, state } = seed({ relations: FRIENDLY, ...opts });
      const res = await callerFor(db).inviteMember({ allianceId: "al1", targetCountryId: "N" });
      expect(res.pending).toBe(true);
      expect(state.allianceMembers.find((m) => m.countryId === "N")).toMatchObject({
        isActive: false,
        status: "invited",
      });
    }
  });
});
