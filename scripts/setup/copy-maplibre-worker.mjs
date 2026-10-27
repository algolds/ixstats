#!/usr/bin/env node
/**
 * Copy MapLibre 6's web worker (and the shared chunk it imports) to public/maplibre/.
 *
 * MapLibre locates its worker next to its own module via import.meta.url, which points at a
 * bundled chunk under Turbopack, so src/lib/maps/load-maplibre.ts points it at
 * /maplibre/maplibre-gl-worker.mjs instead. public/ is gitignored, so these files only exist
 * after this script runs; without them every map (/maps, wiki map embeds, the Dashboard and
 * MyCountry map widgets) stalls on "Worker failed to load".
 *
 * Runs from postinstall, the build scripts and start-development.sh. Idempotent; needs no
 * other step (prisma generate) to succeed first.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sourceDir = join(root, "node_modules", "maplibre-gl", "dist");
const targetDir = join(root, "public", "maplibre");
const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

if (!existsSync(sourceDir)) {
  console.warn("[maplibre-worker] node_modules/maplibre-gl is missing — run `bun install`.");
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });
let copied = 0;
for (const file of files) {
  const from = join(sourceDir, file);
  const to = join(targetDir, file);
  if (!existsSync(from)) {
    console.error(`[maplibre-worker] ${from} not found (maplibre-gl version changed?)`);
    process.exit(1);
  }
  if (existsSync(to) && readFileSync(to).equals(readFileSync(from))) continue;
  copyFileSync(from, to);
  copied++;
}
if (copied > 0) console.log(`[maplibre-worker] copied ${copied} file(s) to public/maplibre/`);
