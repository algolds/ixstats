/**
 * One-time realm lore index import (rulings E-a..E-e, E-d′). Dry run by default — the dry run is the preview; --apply writes.
 *   bun scripts/realms/import-realm-lore.ts --realm eurth --source iiwiki --category "Category:Eurth" --keyword Eurth \
 *     [--nation-roster "Category:Countries (Eurth)"] [--prune] [--apply]
 * Once the realm's wiki is set (/admin/realms → Wiki, `Realm.settings.wiki`), `--realm eurth` alone is enough: the
 * settings fill --source, --category, --keyword and --nation-roster, and a flag given on the command line wins.
 * Crawls the category tree (keyword subcategories only, depth 5, 5,000 pages) and records the index as RealmPage rows.
 * Nations come from --nation-roster (one subcategory per nation; its titles join the index even if the crawl missed
 * them; a retired roster is refused), else from pages whose lead uses Infobox country / former country.
 * A re-run adds new pages and updates kinds; rows no longer in the index stay unless --prune is given, and even then
 * a page with a pending or approved claim, or with a nation's Country, is kept. Such a page also stays a nation when
 * the roster stops listing it (it is never turned back into lore).
 * Page content is never copied.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import {
  crawlRealmCategory,
  indexNations,
  loreDowngrades,
  loreImportOptions,
  nationMethod,
  prunableTitles,
  rosterTitlesNotCrawled,
  suspectRosterEntries,
  type WikiQuery,
} from "~/lib/realms/lore-import";
import { realmWikiSettings } from "~/lib/realms/realm-wiki-settings";
import {
  isProofSource,
  PROOF_SOURCES,
  wikiQuery,
  type ProofSource,
} from "~/lib/wiki-os/adapters/mediawiki/account-proof";

const db = new PrismaClient();
const apply = process.argv.includes("--apply");
const prune = process.argv.includes("--prune");

type Tx = Prisma.TransactionClient;

function optionalArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const value = process.argv[i + 1];
  if (!value || value.startsWith("--")) throw new Error(`--${name} needs a value`);
  return value;
}

function arg(name: string): string {
  const value = optionalArg(name);
  if (value === undefined) throw new Error(`missing --${name}`);
  return value;
}

function proofSource(source: string): ProofSource {
  if (!isProofSource(source)) throw new Error(`--source must be one of ${PROOF_SOURCES.join(", ")} (got "${source}")`);
  return source;
}

/**
 * Of `titles`, those a claim or a country names: a page with a pending or approved claim, or with a Country of
 * this realm (claims and countries name their page by title). Such a page is never deleted or turned into lore.
 */
async function guardedTitles(client: Tx, realmId: string, titles: string[]): Promise<string[]> {
  if (titles.length === 0) return [];
  const claims = await client.realmClaim.findMany({
    where: { realmId, wikiPageTitle: { in: titles }, status: { in: ["pending", "approved"] } },
    select: { wikiPageTitle: true },
  });
  const countries = await client.country.findMany({
    where: { realmId, OR: [{ wikiPageTitle: { in: titles } }, { name: { in: titles } }] },
    select: { name: true, wikiPageTitle: true },
  });
  return [
    ...claims.map((claim) => claim.wikiPageTitle),
    ...countries.flatMap((country) => [country.name, country.wikiPageTitle]),
  ].filter((title): title is string => !!title);
}

async function writeIndex(tx: Tx, realmId: string, wikiSource: ProofSource, pages: string[], nations: Set<string>) {
  const kindOf = (title: string) => (nations.has(title) ? "nation" : "lore");
  const created = await tx.realmPage.createMany({
    data: pages.map((title) => ({ realmId, wikiSource, title, kind: kindOf(title) })),
    skipDuplicates: true,
  });
  // Rows from an earlier import keep their id; only their kind follows the new detection.
  const scope = { realmId, wikiSource };
  const toNation = await tx.realmPage.updateMany({
    where: { ...scope, title: { in: pages.filter((t) => kindOf(t) === "nation") }, kind: { not: "nation" } },
    data: { kind: "nation" },
  });
  // A claimed or founded nation page stays a nation even when the roster no longer lists it.
  const indexedNations = await tx.realmPage.findMany({
    where: { ...scope, kind: "nation", title: { in: pages.filter((t) => kindOf(t) === "lore") } },
    select: { title: true },
  });
  const candidates = indexedNations.map((row) => row.title);
  const { downgrade, kept } = loreDowngrades(candidates, await guardedTitles(tx, realmId, candidates));
  const toLore = await tx.realmPage.updateMany({
    where: { ...scope, title: { in: downgrade }, kind: { not: "lore" } },
    data: { kind: "lore" },
  });
  console.log(`written: ${created.count} new rows, ${toNation.count} → nation, ${toLore.count} → lore`);
  if (kept.length > 0) console.log(`kept as nation (claimed or founded): ${kept.join(", ")}`);
}

