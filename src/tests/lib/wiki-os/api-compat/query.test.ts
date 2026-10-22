/** @jest-environment node */
/**
 * api.php, the query family (plan 410, 411): what a bot reads. Page selectors and the prop modules, the list modules
 * and generators with their continuations (no page lost or repeated across requests), templates, images and the
 * render-derived properties, files, action=paraminfo, the wire format and error envelope, the parameter parser and the
 * scans of a page that was never rendered, in both format versions, against the shared fake wiki (harness.ts).
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { call, fakeWiki, type FakeWikiData, loggedIn, makeDeps, makeWikiDeps } from "./harness";
import type { ApiDeps } from "~/lib/wiki-os/api-compat/types";
import { ACTIONS } from "~/lib/wiki-os/api-compat/actions";
import { buildRegistry } from "~/lib/wiki-os/api-compat/registry";
import { Continuation, decodeCursor, encodeCursor } from "~/lib/wiki-os/api-compat/continuation";
import { ApiError, badContinue } from "~/lib/wiki-os/api-compat/errors";
import { API_DOCREF, errorBody, toWire } from "~/lib/wiki-os/api-compat/format";
import { ApiParams, HIGH_LIMIT, NORMAL_LIMIT, parseRequestParams, splitMultiValue } from "~/lib/wiki-os/api-compat/params";
import { categoryLinks, externalUrls, linkTargets } from "~/lib/wiki-os/api-compat/scan";

describe("query: page selectors and prop modules", () => {
  type Body = Record<string, any>;

  const DATA: FakeWikiData = {
    pages: [
      { pageId: 1, title: "Alpha", wikitext: "{{DISPLAYTITLE:alpha}} {{DEFAULTSORT:Alpha, The}} __NOINDEX__" },
      { pageId: 2, title: "Beta" },
      { pageId: 3, title: "Gamma", redirect: "Alpha", redirectFragment: "History" },
      { pageId: 4, title: "Template:Foo", namespace: 10 },
      { pageId: 5, title: "Talk:Alpha", namespace: 1 },
      { pageId: 6, title: "Loop A", redirect: "Loop B" },
      { pageId: 7, title: "Loop B", redirect: "Loop A" },
      { pageId: 8, title: "Hidden" },
    ],
    revisions: [
      { revId: 101, page: "Alpha", timestamp: "2026-01-01T10:00:00Z", user: "Heku", comment: "create", content: "Alpha v1" },
      { revId: 102, page: "Alpha", timestamp: "2026-01-02T10:00:00Z", user: "Tester", comment: "tweak", minor: true, content: "Alpha v2" },
      { revId: 103, page: "Alpha", timestamp: "2026-01-03T10:00:00Z", user: "Heku", comment: "more <b>", content: "Alpha v3 [[Beta]]" },
      { revId: 201, page: "Beta", timestamp: "2026-01-04T10:00:00Z", user: "Heku", content: "Beta text" },
      { revId: 301, page: "Gamma", timestamp: "2026-01-05T10:00:00Z", content: "#REDIRECT [[Alpha#History]]" },
      { revId: 401, page: "Template:Foo", timestamp: "2026-01-06T10:00:00Z", content: "{{{1}}}" },
      { revId: 501, page: "Talk:Alpha", timestamp: "2026-01-07T10:00:00Z", content: "talk" },
      { revId: 601, page: "Loop A", timestamp: "2026-01-08T10:00:00Z", content: "#REDIRECT [[Loop B]]" },
      { revId: 701, page: "Loop B", timestamp: "2026-01-08T11:00:00Z", content: "#REDIRECT [[Loop A]]" },
      { revId: 801, page: "Hidden", timestamp: "2026-01-09T10:00:00Z", user: "1.2.3.4", comment: "secret", content: "classified", textHidden: true, commentHidden: true },
      { revId: 802, page: "Hidden", timestamp: "2026-01-09T11:00:00Z", user: "Heku", content: "now fine", userHidden: true },
    ],
    links: { Alpha: ["Beta", "Template:Foo", "Zeta", "Eta"] },
    categories: { Alpha: ["Cats", "Things"], Beta: ["Things"] },
    restrictions: { Alpha: [{ action: "edit", level: "sysop" }, { action: "move", level: "autoconfirmed", expiresAt: "2030-01-01T00:00:00Z" }], Nope: [{ action: "create", level: "sysop" }] },
  };

  async function query(params: string, data: FakeWikiData = DATA): Promise<Body> {
    const deps = await makeDeps({ store: fakeWiki(data) });
    return (await call(deps, `action=query&${params}`)).body as Body;
  }

  describe("page selectors", () => {
    it("v1 keys pages by id and missing ones by negative numbers; v2 returns an array", async () => {
      const v1 = await query("titles=Alpha|Nope|Beta");
      expect(Object.keys(v1.query.pages)).toEqual(["1", "2", "-1"]);
      expect(v1.query.pages["1"]).toEqual({ pageid: 1, ns: 0, title: "Alpha" });
      expect(v1.query.pages["-1"]).toEqual({ ns: 0, title: "Nope", missing: "" });
      expect(v1.batchcomplete).toBe("");

      const v2 = await query("titles=Alpha|Nope|Beta&formatversion=2");
      expect(v2.query.pages).toEqual([
        { pageid: 1, ns: 0, title: "Alpha" },
        { pageid: 2, ns: 0, title: "Beta" },
        { ns: 0, title: "Nope", missing: true },
      ]);
      expect(v2.batchcomplete).toBe(true);
    });

    it("reports how titles were normalized", async () => {
      const body = await query("titles=alpha|Template:foo|talk:alpha_&formatversion=2");
      expect(body.query.normalized).toEqual([
        { fromencoded: false, from: "alpha", to: "Alpha" },
        { fromencoded: false, from: "Template:foo", to: "Template:Foo" },
        { fromencoded: false, from: "talk:alpha_", to: "Talk:Alpha" },
      ]);
      expect(body.query.pages.map((p: Body) => p.pageid)).toEqual([1, 4, 5]);
    });

    it("lists invalid and special titles with MediaWiki's flags", async () => {
      const body = await query("titles=Bad[title|Special:Version&formatversion=2");
      expect(body.query.pages).toEqual([
        {
          title: "Bad[title",
          invalidreason: 'The requested page title contains invalid characters: "[".',
          invalid: true,
        },
        { ns: -1, title: "Special:Version", special: true },
      ]);
    });
    it("selects by revision id and lists unknown ones under badrevids", async () => {
      const body = await query("revids=102|9999&prop=revisions&rvprop=ids&formatversion=2");
      expect(body.query.badrevids).toEqual({ "9999": { revid: 9999 } });
      expect(body.query.pages).toEqual([
        { pageid: 1, ns: 0, title: "Alpha", revisions: [{ revid: 102, parentid: 101 }] },
      ]);
    });

    it("resolves redirects and says so, with the fragment", async () => {
      const body = await query("titles=Gamma&redirects&formatversion=2");
      expect(body.query.redirects).toEqual([{ from: "Gamma", to: "Alpha", tofragment: "History" }]);
      expect(body.query.pages).toEqual([{ pageid: 1, ns: 0, title: "Alpha" }]);
      // without `redirects` the redirect page itself comes back
      expect((await query("titles=Gamma&formatversion=2")).query.pages[0].title).toBe("Gamma");
    });

    it("survives a redirect loop and a redirect to a missing page", async () => {
      const loop = await query("titles=Loop A&redirects&formatversion=2");
      expect(loop.query.redirects.map((r: Body) => `${r.from}>${r.to}`)).toEqual(["Loop A>Loop B", "Loop B>Loop A"]);
      expect(loop.query.pages).toBeUndefined(); // both pages dropped out of the loop
      const broken = await query("titles=Dead&redirects&formatversion=2", {
        ...DATA,
        pages: [...DATA.pages!, { pageId: 9, title: "Dead", redirect: "Nowhere" }],
      });
      expect(broken.query.pages).toEqual([{ ns: 0, title: "Nowhere", missing: true }]);
    });

    it("limits how many titles one request may name", async () => {
      const many = Array.from({ length: 51 }, (_, i) => `T${i}`).join("|");
      expect((await query(`titles=${many}`)).error.code).toBe("toomanyvalues");
    });
  });

  describe("prop=info", () => {
    it("answers the page record MediaWiki does", async () => {
      const body = await query("titles=Alpha&prop=info&formatversion=2");
      expect(body.query.pages[0]).toEqual({
        pageid: 1,
        ns: 0,
        title: "Alpha",
        contentmodel: "wikitext",
        pagelanguage: "en",
        pagelanguagehtmlcode: "en",
        pagelanguagedir: "ltr",
        touched: "2026-01-03T10:00:00Z",
        lastrevid: 103,
        length: 17,
        redirect: false,
      });
      const v1 = await query("titles=Gamma&prop=info");
      expect(v1.query.pages["3"].redirect).toBe("");
      expect(v1.query.pages["3"].lastrevid).toBe(301);
    });
  });

  describe("prop=revisions", () => {
    it("uses rvslots: slots.main with `*` (v1) or `content` (v2), the shape Pywikibot reads", async () => {
      const v1 = await query("titles=Alpha&prop=revisions&rvprop=content|timestamp|ids&rvslots=*");
      expect(v1.query.pages["1"].revisions[0]).toEqual({
        revid: 103,
        parentid: 102,
        timestamp: "2026-01-03T10:00:00Z",
        slots: { main: { contentmodel: "wikitext", contentformat: "text/x-wiki", "*": "Alpha v3 [[Beta]]" } },
      });
      expect(v1.warnings).toBeUndefined();
      const v2 = await query("titles=Alpha&prop=revisions&rvprop=content&rvslots=main&formatversion=2");
      expect(v2.query.pages[0].revisions[0].slots.main).toEqual({
        contentmodel: "wikitext",
        contentformat: "text/x-wiki",
        content: "Alpha v3 [[Beta]]",
      });
    });
    it("lists history of one page with rvlimit, newest first, and continues", async () => {
      const first = await query("titles=Alpha&prop=revisions&rvprop=ids&rvlimit=2&formatversion=2");
      expect(first.query.pages[0].revisions.map((r: Body) => r.revid)).toEqual([103, 102]);
      expect(first.batchcomplete).toBeUndefined();
      expect(first.continue).toEqual({ rvcontinue: expect.any(String), continue: "||" });
      const second = await query(`titles=Alpha&prop=revisions&rvprop=ids&rvlimit=2&rvcontinue=${encodeURIComponent(first.continue.rvcontinue)}&formatversion=2`);
      expect(second.query.pages[0].revisions.map((r: Body) => r.revid)).toEqual([101]);
      expect(second.continue).toBeUndefined();
      expect(second.batchcomplete).toBe(true);
    });
    it("lists at most 50 revisions with their text per request (500 without content)", async () => {
      const many: FakeWikiData = {
        pages: [{ pageId: 1, title: "Busy" }],
        revisions: Array.from({ length: 60 }, (_, i) => ({
          revId: 1000 + i,
          page: "Busy",
          timestamp: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
          content: `text ${i}`,
        })),
      };
      const withText = await query("titles=Busy&prop=revisions&rvprop=ids|content&rvslots=main&rvlimit=max&formatversion=2", many);
      expect(withText.query.pages[0].revisions).toHaveLength(50);
      expect(withText.continue.rvcontinue).toBeDefined();
      const withoutText = await query("titles=Busy&prop=revisions&rvprop=ids&rvlimit=max&formatversion=2", many);
      expect(withoutText.query.pages[0].revisions).toHaveLength(60);
      expect(withoutText.continue).toBeUndefined();
    });

    it("answers the newest revision of each page when several are named, and refuses history parameters", async () => {
      const body = await query("titles=Alpha|Beta&prop=revisions&rvprop=ids|content&rvslots=main&formatversion=2");
      expect(body.query.pages.map((p: Body) => [p.title, p.revisions[0].revid])).toEqual([["Alpha", 103], ["Beta", 201]]);
      const refused = await query("titles=Alpha|Beta&prop=revisions&rvlimit=5");
      expect(refused.error.code).toBe("multpages");
      expect(refused.error.info).toContain("rvlimit");
      expect((await query("titles=Alpha|Beta&prop=revisions&rvdir=newer")).error.code).toBe("multpages");
    });

    it("hides what a revision deletion hid", async () => {
      const body = await query("titles=Hidden&prop=revisions&rvprop=ids|user|comment|content|sha1&rvslots=main&rvlimit=2&formatversion=2");
      const [newest, older] = body.query.pages[0].revisions as Body[];
      expect(newest).toMatchObject({ revid: 802, userhidden: true });
      expect(newest.user).toBeUndefined();
      expect(older).toMatchObject({ revid: 801, commenthidden: true, sha1hidden: true });
      expect(older.slots.main.texthidden).toBe(true);
      expect(JSON.stringify(older)).not.toContain("classified");
      expect(JSON.stringify(older)).not.toContain("secret");
    });
  });

  describe("prop=categories and prop=links", () => {
    it("lists categories per page and continues across pages", async () => {
      const all = await query("titles=Alpha|Beta&prop=categories&cllimit=max&formatversion=2");
      expect(all.query.pages.map((p: Body) => [p.title, p.categories.map((c: Body) => c.title)])).toEqual([
        ["Alpha", ["Category:Cats", "Category:Things"]],
        ["Beta", ["Category:Things"]],
      ]);
      expect(all.query.pages[0].categories[0]).toEqual({ ns: 14, title: "Category:Cats" });

      const first = await query("titles=Alpha|Beta&prop=categories&cllimit=2&formatversion=2");
      expect(first.continue.clcontinue).toBeDefined();
      expect(first.batchcomplete).toBeUndefined();
      expect(first.query.pages[1].categories).toBeUndefined();
      const second = await query(`titles=Alpha|Beta&prop=categories&cllimit=2&clcontinue=${encodeURIComponent(first.continue.clcontinue)}&formatversion=2`);
      expect(second.query.pages[1].categories.map((c: Body) => c.title)).toEqual(["Category:Things"]);
      expect(second.continue).toBeUndefined();
    });
  });

  describe("prop=pageprops and unknown props", () => {
    it("reads DISPLAYTITLE, DEFAULTSORT and behaviour switches from the page's wikitext", async () => {
      const body = await query("titles=Alpha|Beta&prop=pageprops&formatversion=2");
      expect(body.query.pages[0].pageprops).toEqual({ displaytitle: "alpha", defaultsort: "Alpha, The", noindex: "" });
      expect(body.query.pages[1].pageprops).toBeUndefined();
      const filtered = await query("titles=Alpha&prop=pageprops&ppprop=defaultsort&formatversion=2");
      expect(filtered.query.pages[0].pageprops).toEqual({ defaultsort: "Alpha, The" });
    });
  });

  describe("generator=links", () => {
    it("turns the links of the named pages into the page set and continues the generator", async () => {
      const first = await query("generator=links&titles=Alpha&gpllimit=2&prop=info&formatversion=2");
      // links come in slug order: beta, eta, template:foo, zeta
      expect(first.query.pages.map((p: Body) => p.title)).toEqual(["Beta", "Eta"]);
      expect(first.continue).toEqual({ gplcontinue: expect.any(String), continue: "gplcontinue||" });
      expect(first.batchcomplete).toBe(true);
      const second = await query(`generator=links&titles=Alpha&gpllimit=2&gplcontinue=${encodeURIComponent(first.continue.gplcontinue)}&prop=info&formatversion=2`);
      // Template:Foo exists, Zeta does not: existing pages come first, missing ones after
      expect(second.query.pages.map((p: Body) => [p.title, p.missing ?? false])).toEqual([["Template:Foo", false], ["Zeta", true]]);
      expect(second.continue).toBeUndefined();
    });

    it("repeats the generator's continue value while a prop still has more", async () => {
      const body = await query("generator=links&titles=Alpha&gpllimit=max&prop=categories&cllimit=1&formatversion=2");
      expect(body.query.pages).toHaveLength(4);
      // Beta (the only linked page with categories) has one category, so the prop finished:
      expect(body.continue).toBeUndefined();

      const stuck = await query("generator=links&titles=Alpha&gpllimit=max&prop=links&pllimit=1&formatversion=2", {
        ...DATA,
        links: { Alpha: ["Beta", "Gamma"], Beta: ["Alpha", "Gamma"] },
      });
      expect(stuck.batchcomplete).toBeUndefined();
      expect(stuck.continue.plcontinue).toBeDefined();
    });

  });
});

describe("query: list modules and generators", () => {
  type Body = Record<string, any>;

  const DATA: FakeWikiData = {
    pages: [
      { pageId: 1, title: "Alpha" },
      { pageId: 2, title: "Beta" },
      { pageId: 3, title: "Gamma", redirect: "Alpha" },
      { pageId: 4, title: "Delta" },
      { pageId: 5, title: "Epsilon" },
      { pageId: 10, title: "Template:Foo", namespace: 10 },
      { pageId: 11, title: "Template:Bar", namespace: 10 },
      { pageId: 20, title: "Category:Cats", namespace: 14 },
      { pageId: 21, title: "File:Cat.png", namespace: 6 },
    ],
    revisions: [
      { revId: 11, page: "Alpha", timestamp: "2026-03-01T10:00:00Z", user: "Heku", comment: "create A", content: "aaaa" },
      { revId: 12, page: "Beta", timestamp: "2026-03-02T10:00:00Z", user: "Tester", comment: "make B", minor: true, content: "bb" },
      { revId: 13, page: "Alpha", timestamp: "2026-03-03T10:00:00Z", user: "Tester", comment: "edit A", content: "aaaaaa" },
      { revId: 14, page: "Delta", timestamp: "2026-03-04T10:00:00Z", user: "1.2.3.4", comment: "anon", content: "d" },
      { revId: 15, page: "Alpha", timestamp: "2026-03-05T10:00:00Z", user: "Heku", comment: "edit A again <3", content: "aaaaaaaa" },
    ],
    logs: [
      { logId: 1, type: "delete", action: "delete", title: "Old page", actor: "Heku", comment: "junk", params: { reason: "junk" }, timestamp: "2026-03-02T12:00:00Z" },
      { logId: 2, type: "move", action: "move", title: "Alpha", actor: "Heku", params: { to: "Beta" }, timestamp: "2026-03-03T10:00:00Z" },
      { logId: 3, type: "block", action: "block", title: "User:Spam", actor: "Heku", comment: "spam", timestamp: "2026-03-06T10:00:00Z" },
    ],
    links: { Alpha: ["Beta"], Beta: ["Alpha"], Gamma: ["Alpha"], Delta: ["Alpha", "Beta"] },
    categories: {
      Alpha: ["Cats"],
      Beta: ["Cats", "Dogs"],
      Delta: ["Cats"],
      "Category:Cats": ["Cats"],
      "File:Cat.png": ["Cats"],
      Epsilon: ["Cats"],
    },
    sortKeys: { Cats: { Alpha: "zz", Beta: "aa" } },
    users: [
      { name: "Alice", userId: 3, groups: ["sysop"], editCount: 9, registration: "2020-01-01T00:00:00Z" },
      { name: "Bob", userId: 4, groups: [], editCount: 2 },
      { name: "Carol", userId: 5, groups: ["bot", "sysop"], editCount: 70 },
    ],
    blocks: [
      { target: "Spammer", reason: "spam", expiresAt: null, blockedBy: "Heku", createdAt: "2026-03-01T00:00:00Z" },
      { target: "Troll", reason: "trolling", expiresAt: "2030-01-01T00:00:00Z", blockedBy: "Heku", createdAt: "2026-02-01T00:00:00Z" },
    ],
    protectedTitles: [
      { id: "p1", title: "Nope", level: "sysop", timestamp: "2026-03-01T00:00:00Z", user: "Heku", comment: "salted" },
      { id: "p2", title: "Never", level: "autoconfirmed", timestamp: "2026-03-02T00:00:00Z", expiresAt: "2030-01-01T00:00:00Z" },
    ],
  };

  async function run(params: string, depsOverride: Partial<ApiDeps> = {}, data: FakeWikiData = DATA): Promise<Body> {
    const deps = await makeDeps({ store: fakeWiki(data), ...depsOverride });
    return (await call(deps, `action=query&${params}&formatversion=2`)).body as Body;
  }

  /** Follow `continue` until the list ends; returns every page of items. */
  async function walk(params: string, key: string, data: FakeWikiData = DATA): Promise<Body[][]> {
    const pages: Body[][] = [];
    let extra = "";
    for (let guard = 0; guard < 50; guard++) {
      const body = await run(`${params}${extra}`, {}, data);
      pages.push(body.query[key]);
      if (!body.continue) return pages;
      extra = Object.entries(body.continue)
        .filter(([name]) => name !== "continue")
        .map(([name, value]) => `&${name}=${encodeURIComponent(String(value))}`)
        .join("");
    }
    throw new Error("continuation never ended");
  }

  const titles = (items: Body[]) => items.map((item) => item.title);

  describe("list=allpages", () => {
    it("lists the main namespace in title order with pageid, ns and title", async () => {
      const body = await run("list=allpages&aplimit=max");
      expect(body.query.allpages).toEqual([
        { pageid: 1, ns: 0, title: "Alpha" },
        { pageid: 2, ns: 0, title: "Beta" },
        { pageid: 4, ns: 0, title: "Delta" },
        { pageid: 5, ns: 0, title: "Epsilon" },
        { pageid: 3, ns: 0, title: "Gamma" },
      ]);
      expect(body.batchcomplete).toBe(true);
      expect(body.continue).toBeUndefined();
    });

    it("continues with apcontinue until every page was listed exactly once", async () => {
      const pages = await walk("list=allpages&aplimit=2", "allpages");
      expect(pages.map(titles)).toEqual([["Alpha", "Beta"], ["Delta", "Epsilon"], ["Gamma"]]);
      const first = await run("list=allpages&aplimit=2");
      expect(first.continue).toEqual({ apcontinue: "Delta", continue: "-||" });
    });
    it("lists another namespace with its prefix and refuses an unknown one", async () => {
      const body = await run("list=allpages&apnamespace=10&apfrom=bar");
      expect(body.query.allpages).toEqual([
        { pageid: 11, ns: 10, title: "Template:Bar" },
        { pageid: 10, ns: 10, title: "Template:Foo" },
      ]);
      expect((await run("list=allpages&apnamespace=9999")).error.code).toBe("badvalue");
      expect((await run("list=allpages&apnamespace=x")).error.code).toBe("badinteger");
    });
  });

  describe("generators", () => {
    it("generator=allpages feeds the page set that props decorate, and continues with gapcontinue", async () => {
      const first = await run("generator=allpages&gaplimit=2&prop=info");
      expect(first.query.pages.map((p: Body) => [p.title, p.lastrevid])).toEqual([["Alpha", 15], ["Beta", 12]]);
      expect(first.continue).toEqual({ gapcontinue: "Delta", continue: "gapcontinue||" });
      expect(first.batchcomplete).toBe(true);
      const second = await run("generator=allpages&gaplimit=2&gapcontinue=Delta&prop=info");
      expect(second.query.pages.map((p: Body) => p.title)).toEqual(["Delta", "Epsilon"]);
    });

    it("holds the generator where it was while a prop still has revisions to give", async () => {
      const body = await run("generator=allpages&gaplimit=2&prop=categories&cllimit=1");
      expect(body.batchcomplete).toBeUndefined();
      expect(body.continue.gapcontinue).toBe("");
      expect(body.continue.clcontinue).toBeDefined();
    });
  });

  describe("list=categorymembers", () => {
    it("lists members by sort key (the title when there is none), with pageid, ns and title", async () => {
      const body = await run("list=categorymembers&cmtitle=category:cats&cmlimit=max");
      // sort values: Beta=aa, Alpha=zz, the rest by title
      expect(titles(body.query.categorymembers)).toEqual(["Beta", "Category:Cats", "Delta", "Epsilon", "File:Cat.png", "Alpha"]);
      expect(body.query.categorymembers[0]).toEqual({ pageid: 2, ns: 0, title: "Beta" });
    });
    it("walks the whole category with cmcontinue", async () => {
      const pages = await walk("list=categorymembers&cmtitle=Category:Cats&cmlimit=2", "categorymembers");
      expect(pages.flat().map((m) => m.title)).toEqual(["Beta", "Category:Cats", "Delta", "Epsilon", "File:Cat.png", "Alpha"]);
      expect(pages).toHaveLength(3);
    });
  });

  describe("list=backlinks", () => {
    it("lists the pages that link to a title, with the redirect flag, and filters", async () => {
      const body = await run("list=backlinks&bltitle=Alpha&bllimit=max");
      expect(body.query.backlinks).toEqual([
        { pageid: 2, ns: 0, title: "Beta" },
        { pageid: 3, ns: 0, title: "Gamma", redirect: true },
        { pageid: 4, ns: 0, title: "Delta" },
      ]);
      expect(titles((await run("list=backlinks&bltitle=alpha&blfilterredir=redirects")).query.backlinks)).toEqual(["Gamma"]);
      expect(titles((await run("list=backlinks&bltitle=Alpha&blfilterredir=nonredirects&bllimit=max")).query.backlinks)).toEqual(["Beta", "Delta"]);
      expect((await run("list=backlinks")).error.code).toBe("missingparam");
    });
  });

  describe("list=recentchanges", () => {
    it("merges edits and log entries newest first; an edit comes before a log entry of the same moment", async () => {
      const body = await run("list=recentchanges&rclimit=max&rcprop=title|ids|timestamp");
      expect(body.query.recentchanges.map((c: Body) => (c.type === "log" ? `log${c.logid}` : `rev${c.revid}`))).toEqual([
        "log3", "rev15", "rev14", "rev13", "log2", "log1", "rev12", "rev11",
      ]);
      expect(body.query.recentchanges[1]).toEqual({
        type: "edit",
        ns: 0,
        title: "Alpha",
        pageid: 1,
        revid: 15,
        old_revid: 13,
        rcid: 15,
        timestamp: "2026-03-05T10:00:00Z",
      });
      expect(body.query.recentchanges[7].type).toBe("new");
      expect(body.query.recentchanges[0]).toMatchObject({ type: "log", logid: 3, logtype: "block", logaction: "block", revid: 0, rcid: 2_000_000_003 });
    });
    it("walks the whole stream with rccontinue for any page size, with no gap or duplicate", async () => {
      const all = (await run("list=recentchanges&rclimit=max&rcprop=ids")).query.recentchanges.map((c: Body) => `${c.type}${c.logid ?? c.revid}`);
      for (const size of [1, 2, 3, 5]) {
        const pages = await walk(`list=recentchanges&rclimit=${size}&rcprop=ids`, "recentchanges");
        expect(pages.flat().map((c) => `${c.type}${c.logid ?? c.revid}`)).toEqual(all);
      }
      const newer = (await run("list=recentchanges&rclimit=max&rcdir=newer&rcprop=ids")).query.recentchanges.map((c: Body) => `${c.type}${c.logid ?? c.revid}`);
      // oldest first: a log entry comes before an edit made at the same moment
      expect(newer).toEqual(["new11", "new12", "log1", "log2", "edit13", "new14", "edit15", "log3"]);
      for (const size of [1, 2, 4]) {
        const pages = await walk(`list=recentchanges&rclimit=${size}&rcdir=newer&rcprop=ids`, "recentchanges");
        expect(pages.flat().map((c) => `${c.type}${c.logid ?? c.revid}`)).toEqual(newer);
      }
    });
  });

  describe("list=usercontribs", () => {
    it("lists a user's edits with the default props", async () => {
      const body = await run("list=usercontribs&ucuser=Heku&uclimit=max");
      expect(body.query.usercontribs).toEqual([
        { userid: 7, user: "Heku", pageid: 1, revid: 15, parentid: 13, ns: 0, title: "Alpha", timestamp: "2026-03-05T10:00:00Z", comment: "edit A again <3", size: 8, new: false, minor: false, top: true },
        { userid: 7, user: "Heku", pageid: 1, revid: 11, parentid: 0, ns: 0, title: "Alpha", timestamp: "2026-03-01T10:00:00Z", comment: "create A", size: 4, new: true, minor: false, top: false },
      ]);
    });
  });

  describe("list=logevents", () => {
    it("lists log entries newest first with the default props", async () => {
      const body = await run("list=logevents&lelimit=max");
      expect(body.query.logevents.map((e: Body) => e.logid)).toEqual([3, 2, 1]);
      expect(body.query.logevents[2]).toEqual({
        logid: 1,
        ns: 0,
        title: "Old page",
        pageid: 0,
        logpage: 0,
        params: { reason: "junk" },
        type: "delete",
        action: "delete",
        user: "Heku",
        timestamp: "2026-03-02T12:00:00Z",
        comment: "junk",
      });
    });
  });

  describe("list=search", () => {
    const hits = [
      { title: "Alpha", snippet: "the first letter" },
      { title: "Beta", snippet: "the second letter" },
    ];
    const search = jest.fn(async (_query: string, _what: string, limit: number, offset: number) => ({
      hits: hits.slice(offset, offset + limit),
      total: 2,
    }));

    beforeEach(() => search.mockClear());

    it("answers hits enriched with page data and searchinfo", async () => {
      const body = await run("list=search&srsearch=letter&srlimit=max", { search });
      expect(search).toHaveBeenCalledWith("letter", "text", 500, 0);
      expect(body.query.search).toEqual([
        { ns: 0, title: "Alpha", pageid: 1, size: 8, wordcount: 10, snippet: "the first letter", timestamp: "2026-03-05T10:00:00Z" },
        { ns: 0, title: "Beta", pageid: 2, size: 2, wordcount: 10, snippet: "the second letter", timestamp: "2026-03-02T10:00:00Z" },
      ]);
      expect(body.query.searchinfo).toEqual({ totalhits: 2 });
      expect(body.continue).toBeUndefined();
    });
    it("requires a search term, and feeds generator=search", async () => {
      expect((await run("list=search", { search })).error.code).toBe("missingparam");
      const body = await run("generator=search&gsrsearch=letter&gsrlimit=max&prop=info", { search });
      expect(body.query.pages.map((p: Body) => p.title)).toEqual(["Alpha", "Beta"]);
    });
  });

  describe("list=allcategories, allusers, blocks, protectedtitles, random", () => {
    it("lists users with groups, rights, edit counts and registration", async () => {
      const body = await run("list=allusers&auprop=groups|implicitgroups|editcount|registration|rights&aulimit=max");
      expect(body.query.allusers.map((u: Body) => u.name)).toEqual(["Alice", "Bob", "Carol"]);
      expect(body.query.allusers[0]).toMatchObject({
        userid: 3,
        name: "Alice",
        editcount: 9,
        registration: "2020-01-01T00:00:00Z",
        groups: ["*", "user", "sysop"],
        implicitgroups: ["*", "user"],
      });
      expect(body.query.allusers[0].rights).toContain("delete");
      expect(body.query.allusers[1].rights).not.toContain("delete");
      expect((await run("list=allusers&augroup=sysop&aulimit=max")).query.allusers.map((u: Body) => u.name)).toEqual(["Alice", "Carol"]);
      expect((await run("list=allusers&augroup=bot")).query.allusers.map((u: Body) => u.name)).toEqual(["Carol"]);
      expect((await run("list=allusers&auexcludegroup=sysop")).query.allusers.map((u: Body) => u.name)).toEqual(["Bob"]);
      expect((await run("list=allusers&augroup=nonsense")).error.code).toBe("badvalue");
      const pages = await walk("list=allusers&aulimit=2", "allusers");
      expect(pages.flat().map((u) => u.name)).toEqual(["Alice", "Bob", "Carol"]);
    });
  });

  describe("several modules in one request", () => {
    it("answers each list and merges their continuations", async () => {
      const body = await run("list=allpages|logevents&aplimit=1&lelimit=1");
      expect(body.query.allpages).toHaveLength(1);
      expect(body.query.logevents).toHaveLength(1);
      expect(body.continue).toEqual({ apcontinue: "Beta", lecontinue: expect.any(String), continue: "-||" });
    });
  });
});

