/** @jest-environment node */
import { NextRequest } from "next/server";

jest.mock("~/server/db", () => ({
  db: { wikiRevision: { findMany: jest.fn() } },
}));

import { GET } from "~/app/api/wiki/feed/[type]/route";
import { db } from "~/server/db";

const findMany = db.wikiRevision.findMany as jest.Mock;

const revision = (
  id: string,
  overrides: Record<string, string | number | boolean | Date | null> = {}
) => ({
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

const env = process.env as Record<string, string | undefined>;
const ENV_KEYS = ["APP_URL", "NEXT_PUBLIC_APP_URL", "BASE_PATH", "NEXT_PUBLIC_BASE_PATH"] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, env[key]]));

describe("GET /api/wiki/feed/[type]", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete env[key];
      else env[key] = savedEnv[key];
    }
  });
  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([
      revision("rev-1"),
      revision("rev-2", { author: null, summary: null, minor: true, byteDelta: -40 }),
    ]);
  });
  it("escapes markup so the Atom document stays well-formed", async () => {
    findMany.mockResolvedValue([
      revision("rev-1", { summary: 'Fixed <b> & "quotes"', author: "A&B" }),
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
      expect.objectContaining({
        where: { source: "iiwiki", article: { status: "PUBLISHED" } },
        take: 100,
      })
    );

    await get("recent-changes.atom", "?limit=abc");
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { source: "ixwiki", article: { status: "PUBLISHED" } },
        take: 50,
      })
    );
  });

  it("keeps a parked revision (a MediaWiki edit that did not go live) in the feed, flagged", async () => {
    findMany.mockResolvedValue([revision("rev-1", { parked: true }), revision("rev-2")]);

    const atom = await (await get("recent-changes.atom")).text();
    const json = (await (await get("recent-changes.json")).json()) as {
      items: Array<{ title: string; _parked: boolean }>;
    };

    expect(atom.match(/<entry>/g)).toHaveLength(2);
    expect(atom).toContain("<title>Urcea (+120) (overwritten)</title>");
    expect(atom.match(/<category term="parked"/g)).toHaveLength(1);
    expect(json.items.map((item) => item._parked)).toEqual([true, false]);
    expect(json.items[0]?.title).toBe("Urcea (+120) (overwritten)");
    expect(json.items[1]?.title).toBe("Urcea (+120)");
    // The query keeps parked rows: it must not filter them out.
    expect(findMany.mock.calls[0]?.[0].where).not.toHaveProperty("parked");
    expect(findMany.mock.calls[0]?.[0].select).toHaveProperty("parked", true);
  });

  it("entry links are the reader path of the title on the app URL, no ixstats.com anywhere", async () => {
    for (const key of ENV_KEYS) delete env[key];
    env.NEXT_PUBLIC_APP_URL = "https://ixwiki.com/projects/ixstates";
    env.BASE_PATH = "/projects/ixstates";
    findMany.mockResolvedValue([
      revision("rev-9", { createdAt: new Date("2026-10-25T08:00:00.000Z") }),
      { ...revision("rev-8"), article: { title: "Holy See", slug: "holy-see" } },
    ]);

    const atom = await (await get("recent-changes.atom")).text();
    const json = (await (await get("recent-changes.json")).json()) as {
      home_page_url: string;
      items: Array<{ id: string; url: string }>;
    };
    const iiwiki = await (await get("recent-changes.atom", "?realm=iiwiki")).text();

    const app = "https://ixwiki.com/projects/ixstates";
    expect(json.items.map((item) => item.url)).toEqual([
      `${app}/wiki/Urcea`,
      `${app}/wiki/Holy_See`,
    ]);
    expect(json.items[0]?.id).toBe("tag:ixwiki.com,2026-10-25:wiki:rev:rev-9");
    expect(json.home_page_url).toBe(`${app}/wiki/Main_Page`);
    expect(atom).toContain(`<link href="${app}/wiki/Holy_See" />`);
    expect(atom).toContain(`<link href="${app}/wiki/Main_Page" />`);
    expect(atom).toContain(`<id>${app}/wiki/feed/recent-changes</id>`);
    expect(atom).toContain("<id>tag:ixwiki.com,2026-10-25:wiki:rev:rev-9</id>");
    // a sister realm's entries open its pages, with their ?source=
    expect(iiwiki).toContain(`<link href="${app}/wiki/Urcea?source=iiwiki" />`);
    for (const body of [atom, JSON.stringify(json), iiwiki]) {
      expect(body).not.toContain("ixstats.com");
      expect(body).not.toContain("/projects/ixstates/projects/ixstates");
    }
  });
});
