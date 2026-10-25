/** @jest-environment node */
/** P2-11 (F32): the public player catalog query never writes; an empty catalog reads as the built-in data. */
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({
  db: { systemLog: { create: jest.fn() }, user: { findUnique: jest.fn() } },
  isDatabaseReadOnly: false,
}));

import { createCallerFactory } from "~/server/api/trpc";
import { militaryEquipmentCatalogRouter } from "~/server/api/routers/militaryEquipment/catalog";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";
import { createMockCallerContext } from "~/tests/helpers/router-context";

let db: MockPrismaProxy;
const catalog = () =>
  createCallerFactory(militaryEquipmentCatalogRouter)(
    createMockCallerContext({ db, user: null, auth: null })
  );

beforeEach(() => {
  db = createMockPrisma();
  db.militaryEquipmentCatalog.count.mockResolvedValue(0);
  db.defenseManufacturer.count.mockResolvedValue(0);
  db.militaryEquipmentCatalog.findMany.mockResolvedValue([]);
  db.defenseManufacturer.findMany.mockResolvedValue([]);
});

it("serves the built-in data for an empty catalog without seeding it", async () => {
  const res = await catalog().getPlayerCatalog();
  expect(res.source).toBe("builtin");
  expect(res.equipment.length).toBeGreaterThan(0);
  expect(res.manufacturers.length).toBeGreaterThan(0);
  expect(db.militaryEquipmentCatalog.createMany).not.toHaveBeenCalled();
  expect(db.defenseManufacturer.createMany).not.toHaveBeenCalled();
});