describe("query: templates, images, categories and render-derived properties", () => {
  type Body = Record<string, any>;

  const data = (): FakeWikiData => ({
    pages: [
      { pageId: 1, title: "Alpha", wikitext: "{{Infobox}} [[File:Cat photo.png]]", pageProps: { defaultsort: "Alpha, The", displaytitle: "<i>alpha</i>" }, displayTitle: "<i>alpha</i>" },
      { pageId: 2, title: "Beta", wikitext: "{{Infobox}} {{Cite web}}" },
      { pageId: 3, title: "Gamma", redirect: "Alpha" },
      { pageId: 4, title: "Delta", wikitext: "plain" },
      { pageId: 10, title: "Template:Infobox", namespace: 10 },
      { pageId: 11, title: "Template:Cite web", namespace: 10 },
      { pageId: 12, title: "Module:Util", namespace: 828 },
      { pageId: 20, title: "File:Cat photo.png", namespace: 6 },
      { pageId: 5, title: "Talk:Alpha", namespace: 1, pageProps: {} },
    ],
    revisions: [
      { revId: 1, page: "Alpha", timestamp: "2026-01-01T00:00:00Z", content: "{{Infobox}} [[File:Cat photo.png]]" },
      { revId: 2, page: "Beta", timestamp: "2026-01-02T00:00:00Z", content: "{{Infobox}} {{Cite web}}" },
      { revId: 3, page: "Delta", timestamp: "2026-01-03T00:00:00Z", content: "plain" },
    ],
    templates: {
      Alpha: ["Template:Infobox", "Module:Util"],
      Beta: ["Template:Cite web", "Template:Infobox"],
      Gamma: ["Template:Infobox"],
    },
    images: { Alpha: ["Cat photo.png", "Dog.jpg"], Beta: ["Cat photo.png"] },
    categories: { Alpha: ["Cats", "Maintenance"], Beta: ["Maintenance"] },
    hiddenCategories: ["Maintenance"],
    html: { Alpha: "<p>stored</p>", Beta: "<p>stored beta</p>" },
  });

  async function run(params: string, wiki: FakeWikiData = data()): Promise<Body> {
    const deps = await makeDeps({ store: fakeWiki(wiki) });
    return (await call(deps, `action=query&${params}&formatversion=2`)).body as Body;
  }

  describe("list=embeddedin", () => {
    it("lists the pages that transclude a template, in page id order, with redirects flagged", async () => {
      const body = await run("list=embeddedin&eititle=Template:Infobox");
      expect(body.query.embeddedin).toEqual([
        { pageid: 1, ns: 0, title: "Alpha" },
        { pageid: 2, ns: 0, title: "Beta" },
        { pageid: 3, ns: 0, title: "Gamma", redirect: true },
      ]);
      expect(body.continue).toBeUndefined();
    });
    it("continues with eicontinue", async () => {
      const first = await run("list=embeddedin&eititle=Template:Infobox&eilimit=2");
      expect(first.query.embeddedin.map((p: Body) => p.title)).toEqual(["Alpha", "Beta"]);
      expect(first.continue).toEqual({ eicontinue: expect.any(String), continue: "-||" });
      const second = await run(`list=embeddedin&eititle=Template:Infobox&eilimit=2&eicontinue=${encodeURIComponent(first.continue.eicontinue)}`);
      expect(second.query.embeddedin.map((p: Body) => p.title)).toEqual(["Gamma"]);
      expect(second.continue).toBeUndefined();
    });
  });

  describe("list=imageusage", () => {
    it("lists the pages that use a file", async () => {
      const body = await run("list=imageusage&iutitle=File:Cat_photo.png");
      expect(body.query.imageusage).toEqual([
        { pageid: 1, ns: 0, title: "Alpha" },
        { pageid: 2, ns: 0, title: "Beta" },
      ]);
      expect((await run("list=imageusage&iutitle=File:Dog.jpg")).query.imageusage.map((p: Body) => p.title)).toEqual(["Alpha"]);
      expect((await run("list=imageusage&iutitle=File:Cat%20photo.png&iulimit=1")).continue.iucontinue).toBeDefined();
    });
  });

  describe("prop=templates and prop=images", () => {
    it("lists what each page transclutes and uses, with namespaces, titles as File: and continuation", async () => {
      const body = await run("titles=Alpha|Beta&prop=templates|images");
      const [alpha, beta] = body.query.pages;
      expect(alpha.templates).toEqual([{ ns: 828, title: "Module:Util" }, { ns: 10, title: "Template:Infobox" }]);
      expect(beta.templates).toEqual([{ ns: 10, title: "Template:Cite web" }, { ns: 10, title: "Template:Infobox" }]);
      expect(alpha.images).toEqual([{ ns: 6, title: "File:Cat photo.png" }, { ns: 6, title: "File:Dog.jpg" }]);
      expect(beta.images).toEqual([{ ns: 6, title: "File:Cat photo.png" }]);
      const limited = await run("titles=Alpha|Beta&prop=templates&tllimit=1");
      expect(limited.query.pages[0].templates).toHaveLength(1);
      expect(limited.continue.tlcontinue).toBeDefined();
      const second = await run(`titles=Alpha|Beta&prop=templates&tllimit=2&tlcontinue=${encodeURIComponent(limited.continue.tlcontinue)}`);
      expect(second.query.pages[0].templates).toEqual([{ ns: 10, title: "Template:Infobox" }]);
    });
  });

  describe("generators", () => {
    it("generator=templates and generator=images turn what the named pages use into the page set, and continue", async () => {
      const templates = await run("generator=templates&titles=Alpha&prop=info");
      expect(templates.query.pages.map((p: Body) => p.title).sort()).toEqual(["Module:Util", "Template:Infobox"]);
      const first = await run("generator=images&titles=Alpha&gimlimit=1&prop=info");
      expect(first.query.pages.map((p: Body) => [p.title, p.missing ?? false])).toEqual([["File:Cat photo.png", false]]);
      expect(first.continue).toEqual({ gimcontinue: expect.any(String), continue: "gimcontinue||" });
      const second = await run(`generator=images&titles=Alpha&gimlimit=1&gimcontinue=${encodeURIComponent(first.continue.gimcontinue)}&prop=info`);
      expect(second.query.pages.map((p: Body) => [p.title, p.missing ?? false])).toEqual([["File:Dog.jpg", true]]);
      expect(second.continue).toBeUndefined();
    });
  });

  describe("hidden categories", () => {
    it("prop=categories shows MediaWiki's hidden flag, and show=hidden|!hidden filters on it", async () => {
      const all = await run("titles=Alpha&prop=categories&clprop=hidden");
      expect(all.query.pages[0].categories).toEqual([
        { ns: 14, title: "Category:Cats", hidden: false },
        { ns: 14, title: "Category:Maintenance", hidden: true },
      ]);
      expect((await run("titles=Alpha&prop=categories&clshow=hidden")).query.pages[0].categories.map((c: Body) => c.title)).toEqual(["Category:Maintenance"]);
      expect((await run("titles=Alpha&prop=categories&clshow=!hidden")).query.pages[0].categories.map((c: Body) => c.title)).toEqual(["Category:Cats"]);
    });
  });

  describe("page properties from the last render", () => {
    it("prop=pageprops answers what MediaWiki reported, and nothing from the text for a rendered page", async () => {
      const wiki = data();
      wiki.pages![0]!.wikitext = "{{DISPLAYTITLE:from the text}} __NOINDEX__";
      const body = await run("titles=Alpha|Talk:Alpha|Delta&prop=pageprops", wiki);
      expect(body.query.pages[0].pageprops).toEqual({ defaultsort: "Alpha, The", displaytitle: "<i>alpha</i>" });
      expect(body.query.pages[1].pageprops).toBeUndefined(); // rendered, with no properties
      expect(body.query.pages[2].pageprops).toBeUndefined(); // never rendered, none in its text
      expect((await run("titles=Alpha&prop=pageprops&ppprop=defaultsort", wiki)).query.pages[0].pageprops).toEqual({ defaultsort: "Alpha, The" });
    });
    it("sanitizes a DISPLAYTITLE read from the wikitext of a never-rendered page: no markup but a few bare inline tags", async () => {
      const hostile = '{{DISPLAYTITLE:<img src=x onerror=alert(1)><script>alert(2)</script><b onmouseover="x">no</b><i>ok</I> <a href="javascript:1">l</a> \'q\' & more}}';
      const wiki = data();
      wiki.pages!.find((page) => page.title === "Delta")!.wikitext = hostile;
      const expected = "&lt;img src=x onerror=alert(1)&gt;&lt;script&gt;alert(2)&lt;/script&gt;&lt;b onmouseover=&quot;x&quot;&gt;no</b><i>ok</i> &lt;a href=&quot;javascript:1&quot;&gt;l&lt;/a&gt; &#39;q&#39; &amp; more";
      // prop=pageprops
      const props = await run("titles=Delta&prop=pageprops", wiki);
      expect(props.query.pages[0].pageprops.displaytitle).toBe(expected);
      // parse: displaytitle and properties of the page, and of a text (a bot's text= has no stored render either)
      const deps = await makeDeps({ store: fakeWiki(wiki) });
      const parsed = ((await call(deps, "action=parse&page=Delta&prop=displaytitle|properties&formatversion=2")).body as Body).parse;
      expect(parsed.displaytitle).toBe(expected);
      expect(parsed.properties).toEqual([{ name: "displaytitle", value: expected }]);
      const botWiki = await makeWikiDeps(wiki);
      await loggedIn(botWiki.bot);
      const fromText = (await botWiki.bot.post({ action: "parse", text: hostile, prop: "displaytitle|properties", formatversion: "2" })) as Body;
      expect(fromText.parse.displaytitle).toBe(expected);
      for (const output of [props.query.pages[0].pageprops.displaytitle, parsed.displaytitle, fromText.parse.displaytitle]) {
        expect(output).not.toMatch(/<(img|script|a)\b/i);
        expect(output).not.toContain(" onerror=alert(1)>");
      }
      // very long ones are cut, and plain titles are unchanged
      wiki.pages!.find((page) => page.title === "Delta")!.wikitext = `{{DISPLAYTITLE:${"x".repeat(5000)}}}`;
      expect((await run("titles=Delta&prop=pageprops", wiki)).query.pages[0].pageprops.displaytitle).toHaveLength(1000);
      wiki.pages!.find((page) => page.title === "Delta")!.wikitext = "{{DISPLAYTITLE:plain title}}";
      expect((await run("titles=Delta&prop=pageprops", wiki)).query.pages[0].pageprops.displaytitle).toBe("plain title");
    });
  });

  describe("action=parse with the render-derived data", () => {
    async function parse(params: string, grants?: string[]) {
      const wiki = await makeWikiDeps(data(), { grants });
      await loggedIn(wiki.bot);
      const body = (await wiki.bot.get(Object.fromEntries(new URLSearchParams(`action=parse&${params}&formatversion=2`)))) as Body;
      return { body, calls: wiki.calls };
    }
    const anonymous = async (params: string) => {
      const wiki = await makeWikiDeps(data());
      return { body: (await call(wiki.deps, `action=parse&${params}&formatversion=2`)).body as Body, calls: wiki.calls };
    };

    it("lists a page's templates (with exists) and images from its last render, without rendering anything", async () => {
      const { body, calls } = await anonymous("page=Alpha&prop=templates|images");
      expect(body.parse.templates).toEqual([
        { ns: 828, exists: true, title: "Module:Util" },
        { ns: 10, exists: true, title: "Template:Infobox" },
      ]);
      expect(body.parse.images).toEqual(["Cat_photo.png", "Dog.jpg"]);
      expect(calls.filter((c) => c.name === "renderWikitext" || c.name === "ensureRendered")).toEqual([]);
    });
    it("learns a text's templates and images from one render of it", async () => {
      const { body, calls } = await parse("text=%7B%7BInfobox%7D%7D%20%5B%5BFile%3ACat%20photo.png%5D%5D&prop=text|templates|images");
      expect(body.parse.templates).toEqual([{ ns: 10, exists: true, title: "Template:Infobox" }]);
      expect(body.parse.images).toEqual(["Cat_photo.png"]);
      expect(calls.filter((c) => c.name === "renderWikitext")).toHaveLength(1);
    });
  });
});

