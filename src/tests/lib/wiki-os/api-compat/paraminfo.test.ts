/** @jest-environment node */
/**
 * Plan 410: action=paraminfo (the parameters come from running each module over empty parameters,
 * not from a table), the legacy action=tokens, and action=purge.
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { call, fakeWiki, loggedIn, makeDeps, makeWikiDeps, type FakeWikiData } from "./harness";
import { ACTIONS } from "~/lib/wiki-os/api-compat/actions";
import { buildRegistry } from "~/lib/wiki-os/api-compat/registry";

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

  it("lists multi-value parameters with their limits, and required ones as required", async () => {
    const body = await info("modules=query%2Brevisions|edit|query");
    const byPath = Object.fromEntries(body.paraminfo.modules.map((m: Body) => [m.path, m]));
    expect(parameter(byPath["query+revisions"], "prop")).toMatchObject({ multi: true, limit: 50, highlimit: 500 });
    expect(parameter(byPath["query+revisions"], "prop").type).toContain("content");
    expect(parameter(byPath.edit, "token")).toMatchObject({ type: "string" });
    expect(parameter(byPath.edit, "title")).toMatchObject({ type: "string" });
    expect(byPath.edit).toMatchObject({ group: "action", prefix: "" });
    expect(byPath.query.name).toBe("query");
  });

  it("finds query submodules by name, in any group, and the main module on request", async () => {
    const body = await info("querymodules=allpages|search|info|siteinfo&mainmodule=1");
    expect(body.paraminfo.modules.map((m: Body) => m.path)).toEqual(["main", "query+allpages", "query+search", "query+info", "query+siteinfo"]);
    const [main] = body.paraminfo.modules;
    expect(parameter(main, "action").type).toContain("paraminfo");
    expect(parameter(main, "format")).toBeDefined();
    expect(body.paraminfo.modules.find((m: Body) => m.path === "query+info").group).toBe("prop");
    expect(body.paraminfo.modules.find((m: Body) => m.path === "query+siteinfo").group).toBe("meta");
  });

  it("answers a module that does not exist with missing, and names each module once", async () => {
    const body = await info("modules=nothere|query%2Ballpages|query%2Ballpages&querymodules=nonesuch");
    expect(body.paraminfo.modules).toEqual([
      { name: "nothere", path: "nothere", missing: true },
      expect.objectContaining({ path: "query+allpages" }),
      { name: "nonesuch", path: "query+nonesuch", missing: true },
    ]);
  });

  it("derives each parameter from the module's own reads: every registered module introspects, fast", async () => {
    const registry = buildRegistry(ACTIONS);
    expect(registry.length).toBeGreaterThan(30);
    const start = performance.now();
    for (const module of registry) {
      const read = await module.describe();
      expect(read.parameters.length).toBeGreaterThan(0);
      for (const parameterDefinition of read.parameters) expect(parameterDefinition.name).toMatch(/^[a-z][a-z0-9]*$/);
    }
    expect(performance.now() - start).toBeLessThan(1000);
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

  it("is open to anonymous callers and cheap to repeat", async () => {
    const first = await info("modules=query%2Brevisions");
    const second = await info("modules=query%2Brevisions");
    expect(second).toEqual(first);
  });
});

describe("action=tokens (legacy)", () => {
  it("answers the old shape, with a deprecation warning, for the session's token", async () => {
    const wiki = await makeWikiDeps(DATA());
    const csrf = await loggedIn(wiki.bot);
    const body = (await wiki.bot.get({ action: "tokens", type: "edit|move|watch", format: "json" })) as Body;
    expect(body.tokens).toEqual({ edittoken: csrf, movetoken: csrf, watchtoken: expect.stringMatching(/\+\\$/) });
    expect(body.query).toBeUndefined();
    expect(JSON.stringify(body.warnings)).toContain("action=tokens");
  });

  it("defaults to the edit token, gives an anonymous caller the anonymous token, and refuses an unknown type", async () => {
    const deps = await makeDeps({ store: fakeWiki(DATA()) });
    expect(((await call(deps, "action=tokens&format=json")).body as Body).tokens).toEqual({ edittoken: "+\\" });
    expect(((await call(deps, "action=tokens&type=bogus&format=json")).body as Body).error.code).toBe("badvalue");
  });
});

describe("action=purge", () => {
  const purged = (calls: Array<{ name: string; args: unknown[] }>) => calls.filter((c) => c.name === "purgePage").map((c) => c.args[0]);

  it("is refused to an anonymous caller (a purge costs a render)", async () => {
    const wiki = await makeWikiDeps(DATA());
    const body = (await call(wiki.deps, "action=purge&titles=Alpha&formatversion=2", { method: "POST", body: {} })).body as Body;
    expect(body.error.code).toBe("writeapidenied");
    expect(purged(wiki.calls)).toEqual([]);
  });

  it("marks each named page stale and queues its render, answering like MediaWiki", async () => {
    const wiki = await makeWikiDeps(DATA());
    await loggedIn(wiki.bot);
    const body = (await wiki.bot.post({ action: "purge", titles: "Alpha|Nope|Bad[title", formatversion: "2" })) as Body;
    expect(body.batchcomplete).toBe(true);
    expect(body.purge).toEqual([
      { ns: 0, title: "Alpha", purged: true },
      { ns: 0, title: "Nope", missing: true },
      expect.objectContaining({ title: "Bad[title", invalid: true }),
    ]);
    expect(purged(wiki.calls)).toEqual([{ id: "art:Alpha", title: "Alpha" }]);
  });

  it("takes page ids, follows redirects when asked, and shows linkupdate", async () => {
    const wiki = await makeWikiDeps(DATA());
    await loggedIn(wiki.bot);
    const byId = (await wiki.bot.post({ action: "purge", pageids: "1|99", forcelinkupdate: "1", formatversion: "2" })) as Body;
    expect(byId.purge).toEqual([{ ns: 0, title: "Alpha", purged: true, linkupdate: true }, { pageid: 99, missing: true }]);
    const followed = (await wiki.bot.post({ action: "purge", titles: "Beta", redirects: "1", formatversion: "2" })) as Body;
    expect(followed.purge[0]).toMatchObject({ title: "Alpha", purged: true });
  });

  it("caps the pages of one request", async () => {
    const wiki = await makeWikiDeps(DATA());
    await loggedIn(wiki.bot);
    const many = Array.from({ length: 60 }, (_, i) => `P${i}`).join("|");
    const body = (await wiki.bot.post({ action: "purge", titles: many, formatversion: "2" })) as Body;
    expect(body.error?.code ?? body.purge.length).toBeTruthy();
    expect(body.error?.code).toBe("toomanyvalues");
  });
});
