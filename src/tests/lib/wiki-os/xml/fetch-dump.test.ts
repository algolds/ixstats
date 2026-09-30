/** @jest-environment node */
/**
 * Plan 408: building a dump from a live MediaWiki. `fetch` is always a stand-in here: nothing in
 * these tests (or in the code's own tests) ever reaches a real wiki.
 */
import { createExportWriter } from "~/lib/wiki-os/xml/export-writer";
import {
  apiRevisionToXml,
  fetchDump,
  redirectTargetOf,
  type FetchDumpOptions,
} from "~/lib/wiki-os/xml/fetch-dump";
import { readExport, type ImportPage } from "~/lib/wiki-os/xml/import-reader";
import { mwSha1Base36 } from "~/lib/wiki-os/xml/sha1";
import type { XmlRevision } from "~/lib/wiki-os/xml/types";

const API = "https://wiki.example.test/api.php";

interface FakePage {
  pageid: number;
  ns: number;
  title: string;
  redirectTo?: string;
  revisions: Array<Record<string, unknown>>;
}

const apiRevision = (id: number, overrides: Record<string, unknown> = {}) => ({
  revid: id,
  parentid: id - 1,
  minor: false,
  user: "Jane",
  userid: 7,
  timestamp: `2026-01-0${id}T00:00:00Z`,
  size: 5,
  sha1: "da39a3ee5e6b4b0d3255bfef95601890afd80709",
  comment: `edit ${id}`,
  slots: {
    main: { contentmodel: "wikitext", contentformat: "text/x-wiki", content: `text ${id}` },
  },
  ...overrides,
});

/** A stand-in MediaWiki: answers the Action API requests fetch-dump.ts makes. */
function fakeWiki(pages: FakePage[], options: { allPagesChunk?: number } = {}) {
  const requests: URL[] = [];
  const headers: Array<Record<string, string>> = [];
  const methods: string[] = [];
  const chunk = options.allPagesChunk ?? 1000;

  const json = (body: object) => new Response(JSON.stringify(body), { status: 200 });

  async function exportXml(titles: string[]): Promise<Response> {
    let xml = "";
    const writer = createExportWriter((c) => {
      xml += c;
    });
    await writer.start();
    for (const title of titles) {
      const page = pages.find((p) => p.title === title);
      if (!page) continue;
      await writer.page({
        title: page.title,
        ns: page.ns,
        pageId: page.pageid,
        redirectTitle: page.redirectTo ?? null,
        revisions: [
          {
            id: 99,
            parentId: null,
            timestamp: "2026-05-05T00:00:00Z",
            contributor: { username: "Exporter", id: 1 },
            minor: false,
            comment: null,
            model: "wikitext",
            format: "text/x-wiki",
            text: `current text of ${title}`,
          },
        ],
      });
    }
    await writer.end();
    return new Response(xml, { status: 200 });
  }

  const impl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    requests.push(url);
    methods.push(init?.method ?? "GET");
    headers.push(Object.fromEntries(new Headers(init?.headers).entries()));
    const q = url.searchParams;

    if (q.get("meta") === "siteinfo") {
      return json({
        query: {
          general: {
            sitename: "Fake Wiki",
            wikiid: "fakewiki",
            base: "https://wiki.example.test/wiki/Main",
            generator: "MediaWiki 1.45.1",
            case: "first-letter",
          },
          namespaces: {
            "-2": { id: -2, case: "first-letter", name: "Media" },
            "-1": { id: -1, case: "first-letter", name: "Special" },
            "0": { id: 0, case: "first-letter", name: "" },
            "1": { id: 1, case: "first-letter", name: "Talk" },
          },
        },
      });
    }
    if (q.get("list") === "allpages") {
      const ns = Number(q.get("apnamespace"));
      const redirectsOnly = q.get("apfilterredir") === "redirects";
      const all = pages.filter((p) => p.ns === ns && (!redirectsOnly || p.redirectTo));
      const start = Number(q.get("apcontinue") ?? 0);
      const slice = all.slice(start, start + chunk);
      const more = start + chunk < all.length;
      return json({
        ...(more ? { continue: { apcontinue: String(start + chunk), continue: "-||" } } : {}),
        query: { allpages: slice.map(({ pageid, ns: n, title }) => ({ pageid, ns: n, title })) },
      });
    }
    if (q.get("export") === "1") return exportXml((q.get("titles") ?? "").split("|"));
    if (q.get("prop") === "revisions") {
      const titles = (q.get("titles") ?? "").split("|");
      const found = titles.flatMap((t) => pages.filter((p) => p.title === t));
      const start = Number(q.get("rvcontinue") ?? 0);
      const isContent = q.get("rvprop") === "ids|timestamp|content";
      return json({
        query: {
          pages: found.map((p) => {
            const revisions = isContent
              ? [
                  apiRevision(1, {
                    slots: { main: { content: `#REDIRECT [[${p.redirectTo ?? ""}]]` } },
                  }),
                ]
              : p.revisions.slice(start, start + 2);
            return { title: p.title, revisions };
          }),
        },
        ...(!isContent && found[0] && start + 2 < found[0].revisions.length
          ? { continue: { rvcontinue: String(start + 2), continue: "||" } }
          : {}),
      });
    }
    return new Response("unexpected request", { status: 500 });
  };

  return { impl, requests, headers, methods };
}

