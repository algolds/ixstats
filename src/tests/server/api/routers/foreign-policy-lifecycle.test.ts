/** @jest-environment node */
/**
 * A hostile foreign-policy action ends (WP-DE: P1-23 F16, F14). Its initiator lifts it, or it expires when its effect
 * window closes: either way its GDP level effects unwind from now on and it stops blocking a new one. Rows written
 * before effects were keyed by the action are found by nation and description. An approved alliance collective
 * sanction has every voting member sanction the target through the same enactment path (effects included); a trade
 * bloc only offers free trade, which waits for the target's consent.
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/diplomacy/news-generator", () => ({
  generateDiplomaticNews: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue("n1") },
}));
jest.mock("~/lib/notifications/guard", () => ({
  guardNotificationEvent: jest.fn().mockResolvedValue(true),
}));

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { diplomaticPoliciesRouter } from "~/server/api/routers/diplomacy/policies";
import { createCallerFactory } from "~/server/api/trpc";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createDiplomacyFakeDb } from "~/tests/helpers/diplomacy-fake-db";
import { IxTime } from "~/lib/ixtime";
import {
  FP_EFFECT_YEARS,
  expireHostileForeignPolicyActions,
  foreignPolicyEffectKey,
  hostileActionExpiresAt,
} from "~/lib/diplomacy/foreign-policy-effects";

const policies = createCallerFactory(diplomaticPoliciesRouter);
const NOW = Date.UTC(2043, 0, 15);
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

const COUNTRIES = [
  { id: "A", name: "Alpha", ownerUserId: "uA" },
  { id: "B", name: "Beta", ownerUserId: "uB" },
  { id: "C", name: "Gamma", ownerUserId: "uC" },
  { id: "T", name: "Target", ownerUserId: null },
];

type Effect = {
  countryId: string;
  inputType: string;
  value: number;
  description: string | null;
  createdBy: string | null;
  duration: number | null;
  worldEventId: string | null;
  isActive: boolean;
};

/** StorytellerEffect rows, with the `where` subset the effect helpers use. */
function effectStore(seed: Effect[] = []) {
  const rows = [...seed];
  const matches = (row: Effect, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([key, cond]) => {
      if (key === "AND") return (cond as Record<string, unknown>[]).every((w) => matches(row, w));
      if (key === "OR") return (cond as Record<string, unknown>[]).some((w) => matches(row, w));
      if (key === "NOT") {
        return !(cond as Record<string, unknown>[]).some((w) => matches(row, w));
      }
      const value = row[key as keyof Effect];
      if (cond && typeof cond === "object" && "in" in cond) {
        return (cond as { in: unknown[] }).in.includes(value);
      }
      if (cond && typeof cond === "object" && "equals" in cond) {
        return String(value).toLowerCase() === String((cond as { equals: string }).equals);
      }
      return value === cond;
    });
  return {
    rows,
    delegate: {
      findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        rows.filter((r) => matches(r, where))
      ),
      createMany: jest.fn(async ({ data }: { data: Effect[] }) => {
        rows.push(...data.map((d) => ({ ...d, isActive: true })));
        return { count: data.length };
      }),
      updateMany: jest.fn(
        async ({ where, data }: { where: Record<string, unknown>; data: Partial<Effect> }) => {
          const hit = rows.filter((r) => matches(r, where));
          hit.forEach((r) => Object.assign(r, data));
          return { count: hit.length };
        }
      ),
    },
  };
}

function world(effects: Effect[] = []) {
  const fake = createDiplomacyFakeDb({ countries: COUNTRIES });
  const store = effectStore(effects);
  fake.db.storytellerEffect = store.delegate;
  fake.db.$transaction = jest.fn(async (work: (tx: unknown) => unknown) => work(fake.db));
  return { ...fake, effects: store.rows };
}

const as = (db: unknown, userId: string, countryId: string) =>
  policies(
    createMockRouterContext({
      db,
      auth: { userId: `clerk_${userId}` },
      user: { id: userId, clerkUserId: `clerk_${userId}`, countryId, role: { name: "member" } },
    }) as never
  );

const levelSum = (effects: Effect[], countryId: string) =>
  effects
    .filter((e) => e.countryId === countryId && e.isActive)
    .reduce((product, e) => product * (1 + e.value), 1) - 1;

beforeEach(() => {
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(NOW);
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
});

