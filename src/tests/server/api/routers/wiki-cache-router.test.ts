/** @jest-environment node */
/**
 * wikiCache router: profile and deep-scan reads are public; the deep scan serves its shared cache,
 * otherwise reads every page (the main article included) from the wiki in one batch, so text a
 * caller sends can never land in the cached result; refreshing a cache needs a signed-in user.
 *
 * `jest` is the ambient global (not imported from "@jest/globals") because the hoisted
 * jest.mock() factories below call jest.fn() inline; see trpc-impersonation.test.ts.
 */
jest.mock("~/lib/wiki-os/adapters/ixstates/cache-service", () => ({
  __esModule: true,
  wikiCacheService: {
    getCountryProfile: jest.fn(),
    clearCountryCache: jest.fn(),
  },
  cleanWikitextForDisplay: (text: string) => text.trim(),
}));

jest.mock("~/lib/wiki-os/adapters/mediawiki/bridge", () => ({
  __esModule: true,
  getCategoryMembers: jest.fn(),
  getBatchWikitext: jest.fn(),
}));

jest.mock("~/lib/wiki-os/core/intelligent-lore-cache", () => ({
  __esModule: true,
  intelligentLoreCache: {
    getDeepScan: jest.fn(),
    setDeepScan: jest.fn(),
    getCategoryMembers: jest.fn(),
    setCategoryMembers: jest.fn(),
    coalesce: (_key: string, fn: () => Promise<unknown>) => fn(),
  },
}));

jest.mock("~/lib/builder/wiki-data-extractor", () => ({
  __esModule: true,
  extractDataFromWikiSections: jest.fn(() => ({ extracted: true })),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { wikiCacheRouter } from "~/server/api/routers/wikiCache";
import { wikiCacheService } from "~/lib/wiki-os/adapters/ixstates/cache-service";
import { getBatchWikitext, getCategoryMembers } from "~/lib/wiki-os/adapters/mediawiki/bridge";
import { intelligentLoreCache } from "~/lib/wiki-os/core/intelligent-lore-cache";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(wikiCacheRouter);
const batch = getBatchWikitext as jest.Mock;
const members = getCategoryMembers as jest.Mock;
const lore = intelligentLoreCache as unknown as Record<string, jest.Mock>;

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

/** A batch result holding wiki text for each title. */
function wikiPages(titles: string[]) {
  return new Map(titles.map((t) => [t.toLowerCase(), { title: t, wikitext: `wiki text of ${t}` }]));
}

beforeEach(() => {
  jest.clearAllMocks();
  lore.getDeepScan!.mockResolvedValue(null);
  lore.getCategoryMembers!.mockResolvedValue(null);
  members.mockResolvedValue([]);
  batch.mockImplementation(async (titles: string[]) => wikiPages(titles));
});

describe("builderDeepScan", () => {
  it("serves a cached scan without touching the wiki", async () => {
    lore.getDeepScan!.mockResolvedValue({
      pagesScanned: 1,
      foundVariants: ["Caphiria"],
      categoryUsed: null,
      extractedData: {},
      pages: [],
    });

    const result = await callerAs(null).builderDeepScan({ countryName: "Caphiria" });

    expect(result.fromCache).toBe(true);
    expect(batch).not.toHaveBeenCalled();
  });

  it("reads the main article from the wiki, not from the caller, before caching", async () => {
    const result = await callerAs(null).builderDeepScan({
      countryName: "Caphiria",
      mainWikitext: "Caphiria is a province of Burgundie.",
    });

    expect(batch).toHaveBeenCalledWith(expect.arrayContaining(["Caphiria"]), "ixwiki");
    const cached = lore.setDeepScan!.mock.calls[0]![2] as { pages: Array<{ content: string }> };
    expect(cached.pages.map((p) => p.content)).not.toContain(
      "Caphiria is a province of Burgundie."
    );
    expect(result.pages[0]).toEqual({ title: "Caphiria", content: "wiki text of Caphiria" });
  });

  it("prefers a country-specific category and ranks builder topics first", async () => {
    members.mockResolvedValue([
      { title: "Cuisine of Caphiria" },
      { title: "Economy of Caphiria" },
      { title: "Category:Subcats" },
      { title: "Caphiria" },
      { title: "Government of Caphiria" },
    ]);

    const result = await callerAs(null).builderDeepScan({
      countryName: "Caphiria",
      categoryTags: ["Category:Countries", "Category:Caphirian history"],
    });

    const scanned = batch.mock.calls[0]![0] as string[];
    expect(scanned[0]).toBe("Caphiria");
    expect(scanned.slice(1, 3).sort()).toEqual(["Economy of Caphiria", "Government of Caphiria"]);
    expect(scanned).not.toContain("Category:Subcats");
    expect(result.categoryUsed).toBe("Caphiria");
    // Generic categories are never probed.
    expect(members).not.toHaveBeenCalledWith("Countries", 50, "page", "ixwiki");
  });

  it("adds the standard sub-articles when the category is thin, capped at eight pages", async () => {
    await callerAs(null).builderDeepScan({ countryName: "Urcea", wikiSource: "iiwiki" });

    const scanned = batch.mock.calls[0]![0] as string[];
    expect(scanned).toEqual(
      expect.arrayContaining(["Urcea", "Economy of Urcea", "Foreign relations of Urcea"])
    );
    expect(scanned.length).toBeLessThanOrEqual(8);
    expect(batch.mock.calls[0]![1]).toBe("iiwiki");
  });

  it("rejects an empty country name and an unknown wiki", async () => {
    await expect(callerAs(null).builderDeepScan({ countryName: "" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      callerAs(null).builderDeepScan({ countryName: "X", wikiSource: "wikipedia" as never })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
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
