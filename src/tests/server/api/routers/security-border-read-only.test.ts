/** @jest-environment node */
// MC-13: security.getBorderSecurity is a query, so it must not create a row for a country
// that has none; it returns the schema defaults instead.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: { user: { findUnique: jest.fn() }, auditLog: { create: jest.fn() } },
  isDatabaseReadOnly: true,
}));

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { securityBordersRouter } from "~/server/api/routers/security/borders";
import { createMockRouterContext } from "~/tests/helpers/router-context";

function callerWith(row: Record<string, unknown> | null) {
  const db = {
    borderSecurity: {
      findUnique: jest.fn(async () => row),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  };
  const caller = createCallerFactory(securityBordersRouter)(
    createMockRouterContext({ db }) as never
  );
  return { db, caller };
}

describe("security.getBorderSecurity", () => {
  it("returns the stored row", async () => {
    const row = { id: "b1", countryId: "c1", overallSecurityLevel: 42, neighborThreats: [] };
    const { caller } = callerWith(row);
    await expect(caller.getBorderSecurity({ countryId: "c1" })).resolves.toEqual(row);
  });

  it("returns defaults without writing when the country has no row", async () => {
    const { db, caller } = callerWith(null);

    const result = await caller.getBorderSecurity({ countryId: "c1" });

    expect(result).toEqual(
      expect.objectContaining({
        countryId: "c1",
        overallSecurityLevel: 70,
        securityStatus: "moderate",
        neighborThreats: [],
      })
    );
    expect(db.borderSecurity.create).not.toHaveBeenCalled();
    expect(db.borderSecurity.upsert).not.toHaveBeenCalled();
  });
});
