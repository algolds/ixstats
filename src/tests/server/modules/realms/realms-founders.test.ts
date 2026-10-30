/** @jest-environment node */
/**
 * Founding members (beta feedback H1): staff-set credits in the realm header. Only site staff set them, the order
 * is kept, and they carry no powers.
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));

import { realmsRouter } from "~/server/api/routers/realms";
import { realmPowers } from "~/server/modules/realms";
import { listFounders, setFounders } from "~/server/modules/realms/realms.founders";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { MAX_FOUNDERS } from "~/lib/realms/realm-region";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

type Db = ReturnType<typeof createMockPrisma>;
interface FounderRow {
  realmId: string;
  userId: string;
  order: number;
  addedBy: string;
}

const STAFF = { id: "u_staff", clerkUserId: "clerk_staff", role: { name: "admin", level: 10 } };
const PLAYER = { id: "u_player", clerkUserId: "clerk_player", role: null };
const KNOWN = ["clerk_a", "clerk_b", "clerk_c"];

/** A mock Prisma whose founders table is a real list, so writes can be read back. */
function foundersDb(rows: FounderRow[] = []) {
  const db: Db = createMockPrisma();
  db.$transaction.mockImplementation((cb: (tx: Db) => unknown) => cb(db));
  db.realm.findUnique.mockResolvedValue({ id: "eurth" });
  db.user.count.mockImplementation(
    async ({ where }: { where: { clerkUserId: { in: string[] } } }) =>
      where.clerkUserId.in.filter((id) => KNOWN.includes(id)).length
  );
  db.realmFounder.deleteMany.mockImplementation(
    async ({ where }: { where: { realmId: string; userId: { notIn: string[] } } }) => {
      const keep = rows.filter(
        (r) => r.realmId !== where.realmId || where.userId.notIn.includes(r.userId)
      );
      rows.splice(0, rows.length, ...keep);
    }
  );
  db.realmFounder.upsert.mockImplementation(
    async ({ create, update }: { create: FounderRow; update: { order: number } }) => {
      const existing = rows.find((r) => r.realmId === create.realmId && r.userId === create.userId);
      if (existing) Object.assign(existing, update);
      else rows.push({ ...create });
    }
  );
  db.realmFounder.findMany.mockImplementation(async () =>
    [...rows].sort((a, b) => a.order - b.order).map(({ userId }) => ({ userId }))
  );
  return { db, rows };
}

