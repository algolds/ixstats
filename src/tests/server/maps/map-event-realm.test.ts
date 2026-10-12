/** @jest-environment node */
/**
 * resolveEventRealm: a change event that names a country but not a realm gets its realm from the country, so a
 * viewer's live sync can ignore other realms' edits. The lookup is memoised per country (one query per country per
 * minute, however many viewers are connected) and never fails the event: no answer leaves it for every realm.
 */
import type { MapUpdateEvent } from "~/lib/maps/map-update-bus";

const event = (patch: Partial<MapUpdateEvent> = {}): MapUpdateEvent => ({
  type: "map_data_changed",
  changeType: "city",
  timestamp: 1,
  ...patch,
});

function fakeDb(realmId: string | null = "r_eurth") {
  return {
    country: {
      findUnique: jest.fn().mockResolvedValue(realmId === null ? null : { realmId }),
    },
  };
}

type Resolve = typeof import("~/server/modules/maps/map-event-realm").resolveEventRealm;
let resolveEventRealm: Resolve;

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  resolveEventRealm = (
    require("~/server/modules/maps/map-event-realm") as { resolveEventRealm: Resolve }
  ).resolveEventRealm;
});

afterEach(() => jest.useRealTimers());

describe("resolveEventRealm", () => {
  it("names the country's realm", async () => {
    const db = fakeDb("r_eurth");

    const resolved = await resolveEventRealm(db, event({ countryId: "c1" }));

    expect(resolved).toEqual(event({ countryId: "c1", realmId: "r_eurth" }));
    expect(db.country.findUnique).toHaveBeenCalledWith({
      where: { id: "c1" },
      select: { realmId: true },
    });
  });

  it("keeps a realm the writer already named, without a lookup", async () => {
    const db = fakeDb();
    const named = event({ countryId: "c1", realmId: "default" });

    await expect(resolveEventRealm(db, named)).resolves.toBe(named);
    expect(db.country.findUnique).not.toHaveBeenCalled();
  });

  it("leaves an event with neither a realm nor a country for every realm", async () => {
    const db = fakeDb();
    const bare = event();

    await expect(resolveEventRealm(db, bare)).resolves.toBe(bare);
    expect(db.country.findUnique).not.toHaveBeenCalled();
  });

  it("asks once per country, however many connections resolve the same event", async () => {
    const db = fakeDb();

    await Promise.all([
      resolveEventRealm(db, event({ countryId: "c1" })),
      resolveEventRealm(db, event({ countryId: "c1" })),
      resolveEventRealm(db, event({ countryId: "c1" })),
    ]);
    await resolveEventRealm(db, event({ countryId: "c1" }));

    expect(db.country.findUnique).toHaveBeenCalledTimes(1);
  });

  it("asks again after a minute", async () => {
    const db = fakeDb();
    await resolveEventRealm(db, event({ countryId: "c1" }));

    jest.advanceTimersByTime(61_000);
    await resolveEventRealm(db, event({ countryId: "c1" }));

    expect(db.country.findUnique).toHaveBeenCalledTimes(2);
  });

  it("leaves the event for every realm when the country is unknown", async () => {
    const db = fakeDb(null);
    const unknown = event({ countryId: "gone" });

    await expect(resolveEventRealm(db, unknown)).resolves.toBe(unknown);
  });

  it("leaves the event for every realm when the lookup fails, and tries again next time", async () => {
    const db = fakeDb();
    db.country.findUnique.mockRejectedValueOnce(new Error("db down"));
    const first = event({ countryId: "c1" });

    await expect(resolveEventRealm(db, first)).resolves.toBe(first);
    await expect(resolveEventRealm(db, event({ countryId: "c1" }))).resolves.toMatchObject({
      realmId: "r_eurth",
    });
  });
});
