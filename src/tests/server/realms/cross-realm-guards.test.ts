/** @jest-environment node */
/**
 * Nations of two realms do not interact as countries (realm clocks design §3, kept by the realm time design): every
 * country-to-country action refuses with "Both nations must be in the same realm", from the one shared guard, and
 * the same action between nations of one realm goes through. Winding an old interaction down stays open: an embassy
 * closes and a proposal is declined across realms. Pickers offer only nations of the viewer's realm.
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue("n1") },
}));
jest.mock("~/lib/notifications/hooks", () => ({
  notificationHooks: {
    onMeetingEvent: jest.fn().mockResolvedValue(undefined),
    onDiplomaticEvent: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock("~/lib/diplomacy/news-generator", () => ({
  generateDiplomaticNews: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/activity", () => ({
  ActivityHooks: { Diplomatic: { onEmbassyEstablished: jest.fn().mockResolvedValue(undefined) } },
}));
jest.mock("~/lib/diplomacy/choice-tracker", () => ({
  DiplomaticChoiceTracker: { recordChoice: jest.fn().mockResolvedValue(undefined) },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { diplomaticEmbassiesRouter } from "~/server/api/routers/diplomacy/embassies";
import { diplomaticCulturalRouter } from "~/server/api/routers/diplomacy/cultural";
import { diplomaticCoreRouter } from "~/server/api/routers/diplomacy/core";
import { diplomaticPoliciesRouter } from "~/server/api/routers/diplomacy/policies";
import { diplomaticScenariosChoicesRouter } from "~/server/api/routers/diplomaticScenarios/choices";
import { diplomaticScenariosRouter } from "~/server/api/routers/diplomaticScenarios";
import { meetingsMeetingsRouter } from "~/server/api/routers/meetings/meetings";
import { SAME_REALM_MESSAGE, nationsInRealm, sameRealm } from "~/lib/realms/same-realm";
import { assertSameRealm } from "~/server/shared/same-realm-guard";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createDiplomacyFakeDb } from "~/tests/helpers/diplomacy-fake-db";
import {
  CALLER_COUNTRY,
  FOREIGN_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

/** A third nation, in the caller's realm (Ixnay). */
const NEIGHBOUR = "country_neighbour";
/** The caller's nation under a cuid id, for procedures that validate one. */
const SCENARIO_NATION = "ckcountrya0000000000001";
/** A nation of the far realm under a cuid id. */
const FAR_NATION = "ckcountryf0000000000009";
const REALM_OF: Record<string, string> = {
  [CALLER_COUNTRY]: "default",
  [SCENARIO_NATION]: "default",
  [FAR_NATION]: "realm_far",
  [NEIGHBOUR]: "default",
  [FOREIGN_COUNTRY]: "realm_far",
};

const refused = { code: "BAD_REQUEST", message: SAME_REALM_MESSAGE };

/** Country lookups answer each nation's realm; `db` adds the delegates the procedure under test needs. */
function realmContext(db: Record<string, object>) {
  return createIdorContext({
    country: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id in REALM_OF
          ? { id: where.id, name: where.id, flag: null, realmId: REALM_OF[where.id] }
          : null
      ),
    },
    ...db,
  });
}

beforeEach(() => jest.clearAllMocks());

describe("the rule", () => {
  it("compares realms, counting a missing realm as Ixnay's", () => {
    expect(sameRealm("a", "a")).toBe(true);
    expect(sameRealm("a", "b")).toBe(false);
    expect(sameRealm(null, "default")).toBe(true);
    expect(sameRealm(undefined, "b")).toBe(false);
  });

  it("filters a picker to the viewer's realm, and keeps all while the realm is unknown", () => {
    const nations = [
      { id: "1", realmId: "default" },
      { id: "2", realmId: "realm_far" },
      { id: "3", realmId: null },
    ];
    expect(nationsInRealm(nations, "default").map((n) => n.id)).toEqual(["1", "3"]);
    expect(nationsInRealm(nations, "realm_far").map((n) => n.id)).toEqual(["2"]);
    expect(nationsInRealm(nations, undefined)).toHaveLength(3);
  });

  it("refuses two realms, passes one realm, and leaves a missing nation to the caller", async () => {
    const db = realmContext({}).db;
    await expect(assertSameRealm(db, CALLER_COUNTRY, FOREIGN_COUNTRY)).rejects.toMatchObject(
      refused
    );
    await expect(assertSameRealm(db, CALLER_COUNTRY, NEIGHBOUR)).resolves.toBeUndefined();
    await expect(assertSameRealm(db, CALLER_COUNTRY, "missing")).resolves.toBeUndefined();
  });
});