describe("lifting a hostile action", () => {
  it("the initiator lifts an embargo: its effects unwind on both sides and it can be imposed again", async () => {
    const { db, state, effects } = world();
    const alpha = as(db, "uA", "A");
    const embargo = await alpha.proposeForeignPolicyAction({
      targetId: "B",
      actionType: "embargo",
    });
    expect(embargo).toMatchObject({ status: "active" });
    expect(effects.filter((e) => e.createdBy === foreignPolicyEffectKey(embargo!.id))).toHaveLength(
      2
    );
    expect(levelSum(effects, "B")).toBeLessThan(0);

    // Only its initiator lifts it
    await expect(
      as(db, "uB", "B").liftForeignPolicyAction({ actionId: embargo!.id })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    await expect(alpha.liftForeignPolicyAction({ actionId: embargo!.id })).resolves.toEqual({
      status: "lifted",
    });
    expect(state.foreignPolicyActions[0]).toMatchObject({ status: "lifted" });
    // An unwind row per side brings each level back to zero
    expect(levelSum(effects, "A")).toBeCloseTo(0, 6);
    expect(levelSum(effects, "B")).toBeCloseTo(0, 6);
    expect(effects.filter((e) => e.description?.startsWith("Ended: "))).toHaveLength(2);

    // Lifted once only, and no longer blocking a new embargo
    await expect(alpha.liftForeignPolicyAction({ actionId: embargo!.id })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      alpha.proposeForeignPolicyAction({ targetId: "B", actionType: "embargo" })
    ).resolves.toMatchObject({ status: "active" });
  });

  it("a cooperative agreement cannot be lifted this way", async () => {
    const { db, state } = world();
    state.foreignPolicyActions.push({
      id: "fp-trade",
      initiatorId: "A",
      targetId: "B",
      actionType: "free_trade",
      severity: "moderate",
      status: "active",
      createdAt: new Date(),
    });
    await expect(
      as(db, "uA", "A").liftForeignPolicyAction({ actionId: "fp-trade" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.foreignPolicyActions[0]!.status).toBe("active");
  });

  it("finds effect rows written before they were keyed by the action (by nation and description)", async () => {
    const legacy = (countryId: string, description: string, value: number): Effect => ({
      countryId,
      inputType: "gdp_level_adjustment",
      value,
      description,
      createdBy: "user_legacy",
      duration: 4,
      worldEventId: null,
      isActive: true,
    });
    const { db, state, effects } = world([
      legacy("A", "Foreign policy: sanction (moderate) against Beta", -0.002),
      legacy("B", "Affected by Alpha: sanction (moderate)", -0.01),
    ]);
    state.foreignPolicyActions.push({
      id: "fp-old",
      initiatorId: "A",
      targetId: "B",
      actionType: "sanction",
      severity: "moderate",
      status: "active",
      createdAt: new Date(),
    });
    await as(db, "uA", "A").liftForeignPolicyAction({ actionId: "fp-old" });
    expect(levelSum(effects, "A")).toBeCloseTo(0, 6);
    expect(levelSum(effects, "B")).toBeCloseTo(0, 6);
  });
});

describe("expiry with the effect window", () => {
  it("expires hostile actions whose window has closed, and lists the expiry of those still in force", async () => {
    const { db, state, effects } = world();
    const enacted = await as(db, "uA", "A").proposeForeignPolicyAction({
      targetId: "B",
      actionType: "sanction",
    });
    const expiresAt = hostileActionExpiresAt(state.foreignPolicyActions[0]!.createdAt);
    const listed = await as(db, "uA", "A").getActiveForeignPolicies({ countryId: "A" });
    expect(listed[0]!.expiresAt).toEqual(expiresAt);

    // Not yet: nothing expires
    expect(await expireHostileForeignPolicyActions(db)).toBe(0);

    // FP_EFFECT_YEARS IxTime years later the window has closed
    IxTime.setTimeOverride(NOW + FP_EFFECT_YEARS * YEAR_MS + 1000);
    state.foreignPolicyActions[0]!.createdAt = new Date(IxTime.convertFromIxTime(NOW));
    expect(await expireHostileForeignPolicyActions(db)).toBe(1);
    expect(state.foreignPolicyActions.find((a) => a.id === enacted!.id)).toMatchObject({
      status: "expired",
    });
    expect(levelSum(effects, "B")).toBeCloseTo(0, 6);
  });
});

describe("alliance collective actions", () => {
  function allianceWorld() {
    const w = world();
    w.state.alliances.push({ id: "al1", name: "Northern Pact", memberCount: 3 });
    for (const id of ["A", "B", "C"]) {
      w.state.allianceMembers.push({
        id: `m-${id}`,
        allianceId: "al1",
        countryId: id,
        role: id === "A" ? "founder" : "member",
        isActive: true,
        votingPower: 1,
      });
    }
    const actions: Record<string, unknown>[] = [];
    const votes: Record<string, unknown>[] = [];
    w.db.allianceAction = {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `aa${actions.length + 1}`, votesFor: 0, votesAgainst: 0, ...data };
        actions.push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const row = actions.find((a) => a.id === where.id);
        return row ? { ...row, alliance: w.state.alliances[0] } : null;
      }),
      findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) =>
        actions.find((a) => a.id === where.id)
      ),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: object }) =>
        Object.assign(
          actions.find((a) => a.id === where.id)!,
          data
        )
      ),
      updateMany: jest.fn(
        async ({ where, data }: { where: { id: string; status: string }; data: object }) => {
          const row = actions.find((a) => a.id === where.id && a.status === where.status);
          if (row) Object.assign(row, data);
          return { count: row ? 1 : 0 };
        }
      ),
    };
    w.db.allianceVote = {
      upsert: jest.fn(async ({ create }: { create: Record<string, unknown> }) => {
        const existing = votes.find(
          (v) => v.actionId === create.actionId && v.countryId === create.countryId
        );
        if (existing) Object.assign(existing, create);
        else votes.push(create);
        return create;
      }),
      findMany: jest.fn(async ({ where }: { where: { actionId: string } }) =>
        votes.filter((v) => v.actionId === where.actionId)
      ),
    };
    return w;
  }

  it("a targeted action needs a target outside the alliance", async () => {
    const { db } = allianceWorld();
    const alpha = as(db, "uA", "A");
    await expect(
      alpha.proposeAllianceAction({
        allianceId: "al1",
        actionType: "collective_sanction",
        title: "Sanction",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      alpha.proposeAllianceAction({
        allianceId: "al1",
        actionType: "collective_sanction",
        targetId: "B",
        title: "Sanction a member",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("an approved collective sanction has every voting member sanction the target, effects included, once", async () => {
    const { db, state, effects } = allianceWorld();
    const proposal = await as(db, "uA", "A").proposeAllianceAction({
      allianceId: "al1",
      actionType: "collective_sanction",
      targetId: "T",
      title: "Sanction Target",
    });
    await as(db, "uA", "A").voteOnAllianceAction({ actionId: proposal.id, vote: "for" });
    expect(state.foreignPolicyActions).toHaveLength(0);
    await as(db, "uB", "B").voteOnAllianceAction({ actionId: proposal.id, vote: "for" });

    const sanctions = state.foreignPolicyActions.filter((a) => a.actionType === "sanction");
    expect(sanctions.map((a) => a.initiatorId).sort()).toEqual(["A", "B", "C"]);
    expect(sanctions.every((a) => a.status === "active" && a.targetId === "T")).toBe(true);
    // Each member's sanction left its effects on the target
    expect(effects.filter((e) => e.countryId === "T")).toHaveLength(3);

    // Voting is closed once it is carried out
    await expect(
      as(db, "uC", "C").voteOnAllianceAction({ actionId: proposal.id, vote: "for" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.foreignPolicyActions).toHaveLength(3);
  });

  it("an approved trade bloc offers free trade, which waits for the target's consent", async () => {
    const { db, state, effects } = allianceWorld();
    state.countries.find((c) => c.id === "T")!.ownerUserId = "uT";
    const proposal = await as(db, "uA", "A").proposeAllianceAction({
      allianceId: "al1",
      actionType: "trade_bloc",
      targetId: "T",
      title: "Trade with Target",
    });
    await as(db, "uA", "A").voteOnAllianceAction({ actionId: proposal.id, vote: "for" });
    await as(db, "uB", "B").voteOnAllianceAction({ actionId: proposal.id, vote: "for" });
    const offers = state.foreignPolicyActions.filter((a) => a.actionType === "free_trade");
    expect(offers).toHaveLength(3);
    expect(offers.every((a) => a.status === "proposed")).toBe(true);
    expect(effects).toHaveLength(0);
  });
});
