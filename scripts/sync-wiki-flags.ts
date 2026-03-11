/**
 * Sync Wiki Flags Script
 *
 * Downloads country and dependency flag images from IxWiki and stores them
 * locally in /public/flags/. Updates the database flag field to point to
 * the local path and refreshes metadata.json.
 *
 * Two-phase approach:
 *   Phase 1: Resolve flags already in DB (bare filenames → download from wiki)
 *   Phase 2: Scrape wiki infobox for countries missing flags
 *
 * Usage:
 *   npx tsx scripts/sync-wiki-flags.ts                # Full sync
 *   npx tsx scripts/sync-wiki-flags.ts --dry-run      # Preview without writing
 *   npx tsx scripts/sync-wiki-flags.ts --country "X"  # Single country
 *   npx tsx scripts/sync-wiki-flags.ts --force        # Re-download even if local file exists
 */

process.env.SKIP_ENV_VALIDATION = "1";

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { fileURLToPath } from "url";

const __filename_local = fileURLToPath(import.meta.url);
const __dirname_local = path.dirname(__filename_local);

const prisma = new PrismaClient();

const WIKI_API = "https://ixwiki.com/api.php";
const USER_AGENT = "IxStats-Builder";
const FLAGS_DIR = path.resolve(__dirname_local, "../public/flags");
const METADATA_PATH = path.join(FLAGS_DIR, "metadata.json");
const BATCH_SIZE = 50; // MediaWiki API allows up to 50 titles per query
const REQUEST_DELAY = 200; // ms between API calls

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function getExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return ext || ".png";
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

async function downloadFile(url: string, destPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const request = protocol.get(
      url,
      { headers: { "User-Agent": USER_AGENT }, timeout: 30000 },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
            return;
          }
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }
        const writeStream = fs.createWriteStream(destPath);
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
        });
        res.pipe(writeStream);
        writeStream.on("finish", () => resolve(size));
        writeStream.on("error", reject);
      }
    );
    request.on("error", reject);
    request.on("timeout", () => {
      request.destroy();
      reject(new Error("Download timeout"));
    });
  });
}

// ─── Wiki API Functions ───────────────────────────────────────────────────────

/**
 * Resolve wiki filenames to actual image URLs via MediaWiki API (batch)
 */
async function resolveWikiFileUrls(
  filenames: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  // Build a lookup from normalized wiki title → original input filename
  const normalizedToOriginal = new Map<string, string>();
  for (const f of filenames) {
    // Wiki normalizes underscores to spaces and capitalizes first letter
    const normalized = f.replace(/_/g, " ");
    normalizedToOriginal.set(normalized.toLowerCase(), f);
  }

  for (let i = 0; i < filenames.length; i += BATCH_SIZE) {
    const batch = filenames.slice(i, i + BATCH_SIZE);
    const titles = batch
      .map((f) => `File:${f.replace(/ /g, "_")}`)
      .join("|");

    try {
      const data = await fetchJson(
        `${WIKI_API}?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url&format=json&formatversion=2`
      );

      if (data?.query?.pages) {
        for (const page of data.query.pages) {
          if (page.imageinfo?.[0]?.url) {
            // Map back to original input filename
            const wikiTitle = page.title.replace("File:", "");
            const originalFilename =
              normalizedToOriginal.get(wikiTitle.toLowerCase()) || wikiTitle;
            result.set(originalFilename, page.imageinfo[0].url);
          }
        }
      }
    } catch (err) {
      console.error(`  API error for batch starting at index ${i}:`, err);
    }

    if (i + BATCH_SIZE < filenames.length) {
      await sleep(REQUEST_DELAY);
    }
  }

  return result;
}

/**
 * Scrape wiki infobox to find the flag filename for a country
 */
