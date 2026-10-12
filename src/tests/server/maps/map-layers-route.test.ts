/** @jest-environment node */
import { NextRequest } from "next/server";

const auth = jest.fn().mockResolvedValue({ userId: null });
jest.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const realmFindFirst = jest.fn();
const realmFindUnique = jest.fn();
const userFind = jest.fn().mockResolvedValue(null);
jest.mock("~/server/db", () => ({
  db: {
    realm: {
      findFirst: (a: unknown) => realmFindFirst(a),
      findUnique: (a: unknown) => realmFindUnique(a),
    },
    user: { findUnique: (a: unknown) => userFind(a) },
  },
}));
const packedLayerAt = jest.fn();
jest.mock("~/server/modules/maps/layer-delivery", () => ({
  packedLayerAt: (...a: unknown[]) => packedLayerAt(...a),
}));
const getRealmMapVersion = jest.fn();
jest.mock("~/server/shared/map-invalidation", () => ({
  getRealmMapVersion: (...a: unknown[]) => getRealmMapVersion(...a),
}));

// A getter, so a test can move the loader's output format between requests
let mockFormat = 1;
jest.mock("~/lib/maps/layer-format", () => ({
  get LAYER_FORMAT_VERSION() {
    return mockFormat;
  },
}));

import { GET } from "~/app/api/map-layers/[realm]/[version]/[layer]/route";

const BODY = '{"type":"FeatureCollection","packed":4,"features":[]}';
const IMMUTABLE = "public, max-age=31536000, immutable";

const getRaw = (
  realm: string,
  version: string,
  layer: string,
  query = "",
  headers: Record<string, string> = {}
) =>
  GET(
    new NextRequest(`http://localhost/api/map-layers/${realm}/${version}/${layer}${query}`, {
      headers,
    }),
    {
      params: Promise.resolve({ realm, version, layer }),
    }
  );

/** A request as the client sends it: the URL names the loader format of the build it came from. */
const get = (
  realm: string,
  version: string,
  layer: string,
  query = "",
  headers: Record<string, string> = {}
) => {
  const withFormat = query.includes("format=")
    ? query
    : `${query ? `${query}&` : "?"}format=${mockFormat}`;
  return getRaw(realm, version, layer, withFormat, headers);
};

/** A realm row as the access check and the slug lookup read it. */
const realmRow = (status: string, ownerId = "clerk_owner") => ({
  id: "r_eurth",
  status,
  ownerId,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFormat = 1;
  auth.mockResolvedValue({ userId: null });
  userFind.mockResolvedValue(null);
  packedLayerAt.mockResolvedValue(BODY);
  getRealmMapVersion.mockResolvedValue(3);
  realmFindUnique.mockResolvedValue(realmRow("active"));
  realmFindFirst.mockResolvedValue({ id: "r_eurth" });
});

describe("GET /api/map-layers", () => {
  it("serves Ixnay's layer as packed JSON that any cache keeps for a year", async () => {
    const res = await get("default", "3", "political", "?bucket=1");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("cache-control")).toBe(IMMUTABLE);
    expect(res.headers.get("etag")).toBe('"default-3-f1-political-1"');
    expect(await res.text()).toBe(BODY);
    expect(packedLayerAt).toHaveBeenCalledWith(expect.anything(), "default", 3, "political", 1);
  });

  it("takes Ixnay's slug as well as its id", async () => {
    const res = await get("ixnay", "3", "political");
    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBe('"default-3-f1-political-1"');
    expect(realmFindFirst).not.toHaveBeenCalled();
  });

  it("defaults to the mid zoom bucket", async () => {
    await get("default", "3", "political");
    expect(packedLayerAt).toHaveBeenCalledWith(expect.anything(), "default", 3, "political", 1);
  });

  it.each([0, 1, 2])("serves zoom bucket %i", async (bucket) => {
    const res = await get("default", "3", "political", `?bucket=${bucket}`);
    expect(res.headers.get("etag")).toBe(`"default-3-f1-political-${bucket}"`);
  });

  it("caches a published realm's layer publicly, found by slug or id", async () => {
    const bySlug = await get("eurth", "3", "political");
    expect(bySlug.headers.get("cache-control")).toBe(IMMUTABLE);
    expect(bySlug.headers.get("etag")).toBe('"r_eurth-3-f1-political-1"');

    realmFindFirst.mockClear();
    const byId = await get("r_eurth", "3", "political");
    expect(byId.status).toBe(200);
    expect(realmFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ id: "r_eurth" }, { slug: "r_eurth" }] } })
    );
  });

  it("answers 304 to a matching If-None-Match without building the layer", async () => {
    const res = await get("default", "3", "political", "?bucket=1", {
      "if-none-match": '"default-3-f1-political-1"',
    });

    expect(res.status).toBe(304);
    expect(res.headers.get("etag")).toBe('"default-3-f1-political-1"');
    expect(res.headers.get("cache-control")).toBe(IMMUTABLE);
    expect(packedLayerAt).not.toHaveBeenCalled();
  });

  it("sends the layer again when the tag no longer matches", async () => {
    const res = await get("default", "3", "political", "?bucket=1", {
      "if-none-match": '"default-2-f1-political-1", W/"other"',
    });
    expect(res.status).toBe(200);
  });

  it("answers 304 for a tag in a list or a weak one", async () => {
    const res = await get("default", "3", "political", "?bucket=1", {
      "if-none-match": 'W/"nope", W/"default-3-f1-political-1"',
    });
    expect(res.status).toBe(304);
  });

  it("serves the current data for a URL with an older version, with a tag of the current version", async () => {
    getRealmMapVersion.mockResolvedValue(5);
    const res = await get("default", "3", "political");

    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBe('"default-5-f1-political-1"');
    expect(packedLayerAt).toHaveBeenCalledWith(expect.anything(), "default", 5, "political", 1);
    // the URL names a version this body is not: it must not be kept as that version's forever
    expect(res.headers.get("cache-control")).not.toContain("immutable");
  });

  it("does not let a URL from the future be kept as immutable either", async () => {
    getRealmMapVersion.mockResolvedValue(2);
    const res = await get("default", "3", "political");
    expect(res.headers.get("cache-control")).not.toContain("immutable");
    expect(res.headers.get("etag")).toBe('"default-2-f1-political-1"');
  });

  it("serves an empty realm's layer as the empty collection the loader built, status 200", async () => {
    packedLayerAt.mockResolvedValue('{"type":"FeatureCollection","packed":4,"features":[]}');
    const res = await get("eurth", "0", "political");
    expect(res.status).toBe(200);
    expect(JSON.parse(await res.text())).toMatchObject({ features: [] });
  });
});

