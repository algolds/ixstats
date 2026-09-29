import {
  assignNation,
  canModerateRealm,
  NationOwnershipError,
  pointActiveNation,
  realmSettings,
  releaseNation,
  withMaxNationsPerUser,
} from "~/server/modules/realms";

jest.mock("~/lib/auth", () => ({ isSystemOwner: (id: string) => id === "sys_owner" }));

function tx(country: any, ownedInRealm = 0) {
  return {
    country: {
      findUnique: jest.fn().mockResolvedValue(country),
      count: jest.fn().mockResolvedValue(ownedInRealm),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: { update: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  } as any;
}

const unowned = { id: "c1", realmId: "default", ownerUserId: null, realm: { settings: null } };

describe("realmSettings", () => {
  it("defaults to one nation per user and ignores junk", () => {
    expect(realmSettings(null)).toEqual({ maxNationsPerUser: 1 });
    expect(realmSettings({ maxNationsPerUser: "x" })).toEqual({ maxNationsPerUser: 1 });
    expect(realmSettings({ maxNationsPerUser: 3, other: true })).toEqual({ maxNationsPerUser: 3 });
  });

  it("withMaxNationsPerUser sets the cap and keeps other keys; non-objects start empty", () => {
    expect(withMaxNationsPerUser({ maxNationsPerUser: 1, other: true }, 4)).toEqual({
      maxNationsPerUser: 4,
      other: true,
    });
    expect(withMaxNationsPerUser(["junk"], 2)).toEqual({ maxNationsPerUser: 2 });
    expect(withMaxNationsPerUser("junk", 2)).toEqual({ maxNationsPerUser: 2 });
  });
});

describe("assignNation", () => {
  it("sets owner and active pointer (invariant I1)", async () => {
    const t = tx(unowned);
    await assignNation(t, { userId: "u1", countryId: "c1" });
    expect(t.country.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", ownerUserId: null },
      data: { ownerUserId: "u1" },
    });
    expect(t.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { countryId: "c1" } });
  });

  it("loses a concurrent race: the guarded ownership write matches nothing → ALREADY_OWNED, no pointer move", async () => {
    const t = tx(unowned);
    t.country.updateMany.mockResolvedValue({ count: 0 });
    await expect(assignNation(t, { userId: "u1", countryId: "c1" })).rejects.toMatchObject({ code: "ALREADY_OWNED" });
    expect(t.user.update).not.toHaveBeenCalled();
  });

  it("refuses a country owned by someone else", async () => {
    await expect(assignNation(tx({ ...unowned, ownerUserId: "u2" }), { userId: "u1", countryId: "c1" })).rejects.toMatchObject({
      code: "ALREADY_OWNED",
    });
  });

  it("enforces the per-realm cap (invariant I2)", async () => {
    const t = tx(unowned, 1);
    await expect(assignNation(t, { userId: "u1", countryId: "c1" })).rejects.toBeInstanceOf(NationOwnershipError);
    expect(t.country.updateMany).not.toHaveBeenCalled();
  });

  it("re-activating an owned country skips the cap and ownership write", async () => {
    const t = tx({ ...unowned, ownerUserId: "u1" }, 1);
    await assignNation(t, { userId: "u1", countryId: "c1" });
    expect(t.country.updateMany).not.toHaveBeenCalled();
    expect(t.user.update).toHaveBeenCalled();
  });
});

describe("releaseNation / pointActiveNation", () => {
  it("clears owner and every active pointer at the country", async () => {
    const t = tx(unowned);
    await releaseNation(t, "c1");
    expect(t.country.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { ownerUserId: null } });
    expect(t.user.updateMany).toHaveBeenCalledWith({ where: { countryId: "c1" }, data: { countryId: null } });
  });

  it("moves only the pointer (system-owner override)", async () => {
    const t = tx(unowned);
    await pointActiveNation(t, "u9", "c1");
    expect(t.user.update).toHaveBeenCalledWith({ where: { id: "u9" }, data: { countryId: "c1" } });
    expect(t.country.update).not.toHaveBeenCalled();
    expect(t.country.updateMany).not.toHaveBeenCalled();
  });
});

describe("canModerateRealm", () => {
  const realm = { ownerId: "clerk_founder" };
  it("allows the founder, site admins and system owners only", () => {
    expect(canModerateRealm({ id: "u1", clerkUserId: "clerk_founder" }, realm)).toBe(true);
    expect(canModerateRealm({ id: "u2", clerkUserId: "x", role: { name: "admin", level: 10 } }, realm)).toBe(true);
    expect(canModerateRealm({ id: "u3", clerkUserId: "sys_owner" }, realm)).toBe(true);
    expect(canModerateRealm({ id: "u4", clerkUserId: "x", role: { name: "member", level: 100 } }, realm)).toBe(false);
  });
});
