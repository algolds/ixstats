/** @jest-environment node */
/**
 * Map uploads: the map import upload route (signed in, the realm's founder or a site admin, an oversize body refused
 * by its Content-Length before it is read, the file's kind taken from its bytes, a gzip that is not a valid world
 * bundle refused and never stored), the province upload route's own body limit, and the province import's limits on
 * its content (capped before decoding, an image the decoder refuses is the uploader's input).
 *
 * Folds: src/tests/app/api/map-upload-size.test.ts, src/tests/server/api/routers/geo/province-upload-limits.test.ts
 */
const realmFindUnique = jest.fn();
jest.mock("~/server/db", () => ({
  db: { realm: { findUnique: (...args: unknown[]) => realmFindUnique(...args) } },
}));
const requireAdminSession = jest.fn();
jest.mock("~/server/shared/route-auth", () => ({
  requireAdminSession: (...args: unknown[]) => requireAdminSession(...args),
}));
const auth = jest.fn();
jest.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const pruneIfDue = jest.fn();
jest.mock("~/server/modules/maps/map-import.prune", () => ({
  pruneWorldUploadsIfDue: (...args: unknown[]) => pruneIfDue(...args),
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  rateLimiter: { check: jest.fn().mockResolvedValue({ success: true }), isEnabled: () => false },
}));
jest.mock("~/lib/flags/png-to-svg", () => ({ extractProvincesFromPng: jest.fn() }));

import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { POST } from "~/app/api/admin/map-import/upload/route";
import { POST as uploadProvince } from "~/app/api/upload-province/route";
import { extractProvincesFromPng } from "~/lib/flags/png-to-svg";
import { MAX_MAP_IMPORT_BYTES } from "~/lib/maps/import/options";
import { MAX_PNG_BASE64_LENGTH, PngDecodeError } from "~/lib/maps/png-realm-map";
import { DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import { encodeCells, type WorldBundle } from "~/lib/maps/import/world-bundle";
import { createCallerFactory } from "~/server/api/trpc";
import { geoAdminProvincesRouter } from "~/server/api/routers/geo/admin/provinces";
import { sniffMapKind } from "~/server/modules/maps/map-import.upload";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const MB = 1024 * 1024;
let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "map-upload-"));
  process.env.MAP_IMPORT_DIR = dir;
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.MAP_IMPORT_DIR;
});

beforeEach(() => {
  pruneIfDue.mockReset().mockResolvedValue(null);
  auth.mockResolvedValue({ userId: "founder_1" });
  realmFindUnique.mockResolvedValue({ id: "r1", ownerId: "founder_1" });
  requireAdminSession.mockResolvedValue(
    NextResponse.json({ error: "Admin access required" }, { status: 403 })
  );
});

/** A request whose `formData` records whether the route read the body. */
function request(options: { contentLength?: number; realm?: string; file?: File | null }) {
  const headers = new Headers();
  if (options.contentLength !== undefined)
    headers.set("content-length", String(options.contentLength));
  const form = new FormData();
  if (options.file) form.set("file", options.file);
  const formData = jest.fn().mockResolvedValue(form);
  const url = new URL(
    `https://ixstats.test/api/admin/map-import/upload${options.realm ? `?realm=${options.realm}` : ""}`
  );
  return { req: { headers, formData, nextUrl: url } as unknown as NextRequest, formData };
}

const geojson = new File(
  [
    '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"NAME":"A"},"geometry":{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}},{"type":"Feature","properties":{"NAME":"B"},"geometry":{"type":"Polygon","coordinates":[[[2,0],[3,0],[3,1],[2,0]]]}}]}',
  ],
  "eurth.geojson"
);

describe("upload routes: the body size", () => {
  it.each([
    ["/api/admin/map-import/upload", MAX_MAP_IMPORT_BYTES + 2 * MB, POST],
    ["/api/upload-province", 21 * MB, uploadProvince],
  ])(
    "%s answers 413 for a body over its limit without reading it",
    async (_route, contentLength, post) => {
      const { req, formData } = request({ realm: "r1", contentLength });
      expect((await post(req)).status).toBe(413);
      expect(formData).not.toHaveBeenCalled();
    }
  );
});

