import { TextDecoder, TextEncoder } from "util";
global.TextDecoder = TextDecoder as any;
global.TextEncoder = TextEncoder as any;

import { NextRequest, NextResponse } from "next/server";
import { GET } from "~/app/api/maps/editor-source/[layer]/route";
import { db } from "~/server/db";
import { loadLayerFromDB } from "~/server/modules/maps/layer-loader";
import { requireAdminSession } from "~/server/shared/route-auth";
import { rateLimiter } from "~/lib/cache";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";

// Mock the Prisma DB client
jest.mock("~/server/db", () => ({
  db: {
    city: {
      findMany: jest.fn(),
    },
    subdivision: {
      findMany: jest.fn(),
    },
    pointOfInterest: {
      findMany: jest.fn(),
    },
    storyPin: {
      findMany: jest.fn(),
    },
    mapLabel: {
      findMany: jest.fn(),
    },
    realm: {
      findUnique: jest.fn(),
    },
  },
}));

// The style editor's sources are for admins only
jest.mock("~/server/shared/route-auth", () => ({
  requireAdminSession: jest.fn(),
}));

jest.mock("~/lib/cache", () => ({
  rateLimiter: { check: jest.fn() },
}));

// Mock the layer loader
jest.mock("~/server/modules/maps/layer-loader", () => ({
  loadLayerFromDB: jest.fn(),
}));

const allowed = () => ({ success: true, remaining: 100, resetAt: new Date(Date.now() + 60_000) });

describe("Map Editor Source Layer API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAdminSession as jest.Mock).mockResolvedValue({ userId: "admin_1" });
    (rateLimiter.check as jest.Mock).mockResolvedValue(allowed());
  });

  test("should return national capitals GeoJSON features", async () => {
    const mockCapitals = [
      {
        id: "cap-1",
        name: "Capital City 1",
        coordinates: [10.5, 20.5],
        population: 500000,
        wikiPageTitle: "Capital_1",
        countryId: "ctry-1",
        country: { name: "Country 1", slug: "country-1" },
      },
    ];

    (db.city.findMany as jest.Mock).mockResolvedValue(mockCapitals);

    const request = new NextRequest("http://localhost/api/maps/editor-source/capitals");
    const response = await GET(request, {
      params: Promise.resolve({ layer: "capitals" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.type).toBe("FeatureCollection");
    expect(data.features).toHaveLength(1);
    expect(data.features[0].properties.name).toBe("Capital City 1");
    expect(data.features[0].geometry.type).toBe("Point");
    expect(data.features[0].geometry.coordinates).toEqual([10.5, 20.5]);
  });
  test("should fall back to layer loader for base layers", async () => {
    const mockBaseCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [0, 0],
                [0, 5],
                [5, 5],
                [0, 0],
              ],
            ],
          },
          properties: { id: "p-1", name: "Base Area" },
        },
      ],
    };

    (loadLayerFromDB as jest.Mock).mockResolvedValue(mockBaseCollection);

    const request = new NextRequest("http://localhost/api/maps/editor-source/political");
    const response = await GET(request, {
      params: Promise.resolve({ layer: "political" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.type).toBe("FeatureCollection");
    expect(data.features[0].properties.name).toBe("Base Area");
    expect(loadLayerFromDB).toHaveBeenCalledWith(db, "political", 2, DEFAULT_REALM_ID);
  });
});

describe("Map Editor Source Layer API — access and realm scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireAdminSession as jest.Mock).mockResolvedValue({ userId: "admin_1" });
    (rateLimiter.check as jest.Mock).mockResolvedValue(allowed());
    (db.city.findMany as jest.Mock).mockResolvedValue([]);
  });

  const get = (path: string, layer: string) =>
    GET(new NextRequest(`http://localhost/api/maps/editor-source/${path}`), {
      params: Promise.resolve({ layer }),
    });

  it("answers the auth guard's 401/403 without reading any data", async () => {
    for (const status of [401, 403]) {
      (requireAdminSession as jest.Mock).mockResolvedValueOnce(
        NextResponse.json({ error: "no" }, { status })
      );
      expect((await get("cities", "cities")).status).toBe(status);
    }
    expect(db.city.findMany).not.toHaveBeenCalled();
    expect(loadLayerFromDB).not.toHaveBeenCalled();
  });

  it("rate limits each admin", async () => {
    (rateLimiter.check as jest.Mock).mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 30_000),
    });
    const response = await get("cities", "cities");
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(rateLimiter.check).toHaveBeenCalledWith(
      "admin_1",
      "map_editor_source",
      expect.objectContaining({ maxRequests: expect.any(Number) })
    );
    expect(db.city.findMany).not.toHaveBeenCalled();
  });

  it("serves Ixnay's features by default, privately cacheable", async () => {
    const response = await get("cities", "cities");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=60");
    expect((db.city.findMany as jest.Mock).mock.calls[0][0].where).toMatchObject({
      country: { realmId: DEFAULT_REALM_ID },
    });
  });

  it("scopes every overlay and base layer to ?realm=", async () => {
    (db.realm.findUnique as jest.Mock).mockResolvedValue({ id: "r_eurth" });
    for (const model of ["subdivision", "pointOfInterest", "storyPin", "mapLabel"] as const) {
      ((db as any)[model].findMany as jest.Mock).mockResolvedValue([]);
    }

    for (const layer of [
      "capitals",
      "cities",
      "subdivisions",
      "pois",
      "story-pins",
      "map-labels",
    ]) {
      expect((await get(`${layer}?realm=eurth`, layer)).status).toBe(200);
    }
    await get("political?realm=eurth", "political");

    const wheres = ["city", "subdivision", "pointOfInterest", "storyPin", "mapLabel"].flatMap(
      (model) => ((db as any)[model].findMany as jest.Mock).mock.calls.map((c) => c[0].where)
    );
    expect(wheres).toHaveLength(6);
    for (const where of wheres) expect(where.country).toEqual({ realmId: "r_eurth" });
    expect(db.realm.findUnique).toHaveBeenCalledWith({
      where: { slug: "eurth" },
      select: { id: true },
    });
    expect(loadLayerFromDB).toHaveBeenCalledWith(db, "political", 2, "r_eurth");
  });

  it("refuses an unknown realm", async () => {
    (db.realm.findUnique as jest.Mock).mockResolvedValue(null);
    expect((await get("cities?realm=nowhere", "cities")).status).toBe(404);
    expect(db.city.findMany).not.toHaveBeenCalled();
  });
});
