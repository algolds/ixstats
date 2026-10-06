/** @jest-environment node */
/**
 * Plan 410: the limits that keep one request's cost bounded (edit sizes, summaries, NUL, value
 * lists, search, response size, revision history) and the behaviours the review asked for
 * (blank pages, section edit summaries, log ids, malformed continuations).
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import {
  call,
  fakeSha1Hex,
  fakeWiki,
  loggedIn,
  makeDeps,
  makeWikiDeps,
  type FakeWikiData,
} from "./harness";
import { createHash } from "node:crypto";
import { MAX_RESULT_BYTES } from "~/lib/wiki-os/api-compat/budget";

type Body = Record<string, any>;

const SECTIONED = [
  "Lead text.",
  "",
  "== One ==",
  "one body",
  "",
  "=== One A ===",
  "a body",
  "",
  "== Two ==",
  "two body",
].join("\n");
const BIG = 1_500_000;

const wikiData = (): FakeWikiData => ({
  pages: [
    { pageId: 1, title: "Existing" },
    { pageId: 2, title: "Sections" },
    { pageId: 3, title: "Big" },
    { pageId: 4, title: "Blank" },
  ],
  revisions: [
    {
      revId: 101,
      page: "Existing",
      timestamp: "2026-01-01T10:00:00Z",
      user: "Heku",
      content: "Hello world",
    },
    {
      revId: 201,
      page: "Sections",
      timestamp: "2026-01-03T10:00:00Z",
      user: "Heku",
      content: SECTIONED,
    },
    {
      revId: 301,
      page: "Big",
      timestamp: "2026-01-04T10:00:00Z",
      user: "Heku",
      content: `Lead\n== S ==\n${"x".repeat(BIG)}`,
    },
    {
      revId: 401,
      page: "Blank",
      timestamp: "2026-01-05T10:00:00Z",
      user: "Heku",
      content: "was text",
    },
    { revId: 402, page: "Blank", timestamp: "2026-01-06T10:00:00Z", user: "Vandal", content: "" },
  ],
  logs: [
    {
      logId: 55,
      type: "delete",
      action: "delete",
      title: "Existing",
      actor: "Heku",
      timestamp: "2026-09-30T12:00:00Z",
    },
    {
      logId: 56,
      type: "move",
      action: "move",
      title: "Moved",
      actor: "Heku",
      timestamp: "2026-09-30T12:00:00Z",
    },
  ],
});

async function setup(data = wikiData()) {
  const wiki = await makeWikiDeps(data);
  const token = await loggedIn(wiki.bot);
  const act = (params: Record<string, string>) =>
    wiki.bot.post({ token, formatversion: "2", ...params }) as Promise<Body>;
  const saves = () => wiki.calls.filter((c) => c.name === "saveWikitext");
  return { ...wiki, token, act, saves };
}

describe("edit sizes", () => {
  it("accepts a page of exactly 2,000,000 characters and refuses one character more with toobig", async () => {
    const { act, saves } = await setup();
    expect(
      (await act({ action: "edit", title: "New", text: "x".repeat(2_000_001) })).error.code
    ).toBe("toobig");
    expect(saves()).toHaveLength(0);
    expect(
      (await act({ action: "edit", title: "New", text: "x".repeat(2_000_000) })).edit.result
    ).toBe("Success");
    expect(saves()).toHaveLength(1);
  });

  it("applies the limit to appendtext and prependtext, and to what they make together with the page", async () => {
    const { act, saves } = await setup();
    expect(
      (await act({ action: "edit", title: "Big", appendtext: "y".repeat(2_000_001) })).error.code
    ).toBe("toobig");
    expect(
      (await act({ action: "edit", title: "Big", prependtext: "y".repeat(2_000_001) })).error.code
    ).toBe("toobig");
    const together = await act({ action: "edit", title: "Big", appendtext: "y".repeat(600_000) });
    expect(together.error.code).toBe("toobig");
    expect(together.error.info).toContain("longer than");
    expect(saves()).toHaveLength(0);
  });

  it("applies the limit to a section edit and to a new section, after the text is assembled", async () => {
    const { act, saves } = await setup();
    expect(
      (await act({ action: "edit", title: "Big", section: "1", text: "z".repeat(2_000_001) })).error
        .code
    ).toBe("toobig");
    expect(
      (await act({ action: "edit", title: "Big", section: "0", text: "y".repeat(600_000) })).error
        .code
    ).toBe("toobig");
    expect(
      (
        await act({
          action: "edit",
          title: "Big",
          section: "new",
          sectiontitle: "t",
          text: "y".repeat(600_000),
        })
      ).error.code
    ).toBe("toobig");
    expect(
      (
        await act({
          action: "edit",
          title: "Big",
          section: "new",
          sectiontitle: "t".repeat(2_000_001),
          text: "y",
        })
      ).error.code
    ).toBe("toobig");
    expect(saves()).toHaveLength(0);
  });

  it("refuses a NUL in any text with a clean error, never an internal one", async () => {
    const { act, saves } = await setup();
    for (const params of [
      { text: "a\u0000b" },
      { appendtext: "a\u0000" },
      { prependtext: "\u0000" },
      { section: "new", sectiontitle: "t\u0000", text: "x" },
    ] as Record<string, string>[]) {
      const body = await act({ action: "edit", title: "Existing", ...params });
      expect(body.error.code).toBe("invalidtext");
      expect(body.error.code).not.toBe("internal_api_error");
    }
    expect(saves()).toHaveLength(0);
  });

  it("truncates a summary to 500 characters and drops NUL from it", async () => {
    const { act, saves } = await setup();
    await act({ action: "edit", title: "Existing", text: "one", summary: "s".repeat(900) });
    await act({ action: "edit", title: "Existing", text: "two", summary: "a\u0000b" });
    await act({
      action: "edit",
      title: "Existing",
      text: "three",
      summary: `${"s".repeat(499)}😀`,
    });
    const summaries = saves().map((c) => (c.args[1] as { summary: string }).summary);
    expect(summaries[0]).toBe("s".repeat(500));
    expect(summaries[1]).toBe("ab");
    expect(summaries[2]).toBe("s".repeat(499)); // never half of a surrogate pair
  });

  it("cuts a log reason the same way", async () => {
    const { act, calls } = await setup();
    await act({ action: "delete", title: "Existing", reason: `${"r".repeat(700)}\u0000` });
    expect(calls.find((c) => c.name === "archivePage")!.args[1] as string).toBe("r".repeat(500));
  });
});

describe("section edits", () => {
  it("puts MediaWiki's /* heading */ marker in front of the summary", async () => {
    const summaryOf = async (params: Record<string, string>) => {
      const { act, saves } = await setup();
      await act({ action: "edit", title: "Sections", ...params });
      return (saves()[0]!.args[1] as { summary: string }).summary;
    };
    expect(await summaryOf({ section: "1", text: "== One ==\nnew", summary: "why" })).toBe(
      "/* One */ why"
    );
    expect(await summaryOf({ section: "2", text: "=== One A ===\nnewer" })).toBe("/* One A */");
    expect(await summaryOf({ section: "0", text: "New lead.", summary: "lead" })).toBe("lead");
  });

  it("adds no blank line when text is appended to a section", async () => {
    const { act, saves } = await setup();
    await act({ action: "edit", title: "Sections", section: "3", appendtext: "\nthree body" });
    await act({ action: "edit", title: "Sections", section: "2", appendtext: "\nmore a" });
    const [last, middle] = saves()
      .map((c) => (c.args[1] as { wikitext: string }).wikitext)
      .reverse();
    expect(middle).toBe(SECTIONED.replace("two body", "two body\nthree body"));
    expect(last).toContain("a body\nmore a\n\n== Two ==");
    expect(middle).not.toContain("two body\n\nthree body");
  });
});