/** Run fetchDump against `impl` with a fake clock; resolves to what it wrote and how it paced. */
async function run(
  impl: typeof fetch,
  overrides: Partial<FetchDumpOptions> = {}
): Promise<{
  xml: string;
  pages: ImportPage[];
  count: number;
  sleeps: number[];
  stamps: number[];
}> {
  let xml = "";
  let clock = 0;
  const sleeps: number[] = [];
  const stamps: number[] = [];
  const timed: typeof fetch = async (input, init) => {
    stamps.push(clock);
    return impl(input, init);
  };
  const count = await fetchDump({
    api: API,
    write: (c) => {
      xml += c;
    },
    history: false,
    namespaces: "all",
    fetchImpl: timed,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    ...overrides,
  });
  const pages: ImportPage[] = [];
  async function* chunks() {
    yield xml;
  }
  for await (const event of readExport(chunks())) if (event.type === "page") pages.push(event.page);
  return { xml, pages, count, sleeps, stamps };
}

const page = (n: number, ns = 0, extra: Partial<FakePage> = {}): FakePage => ({
  pageid: n,
  ns,
  title: ns === 1 ? `Talk:Page ${n}` : `Page ${n}`,
  revisions: [apiRevision(1), apiRevision(2), apiRevision(3)],
  ...extra,
});

describe("fetchDump: current revisions", () => {
  it("dumps every namespace of the wiki, 50 titles per export request", async () => {
    const wiki = fakeWiki([...Array.from({ length: 120 }, (_, i) => page(i + 1)), page(500, 1)]);

    const { pages, count, xml } = await run(wiki.impl);

    expect(count).toBe(121);
    expect(pages).toHaveLength(121);
    expect(pages.find((p) => p.title === "Page 7")?.revisions[0]?.text).toBe(
      "current text of Page 7"
    );
    expect(pages.find((p) => p.title === "Talk:Page 500")).toMatchObject({ ns: 1, id: 500 });
    expect(xml).toContain("<sitename>Fake Wiki</sitename>");
    const exports = wiki.requests.filter((u) => u.searchParams.get("export") === "1");
    expect(exports.map((u) => (u.searchParams.get("titles") ?? "").split("|").length)).toEqual([
      50, 50, 20, 1,
    ]);
    expect(exports.every((u) => u.searchParams.get("exportnowrap") === "1")).toBe(true);
  });

  it("follows allpages continuation and keeps redirects with their target", async () => {
    const wiki = fakeWiki([page(1), page(2), page(3, 0, { redirectTo: "Page 1" }), page(4)], {
      allPagesChunk: 2,
    });

    const { pages } = await run(wiki.impl, { namespaces: [0] });

    expect(pages.map((p) => p.title).sort()).toEqual(["Page 1", "Page 2", "Page 3", "Page 4"]);
    expect(pages.find((p) => p.title === "Page 3")?.redirectTitle).toBe("Page 1");
  });

  it("asks only for the namespaces it was given", async () => {
    const wiki = fakeWiki([page(1), page(2, 1)]);

    const { pages } = await run(wiki.impl, { namespaces: [1] });

    expect(pages.map((p) => p.title)).toEqual(["Talk:Page 2"]);
    const listed = wiki.requests.filter((u) => u.searchParams.get("list") === "allpages");
    expect(listed.map((u) => u.searchParams.get("apnamespace"))).toEqual(["1"]);
  });

  it("skips the virtual Media and Special namespaces when asked for all", async () => {
    const wiki = fakeWiki([page(1)]);

    await run(wiki.impl);

    const listed = wiki.requests.filter((u) => u.searchParams.get("list") === "allpages");
    expect(listed.map((u) => u.searchParams.get("apnamespace"))).toEqual(["0", "1"]);
  });
});

