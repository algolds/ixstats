/** @jest-environment node */
/**
 * Plan 410: the raw SQL of the api.php store, run by a real PostgreSQL. A mocked `$queryRaw` cannot
 * see that Prisma binds a JS number as bigint (`left(text, bigint)` does not exist, which made
 * every prop=pageprops answer internal_api_error).
 *
 * Skipped unless WIKIOS_REALDB_TEST_URL is set: a connection URL with the credentials of the
 * local dev server (only its host, port and credentials are used, never its database name).
 * The test creates a scratch database from the dev server's `template_postgis`, copies the SCHEMA
 * of `ixstats_wv1` into it with `pg_dump -s | psql` (read-only on the source), applies the repo's
 * hand-written `prisma/manual-migrations/*.sql` (the dev database may lag behind them), runs the queries
 * against the scratch database and drops it. It never writes to `ixstats` or `ixstats_wv1`.
 * It needs the `ixstats-postgres` docker container (psql and pg_dump live there).
 */
jest.mock("~/server/db", () => {
  const url = process.env.WIKIOS_REALDB_TEST_URL;
  const scratchDatabase = `wikios_apitest_${process.pid}`;
  if (!url) return { __esModule: true, db: {}, scratchDatabase };
  const { PrismaClient } = jest.requireActual("@prisma/client");
  const target = new URL(url);
  target.pathname = `/${scratchDatabase}`;
  return { __esModule: true, db: new PrismaClient({ datasourceUrl: target.toString() }), scratchDatabase };
});

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { prismaApiStore as store } from "~/lib/wiki-os/api-compat/store";
import * as server from "~/server/db";

const CONTAINER = "ixstats-postgres";
const SCHEMA_SOURCE = "ixstats_wv1";
const { db, scratchDatabase } = server as unknown as { db: any; scratchDatabase: string };

/** The only databases this test may drop: its own scratch one. */
function assertScratch(name: string): void {
  if (!/^wikios_apitest_\d+$/.test(name) || name === "ixstats" || name === SCHEMA_SOURCE) {
    throw new Error(`refusing to touch database ${name}`);
  }
}

