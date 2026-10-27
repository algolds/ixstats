/** @jest-environment node */
/**
 * P1-22 / realm time D2a: operations move the defense model's derived readiness, not a typed one. Deploying wears
 * the deployed branches' condition; a training exercise lifts their training (10% more with the Generals satisfied);
 * other operations leave a reset bill. Operations are stamped and rated on the nation's realm clock.
 */
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({
  db: {
    systemLog: { create: jest.fn() },
    user: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
  },
  isDatabaseReadOnly: false,
}));

jest.mock("~/server/modules/defense", () => ({ applyOperationReadiness: jest.fn(async () => 1) }));
jest.mock("~/server/modules/combat", () => ({
  newBattleId: () => "op_new",
  sealIntervention: jest.fn(async () => ({})),
  resolveIntervention: jest.fn(async () => null),
}));
const REALM_NOW = 2.1e12;
jest.mock("~/server/shared/realm-time", () => ({
  clockForCountry: jest.fn(async () => ({ now: () => REALM_NOW, multiplier: 2, paused: false })),
}));

import { newsGenerator } from "~/lib/diplomacy/news-generator";
import { applyOperationReadiness } from "~/server/modules/defense";
import { notificationAPI } from "~/lib/notifications/api";
import { createCallerFactory } from "~/server/api/trpc";
import { securityOperationsRouter } from "~/server/api/routers/security/operations";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";
import { createMockCallerContext } from "~/tests/helpers/router-context";

jest.spyOn(newsGenerator, "generateDiplomaticNews").mockResolvedValue("post_1");
jest.spyOn(notificationAPI, "create").mockResolvedValue("notification_1");

const OWN = "country_1";
const DAY = 24 * 60 * 60 * 1000;
let db: MockPrismaProxy;
let calls = 0;
const operations = () => {
  const user = {
    id: "u_owner",
    clerkUserId: "clerk_u_owner",
    countryId: OWN,
    membershipTier: "mycountry_premium",
    role: null,
  };
  return createCallerFactory(securityOperationsRouter)(
    createMockCallerContext({
      db,
      user,
      auth: { userId: user.clerkUserId },
      rateLimitIdentifier: `readiness-${++calls}`,
    })
  );
};

const operation = (operationType: string, ranIxDays: number, duration: number | null = 30) => ({
  id: "op_1",
  countryId: OWN,
  name: "Northwind",
  operationType,
  status: "active",
  duration,
  startIxTime: REALM_NOW - ranIxDays * DAY,
  createdAt: new Date(),
  deployments: [{ unitId: "unit_1", status: "deployed" }],
});

const readiness = applyOperationReadiness as jest.Mock;

beforeEach(() => {
  readiness.mockClear();
  db = createMockPrisma();
  db.user.findUnique.mockResolvedValue({ id: "u_owner", countryId: OWN });
  db.country.findUnique.mockResolvedValue({
    id: OWN,
    ownerUserId: "u_owner",
    name: "Ownland",
    currentGdpPerCapita: 50_000,
    currentPopulation: 10_000_000,
  });
  db.militaryOperation.update.mockImplementation(async ({ data }: { data: object }) => ({ status: "completed", ...data }));
  db.militaryOperation.updateMany.mockResolvedValue({ count: 1 });
  db.governmentComponent.findMany.mockResolvedValue([]);
});

it("createOperation wears the deployed branches and stamps the realm clock", async () => {
  db.militaryUnit.findMany.mockResolvedValue([{ id: "unit_1" }]);
  db.militaryOperation.create.mockResolvedValue({ id: "op_1", targetCountry: null });
  await operations().createOperation({
    countryId: OWN,
    operationType: "training",
    name: "Northwind",
    unitIds: ["unit_1"],
  });
  expect(readiness).toHaveBeenCalledWith(db, {
    countryId: OWN,
    unitIds: ["unit_1"],
    assetIds: [],
    change: "deploy",
  });
  expect(db.militaryOperation.create.mock.calls[0]![0].data.startIxTime).toBe(REALM_NOW);
  expect(db.militaryUnit.updateMany).not.toHaveBeenCalled();
});

describe("endOperation", () => {
  it("lifts the trained branches' training", async () => {
    db.militaryOperation.findUnique.mockResolvedValue(operation("training", 30));
    await operations().endOperation({ operationId: "op_1" });
    expect(readiness).toHaveBeenCalledWith(db, {
      countryId: OWN,
      unitIds: ["unit_1"],
      assetIds: [],
      change: "trainingEnded",
      generalsMultiplier: 1,
    });
    expect(db.militaryOperation.updateMany.mock.calls[0]![0].data.endIxTime).toBe(REALM_NOW);
  });

  it("leaves a reset bill after any other operation", async () => {
    db.militaryOperation.findUnique.mockResolvedValue(operation("blockade", 30));
    await operations().endOperation({ operationId: "op_1" });
    expect(readiness.mock.calls[0]![1]).toMatchObject({ change: "operationEnded" });
  });

  it("recovers 10% more with the Generals satisfied", async () => {
    db.militaryOperation.findUnique.mockResolvedValue(operation("training", 30));
    db.governmentComponent.findMany.mockResolvedValue([
      { componentType: "MILITARY_ADMINISTRATION" },
    ]);
    db.budgetAllocation.findFirst.mockResolvedValue({ budgetYear: 2042 });
    db.budgetAllocation.findMany.mockResolvedValue([
      { allocatedPercent: 20, department: { category: "Defense" } },
    ]);
    await operations().endOperation({ operationId: "op_1" });
    expect(readiness.mock.calls[0]![1]).toMatchObject({
      change: "trainingEnded",
      generalsMultiplier: 1.1,
    });
  });

  it("ends once: a concurrent end finds it claimed and fights nothing", async () => {
    db.militaryOperation.findUnique.mockResolvedValue(operation("blockade", 30));
    db.militaryOperation.updateMany.mockResolvedValue({ count: 0 });
    await expect(operations().endOperation({ operationId: "op_1" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(db.militaryOperation.update).not.toHaveBeenCalled();
  });

  it("rates the outcome on the server, ignoring a client rating", async () => {
    db.militaryOperation.findUnique.mockResolvedValue(operation("blockade", 3));
    await operations().endOperation({
      operationId: "op_1",
      successRating: "success",
    } as { operationId: string });
    expect(db.militaryOperation.updateMany.mock.calls[0]![0].data).toMatchObject({ status: "completed" });
    expect(db.militaryOperation.update.mock.calls[0]![0].data).toMatchObject({ successRating: "failure" });
  });
});

it("endOperation ends only its own GDP drain: by its key, or a legacy row's exact description (F28)", async () => {
  db.militaryOperation.findUnique.mockResolvedValue(operation("training", 30));
  await operations().endOperation({ operationId: "op_1" });
  const scope = {
    countryId: OWN,
    OR: [
      { createdBy: "operation:op_1" },
      { description: "Military operation: Northwind (training)" },
    ],
  };
  expect(db.storytellerEffect.updateMany.mock.calls[0]![0].where.AND[0]).toEqual(scope);
});