describe("log ids", () => {
  it("answers the logid of the delete and of the move it just made", async () => {
    const { act } = await setup();
    expect((await act({ action: "delete", title: "Existing" })).delete.logid).toBe(55);
    const moved = await act({ action: "move", from: "Existing", to: "Moved" });
    expect(moved.move.logid).toBe(56);
  });
});

describe("blank pages are pages", () => {
  it("shows a blanked page in prop=info and prop=revisions", async () => {
    const wiki = await makeWikiDeps(wikiData());
    const body = (
      await call(
        wiki.deps,
        "action=query&titles=Blank&prop=info|revisions&rvprop=ids|size|content&rvslots=main&formatversion=2"
      )
    ).body as Body;
    const [page] = body.query.pages;
    expect(page.missing).toBeUndefined();
    expect(page).toMatchObject({ pageid: 4, title: "Blank", length: 0 });
    expect(page.revisions[0].slots.main.content).toBe("");
  });

  it("lets nocreate edit it and refuses createonly with articleexists", async () => {
    const { act, saves } = await setup();
    expect(
      (await act({ action: "edit", title: "Blank", text: "back again", nocreate: "1" })).edit.result
    ).toBe("Success");
    expect(
      (await act({ action: "edit", title: "Blank", text: "x", createonly: "1" })).error.code
    ).toBe("articleexists");
    expect(saves()).toHaveLength(1);
  });

  it("rolls back a blanking: the last revision by someone else is restored", async () => {
    const wiki = await makeWikiDeps(wikiData());
    const token = await loggedIn(wiki.bot, "rollback");
    const body = (await wiki.bot.post({
      action: "rollback",
      title: "Blank",
      user: "Vandal",
      token,
      formatversion: "2",
    })) as Body;
    expect(body.error).toBeUndefined();
    expect(body.rollback).toMatchObject({ title: "Blank", old_revid: 402, last_revid: 401 });
    const save = wiki.calls.find((c) => c.name === "saveWikitext")!.args[1] as { wikitext: string };
    expect(save.wikitext).toBe("was text");
  });
});

