/**
 * Scenario: a realm's founder saves a border in Eurth, and every open map hears of it through live sync: the map of
 * Eurth refetches its version and the open country's queries, the map of Ixnay ignores it. Real modules throughout:
 * the border router, the map version bump, the map update bus, the SSE route (with its realm lookup for a writer
 * that names only a country) and the client's useMapLiveSync. The database, the country outline sync, PostGIS's
 * validity check, the tRPC client and EventSource are faked; the SSE stream's chunks are what the fake EventSources
 * receive.
 */
import { ReadableStream } from "node:stream/web";
import { TextDecoder, TextEncoder } from "node:util";
import { act, renderHook } from "@testing-library/react";

// jsdom has no web streams: the SSE route needs them, and a Response that hands its body back as it is
Object.assign(globalThis, { ReadableStream, TextEncoder, TextDecoder });
class StreamResponse {
  constructor(readonly body: ReadableStream<Uint8Array>) {}
}
Object.assign(globalThis, { Response: StreamResponse });

jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
const countryRealm = jest.fn();
jest.mock("~/server/db", () => ({
  db: { country: { findUnique: (...a: unknown[]) => countryRealm(...a) } },
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
  rateLimiter: { check: jest.fn().mockResolvedValue({ success: true }), isEnabled: () => false },
}));
jest.mock("~/lib/country-geo", () => ({
  __esModule: true,
  syncCountryGeometryFromMapLayer: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/lib/maps/geo-validation", () => ({
  ...jest.requireActual("~/lib/maps/geo-validation"),
  validateGeometryValid: jest.fn().mockResolvedValue(undefined),
}));
const versions: Record<string, { realmId: string; version: number }> = {
  eurth: { realmId: "r_eurth", version: 7 },
  ixnay: { realmId: "default", version: 3 },
};
jest.mock("~/hooks/useRealmMapVersion", () => ({
  useRealmMapVersion: (realm: string) => ({ mapVersion: versions[realm], error: null }),
}));
jest.mock("~/trpc/react", () => {
  const query = () => ({ invalidate: jest.fn() });
  const utils = {
    realms: { map: { version: query(), display: query() } },
    geoCore: {
      getMapBundleMarkers: query(),
      getMapBundleDetail: query(),
      getCountryFeatures: query(),
      getCountryGeometry: query(),
    },
    geoFeatures: { getAllStoryPins: query(), getAllMapLabels: query() },
    countryGeo: { getCountryGeoBundle: query() },
  };
  return { api: { useUtils: () => utils } };
});

import { GET as mapUpdates } from "~/app/api/sse/map-updates/route";
import { useMapLiveSync } from "~/hooks/useMapLiveSync";
import { broadcastMapUpdate, mapUpdateBus } from "~/lib/maps/map-update-bus";
import { createCallerFactory } from "~/server/api/trpc";
import { geoEditorBordersRouter } from "~/server/api/routers/geo/editor/borders";
import { api } from "~/trpc/react";
import { createMockRouterContext } from "~/tests/helpers/router-context";

/** The invalidators live sync may call, by the query they refresh. */
const utils = api.useUtils();
const invalidators = {
  version: utils.realms.map.version.invalidate,
  display: utils.realms.map.display.invalidate,
  markers: utils.geoCore.getMapBundleMarkers.invalidate,
  detail: utils.geoCore.getMapBundleDetail.invalidate,
  storyPins: utils.geoFeatures.getAllStoryPins.invalidate,
  labels: utils.geoFeatures.getAllMapLabels.invalidate,
  countryFeatures: utils.geoCore.getCountryFeatures.invalidate,
  countryGeometry: utils.geoCore.getCountryGeometry.invalidate,
  countryBundle: utils.countryGeo.getCountryGeoBundle.invalidate,
};
const ALL = Object.keys(invalidators).sort();
const COUNTRY = ["countryBundle", "countryFeatures", "countryGeometry"];
const refetched = () =>
  Object.entries(invalidators)
    .filter(([, fn]) => jest.mocked(fn).mock.calls.length > 0)
    .map(([name]) => name)
    .sort();
