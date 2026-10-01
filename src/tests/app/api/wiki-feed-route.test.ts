/** @jest-environment node */
import { NextRequest } from "next/server";

jest.mock("~/server/db", () => ({
  db: { wikiRevision: { findMany: jest.fn() } },
}));

import { GET } from "~/app/api/wiki/feed/[type]/route";
import { db } from "~/server/db";

const findMany = db.wikiRevision.findMany as jest.Mock;

const revision = (id: string, overrides: Record<string, string | number | boolean | null> = {}) => ({
  id,
  author: "Aurelian",
  summary: "Expanded history section",
  minor: false,
  byteDelta: 120,
  createdAt: new Date("2026-09-20T12:00:00.000Z"),
  article: { title: "Urcea", slug: "Urcea" },
  ...overrides,
});

const get = (type: string, query = "") =>
  GET(new NextRequest(`http://localhost:3000/api/wiki/feed/${type}${query}`), {
    params: Promise.resolve({ type }),
  });

describe("GET /api/wiki/feed/[type]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([
      revision("rev-1"),
      revision("rev-2", { author: null, summary: null, minor: true, byteDelta: -40 }),
    ]);
  });

  it("returns an Atom feed with one entry per recent revision", async () => {
    const res = await get("recent-changes.atom");
    const xml = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/atom+xml");
    expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(true);
    expect(xml.match(/<entry>/g)).toHaveLength(2);
    expect(xml).toContain("<title>Urcea (+120)</title>");
    expect(xml).toContain("<title>Urcea (-40)</title>");
    expect(xml).toContain('<link href="https://ixstats.com/wiki/Urcea" />');
    expect(xml).toContain("<name>Aurelian</name>");
    expect(xml).toContain("<summary>Minor edit</summary>");
    expect(xml).toContain("<name>WikiOS Contributor</name>");
    expect(xml).toContain("<updated>2026-09-20T12:00:00.000Z</updated>");
  });

  it("escapes markup so the Atom document stays well-formed", async () => {
    findMany.mockResolvedValue([
      revision("rev-1", { summary: "Fixed <b> & \"quotes\"", author: "A&B" }),
    ]);
    const res = await get("recent-changes.atom", "?limit=5&realm=ixwiki");
    const xml = await res.text();

    expect(xml).toContain("<summary>Fixed &lt;b&gt; &amp; &quot;quotes&quot;</summary>");
    expect(xml).toContain("<name>A&amp;B</name>");
    expect(xml).toContain("limit=5&amp;realm=ixwiki");
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it("returns a JSON Feed for the .json variant", async () => {
    const res = await get("recent-changes.json");
    const body = (await res.json()) as {
      version: string;
      items: Array<{ id: string; url: string; authors: Array<{ name: string }> }>;
    };

    expect(body.version).toBe("https://jsonfeed.org/version/1.1");
    expect(body.items).toHaveLength(2);
    expect(body.items[0]?.id).toBe("tag:ixstats.com,2026-09-20:wiki:rev:rev-1");
    expect(body.items[0]?.url).toBe("https://ixstats.com/wiki/Urcea");
    expect(body.items[0]?.authors).toEqual([{ name: "Aurelian" }]);
  });

  it("filters by realm and clamps the limit", async () => {
    await get("recent-changes.atom", "?limit=500&realm=iiwiki");
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { source: "iiwiki", article: { status: "PUBLISHED" } }, take: 100 })
    );

    await get("recent-changes.atom", "?limit=abc");
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { source: "ixwiki", article: { status: "PUBLISHED" } }, take: 50 })
    );
  });
});