describe("setFounders", () => {
  it("refuses anyone who is not site staff and writes nothing", async () => {
    const { db, rows } = foundersDb();
    await expect(setFounders(db as never, "eurth", ["clerk_a"], PLAYER)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(rows).toEqual([]);
    expect(db.realmFounder.upsert).not.toHaveBeenCalled();
  });

  it("stores the order 0..n-1, and a shorter list removes the rest", async () => {
    const { db, rows } = foundersDb();
    await setFounders(db as never, "eurth", ["clerk_c", "clerk_a", "clerk_b"], STAFF);
    expect(rows.map((r) => [r.userId, r.order, r.addedBy])).toEqual([
      ["clerk_c", 0, "clerk_staff"],
      ["clerk_a", 1, "clerk_staff"],
      ["clerk_b", 2, "clerk_staff"],
    ]);

    await setFounders(db as never, "eurth", ["clerk_b", "clerk_c"], { ...STAFF, clerkUserId: "x" });
    expect(rows.map((r) => [r.userId, r.order, r.addedBy]).sort((a, b) => +a[1] - +b[1])).toEqual([
      ["clerk_b", 0, "clerk_staff"],
      ["clerk_c", 1, "clerk_staff"],
    ]);
    await setFounders(db as never, "eurth", [], STAFF);
    expect(rows).toEqual([]);
  });

  it("refuses a user id with no account, and changes nothing", async () => {
    const { db, rows } = foundersDb([
      { realmId: "eurth", userId: "clerk_a", order: 0, addedBy: "s" },
    ]);
    await expect(
      setFounders(db as never, "eurth", ["clerk_b", "clerk_ghost"], STAFF)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(rows.map((r) => r.userId)).toEqual(["clerk_a"]);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("lists a repeated id once, and refuses a list longer than the cap", async () => {
    const { db, rows } = foundersDb();
    await setFounders(db as never, "eurth", ["clerk_a", "clerk_b", "clerk_a"], STAFF);
    expect(rows.map((r) => r.userId)).toEqual(["clerk_a", "clerk_b"]);
    const many = Array.from({ length: MAX_FOUNDERS + 1 }, (_, i) => `clerk_${i}`);
    await expect(setFounders(db as never, "eurth", many, STAFF)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("refuses a realm that does not exist", async () => {
    const { db } = foundersDb();
    db.realm.findUnique.mockResolvedValue(null);
    await expect(setFounders(db as never, "nope", ["clerk_a"], STAFF)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("listFounders", () => {
  it("names and links each founder the way the founder line does, in order", async () => {
    const { db } = foundersDb([
      { realmId: "eurth", userId: "clerk_b", order: 1, addedBy: "s" },
      { realmId: "eurth", userId: "clerk_a", order: 0, addedBy: "s" },
      { realmId: "eurth", userId: "clerk_c", order: 2, addedBy: "s" },
    ]);
    // clerk_a has a passport and a nation, clerk_b only a nation (slug), clerk_c only a display name.
    db.country.findMany.mockResolvedValue([
      { id: "n1", name: "Aurelia", slug: "aurelia", flag: null, owner: { clerkUserId: "clerk_a" } },
      { id: "n2", name: "Borea", slug: "borea", flag: null, owner: { clerkUserId: "clerk_b" } },
    ]);
    db.user.findMany.mockImplementation(async (args: { select: Record<string, unknown> }) =>
      "forumUsername" in args.select
        ? [{ clerkUserId: "clerk_c", forumUsername: "Cass", handle: null, country: null }]
        : [
            { clerkUserId: "clerk_a", handle: "aurelian" },
            { clerkUserId: "clerk_b", handle: null },
            { clerkUserId: "clerk_c", handle: null },
          ]
    );

    expect(await listFounders(db as never, "eurth")).toEqual([
      { userId: "clerk_a", name: "Aurelia", link: "/@aurelian" },
      { userId: "clerk_b", name: "Borea", link: "/countries/borea" },
      { userId: "clerk_c", name: "Cass", link: null },
    ]);
  });
});

describe("through the realms router", () => {
  function callerAs(user: typeof STAFF | typeof PLAYER, db: Db) {
    return realmsRouter.createCaller(
      createMockRouterContext({
        db,
        auth: { userId: user.clerkUserId },
        user,
        rateLimitIdentifier: `${user.clerkUserId}_${Math.random()}`,
      }) as never
    );
  }

  it("lets site staff set founders", async () => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    const { db, rows } = foundersDb();
    await callerAs(STAFF, db).region.setFounders({ realmId: "eurth", userIds: ["clerk_a"] });
    expect(rows.map((r) => r.userId)).toEqual(["clerk_a"]);
  });

  it("hands the page the founders without their account ids", async () => {
    const { db } = foundersDb([{ realmId: "eurth", userId: "clerk_a", order: 0, addedBy: "s" }]);
    db.realm.findUnique.mockResolvedValue({
      id: DEFAULT_REALM_ID,
      slug: "eurth",
      name: "Eurth",
      ownerId: "system",
      status: "active",
      officers: [],
      createdAt: new Date("2026-01-01"),
    });
    db.country.aggregate.mockResolvedValue({ _count: { _all: 0 }, _sum: { currentPopulation: 0 } });
    db.country.count.mockResolvedValue(0);
    db.country.findMany.mockResolvedValue([
      { id: "n1", name: "Aurelia", slug: "aurelia", flag: null, owner: { clerkUserId: "clerk_a" } },
    ]);
    db.user.findMany.mockResolvedValue([{ clerkUserId: "clerk_a", handle: null }]);

    const overview = await callerAs(PLAYER, db).region.overview({ slug: "eurth" });
    expect(overview?.founders).toEqual([{ name: "Aurelia", link: "/countries/aurelia" }]);
  });
});

describe("founding members carry no powers", () => {
  it("gives a listed founder nothing in the realm unless they are also its founder or an officer", () => {
    const actor = { id: "u", clerkUserId: "clerk_a", role: null };
    expect(realmPowers(actor, { ownerId: "clerk_owner" }, [])).toEqual([]);
  });
});
