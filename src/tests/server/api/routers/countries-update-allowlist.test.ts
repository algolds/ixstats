/** @jest-environment node */
/**
 * P0-01: `countries.update` takes an explicit allow-list (name, flag). An owner cannot set a figure the simulation owns,
 * an ownership or realm column, or a nested relation write; those keys are refused before anything is written. The
 * admin panel's columns live behind `countries.adminUpdate`, which a player cannot call.
 */
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/server/shared/map-invalidation", () => ({
  ...jest.requireActual("~/server/shared/map-invalidation"),
  invalidateRealmMap: jest.fn().mockResolvedValue(1),
}));
jest.mock("~/server/shared/intelligence-alert-thresholds", () => ({
  evaluateCountryThresholds: jest.fn().mockResolvedValue(undefined),
}));

import { createTRPCRouter } from "~/server/api/trpc";
import { managementLifecycleProcedures } from "~/server/api/routers/countries/management/lifecycle";
import { CALLER_COUNTRY, createIdorContext } from "~/tests/helpers/country-idor-context";

function setup(role: "member" | "admin" = "member") {
  const update = jest.fn(async ({ data }: { data: object }) => ({
    id: CALLER_COUNTRY,
    realmId: "realm_1",
    name: "Testland",
    continent: null,
    region: null,
    ...data,
  }));
  const ctx = createIdorContext(
    {
      country: {
        findUnique: jest.fn(async () => ({
          id: CALLER_COUNTRY,
          name: "Testland",
          slug: "testland",
          realmId: "realm_1",
          continent: null,
          region: null,
        })),
        update,
      },
    },
    role
  );
  const caller = createTRPCRouter(managementLifecycleProcedures).createCaller(ctx as never);
  return { caller, update };
}

describe("countries.update allow-list (P0-01)", () => {
  it.each([
    ["currentTotalGdp", { currentTotalGdp: 9e15 }],
    ["publicApproval", { publicApproval: 100 }],
    ["ownerUserId", { ownerUserId: "someone_else" }],
    ["realmId", { realmId: "realm_2" }],
    ["a nested relation write", { governmentStructure: { delete: true } }],
  ])("refuses %s from an owner and writes nothing", async (_what, extra) => {
    const { caller, update } = setup();
    await expect(
      caller.update({ id: CALLER_COUNTRY, flag: "https://example.org/f.svg", ...extra } as never)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(update).not.toHaveBeenCalled();
  });

  it.each(["javascript:alert(1)", "http://example.org/f.svg", "f.svg"])(
    "refuses the flag %p, which the editor would refuse too",
    async (flag) => {
      const { caller, update } = setup();
      await expect(caller.update({ id: CALLER_COUNTRY, flag })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(update).not.toHaveBeenCalled();
    }
  );

  it("lets an owner save the flag", async () => {
    const { caller, update } = setup();
    await caller.update({ id: CALLER_COUNTRY, flag: "https://example.org/f.svg" });
    expect(update).toHaveBeenCalledWith({
      where: { id: CALLER_COUNTRY },
      data: expect.objectContaining({ flag: "https://example.org/f.svg" }),
    });
  });

  it("keeps the admin panel's figures behind adminUpdate", async () => {
    const member = setup("member");
    await expect(
      member.caller.adminUpdate({ id: CALLER_COUNTRY, currentTotalGdp: 1 })
    ).rejects.toThrow(/admin/i);
    expect(member.update).not.toHaveBeenCalled();

    const admin = setup("admin");
    await admin.caller.adminUpdate({
      id: CALLER_COUNTRY,
      currentTotalGdp: 1,
      hideDiplomaticOps: true,
    });
    expect(admin.update).toHaveBeenCalledWith({
      where: { id: CALLER_COUNTRY },
      data: expect.objectContaining({ currentTotalGdp: 1, hideDiplomaticOps: true }),
    });
    await expect(
      admin.caller.adminUpdate({ id: CALLER_COUNTRY, ownerUserId: "x" } as never)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
