/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/action-links", () => ({
  ...jest.requireActual("~/server/modules/action-links"),
  createChain: jest.fn(async () => ({ id: "s_new" })),
  reviewChain: jest.fn(async () => {
    const { ActionLinkError } = jest.requireActual("~/server/modules/action-links");
    throw new ActionLinkError("FORBIDDEN", "You cannot review this chain");
  }),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { actionLinksRouter } from "~/server/api/routers/actionLinks";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createChain } from "~/server/modules/action-links";

const caller = (user: object | null, db: object = {}) =>
  createCallerFactory(actionLinksRouter)(
    createMockRouterContext({ auth: user ? { userId: "owner_1" } : null, user: user as never, db }) as never
  );

const owner = { id: "u1", clerkUserId: "owner_1", countryId: "c1", role: { name: "user", level: 100 } };
const noCountry = { ...owner, countryId: null };

describe("actionLinks router", () => {
  it("creates a chain for the caller's own country", async () => {
    await expect(caller(owner).createChain({ title: "Pact" })).resolves.toEqual({ id: "s_new" });
    expect(createChain).toHaveBeenCalledWith(expect.anything(), "c1", "Pact");
  });

  it("refuses chain writes from a user without a country", async () => {
    await expect(caller(noCountry).createChain({ title: "Pact" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("maps module refusals to the same TRPC code", async () => {
    await expect(caller(owner).reviewChain({ storylineId: "s1", approve: true })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("serves activity cards for public activities only", async () => {
    const findMany = jest.fn(async () => []);
    const country = { findMany: jest.fn(async () => []) };
    await caller(null, { activityFeed: { findMany }, country }).activityCards({ ids: ["a1"] });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["a1"] }, visibility: "public" } })
    );
    expect(country.findMany).not.toHaveBeenCalled();
  });
});