describe("prop=revisions of one page", () => {
  const history = (): FakeWikiData => ({
    pages: [{ pageId: 1, title: "Busy" }],
    revisions: Array.from({ length: 12 }, (_, i) => ({
      revId: 100 + i,
      page: "Busy",
      timestamp: `2026-01-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
      user: i % 2 ? "Heku" : "Tester",
      content: `v${i}`,
    })),
  });
  const run = async (params: string) =>
    (
      await call(
        await makeDeps({ store: fakeWiki(history()) }),
        `action=query&titles=Busy&prop=revisions&rvprop=ids&${params}&formatversion=2`
      )
    ).body as Body;

  it("answers the latest revision only, with no continuation, by default", async () => {
    const body = await run("");
    expect(body.query.pages[0].revisions.map((r: Body) => r.revid)).toEqual([111]);
    expect(body.continue).toBeUndefined();
  });

  it.each([
    "rvlimit=5",
    "rvdir=newer",
    "rvstartid=105",
    "rvendid=103",
    "rvuser=Heku",
    "rvexcludeuser=Heku",
    "rvstart=2026-01-10T00:00:00Z",
    "rvend=2026-01-02T00:00:00Z",
  ])("pages through the history when %s is given", async (param) => {
    const body = await run(param);
    expect(body.query.pages[0].revisions.length).toBeGreaterThanOrEqual(1);
    if (param === "rvlimit=5") {
      expect(body.query.pages[0].revisions).toHaveLength(5);
      expect(body.continue.rvcontinue).toBeDefined();
    }
    if (param === "rvdir=newer") expect(body.query.pages[0].revisions[0].revid).toBe(100);
  });

  it("normalizes rvuser and rvexcludeuser like a user name (underscores, first letter)", async () => {
    const data = history();
    data.revisions![3]!.user = "Some user";
    const seen: Array<{ users?: string[]; excludeUser?: string }> = [];
    const store = fakeWiki(data);
    const findRevisions = store.findRevisions.bind(store);
    store.findRevisions = (query) => (
      seen.push({
        users: query.users ? [...query.users] : undefined,
        excludeUser: query.excludeUser,
      }),
      findRevisions(query)
    );
    const deps = await makeDeps({ store });
    await call(
      deps,
      "action=query&titles=Busy&prop=revisions&rvprop=ids&rvlimit=max&rvuser=some_user&formatversion=2"
    );
    await call(
      deps,
      "action=query&titles=Busy&prop=revisions&rvprop=ids&rvlimit=max&rvexcludeuser=some_user&formatversion=2"
    );
    expect(seen[0]!.users).toEqual(["Some user"]);
    expect(seen[1]!.excludeUser).toBe("Some user");
  });

  it("takes only the first of several rvlimit=1 pages: the continuation then leads on", async () => {
    const first = await run("rvlimit=1");
    expect(first.query.pages[0].revisions).toHaveLength(1);
    const second = await run(
      `rvlimit=1&rvcontinue=${encodeURIComponent(first.continue.rvcontinue)}`
    );
    expect(second.query.pages[0].revisions[0].revid).toBe(110);
  });
});

describe("rvprop=sha1 on legacy revisions with no stored hash", () => {
  const sha1HexOf = (text: string) => createHash("sha1").update(text, "utf8").digest("hex");
  const legacyWiki = (): FakeWikiData => ({
    pages: [
      { pageId: 1, title: "Old" },
      { pageId: 2, title: "Other" },
    ],
    revisions: [
      ...Array.from({ length: 25 }, (_, i) => ({
        revId: 100 + i,
        page: "Old",
        timestamp: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
        user: "Heku",
        content: `text ${i}`,
        // 12 legacy rows (no stored hash), the others carry one; revision 104 is a legacy row whose text is deleted
        legacy: i % 2 === 0 && i < 24,
        textHidden: i === 4,
      })),
      {
        revId: 900,
        page: "Other",
        timestamp: "2026-02-01T00:00:00Z",
        content: "other text",
        legacy: true,
      },
    ],
  });
  const spied = async () => {
    const store = fakeWiki(legacyWiki());
    const spy = jest.spyOn(store, "revisionHashes");
    return { deps: await makeDeps({ store }), spy };
  };

  it("hashes the text of those revisions only, ten at a time, and answers a 40-digit hash for each live one", async () => {
    const { deps, spy } = await spied();
    const body = (
      await call(
        deps,
        "action=query&titles=Old&prop=revisions&rvprop=ids|sha1&rvlimit=max&formatversion=2"
      )
    ).body as Body;
    const revisions = body.query.pages[0].revisions as Body[];
    expect(revisions).toHaveLength(25);
    for (const rev of revisions) {
      const index = rev.revid - 100;
      if (index === 4)
        expect(rev).toMatchObject({ sha1hidden: true }); // text deleted: no hash to give
      else if (index % 2 === 0 && index < 24)
        expect(rev.sha1).toBe(sha1HexOf(`text ${index}`)); // computed
      else expect(rev.sha1).toMatch(/^[0-9a-f]{40}$/); // stored
    }
    // 12 legacy rows, one of them hidden: the 11 live ones in two batches, no other revision read
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls.map(([ids]) => ids.length)).toEqual([10, 1]);
    expect(
      spy.mock.calls.flatMap(([ids]) => ids).every((id) => (id - 100) % 2 === 0 && id !== 104)
    ).toBe(true);
  });

  it("gives slotsha1 the same, and reads nothing when no hash was asked for", async () => {
    const { deps, spy } = await spied();
    const slots = (
      await call(
        deps,
        "action=query&titles=Old&prop=revisions&rvprop=ids|slotsha1&rvslots=main&rvlimit=3&formatversion=2"
      )
    ).body as Body;
    // newest first: 124 carries a stored hash, 123 too, 122 is a legacy row
    expect(slots.query.pages[0].revisions.map((rev: Body) => rev.slots.main.sha1)).toEqual([
      expect.stringMatching(/^[0-9a-f]{40}$/),
      expect.stringMatching(/^[0-9a-f]{40}$/),
      sha1HexOf("text 22"),
    ]);
    spy.mockClear();
    await call(
      deps,
      "action=query&titles=Old&prop=revisions&rvprop=ids|size|user&rvlimit=max&formatversion=2"
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("covers several pages and revids, and never asks for a revision that already has its hash", async () => {
    const { deps, spy } = await spied();
    const body = (
      await call(
        deps,
        "action=query&titles=Old|Other&prop=revisions&rvprop=ids|sha1&formatversion=2"
      )
    ).body as Body;
    expect(body.query.pages.map((page: Body) => page.revisions[0].sha1)).toEqual([
      expect.stringMatching(/^[0-9a-f]{40}$/),
      sha1HexOf("other text"),
    ]);
    expect(spy.mock.calls.flatMap(([ids]) => ids)).toEqual([900]); // Old's newest revision (124) carries a stored hash
    spy.mockClear();
    const byId = (
      await call(deps, "action=query&revids=100|101&prop=revisions&rvprop=ids|sha1&formatversion=2")
    ).body as Body;
    expect(byId.query.pages[0].revisions.map((rev: Body) => rev.sha1)).toEqual([
      sha1HexOf("text 0"),
      expect.stringMatching(/^[0-9a-f]{40}$/),
    ]);
    expect(spy.mock.calls.flatMap(([ids]) => ids)).toEqual([100]);
  });
});

describe("value lists", () => {
  it("counts a repeated module once: list=allpages|allpages runs it once", async () => {
    const store = fakeWiki(wikiData());
    const spy = jest.spyOn(store, "listPages");
    const deps = await makeDeps({ store });
    const body = (
      await call(deps, "action=query&list=allpages|allpages|allpages&aplimit=2&formatversion=2")
    ).body as Body;
    expect(spy).toHaveBeenCalledTimes(1);
    expect(body.query.allpages).toHaveLength(2);
    expect(body.warnings).toBeUndefined();
  });

  it("dedupes siprop, uiprop and rvprop values, and gives the same answer as one of each", async () => {
    const deps = await makeDeps({ store: fakeWiki(wikiData()) });
    const once = (await call(deps, "action=query&meta=siteinfo&siprop=general&formatversion=2"))
      .body;
    const twice = (
      await call(deps, "action=query&meta=siteinfo&siprop=general|general&formatversion=2")
    ).body;
    expect(twice).toEqual(once);
    const info = (
      await call(deps, "action=query&meta=userinfo&uiprop=rights|rights|groups&formatversion=2")
    ).body as Body;
    expect(info.query.userinfo.rights).toEqual(expect.any(Array));
    const revs = (
      await call(
        deps,
        "action=query&titles=Existing&prop=revisions&rvprop=ids|ids|ids&formatversion=2"
      )
    ).body as Body;
    expect(revs.query.pages[0].revisions[0].revid).toBe(101);
  });

  it.each([
    ["list", "list"],
    ["meta", "meta"],
    ["prop", "prop"],
    ["siprop", "meta=siteinfo&siprop"],
    ["uiprop", "meta=userinfo&uiprop"],
    ["rvprop", "titles=Existing&prop=revisions&rvprop"],
  ])("refuses more than 50 values in %s with toomanyvalues", async (_name, param) => {
    const deps = await makeDeps({ store: fakeWiki(wikiData()) });
    const many = Array.from({ length: 51 }, (_, i) => `v${i}`).join("|");
    const body = (await call(deps, `action=query&${param}=${many}&formatversion=2`)).body as Body;
    expect(body.error.code).toBe("toomanyvalues");
    // fifty distinct values are not too many (they are unknown, which is another error)
    const fifty = Array.from({ length: 50 }, (_, i) => `v${i}`).join("|");
    const ok = (await call(deps, `action=query&${param}=${fifty}&formatversion=2`)).body as Body;
    expect(ok.error.code).not.toBe("toomanyvalues");
  });
});

describe("search limits", () => {
  const search = async (params: string, hits = 0) => {
    const seen: unknown[][] = [];
    const deps = await makeDeps({
      store: fakeWiki(wikiData()),
      search: async (...args) => {
        seen.push(args);
        return {
          hits: Array.from({ length: hits }, (_, i) => ({ title: `T${i}`, snippet: "" })),
          total: hits,
        };
      },
    });
    const body = (await call(deps, `action=query&list=search&${params}&formatversion=2`))
      .body as Body;
    return { body, seen };
  };

  it("refuses srsearch over 300 characters or 32 words with toobig, before searching", async () => {
    const long = await search(`srsearch=${"a".repeat(301)}`);
    expect(long.body.error.code).toBe("toobig");
    const words = await search(`srsearch=${Array.from({ length: 33 }, () => "w").join("+")}`);
    expect(words.body.error.code).toBe("toobig");
    expect(long.seen).toHaveLength(0);
    expect(words.seen).toHaveLength(0);
    expect((await search(`srsearch=${"a".repeat(300)}`)).body.error).toBeUndefined();
    expect(
      (await search(`srsearch=${Array.from({ length: 32 }, () => "w").join("+")}`)).body.error
    ).toBeUndefined();
  });

  it("refuses sroffset past 10,000 with badvalue, and accepts 10,000", async () => {
    const past = await search("srsearch=x&sroffset=10001");
    expect(past.body.error.code).toBe("badvalue");
    expect(past.seen).toHaveLength(0);
    expect((await search("srsearch=x&sroffset=10000")).body.error).toBeUndefined();
  });

  it("opensearch refuses an over-long search too", async () => {
    const deps = await makeDeps({ store: fakeWiki(wikiData()) });
    expect(
      (
        (await call(deps, `action=opensearch&search=${"a".repeat(301)}&formatversion=2`))
          .body as Body
      ).error.code
    ).toBe("toobig");
  });
});

describe("response size", () => {
  const MB = 1024 * 1024;
  const heavy = (): FakeWikiData => ({
    pages: Array.from({ length: 6 }, (_, i) => ({ pageId: i + 1, title: `Heavy ${i}` })),
    revisions: Array.from({ length: 6 }, (_, i) => ({
      revId: 1000 + i,
      page: `Heavy ${i}`,
      timestamp: "2026-01-01T00:00:00Z",
      user: "Heku",
      content: "h".repeat(2 * MB),
    })),
  });
  const titles = Array.from({ length: 6 }, (_, i) => `Heavy ${i}`).join("|");

  it("stops adding page content past 8 MB: a continue and a warning, then the rest on the next request", async () => {
    const deps = await makeDeps({ store: fakeWiki(heavy()) });
    const first = (
      await call(
        deps,
        `action=query&titles=${titles}&prop=revisions&rvprop=ids|content&rvslots=main&formatversion=2`
      )
    ).body as Body;
    const withContent = first.query.pages.filter((page: Body) => page.revisions?.length);
    expect(withContent.length).toBeGreaterThan(0);
    expect(withContent.length).toBeLessThan(6);
    expect(JSON.stringify(first).length).toBeLessThan(MAX_RESULT_BYTES + 100_000);
    expect(first.continue.rvcontinue).toBeDefined();
    expect(JSON.stringify(first.warnings)).toContain("limit of 8,388,608 bytes");

    const second = (
      await call(
        deps,
        `action=query&titles=${titles}&prop=revisions&rvprop=ids|content&rvslots=main&rvcontinue=${encodeURIComponent(first.continue.rvcontinue)}&formatversion=2`
      )
    ).body as Body;
    const got = new Set(
      [...withContent, ...second.query.pages.filter((p: Body) => p.revisions?.length)].map(
        (p: Body) => p.title
      )
    );
    expect(got.size).toBeGreaterThan(withContent.length);
  });

  it("takes the budget revision by revision: revids of 50 big revisions of ONE page come in several responses", async () => {
    const text = "h".repeat(1_800_000);
    const ids = Array.from({ length: 50 }, (_, i) => 5000 + i);
    const deps = await makeDeps({
      store: fakeWiki({
        pages: [{ pageId: 1, title: "Multi" }],
        revisions: ids.map((revId, i) => ({
          revId,
          page: "Multi",
          timestamp: `2026-02-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
          user: "Heku",
          content: text,
        })),
      }),
    });
    const seen: number[] = [];
    let continueWith = "";
    let requests = 0;
    do {
      const query = `action=query&revids=${ids.join("|")}&prop=revisions&rvprop=ids|content&rvslots=main${continueWith}&formatversion=2`;
      const output = (await call(deps, query)).body as Body;
      expect(output.error).toBeUndefined();
      expect(JSON.stringify(output).length).toBeLessThan(MAX_RESULT_BYTES + 100_000);
      const revisions = output.query.pages[0].revisions as Body[];
      expect(revisions.length).toBeGreaterThanOrEqual(1); // the first revision is always answered
      seen.push(...revisions.map((rev) => rev.revid));
      continueWith = output.continue
        ? `&rvcontinue=${encodeURIComponent(output.continue.rvcontinue)}&continue=${encodeURIComponent(output.continue.continue)}`
        : "";
      if (output.continue)
        expect(JSON.stringify(output.warnings)).toContain("limit of 8,388,608 bytes");
      requests++;
    } while (continueWith && requests < 60);
    expect(seen).toEqual(ids);
    expect(requests).toBeGreaterThan(8);
  }, 60_000);

  it("answers one huge revision rather than refusing it forever", async () => {
    const deps = await makeDeps({
      store: fakeWiki({
        pages: [{ pageId: 1, title: "Huge" }],
        revisions: [
          {
            revId: 1,
            page: "Huge",
            timestamp: "2026-01-01T00:00:00Z",
            content: "h".repeat(9 * MB),
          },
        ],
      }),
    });
    const body = (
      await call(
        deps,
        "action=query&titles=Huge&prop=revisions&rvprop=content&rvslots=main&formatversion=2"
      )
    ).body as Body;
    expect(body.query.pages[0].revisions[0].slots.main.content).toHaveLength(9 * MB);
  });
});