describe("query: files", () => {
  type Body = Record<string, any>;

  const SHA_A = "a".repeat(40);
  const SHA_B = "b".repeat(40);

  const data = (): FakeWikiData => ({
    pages: [
      { pageId: 20, title: "File:Cat photo.png", namespace: 6 },
      { pageId: 21, title: "File:Dog.svg", namespace: 6 },
      { pageId: 22, title: "File:Ghost.png", namespace: 6 },
      { pageId: 1, title: "Alpha" },
    ],
    files: [
      {
        name: "Cat photo.png",
        pageId: 20,
        url: "https://ixwiki.com/images/c/c9/Cat_photo.png",
        size: 5000,
        width: 640,
        height: 480,
        sha1: SHA_A,
        timestamp: "2026-09-01T10:00:00Z",
        user: "Heku",
        comment: "A cat <b>photo</b>",
      },
      // uploaded in WikiOS, not in MediaWiki yet: a path on this site
      {
        name: "Dog.svg",
        pageId: 21,
        url: "/api/wiki/file/Dog.svg",
        size: 800,
        width: 40,
        height: 20,
        mime: "image/svg+xml",
        sha1: SHA_B,
        timestamp: "2026-09-30T12:00:00Z",
        user: "Mod",
      },
      {
        name: "Eel.pdf",
        url: "/api/wiki/file/Eel.pdf",
        size: 90000,
        width: 0,
        height: 0,
        mime: "application/pdf",
        sha1: SHA_B,
      },
      { name: "Fox.png", sha1: SHA_A, size: 10 },
    ],
  });

  async function run(params: string, wiki: FakeWikiData = data()): Promise<Body> {
    const deps = await makeDeps({ store: fakeWiki(wiki) });
    return (await call(deps, `action=query&${params}&formatversion=2`)).body as Body;
  }

  describe("prop=imageinfo", () => {
    it("gives every prop WikiOS has, in MediaWiki's names, with an absolute URL", async () => {
      const body = await run(
        "titles=File:Cat photo.png|File:Dog.svg&prop=imageinfo&iiprop=timestamp|user|comment|parsedcomment|canonicaltitle|url|size|sha1|mime|mediatype|userid"
      );

      const [cat, dog] = body.query.pages;
      expect(cat.imageinfo[0]).toEqual({
        timestamp: "2026-09-01T10:00:00Z",
        user: "Heku",
        userid: 0,
        comment: "A cat <b>photo</b>",
        parsedcomment: "A cat &lt;b&gt;photo&lt;/b&gt;",
        canonicaltitle: "File:Cat photo.png",
        url: "https://ixwiki.com/images/c/c9/Cat_photo.png",
        descriptionurl: "https://ixwiki.com/wiki/File:Cat_photo.png",
        size: 5000,
        width: 640,
        height: 480,
        sha1: SHA_A,
        mime: "image/png",
        mediatype: "BITMAP",
      });
      // a file only WikiOS has: its URL is on this site, with the public origin in front
      expect(dog.imageinfo[0]).toMatchObject({
        url: "https://ixwiki.com/api/wiki/file/Dog.svg",
        descriptionurl: "https://ixwiki.com/wiki/File:Dog.svg",
        mime: "image/svg+xml",
        mediatype: "DRAWING",
      });
    });
    it("answers a file that has an asset but no page (the page is `missing`, the file is there)", async () => {
      const body = await run("titles=File:Fox.png&prop=imageinfo&iiprop=size|sha1");

      expect(body.query.pages[0]).toMatchObject({
        missing: true,
        imagerepository: "local",
        imageinfo: [{ size: 10, sha1: SHA_A }],
      });
    });
  });

  describe("list=allimages", () => {
    it("lists the files in name order with MediaWiki's fields, underscores in `name`", async () => {
      const body = await run("list=allimages");

      expect(body.query.allimages.map((file: Body) => file.name)).toEqual([
        "Cat_photo.png",
        "Dog.svg",
        "Eel.pdf",
        "Fox.png",
      ]);
      expect(body.query.allimages[0]).toEqual({
        name: "Cat_photo.png",
        title: "File:Cat photo.png",
        timestamp: "2026-09-01T10:00:00Z",
        url: "https://ixwiki.com/images/c/c9/Cat_photo.png",
        descriptionurl: "https://ixwiki.com/wiki/File:Cat_photo.png",
      });
    });
    it("continues by name, ascending and descending", async () => {
      const first = await run("list=allimages&ailimit=2&aiprop=");
      expect(first.query.allimages.map((file: Body) => file.name)).toEqual([
        "Cat_photo.png",
        "Dog.svg",
      ]);
      expect(first.continue).toEqual({ aicontinue: "Eel.pdf", continue: "-||" });

      const second = await run(
        `list=allimages&ailimit=2&aiprop=&aicontinue=${first.continue.aicontinue}`
      );
      expect(second.query.allimages.map((file: Body) => file.name)).toEqual(["Eel.pdf", "Fox.png"]);
      expect(second.continue).toBeUndefined();

      const down = await run("list=allimages&ailimit=2&aidir=descending&aiprop=");
      expect(down.query.allimages.map((file: Body) => file.name)).toEqual(["Fox.png", "Eel.pdf"]);
      expect(down.continue.aicontinue).toBe("Dog.svg");
    });

    it("filters by prefix, name range, sha1 (hex or base 36), mime and size", async () => {
      const names = async (params: string) =>
        (await run(`list=allimages&aiprop=&${params}`)).query.allimages.map(
          (file: Body) => file.name
        );

      expect(await names("aiprefix=Ca")).toEqual(["Cat_photo.png"]);
      expect(await names("aifrom=Dog&aito=Eel.pdf")).toEqual(["Dog.svg", "Eel.pdf"]);
      expect(await names(`aisha1=${SHA_A}`)).toEqual(["Cat_photo.png", "Fox.png"]);
      expect(await names("aimime=application/pdf|image/svg%2Bxml")).toEqual(["Dog.svg", "Eel.pdf"]);
      expect(await names("aiminsize=1000&aimaxsize=6000")).toEqual(["Cat_photo.png"]);
    });

    it("refuses a bad sha1, both sha1 forms at once, and a continue that names no file", async () => {
      expect((await run("list=allimages&aisha1=xyz")).error.code).toBe("badvalue");
      expect((await run(`list=allimages&aisha1=${SHA_A}&aisha1base36=abc`)).error.code).toBe(
        "invalidparammix"
      );
      expect((await run("list=allimages&aicontinue=Bad|Name")).error.code).toBe("badcontinue");
    });
  });
});