describe("fetchDump: full history", () => {
  it("writes every revision oldest first, following revision continuation", async () => {
    const wiki = fakeWiki([
      page(1, 0, {
        revisions: [apiRevision(1), apiRevision(2), apiRevision(3), apiRevision(4), apiRevision(5)],
      }),
    ]);

    const { pages } = await run(wiki.impl, { history: true, namespaces: [0] });

    expect(pages[0]?.revisions.map((r) => [r.id, r.parentId, r.text])).toEqual([
      [1, null, "text 1"],
      [2, 1, "text 2"],
      [3, 2, "text 3"],
      [4, 3, "text 4"],
      [5, 4, "text 5"],
    ]);
    const revisionRequests = wiki.requests.filter(
      (u) => u.searchParams.get("rvprop")?.includes("user") ?? false
    );
    expect(revisionRequests).toHaveLength(3);
    expect(revisionRequests[0]?.searchParams.get("rvdir")).toBe("newer");
    expect(revisionRequests[0]?.searchParams.get("rvslots")).toBe("main");
    expect(revisionRequests[0]?.searchParams.get("rvlimit")).toBe("max");
  });

  it("finds a redirect's target from its current wikitext", async () => {
    const wiki = fakeWiki([page(1), page(2, 0, { redirectTo: "Page 1" })]);

    const { pages } = await run(wiki.impl, { history: true, namespaces: [0] });

    expect(pages.find((p) => p.title === "Page 2")?.redirectTitle).toBe("Page 1");
    expect(pages.find((p) => p.title === "Page 1")?.redirectTitle).toBeNull();
  });
});

describe("politeness and safety", () => {
  it("sends only GET requests to the wiki's api.php with the IxStats-Builder agent", async () => {
    const wiki = fakeWiki([page(1), page(2)]);

    await run(wiki.impl, { history: true });

    expect(new Set(wiki.methods)).toEqual(new Set(["GET"]));
    expect(wiki.requests.every((u) => u.origin + u.pathname === API)).toBe(true);
    expect(wiki.headers.every((h) => h["user-agent"] === "IxStats-Builder")).toBe(true);
    expect(wiki.requests.filter((u) => u.searchParams.get("action") !== "query")).toEqual([]);
  });

  it("leaves at least a second between any two requests", async () => {
    const wiki = fakeWiki(Array.from({ length: 5 }, (_, i) => page(i + 1)));

    const { stamps } = await run(wiki.impl, { history: true, namespaces: [0] });

    expect(stamps.length).toBeGreaterThan(5);
    for (let i = 1; i < stamps.length; i++) {
      expect((stamps[i] ?? 0) - (stamps[i - 1] ?? 0)).toBeGreaterThanOrEqual(1000);
    }
  });

  it("refuses an API address that is not http(s)", async () => {
    await expect(run(fakeWiki([]).impl, { api: "file:///etc/passwd" })).rejects.toThrow(/http/);
    await expect(run(fakeWiki([]).impl, { api: "not a url" })).rejects.toThrow();
  });
});

