/** @jest-environment node */
/**
 * The realm time API (realm time design §1): `clockForRealm`, `clockForCountry` and `realmClocks`. Ixnay reads the
 * bot-synced IxTime; every other realm its stored clock; a realm missing its clock is logged and reads Ixnay's.
 * Stored clocks are cached briefly, and a write in this process drops the entry.
 */
import { IxTime } from "~/lib/ixtime";
import { resetSharedClockCache } from "~/lib/ixtime/shared-clock";
import { createRealmClock, formatRealmDate, withSpeed } from "~/lib/realms/realm-clock";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import {
  clockForCountry,
  clockForRealm,
  invalidateRealmClock,
  pickClock,
  realmClocks,
  resetRealmClockCache,
} from "~/server/shared/realm-time";

const IXNAY_NOW = Date.UTC(2041, 5, 2, 9, 30);
const REAL = Date.now();
const eurthClock = withSpeed(
  createRealmClock({
    globalNowMs: IXNAY_NOW,
    realNowMs: REAL,
    startDate: "1203-03-14",
    era: "AE",
    multiplier: 2,
  }),
  0,
  REAL
);

type Row = { id: string; settings: unknown; isSystem?: boolean };

function fakeDb(rows: Row[], countries: Record<string, string> = {}) {
  return {
    realm: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const row = rows.find((r) => r.id === where.id);
        return row ? { settings: row.settings } : null;
      }),
      findMany: jest.fn(async () => rows.filter((r) => !r.isSystem)),
    },
    country: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        countries[where.id] ? { realmId: countries[where.id] } : null
      ),
    },
    systemConfig: { findUnique: jest.fn(async () => null) },
  };
}

const ROWS: Row[] = [
  { id: DEFAULT_REALM_ID, settings: {} },
  { id: "eurth", settings: { clock: eurthClock } },
  { id: "lost", settings: { inWorldDate: { mode: "offset", offset: 0 } } },
  { id: "nationstates", settings: {}, isSystem: true },
];

let errors: jest.SpyInstance;
beforeEach(() => {
  // Ixnay paused at IXNAY_NOW, as the bot would leave it.
  IxTime.loadClockState({
    timeOverride: IXNAY_NOW,
    timeOverrideSetAt: REAL,
    multiplierOverride: 0,
  });
  resetSharedClockCache();
  resetRealmClockCache();
  errors = jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => errors.mockRestore());
afterAll(() =>
  IxTime.loadClockState({ timeOverride: null, timeOverrideSetAt: null, multiplierOverride: null })
);

describe("clockForRealm", () => {
  it("reads Ixnay's clock from IxTime, Gregorian with no era", async () => {
    const ixnay = await clockForRealm(fakeDb(ROWS) as never, DEFAULT_REALM_ID);
    expect(ixnay.now()).toBe(IXNAY_NOW);
    expect(ixnay).toMatchObject({ realmId: DEFAULT_REALM_ID, paused: true, clock: null });
    expect(formatRealmDate(ixnay.now(), ixnay.calendar)).toBe("2 June 2041");
  });

  it("reads another realm's stored clock and calendar", async () => {
    const eurth = await clockForRealm(fakeDb(ROWS) as never, "eurth");
    expect(eurth.now()).toBe(IXNAY_NOW);
    expect(eurth).toMatchObject({ realmId: "eurth", multiplier: 0, fallback: false });
    expect(formatRealmDate(eurth.now(), eurth.calendar)).toBe("14 March 1203 AE");
  });

  it("logs a realm missing its clock and reads Ixnay's instead of failing", async () => {
    const lost = await clockForRealm(fakeDb(ROWS) as never, "lost");
    expect(lost).toMatchObject({ realmId: "lost", clock: null, fallback: true });
    expect(lost.now()).toBe(IXNAY_NOW);
    expect(errors).toHaveBeenCalledWith(expect.stringContaining("lost has no clock"));
  });

  it("caches a stored clock until this process writes it", async () => {
    const db = fakeDb(ROWS);
    await clockForRealm(db as never, "eurth");
    await clockForRealm(db as never, "eurth");
    expect(db.realm.findUnique).toHaveBeenCalledTimes(1);
    invalidateRealmClock("eurth");
    await clockForRealm(db as never, "eurth");
    expect(db.realm.findUnique).toHaveBeenCalledTimes(2);
  });
});

describe("clockForCountry", () => {
  it("reads the country's realm, from its row or its id", async () => {
    const db = fakeDb(ROWS, { c1: "eurth" });
    expect((await clockForCountry(db as never, { realmId: "eurth" })).realmId).toBe("eurth");
    expect((await clockForCountry(db as never, "c1")).realmId).toBe("eurth");
    expect((await clockForCountry(db as never, "unknown")).realmId).toBe(DEFAULT_REALM_ID);
  });
});

describe("realmClocks", () => {
  it("reads every realm once, Ixnay from IxTime, system realms left out", async () => {
    const db = fakeDb(ROWS);
    const clocks = await realmClocks(db as never);
    expect([...clocks.keys()].sort()).toEqual([DEFAULT_REALM_ID, "eurth", "lost"]);
    expect(clocks.get("eurth")!.clock).toEqual(eurthClock);
    expect(clocks.get(DEFAULT_REALM_ID)!.clock).toBeNull();
    expect(pickClock(clocks, null).realmId).toBe(DEFAULT_REALM_ID);
    expect(pickClock(clocks, "gone")).toMatchObject({ realmId: "gone", fallback: true });
    // The run filled the cache: a later read of the same realm costs no query.
    await clockForRealm(db as never, "eurth");
    expect(db.realm.findUnique).not.toHaveBeenCalled();
  });
});