describe("meta: paraminfo", () => {
  type Body = Record<string, any>;

  const DATA = (): FakeWikiData => ({
    pages: [
      { pageId: 1, title: "Alpha" },
      { pageId: 2, title: "Beta", redirect: "Alpha" },
    ],
    revisions: [{ revId: 1, page: "Alpha", timestamp: "2026-01-01T00:00:00Z", content: "a" }],
  });

  async function info(params: string): Promise<Body> {
    const deps = await makeDeps({ store: fakeWiki(DATA()) });
    return (await call(deps, `action=paraminfo&${params}&formatversion=2`)).body as Body;
  }

  const parameter = (entry: Body, name: string): Body => entry.parameters.find((p: Body) => p.name === name);

  describe("action=paraminfo", () => {
    it("describes a list module the way Pywikibot's QueryGenerator reads it", async () => {
      const body = await info("modules=query%2Ballpages");
      const [allpages] = body.paraminfo.modules;
      expect(allpages).toMatchObject({ name: "allpages", path: "query+allpages", group: "list", prefix: "ap" });
      expect(allpages.classname).toEqual(expect.any(String));
      expect(parameter(allpages, "limit")).toMatchObject({ type: "limit", min: 1, max: 500, highmax: 5000, default: "10" });
      expect(parameter(allpages, "namespace")).toMatchObject({ type: "namespace", default: "0" });
      expect(parameter(allpages, "dir")).toMatchObject({ type: ["ascending", "descending"] });
      expect(parameter(allpages, "filterredir")).toMatchObject({ type: ["all", "redirects", "nonredirects"] });
    });
    it("describes every module it lists with the parameters the module reads (no hand-kept table)", async () => {
      const registry = buildRegistry(ACTIONS);
      const names = registry.map((m) => m.path);
      expect(names).toEqual(expect.arrayContaining(["login", "edit", "parse", "compare", "paraminfo", "purge", "tokens", "query+search", "query+revisions", "query+allcategories"]));
      const search = await registry.find((m) => m.path === "query+search")!.describe();
      expect(search.prefix).toBe("sr");
      expect(search.parameters.map((p) => p.name)).toEqual(expect.arrayContaining(["search", "namespace", "limit", "offset", "what"]));
      const edit = await registry.find((m) => m.path === "edit")!.describe();
      expect(edit.parameters.map((p) => p.name)).toEqual(expect.arrayContaining(["title", "pageid", "text", "appendtext", "prependtext", "section", "summary", "minor", "token", "baserevid"]));
    });

    it("cannot be used to run a module: it reads no store and writes nothing", async () => {
      const wiki = await makeWikiDeps(DATA());
      await info("modules=edit|move|delete|protect|rollback|undelete|purge|login|logout|parse|compare");
      expect(wiki.calls).toEqual([]);
    });
  });
});