async function scrapeWikiFlag(countryName: string): Promise<string | null> {
  try {
    const pageName = countryName.replace(/ /g, "_");
    const data = await fetchJson(
      `${WIKI_API}?action=query&titles=${encodeURIComponent(pageName)}&prop=revisions&rvprop=content&rvsection=0&rvslots=main&format=json&formatversion=2`
    );

    const page = data?.query?.pages?.[0];
    if (!page || page.missing) return null;

    const content =
      page.revisions?.[0]?.slots?.main?.content ||
      page.revisions?.[0]?.content ||
      "";

    // Look for flag in infobox - common patterns:
    // |image_flag = FlagName.png
    // |flag = FlagName.png
    // |image_flag = File:FlagName.png
    const flagPatterns = [
      /\|\s*image_flag\s*=\s*(?:File:)?(.+?\.(png|svg|jpg|jpeg|gif|webp))/i,
      /\|\s*flag\s*=\s*(?:File:)?(.+?\.(png|svg|jpg|jpeg|gif|webp))/i,
    ];

    for (const pattern of flagPatterns) {
      const match = content.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    // Also check for images used on the page
    const imageData = await fetchJson(
      `${WIKI_API}?action=query&titles=${encodeURIComponent(pageName)}&prop=images&imlimit=50&format=json&formatversion=2`
    );

    const images = imageData?.query?.pages?.[0]?.images || [];
    for (const img of images) {
      const title: string = img.title || "";
      const lowerTitle = title.toLowerCase();
      const lowerCountry = countryName.toLowerCase().replace(/ /g, "_");
      if (
        (lowerTitle.includes("flag") && lowerTitle.includes(lowerCountry)) ||
        lowerTitle.includes(`flag_of_${lowerCountry}`) ||
        lowerTitle.includes(`${lowerCountry}_flag`) ||
        lowerTitle.includes(`${lowerCountry}flag`)
      ) {
        return title.replace("File:", "");
      }
    }

    return null;
  } catch (err) {
    console.error(`  Error scraping wiki for ${countryName}:`, err);
    return null;
  }
}

// ─── Metadata Management ─────────────────────────────────────────────────────

interface FlagMetadata {
  lastUpdateTime: number;
  flags: Record<
    string,
    {
      fileName: string;
      originalUrl: string;
      downloadedAt: number;
      fileSize: number;
      source: { name: string; baseUrl: string; priority: number };
    }
  >;
}

function loadMetadata(): FlagMetadata {
  try {
    return JSON.parse(fs.readFileSync(METADATA_PATH, "utf8"));
  } catch {
    return { lastUpdateTime: Date.now(), flags: {} };
  }
}

function saveMetadata(metadata: FlagMetadata): void {
  metadata.lastUpdateTime = Date.now();
  fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2));
}

