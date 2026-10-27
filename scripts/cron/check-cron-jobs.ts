/**
 * Import smoke for the cron job table (plan 330): awaits every job's `load()` (import only —
 * never calls the job) and prints `ok <name>` / `FAIL <name>: <message>`. Exits 1 on any failure.
 * Importing constructs a PrismaClient but runs no query; use a dev environment.
 *
 *   bun scripts/cron/check-cron-jobs.ts
 */
import { CRON_JOBS } from "../../src/server/cron/jobs";

let failed = 0;
for (const job of CRON_JOBS) {
  try {
    await job.load();
    console.log(`ok ${job.name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${job.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
