import { TextDecoder, TextEncoder } from "util";
global.TextDecoder = TextDecoder as any;
global.TextEncoder = TextEncoder as any;

import { NextRequest } from "next/server";
import { GET } from "~/app/api/maps/editor-source/[layer]/route";
import { db } from "~/server/db";
import { loadLayerFromDB } from "~/server/api/routers/geo/core/layer-loader";

// Mock the Prisma DB client
jest.mock("../../../../../../server/db", () => ({
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
  },
}));

// Mock the layer loader
jest.mock("../../../../../../server/api/routers/geo/core/layer-loader", () => ({
  loadLayerFromDB: jest.fn(),
}));

describe("Map Editor Source Layer API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  test("should return overlay subdivisions features", async () => {
    const mockSubdivisions = [
      {
        id: "sub-1",
        name: "Subdivision 1",
        type: "province",
        level: 1,
        areaSqKm: 1500,
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [0, 1],
              [1, 1],
              [0, 0],
            ],
          ],
        },
        countryId: "ctry-1",
        country: { name: "Country 1", slug: "country-1" },
      },
    ];

    (db.subdivision.findMany as jest.Mock).mockResolvedValue(mockSubdivisions);

    const request = new NextRequest("http://localhost/api/maps/editor-source/overlay-subdivisions");
    const response = await GET(request, {
      params: Promise.resolve({ layer: "overlay-subdivisions" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.type).toBe("FeatureCollection");
    expect(data.features).toHaveLength(1);
    expect(data.features[0].properties.name).toBe("Subdivision 1");
    expect(data.features[0].geometry.type).toBe("Polygon");
  });

  test("should return non-capital cities", async () => {
    const mockCities = [
      {
        id: "city-2",
        name: "City 2",
        coordinates: [15.2, -5.2],
        population: 100000,
        type: "major",
        wikiPageTitle: "City_2",
        countryId: "ctry-1",
        country: { name: "Country 1", slug: "country-1" },
      },
    ];

    (db.city.findMany as jest.Mock).mockResolvedValue(mockCities);

    const request = new NextRequest("http://localhost/api/maps/editor-source/cities");
    const response = await GET(request, {
      params: Promise.resolve({ layer: "cities" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.type).toBe("FeatureCollection");
    expect(data.features[0].properties.name).toBe("City 2");
    expect(data.features[0].properties.isCapital).toBe(false);
  });

  test("should return points of interest", async () => {
    const mockPOIs = [
      {
        id: "poi-1",
        name: "Lighthouse",
        coordinates: [12.0, 34.0],
        category: "monument",
        icon: "lighthouse-icon",
        description: "Old historical lighthouse",
        wikiPageTitle: "Lighthouse_Wiki",
        countryId: "ctry-1",
        country: { name: "Country 1", slug: "country-1" },
      },
    ];

    (db.pointOfInterest.findMany as jest.Mock).mockResolvedValue(mockPOIs);

    const request = new NextRequest("http://localhost/api/maps/editor-source/pois");
    const response = await GET(request, {
      params: Promise.resolve({ layer: "pois" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.type).toBe("FeatureCollection");
    expect(data.features[0].properties.name).toBe("Lighthouse");
    expect(data.features[0].properties.category).toBe("monument");
  });

  test("should return story pins", async () => {
    const mockPins = [
      {
        id: "pin-1",
        title: "Battle of Waterloo",
        category: "battle",
        coordinates: [4.4, 50.7],
        importance: 2,
        content: "Famous historical battle",
        wikiPageTitle: "Waterloo",
        countryId: "ctry-2",
      },
    ];

    (db.storyPin.findMany as jest.Mock).mockResolvedValue(mockPins);

    const request = new NextRequest("http://localhost/api/maps/editor-source/story-pins");
    const response = await GET(request, {
      params: Promise.resolve({ layer: "story-pins" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.type).toBe("FeatureCollection");
    expect(data.features[0].properties.title).toBe("Battle of Waterloo");
  });

  test("should return custom map labels", async () => {
    const mockLabels = [
      {
        id: "lbl-1",
        text: "Ocean Label",
        labelType: "ocean",
        coordinates: [-20.0, 10.0],
        fontSize: 14,
        color: "#000",
        rotation: 45,
        letterSpacing: 2,
        fontWeight: "bold",
        opacity: 0.9,
        minZoom: 2,
        maxZoom: 10,
      },
    ];

    (db.mapLabel.findMany as jest.Mock).mockResolvedValue(mockLabels);

    const request = new NextRequest("http://localhost/api/maps/editor-source/map-labels");
    const response = await GET(request, {
      params: Promise.resolve({ layer: "map-labels" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.type).toBe("FeatureCollection");
    expect(data.features[0].properties.text).toBe("Ocean Label");
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
    expect(loadLayerFromDB).toHaveBeenCalledWith(db, "political", 2);
  });
});