describe("GET /api/map-layers: loader format", () => {
  it("names the loader format in the tag, so a deploy that changes the output changes the tag", async () => {
    const before = await get("default", "3", "political");
    mockFormat = 2;
    const after = await get("default", "3", "political");

    expect(before.headers.get("etag")).toBe('"default-3-f1-political-1"');
    expect(after.headers.get("etag")).toBe('"default-3-f2-political-1"');
  });

  it("does not answer 304 to a tag from another loader format", async () => {
    mockFormat = 2;
    const res = await get("default", "3", "political", "?bucket=1", {
      "if-none-match": '"default-3-f1-political-1"',
    });
    expect(res.status).toBe(200);
    expect(packedLayerAt).toHaveBeenCalled();
  });

  it("keeps a URL of another format, or of none, out of the one-year cache: it gets the current build's bytes", async () => {
    mockFormat = 2;
    for (const query of ["?bucket=1&format=1", "?bucket=1", "?bucket=1&format=x"]) {
      const res = await getRaw("default", "3", "political", query);
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("public, no-cache");
      expect(res.headers.get("etag")).toBe('"default-3-f2-political-1"');
    }
    const current = await getRaw("default", "3", "political", "?bucket=1&format=2");
    expect(current.headers.get("cache-control")).toBe(IMMUTABLE);
  });
});

describe("GET /api/map-layers: unpublished realms (no leak)", () => {
  beforeEach(() => realmFindUnique.mockResolvedValue(realmRow("draft")));

  it.each(["draft", "generating"])("hides a %s realm from a signed-out viewer", async (status) => {
    realmFindUnique.mockResolvedValue(realmRow(status));
    const res = await get("eurth", "3", "political");

    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(packedLayerAt).not.toHaveBeenCalled();
    expect(await res.text()).not.toContain("FeatureCollection");
  });

  it("hides it from a signed-in viewer who may not see it", async () => {
    auth.mockResolvedValue({ userId: "clerk_other" });
    userFind.mockResolvedValue({
      id: "u2",
      clerkUserId: "clerk_other",
      role: { name: "user", level: 100 },
    });
    const res = await get("eurth", "3", "political");
    expect(res.status).toBe(404);
    expect(packedLayerAt).not.toHaveBeenCalled();
  });

  it("serves it to its owner, uncacheable by any cache, with no tag to revalidate", async () => {
    auth.mockResolvedValue({ userId: "clerk_owner" });
    userFind.mockResolvedValue({
      id: "u1",
      clerkUserId: "clerk_owner",
      role: { name: "user", level: 100 },
    });
    const res = await get("eurth", "3", "political", "?bucket=1", {
      "if-none-match": '"r_eurth-3-f1-political-1"',
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("etag")).toBeNull();
    expect(await res.text()).toBe(BODY);
  });

  it("serves it to site staff the same way", async () => {
    auth.mockResolvedValue({ userId: "clerk_admin" });
    userFind.mockResolvedValue({
      id: "u3",
      clerkUserId: "clerk_admin",
      role: { name: "admin", level: 10 },
    });
    const res = await get("eurth", "3", "political");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});

describe("GET /api/map-layers: bad requests", () => {
  it.each([
    ["an unknown layer", "default", "3", "streets"],
    ["a layer that is a path", "default", "3", "..%2Fpolitical"],
    ["a non-numeric version", "default", "latest", "political"],
    ["a negative version", "default", "-1", "political"],
    ["a fractional version", "default", "1.5", "political"],
  ])("404s on %s without querying", async (_n, realm, version, layer) => {
    expect((await get(realm, version, layer)).status).toBe(404);
    expect(packedLayerAt).not.toHaveBeenCalled();
  });

  it("404s on an unknown realm", async () => {
    realmFindFirst.mockResolvedValue(null);
    expect((await get("nowhere", "3", "political")).status).toBe(404);
    expect(packedLayerAt).not.toHaveBeenCalled();
  });

  it.each(["3", "-1", "x", "1.5", ""])("400s on bucket %j", async (bucket) => {
    const res = await get("default", "3", "political", `?bucket=${bucket}`);
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(packedLayerAt).not.toHaveBeenCalled();
  });

  it("answers 500, uncached, when the layer cannot be built", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    packedLayerAt.mockRejectedValue(new Error("db down"));
    const res = await get("default", "3", "political");
    expect(res.status).toBe(500);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
