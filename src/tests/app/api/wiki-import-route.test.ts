/** @jest-environment node */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { resetStore, store } from "../../lib/wiki-os/xml/fake-wiki-db";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("~/lib/auth", () => ({ isSystemOwner: jest.fn() }));
jest.mock("~/server/db", () => {
  const fake = jest.requireActual("../../lib/wiki-os/xml/fake-wiki-db").createFakeDbModule();
  return { db: fake.db };
});
jest.mock("~/lib/wiki-os/core/link-graph-service", () => ({
  LinkGraphService: { syncArticleLinks: jest.fn().mockResolvedValue(0) },
}));
jest.mock("~/lib/wiki-os/core/media-asset-service", () => ({
  MediaAssetService: { processContentImages: jest.fn().mockResolvedValue(undefined) },
}));

import { auth } from "@clerk/nextjs/server";
import { GET, POST } from "~/app/api/wiki/import/route";
import { isSystemOwner } from "~/lib/auth";

const mockAuth = jest.mocked(auth) as unknown as jest.Mock;
const mockIsOwner = jest.mocked(isSystemOwner);

const FIXTURE = readFileSync(
  join(__dirname, "../../fixtures/xml/mediawiki-export-0.11.xml"),
  "utf8"
);

function upload(fields: Record<string, string | File>, headers: Record<string, string> = {}) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  return new NextRequest("http://localhost:3000/api/wiki/import", {
    method: "POST",
    body: form,
    headers,
  });
}
const dump = (xml = FIXTURE) => new File([xml], "dump.xml", { type: "application/xml" });

beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
  mockAuth.mockResolvedValue({ userId: "user_admin" });
  mockIsOwner.mockReturnValue(true);
});

describe("GET /api/wiki/import (may this caller import?)", () => {
  it("is 200 for a wiki admin, 403 for a signed-in user, 401 when signed out", async () => {
    expect((await GET()).status).toBe(200);

    mockIsOwner.mockReturnValue(false);
    expect((await GET()).status).toBe(403);

    mockAuth.mockResolvedValue({ userId: null });
    expect((await GET()).status).toBe(401);
  });
});

describe("POST /api/wiki/import", () => {
  it("rejects a signed-out caller with 401, before reading the upload", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const res = await POST(upload({ xml: dump() }));

    expect(res.status).toBe(401);
    expect(store.articles).toHaveLength(0);
  });

  it("rejects a signed-in caller who is not a wiki admin with 403, importing nothing", async () => {
    mockIsOwner.mockReturnValue(false);

    const res = await POST(upload({ xml: dump() }));

    expect(res.status).toBe(403);
    expect(mockIsOwner).toHaveBeenCalledWith("user_admin");
    expect(store.articles).toHaveLength(0);
    expect(store.writes).toBe(0);
  });

  it("imports the uploaded dump for an admin and returns the summary", async () => {
    const res = await POST(upload({ xml: dump(), dryRun: "0" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      dryRun: false,
      pages: 5,
      pagesCreated: 5,
      revisionsImported: 7,
      revisionsSkipped: 0,
      placeholdersFilled: 0,
      uploadsSkipped: 1,
      errors: [],
      warnings: [],
      errorCount: 0,
    });
    expect(store.articles).toHaveLength(5);
    expect(store.revisions).toHaveLength(7);
  });

  it("with dryRun reports the same summary and writes nothing", async () => {
    const res = await POST(upload({ xml: dump(), dryRun: "1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ dryRun: true, pages: 5, pagesCreated: 5, revisionsImported: 7 });
    expect(store.writes).toBe(0);
    expect(store.articles).toHaveLength(0);
  });

  it("answers a second upload of the same dump with everything skipped", async () => {
    await POST(upload({ xml: dump() }));

    const body = await (await POST(upload({ xml: dump() }))).json();

    expect(body).toMatchObject({ pagesCreated: 0, revisionsImported: 0, revisionsSkipped: 7 });
  });

  it("reports a dump that is not an export as a summary error, not a server error", async () => {
    const res = await POST(upload({ xml: dump("<html/>") }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.errorCount).toBe(1);
    expect(body.errors[0]).toMatchObject({ title: "(dump)" });
  });

  it("caps the errors it echoes back but reports how many there were", async () => {
    const page = (n: number) =>
      `<page><title>Bad|${n}</title><ns>0</ns><revision><timestamp>2026-01-01T00:00:00Z</timestamp><text>x</text></revision></page>`;
    const xml = `<mediawiki>${Array.from({ length: 250 }, (_, i) => page(i)).join("")}</mediawiki>`;

    const body = await (await POST(upload({ xml: dump(xml) }))).json();

    expect(body.errorCount).toBe(250);
    expect(body.errors).toHaveLength(200);
  });

  it("requires the file in the form field xml", async () => {
    expect((await POST(upload({ other: dump() }))).status).toBe(400);
    expect((await POST(upload({ xml: "just text" }))).status).toBe(400);
  });

  it("refuses an oversized body from its Content-Length, without reading it", async () => {
    const res = await POST(
      upload({ xml: dump() }, { "content-length": String(200 * 1024 * 1024) })
    );

    expect(res.status).toBe(413);
    expect(store.articles).toHaveLength(0);
  });
});