describe("the wire format, errors and continuation", () => {
  describe("toWire", () => {
    const result = {
      query: {
        pages: [{ title: "A", missing: true, redirect: false, content: { ns: 0 } }],
        skipped: undefined,
      },
      batchcomplete: true,
    };

    it("formatversion=1 shows a true boolean as the empty string and leaves a false one out", () => {
      expect(toWire(result, 1)).toEqual({
        query: { pages: [{ title: "A", missing: "", content: { ns: 0 } }] },
        batchcomplete: "",
      });
    });
  });
  describe("errorBody", () => {
    const error = new ApiError("badtoken", "Invalid CSRF token.");

    it("answers the bc envelope by default, for both format versions", () => {
      const expected = { error: { code: "badtoken", info: "Invalid CSRF token.", "*": API_DOCREF } };
      expect(errorBody(error, 1)).toEqual(expected);
      expect(errorBody(error, 2)).toEqual(expected);
    });

    it("answers the errors array for the newer error formats", () => {
      expect(errorBody(error, 2, "plaintext")).toEqual({
        errors: [{ code: "badtoken", text: "Invalid CSRF token.", module: "main" }],
        docref: API_DOCREF,
      });
      expect(errorBody(error, 1, "wikitext")).toEqual({
        errors: [{ code: "badtoken", "*": "Invalid CSRF token.", module: "main" }],
        docref: API_DOCREF,
      });
    });
  });
  describe("cursors", () => {
    it("round-trips parts that hold the separator and non-ASCII text", () => {
      const raw = encodeCursor(["Foo|Bar é", 42]);
      expect(raw.split("|")).toHaveLength(2);
      expect(decodeCursor(raw, ["s", "n"] as const)).toEqual(["Foo|Bar é", 42]);
    });

    it("refuses a malformed cursor with badcontinue", () => {
      expect(() => decodeCursor("only-one", ["s", "n"] as const)).toThrow(badContinue().message);
      expect(() => decodeCursor("a|notanumber", ["s", "n"] as const)).toThrow(ApiError);
      expect(() => decodeCursor("%E0%A4%A|1", ["s", "n"] as const)).toThrow(ApiError);
    });
  });
  describe("Continuation", () => {
    it("continues a list with the generic -|| marker and still reports batchcomplete", () => {
      const continuation = new Continuation();
      continuation.add("apcontinue", "Foo");
      expect(continuation.toResult()).toEqual({
        batchcomplete: true,
        continue: { apcontinue: "Foo", continue: "-||" },
      });
    });

    it("withholds batchcomplete while a prop has more for the current page set", () => {
      const continuation = new Continuation();
      continuation.addProp("rvcontinue", "20260930123456|7");
      expect(continuation.toResult()).toEqual({
        continue: { rvcontinue: "20260930123456|7", continue: "||" },
      });
    });
  });
});