describe("continuations and counts", () => {
  it("answers a malformed continuation with badcontinue", async () => {
    const deps = await makeDeps({ store: fakeWiki(wikiData()) });
    for (const params of [
      "list=recentchanges&rccontinue=nonsense",
      "list=logevents&lecontinue=nonsense",
      "list=usercontribs&ucuser=Heku&uccontinue=nonsense",
      "list=categorymembers&cmtitle=Category:Cats&cmcontinue=nonsense",
      "list=backlinks&bltitle=Existing&blcontinue=nonsense",
      "list=blocks&bkcontinue=%24%25",
      "titles=Existing&prop=revisions&rvlimit=2&rvcontinue=a|b|c",
      "titles=Existing&prop=links&plcontinue=garbage",
    ]) {
      const body = (await call(deps, `action=query&${params}&formatversion=2`)).body as Body;
      expect([params, body.error?.code]).toEqual([params, "badcontinue"]);
    }
  });

  it("answers a forged or unknown rvcontinue of several pages (or revids) with badcontinue, never a restart", async () => {
    const MB = 1024 * 1024;
    const wiki: FakeWikiData = {
      pages: Array.from({ length: 6 }, (_, i) => ({ pageId: i + 1, title: `Heavy ${i}` })),
      revisions: Array.from({ length: 6 }, (_, i) => ({
        revId: 1000 + i,
        page: `Heavy ${i}`,
        timestamp: "2026-01-01T00:00:00Z",
        content: "h".repeat(2 * MB),
      })),
    };
    const deps = await makeDeps({ store: fakeWiki(wiki) });
    const titles = Array.from({ length: 6 }, (_, i) => `Heavy ${i}`).join("|");
    const ask = async (token: string, selector = `titles=${titles}`) =>
      (
        await call(
          deps,
          `action=query&${selector}&prop=revisions&rvprop=ids|content&rvslots=main&rvcontinue=${encodeURIComponent(token)}&formatversion=2`
        )
      ).body as Body;
    const first = (
      await call(
        deps,
        `action=query&titles=${titles}&prop=revisions&rvprop=ids|content&rvslots=main&formatversion=2`
      )
    ).body as Body;
    const real = first.continue.rvcontinue as string;
    expect(real).toMatch(/^\d+\|\d+$/);
    // the real token continues
    expect((await ask(real)).error).toBeUndefined();
    // forged, stale, from another request, or half a token
    for (const token of [
      "999|999",
      "1|1",
      "4|1000",
      "4|1003x",
      "4",
      "x|y",
      "4|1003|7",
      real.replace("|", "||"),
    ]) {
      expect([token, (await ask(token)).error?.code]).toEqual([token, "badcontinue"]);
    }
    // the token of one set of pages is no token for another
    expect((await ask(real, "titles=Heavy 0|Heavy 1")).error.code).toBe("badcontinue");
    // revids: a token naming a revision that is not among them
    const byId = (await ask("1|1004", "revids=1000|1001|1002")).error;
    expect(byId.code).toBe("badcontinue");
  });

  it("gives sha1 as 40 hexadecimal characters, as MediaWiki's tools expect", async () => {
    const deps = await makeDeps({ store: fakeWiki(wikiData()) });
    const body = (
      await call(deps, "action=query&titles=Existing&prop=revisions&rvprop=sha1&formatversion=2")
    ).body as Body;
    expect(body.query.pages[0].revisions[0].sha1).toMatch(/^[0-9a-f]{40}$/);
    expect(body.query.pages[0].revisions[0].sha1).toBe(fakeSha1Hex(101));
  });
});

