/** @jest-environment node */
/**
 * Stress finding C-21: two concurrent embargo proposals from Varshan on Urcea were both enacted (two actions, each
 * with GDP effects on both nations), and lifting one of them unwound the other's effects too (the legacy match by
 * description took the other action's identically described rows) while the other stayed "active". Opening is now
 * serialised per (initiator, target, type), and the legacy match never takes rows keyed by another action. C-25: of two
 * parallel accepts only the one that enacts the proposal succeeds and notifies the proposer.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/lib/diplomacy/news-generator", () => ({
  generateDiplomaticNews: jest.fn(async () => null),
}));

import { IxTime } from "~/lib/ixtime";
import { notificationAPI } from "~/lib/notifications/api";
import { createCallerFactory } from "~/server/api/trpc";
import { diplomaticPoliciesRouter } from "~/server/api/routers/diplomacy/policies";
import {
  endForeignPolicyAction,
  foreignPolicyEffectKey,
} from "~/lib/diplomacy/foreign-policy-effects";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation, addOwner, asOwner } from "~/tests/helpers/nation-world";

const NOW = Date.UTC(2043, 0, 15);
let db: MemoryPrisma;

beforeEach(async () => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(NOW);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  for (const id of ["varshan", "urcea"]) {
    await addNation(db as never, { id, name: id, baselineDate: new Date(NOW - 365 * 86_400_000) });
  }
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

it("enacts one embargo however many proposals race", async () => {
  const owner = createCallerFactory(diplomaticPoliciesRouter)(
    asOwner(db as never, await addOwner(db as never, "lena", "varshan"))
  );
  const propose = () =>
    owner.proposeForeignPolicyAction({
      targetId: "urcea",
      actionType: "embargo",
      severity: "severe",
    });
  const results = await Promise.allSettled([propose(), propose()]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await db.foreignPolicyAction.count({ where: { actionType: "embargo" } })).toBe(1);
});

it("lifting one action never unwinds another action's identically described effects", async () => {
  const description = "Foreign policy: embargo (severe) against urcea";
  for (const id of ["a1", "a2"]) {
    await db.foreignPolicyAction.create({
      data: {
        id,
        initiatorId: "varshan",
        targetId: "urcea",
        actionType: "embargo",
        severity: "severe",
        status: "active",
      },
    });
    await db.storytellerEffect.create({
      data: {
        countryId: "varshan",
        ixTimeTimestamp: new Date(NOW),
        inputType: "gdp_level_adjustment",
        value: -0.01,
        duration: 4,
        description,
        createdBy: foreignPolicyEffectKey(id),
      },
    });
  }
  expect(await endForeignPolicyAction(db as never, "a1", "lifted")).toBe(true);
  const unwound = await db.storytellerEffect.findMany({
    where: { description: `Ended: ${description}` },
  });
  expect(unwound.map((r) => r.createdBy)).toEqual([foreignPolicyEffectKey("a1")]);
});

it("sends one acceptance notice when two accepts race", async () => {
  const lena = await addOwner(db as never, "lena", "varshan");
  const owen = await addOwner(db as never, "owen", "urcea");
  const policies = createCallerFactory(diplomaticPoliciesRouter);
  const proposal = await policies(asOwner(db as never, lena)).proposeForeignPolicyAction({
    targetId: "urcea",
    actionType: "free_trade",
  });
  const accept = () =>
    policies(asOwner(db as never, owen)).respondToForeignPolicyProposal({
      actionId: proposal.id,
      choice: "accept",
    });
  const results = await Promise.allSettled([accept(), accept()]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const accepted = jest
    .mocked(notificationAPI.create)
    .mock.calls.filter(([n]) => (n as { title?: string }).title === "Proposal Accepted");
  expect(accepted).toHaveLength(1);
});
