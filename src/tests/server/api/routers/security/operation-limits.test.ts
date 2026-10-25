/** @jest-environment node */
/**
 * P1-19: peacekeeping needs personnel and raises a relation once per target per window; a
 * PvNPC strike needs a relation with the target in the same realm and has a per-target cooldown.
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
import { createCallerFactory } from "~/server/api/trpc";
import { securityConflictsRouter } from "~/server/api/routers/security/conflicts";
import { securityOperationsRouter } from "~/server/api/routers/security/operations";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";
import { createMockCallerContext } from "~/tests/helpers/router-context";

jest.spyOn(newsGenerator, "generateDiplomaticNews").mockResolvedValue("post_1");
jest.spyOn(notificationAPI, "create").mockResolvedValue("notification_1");

const OWN = "country_1";
let db: MockPrismaProxy;
let calls = 0;
function ctx() {
  const user = {
    id: "u_owner",
    clerkUserId: "clerk_u_owner",
    countryId: OWN,
    membershipTier: "mycountry_premium",
    role: null,
  };
  return createMockCallerContext({
    db,
    user,
    auth: { userId: user.clerkUserId },
    rateLimitIdentifier: `op-limits-${++calls}`,
  });
}
const operations = () => createCallerFactory(securityOperationsRouter)(ctx());
const conflicts = () => createCallerFactory(securityConflictsRouter)(ctx());

beforeEach(() => {
  db = createMockPrisma();
  db.user.findUnique.mockResolvedValue({ id: "u_owner", countryId: OWN });
  db.militaryOperation.create.mockImplementation(async ({ data }: { data: object }) => ({
    id: "op_1",
    ...data,
    targetCountry: { id: "country_2", name: "Neighbour" },
  }));
});

describe("peacekeeping", () => {
  const peacekeeping = (personnelDeployed: number) =>
    operations().createOperation({
      countryId: OWN,
      operationType: "peacekeeping",
      name: "Blue Helmets",
      targetCountryId: "country_2",
      personnelDeployed,
    });

  beforeEach(() => {
    db.country.findUnique.mockResolvedValue({
      id: OWN,
      ownerUserId: "u_owner",
      name: "Ownland",
      currentGdpPerCapita: 50_000,
      currentPopulation: 10_000_000,
    });
    db.diplomaticRelation.findFirst.mockResolvedValue({ id: "rel_1", strength: 50 });
  });

  it("must deploy personnel", async () => {
    await expect(peacekeeping(0)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.militaryOperation.create).not.toHaveBeenCalled();
    expect(db.diplomaticRelation.update).not.toHaveBeenCalled();
  });

  it("raises the relation once and records it on the operation", async () => {
    db.militaryOperation.findFirst.mockResolvedValue(null);
    await peacekeeping(500);
    // Through applyRelationshipImpact, so the stored band follows the strength
    expect(db.diplomaticRelation.update).toHaveBeenCalledWith({
      where: { id: "rel_1" },
      data: expect.objectContaining({ strength: 60, relationship: "friendly" }),
    });
    expect(db.militaryOperation.create.mock.calls[0]![0].data.diplomaticImpact).toBe(10);
  });

  it("does not raise it again within the window", async () => {
    db.militaryOperation.findFirst.mockResolvedValue({ id: "op_earlier" });
    await peacekeeping(500);
    expect(db.diplomaticRelation.update).not.toHaveBeenCalled();
    expect(db.militaryOperation.create.mock.calls[0]![0].data.diplomaticImpact).toBe(0);
  });
});

describe("PvNPC strikes", () => {
  const strike = () => conflicts().resolvePvNPCConflict({ targetCountryId: "country_npc" });
  const country = (id: string, realmId: string) => ({
    id,
    name: id === OWN ? "Ownland" : "Npcland",
    realmId,
    currentGdpPerCapita: 20_000,
    currentPopulation: 1_000_000,
  });

  beforeEach(() => {
    db.user.findFirst.mockResolvedValue(null);
    db.militaryBranch.findMany.mockResolvedValue([]);
    db.country.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      country(where.id, "default")
    );
    db.diplomaticRelation.findFirst.mockResolvedValue({ id: "rel_npc" });
    db.militaryConflict.findFirst.mockResolvedValue(null);
    db.militaryConflict.create.mockResolvedValue({ id: "c_1", winner: OWN });
    db.storytellerEffect.createMany.mockResolvedValue({ count: 2 });
  });

  it("strikes a related NPC nation in the same realm", async () => {
    await expect(strike()).resolves.toMatchObject({ id: "c_1" });
  });

  it("refuses a nation with no relation", async () => {
    db.diplomaticRelation.findFirst.mockResolvedValue(null);
    await expect(strike()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.militaryConflict.create).not.toHaveBeenCalled();
  });

  it("refuses a nation in another realm", async () => {
    db.country.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      country(where.id, where.id === OWN ? "default" : "other_realm")
    );
    await expect(strike()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.militaryConflict.create).not.toHaveBeenCalled();
  });

  it("refuses a second strike on the same target within the cooldown", async () => {
    db.militaryConflict.findFirst.mockResolvedValue({ createdAt: new Date() });
    await expect(strike()).rejects.toThrow(/strike again on/);
    expect(db.militaryConflict.create).not.toHaveBeenCalled();
    expect(db.storytellerEffect.createMany).not.toHaveBeenCalled();
  });
});