describe("login", () => {
  const throttleKeys = async (name: string, bot = "Bot") => {
    const keys: string[] = [];
    const wiki = await makeWikiDeps(wikiData(), {
      extra: {
        rateLimit: async (key, bucket) => {
          if (bucket === "wiki_api_login") keys.push(key);
          return { success: true, resetAt: new Date(0) };
        },
      },
    });
    const body = (await wiki.bot.login(name, "bot-secret")) as Body;
    return { keys, body, bot, wiki };
  };

  it("keys the throttle on the client and the sha256 of the lower-cased name", async () => {
    const { keys, body } = await throttleKeys("Heku@Bot");
    expect(body.login.result).toBe("Success");
    expect(keys).toEqual([
      `ip:203.0.113.9|${createHash("sha256").update("heku@bot").digest("hex")}`,
    ]);
  });

  it("makes the key the same size for a name of any length, and refuses a name past 255 characters first", async () => {
    const long = await throttleKeys(`${"A".repeat(250)}@Bot`);
    expect(long.keys[0]).toHaveLength("ip:203.0.113.9|".length + 64);
    const tooLong = await throttleKeys("A".repeat(256));
    expect(tooLong.body.login.result).toBe("Failed");
    expect(tooLong.keys).toEqual([]); // nothing was hashed, throttled or looked up
  });

  it("refuses a password past 1024 characters the same way", async () => {
    const keys: string[] = [];
    const wiki = await makeWikiDeps(wikiData(), {
      extra: {
        rateLimit: async (key, bucket) => (
          bucket === "wiki_api_login" && keys.push(key),
          { success: true, resetAt: new Date(0) }
        ),
      },
    });
    const body = (await wiki.bot.login("Heku@Bot", "p".repeat(1025))) as Body;
    expect(body.login.result).toBe("Failed");
    expect(keys).toEqual([]);
  });
});