describe("parameters", () => {
  const params = (query: string, warn = jest.fn()) => ({
    p: ApiParams.from(new URLSearchParams(query).entries(), warn),
    warn,
  });

  function codeOf(run: () => unknown): string | undefined {
    try {
      run();
    } catch (error) {
      return error instanceof ApiError ? error.code : "other";
    }
    return undefined;
  }

  describe("splitMultiValue", () => {
    it("uses U+001F as the separator when the value starts with it, so a value may hold a pipe", () => {
      expect(splitMultiValue("\u001fa|b\u001fc")).toEqual(["a|b", "c"]);
    });
  });

  describe("ApiParams", () => {
    it("lets a POST body override the query string", () => {
      const merged = parseRequestParams(new URLSearchParams("a=1&b=2"), [["a", "3"]]);
      expect(merged.string("a")).toBe("3");
      expect(merged.string("b")).toBe("2");
    });
    it("reports a missing required parameter", () => {
      const { p } = params("");
      expect(codeOf(() => p.required("title"))).toBe("missingparam");
    });

    describe("integer and limit", () => {
      it("answers `max` with 500, or 5000 for apihighlimits", () => {
        const { p } = params("aplimit=max");
        const scoped = p.scope("ap", "allpages");
        expect(scoped.limit("limit", { fallback: 10, high: false })).toBe(NORMAL_LIMIT);
        expect(scoped.limit("limit", { fallback: 10, high: true })).toBe(HIGH_LIMIT);
      });

      it("caps an explicit number at the caller's limit and warns", () => {
        const { p, warn } = params("aplimit=9000");
        const scoped = p.scope("ap", "allpages");
        expect(scoped.limit("limit", { fallback: 10, high: false })).toBe(500);
        expect(warn).toHaveBeenCalledWith("allpages", expect.stringContaining("aplimit"));
        expect(scoped.limit("limit", { fallback: 10, high: true })).toBe(5000);
      });
    });

    describe("lists", () => {
      it("returns the values, and refuses more than the limit with toomanyvalues", () => {
        const { p } = params("titles=A|B|C");
        expect(p.list("titles")).toEqual(["A", "B", "C"]);
        expect(codeOf(() => p.list("titles", 2))).toBe("toomanyvalues");
      });
    });

    describe("timestamp", () => {
      const now = new Date("2026-09-30T00:00:00Z");

      it("reads ISO 8601, the 14-digit form and `now`", () => {
        expect(params("t=2026-01-02T03:04:05Z").p.timestamp("t", now)?.toISOString()).toBe(
          "2026-01-02T03:04:05.000Z"
        );
        expect(params("t=20260102030405").p.timestamp("t", now)?.toISOString()).toBe(
          "2026-01-02T03:04:05.000Z"
        );
        expect(params("t=now").p.timestamp("t", now)).toBe(now);
        expect(params("").p.timestamp("t", now)).toBeUndefined();
      });

      it("rejects anything else with badtimestamp", () => {
        expect(codeOf(() => params("t=yesterday").p.timestamp("t", now))).toBe("badtimestamp");
      });
    });
  });
});

describe("scanning a page that was never rendered", () => {
  describe("linkTargets", () => {
    it("skips targets with a line break or longer than a title, and links that never close", () => {
      expect(linkTargets(`[[a\nb]] [[${"x".repeat(400)}]] [[open`, 100)).toEqual([]);
    });
  });

  describe("categoryLinks", () => {
    it("stops at the cap and ignores a Category keyword that is not followed by a colon", () => {
      expect(categoryLinks("[[Category:A]][[Category:B]][[Category:C]]", 2).map((c) => c.name)).toEqual(["A", "B"]);
      expect(categoryLinks("[[Categories:A]] [[Category A]]", 10)).toEqual([]);
    });
  });

  describe("externalUrls and visibleText", () => {
    it("lists distinct addresses up to the cap, ending at the markup", () => {
      expect(externalUrls("see https://a.org/x [http://b.org y] and https://a.org/x again <ref>https://c.org</ref>", 10)).toEqual([
        "https://a.org/x",
        "http://b.org",
        "https://c.org",
      ]);
      expect(externalUrls("http://a http://b http://c", 2)).toEqual(["http://a", "http://b"]);
    });
  });
});
