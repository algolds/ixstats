import { adminAssignNation } from "~/server/modules/realms";
import { adminUsersRouter } from "~/server/api/routers/admin/users";
import { usersProfileRouter } from "~/server/api/routers/users/profile";
import { usersCountryLinkingRouter } from "~/server/api/routers/users/country-linking";
import { globalCache } from "~/lib/cache";
import { createIdorContext } from "~/tests/helpers/country-idor-context";
import { createMockRouterContext } from "~/tests/helpers/router-context";

jest.mock("~/lib/auth", () => ({ isSystemOwner: (id: string) => id === "sys_owner" }));
jest.mock("~/server/modules/realms", () => {
  const actual = jest.requireActual("~/server/modules/realms");
  return { ...actual, assignNation: jest.fn(actual.assignNation) };
});
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"), // the tRPC context needs the real Cache class
  globalCache: {
    delete: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

function db(user: any, country: any) {
  const d: any = {
    $transaction: jest.fn((cb: any) => cb(d)),
    user: {
      upsert: jest.fn().mockResolvedValue(user),
      findUnique: jest.fn().mockResolvedValue({ membershipTier: "basic" }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    country: {
      findUnique: jest.fn().mockResolvedValue(country),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return d;
}

describe("adminAssignNation", () => {
  const country = { id: "c2", realmId: "default", ownerUserId: "u_old", realm: { settings: null } };

  it("regular user: the previous owner loses c2 and the user keeps their other nation in the same realm", async () => {
    // u1 owns and acts as c1 in IxWorld; the realm allows 2 and u1 is premium, so c2 fits.
    const d = db(
      { id: "u1", clerkUserId: "clerk_u1", countryId: "c1" },
      { ...country, ownerUserId: null, realm: { settings: { maxNationsPerUser: 2 } } }
    );
    d.user.findUnique.mockResolvedValue({ membershipTier: "mycountry_premium" });
    d.country.count.mockResolvedValue(1);
    await adminAssignNation(d, { clerkUserId: "clerk_u1", countryId: "c2" });
    expect(d.country.update).toHaveBeenCalledTimes(1);
    expect(d.country.update).toHaveBeenCalledWith({
      where: { id: "c2" },
      data: { ownerUserId: null },
    });
    expect(d.country.findMany).not.toHaveBeenCalled();
    expect(d.country.update).not.toHaveBeenCalledWith({ where: { id: "c1" }, data: { ownerUserId: null } });
    expect(d.user.updateMany).not.toHaveBeenCalledWith({ where: { countryId: "c1" }, data: { countryId: null } });
    expect(d.country.updateMany).toHaveBeenCalledWith({
      where: { id: "c2", ownerUserId: null },
      data: { ownerUserId: "u1" },
    });
    // The active pointer follows assignNation's rule: u1 keeps acting as c1.
    expect(d.user.updateMany).toHaveBeenCalledWith({
      where: { id: "u1", countryId: null },
      data: { countryId: "c2" },
    });
  });

  it("a user at their cap in c2's realm is CAP_REACHED; nothing they own is released", async () => {
    const d = db(
      { id: "u1", clerkUserId: "clerk_u1", countryId: "c1" },
      { ...country, ownerUserId: null }
    );
    d.country.count.mockResolvedValue(1); // free tier, realm cap 1: already full
    await expect(adminAssignNation(d, { clerkUserId: "clerk_u1", countryId: "c2" })).rejects.toMatchObject({
      code: "CAP_REACHED",
    });
    expect(d.country.update).not.toHaveBeenCalledWith({ where: { id: "c1" }, data: { ownerUserId: null } });
    expect(d.country.updateMany).not.toHaveBeenCalled();
  });

  it("cross-realm (ruling F-1): the user's nation in ANOTHER realm stays owned", async () => {
    // u1 owns and acts as e1 in Eurth; the admin gives them IxWorld's c2.
    const d = db(
      { id: "u1", clerkUserId: "clerk_u1", countryId: "e1" },
      { ...country, ownerUserId: null }
    );
    await adminAssignNation(d, { clerkUserId: "clerk_u1", countryId: "c2" });
    expect(d.country.count).toHaveBeenCalledWith({ where: { ownerUserId: "u1", realmId: "default" } });
    expect(d.country.update).toHaveBeenCalledTimes(1);
    expect(d.country.update).not.toHaveBeenCalledWith({ where: { id: "e1" }, data: { ownerUserId: null } });
    expect(d.user.updateMany).not.toHaveBeenCalledWith({ where: { countryId: "e1" }, data: { countryId: null } });
    expect(d.country.updateMany).toHaveBeenCalledWith({
      where: { id: "c2", ownerUserId: null },
      data: { ownerUserId: "u1" },
    });
    // The active pointer follows assignNation's rule: only set while the user acts as no nation.
    expect(d.user.updateMany).toHaveBeenCalledWith({
      where: { id: "u1", countryId: null },
      data: { countryId: "c2" },
    });
    expect(d.user.update).not.toHaveBeenCalled();
  });

  it("a country that does not exist is COUNTRY_NOT_FOUND before anything is released", async () => {
    const d = db({ id: "u1", clerkUserId: "clerk_u1", countryId: null }, null);
    await expect(adminAssignNation(d, { clerkUserId: "clerk_u1", countryId: "gone" })).rejects.toMatchObject({
      code: "COUNTRY_NOT_FOUND",
    });
    expect(d.country.update).not.toHaveBeenCalled();
    expect(d.user.updateMany).not.toHaveBeenCalled();
  });

  it("system owner: only the active pointer moves, ownership untouched", async () => {
    const d = db({ id: "u9", clerkUserId: "sys_owner", countryId: null }, country);
    await adminAssignNation(d, { clerkUserId: "sys_owner", countryId: "c2" });
    expect(d.country.update).not.toHaveBeenCalled();
    expect(d.country.updateMany).not.toHaveBeenCalled();
    expect(d.user.update).toHaveBeenCalledWith({ where: { id: "u9" }, data: { countryId: "c2" } });
  });

  it("re-assigning the user's current nation releases it once, then gives it back", async () => {
    const d = db(
      { id: "u1", clerkUserId: "clerk_u1", countryId: "c2" },
      { ...country, ownerUserId: null }
    );
    await adminAssignNation(d, { clerkUserId: "clerk_u1", countryId: "c2" });
    expect(d.country.update).toHaveBeenCalledTimes(1);
    expect(d.country.update).toHaveBeenCalledWith({ where: { id: "c2" }, data: { ownerUserId: null } });
    expect(d.user.updateMany).toHaveBeenCalledWith({ where: { id: "u1", countryId: null }, data: { countryId: "c2" } });
    expect(d.country.updateMany).toHaveBeenCalledWith({
      where: { id: "c2", ownerUserId: null },
      data: { ownerUserId: "u1" },
    });
  });
});

function adminCaller(extraDb: Record<string, object>) {
  const ctx = createIdorContext(extraDb, "admin");
  (ctx.db as any).$transaction = jest.fn((cb: any) => cb(ctx.db));
  return { caller: adminUsersRouter.createCaller(ctx), db: ctx.db as any };
}

describe("admin.assignUserToCountry", () => {
  it("surfaces an ownership refusal as CONFLICT", async () => {
    const { caller } = adminCaller({
      user: {
        upsert: jest.fn().mockResolvedValue({ id: "u1", countryId: null }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      country: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
    });
    await expect(
      caller.assignUserToCountry({ userId: "clerk_u1", countryId: "gone" })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Country not found",
    });
  });
});

describe("admin.unassignUserFromCountry", () => {
  function setup(user: object | null, ownerUserId: string | null) {
    return adminCaller({
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      country: {
        findUnique: jest.fn().mockResolvedValue({ ownerUserId }),
        update: jest.fn().mockResolvedValue({}),
      },
    });
  }

  it("the owner loses the nation (released for everyone)", async () => {
    const { caller, db: d } = setup({ id: "u1", countryId: "c1" }, "u1");
    await caller.unassignUserFromCountry({ userId: "clerk_u1", countryId: "c1" });
    expect(d.country.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { ownerUserId: null },
    });
    expect(d.user.updateMany).toHaveBeenCalledWith({
      where: { countryId: "c1" },
      data: { countryId: null },
    });
  });

  it("a non-owner acting as the nation (system owner) only stops pointing at it", async () => {
    const { caller, db: d } = setup({ id: "u9", countryId: "c1" }, "u1");
    await caller.unassignUserFromCountry({ userId: "sys_owner", countryId: "c1" });
    expect(d.country.update).not.toHaveBeenCalled();
    expect(d.user.update).toHaveBeenCalledWith({ where: { id: "u9" }, data: { countryId: null } });
  });

  it("releases an owned nation the user is not currently acting as (a player may own several)", async () => {
    const { caller, db: d } = setup({ id: "u1", countryId: "other" }, "u1");
    await caller.unassignUserFromCountry({ userId: "clerk_u1", countryId: "c1" });
    expect(d.country.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { ownerUserId: null } });
    expect(d.user.update).not.toHaveBeenCalled();
  });

  it("does nothing when the user neither owns nor acts as that nation", async () => {
    const { caller, db: d } = setup({ id: "u1", countryId: "other" }, "u2");
    await caller.unassignUserFromCountry({ userId: "clerk_u1", countryId: "c1" });
    expect(d.country.update).not.toHaveBeenCalled();
    expect(d.user.update).not.toHaveBeenCalled();
    expect(d.user.updateMany).not.toHaveBeenCalled();
  });
});

describe("users.getProfile ThinkPages fallback never grants ownership", () => {
  const { assignNation } = jest.requireMock("~/server/modules/realms");

  function profileCaller(ownerUserId: string | null) {
    const country = { id: "c1", name: "Linkedland" };
    const d: any = {
      $transaction: jest.fn((cb: any) => cb(d)),
      user: {
        findUnique: jest.fn(({ where }: any) =>
          Promise.resolve(
            where.id
              ? { id: "u1", clerkUserId: "clerk_u1", countryId: "c1", country, role: null }
              : { id: "u1", clerkUserId: "clerk_u1", countryId: null, country: null, role: null }
          )
        ),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn(),
      },
      thinkpagesAccount: { findFirst: jest.fn().mockResolvedValue({ countryId: "c1" }) },
      country: {
        findUnique: jest.fn().mockResolvedValue({ ownerUserId }),
        count: jest.fn(),
        update: jest.fn(),
      },
    };
    const ctx = createMockRouterContext({ auth: { userId: "clerk_u1" }, db: d });
    return { caller: usersProfileRouter.createCaller(ctx as any), d };
  }

  beforeEach(() => assignNation.mockClear());

  it("an account for an UNOWNED nation does not make the user its owner", async () => {
    const { caller, d } = profileCaller(null);
    const profile = await caller.getProfile();
    expect(profile.countryId).toBeNull();
    expect(assignNation).not.toHaveBeenCalled();
    expect(d.country.update).not.toHaveBeenCalled();
    expect(d.user.update).not.toHaveBeenCalled();
  });

  it("an account for a nation the user already owns re-points the active nation", async () => {
    const { caller, d } = profileCaller("u1");
    const profile = await caller.getProfile();
    expect(d.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { countryId: "c1" } });
    expect(d.country.update).not.toHaveBeenCalled();
    expect(assignNation).not.toHaveBeenCalled();
    expect(profile.countryId).toBe("c1");
  });

  it("a nation owned by someone else is skipped without an error log", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { caller, d } = profileCaller("u2");
      const profile = await caller.getProfile();
      expect(profile.countryId).toBeNull();
      expect(d.user.update).not.toHaveBeenCalled();
      expect(d.country.update).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});

describe("users.setActiveNation (ruling F-1)", () => {
  function caller(ownerUserId: string | null) {
    const d: any = {
      $transaction: jest.fn((cb: any) => cb(d)),
      user: { update: jest.fn().mockResolvedValue({}), updateMany: jest.fn() },
      country: { findUnique: jest.fn().mockResolvedValue({ ownerUserId }) },
    };
    const ctx = createMockRouterContext({
      auth: { userId: "clerk_u1" },
      user: { id: "u1", clerkUserId: "clerk_u1", countryId: "c1" },
      db: d,
    });
    return { caller: usersCountryLinkingRouter.createCaller(ctx as any), d };
  }

  beforeEach(() => jest.mocked(globalCache.delete).mockClear());

  it("the owner switches to another nation they own; their profile cache is dropped", async () => {
    const { caller: c, d } = caller("u1");
    await expect(c.setActiveNation({ countryId: "e1" })).resolves.toEqual({ success: true });
    expect(d.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { countryId: "e1" } });
    expect(globalCache.delete).toHaveBeenCalledWith("user_profile:clerk_u1");
  });

  it("a nation the caller does not own is FORBIDDEN and nothing moves", async () => {
    for (const owner of ["u2", null]) {
      const { caller: c, d } = caller(owner);
      await expect(c.setActiveNation({ countryId: "e1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(d.user.update).not.toHaveBeenCalled();
    }
    expect(globalCache.delete).not.toHaveBeenCalled();
  });
});
