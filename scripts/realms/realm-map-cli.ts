/**
 * The realm map pipeline from the command line: the same background job the realm's admin panel queues
 * (src/server/modules/maps/realm-map-pipeline.job.ts), run in this process under the realm's map import lease and
 * recorded in its run history. scripts/realms/build-realm-map.ts runs any steps; the per-step scripts
 * (build-realm-rasters, import-realm-layers, repair-realm-geometry, seed-realm-labels, localize-realm-flags) run
 * one each. Dry run by default; --apply writes.
 *
 * Shared arguments:
 *   --realm <slug>       the realm (its pipeline config is `Realm.settings.map.pipeline`)
 *   --source <dir>       a local checkout of the realm's source repository: repository art is read from it
 *   --preset <id>        first fill the realm's pipeline from a source preset (empty fields only; --force: all)
 *   --apply              write; without it every step only reports what it would change
 */
import { PrismaClient } from "@prisma/client";
import {
  MAP_PIPELINE_STEP_LABELS,
  MAP_PIPELINE_STEPS,
  type MapPipelineStep,
} from "~/lib/maps/realm-map-pipeline";
import { getMapImportJob, runMapImportJob } from "~/server/modules/maps/map-import.jobs";
import type { RealmActor } from "~/server/modules/realms/realms.access";
import {
  loadMapPipelinePreset,
  startMapPipelineRun,
} from "~/server/modules/maps/realm-map-pipeline.config";
import type { PipelineSummary } from "~/server/modules/maps/realm-map-pipeline.job";

function optionalArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const value = process.argv[i + 1];
  if (!value || value.startsWith("--")) throw new Error(`--${name} needs a value`);
  return value;
}

const isStep = (value: string): value is MapPipelineStep =>
  (MAP_PIPELINE_STEPS as readonly string[]).includes(value);

/** `--steps a,b` (default: the script's own steps). */
function stepsArg(defaults: readonly MapPipelineStep[]): MapPipelineStep[] {
  const raw = optionalArg("steps");
  if (!raw) return [...defaults];
  const steps = raw.split(",").map((s) => s.trim());
  const bad = steps.filter((s) => !isStep(s));
  if (bad.length > 0) {
    throw new Error(`unknown step ${bad.join(", ")} (steps: ${MAP_PIPELINE_STEPS.join(", ")})`);
  }
  return steps.filter(isStep);
}

function printSummary(summary: PipelineSummary) {
  for (const result of summary.steps) {
    console.log(
      `\n${MAP_PIPELINE_STEP_LABELS[result.step]} [${result.status}] (${(result.ms / 1000).toFixed(1)} s)`
    );
    console.log(`  ${result.summary}`);
    for (const line of result.details) console.log(`    ${line}`);
  }
  const art = Object.entries(summary.art);
  if (art.length > 0)
    console.log(`\nart read: ${art.map(([k, h]) => `${k} ${h.slice(0, 12)}`).join(", ")}`);
}

async function run(db: PrismaClient, actor: RealmActor, defaults: readonly MapPipelineStep[]) {
  const slug = optionalArg("realm");
  if (!slug) throw new Error("missing --realm");
  const realm = await db.realm.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (!realm) throw new Error(`no realm with slug "${slug}"`);
  const dryRun = !process.argv.includes("--apply");
  const preset = optionalArg("preset");
  if (preset) {
    const force = process.argv.includes("--force");
    const loaded = await loadMapPipelinePreset(db, actor, realm.id, preset, { force });
    console.log(
      `preset ${preset}: filled ${loaded.filled.join(", ") || "nothing"}; kept ${loaded.kept.join(", ") || "nothing"}`
    );
  }
  const steps = stepsArg(defaults);
  console.log(
    `${realm.name} (${realm.id}): ${steps.join(", ")}${dryRun ? ", dry run: nothing is written" : ""}`
  );
  const { jobId } = await startMapPipelineRun(
    db,
    actor,
    realm.id,
    { steps, dryRun },
    { kick: false }
  );
  const localDir = optionalArg("source");
  let last = "";
  const outcome = await runMapImportJob(db, jobId, {
    pipeline: {
      localDir,
      onProgress: (percent, stage) => {
        if (stage === last) return;
        last = stage;
        process.stdout.write(`\r${Math.round(percent)}% ${stage}`.padEnd(100).slice(0, 100));
      },
    },
  });
  process.stdout.write("\n");
  if (outcome === "busy")
    throw new Error("another map job of this realm holds its lease: try again later");
  const job = await getMapImportJob(db, actor, jobId);
  if (job.result?.phase === "pipeline") printSummary(job.result);
  console.log(`\nrun ${jobId}: ${job.status}${job.error ? ` (${job.error})` : ""}`);
  if (job.status !== "succeeded") process.exitCode = 1;
}

/** Run the CLI with the script's default steps; `name` identifies the script in the run history and audit log. */
export function realmMapCli(name: string, defaults: readonly MapPipelineStep[]): void {
  const db = new PrismaClient();
  const actor: RealmActor = {
    id: `script:${name}`,
    clerkUserId: `script:${name}`,
    role: { name: "system", level: 0 },
  };
  run(db, actor, defaults)
    .catch((error: Error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.$disconnect();
      // The cache module's Redis client keeps the event loop alive
      process.exit();
    });
}
