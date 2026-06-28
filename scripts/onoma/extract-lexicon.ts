// scripts/onoma/extract-lexicon.ts
// Onoma lexicon extraction.
//
// Pulls raw {name, category, sourceWiki} rows from:
//   - IxWiki: direct MariaDB SQL, typed by which Infobox_* a page transcludes.
//   - External MediaWiki sites: generic action-API allpages fetch (cached).
//
// Output: scripts/onoma/raw/lexicon-raw.json  (gitignored throwaway; Phase 2 cleans it).
// Run:    bunx tsx scripts/onoma/extract-lexicon.ts [--ixwiki-only]
//
// ponytail: shells out to the `mysql` CLI (no driver dep) and plain `fetch` (no API client).

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALSETTINGS = "/ixwiki/config/LocalSettings.php";
const OUT_DIR = path.join(__dirname, "raw");
const OUT_FILE = path.join(OUT_DIR, "lexicon-raw.json");
const CACHE_DIR = path.join(OUT_DIR, "cache");

export type RawName = { name: string; category: NameCat; sourceWiki: string };
type NameCat =
  | "country"
  | "city"
  | "province"
  | "person"
  | "organization"
  | "culture_generic"
  | "culture_sports"
  | "culture_cuisine"
  | "culture_architecture";

// Infobox template (linktarget lt_title, ns=10) -> our frontend NameCategory.
// First match wins, so order = priority when a page has several infoboxes.
const INFOBOX_CATEGORY: Array<[string, NameCat]> = [
  ["Infobox_country", "country"],
  ["Infobox_former_country", "country"],
  ["Infobox_settlement", "city"],
  ["Infobox_KirState", "province"],
  ["Infobox_royalty", "person"],
  ["Infobox_officeholder", "person"],
  ["Infobox_person", "person"],
  ["Infobox_company", "organization"],
  ["Infobox_government_agency", "organization"],
  ["Infobox_military_unit", "organization"],
  ["Infobox_organization", "organization"],
  ["Infobox_political_party", "organization"],
  ["Infobox_legislature", "organization"],
  ["Infobox_sport", "culture_sports"],
  ["Infobox_game", "culture_sports"],
  ["Infobox_sports_competition_event", "culture_sports"],
  ["Infobox_sports_team", "culture_sports"],
  ["Infobox_athlete", "culture_sports"],
  ["Infobox_food", "culture_cuisine"],
  ["Infobox_drink", "culture_cuisine"],
  ["Infobox_cheese", "culture_cuisine"],
  ["Infobox_cocktail", "culture_cuisine"],
  ["Infobox_recipe", "culture_cuisine"],
  ["Infobox_historic_site", "culture_architecture"],
  ["Infobox_church", "culture_architecture"],
  ["Infobox_religious_building", "culture_architecture"],
  ["Infobox_bridge", "culture_architecture"],
  ["Infobox_building", "culture_architecture"],
  ["Infobox_monument", "culture_architecture"],
  ["Infobox_protected_area", "culture_architecture"],
  ["Infobox_ethnic_group", "culture_generic"],
  ["Infobox_language", "culture_generic"],
];

/** Read DB creds straight from LocalSettings.php — secret never enters the repo. */
function readWikiCreds(file: string) {
  const php = fs.readFileSync(file, "utf8");
  const grab = (k: string) => {
    const m = php.match(new RegExp(`\\$${k}\\s*=\\s*['"]([^'"]*)['"]`));
    if (!m) throw new Error(`Could not find $${k} in ${file}`);
    return m[1];
  };
  return {
    server: grab("wgDBserver") || "localhost",
    name: grab("wgDBname"),
    user: grab("wgDBuser"),
    password: grab("wgDBpassword"),
  };
}

/** MediaWiki stores titles with underscores; that's encoding, not "dirtiness". */
function titleToName(title: string): string {
  return title.replace(/_/g, " ").trim();
}

function extractIxWiki(): RawName[] {
  const creds = readWikiCreds(LOCALSETTINGS);
  const templates = INFOBOX_CATEGORY.map(([t]) => `'${t}'`).join(",");
  const sql = `
    SELECT p.page_title, lt.lt_title
    FROM templatelinks tl
    JOIN page p ON p.page_id = tl.tl_from
    JOIN linktarget lt ON lt.lt_id = tl.tl_target_id
    WHERE p.page_namespace = 0 AND p.page_is_redirect = 0
      AND lt.lt_namespace = 10 AND lt.lt_title IN (${templates});`;

  const out = execFileSync(
    "mysql",
    ["-u", creds.user, "-h", creds.server, "-N", "--batch", creds.name, "-e", sql],
    {
      env: { ...process.env, MYSQL_PWD: creds.password },
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }
  );

  const catOf = new Map(INFOBOX_CATEGORY);
  // A page can have multiple infoboxes; keep the highest-priority category per title.
  const priority = new Map(INFOBOX_CATEGORY.map(([t], i) => [t, i]));
  const best = new Map<string, { cat: NameCat; rank: number }>();
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const [title, tpl] = line.split("\t");
    const cat = catOf.get(tpl);
    if (!cat) continue;
    const rank = priority.get(tpl) ?? 999;
    const cur = best.get(title);
    if (!cur || rank < cur.rank) best.set(title, { cat, rank });
  }

  const rows: RawName[] = [];
  for (const [title, { cat }] of best) {
    rows.push({ name: titleToName(title), category: cat, sourceWiki: "ixwiki" });
  }
  return rows;
}

