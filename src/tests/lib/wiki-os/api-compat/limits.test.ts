/** @jest-environment node */
/**
 * api.php input bounds (plan 410): page and summary sizes, NUL, blank pages, history paging, value lists, search
 * limits, the response budget, continuations that cannot be forged, the login throttle key, and hostile text through
 * parse, compare and section edits (no scan keyed on a text's content, the diff table bounded and escaped).
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { call, fakeWiki, type FakeWikiData, loggedIn, makeDeps, makeWikiDeps } from "./harness";
import { createHash } from "node:crypto";
import { MAX_RESULT_BYTES } from "~/lib/wiki-os/api-compat/budget";
import { TIMING_BUDGET_SCALE } from "~/tests/helpers/timing-budget";
import { diffTableHtml } from "~/lib/wiki-os/api-compat/diff-table";
import { DiffTooLargeError, diffWikitext } from "~/lib/wiki-os/transformers/wikitext-diff";
import { sectionHeadings } from "~/lib/wiki-os/wikitext/section-locator";

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

describe("hostile input", () => {
  const N = 200_000;
  const BUDGET_MS = 200 * TIMING_BUDGET_SCALE;

  const HOSTILE: Record<string, string> = {
    "category opener and spaces": `[[Category:${" ".repeat(N)}`,
    "category opener, spaces then a key": `[[ ${" ".repeat(N)}Category:a|b`,
    "unclosed link openers": "[[".repeat(N / 2),
    "unclosed link targets": "[[a".repeat(N / 3),
    "unclosed piped links": "[[a|".repeat(N / 4),
    "unclosed section links": "[[a#".repeat(N / 4),
    "unclosed category links": "[[Category:a".repeat(N / 12),
    "unclosed nowiki openers": "<nowiki ".repeat(N / 8),
    "unclosed pre and ref openers": "<pre <ref <gallery ".repeat(N / 18),
    "nowiki openers with attributes": '<nowiki a="'.repeat(N / 11),
    "heading marks": "== ".repeat(N / 3),
    "a line of equals signs": "=".repeat(N),
    "headings with trailing space": "== a ==  \n".repeat(N / 10),
    "bare addresses": "http://".repeat(N / 7),
    "quotes": "'''''".repeat(N / 5),
    "braces": "{{".repeat(N / 2),
    "a long run of closed links": "[[a]]".repeat(N / 5),
    "distinct closed links": Array.from({ length: N / 12 }, (_, i) => `[[Page ${i}]]`).join(""),
  };

  for (const [name, text] of Object.entries(HOSTILE)) HOSTILE[name] = text.slice(0, N);

  const timed = <T>(run: () => T): { value: T; ms: number } => {
    const start = performance.now();
    const value = run();
    return { value, ms: performance.now() - start };
  };
  /** The same characters in a new string object (a text read from the database again is one). */
  const freshCopy = (text: string) => text.split("").join("");

  describe("no scan keeps state keyed on a text's content", () => {
    const hostile = "<nowiki ".repeat(125_000);

    it("scans an equal copy of a hostile text as fast as the first (a content comparison per `<` was quadratic)", () => {
      const first = timed(() => sectionHeadings(hostile));
      const copy = freshCopy(hostile);
      expect(copy).toBe(hostile);
      const second = timed(() => sectionHeadings(copy));
      const third = timed(() => sectionHeadings(freshCopy(hostile)));
      expect(first.ms).toBeLessThan(200 * TIMING_BUDGET_SCALE);
      expect(second.ms).toBeLessThan(200 * TIMING_BUDGET_SCALE);
      expect(third.ms).toBeLessThan(200 * TIMING_BUDGET_SCALE);
    });
    it("answers an anonymous parse&page= of a stored hostile page quickly, request after request", async () => {
      const wiki = await makeWikiDeps({ pages: [{ pageId: 1, title: "Hostile", wikitext: hostile }], revisions: [{ revId: 1, page: "Hostile", timestamp: "2026-01-01T00:00:00Z", content: hostile }], html: { Hostile: "<p>stored</p>" } });
      for (let round = 0; round < 3; round++) {
        // each request reads the page's text again: a new string with the same content
        wiki.data.pages![0]!.wikitext = freshCopy(hostile);
        const start = performance.now();
        const body = (await call(wiki.deps, "action=parse&page=Hostile&prop=text|sections|categories|links|displaytitle|properties&formatversion=2")).body as Record<string, any>;
        expect(performance.now() - start).toBeLessThan(400 * TIMING_BUDGET_SCALE);
        expect(body.parse.title).toBe("Hostile");
      }
    });
  });

  describe("the compare table over plan 413's diff engine is bounded", () => {
    const lines = (count: number, tag: string) => Array.from({ length: count }, (_, i) => `${tag} line ${i}`).join("\n");
    const table = (oldText: string, newText: string) => diffTableHtml(diffWikitext(oldText, newText, { context: 2 }), 2 * 1024 * 1024);
    const toobig = (run: () => unknown) => {
      try {
        run();
      } catch (error) {
        return (error as { code?: string }).code;
      }
      return undefined;
    };

    it("refuses two 100,000-line texts as toobig in under 500 ms, whether they share nothing or every tenth line differs", () => {
      const old = Array.from({ length: 100_000 }, (_, i) => `row ${i}`);
      const changed = old.map((line, i) => (i % 10 === 0 ? `${line} changed` : line));
      for (const [from, to] of [[lines(100_000, "old"), lines(100_000, "new")], [old.join("\n"), changed.join("\n")]] as const) {
        const { ms, value } = timed(() => toobig(() => table(from, to)));
        expect(ms).toBeLessThan(500 * TIMING_BUDGET_SCALE);
        expect(value).toBe("toobig");
      }
    });

    it("refuses a diff the engine had to cut (more rows than one answer carries) rather than show a smaller change", () => {
      const old = Array.from({ length: 19_000 }, (_, i) => `row ${i}`);
      const changed = old.map((line, i) => (i % 3 === 0 ? `${line} changed` : line));
      const { ms, value } = timed(() => toobig(() => table(old.join("\n"), changed.join("\n"))));
      expect(value).toBe("toobig");
      expect(ms).toBeLessThan(1000 * TIMING_BUDGET_SCALE);
    });
    it("refuses a text over 2 MB (DiffTooLargeError is the engine's) and a table past 2 MB", () => {
      expect(() => diffWikitext("a".repeat(2 * 1024 * 1024 + 1), "b")).toThrow(DiffTooLargeError);
      const diff = diffWikitext("x", "y", { context: 2 });
      expect(toobig(() => diffTableHtml(diff, 100))).toBe("toobig");
      expect(diffTableHtml(diff, 10_000)).toContain("diff-addedline");
    });

    it("lays a changed line out as MediaWiki does: the differing words inside ins and del, everything escaped", () => {
      const html = table("a\nthe <b>old</b> text\nz", "a\nthe <i>new</i> text\nz");
      expect(html).toContain('<td class="diff-deletedline">');
      expect(html).toContain('<td class="diff-addedline">');
      expect(html).not.toContain("<b>");
      expect(html).not.toContain("<i>");
      expect(html).toMatch(/<del class="diffchange diffchange-inline">[^<]*b[^<]*<\/del>/);
      expect(html).toMatch(/<ins class="diffchange diffchange-inline">[^<]*i[^<]*<\/ins>/);
      // a pure addition or removal carries its whole line
      expect(table("a", "a\nnew")).toContain('<td class="diff-addedline"><ins class="diffchange diffchange-inline">new</ins></td>');
    });
  });

  describe("action=parse and action=compare over hostile text", () => {
    const WIKI = (): FakeWikiData => ({ pages: [{ pageId: 1, title: "Alpha", wikitext: "x" }], revisions: [{ revId: 1, page: "Alpha", timestamp: "2026-01-01T00:00:00Z", content: "x" }] });
    const PARSE_PROPS = "text|links|categories|sections|displaytitle|externallinks|properties|wikitext";

    async function bot() {
      const wiki = await makeWikiDeps(WIKI());
      await loggedIn(wiki.bot);
      return wiki;
    }
    const form = (params: Record<string, string>) => ({ ...params, formatversion: "2" });

    // one family of each shape: a run of one opener, openers with attributes, heading marks, addresses, quotes, braces,
    // and closed links past the caps of what one parse lists
    const PARSE_FAMILIES = [
      "category opener and spaces",
      "unclosed piped links",
      "unclosed nowiki openers",
      "unclosed pre and ref openers",
      "heading marks",
      "bare addresses",
      "quotes",
      "braces",
      "distinct closed links",
    ];
    it.each(PARSE_FAMILIES.map((name) => [name, HOSTILE[name]!] as const))(
      `parse&text= answers %s in under ${BUDGET_MS} ms`,
      async (_name, text) => {
        const wiki = await bot();
        const start = performance.now();
        const body = (await wiki.bot.post(form({ action: "parse", text, prop: PARSE_PROPS }))) as Record<string, any>;
        expect(performance.now() - start).toBeLessThan(BUDGET_MS);
        expect(body.error).toBeUndefined();
        expect(body.parse.links.length).toBeLessThanOrEqual(5000);
        expect(body.parse.categories.length).toBeLessThanOrEqual(1000);
        expect(body.parse.sections.length).toBeLessThanOrEqual(5000);
      }
    );
    it("compare of two near-identical big revisions answers with its context, not toobig", async () => {
      const lines = Array.from({ length: 19_000 }, (_, i) => `line ${i}`);
      const edited = [...lines];
      edited[9_500] = "line 9500 edited";
      const wiki = await makeWikiDeps(
        { pages: [{ pageId: 1, title: "Big" }], revisions: [
          { revId: 1, page: "Big", timestamp: "2026-01-01T00:00:00Z", content: lines.join("\n") },
          { revId: 2, page: "Big", timestamp: "2026-01-02T00:00:00Z", content: edited.join("\n") },
        ] },
      );
      const start = performance.now();
      const body = (await call(wiki.deps, "action=compare&fromrev=1&torev=2&formatversion=2")).body as Record<string, any>;
      expect(performance.now() - start).toBeLessThan(2000 * TIMING_BUDGET_SCALE);
      expect(body.error).toBeUndefined();
      expect(body.compare.body.split("\n")).toHaveLength(6);
    }, 30_000);

    it("compare of two 100,000-line texts answers in under 500 ms, or says toobig", async () => {
      const wiki = await makeWikiDeps(WIKI());
      const side = (tag: string) => Array.from({ length: 100_000 }, (_, i) => `${tag}${i}`).join("\n").slice(0, 199_999);
      const start = performance.now();
      const body = (await call(wiki.deps, `action=compare&formatversion=2`, { method: "POST", body: { fromtext: side("a"), totext: side("b") } })).body as Record<string, any>;
      expect(performance.now() - start).toBeLessThan(500 * TIMING_BUDGET_SCALE);
      expect(body.compare?.body ?? body.error.code).toBeTruthy();
    });
  });
});
