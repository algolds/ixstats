/** @jest-environment node */
/** Realm clock actions: founder and staff only, continuous switch-on, the speed cooldown, Ixnay and archive rules. */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/ixtime", () => ({
  IxTime: { getCurrentIxTime: () => Date.UTC(2041, 5, 2, 9, 30) },
}));

import { realmsRouter } from "~/server/api/routers/realms";
import { realmClock } from "~/server/modules/realms/realms.settings";
import { SPEED_CHANGE_COOLDOWN_MS } from "~/lib/realms/realm-clock";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

type Db = ReturnType<typeof createMockPrisma>;
const FOUNDER = "clerk_founder";
const OFFICER = "clerk_officer";
const ADMIN = "clerk_admin";

function makeDb(overrides: Record<string, unknown> = {}): { db: Db; row: Record<string, unknown> } {
  const row: Record<string, unknown> = {
    id: "eurth",
    slug: "eurth",
    name: "Eurth",
    ownerId: FOUNDER,
    status: "active",
    officers: [{ userId: OFFICER, powers: ["appearance"] }],
    settings: { inWorldDate: { mode: "offset", offset: -823, era: "AE" } },
    ...overrides,
  };
  const db = createMockPrisma();
  db.realm.findUnique.mockImplementation(
    async ({ where }: { where: { slug?: string; id?: string } }) =>
      where.slug === row.slug || where.id === row.id ? row : null
  );
  // Writes land on the row, so a second call sees the first one's clock.
  db.realm.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
    Object.assign(row, data)
  );
  return { db, row };
}

function caller(clerkUserId: string, db: Db) {
  const role = clerkUserId === ADMIN ? { name: "admin", level: 10 } : null;
  return realmsRouter.createCaller(
    createMockRouterContext({
      db,
      auth: { userId: clerkUserId },
      user: { id: `db_${clerkUserId}`, clerkUserId, role, countryId: null },
      rateLimitIdentifier: `${clerkUserId}_${Math.random()}`,
    }) as never
  ).region;
}

const START = { slug: "eurth", startDate: "1203-03-14", era: "AE", multiplier: 3 };

describe("realm clock actions", () => {
  it("lets the founder switch the clock on, continuous with global IxTime, dropping the old label", async () => {
    const { db, row } = makeDb();
    await caller(FOUNDER, db).startClock(START);
    const clock = realmClock(row.settings as never);
    expect(clock).toMatchObject({
      anchorClockMs: Date.UTC(2041, 5, 2, 9, 30),
      multiplier: 3,
      era: "AE",
    });
    expect((row.settings as Record<string, unknown>).inWorldDate).toBeUndefined();
  });

  it("refuses a second switch-on, officers, Ixnay and archived realms", async () => {
    const { db } = makeDb();
    await caller(FOUNDER, db).startClock(START);
    await expect(caller(FOUNDER, db).startClock(START)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller(OFFICER, makeDb().db).startClock(START)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller(ADMIN, makeDb({ id: "default", slug: "ixnay" }).db).startClock({
        ...START,
        slug: "ixnay",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller(FOUNDER, makeDb({ status: "archived" }).db).startClock(START)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("holds the founder to one speed change a week, never staff, and never for an era edit", async () => {
    const { db, row } = makeDb();
    const t0 = Date.now();
    jest.useFakeTimers({ now: t0 });
    await caller(FOUNDER, db).startClock(START);
    await caller(FOUNDER, db).updateClock({ slug: "eurth", era: "New Era" });
    jest.setSystemTime(t0 + SPEED_CHANGE_COOLDOWN_MS - 1);
    await expect(
      caller(FOUNDER, db).updateClock({ slug: "eurth", multiplier: 6 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await caller(ADMIN, db).updateClock({ slug: "eurth", multiplier: 0 });
    expect(realmClock(row.settings as never)).toMatchObject({ multiplier: 0, era: "New Era" });
    jest.setSystemTime(t0 + 2 * SPEED_CHANGE_COOLDOWN_MS);
    await caller(FOUNDER, db).updateClock({ slug: "eurth", multiplier: 6 });
    expect(realmClock(row.settings as never)?.multiplier).toBe(6);
    jest.useRealTimers();
  });

  it("refuses speeds outside 0 to 12 and impossible start dates", async () => {
    const { db } = makeDb();
    await expect(
      caller(FOUNDER, db).startClock({ ...START, multiplier: 13 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      caller(FOUNDER, db).startClock({ ...START, startDate: "2026-02-30" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("answers the context clock: the realm's, a country's realm, null for Ixnay", async () => {
    const { db } = makeDb();
    await caller(FOUNDER, db).startClock(START);
    db.country.findUnique.mockResolvedValue({ realmId: "eurth" });
    const anyone = realmsRouter.createCaller(
      createMockRouterContext({ db, auth: null, user: null }) as never
    ).region;
    expect((await anyone.contextClock({ realm: "eurth" })).clock?.multiplier).toBe(3);
    expect((await anyone.contextClock({ country: "aurelia" })).clock?.multiplier).toBe(3);
    expect((await anyone.contextClock({ realm: "ixnay" })).clock).toBeNull();
    expect((await anyone.contextClock({ active: true })).clock).toBeNull();
  });
});