describe("embassies", () => {
  const embassies = createCallerFactory(diplomaticEmbassiesRouter);

  it("open only in a nation of the guest's realm", async () => {
    const create = jest.fn().mockResolvedValue({ id: "e1" });
    const caller = embassies(
      realmContext({
        embassy: { findUnique: jest.fn().mockResolvedValue(null), create },
        diplomaticRelation: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
        },
      }) as never
    );
    const open = (hostCountryId: string) =>
      caller.establishEmbassy({ hostCountryId, guestCountryId: CALLER_COUNTRY, name: "E" });

    await expect(open(FOREIGN_COUNTRY)).rejects.toMatchObject(refused);
    expect(create).not.toHaveBeenCalled();
    await expect(open(NEIGHBOUR)).resolves.toMatchObject({ id: "e1" });
  });

  it("reopen only within one realm, while one from before the rule still closes", async () => {
    const embassy = {
      id: "e1",
      name: "Embassy",
      hostCountryId: FOREIGN_COUNTRY,
      guestCountryId: CALLER_COUNTRY,
      status: "closed",
      influence: 0,
      reputation: 0,
      hostCountry: { name: "Far" },
      guestCountry: { name: "Testland" },
    };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const caller = embassies(
      realmContext({
        embassy: {
          findUnique: jest.fn(async () => ({ ...embassy })),
          update: jest.fn().mockResolvedValue(embassy),
          updateMany,
        },
        diplomaticRelation: { findFirst: jest.fn().mockResolvedValue(null) },
        diplomaticEvent: { create: jest.fn().mockResolvedValue({}) },
      }) as never
    );
    await expect(caller.reopenEmbassy({ embassyId: "e1" })).rejects.toMatchObject(refused);
    expect(updateMany).not.toHaveBeenCalled();

    embassy.status = "active";
    await expect(caller.closeEmbassy({ embassyId: "e1" })).resolves.toMatchObject({
      success: true,
    });
  });
});