// ─── Main Sync Logic ─────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  const countryIdx = args.indexOf("--country");
  const countryFilter = countryIdx >= 0 ? args[countryIdx + 1] : null;

  console.log("=== IxStats Wiki Flag Sync ===");
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Force re-download: ${force}`);
  if (countryFilter) console.log(`Filter: ${countryFilter}`);
  console.log("");

  // Ensure flags directory exists
  if (!fs.existsSync(FLAGS_DIR)) {
    fs.mkdirSync(FLAGS_DIR, { recursive: true });
  }

  const metadata = loadMetadata();
  const stats = {
    resolved: 0,
    downloaded: 0,
    dbUpdated: 0,
    scraped: 0,
    skipped: 0,
    failed: 0,
  };

  // ─── Phase 1: Countries with existing flag filenames in DB ───────────────

  console.log("─── Phase 1: Resolve existing DB flag filenames ───");

  const whereClause: any = countryFilter
    ? { name: { equals: countryFilter, mode: "insensitive" } }
    : {};

  const countriesWithFlags = await prisma.country.findMany({
    where: { ...whereClause, flag: { not: null } },
    select: { id: true, name: true, flag: true },
    orderBy: { name: "asc" },
  });

  console.log(`Found ${countriesWithFlags.length} countries with flag filenames in DB\n`);

  // Collect all filenames that need resolution
  const filenameToCountry = new Map<string, { id: number; name: string }[]>();
  for (const country of countriesWithFlags) {
    if (!country.flag) continue;
    const filename = country.flag.trim();
    const localKey = normalizeFileName(
      path.basename(filename, getExtension(filename))
    );
    const localFile = `${localKey}${getExtension(filename)}`;
    const localPath = path.join(FLAGS_DIR, localFile);

    // Skip if already downloaded locally (unless --force)
    if (!force && fs.existsSync(localPath) && metadata.flags[localKey]) {
      const expectedDbPath = `/flags/${localFile}`;
      if (country.flag !== expectedDbPath) {
        // File exists but DB path is wrong - fix it
        if (!dryRun) {
          await prisma.country.update({
            where: { id: country.id },
            data: { flag: expectedDbPath },
          });
        }
        console.log(`  ✓ ${country.name}: DB path fixed → ${expectedDbPath}`);
        stats.dbUpdated++;
      } else {
        stats.skipped++;
      }
      continue;
    }

    const existing = filenameToCountry.get(filename) || [];
    existing.push({ id: country.id, name: country.name });
    filenameToCountry.set(filename, existing);
  }

  // Resolve wiki URLs in batch
  const filenames = Array.from(filenameToCountry.keys());
  if (filenames.length > 0) {
    console.log(`Resolving ${filenames.length} wiki filenames...`);
    const urlMap = await resolveWikiFileUrls(filenames);
    stats.resolved = urlMap.size;
    console.log(`  Resolved ${urlMap.size}/${filenames.length} filenames\n`);

    // Download each resolved file
    for (const [filename, url] of urlMap) {
      const countries = filenameToCountry.get(filename) || [];
      const ext = getExtension(filename);
      // Use country name as the local file key for consistency
      const primaryCountry = countries[0]!;
      const localKey = normalizeFileName(primaryCountry.name);
      const localFile = `${localKey}${ext}`;
      const localPath = path.join(FLAGS_DIR, localFile);
      const dbPath = `/flags/${localFile}`;

      if (dryRun) {
        console.log(
          `  [DRY] ${primaryCountry.name}: ${filename} → ${localFile}`
        );
        stats.downloaded++;
      } else {
        try {
          const size = await downloadFile(url, localPath);
          metadata.flags[localKey] = {
            fileName: localFile,
            originalUrl: url,
            downloadedAt: Date.now(),
            fileSize: size,
            source: { name: "IxWiki", baseUrl: "https://ixwiki.com", priority: 1 },
          };

          // Update DB for all countries sharing this flag
          for (const country of countries) {
            await prisma.country.update({
              where: { id: country.id },
              data: { flag: dbPath },
            });
            stats.dbUpdated++;
          }

          console.log(
            `  ✓ ${primaryCountry.name}: downloaded ${localFile} (${(size / 1024).toFixed(1)}KB)`
          );
          stats.downloaded++;
        } catch (err) {
          console.error(
            `  ✗ ${primaryCountry.name}: failed to download ${filename}:`,
            err
          );
          stats.failed++;
        }
      }

      await sleep(100);
    }

    // Report unresolved
    for (const [filename, countries] of filenameToCountry) {
      if (!urlMap.has(filename)) {
        // The file wasn't found by exact match - try normalized variations
        const variations = [
          filename,
          filename.replace(/ /g, "_"),
          `Flag of ${countries[0]!.name}.png`,
          `Flag of ${countries[0]!.name}.svg`,
          `Flag_of_${countries[0]!.name.replace(/ /g, "_")}.png`,
          `Flag_of_${countries[0]!.name.replace(/ /g, "_")}.svg`,
        ];

        let found = false;
        for (const variant of variations.slice(1)) {
          if (variant === filename) continue;
          const retryMap = await resolveWikiFileUrls([variant]);
          const retryEntry = retryMap.entries().next();
          if (retryMap.size > 0 && retryEntry.value) {
            const resolvedUrl = retryEntry.value[1];
            const ext = getExtension(variant);
            const localKey = normalizeFileName(countries[0]!.name);
            const localFile = `${localKey}${ext}`;
            const localPath = path.join(FLAGS_DIR, localFile);
            const dbPath = `/flags/${localFile}`;

            if (!dryRun) {
              try {
                const size = await downloadFile(resolvedUrl, localPath);
                metadata.flags[localKey] = {
                  fileName: localFile,
                  originalUrl: resolvedUrl,
                  downloadedAt: Date.now(),
                  fileSize: size,
                  source: { name: "IxWiki", baseUrl: "https://ixwiki.com", priority: 1 },
                };
                for (const country of countries) {
                  await prisma.country.update({
                    where: { id: country.id },
                    data: { flag: dbPath },
                  });
                  stats.dbUpdated++;
                }
                console.log(
                  `  ✓ ${countries[0]!.name}: found as "${variant}" → ${localFile}`
                );
                stats.downloaded++;
                found = true;
                break;
              } catch (err) {
                // continue to next variation
              }
            } else {
              console.log(`  [DRY] ${countries[0]!.name}: would try variant "${variant}"`);
              found = true;
              break;
            }
          }
          await sleep(REQUEST_DELAY);
        }

        if (!found) {
          console.warn(
            `  ⚠ ${countries.map((c) => c.name).join(", ")}: "${filename}" not found on wiki`
          );
          stats.failed++;
        }
      }
    }
  }

  // ─── Phase 2: Scrape wiki for countries without flags ─────────────────────

  console.log("\n─── Phase 2: Scrape wiki infobox for missing flags ───");

  const countriesWithoutFlags = await prisma.country.findMany({
    where: {
      ...whereClause,
      OR: [
        { flag: null },
        { flag: "" },
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Also include countries whose flag is still a bare filename (not yet a local path)
  const countriesBareFlags = await prisma.country.findMany({
    where: {
      ...whereClause,
      flag: { not: null },
      NOT: { flag: { startsWith: "/flags/" } },
    },
    select: { id: true, name: true, flag: true },
    orderBy: { name: "asc" },
  });

  const toScrape = [...countriesWithoutFlags];
  // Add bare-flag countries that weren't resolved in Phase 1
  for (const c of countriesBareFlags) {
    if (!toScrape.find((x) => x.id === c.id)) {
      toScrape.push({ id: c.id, name: c.name });
    }
  }

  console.log(`Found ${toScrape.length} countries needing wiki scrape\n`);

  for (const country of toScrape) {
    // Skip if already has a local flag file
    const localKey = normalizeFileName(country.name);
    const existingFiles = fs
      .readdirSync(FLAGS_DIR)
      .filter((f) => f.startsWith(localKey + "."));

    if (!force && existingFiles.length > 0 && metadata.flags[localKey]) {
      const localFile = existingFiles[0]!;
      const dbPath = `/flags/${localFile}`;
      // Just update DB if needed
      const current = await prisma.country.findUnique({
        where: { id: country.id },
        select: { flag: true },
      });
      if (current?.flag !== dbPath) {
        if (!dryRun) {
          await prisma.country.update({
            where: { id: country.id },
            data: { flag: dbPath },
          });
        }
        console.log(`  ✓ ${country.name}: DB path set → ${dbPath}`);
        stats.dbUpdated++;
      } else {
        stats.skipped++;
      }
      continue;
    }

    // Scrape wiki infobox
    const flagFilename = await scrapeWikiFlag(country.name);
    await sleep(REQUEST_DELAY);

    if (!flagFilename) {
      console.log(`  - ${country.name}: no flag found on wiki`);
      stats.failed++;
      continue;
    }

    stats.scraped++;

    // Resolve the filename to a URL
    const urlMap = await resolveWikiFileUrls([flagFilename]);
    await sleep(REQUEST_DELAY);

    const url = urlMap.values().next().value;
    if (!url) {
      console.warn(
        `  ⚠ ${country.name}: found "${flagFilename}" in infobox but can't resolve URL`
      );
      stats.failed++;
      continue;
    }

    const ext = getExtension(flagFilename);
    const localFile = `${localKey}${ext}`;
    const localPath = path.join(FLAGS_DIR, localFile);
    const dbPath = `/flags/${localFile}`;

    if (dryRun) {
      console.log(
        `  [DRY] ${country.name}: "${flagFilename}" → ${localFile}`
      );
      stats.downloaded++;
    } else {
      try {
        const size = await downloadFile(url, localPath);
        metadata.flags[localKey] = {
          fileName: localFile,
          originalUrl: url,
          downloadedAt: Date.now(),
          fileSize: size,
          source: { name: "IxWiki", baseUrl: "https://ixwiki.com", priority: 1 },
        };

        await prisma.country.update({
          where: { id: country.id },
          data: { flag: dbPath },
        });
        stats.dbUpdated++;

        console.log(
          `  ✓ ${country.name}: "${flagFilename}" → ${localFile} (${(size / 1024).toFixed(1)}KB)`
        );
        stats.downloaded++;
      } catch (err) {
        console.error(
          `  ✗ ${country.name}: download failed for "${flagFilename}":`,
          err
        );
        stats.failed++;
      }
    }
  }

  // ─── Phase 3: Ensure all existing local flags are in metadata ─────────────

  console.log("\n─── Phase 3: Reconcile local files with metadata ───");

  const localFiles = fs.readdirSync(FLAGS_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return [".png", ".svg", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext);
  });

  let metadataAdded = 0;
  for (const file of localFiles) {
    const key = normalizeFileName(path.basename(file, path.extname(file)));
    if (!metadata.flags[key]) {
      const filePath = path.join(FLAGS_DIR, file);
      const stat = fs.statSync(filePath);
      metadata.flags[key] = {
        fileName: file,
        originalUrl: "",
        downloadedAt: stat.mtimeMs,
        fileSize: stat.size,
        source: { name: "Local", baseUrl: "", priority: 0 },
      };
      metadataAdded++;
    }
  }
  if (metadataAdded > 0) {
    console.log(`  Added ${metadataAdded} local files to metadata`);
  }

  // ─── Save metadata ───────────────────────────────────────────────────────

  if (!dryRun) {
    saveMetadata(metadata);
    console.log(`\nMetadata saved (${Object.keys(metadata.flags).length} entries)`);
  }

  // ─── Summary ───────────────────────────────────────────────────────────────

  console.log("\n=== Summary ===");
  console.log(`  Resolved from wiki API: ${stats.resolved}`);
  console.log(`  Scraped from infobox:   ${stats.scraped}`);
  console.log(`  Downloaded:             ${stats.downloaded}`);
  console.log(`  DB paths updated:       ${stats.dbUpdated}`);
  console.log(`  Skipped (already OK):   ${stats.skipped}`);
  console.log(`  Failed/not found:       ${stats.failed}`);
  console.log(
    `  Total local flags:      ${fs.readdirSync(FLAGS_DIR).filter((f) => !f.endsWith(".json")).length}`
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