describe("POST /api/admin/map-import/upload", () => {
  it("refuses a signed-out caller and a player who is neither founder nor admin", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await POST(request({ realm: "r1" }).req)).status).toBe(401);
    auth.mockResolvedValue({ userId: "someone" });
    const { req, formData } = request({ realm: "r1", file: geojson });
    expect((await POST(req)).status).toBe(403);
    expect(formData).not.toHaveBeenCalled();
  });

  it("lets a site admin upload to any realm, and refuses a file of no known kind", async () => {
    auth.mockResolvedValue({ userId: "admin_1" });
    requireAdminSession.mockResolvedValue({ userId: "admin_1" });
    const response = await POST(
      request({ realm: "r1", file: new File(["hello"], "notes.txt") }).req
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/PNG, JPEG or WebP/);
  });

  const empty = { type: "FeatureCollection" as const, features: [] };
  const worldBundle: WorldBundle = {
    version: 1,
    seed: 3,
    params: { ...DEFAULT_PARAMS },
    source: "realm-map",
    layers: {
      background: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 0],
                ],
              ],
            },
          },
        ],
      },
      altitudes: empty,
      climate: empty,
      rivers: empty,
      lakes: empty,
      icecaps: empty,
    },
    slots: [],
    cells: encodeCells(new Float32Array([1, 2, 3])),
  };

  it.each([
    [
      "other gzip",
      new File([gzipSync("hello")], "notes.gz"),
      /not a world bundle.*not valid JSON/i,
    ],
    [
      "a gzip bundle that breaks a rule",
      new File(
        [gzipSync(JSON.stringify({ ...worldBundle, slots: [{ key: "slot_1" }] }))],
        "world.json.gz"
      ),
      /not a world bundle.*slots/i,
    ],
  ])("refuses %s, naming why, and stores nothing", async (_case, file, reason) => {
    const stored = readdirSync(dir, { recursive: true });
    const response = await POST(request({ realm: "r1", file }).req);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(reason);
    expect(readdirSync(dir, { recursive: true })).toEqual(stored);
  });

  it("sniffMapKind reads the kind from the bytes, not the name", () => {
    const bytes = (text: string) => new TextEncoder().encode(text);
    expect(sniffMapKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0]))).toBe("png");
    expect(sniffMapKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("png");
    expect(
      sniffMapKind(bytes('<?xml version="1.0"?>\n<!-- map -->\n<svg viewBox="0 0 1 1"/>'))
    ).toBe("svg");
    expect(sniffMapKind(bytes('  {"type":"FeatureCollection"}'))).toBe("geojson");
    expect(sniffMapKind(bytes("GIF89a"))).toBeNull();
    expect(sniffMapKind(new Uint8Array([0x1f, 0x8b, 0x08, 0, 0, 0]))).toBe("world");
    expect(sniffMapKind(new Uint8Array([0x1f, 0x8b, 0x07]))).toBeNull();
  });
});

describe("geoAdmin.parseProvinceUpload: SVG markup or a base64 PNG", () => {
  const extractMock = jest.mocked(extractProvincesFromPng);
  beforeEach(() => extractMock.mockReset());

  const admin = {
    id: "u_admin",
    clerkUserId: "admin_1",
    countryId: null,
    role: { name: "admin", level: 10 },
    country: null,
  };
  function caller() {
    const db = {
      mapLayer: { findFirst: jest.fn().mockResolvedValue(null) },
      svgUpload: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { findUnique: jest.fn().mockResolvedValue(admin) },
    };
    return createCallerFactory(geoAdminProvincesRouter)(
      createMockRouterContext({ db, auth: { userId: "admin_1" }, user: admin }) as never
    );
  }
  /** Non-markup content is read as a base64 PNG. */
  const PNG_BASE64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]).toString("base64");

  it("refuses content over the size limit before decoding anything", async () => {
    await expect(
      caller().parseProvinceUpload({
        countryId: "c1",
        svgContent: "A".repeat(MAX_PNG_BASE64_LENGTH + 4),
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(extractMock).not.toHaveBeenCalled();
  });

  it("answers an image the decoder refuses (over the pixel limit, corrupt) as BAD_REQUEST with its reason", async () => {
    extractMock.mockRejectedValue(new PngDecodeError("it is 9000×9000 pixels"));
    await expect(
      caller().parseProvinceUpload({ countryId: "c1", svgContent: PNG_BASE64 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/64 megapixels.*9000×9000 pixels$/),
    });
  });
});
