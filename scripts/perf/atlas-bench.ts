/**
 * scripts/perf/atlas-bench.ts - Atlas acceptance benchmark (`bun run perf:atlas`): the Release 0 targets and the
 * Release A world generator's.
 *
 * Measures the acceptance targets of docs/specs/2026-10-11-atlas-release-0-performance-design.md against the local
 * database and prints one PASS or FAIL line per target with the measured value (INFO lines print numbers that have
 * no target); the exit code is 1 if any target fails. It runs the server code in process (the route handlers, the
 * loaders, the tRPC procedure) on a Prisma client of its own, so it needs no dev server, and the editor measurements
 * on the pure functions the editor uses plus the real region-reshape hook in jsdom. Nothing is written to the
 * database. Vector tiles render into a temporary folder that is removed at the end, never the app's `MAP_TILE_DIR`.
 * The generator lines (first generation, slider change, reroll, gated on the targets of
 * docs/specs/2026-10-11-atlas-release-a-world-creation-design.md; the worker runner's end-to-end time per message,
 * informational) run in fresh child processes and need no database (atlas-bench-worldgen.ts).
 *
 * What it cannot see: a browser. The second `/maps` load's "no layer download" is checked as what the layer route
 * sends (an immutable URL and a 304 for a repeat request), not as a download that does not happen; the region-reshape
 * release frame is the overlap work done in the mouse-up handler, over a fake map in jsdom, not a painted frame; and
 * the drag frame is the JS of the pure drag functions, without MapLibre's own work on the posted data.
 *
 * Usage: bun run perf:atlas
 *
 * It reads `DATABASE_URL` the way Bun loads `.env` and refuses a database that is not on this machine, or is
 * named like production (`--production` lifts the second check, as in the migration runners).
 */
import "./atlas-bench-client";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { databaseLabel, productionDatabaseRefusal } from "../lib/database-guard";
import { isLocalDatabaseUrl } from "../lib/wikios-harness";
import { client, writeStatements } from "./atlas-bench-client";
import { borderEditorTargets } from "./atlas-bench-editor";
import { exactly, exitCode, renderResults, type TargetResult } from "./atlas-bench-report";
import { reshapeTargets } from "./atlas-bench-reshape";
import {
  coverageTargets,
  geoProfileTargets,
  layerTargets,
  printTileHits,
  tileTargets,
} from "./atlas-bench-server";
import { printWorldgenRun, WORLDGEN_RUN_FLAG, worldgenTargets } from "./atlas-bench-worldgen";

const TILE_HITS_FLAG = "--tile-hits";

/** Why this run must not start, or null. */
function refusal(): string | null {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabaseUrl(url)) {
    return `DATABASE_URL (${databaseLabel(url)}) is not a database on this machine.`;
  }
  return productionDatabaseRefusal(url, process.argv.includes("--production"));
}

async function ixnayMapVersion(): Promise<number> {
  const realm = await client.realm.findUniqueOrThrow({
    where: { id: "default" },
    select: { mapVersion: true },
  });
  return realm.mapVersion;
}

/** Every measurement in turn, the routes first so the layers the coverage check reads are already built. */
async function measure(version: number): Promise<TargetResult[]> {
  const results = [
    ...(await layerTargets(version)),
    ...(await coverageTargets(version)),
    ...(await tileTargets(version, fileURLToPath(import.meta.url))),
    ...(await geoProfileTargets()),
    ...(await borderEditorTargets()),
    ...(await reshapeTargets()),
    ...worldgenTargets(fileURLToPath(import.meta.url)),
  ];
  const writes = await writeStatements();
  return [
    ...results,
    exactly("benchmark: database write statements", writes.length, 0, "", writes[0]),
  ];
}

async function main(): Promise<number> {
  const reason = refusal();
  if (reason) {
    process.stderr.write(`${reason}\n`);
    return 1;
  }
  const hitsFlag = process.argv.indexOf(TILE_HITS_FLAG);
  if (hitsFlag >= 0) {
    await printTileHits(Number(process.argv[hitsFlag + 1]));
    return 0;
  }
  const worldgenFlag = process.argv.indexOf(WORLDGEN_RUN_FLAG);
  if (worldgenFlag >= 0) {
    printWorldgenRun(process.argv[worldgenFlag + 1] ?? "");
    return 0;
  }

  const version = await ixnayMapVersion();
  const tileDir = await mkdtemp(path.join(tmpdir(), "atlas-bench-tiles-"));
  process.env.MAP_TILE_DIR = tileDir;
  try {
    const results = await measure(version);
    const heading = `Atlas acceptance (Release 0, generator): ${databaseLabel(process.env.DATABASE_URL)}, Ixnay map version ${version}, tiles in ${tileDir}`;
    process.stdout.write(`${heading}\n\n${renderResults(results)}\n`);
    return exitCode(results);
  } finally {
    await rm(tileDir, { recursive: true, force: true });
  }
}

const code = await main().catch((err: Error) => {
  process.stderr.write(`perf:atlas failed: ${err.stack ?? err.message}\n`);
  return 1;
});
await client.$disconnect();
process.exit(code);
