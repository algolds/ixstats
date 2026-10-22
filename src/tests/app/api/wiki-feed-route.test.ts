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
  parked: false,
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

  it("keeps a parked revision (a MediaWiki edit that did not go live) in the feed, flagged", async () => {
    findMany.mockResolvedValue([revision("rev-1", { parked: true }), revision("rev-2")]);

    const atom = await (await get("recent-changes.atom")).text();
    const json = (await (await get("recent-changes.json")).json()) as {
      items: Array<{ title: string; _parked: boolean }>;
    };

    expect(atom.match(/<entry>/g)).toHaveLength(2);
    expect(atom).toContain("<title>Urcea (+120) — conflict — not live</title>");
    expect(atom.match(/<category term="parked"/g)).toHaveLength(1);
    expect(json.items.map((item) => item._parked)).toEqual([true, false]);
    expect(json.items[0]?.title).toBe("Urcea (+120) — conflict — not live");
    expect(json.items[1]?.title).toBe("Urcea (+120)");
    // The query keeps parked rows: it must not filter them out.
    expect(findMany.mock.calls[0]?.[0].where).not.toHaveProperty("parked");
    expect(findMany.mock.calls[0]?.[0].select).toHaveProperty("parked", true);
  });
});
