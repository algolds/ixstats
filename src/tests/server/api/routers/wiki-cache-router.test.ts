/** @jest-environment node */
/**
 * wikiCache router: profile reads are public; refreshing a cache needs a signed-in user.
 *
 * `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
 * jest.mock() factory below calls jest.fn() inline; see trpc-impersonation.test.ts.
 */
jest.mock("~/lib/wiki-os/adapters/ixstates/cache-service", () => ({
  __esModule: true,
  wikiCacheService: {
    getCountryProfile: jest.fn(),
    clearCountryCache: jest.fn(),
  },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiCacheRouter } from "~/server/api/routers/wikiCache";
import { wikiCacheService } from "~/lib/wiki-os/adapters/ixstates/cache-service";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(wikiCacheRouter);

function callerAs(id: string | null) {
  return createCaller(
    createMockRouterContext({
      db: createMockPrisma(),
      auth: id ? { userId: `clerk_${id}` } : null,
      user: id ? { id, clerkUserId: `clerk_${id}` } : null,
      rateLimitIdentifier: `${id}_${Math.random()}`,
    }) as never
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("profile and refresh", () => {
  it("serves country profiles publicly", async () => {
    (wikiCacheService.getCountryProfile as jest.Mock).mockResolvedValue({ name: "Caphiria" });
    await expect(callerAs(null).getCountryProfile({ countryName: "Caphiria" })).resolves.toEqual({
      name: "Caphiria",
    });
  });

  it("needs a signed-in user to refresh a country's cache", async () => {
    await expect(callerAs(null).refreshCountryCache({ countryName: "Caphiria" })).rejects.toThrow(
      /Authentication required/
    );
    expect(wikiCacheService.clearCountryCache).not.toHaveBeenCalled();

    await callerAs("u1").refreshCountryCache({ countryName: "Caphiria" });
    expect(wikiCacheService.clearCountryCache).toHaveBeenCalledWith("Caphiria");
  });
});
