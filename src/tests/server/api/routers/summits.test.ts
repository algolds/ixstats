/** @jest-environment node */
/**
 * Summits ride the treaty inbox: one open summit per pair of nations, agreeing warms relations by 5 and enacts no
 * economic effect, and a summit whose date has passed can no longer be agreed to.
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue("n1") },
}));
jest.mock("~/lib/diplomacy/news-generator", () => ({
  generateDiplomaticNews: jest.fn().mockResolvedValue(undefined),
}));

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { diplomaticPoliciesRouter } from "~/server/api/routers/diplomacy/policies";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createDiplomacyFakeDb } from "~/tests/helpers/diplomacy-fake-db";

const COUNTRIES = [
  { id: "A", name: "Alpha", realmId: "default", ownerUserId: "uA" },
  { id: "B", name: "Beta", realmId: "default", ownerUserId: "uB" },
];
const as = (db: unknown, userId: string, countryId: string) =>
  createCallerFactory(diplomaticPoliciesRouter)(
    createMockRouterContext({
      db,
      auth: { userId: `clerk_${userId}` },
      user: { id: userId, clerkUserId: `clerk_${userId}`, countryId, role: { name: "member" } },
    }) as never
  );
const summit = (id: string, effectiveIxTime: number) => ({
  id,
  initiatorId: "A",
  targetId: "B",
  actionType: "summit",
  status: "proposed",
  effectiveIxTime,
  relationshipDelta: 5,
  initiatorGdpImpact: 0,
  targetGdpImpact: 0,
  createdAt: new Date(),
});
const FAR_FUTURE = Number.MAX_SAFE_INTEGER;

describe("summits", () => {
  it("allow one open summit per pair, from either side", async () => {
    const { db, state } = createDiplomacyFakeDb({ countries: COUNTRIES });
    await as(db, "uA", "A").proposeSummit({ targetId: "B", when: "quarter", agenda: "Ports" });
    expect(state.foreignPolicyActions[0]).toMatchObject({
      description: "Ports",
      category: "diplomatic",
    });
    await expect(
      as(db, "uB", "B").proposeSummit({ targetId: "A", when: "month" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(state.foreignPolicyActions).toHaveLength(1);
  });

  it("warm relations by 5 when agreed, with no economic effect", async () => {
    const { db, state } = createDiplomacyFakeDb({
      countries: COUNTRIES,
      foreignPolicyActions: [summit("s1", FAR_FUTURE)],
    });
    const relation = { id: "r1", country1: "A", country2: "B", strength: 50 };
    (db as { diplomaticRelation: { findFirst: unknown } }).diplomaticRelation.findFirst = jest.fn(
      async () => relation
    );

    await expect(
      as(db, "uB", "B").respondToForeignPolicyProposal({ actionId: "s1", choice: "accept" })
    ).resolves.toMatchObject({ status: "active" });

    expect(state.foreignPolicyActions[0]!.status).toBe("active");
    const { diplomaticRelation, storytellerEffect, bilateralTrade } = db as unknown as Record<
      string,
      Record<string, jest.Mock>
    >;
    expect(diplomaticRelation!.update!.mock.calls[0]![0]).toMatchObject({
      where: { id: "r1" },
      data: { strength: 55 },
    });
    expect(storytellerEffect!.createMany).not.toHaveBeenCalled();
    expect(bilateralTrade!.update).not.toHaveBeenCalled();
  });

  it("cannot be agreed to once its date has passed", async () => {
    const { db, state } = createDiplomacyFakeDb({
      countries: COUNTRIES,
      foreignPolicyActions: [summit("s1", 0)],
    });
    await expect(
      as(db, "uB", "B").respondToForeignPolicyProposal({ actionId: "s1", choice: "accept" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "This summit's date has already passed.",
    });
    expect(state.foreignPolicyActions[0]!.status).toBe("expired");
  });
});
