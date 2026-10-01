/** @jest-environment node */
/**
 * Plan 410: page selectors (titles, pageids, revids, redirects, normalized) and the prop modules
 * (info, revisions, categories, links, pageprops), in both format versions, with continuation.
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { call, fakeSha1Hex, fakeWiki, makeDeps, type FakeWikiData } from "./harness";

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

  it("selects by page id, and keeps an unknown id as missing", async () => {
    const body = await query("pageids=2|999&formatversion=2");
    expect(body.query.pages).toEqual([{ pageid: 2, ns: 0, title: "Beta" }, { pageid: 999, missing: true }]);
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

  it("indexpageids adds the list of keys", async () => {
    const body = await query("titles=Alpha|Nope&indexpageids&formatversion=2");
    expect(body.query.pageids).toEqual(["1", "-1"]);
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

  it("adds protection, related page ids, urls and the display title", async () => {
    const body = await query("titles=Alpha|Talk:Alpha|Nope&prop=info&inprop=protection|talkid|subjectid|url|displaytitle&formatversion=2");
    const [alpha, talk, nope] = body.query.pages as Body[];
    expect(alpha.protection).toEqual([
      { type: "edit", level: "sysop", expiry: "infinity" },
      { type: "move", level: "autoconfirmed", expiry: "2030-01-01T00:00:00Z" },
    ]);
    expect(alpha.restrictiontypes).toEqual(["edit", "move"]);
    expect(alpha.talkid).toBe(5);
    expect(talk.subjectid).toBe(1);
    expect(alpha.fullurl).toBe("https://ixwiki.com/wiki/Alpha");
    expect(talk.fullurl).toBe("https://ixwiki.com/wiki/Talk:Alpha");
    expect(alpha.editurl).toBe("https://ixwiki.com/w/index.php?title=Alpha&action=edit");
    expect(alpha.displaytitle).toBe("Alpha");
    // a missing page: no revision fields, create protection
    expect(nope).toMatchObject({ missing: true, contentmodel: "wikitext", protection: [{ type: "create", level: "sysop", expiry: "infinity" }], restrictiontypes: ["create"] });
    expect(nope.lastrevid).toBeUndefined();
  });

  it("rejects an unknown inprop", async () => {
    expect((await query("titles=Alpha&prop=info&inprop=nope")).error.code).toBe("badvalue");
  });
});

describe("prop=revisions", () => {
  it("answers the default props of the newest revision", async () => {
    const body = await query("titles=Alpha&prop=revisions&formatversion=2");
    expect(body.query.pages[0].revisions).toEqual([
      { revid: 103, parentid: 102, minor: false, user: "Heku", timestamp: "2026-01-03T10:00:00Z", comment: "more <b>" },
    ]);
    const v1 = await query("titles=Alpha&prop=revisions");
    expect(v1.query.pages["1"].revisions).toEqual([
      { revid: 103, parentid: 102, user: "Heku", timestamp: "2026-01-03T10:00:00Z", comment: "more <b>" },
    ]);
  });

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

  it("falls back to the legacy shape, with MediaWiki's warning, when rvslots is absent", async () => {
    const v1 = await query("titles=Alpha&prop=revisions&rvprop=content");
    expect(v1.query.pages["1"].revisions[0]).toEqual({
      contentformat: "text/x-wiki",
      contentmodel: "wikitext",
      "*": "Alpha v3 [[Beta]]",
    });
    expect(v1.warnings.revisions["*"]).toContain("rvslots");
    const v2 = await query("titles=Alpha&prop=revisions&rvprop=content&formatversion=2");
    expect(v2.query.pages[0].revisions[0].content).toBe("Alpha v3 [[Beta]]");
    expect(v2.warnings.revisions.warnings).toContain("rvslots");
  });

  it("gives every other revision prop", async () => {
    const body = await query("titles=Alpha&prop=revisions&rvprop=ids|flags|user|userid|size|sha1|comment|parsedcomment|tags|slotsize|slotsha1&rvslots=main&formatversion=2");
    expect(body.query.pages[0].revisions[0]).toEqual({
      revid: 103,
      parentid: 102,
      minor: false,
      user: "Heku",
      userid: 7,
      size: 17,
      sha1: fakeSha1Hex(103),
      comment: "more <b>",
      parsedcomment: "more &lt;b&gt;",
      tags: [],
      slots: { main: { size: 17, sha1: fakeSha1Hex(103) } },
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

  it("walks rvdir=newer with rvstart, rvend, rvstartid and rvendid", async () => {
    const ids = async (extra: string) =>
      (await query(`titles=Alpha&prop=revisions&rvprop=ids&rvlimit=max&${extra}&formatversion=2`)).query.pages[0].revisions.map((r: Body) => r.revid);
    expect(await ids("rvdir=newer")).toEqual([101, 102, 103]);
    expect(await ids("rvdir=newer&rvstart=2026-01-02T00:00:00Z")).toEqual([102, 103]);
    expect(await ids("rvdir=newer&rvstart=2026-01-02T00:00:00Z&rvend=2026-01-02T23:59:59Z")).toEqual([102]);
    expect(await ids("rvstart=2026-01-02T23:00:00Z")).toEqual([102, 101]);
    expect(await ids("rvstartid=102")).toEqual([102, 101]);
    expect(await ids("rvdir=newer&rvstartid=102&rvendid=102")).toEqual([102]);
    expect((await query("titles=Alpha&prop=revisions&rvstartid=9999")).error.code).toBe("nosuchrevid");
  });

  it("filters by rvuser and rvexcludeuser", async () => {
    const ids = async (extra: string) =>
      (await query(`titles=Alpha&prop=revisions&rvprop=ids&rvlimit=max&${extra}&formatversion=2`)).query.pages[0].revisions.map((r: Body) => r.revid);
    expect(await ids("rvuser=Tester")).toEqual([102]);
    expect(await ids("rvexcludeuser=Heku")).toEqual([102]);
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

  it("flags anonymous editors", async () => {
    const body = await query("titles=Hidden&prop=revisions&rvprop=user&rvlimit=2&formatversion=2");
    // 801's author is an IP; its user is not hidden for the `user` prop (only 802's is)
    const anon = (body.query.pages[0].revisions as Body[]).find((r) => r.user === "1.2.3.4");
    expect(anon).toMatchObject({ user: "1.2.3.4", anon: true });
  });

  it("refuses an unknown rvprop and rvslots role", async () => {
    expect((await query("titles=Alpha&prop=revisions&rvprop=nope")).error.code).toBe("badvalue");
    expect((await query("titles=Alpha&prop=revisions&rvprop=content&rvslots=other")).error.code).toBe("badvalue");
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

  it("supports clprop, clcategories and clshow", async () => {
    const body = await query("titles=Alpha&prop=categories&clprop=sortkey|timestamp|hidden&clcategories=Category:Cats&formatversion=2");
    expect(body.query.pages[0].categories).toEqual([
      { ns: 14, title: "Category:Cats", sortkey: Buffer.from("CATS").toString("hex"), sortkeyprefix: "", timestamp: "2026-01-01T00:00:00Z", hidden: false },
    ]);
    // no category is hidden yet
    expect((await query("titles=Alpha&prop=categories&clshow=hidden&formatversion=2")).query.pages[0].categories).toBeUndefined();
    expect((await query("titles=Alpha&prop=categories&clshow=!hidden&formatversion=2")).query.pages[0].categories).toHaveLength(2);
  });

  it("lists links with their namespace, filters them and continues", async () => {
    const body = await query("titles=Alpha&prop=links&pllimit=max&formatversion=2");
    expect(body.query.pages[0].links).toEqual([
      { ns: 0, title: "Beta" },
      { ns: 0, title: "Eta" },
      { ns: 10, title: "Template:Foo" },
      { ns: 0, title: "Zeta" },
    ].sort((a, b) => a.title.toLowerCase().replace(/ /g, "_").localeCompare(b.title.toLowerCase().replace(/ /g, "_"))));
    const filtered = await query("titles=Alpha&prop=links&plnamespace=10&formatversion=2");
    expect(filtered.query.pages[0].links).toEqual([{ ns: 10, title: "Template:Foo" }]);
    const titles = await query("titles=Alpha&prop=links&pltitles=Beta|Nothing&formatversion=2");
    expect(titles.query.pages[0].links).toEqual([{ ns: 0, title: "Beta" }]);

    const first = await query("titles=Alpha&prop=links&pllimit=3&formatversion=2");
    expect(first.query.pages[0].links).toHaveLength(3);
    const second = await query(`titles=Alpha&prop=links&pllimit=3&plcontinue=${encodeURIComponent(first.continue.plcontinue)}&formatversion=2`);
    expect(second.query.pages[0].links).toHaveLength(1);
    expect(second.continue).toBeUndefined();
  });

  it("refuses a malformed continue value", async () => {
    expect((await query("titles=Alpha&prop=links&plcontinue=garbage")).error.code).toBe("badcontinue");
  });
});

describe("prop=pageprops, deferred and unknown props", () => {
  it("reads DISPLAYTITLE, DEFAULTSORT and behaviour switches from the page's wikitext", async () => {
    const body = await query("titles=Alpha|Beta&prop=pageprops&formatversion=2");
    expect(body.query.pages[0].pageprops).toEqual({ displaytitle: "alpha", defaultsort: "Alpha, The", noindex: "" });
    expect(body.query.pages[1].pageprops).toBeUndefined();
    const filtered = await query("titles=Alpha&prop=pageprops&ppprop=defaultsort&formatversion=2");
    expect(filtered.query.pages[0].pageprops).toEqual({ defaultsort: "Alpha, The" });
  });

  it("answers badvalue for the modules that need plan 406's tables, and for unknown props", async () => {
    for (const prop of ["templates", "images"]) {
      const body = await query(`titles=Alpha&prop=${prop}`);
      expect(body.error.code).toBe("badvalue");
      expect(body.error.info).toContain("plan 406");
    }
    expect((await query("titles=Alpha&prop=extracts")).error.code).toBe("badvalue");
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

  it("answers badvalue for generators that need plan 406's tables", async () => {
    expect((await query("generator=embeddedin&geititle=Template:Foo")).error.code).toBe("badvalue");
    expect((await query("generator=templates&titles=Alpha")).error.code).toBe("badvalue");
  });
});
