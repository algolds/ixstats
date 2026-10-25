/** @jest-environment node */
/**
 * P1-22: deploying units clamps readiness at 0; ending an operation recovers readiness (more for
 * training, and with the Generals satisfied), clamps at 100, and the server rates the outcome.
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

import { newsGenerator } from "~/lib/diplomacy/news-generator";
import { notificationAPI } from "~/lib/notifications/api";
import { IxTime } from "~/lib/ixtime";
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
  startIxTime: IxTime.getCurrentIxTime() - ranIxDays * DAY,
  createdAt: new Date(),
  deployments: [{ unitId: "unit_1", status: "deployed" }],
});

beforeEach(() => {
  db = createMockPrisma();
  db.user.findUnique.mockResolvedValue({ id: "u_owner", countryId: OWN });
  db.country.findUnique.mockResolvedValue({
    id: OWN,
    ownerUserId: "u_owner",
    name: "Ownland",
    currentGdpPerCapita: 50_000,
    currentPopulation: 10_000_000,
  });
  db.militaryOperation.update.mockImplementation(async ({ data }: { data: object }) => data);
  db.governmentComponent.findMany.mockResolvedValue([]);
});

it("createOperation clamps deployed units' readiness at 0", async () => {
  db.militaryUnit.findMany.mockResolvedValue([{ id: "unit_1" }]);
  db.militaryOperation.create.mockResolvedValue({ id: "op_1", targetCountry: null });
  await operations().createOperation({
    countryId: OWN,
    operationType: "training",
    name: "Northwind",
    unitIds: ["unit_1"],
  });
  expect(db.militaryUnit.updateMany).toHaveBeenCalledWith({
    where: { id: { in: ["unit_1"] }, readiness: { lt: 0 } },
    data: { readiness: 0 },
  });
});

describe("endOperation", () => {
  it("gives training units a net gain and clamps at 100", async () => {
    db.militaryOperation.findUnique.mockResolvedValue(operation("training", 30));
    await operations().endOperation({ operationId: "op_1" });
    expect(db.militaryUnit.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["unit_1"] } },
      data: { readiness: { increment: 20 } },
    });
    expect(db.militaryUnit.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["unit_1"] }, readiness: { gt: 100 } },
      data: { readiness: 100 },
    });
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
    expect(db.militaryUnit.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["unit_1"] } },
      data: { readiness: { increment: 22 } },
    });
  });

  it("rates the outcome on the server, ignoring a client rating", async () => {
    db.militaryOperation.findUnique.mockResolvedValue(operation("blockade", 3));
    await operations().endOperation({
      operationId: "op_1",
      successRating: "success",
    } as { operationId: string });
    expect(db.militaryOperation.update.mock.calls[0]![0].data).toMatchObject({
      status: "completed",
      successRating: "failure",
    });
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