describe("cultural exchanges", () => {
  const cultural = createCallerFactory(diplomaticCulturalRouter);
  const exchange = (hostCountryId: string) => ({
    id: "ex1",
    title: "Festival",
    type: "festival",
    status: "active",
    isPublic: true,
    maxParticipants: null,
    hostCountryId,
    hostCountryName: "Host",
    economicCost: 0,
    startDate: new Date(),
    endDate: new Date(),
    participatingCountries: [] as Array<{ countryId: string; countryName: string }>,
    _count: { culturalArtifacts: 0, votes: 0 },
  });
  const callerFor = (row: ReturnType<typeof exchange>, extra: Record<string, object> = {}) =>
    cultural(
      realmContext({
        culturalExchange: {
          findUnique: jest.fn().mockResolvedValue(row),
          create: jest.fn().mockResolvedValue({ id: "ex2" }),
          update: jest.fn().mockResolvedValue({}),
        },
        culturalExchangeParticipant: {
          create: jest.fn().mockResolvedValue({ id: "p1" }),
          findFirst: jest.fn().mockResolvedValue({ id: "p1" }),
        },
        culturalExchangeVote: { upsert: jest.fn().mockResolvedValue({ id: "v1" }) },
        culturalArtifact: { create: jest.fn().mockResolvedValue({ id: "a1" }) },
        embassy: { findMany: jest.fn().mockResolvedValue([]) },
        embassyMission: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
        ...extra,
      }) as never
    );

  it("are created only with a participant of the host's realm", async () => {
    const create = (participantCountryId: string) =>
      callerFor(exchange(CALLER_COUNTRY)).createCulturalExchange({
        title: "Festival",
        type: "festival",
        description: "D",
        hostCountryId: CALLER_COUNTRY,
        hostCountryName: "Testland",
        participantCountryId,
        startDate: "2041-01-01",
        endDate: "2041-02-01",
      });
    await expect(create(FOREIGN_COUNTRY)).rejects.toMatchObject(refused);
    await expect(create(NEIGHBOUR)).resolves.toMatchObject({ id: "ex2" });
  });

  it("are joined, voted on and given artifacts only by nations of the host's realm", async () => {
    const far = callerFor(exchange(FOREIGN_COUNTRY));
    await expect(
      far.joinCulturalExchange({ exchangeId: "ex1", countryId: CALLER_COUNTRY, countryName: "T" })
    ).rejects.toMatchObject(refused);
    await expect(far.voteOnExchange({ exchangeId: "ex1", vote: "support" })).rejects.toMatchObject(
      refused
    );
    await expect(
      far.uploadCulturalArtifact({
        exchangeId: "ex1",
        type: "photo",
        title: "P",
        fileUrl: "/f.png",
        contributor: "Me",
      })
    ).rejects.toMatchObject(refused);

    const near = callerFor(exchange(NEIGHBOUR));
    await expect(
      near.joinCulturalExchange({ exchangeId: "ex1", countryId: CALLER_COUNTRY, countryName: "T" })
    ).resolves.toMatchObject({ id: "p1" });
    await expect(near.voteOnExchange({ exchangeId: "ex1", vote: "support" })).resolves.toMatchObject(
      { success: true }
    );
  });

  it("measure no impact on a participant of another realm", async () => {
    const row = {
      ...exchange(CALLER_COUNTRY),
      participatingCountries: [{ countryId: FOREIGN_COUNTRY, countryName: "Far" }],
    };
    await expect(
      callerFor(row).calculateExchangeImpact({
        exchangeId: "ex1",
        responseChoice: "collaborative",
        participantSatisfaction: 70,
        publicPerception: 60,
      })
    ).rejects.toMatchObject(refused);
  });

  it("generate no scenario with a nation of another realm", async () => {
    const caller = callerFor(exchange(CALLER_COUNTRY), {
      diplomaticRelation: {
        findFirst: jest.fn().mockResolvedValue({ id: "r1", relationship: "neutral", strength: 50 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    await expect(
      caller.generateCulturalScenario({ targetCountryId: FOREIGN_COUNTRY })
    ).rejects.toMatchObject(refused);
  });
});

describe("relations, scenarios and summits", () => {
  it("mark which related nations share the nation's realm, for the invite pickers", async () => {
    const at = new Date();
    const relation = (id: string, other: string) => ({
      id,
      country1: CALLER_COUNTRY,
      country2: other,
      relationship: "neutral",
      strength: 50,
      treaties: null,
      diplomaticChannels: null,
      lastContact: at,
      establishedAt: at,
      status: "active",
    });
    const ctx = realmContext({});
    ctx.db.country.findMany = jest.fn(async () =>
      Object.entries(REALM_OF).map(([id, realmId]) => ({ id, name: id, flag: null, realmId }))
    );
    ctx.db.diplomaticRelation = {
      findMany: jest
        .fn()
        .mockResolvedValue([relation("r1", NEIGHBOUR), relation("r2", FOREIGN_COUNTRY)]),
    };
    ctx.db.diplomaticEvent = { findMany: jest.fn().mockResolvedValue([]) };
    const rows = await createCallerFactory(diplomaticCoreRouter)(ctx as never).getRelationships({
      countryId: CALLER_COUNTRY,
    });
    expect(rows.map((r) => [r.targetCountryId, r.sameRealm])).toEqual([
      [NEIGHBOUR, true],
      [FOREIGN_COUNTRY, false],
    ]);
  });

  it("set no goal on a relation with a nation of another realm", async () => {
    const caller = createCallerFactory(diplomaticCoreRouter)(
      realmContext({
        diplomaticRelation: {
          findUnique: jest.fn().mockResolvedValue({
            id: "r1",
            country1: CALLER_COUNTRY,
            country2: FOREIGN_COUNTRY,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      }) as never
    );
    await expect(
      caller.setDiplomaticGoal({ relationId: "r1", goal: "ALLY" })
    ).rejects.toMatchObject(refused);
  });

  it("resolve no scenario between nations of two realms", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const ctx = realmContext({
      culturalScenario: {
        findUnique: jest.fn().mockResolvedValue({
          id: "ckscenario00000000000004",
          country1Id: SCENARIO_NATION,
          country2Id: FOREIGN_COUNTRY,
          status: "active",
          expiresAt: new Date(Date.now() + 86_400_000),
          responseOptions: JSON.stringify([{ id: "warm", effects: {} }]),
        }),
        updateMany,
      },
    });
    ctx.user!.countryId = SCENARIO_NATION;
    await expect(
      createCallerFactory(diplomaticScenariosChoicesRouter)(ctx as never).recordChoice({
        scenarioId: "ckscenario00000000000004",
        countryId: SCENARIO_NATION,
        choiceId: "warm",
        choiceLabel: "Warm",
      })
    ).rejects.toMatchObject(refused);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("let an admin write no scenario between nations of two realms", async () => {
    const create = jest.fn();
    const ctx = realmContext({
      culturalScenario: { create },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    });
    ctx.user!.role = { name: "admin" };
    await expect(
      createCallerFactory(diplomaticScenariosRouter)(ctx as never).createScenario({
        type: "festival",
        title: "T",
        narrative: "N",
        country1Id: SCENARIO_NATION,
        country2Id: FAR_NATION,
        responseOptions: [],
        culturalImpact: 10,
        diplomaticRisk: 10,
        economicCost: 10,
        expiresAt: new Date(Date.now() + 86_400_000),
      })
    ).rejects.toMatchObject(refused);
    expect(create).not.toHaveBeenCalled();
  });

  it("request no summit with a nation of another realm", async () => {
    const create = jest.fn().mockResolvedValue({ id: "m1", title: "S", scheduledDate: new Date() });
    const caller = createCallerFactory(meetingsMeetingsRouter)(
      realmContext({ cabinetMeeting: { create } }) as never
    );
    const summit = (targetCountryId: string) =>
      caller.createMeeting({
        countryId: CALLER_COUNTRY,
        targetCountryId,
        title: "Summit",
        scheduledDate: new Date(),
      });
    await expect(summit(FOREIGN_COUNTRY)).rejects.toMatchObject(refused);
    expect(create).not.toHaveBeenCalled();
    await expect(summit(NEIGHBOUR)).resolves.toMatchObject({ id: "m1" });
  });
});

describe("foreign policy and alliances", () => {
  const policies = createCallerFactory(diplomaticPoliciesRouter);
  const COUNTRIES = [
    { id: "A", name: "Alpha", realmId: "default", ownerUserId: "uA" },
    { id: "B", name: "Beta", realmId: "default", ownerUserId: "uB" },
    { id: "F", name: "Far", realmId: "realm_far", ownerUserId: "uF" },
  ];
  const as = (db: unknown, userId: string, countryId: string) =>
    policies(
      createMockRouterContext({
        db,
        auth: { userId: `clerk_${userId}` },
        user: { id: userId, clerkUserId: `clerk_${userId}`, countryId, role: { name: "member" } },
      }) as never
    );

  it("propose actions only toward nations of the initiator's realm", async () => {
    const { db, state } = createDiplomacyFakeDb({ countries: COUNTRIES });
    const propose = (targetId: string) =>
      as(db, "uA", "A").proposeForeignPolicyAction({ targetId, actionType: "free_trade" });
    await expect(propose("F")).rejects.toMatchObject(refused);
    expect(state.foreignPolicyActions).toHaveLength(0);
    await expect(propose("B")).resolves.toMatchObject({ pendingConsent: true });
  });

  it("accept no proposal from another realm, but decline one", async () => {
    const pending = (id: string) => ({
      id,
      initiatorId: "F",
      targetId: "A",
      actionType: "free_trade",
      status: "proposed",
      relationshipDelta: 0,
      initiatorGdpImpact: 0,
      targetGdpImpact: 0,
      createdAt: new Date(),
    });
    const { db, state } = createDiplomacyFakeDb({
      countries: COUNTRIES,
      foreignPolicyActions: [pending("fp1"), pending("fp2")],
    });
    const caller = as(db, "uA", "A");
    await expect(
      caller.respondToForeignPolicyProposal({ actionId: "fp1", choice: "accept" })
    ).rejects.toMatchObject(refused);
    expect(state.foreignPolicyActions[0]!.status).toBe("proposed");
    await expect(
      caller.respondToForeignPolicyProposal({ actionId: "fp2", choice: "decline" })
    ).resolves.toMatchObject({ status: "declined" });
  });

  it("take collective action only against a nation of the proposer's realm", async () => {
    const { db } = createDiplomacyFakeDb({
      countries: COUNTRIES,
      alliances: [{ id: "al1", name: "Pact", realmId: "default" }],
      allianceMembers: [
        { id: "m1", allianceId: "al1", countryId: "A", role: "founder", isActive: true },
      ],
    });
    await expect(
      as(db, "uA", "A").proposeAllianceAction({
        allianceId: "al1",
        actionType: "collective_sanction",
        targetId: "F",
        title: "Sanction Far",
      })
    ).rejects.toMatchObject(refused);
  });
});
