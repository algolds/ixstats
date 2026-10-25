/** @jest-environment node */
/**
 * The realm time runbook is the one ordered deploy procedure: every SQL file in scripts/migrations/2026-10-realm-time/
 * must be named in it (a file left out would never run), and every job its cron step enables must exist
 * (`cron-runner.mjs` exits on an unknown name).
 */
import fs from "fs";
import path from "path";
import { CRON_JOBS, resolveEnabledJobs } from "~/server/cron/jobs";

const ROOT = path.resolve(__dirname, "../../..");
const SQL_DIR = "scripts/migrations/2026-10-realm-time";
const runbook = fs.readFileSync(
  path.join(ROOT, "docs/operations/deploy-realm-time-2026-10.md"),
  "utf8"
);

describe("the realm time runbook", () => {
  const files = fs.readdirSync(path.join(ROOT, SQL_DIR)).filter((f) => f.endsWith(".sql"));

  it.each(files)("runs %s", (file) => {
    expect(runbook).toContain(`run_sql ${SQL_DIR}/${file}`);
  });

  it("has SQL files to run", () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it("enables only jobs that exist", () => {
    const names = [...runbook.matchAll(/CRON_ENABLED_JOBS="([^"]*)"/g)].flatMap((m) =>
      m[1]!.split(",").map((n) => n.trim())
    );
    expect(names.length).toBeGreaterThan(5);
    expect(resolveEnabledJobs(names.join(","), CRON_JOBS).unknown).toEqual([]);
  });
});