// Allowlisted UA — required to clear Cloudflare on iiwiki (see CLAUDE.md / the
// existing src/app/api/mediawiki/* proxy routes which all use this string).
const UA = "IxStats-Builder";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch with a few retries — large remote wikis throw transient network errors. */
async function fetchRetry(url: URL, tries = 4): Promise<Response> {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.status >= 500 && i < tries) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      if (i >= tries) throw e;
      await sleep(500 * i); // linear backoff
    }
  }
}

/**
 * Mirror the SQL infobox-typing strategy over a remote MediaWiki: for each
 * Infobox_* template, list the main-namespace pages that transclude it
 * (`list=embeddedin`) → typed names. Targeted (only relevant pages, not a full
 * dump), continuation-paged, disk-cached, polite. Same INFOBOX_CATEGORY map.
 */
async function fetchTypedNames(
  api: string,
  sourceWiki: string,
  capPerTpl = 8000
): Promise<RawName[]> {
  const cacheFile = path.join(CACHE_DIR, `${sourceWiki}-typed.json`);

  // Incremental cache: keep already-fetched rows, but fetch any INFOBOX_CATEGORY
  // whose category is absent from the cache. Without this, adding new templates
  // (e.g. the culture_* infoboxes) silently never fetched — the old code returned
  // the stale full-cache verbatim. ponytail: keyed by category, not template, so a
  // *new template for an existing category* won't refetch — fine, categories rarely
  // gain templates; delete the cache file to force a full rebuild.
  const rows: RawName[] = fs.existsSync(cacheFile)
    ? (JSON.parse(fs.readFileSync(cacheFile, "utf8")) as RawName[])
    : [];
  const seen = new Set(rows.map((r) => `${r.category}|${r.name.toLowerCase()}`));
  const presentCats = new Set(rows.map((r) => r.category));
  const missing = INFOBOX_CATEGORY.filter(([, cat]) => !presentCats.has(cat));
  if (missing.length === 0) return rows;

  for (const [tpl, cat] of missing) {
    let cont: string | undefined;
    let got = 0;
    while (got < capPerTpl) {
      const url = new URL(api);
      url.search = new URLSearchParams({
        action: "query",
        list: "embeddedin",
        eititle: `Template:${tpl}`,
        einamespace: "0",
        eifilterredir: "nonredirects",
        eilimit: "500",
        format: "json",
        ...(cont ? { eicontinue: cont } : {}),
      }).toString();

      const res = await fetchRetry(url);
      if (!res.ok) throw new Error(`${sourceWiki}: HTTP ${res.status} on ${tpl}`);
      if (!(res.headers.get("content-type") || "").includes("json")) {
        throw new Error(`${sourceWiki}: non-JSON (blocked/challenge?) on ${tpl}`);
      }
      const data: any = await res.json();
      for (const p of data?.query?.embeddedin ?? []) {
        const key = `${cat}|${(p.title as string).toLowerCase()}`;
        if (seen.has(key)) continue; // first (highest-priority) category wins
        seen.add(key);
        rows.push({ name: p.title as string, category: cat, sourceWiki });
        got++;
      }
      cont = data?.continue?.eicontinue;
      if (!cont) break;
      await sleep(150);
    }
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(rows));
  return rows;
}

// External sources. Both are MediaWiki and support list=embeddedin. iiwiki is the
// high-value conworld corpus; the IxStats-Builder UA is what clears its Cloudflare.
const EXTERNAL = [
  { wiki: "iiwiki", api: "https://iiwiki.com/api.php", enabled: true },
  { wiki: "althistory", api: "https://althistory.fandom.com/api.php", enabled: true },
];

async function main() {
  const ixwikiOnly = process.argv.includes("--ixwiki-only");
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("Extracting IxWiki (SQL)...");
  const rows: RawName[] = extractIxWiki();
  const byCat = rows.reduce<Record<string, number>>(
    (a, r) => ((a[r.category] = (a[r.category] || 0) + 1), a),
    {}
  );
  console.log(`  IxWiki: ${rows.length} names`, byCat);

  if (!ixwikiOnly) {
    for (const src of EXTERNAL) {
      if (!src.enabled) {
        console.log(`Skipping ${src.wiki} (disabled — see EXTERNAL config note).`);
        continue;
      }
      try {
        console.log(`Fetching ${src.wiki} (API, infobox-typed)...`);
        const ext = await fetchTypedNames(src.api, src.wiki);
        for (const r of ext) rows.push({ ...r, name: titleToName(r.name) });
        const c = ext.reduce<Record<string, number>>(
          (a, r) => ((a[r.category] = (a[r.category] || 0) + 1), a),
          {}
        );
        console.log(`  ${src.wiki}: ${ext.length} typed names`, c);
      } catch (e) {
        console.warn(`  ${src.wiki} failed: ${(e as Error).message}`);
      }
    }
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(rows, null, 0));
  console.log(`Wrote ${rows.length} raw names -> ${OUT_FILE}`);
}

// Only run when invoked directly (keeps titleToName/types importable + testable).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { titleToName, INFOBOX_CATEGORY, fetchTypedNames };
