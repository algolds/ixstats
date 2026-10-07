/** @jest-environment node */
/**
 * The map import upload route: signed in, the realm's founder or a site admin, an oversize body refused by its
 * Content-Length before it is read, the file's kind taken from its bytes.
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
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  rateLimiter: { check: jest.fn().mockResolvedValue({ success: true }) },
}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { POST } from "~/app/api/admin/map-import/upload/route";
import { MAX_MAP_IMPORT_BYTES } from "~/lib/maps/import/options";
import { sniffMapKind } from "~/server/modules/maps/map-import.upload";

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
  auth.mockResolvedValue({ userId: "founder_1" });
  realmFindUnique.mockResolvedValue({ id: "r1", ownerId: "founder_1" });
  requireAdminSession.mockResolvedValue(
    NextResponse.json({ error: "Admin access required" }, { status: 403 })
  );
});

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

describe("POST /api/admin/map-import/upload", () => {
  it("answers 413 for a body over the limit without reading it", async () => {
    const { req, formData } = request({
      realm: "r1",
      contentLength: MAX_MAP_IMPORT_BYTES + 2 * MB,
    });
    const response = await POST(req);
    expect(response.status).toBe(413);
    expect(formData).not.toHaveBeenCalled();
  });

  it("refuses a signed-out caller and a player who is neither founder nor admin", async () => {
    auth.mockResolvedValue({ userId: null });
    expect((await POST(request({ realm: "r1" }).req)).status).toBe(401);
    auth.mockResolvedValue({ userId: "someone" });
    const { req, formData } = request({ realm: "r1", file: geojson });
    expect((await POST(req)).status).toBe(403);
    expect(formData).not.toHaveBeenCalled();
  });

  it("needs a known realm", async () => {
    realmFindUnique.mockResolvedValue(null);
    expect((await POST(request({ realm: "nope" }).req)).status).toBe(404);
  });

  it("stores a GeoJSON file and describes it", async () => {
    const response = await POST(request({ realm: "r1", contentLength: 1000, file: geojson }).req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ kind: "geojson", filename: "eurth.geojson", width: null });
    expect(body.uploadId).toMatch(/^[0-9a-f]{64}$/);
    expect(body.geojson.suggestedNameProperty).toBe("NAME");
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
});

describe("sniffMapKind", () => {
  it("reads the kind from the bytes, not the name", () => {
    const bytes = (text: string) => new TextEncoder().encode(text);
    expect(sniffMapKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0]))).toBe("png");
    expect(sniffMapKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("png");
    expect(
      sniffMapKind(bytes('<?xml version="1.0"?>\n<!-- map -->\n<svg viewBox="0 0 1 1"/>'))
    ).toBe("svg");
    expect(sniffMapKind(bytes('  {"type":"FeatureCollection"}'))).toBe("geojson");
    expect(sniffMapKind(bytes("GIF89a"))).toBeNull();
  });
});
