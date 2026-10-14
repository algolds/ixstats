/**
 * The daily realm-inactivity job (ToS §2.8): warn, wait, release with the material held, un-warn, skip Ixnay, and
 * purge due holds (§2.7).
 */
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/server/modules/realms/realms.flags", () => ({ deleteLocalFlagImages: jest.fn() }));

import { runRealmInactivity } from "~/server/modules/realms/realms.inactivity";
import { inactivityNoticeContent } from "~/server/modules/realms/realms.notices";

const DAY = 86_400_000;
const now = new Date("2026-10-11T00:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);

function nation(id: string, lastSeen: number, notice: number | null) {
  return {
    id,
    name: id,
    inactivityNoticeAt: notice === null ? null : daysAgo(notice),
    owner: { id: `u-${id}`, clerkUserId: `clerk-${id}`, lastSeenAt: daysAgo(lastSeen) },
  };
}

function setup() {
  const nations = [
    nation("active", 10, null),
    nation("quiet", 100, null),
    nation("warned", 100, 5),
    nation("gone", 120, 15),
    nation("back", 1, 3),
  ];
  const db: any = {
    $transaction: jest.fn((cb: any) => cb(db)),
    realm: {
      findMany: jest.fn().mockResolvedValue([
        { id: "eurth", name: "Eurth", slug: "eurth", settings: null },
        { id: "default", name: "Ixnay", slug: "ixnay", settings: null },
      ]),
    },
    country: {
      findMany: jest.fn().mockResolvedValue(nations),
      findUnique: jest.fn().mockResolvedValue({
        ownerUserId: "u-gone",
        flag: "/flags/eurth--gone.png",
        coatOfArms: null,
      }),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    realmOfficer: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    nationMaterialHold: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest
        .fn()
        .mockResolvedValue([{ countryId: "old", flag: "/flags/eurth--old.png", coatOfArms: null }]),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const deps = {
    now: () => now,
    notify: jest.fn().mockResolvedValue(undefined),
    deleteImages: jest.fn().mockResolvedValue(1),
  };
  return { db, deps };
}

describe("runRealmInactivity", () => {
  it("warns, releases after the notice, un-warns a returning owner and purges due holds", async () => {
    const { db, deps } = setup();
    await expect(runRealmInactivity(db, deps)).resolves.toEqual({
      warned: 1,
      released: 1,
      reset: 1,
      purged: 1,
      files: 1,
    });
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: "quiet" },
      data: { inactivityNoticeAt: now },
    });
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: "back" },
      data: { inactivityNoticeAt: null },
    });
    expect(db.nationMaterialHold.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          countryId: "gone",
          formerOwnerUserId: "u-gone",
          reason: "inactive",
          flag: "/flags/eurth--gone.png",
        }),
      })
    );
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: "gone" },
      data: { ownerUserId: null, ownedSince: null },
    });
    expect(deps.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "warning",
        clerkUserId: "clerk-quiet",
        date: new Date("2026-10-25T00:00:00Z"),
      })
    );
    expect(deps.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "released",
        clerkUserId: "clerk-gone",
        date: new Date("2027-04-09T00:00:00Z"),
      })
    );
    expect(deps.notify).toHaveBeenCalledTimes(2);
    expect(deps.deleteImages).toHaveBeenCalledWith(["/flags/eurth--old.png", null]);
  });

  it("leaves Ixnay alone unless it opts in", async () => {
    const { db, deps } = setup();
    await runRealmInactivity(db, deps);
    expect(db.country.findMany).toHaveBeenCalledTimes(1);
    expect(db.country.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { realmId: "eurth", ownerUserId: { not: null } } })
    );
  });

  it("does not release a nation that changed hands since the read", async () => {
    const { db, deps } = setup();
    db.country.findUnique.mockResolvedValue({ ownerUserId: "someone-else" });
    const result = await runRealmInactivity(db, deps);
    expect(result.released).toBe(0);
    expect(db.nationMaterialHold.upsert).not.toHaveBeenCalled();
  });

  it("keeps going when a notice fails to send", async () => {
    const { db, deps } = setup();
    deps.notify.mockRejectedValue(new Error("email down"));
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(runRealmInactivity(db, deps)).resolves.toMatchObject({ warned: 1, released: 1 });
  });
});

describe("inactivity notices", () => {
  const base = {
    clerkUserId: "clerk-1",
    nationName: "Aurelia",
    realmName: "Eurth",
    realmSlug: "eurth",
    days: 90,
    exclusiveWindow: false,
  };

  it("warns with the release date and the reclaim window", () => {
    const content = inactivityNoticeContent({
      ...base,
      kind: "warning",
      date: new Date("2026-10-25T00:00:00Z"),
    });
    expect(content.title).toBe("Aurelia will be released soon");
    expect(content.message).toContain("Sign in before October 25, 2026 to keep Aurelia in Eurth");
    expect(content.message).toContain("for 180 days");
    expect(content.href).toBe("/r/eurth");
  });

  it("says another player may claim a released nation first unless the realm keeps it", () => {
    const released = { ...base, kind: "released" as const, date: new Date("2027-04-09T00:00:00Z") };
    expect(inactivityNoticeContent(released).message).toContain(
      "before April 9, 2027 to get them back, unless another player claims it first."
    );
    expect(inactivityNoticeContent({ ...released, exclusiveWindow: true }).message).toMatch(
      /to get them back\.$/
    );
  });
});
