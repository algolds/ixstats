/**
 * One-time realm lore index import (rulings E-a..E-e). Dry run by default — the dry run is the preview; --apply writes.
 *   bun scripts/realms/import-realm-lore.ts --realm eurth --source iiwiki --category "Category:Eurth" --keyword Eurth [--apply]
 * Crawls the category tree (keyword subcategories only, depth 5, 5,000 pages), marks pages whose lead uses
 * Infobox country / former country as nations, and records the index as RealmPage rows. Page content is never copied.
 */
import { PrismaClient } from "@prisma/client";
import { crawlRealmCategory, detectNationTitles, type WikiQuery } from "~/lib/realms/lore-import";
import { isProofSource, wikiQuery, type ProofSource } from "~/lib/wiki-os/adapters/mediawiki/account-proof";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const value = i === -1 ? undefined : process.argv[i + 1];
  if (!value || value.startsWith("--")) throw new Error(`missing --${name}`);
  return value;
}

function sourceArg(): ProofSource {
  const source = arg("source");
  if (!isProofSource(source)) throw new Error(`--source must be ixwiki, iiwiki or althistory (got "${source}")`);
  return source;
}

async function writeIndex(realmId: string, wikiSource: ProofSource, pages: string[], nations: Set<string>) {
  const kindOf = (title: string) => (nations.has(title) ? "nation" : "lore");
  const created = await db.realmPage.createMany({
    data: pages.map((title) => ({ realmId, wikiSource, title, kind: kindOf(title) })),
    skipDuplicates: true,
  });
  // Rows from an earlier import keep their id; only their kind follows the new detection.
  const scope = { realmId, wikiSource };
  const toNation = await db.realmPage.updateMany({
    where: { ...scope, title: { in: pages.filter((t) => kindOf(t) === "nation") }, kind: { not: "nation" } },
    data: { kind: "nation" },
  });
  const toLore = await db.realmPage.updateMany({
    where: { ...scope, title: { in: pages.filter((t) => kindOf(t) === "lore") }, kind: { not: "lore" } },
    data: { kind: "lore" },
  });
  console.log(`written: ${created.count} new rows, ${toNation.count} → nation, ${toLore.count} → lore`);
}

async function main() {
  const slug = arg("realm");
  const source = sourceArg();
  const realm = await db.realm.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!realm) {
    console.error(`no realm with slug "${slug}" — create it in /admin/realms first`);
    process.exitCode = 1;
    return;
  }
  console.log(apply ? "APPLY mode — writing" : "DRY RUN — pass --apply to write");
  console.log(`realm ${realm.name} (${realm.id}) ← ${source}`);

  const query: WikiQuery = (params, schema) => wikiQuery(source, params, schema);
  const crawl = await crawlRealmCategory(query, { rootCategory: arg("category"), keyword: arg("keyword") });
  const nations = await detectNationTitles(query, crawl.pages);
  console.log(
    `pages ${crawl.pages.length}, nations ${nations.size}, categories ${crawl.categoriesVisited.length}, truncated ${crawl.truncated ? "yes" : "no"}`
  );
  for (const title of [...nations].sort().slice(0, 20)) console.log(`  nation: ${title}`);

  if (apply) await writeIndex(realm.id, source, crawl.pages, nations);
}

main()
  .catch((e: Error) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
