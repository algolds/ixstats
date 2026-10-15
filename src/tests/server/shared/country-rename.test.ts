/** @jest-environment node */
/**
 * Renamed countries keep their old address: the redirect lookup, and Settings' rename (the
 * generic `countries.update` with a name) going through the same rename as the editor.
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
  evaluateThresholds: jest.fn().mockResolvedValue(undefined),
}));

import { createTRPCRouter } from "~/server/api/trpc";
import { managementLifecycleProcedures } from "~/server/api/routers/countries/management/lifecycle";
import { findCountrySlugRedirect, normalizeCountryName } from "~/server/shared/country-rename";
import { CALLER_COUNTRY, createIdorContext } from "~/tests/helpers/country-idor-context";

function redirectDb({
  redirect,
  live,
  target,
}: {
  redirect?: { countryId: string } | null;
  live?: { id: string } | null;
  target?: { slug: string | null } | null;
}) {
  return {
    countrySlugRedirect: { findUnique: jest.fn().mockResolvedValue(redirect ?? null) },
    country: {
      findUnique: jest.fn(async ({ where }: { where: { slug?: string; id?: string } }) =>
        where.slug ? (live ?? null) : (target ?? null)
      ),
    },
  };
}

describe("findCountrySlugRedirect", () => {
  it("sends an old slug to the country's current one", async () => {
    const db = redirectDb({ redirect: { countryId: "c1" }, target: { slug: "new-testland" } });
    await expect(findCountrySlugRedirect(db as never, "Testland")).resolves.toBe("new-testland");
    expect(db.countrySlugRedirect.findUnique).toHaveBeenCalledWith({
      where: { oldSlug: "testland" },
      select: { countryId: true },
    });
  });

  it("never redirects a slug a country holds now", async () => {
    const db = redirectDb({
      redirect: { countryId: "c1" },
      live: { id: "c2" },
      target: { slug: "new-testland" },
    });
    await expect(findCountrySlugRedirect(db as never, "testland")).resolves.toBeNull();
  });

  it("answers null for an unknown slug without more lookups", async () => {
    const db = redirectDb({});
    await expect(findCountrySlugRedirect(db as never, "nowhere")).resolves.toBeNull();
    expect(db.country.findUnique).not.toHaveBeenCalled();
  });

  it("answers null for a malformed address", async () => {
    const db = redirectDb({});
    await expect(findCountrySlugRedirect(db as never, "%E0%A4%A")).resolves.toBeNull();
  });
});

describe("normalizeCountryName", () => {
  it("trims and collapses inner whitespace", () => {
    expect(normalizeCountryName("  New \t Testland ")).toBe("New Testland");
  });
});

describe("countries.update with a new name (Settings)", () => {
  function setup() {
    const db: Record<string, Record<string, jest.Mock>> & { $transaction?: jest.Mock } = {
      country: {
        findUnique: jest.fn().mockResolvedValue({
          id: CALLER_COUNTRY,
          name: "Testland",
          slug: "testland",
          realmId: "realm_1",
          continent: null,
          region: null,
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(async ({ data }: { data: object }) => ({
          id: CALLER_COUNTRY,
          realmId: "realm_1",
          continent: null,
          region: null,
          ...data,
        })),
      },
      realmPage: { findFirst: jest.fn().mockResolvedValue(null) },
      nationalIdentity: { upsert: jest.fn().mockResolvedValue({}) },
      countrySlugRedirect: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    db.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(db));
    const caller = createTRPCRouter(managementLifecycleProcedures).createCaller(
      createIdorContext(db as never)
    );
    return { db, caller };
  }

  it("moves the slug, the identity name and the redirect with the name", async () => {
    const { db, caller } = setup();
    await caller.update({ id: CALLER_COUNTRY, name: "New Testland" });
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: CALLER_COUNTRY },
      data: expect.objectContaining({ name: "New Testland", slug: "new-testland" }),
    });
    expect(db.nationalIdentity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { countryName: "New Testland" } })
    );
    expect(db.countrySlugRedirect.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { oldSlug: "testland", countryId: CALLER_COUNTRY } })
    );
  });

  it("refuses a name another nation has, with the reason", async () => {
    const { db, caller } = setup();
    db.country.findFirst.mockResolvedValue({ id: "someone_else" });
    await expect(caller.update({ id: CALLER_COUNTRY, name: "Taken" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Another nation in this realm has this name.",
    });
    expect(db.country.update).not.toHaveBeenCalled();
  });

  it("leaves the slug alone when the name does not change", async () => {
    const { db, caller } = setup();
    await caller.update({ id: CALLER_COUNTRY, name: "Testland", leader: "Queen" });
    expect(db.country.update.mock.calls[0]![0].data).not.toHaveProperty("slug");
    expect(db.countrySlugRedirect.upsert).not.toHaveBeenCalled();
  });
});