const docker = (args: string[]) => execFileSync("docker", ["exec", CONTAINER, ...args], { stdio: ["ignore", "pipe", "pipe"] }).toString();
const psql = (database: string, sql: string) => docker(["psql", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-Atc", sql]);

const describeRealDb = process.env.WIKIOS_REALDB_TEST_URL ? describe : describe.skip;

describeRealDb("the api.php store against a real PostgreSQL (scratch copy of the schema)", () => {
  beforeAll(() => {
    assertScratch(scratchDatabase);
    psql("postgres", `DROP DATABASE IF EXISTS "${scratchDatabase}" WITH (FORCE)`);
    psql("postgres", `CREATE DATABASE "${scratchDatabase}" TEMPLATE template_postgis`);
    // Schema only, read from the source: pg_dump writes nothing there.
    docker(["sh", "-c", `pg_dump -U postgres --schema-only ${SCHEMA_SOURCE} | psql -U postgres -q -d ${scratchDatabase}`]);
    // The migrations are idempotent, so those the dump already has do nothing.
    const directory = path.join(process.cwd(), "prisma", "manual-migrations");
    for (const file of readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()) {
      execFileSync("docker", ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-q", "-d", scratchDatabase, "-v", "ON_ERROR_STOP=1"], {
        input: readFileSync(path.join(directory, file)),
        stdio: ["pipe", "pipe", "pipe"],
      });
    }
  }, 180_000);

  afterAll(async () => {
    await db.$disconnect?.();
    assertScratch(scratchDatabase);
    psql("postgres", `DROP DATABASE IF EXISTS "${scratchDatabase}" WITH (FORCE)`);
  }, 60_000);

  it("runs every raw query: bound numbers, casts, joins and the status-only live filter", async () => {
    const long = await db.wikiArticle.create({
      data: { title: "Alpha", slug: "alpha", wikitext: `{{DISPLAYTITLE:alpha}} ${"x".repeat(500)}`, status: "PUBLISHED" },
    });
    const blank = await db.wikiArticle.create({ data: { title: "Blank", slug: "blank", wikitext: "" } });
    const gone = await db.wikiArticle.create({ data: { title: "Gone", slug: "gone", wikitext: "x", status: "ARCHIVED" } });
    const rev = await db.wikiRevision.create({
      data: { articleId: long.id, wikitext: long.wikitext, author: "Heku", byteSize: long.wikitext.length, sha1: null },
    });
    await db.wikiRevision.create({ data: { articleId: long.id, wikitext: "second", author: "Tester", byteSize: 6 } });
    await db.wikiRevision.create({ data: { articleId: long.id, wikitext: "parked edit from MediaWiki", author: "MwEditor", byteSize: 26, parked: true, createdAt: new Date(Date.now() + 60_000) } });
    const category = await db.wikiCategory.create({ data: { name: "Cats", slug: "cats" } });
    await db.wikiCategoryMember.create({ data: { categoryId: category.id, articleId: long.id } });
    await db.wikiCategoryMember.create({ data: { categoryId: category.id, articleId: gone.id } });
    const maintenance = await db.wikiCategory.create({ data: { name: "Maintenance", slug: "maintenance", hidden: true } });
    await db.wikiCategoryMember.create({ data: { categoryId: maintenance.id, articleId: long.id } });
    // plan 406's render-derived data, and a parked revision (a MediaWiki edit that never went live)
    await db.wikiArticle.update({ where: { id: long.id }, data: { pageProps: { defaultsort: "Alpha, The", pagelength: 12 }, displayTitle: "<i>alpha</i>" } });
    await db.wikiTemplateLink.createMany({ data: [{ articleId: long.id, templateTitle: "Template:Infobox" }, { articleId: long.id, templateTitle: "Module:Util" }, { articleId: blank.id, templateTitle: "Template:Infobox" }] });
    await db.wikiImageLink.createMany({ data: [{ articleId: long.id, fileName: "Cat photo.png" }] });

    // prop=pageprops: left("wikitext", n) takes an int, and Prisma binds a number as bigint.
    const cut = await store.wikitextByArticle([long.id, blank.id], 100);
    expect(cut.get(long.id)).toHaveLength(100);
    expect(cut.get(blank.id)).toBe("");
    expect((await store.wikitextByArticle([long.id])).get(long.id)).toHaveLength(long.wikitext.length);

    // a blanked page is a page; an archived one is not
    const pages = await store.pagesByTitle(["Alpha", "Blank", "Gone"]);
    expect(pages.map((page) => page.title).sort()).toEqual(["Alpha", "Blank"]);
    expect(pages.find((page) => page.title === "Alpha")!.headRevId).toBe(rev.revId + 1);

    // headRevisions / parentIds (raw, DISTINCT ON and a correlated subquery)
    const [first, second] = await store.revisionsById([rev.revId, rev.revId + 1], false);
    expect([first!.parentId, second!.parentId]).toEqual([0, rev.revId]);
    // the stored sha1 is NULL: hashed from the text when it was read, left null when it was not
    expect(first!.sha1).toBeNull();
    const [hashed] = await store.revisionsById([rev.revId], true);
    expect(hashed!.sha1).toMatch(/^[0-9a-z]{31}$/);
    // revisionHashes reads the text of just those revisions (a parked one has none)
    const parkedRev = (await db.wikiRevision.findFirst({ where: { articleId: long.id, parked: true }, select: { revId: true } }))!;
    const byRevision = await store.revisionHashes([rev.revId, rev.revId + 1, parkedRev.revId]);
    expect([...byRevision.keys()].sort()).toEqual([rev.revId, rev.revId + 1]);
    expect(byRevision.get(rev.revId)).toBe(hashed!.sha1);

    // listings: random, categorymembers (row comparison with a cursor), allcategories (GROUP BY, bigint count)
    expect((await store.randomPages({ namespaces: [0], filterRedirects: "all", limit: 5 })).map((page) => page.title).sort()).toEqual(["Alpha", "Blank"]);
    const members = await store.listCategoryMembers({ category: "Category:Cats", types: ["page", "subcat", "file"], sort: "sortkey", dir: "ascending", limit: 5 });
    expect(members.map((member) => member.title)).toEqual(["Alpha"]);
    expect(await store.listCategoryMembers({ category: "Category:Cats", types: ["page"], sort: "sortkey", dir: "ascending", limit: 5, cursor: { sortValue: "ALPHA", pageId: pages[0]!.pageId } })).toHaveLength(1);
    expect(await store.listCategories({ dir: "ascending", limit: 5 })).toEqual([
      { name: "Cats", members: 1, hidden: false },
      { name: "Maintenance", members: 1, hidden: true },
    ]);
    expect(await store.listPages({ namespace: 0, filterRedirects: "all", dir: "ascending", limit: 5 })).toHaveLength(2);

    // hidden categories, page properties and the display title MediaWiki reported
    expect((await store.categoriesOf({ articleIds: [long.id], dir: "ascending", limit: 5, hidden: true })).rows.map((row) => row.title)).toEqual(["Category:Maintenance"]);
    expect((await store.categoriesOf({ articleIds: [long.id], dir: "ascending", limit: 5 })).rows.map((row) => [row.title, row.hidden])).toEqual([["Category:Cats", false], ["Category:Maintenance", true]]);
    expect(await store.hiddenCategoryNames(["Cats", "Maintenance"])).toEqual(new Set(["Maintenance"]));
    const alpha = pages.find((page) => page.title === "Alpha")!;
    expect(alpha).toMatchObject({ pageProps: { defaultsort: "Alpha, The", pagelength: "12" }, displayTitle: "<i>alpha</i>" });
    expect(pages.find((page) => page.title === "Blank")).toMatchObject({ pageProps: null, displayTitle: null });

    // templates, images, embeddedin, imageusage (row comparisons with cursors, namespaces from titles)
    const templates = await store.templatesOf({ articleIds: [long.id, blank.id], dir: "ascending", limit: 5 });
    expect(templates.rows.map((row) => [row.title, row.namespace])).toEqual([["Module:Util", 828], ["Template:Infobox", 10], ["Template:Infobox", 10]]);
    const afterFirst = await store.templatesOf({ articleIds: [long.id, blank.id], dir: "ascending", limit: 5, cursor: { pageId: alpha.pageId, key: "Template:Infobox" } });
    expect(afterFirst.rows.map((row) => row.pageId)).toEqual([alpha.pageId, pages.find((page) => page.title === "Blank")!.pageId]);
    expect((await store.templatesOf({ articleIds: [long.id], dir: "descending", limit: 1 })).next).toEqual({ pageId: alpha.pageId, key: "Module:Util" });
    expect((await store.imagesOf({ articleIds: [long.id], dir: "ascending", limit: 5, titles: ["File:Cat_photo.png"] })).rows).toEqual([{ pageId: alpha.pageId, title: "File:Cat photo.png", namespace: 6 }]);
    expect((await store.listEmbeddedIn({ target: "Template:Infobox", filterRedirects: "all", limit: 5 })).map((row) => row.title)).toEqual(["Alpha", "Blank"]);
    expect((await store.listImageUsage({ target: "File:Cat_photo.png", filterRedirects: "all", limit: 5 })).map((row) => row.title)).toEqual(["Alpha"]);

    // a parked revision is not in the page's history, nor its head, nor its count
    expect(alpha.headRevId).toBe(rev.revId + 1);
    expect(await store.revisionCountOf("Alpha")).toBe(2);
    const history = await store.findRevisions({ articleId: long.id, dir: "older", limit: 5, withContent: false });
    expect(history.map((row) => row.revId)).toEqual([rev.revId + 1, rev.revId]);
    expect(await store.userStats(null, "MwEditor")).toMatchObject({ editCount: 0 });
  }, 60_000);
});
