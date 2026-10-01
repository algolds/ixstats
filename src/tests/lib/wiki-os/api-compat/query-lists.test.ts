/** @jest-environment node */
/** Plan 410: list modules and generators, with continuation walked to the end. */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { call, fakeSha1Hex, fakeWiki, makeDeps, type FakeWikiData } from "./harness";
import type { ApiDeps } from "~/lib/wiki-os/api-compat/types";

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

  it("filters by apfrom, apto, apprefix, apfilterredir and apdir", async () => {
    expect(titles((await run("list=allpages&apfrom=beta&apto=Epsilon")).query.allpages)).toEqual(["Beta", "Delta", "Epsilon"]);
    expect(titles((await run("list=allpages&apprefix=E")).query.allpages)).toEqual(["Epsilon"]);
    expect(titles((await run("list=allpages&apfilterredir=redirects")).query.allpages)).toEqual(["Gamma"]);
    expect(titles((await run("list=allpages&apfilterredir=nonredirects&apdir=descending&aplimit=2")).query.allpages)).toEqual(["Epsilon", "Delta"]);
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

  it("formatversion=1 gives the same list", async () => {
    const deps = await makeDeps({ store: fakeWiki(DATA) });
    const body = (await call(deps, "action=query&list=allpages&aplimit=1")).body as Body;
    expect(body.query.allpages).toEqual([{ pageid: 1, ns: 0, title: "Alpha" }]);
    expect(body.continue).toEqual({ apcontinue: "Beta", continue: "-||" });
    expect(body.batchcomplete).toBe("");
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

  it("generator=categorymembers, backlinks and random work", async () => {
    expect((await run("generator=categorymembers&gcmtitle=Category:Cats&gcmlimit=max&prop=info")).query.pages.map((p: Body) => p.title).sort()).toEqual(
      ["Alpha", "Beta", "Category:Cats", "Delta", "Epsilon", "File:Cat.png"].sort()
    );
    expect((await run("generator=backlinks&gbltitle=Alpha&gbllimit=max&prop=info")).query.pages.map((p: Body) => p.title)).toEqual(["Beta", "Gamma", "Delta"].sort((a, b) => ({ Beta: 2, Gamma: 3, Delta: 4 } as Record<string, number>)[a]! - ({ Beta: 2, Gamma: 3, Delta: 4 } as Record<string, number>)[b]!));
    expect((await run("generator=random&grnlimit=2&prop=info")).query.pages).toHaveLength(2);
  });

  it("refuses an unknown generator and a list module that is not a generator", async () => {
    expect((await run("generator=nope")).error.code).toBe("badvalue");
    expect((await run("generator=allusers")).error.code).toBe("badvalue");
  });
});

describe("list=categorymembers", () => {
  it("lists members by sort key (the title when there is none), with pageid, ns and title", async () => {
    const body = await run("list=categorymembers&cmtitle=category:cats&cmlimit=max");
    // sort values: Beta=aa, Alpha=zz, the rest by title
    expect(titles(body.query.categorymembers)).toEqual(["Beta", "Category:Cats", "Delta", "Epsilon", "File:Cat.png", "Alpha"]);
    expect(body.query.categorymembers[0]).toEqual({ pageid: 2, ns: 0, title: "Beta" });
  });

  it("filters by cmtype and cmnamespace, and reports the type", async () => {
    const files = await run("list=categorymembers&cmtitle=Category:Cats&cmtype=file&cmprop=ids|title|type");
    expect(files.query.categorymembers).toEqual([{ pageid: 21, ns: 6, title: "File:Cat.png", type: "file" }]);
    expect(titles((await run("list=categorymembers&cmtitle=Category:Cats&cmtype=subcat")).query.categorymembers)).toEqual(["Category:Cats"]);
    expect(titles((await run("list=categorymembers&cmtitle=Category:Cats&cmnamespace=0&cmlimit=max")).query.categorymembers)).toEqual(["Beta", "Delta", "Epsilon", "Alpha"]);
  });

  it("supports sortkey props, sorting by timestamp and cmdir", async () => {
    const body = await run("list=categorymembers&cmtitle=Category:Cats&cmprop=title|sortkey|sortkeyprefix|timestamp&cmtype=page&cmlimit=1");
    expect(body.query.categorymembers[0]).toEqual({
      ns: 0,
      title: "Beta",
      sortkey: Buffer.from("AA").toString("hex"),
      sortkeyprefix: "aa",
      timestamp: expect.stringMatching(/^2026-02-0\dT00:00:00Z$/),
    });
    const byTime = await run("list=categorymembers&cmtitle=Category:Cats&cmsort=timestamp&cmdir=desc&cmtype=page&cmlimit=max");
    const stamps = (await run("list=categorymembers&cmtitle=Category:Cats&cmsort=timestamp&cmdir=desc&cmtype=page&cmlimit=max&cmprop=timestamp")).query.categorymembers.map((m: Body) => m.timestamp);
    expect([...stamps].sort().reverse()).toEqual(stamps);
    expect(byTime.query.categorymembers).toHaveLength(4);
  });

  it("walks the whole category with cmcontinue", async () => {
    const pages = await walk("list=categorymembers&cmtitle=Category:Cats&cmlimit=2", "categorymembers");
    expect(pages.flat().map((m) => m.title)).toEqual(["Beta", "Category:Cats", "Delta", "Epsilon", "File:Cat.png", "Alpha"]);
    expect(pages).toHaveLength(3);
  });

  it("takes a page id, and refuses a missing page, a non-category and a missing title", async () => {
    expect((await run("list=categorymembers&cmpageid=20&cmlimit=max")).query.categorymembers).toHaveLength(6);
    expect((await run("list=categorymembers&cmpageid=999")).error.code).toBe("nosuchpageid");
    expect((await run("list=categorymembers&cmtitle=Alpha")).error.code).toBe("invalidcategory");
    expect((await run("list=categorymembers")).error.code).toBe("missingparam");
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

  it("continues with blcontinue", async () => {
    const pages = await walk("list=backlinks&bltitle=Alpha&bllimit=2", "backlinks");
    expect(pages.map(titles)).toEqual([["Beta", "Gamma"], ["Delta"]]);
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

  it("answers the default props (title, timestamp, ids)", async () => {
    const body = await run("list=recentchanges&rclimit=1&rctype=edit");
    expect(Object.keys(body.query.recentchanges[0]).sort()).toEqual(["ns", "old_revid", "pageid", "rcid", "revid", "timestamp", "title", "type"]);
  });

  it("shows users, flags, sizes, comments and sha1 on request", async () => {
    const body = await run("list=recentchanges&rctype=edit|new&rclimit=max&rcprop=user|userid|flags|sizes|comment|parsedcomment|sha1|tags");
    const [newest, anon] = body.query.recentchanges as Body[];
    expect(newest).toEqual({
      type: "edit",
      user: "Heku",
      userid: 7,
      bot: false,
      new: false,
      minor: false,
      oldlen: 6,
      newlen: 8,
      comment: "edit A again <3",
      parsedcomment: "edit A again &lt;3",
      sha1: fakeSha1Hex(15),
      tags: [],
    });
    expect(anon).toMatchObject({ type: "new", user: "1.2.3.4", anon: true, new: true });
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

  it("filters by rctype, rcnamespace, rcuser, rcexcludeuser and rcshow", async () => {
    const kinds = async (extra: string) =>
      (await run(`list=recentchanges&rclimit=max&rcprop=ids&${extra}`)).query.recentchanges.map((c: Body) => `${c.type}${c.logid ?? c.revid}`);
    expect(await kinds("rctype=log")).toEqual(["log3", "log2", "log1"]);
    expect(await kinds("rctype=new")).toEqual(["new14", "new12", "new11"]);
    expect(await kinds("rctype=edit")).toEqual(["edit15", "edit13"]);
    expect(await kinds("rcuser=Tester&rctype=edit|new")).toEqual(["edit13", "new12"]);
    expect(await kinds("rcexcludeuser=Heku&rctype=edit|new")).toEqual(["new14", "edit13", "new12"]);
    expect(await kinds("rcshow=minor")).toEqual(["new12"]);
    expect(await kinds("rcshow=!minor&rctype=edit|new")).toEqual(["edit15", "new14", "edit13", "new11"]);
    expect(await kinds("rcshow=anon&rctype=edit|new")).toEqual(["new14"]);
    expect(await kinds("rcshow=bot")).toEqual([]);
    expect(await kinds("rcnamespace=2")).toEqual(["log3"]);
    expect((await run("list=recentchanges&rcshow=minor|!minor")).error.code).toBe("show");
    expect((await run("list=recentchanges&rcshow=patrolled")).error.code).toBe("badvalue");
  });

  it("limits to a time range", async () => {
    const body = await run("list=recentchanges&rclimit=max&rcprop=ids&rcstart=2026-03-04T12:00:00Z&rcend=2026-03-02T11:00:00Z&rctype=edit|new|log");
    expect(body.query.recentchanges.map((c: Body) => `${c.type}${c.logid ?? c.revid}`)).toEqual(["new14", "edit13", "log2", "log1"]);
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

  it("adds sizediff and parsedcomment, filters with ucshow and walks with uccontinue", async () => {
    const withDiff = await run("list=usercontribs&ucuser=Heku&ucprop=ids|sizediff|parsedcomment|tags&uclimit=1");
    expect(withDiff.query.usercontribs[0]).toMatchObject({ revid: 15, sizediff: 2, parsedcomment: "edit A again &lt;3", tags: [] });
    const pages = await walk("list=usercontribs&ucuser=Heku&uclimit=1&ucprop=ids", "usercontribs");
    expect(pages.flat().map((c) => c.revid)).toEqual([15, 11]);
    expect((await run("list=usercontribs&ucuser=Heku&ucshow=new&ucprop=ids")).query.usercontribs.map((c: Body) => c.revid)).toEqual([11]);
    expect((await run("list=usercontribs&ucuser=Heku&ucshow=!top&ucprop=ids")).query.usercontribs.map((c: Body) => c.revid)).toEqual([11]);
    expect((await run("list=usercontribs&ucuser=Tester|Heku&ucdir=newer&ucprop=ids&uclimit=max")).query.usercontribs.map((c: Body) => c.revid)).toEqual([11, 12, 13, 15]);
    expect((await run("list=usercontribs&ucuser=Tester&ucshow=minor&ucprop=ids")).query.usercontribs.map((c: Body) => c.revid)).toEqual([12]);
    expect((await run("list=usercontribs")).error.code).toBe("missingparam");
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

  it("filters by letype, leaction, letitle, leuser and ledir, and continues", async () => {
    const ids = async (extra: string) => (await run(`list=logevents&lelimit=max&leprop=ids&${extra}`)).query.logevents.map((e: Body) => e.logid);
    expect(await ids("letype=move")).toEqual([2]);
    expect(await ids("leaction=block/block")).toEqual([3]);
    expect(await ids("letitle=Alpha")).toEqual([2]);
    expect(await ids("leuser=Heku&ledir=newer")).toEqual([1, 2, 3]);
    expect(await ids("lestart=2026-03-04T00:00:00Z")).toEqual([2, 1]);
    const pages = await walk("list=logevents&lelimit=1&leprop=ids", "logevents");
    expect(pages.flat().map((e) => e.logid)).toEqual([3, 2, 1]);
    expect((await run("list=logevents&letype=nonsense")).error.code).toBe("badvalue");
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

  it("continues with sroffset, picks the title search, and warns about other namespaces", async () => {
    const first = await run("list=search&srsearch=letter&srlimit=1&srwhat=title&srnamespace=0|10&srprop=snippet", { search });
    expect(search).toHaveBeenCalledWith("letter", "title", 1, 0);
    expect(first.continue).toEqual({ sroffset: "1", continue: "-||" });
    expect(first.warnings.search.warnings).toContain("main namespace");
    const second = await run("list=search&srsearch=letter&srlimit=1&sroffset=1", { search });
    expect(second.query.search.map((h: Body) => h.title)).toEqual(["Beta"]);
  });

  it("requires a search term, and feeds generator=search", async () => {
    expect((await run("list=search", { search })).error.code).toBe("missingparam");
    const body = await run("generator=search&gsrsearch=letter&gsrlimit=max&prop=info", { search });
    expect(body.query.pages.map((p: Body) => p.title)).toEqual(["Alpha", "Beta"]);
  });
});

describe("list=allcategories, allusers, blocks, protectedtitles, random", () => {
  it("lists categories as {'*': name} (v1) or {category: name} (v2), with sizes", async () => {
    expect((await run("list=allcategories&aclimit=max")).query.allcategories).toEqual([{ category: "Cats" }, { category: "Dogs" }]);
    const deps = await makeDeps({ store: fakeWiki(DATA) });
    const v1 = (await call(deps, "action=query&list=allcategories&acprop=size|hidden&aclimit=1")).body as Body;
    expect(v1.query.allcategories).toEqual([{ "*": "Cats", size: 6, pages: 6, files: 0, subcats: 0 }]);
    expect(v1.continue).toEqual({ accontinue: "Dogs", continue: "-||" });
    expect((await run("list=allcategories&acprefix=D")).query.allcategories).toEqual([{ category: "Dogs" }]);
  });

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

  it("lists the blocks in force", async () => {
    const body = await run("list=blocks&bklimit=1");
    expect(body.query.blocks).toEqual([
      { user: "Spammer", by: "Heku", timestamp: "2026-03-01T00:00:00Z", expiry: "infinity", reason: "spam", automatic: false, anononly: false, nocreate: false, autoblock: false, noemail: false, hidden: false, allowusertalk: true, partial: false },
    ]);
    expect(body.continue).toEqual({ bkcontinue: "block-id-1", continue: "-||" });
    expect((await run("list=blocks&bklimit=1&bkcontinue=block-id-1")).query.blocks[0].user).toBe("Troll");
    expect((await run("list=blocks&bkcontinue=%24%25")).error.code).toBe("badcontinue");
    expect((await run("list=blocks&bkdir=newer")).error.code).toBe("badvalue");
  });

  it("lists create-protected titles", async () => {
    const body = await run("list=protectedtitles&ptprop=timestamp|level|user|comment|expiry&ptlimit=max");
    expect(body.query.protectedtitles).toEqual([
      { ns: 0, title: "Never", timestamp: "2026-03-02T00:00:00Z", user: "", comment: "", expiry: "2030-01-01T00:00:00Z", level: "autoconfirmed" },
      { ns: 0, title: "Nope", timestamp: "2026-03-01T00:00:00Z", user: "Heku", comment: "salted", expiry: "infinity", level: "sysop" },
    ]);
    expect((await run("list=protectedtitles&ptlevel=sysop&ptprop=level")).query.protectedtitles).toEqual([{ ns: 0, title: "Nope", level: "sysop" }]);
    const pages = await walk("list=protectedtitles&ptlimit=1", "protectedtitles");
    expect(pages.flat().map((t) => t.title)).toEqual(["Never", "Nope"]);
  });

  it("lists random pages as {id, ns, title}", async () => {
    const body = await run("list=random&rnlimit=2&rnnamespace=0");
    expect(body.query.random).toHaveLength(2);
    expect(Object.keys(body.query.random[0]).sort()).toEqual(["id", "ns", "title"]);
    expect(body.continue).toBeUndefined();
  });
});

describe("modules that wait for plan 406", () => {
  it("answer badvalue naming the plan", async () => {
    for (const list of ["embeddedin&eititle=Template:Foo", "imageusage&iutitle=File:Cat.png"]) {
      const body = await run(`list=${list}`);
      expect(body.error.code).toBe("badvalue");
      expect(body.error.info).toContain("plan 406");
    }
  });
});

describe("several modules in one request", () => {
  it("answers each list and merges their continuations", async () => {
    const body = await run("list=allpages|logevents&aplimit=1&lelimit=1");
    expect(body.query.allpages).toHaveLength(1);
    expect(body.query.logevents).toHaveLength(1);
    expect(body.continue).toEqual({ apcontinue: "Beta", lecontinue: expect.any(String), continue: "-||" });
  });

  it("refuses an unknown list", async () => {
    expect((await run("list=nonsense")).error.code).toBe("badvalue");
  });
});
