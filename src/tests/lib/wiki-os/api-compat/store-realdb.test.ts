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
    const category = await db.wikiCategory.create({ data: { name: "Cats", slug: "cats" } });
    await db.wikiCategoryMember.create({ data: { categoryId: category.id, articleId: long.id } });
    await db.wikiCategoryMember.create({ data: { categoryId: category.id, articleId: gone.id } });

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

    // listings: random, categorymembers (row comparison with a cursor), allcategories (GROUP BY, bigint count)
    expect((await store.randomPages({ namespaces: [0], filterRedirects: "all", limit: 5 })).map((page) => page.title).sort()).toEqual(["Alpha", "Blank"]);
    const members = await store.listCategoryMembers({ category: "Category:Cats", types: ["page", "subcat", "file"], sort: "sortkey", dir: "ascending", limit: 5 });
    expect(members.map((member) => member.title)).toEqual(["Alpha"]);
    expect(await store.listCategoryMembers({ category: "Category:Cats", types: ["page"], sort: "sortkey", dir: "ascending", limit: 5, cursor: { sortValue: "ALPHA", pageId: pages[0]!.pageId } })).toHaveLength(1);
    expect(await store.listCategories({ dir: "ascending", limit: 5 })).toEqual([{ name: "Cats", members: 1 }]);
    expect(await store.listPages({ namespace: 0, filterRedirects: "all", dir: "ascending", limit: 5 })).toHaveLength(2);
  }, 60_000);
});
