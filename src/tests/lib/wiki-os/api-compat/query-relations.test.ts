/** @jest-environment node */
/**
 * Plan 410 F12: what plan 406's render-derived tables give api.php: list=embeddedin and imageusage,
 * prop=templates and images, their generators, parse&prop=templates|images, hidden categories and
 * the page properties MediaWiki reported.
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { call, fakeWiki, loggedIn, makeDeps, makeWikiDeps, type FakeWikiData } from "./harness";

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

  it("finds Lua modules too, takes a page id, and filters by namespace and redirects", async () => {
    expect((await run("list=embeddedin&eititle=Module:Util")).query.embeddedin.map((p: Body) => p.title)).toEqual(["Alpha"]);
    expect((await run("list=embeddedin&eipageid=10")).query.embeddedin).toHaveLength(3);
    expect((await run("list=embeddedin&eititle=Template:Infobox&eifilterredir=nonredirects")).query.embeddedin.map((p: Body) => p.title)).toEqual(["Alpha", "Beta"]);
    expect((await run("list=embeddedin&eititle=Template:Infobox&einamespace=1")).query.embeddedin).toEqual([]);
    expect((await run("list=embeddedin&eititle=Template:Nothing")).query.embeddedin).toEqual([]);
  });

  it("continues with eicontinue", async () => {
    const first = await run("list=embeddedin&eititle=Template:Infobox&eilimit=2");
    expect(first.query.embeddedin.map((p: Body) => p.title)).toEqual(["Alpha", "Beta"]);
    expect(first.continue).toEqual({ eicontinue: expect.any(String), continue: "-||" });
    const second = await run(`list=embeddedin&eititle=Template:Infobox&eilimit=2&eicontinue=${encodeURIComponent(first.continue.eicontinue)}`);
    expect(second.query.embeddedin.map((p: Body) => p.title)).toEqual(["Gamma"]);
    expect(second.continue).toBeUndefined();
  });

  it("needs a title or a page id, not both, and refuses a malformed continue", async () => {
    expect((await run("list=embeddedin")).error.code).toBe("missingparam");
    expect((await run("list=embeddedin&eititle=Template:Infobox&eipageid=10")).error.code).toBe("invalidparammix");
    expect((await run("list=embeddedin&eipageid=999")).error.code).toBe("nosuchpageid");
    expect((await run("list=embeddedin&eititle=Template:Infobox&eicontinue=x%7Cy")).error.code).toBe("badcontinue");
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

  it("refuses a title outside the File namespace", async () => {
    const body = await run("list=imageusage&iutitle=Template:Infobox");
    expect(body.error.code).toBe("bad_image_title");
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

  it("filters with tltemplates, tlnamespace and imimages, and answers nothing for a page that has none", async () => {
    expect((await run("titles=Alpha&prop=templates&tltemplates=Template:Infobox")).query.pages[0].templates).toEqual([{ ns: 10, title: "Template:Infobox" }]);
    expect((await run("titles=Alpha&prop=templates&tlnamespace=828")).query.pages[0].templates).toEqual([{ ns: 828, title: "Module:Util" }]);
    expect((await run("titles=Alpha&prop=images&imimages=File:Dog.jpg")).query.pages[0].images).toEqual([{ ns: 6, title: "File:Dog.jpg" }]);
    const delta = (await run("titles=Delta&prop=templates|images")).query.pages[0];
    expect(delta.templates).toBeUndefined();
    expect(delta.images).toBeUndefined();
  });

  it("is the v1 shape in formatversion 1", async () => {
    const deps = await makeDeps({ store: fakeWiki(data()) });
    const body = (await call(deps, "action=query&titles=Alpha&prop=images&format=json")).body as Body;
    expect(body.query.pages["1"].images).toEqual([{ ns: 6, title: "File:Cat photo.png" }, { ns: 6, title: "File:Dog.jpg" }]);
  });
});

describe("generators", () => {
  it("generator=embeddedin and generator=imageusage make the listed pages the page set", async () => {
    const embedded = await run("generator=embeddedin&geititle=Template:Cite_web&prop=info");
    expect(embedded.query.pages.map((p: Body) => p.title)).toEqual(["Beta"]);
    const used = await run("generator=imageusage&giutitle=File:Cat_photo.png&prop=info");
    expect(used.query.pages.map((p: Body) => p.title)).toEqual(["Alpha", "Beta"]);
  });

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

  it("list=allcategories&acprop=hidden shows it too", async () => {
    const body = await run("list=allcategories&acprop=size|hidden");
    expect(body.query.allcategories).toEqual([
      { category: "Cats", size: 1, pages: 1, files: 0, subcats: 0, hidden: false },
      { category: "Maintenance", size: 2, pages: 2, files: 0, subcats: 0, hidden: true },
    ]);
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

  it("reads the text only for pages that were never rendered", async () => {
    const store = fakeWiki(data());
    const spy = jest.spyOn(store, "wikitextByArticle");
    const deps = await makeDeps({ store });
    await call(deps, "action=query&titles=Alpha|Delta&prop=pageprops&formatversion=2");
    expect(spy).toHaveBeenCalledWith(["art:Delta"], expect.any(Number));
  });

  it("prop=info&inprop=displaytitle gives the HTML of the display title", async () => {
    const body = await run("titles=Alpha|Beta&prop=info&inprop=displaytitle");
    expect(body.query.pages[0].displaytitle).toBe("<i>alpha</i>");
    expect(body.query.pages[1].displaytitle).toBe("Beta");
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

  it("flags a missing template, and gives the v1 shape", async () => {
    const wiki = data();
    wiki.templates!.Alpha!.push("Template:Missing");
    const deps = await makeDeps({ store: fakeWiki(wiki) });
    const v2 = ((await call(deps, "action=parse&page=Alpha&prop=templates&formatversion=2")).body as Body).parse.templates;
    expect(v2.find((t: Body) => t.title === "Template:Missing")).toEqual({ ns: 10, exists: false, title: "Template:Missing" });
    const v1 = ((await call(deps, "action=parse&page=Alpha&prop=templates&format=json")).body as Body).parse.templates;
    expect(v1).toContainEqual({ ns: 10, exists: "", "*": "Template:Infobox" });
    expect(v1).toContainEqual({ ns: 10, "*": "Template:Missing" });
  });

  it("learns a text's templates and images from one render of it", async () => {
    const { body, calls } = await parse("text=%7B%7BInfobox%7D%7D%20%5B%5BFile%3ACat%20photo.png%5D%5D&prop=text|templates|images");
    expect(body.parse.templates).toEqual([{ ns: 10, exists: true, title: "Template:Infobox" }]);
    expect(body.parse.images).toEqual(["Cat_photo.png"]);
    expect(calls.filter((c) => c.name === "renderWikitext")).toHaveLength(1);
  });

  it("an old revision is rendered for its templates, and the default props now include them", async () => {
    const { body } = await anonymous("oldid=2");
    expect(body.parse.templates.map((t: Body) => t.title)).toEqual(["Template:Infobox", "Template:Cite web"]);
    expect(body.parse.images).toEqual([]);
  });

  it("uses the stored properties and display title of a rendered page, the text's own otherwise", async () => {
    const stored = await anonymous("page=Alpha&prop=properties|displaytitle");
    expect(stored.body.parse.properties).toEqual([
      { name: "defaultsort", value: "Alpha, The" },
      { name: "displaytitle", value: "<i>alpha</i>" },
    ]);
    expect(stored.body.parse.displaytitle).toBe("<i>alpha</i>");
    const wikitext = await parse("text=%7B%7BDISPLAYTITLE%3Afrom%20text%7D%7D&prop=displaytitle|properties");
    expect(wikitext.body.parse.displaytitle).toBe("from text");
  });

  it("flags hidden categories, of a page and of a text", async () => {
    const page = await anonymous("page=Alpha&prop=categories");
    expect(page.body.parse.categories).toEqual([
      { sortkey: "", category: "Cats", hidden: false },
      { sortkey: "", category: "Maintenance", hidden: true },
    ]);
    const text = await parse("text=%5B%5BCategory%3AMaintenance%5D%5D%20%5B%5BCategory%3ACats%5D%5D&prop=categories");
    expect(text.body.parse.categories).toEqual([
      { sortkey: "", category: "Maintenance", hidden: true },
      { sortkey: "", category: "Cats", hidden: false },
    ]);
  });
});
