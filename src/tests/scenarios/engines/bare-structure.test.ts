/** @jest-environment node */
/**
 * The bare structure a governance consequence creates (no departments, no budget, the country's
 * own type, blank when it has none) leaves the "no government yet" screens as they were: the
 * profile checklist still asks for a form of government, and the Budget tab's create button
 * fills the bare row in with the form's departments, budget and type.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));

import { IxTime } from "~/lib/ixtime";
import { departmentsForForm, governmentTypeForForm } from "~/lib/government/form-departments";
import { ensureGovernmentStructure } from "~/lib/government/ensure-structure";
import { COMPLIANCE_NO_GOVERNMENT, complianceSections } from "~/lib/mycountry/compliance";
import { createCallerFactory } from "~/server/api/trpc";
import { governmentRouter } from "~/server/api/routers/government";
import { inferFormId } from "~/server/shared/founding-snapshot";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import { addIxnay, addNation, addOwner, asOwner } from "~/tests/helpers/nation-world";

const NOW = Date.UTC(2043, 0, 15);
let db: MemoryPrisma;

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  IxTime.setMultiplierOverride(0);
  IxTime.setTimeOverride(NOW);
  db = createMemoryPrisma();
  mockDb = db;
  await addIxnay(db as never);
  await addNation(db as never, { id: "bareland", baselineDate: new Date(NOW) });
  await db.budgetAllocation.deleteMany({});
  await db.governmentDepartment.deleteMany({});
  await db.governmentStructure.deleteMany({ where: { countryId: "bareland" } });
  await db.country.update({ where: { id: "bareland" }, data: { governmentType: null } });
});
afterEach(() => {
  IxTime.clearMultiplierOverride();
  IxTime.clearTimeOverride();
  jest.restoreAllMocks();
});

const checklist = (government: Parameters<typeof complianceSections>[0]["government"]) =>
  complianceSections({
    flag: null,
    coatOfArms: null,
    identity: null,
    government,
    hasTaxRates: true,
  }).find((s) => s.id === "government")!.missing;

it("the checklist reads a bare structure as no government yet", async () => {
  await ensureGovernmentStructure(db as never, "bareland");
  const bare = await db.governmentStructure.findUniqueOrThrow({
    where: { countryId: "bareland" },
    include: { departments: true, budgetAllocations: true },
  });
  expect(bare.governmentType).toBe("");
  expect(checklist(bare)).toEqual([COMPLIANCE_NO_GOVERNMENT]);
  expect(checklist(null)).toEqual([COMPLIANCE_NO_GOVERNMENT]);
});

it("creating the structure fills a bare row with the form's departments, budget and type", async () => {
  await ensureGovernmentStructure(db as never, "bareland");
  const lena = await addOwner(db as never, "lena", "bareland");
  const form = inferFormId([]);
  expect(
    await createCallerFactory(governmentRouter)(asOwner(db as never, lena)).createStructure({
      countryId: "bareland",
    })
  ).toMatchObject({ departments: departmentsForForm(form).length });
  const structure = await db.governmentStructure.findUniqueOrThrow({
    where: { countryId: "bareland" },
  });
  expect(structure.governmentType).toBe(governmentTypeForForm(form));
  expect(structure.totalBudget).toBeGreaterThan(0);
});