const resetRefetches = () =>
  Object.values(invalidators).forEach((fn) => jest.mocked(fn).mockClear());

class FakeEventSource {
  static open: FakeEventSource[] = [];
  listener: ((message: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;
  close = jest.fn();
  constructor(readonly url: string) {
    FakeEventSource.open.push(this);
  }
  addEventListener(_type: string, listener: (message: { data: string }) => void) {
    this.listener = listener;
  }
}

/** The SSE stream as a viewer reads it: the `connected` greeting, then one chunk per relayed change. */
async function openStream() {
  const abort = new AbortController();
  const response = (await mapUpdates({
    signal: abort.signal,
    headers: new Headers(),
  } as Request)) as unknown as StreamResponse;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const next = async () => decoder.decode((await reader.read()).value);
  expect(await next()).toContain("event: connected");
  return { next, close: () => abort.abort() };
}
const dataOf = (chunk: string) => {
  expect(chunk).toContain("event: map_data_changed");
  return chunk.split("data: ")[1]!.trim();
};

/** Hand a relayed change to one open map, then let its debounce window pass. */
function deliver(source: FakeEventSource, ...data: string[]) {
  act(() => data.forEach((d) => source.listener?.({ data: d })));
  act(() => {
    jest.advanceTimersByTime(1000);
  });
}

/** Eurth's founder's view of the database: a political region of theirs, and the realm row the version lives on. */
function editorDb() {
  const realm = {
    id: "r_eurth",
    slug: "eurth",
    ownerId: "clerk_founder",
    status: "active",
    officers: [],
    mapVersion: 7,
  };
  const square = (x: number) => ({
    type: "Polygon",
    coordinates: [
      [
        [x, 0],
        [x + 2, 0],
        [x + 2, 2],
        [x, 2],
        [x, 0],
      ],
    ],
  });
  return {
    realm: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; slug?: string } }) =>
        where.slug === "eurth" || where.id === "r_eurth" ? realm : null
      ),
    },
    mapLayer: {
      findFirst: jest.fn(async () => ({
        id: "ml1",
        geometry: square(0),
        countryId: "c1",
        displayName: "Aurelia",
        areaSqKm: 10,
      })),
      findMany: jest.fn(async () => []),
      update: jest.fn(async () => ({})),
    },
    borderHistory: { create: jest.fn(async () => ({})) },
    mapEditorSession: { deleteMany: jest.fn(async () => ({ count: 1 })) },
    auditLog: { create: jest.fn(async () => ({})) },
    user: { findUnique: jest.fn(async () => null) },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(editorDb.current)),
    $queryRaw: jest.fn(async () => {
      realm.mapVersion += 1;
      return [{ mapVersion: realm.mapVersion }];
    }),
    $queryRawUnsafe: jest.fn(async () => []),
    square,
    realm_: realm,
  };
}
editorDb.current = null as unknown;

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
  FakeEventSource.open = [];
  Object.defineProperty(globalThis, "EventSource", { value: FakeEventSource, configurable: true });
  countryRealm.mockReset();
  resetRefetches();
  for (const level of ["info", "warn"] as const)
    jest.spyOn(console, level).mockImplementation(() => undefined);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("an edit in one realm refreshes only that realm's open maps", () => {
  it("relays a founder's border save to Eurth's map, which refetches what it touched, and not to Ixnay's", async () => {
    const eurthMap = renderHook(() => useMapLiveSync("eurth"));
    renderHook(() => useMapLiveSync("ixnay"));
    const [eurth, ixnay] = FakeEventSource.open as [FakeEventSource, FakeEventSource];
    const stream = await openStream();

    // The founder saves a border straight to the map
    const db = editorDb();
    editorDb.current = db;
    await createCallerFactory(geoEditorBordersRouter)(
      createMockRouterContext({
        db,
        auth: { userId: "clerk_founder" },
        user: {
          id: "u_founder",
          clerkUserId: "clerk_founder",
          role: { name: "user", level: 100 },
          country: null,
        },
        rateLimitIdentifier: `founder_${Math.random()}`,
      }) as never
    ).submitBorderEdit({
      featureId: "F",
      editSubtype: "vertex_edit",
      proposedGeometry: db.square(1),
      applyDirectly: true,
      realm: "eurth",
    });
    expect(db.realm_.mapVersion).toBe(8);

    // The stream relays the version bump and the border change, each naming Eurth, without a realm lookup
    const relayed = [dataOf(await stream.next()), dataOf(await stream.next())];
    expect(relayed.map((d) => JSON.parse(d) as { changeType: string; realmId: string })).toEqual([
      expect.objectContaining({
        changeType: "version",
        realmId: "r_eurth",
        timestamp: expect.any(Number),
      }),
      expect.objectContaining({ changeType: "borders", realmId: "r_eurth", countryId: "c1" }),
    ]);
    expect(countryRealm).not.toHaveBeenCalled();

    // Ixnay's map ignores both; Eurth's refetches its version (and the display's raster list) and the open country,
    // once for the burst
    deliver(ixnay, ...relayed);
    expect(refetched()).toEqual([]);
    deliver(eurth, ...relayed);
    expect(refetched()).toEqual(["display", "version", ...COUNTRY].sort());
    expect(invalidators.version).toHaveBeenCalledTimes(1);

    // A writer that names only the country is relayed with the country's realm
    countryRealm.mockResolvedValue({ realmId: "r_eurth" });
    broadcastMapUpdate("storyPin", "c-pin-1");
    const pin = dataOf(await stream.next());
    expect(JSON.parse(pin)).toMatchObject({
      changeType: "storyPin",
      countryId: "c-pin-1",
      realmId: "r_eurth",
    });
    resetRefetches();
    deliver(ixnay, pin);
    deliver(eurth, pin);
    expect(refetched()).toEqual(["storyPins", ...COUNTRY].sort());

    // An event that cannot be relayed is logged, and the stream goes on with the next one
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mapUpdateBus.emit({ type: "map_data_changed", changeType: "poi", timestamp: 1n as never });
    broadcastMapUpdate("bulk", undefined, "default");
    expect(JSON.parse(dataOf(await stream.next()))).toMatchObject({
      changeType: "bulk",
      realmId: "default",
    });
    expect(error).toHaveBeenCalledWith("[map-updates] relay failed:", expect.any(Error));

    // Once the map is gone it stops listening and refetches nothing
    resetRefetches();
    eurthMap.unmount();
    deliver(eurth, relayed[0]!);
    expect(eurth.close).toHaveBeenCalled();
    expect(refetched()).toEqual([]);
    stream.close();
  });

  it.each([
    [
      "a change in every realm (no realm named)",
      JSON.stringify({ changeType: "version" }),
      ["display", "version"],
    ],
    ["a bulk change", JSON.stringify({ changeType: "bulk", realmId: "default" }), ALL],
    ["a payload it cannot read", "not json", ALL],
    [
      "a city",
      JSON.stringify({ changeType: "city", realmId: "default" }),
      ["detail", "markers", ...COUNTRY].sort(),
    ],
    ["another realm's bulk change", JSON.stringify({ changeType: "bulk", realmId: "r_eurth" }), []],
  ])("refetches, on Ixnay's map, what %s touches", (_name, data, expected) => {
    renderHook(() => useMapLiveSync("ixnay"));
    deliver(FakeEventSource.open[0]!, data);
    expect(refetched()).toEqual(expected);
  });

  it("takes every realm's change as its own while the map's realm is not known yet", () => {
    renderHook(() => useMapLiveSync("not-loaded"));
    deliver(FakeEventSource.open[0]!, JSON.stringify({ changeType: "poi", realmId: "r_eurth" }));
    expect(refetched()).toEqual(["markers", ...COUNTRY].sort());
  });
});
