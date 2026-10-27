/** @jest-environment node */
/**
 * An admin world event may span realms (realm time design: each nation runs on its realm's clock). Its effects start
 * at the same real moment for every nation, read on that nation's own realm clock, so a 6× realm's start is its own
 * clock time and Ixnay's is Ixnay's; the wizard says so.
 */
const mockCreateEffects = jest.fn();
jest.mock("~/lib/economy/storyteller-effects", () => ({
  createStorytellerEffects: (...args: unknown[]) => mockCreateEffects(...args),
  endStorytellerEffects: jest.fn(),
}));
jest.mock("~/server/shared/realm-time", () => {
  const actual = jest.requireActual("~/server/shared/realm-time");
  const readers = jest.requireActual("~/tests/fixtures/realm-readers");
  return {
    ...actual,
    clocksForRealms: jest.fn(
      async () =>
        new Map([
          ["realm-frost", readers.sixTimesReader()],
          ["default", readers.ixnayReader()],
        ])
    ),
  };
});

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { adminWorldEventsRouter } from "~/server/api/routers/admin/worldEvents";
import { clockTimeAt } from "~/lib/realms/realm-time-convert";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { ixnayReader, sixTimesReader } from "~/tests/fixtures/realm-readers";

describe("a world event across realms", () => {
  it("starts each nation's effects on its own realm's clock", async () => {
    const affected = [
      { country: { id: "frost-1", name: "Frostmark", realmId: "realm-frost" } },
      { country: { id: "ixnay-1", name: "Caphiria", realmId: "default" } },
    ];
    const db = createMockPrisma({
      worldEvent: {
        create: jest
          .fn()
          .mockResolvedValue({ id: "we1", name: "Plague", affectedCountries: affected }),
      },
      adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
    });
    const caller = createCallerFactory(adminWorldEventsRouter)(
      createMockRouterContext({
        db,
        auth: { userId: "clerk_admin" },
        user: { id: "admin", clerkUserId: "clerk_admin", role: { name: "admin", level: 10 } },
      }) as never
    );
    const startsAt = new Date("2026-11-01T00:00:00Z");
    await caller.createWorldEvent({
      name: "Plague",
      type: "pandemic",
      severity: 0.5,
      duration: 2,
      startsAt,
      affectedCountryIds: ["frost-1", "ixnay-1"],
    });

    const drafts: Array<{ countryId: string; ixTime: number }> =
      mockCreateEffects.mock.calls[0]![1];
    const startOf = (id: string) => drafts.find((d) => d.countryId === id)!.ixTime;
    expect(startOf("frost-1")).toBe(clockTimeAt(sixTimesReader(), startsAt.getTime()));
    expect(startOf("ixnay-1")).toBe(clockTimeAt(ixnayReader(), startsAt.getTime()));
    expect(startOf("frost-1")).not.toBe(startOf("ixnay-1"));
  });

  it("a global event reaches every non-demo nation, not none (the wizard sends no ids for Global)", async () => {
    mockCreateEffects.mockClear();
    const affected = [
      { country: { id: "frost-1", name: "Frostmark", realmId: "realm-frost" } },
      { country: { id: "ixnay-1", name: "Caphiria", realmId: "default" } },
    ];
    const create = jest
      .fn()
      .mockResolvedValue({ id: "we2", name: "Boom", affectedCountries: affected });
    const findMany = jest.fn().mockResolvedValue([{ id: "frost-1" }, { id: "ixnay-1" }]);
    const db = createMockPrisma({
      worldEvent: { create },
      country: { findMany },
      adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
    });
    const caller = createCallerFactory(adminWorldEventsRouter)(
      createMockRouterContext({
        db,
        auth: { userId: "clerk_admin" },
        user: { id: "admin", clerkUserId: "clerk_admin", role: { name: "admin", level: 10 } },
      }) as never
    );
    await caller.createWorldEvent({
      name: "Boom",
      type: "economic_boom",
      severity: 0.3,
      duration: 1,
      startsAt: new Date("2026-11-01T00:00:00Z"),
      affectedCountryIds: [],
      allCountries: true,
    });

    expect(findMany).toHaveBeenCalledWith({ where: { isDemo: false }, select: { id: true } });
    const createdFor = create.mock.calls[0]![0].data.affectedCountries.create.map(
      (c: { countryId: string }) => c.countryId
    );
    expect(createdFor).toEqual(["frost-1", "ixnay-1"]);
    const drafts: Array<{ countryId: string }> = mockCreateEffects.mock.calls[0]![1];
    expect(new Set(drafts.map((d) => d.countryId))).toEqual(new Set(["frost-1", "ixnay-1"]));
  });
});