/**
 * The indexed rows of this realm and wiki that the new index no longer has, split into those --prune deletes and
 * those it keeps (a page with a pending or approved claim, or with a Country of this realm, is never deleted).
 */
async function staleRows(client: Tx, realmId: string, wikiSource: ProofSource, pages: string[]) {
  const indexed = await client.realmPage.findMany({ where: { realmId, wikiSource }, select: { title: true } });
  const current = new Set(pages);
  const stale = indexed.map((row) => row.title).filter((title) => !current.has(title));
  if (stale.length === 0) return { prune: [], kept: [] };
  return prunableTitles(stale, pages, await guardedTitles(client, realmId, stale));
}

async function main() {
  nationMethod(optionalArg("nation-roster")); // refuses a retired roster before any request
  const slug = arg("realm");
  const realm = await db.realm.findUnique({ where: { slug }, select: { id: true, name: true, settings: true } });
  if (!realm) {
    console.error(`no realm with slug "${slug}" — create it in /admin/realms first`);
    process.exitCode = 1;
    return;
  }
  // Flags win; the realm's wiki settings fill the rest.
  const wiki = realmWikiSettings(realm.settings);
  const options = loreImportOptions(
    {
      source: optionalArg("source"),
      category: optionalArg("category"),
      keyword: optionalArg("keyword"),
      roster: optionalArg("nation-roster"),
    },
    wiki
  );
  const source = proofSource(options.source);
  const method = nationMethod(options.roster);
  console.log(apply ? "APPLY mode — writing" : "DRY RUN — pass --apply to write");
  console.log(`realm ${realm.name} (${realm.id}) ← ${source}`);
  if (wiki?.source === source) {
    console.log(`using ${options.category}, keyword ${options.keyword}, roster ${options.roster ?? "none"}`);
  }

  const query: WikiQuery = (params, schema) => wikiQuery(source, params, schema);
  const crawl = await crawlRealmCategory(query, { rootCategory: options.category, keyword: options.keyword });
  const { pages, nations } = await indexNations(query, crawl.pages, method);
  console.log(
    `pages ${pages.length} (crawled ${crawl.pages.length}), nations ${nations.size}, categories ${crawl.categoriesVisited.length}, truncated ${crawl.truncated ? "yes" : "no"}`
  );
  console.log(`nation method: ${method.kind === "roster" ? `roster ${method.roster}` : "infobox heuristic"}`);
  for (const title of [...nations].sort()) console.log(`  nation: ${title}`);

  if (method.kind === "roster") {
    const missing = rosterTitlesNotCrawled(crawl.pages, nations);
    if (missing.length > 0) {
      console.warn(
        `WARNING: ${missing.length} roster titles not among the crawled pages (indexed anyway; check each is a live nation page in the category tree):`
      );
      for (const title of missing) console.warn(`  not crawled: ${title}`);
    }
    const suspects = suspectRosterEntries(nations);
    if (suspects.length > 0) {
      console.warn(
        `WARNING: ${suspects.length} roster entries look like a subcategory of pages rather than a nation (kept; remove them from the roster if so):`
      );
      for (const title of suspects) console.warn(`  suspect: ${title}`);
    }
  }

  const stale = await staleRows(db, realm.id, source, pages);
  if (stale.prune.length + stale.kept.length > 0) {
    const verb = !prune ? "would stay (pass --prune to delete)" : apply ? "will be deleted" : "would be deleted";
    console.log(`stale rows no longer in the index: ${stale.prune.length} ${verb}, ${stale.kept.length} kept (claimed or founded)`);
    for (const title of stale.prune) console.log(`  stale: ${title}`);
    for (const title of stale.kept) console.log(`  stale, kept: ${title}`);
  }

  if (!apply) return;
  await db.$transaction(
    async (tx) => {
      await writeIndex(tx, realm.id, source, pages, nations);
      // Read again inside the transaction: a claim filed since the preview protects its page too.
      const prunable = prune ? (await staleRows(tx, realm.id, source, pages)).prune : [];
      if (prunable.length > 0) {
        const removed = await tx.realmPage.deleteMany({
          where: { realmId: realm.id, wikiSource: source, title: { in: prunable } },
        });
        console.log(`pruned: ${removed.count} stale rows`);
      }
    },
    { timeout: 120_000 }
  );
}

main()
  .catch((e: Error) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