describe("failures", () => {
  it("retries a rate-limited request after the wait the wiki asks for", async () => {
    const wiki = fakeWiki([page(1)]);
    let first = true;
    const flaky: typeof fetch = async (input, init) => {
      if (first) {
        first = false;
        return new Response("slow down", { status: 429, headers: { "retry-after": "7" } });
      }
      return wiki.impl(input, init);
    };

    const { pages, sleeps } = await run(flaky, { namespaces: [0] });

    expect(pages).toHaveLength(1);
    expect(sleeps).toContain(7000);
  });

  it("retries a server error with growing waits, then gives up", async () => {
    let calls = 0;
    const down: typeof fetch = async () => {
      calls += 1;
      return new Response("oops", { status: 503 });
    };

    await expect(run(down)).rejects.toThrow(/HTTP 503/);
    expect(calls).toBe(4);
  });

  it("does not retry a client error", async () => {
    let calls = 0;
    const denied: typeof fetch = async () => {
      calls += 1;
      return new Response("forbidden", { status: 403 });
    };

    await expect(run(denied)).rejects.toThrow(/HTTP 403/);
    expect(calls).toBe(1);
  });

  it("retries a dropped connection", async () => {
    const wiki = fakeWiki([page(1)]);
    let first = true;
    const dropped: typeof fetch = async (input, init) => {
      if (first) {
        first = false;
        throw new TypeError("fetch failed");
      }
      return wiki.impl(input, init);
    };

    const { pages } = await run(dropped, { namespaces: [0] });

    expect(pages).toHaveLength(1);
  });

  it("rejects an answer that is not what the API documents", async () => {
    const odd: typeof fetch = async () =>
      new Response(JSON.stringify({ query: {} }), { status: 200 });

    await expect(run(odd)).rejects.toThrow();
  });
});

describe("apiRevisionToXml", () => {
  it("maps an anonymous edit, a hex hash and the size", () => {
    const revision = apiRevisionToXml(
      apiRevision(3, { anon: true, user: "192.0.2.5", userid: 0, minor: true, size: 12 }) as never
    );

    expect(revision).toMatchObject({
      id: 3,
      parentId: 2,
      contributor: { ip: "192.0.2.5" },
      minor: true,
      bytes: 12,
      sha1: "phoiac9h4m842xq45sp7s6u21eteeq1",
    });
  });

  it("maps hidden user, summary and text to their hidden forms", () => {
    const revision = apiRevisionToXml(
      apiRevision(1, {
        parentid: 0,
        userhidden: true,
        commenthidden: true,
        slots: { main: { texthidden: true } },
      }) as never
    );

    expect(revision).toMatchObject({
      parentId: null,
      contributor: { deleted: true },
      comment: null,
      text: null,
    });
  });

  it("keeps a real account's id and text and the page's model", () => {
    const revision: XmlRevision = apiRevisionToXml(apiRevision(2) as never);

    expect(revision).toMatchObject({
      contributor: { username: "Jane", id: 7 },
      comment: "edit 2",
      text: "text 2",
      model: "wikitext",
      format: "text/x-wiki",
    });
    expect(mwSha1Base36("")).toBe(revision.sha1);
  });
});

describe("redirectTargetOf", () => {
  it.each([
    ["#REDIRECT [[Foo]]", "Foo"],
    ["#redirect [[Foo bar#Section|label]]", "Foo bar"],
    ["  #REDIRECT: [[:Category:Foo]]\n[[Category:Redirects]]", "Category:Foo"],
    ["Not a redirect [[Foo]]", null],
    ["", null],
  ])("%j -> %j", (text, expected) => {
    expect(redirectTargetOf(text)).toBe(expected);
  });
});
