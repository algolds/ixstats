/**
 * The deploy's pre-push schema step: applies the additive part of the difference between the database and
 * prisma/schema, so the hand-written deploy SQL (and the scripts between it) find the tables and columns they read
 * before `db push` runs. What counts as additive, and what is left to the SQL and the push, is decided in
 * scripts/deployment/additive-schema.ts; the deploy's own SQL files are read from scripts/deploy-production.sh (every
 * `--file` before its `db push`).
 *
 *   bun scripts/deployment/apply-additive-schema.ts           # dry run: prints what it would apply, writes nothing
 *   bun scripts/deployment/apply-additive-schema.ts --apply   # applies it in one transaction (the deploy runs this)
 *
 * Needs DATABASE_URL (from the environment, else the env files). Read-only until --apply.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_ENV_FILES, loadEnvFiles } from "../lib/env-files";
import { applyBatches, deferredObjects, planAdditive } from "./additive-schema";

const DEPLOY_SCRIPT = "scripts/deploy-production.sh";
const SCHEMA = "prisma/schema";
/** The files the production entry points load (load-env.mjs), first file wins. */
const PRODUCTION_ENV_FILES = [".env.production.local", ".env.local", ".env.production", ".env"];

/** The SQL files the deploy runs before its `db push`. */
export function deploySqlBeforePush(script: string): string[] {
  const push = script.indexOf("bun run db:push:force");
  return [...script.matchAll(/prisma db execute --schema prisma\/schema --file (\S+\.sql)/g)]
    .filter((m) => push === -1 || m.index < push)
    .map((m) => m[1]!);
}

function prisma(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("bunx", ["prisma", ...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    env: process.env,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function main(): number {
  const apply = process.argv.includes("--apply");
  loadEnvFiles(process.env.NODE_ENV === "production" ? PRODUCTION_ENV_FILES : DEFAULT_ENV_FILES);
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[additive-schema] DATABASE_URL is not set");
    return 1;
  }

  const diff = prisma([
    "migrate",
    "diff",
    "--from-url",
    url,
    "--to-schema-datamodel",
    SCHEMA,
    "--script",
  ]);
  if (diff.status !== 0) {
    console.error(`[additive-schema] prisma migrate diff failed:\n${diff.stderr}`);
    return 1;
  }
  const files = deploySqlBeforePush(readFileSync(DEPLOY_SCRIPT, "utf8"));
  const plan = planAdditive(
    diff.stdout,
    deferredObjects(files.map((f) => readFileSync(f, "utf8")))
  );

  const kept = plan.changes.filter((c) => c.kept);
  const left = plan.changes.filter((c) => !c.kept);
  console.log(
    `[additive-schema] ${kept.length} additive change(s), ${left.length} left to the deploy SQL and db push`
  );
  for (const change of kept) console.log(`  + ${change.source}`);
  for (const change of left)
    console.log(`  - ${change.source.slice(0, 160)}\n      (${change.reason})`);

  if (plan.statements.length === 0) {
    console.log("[additive-schema] Nothing to apply");
    return 0;
  }
  if (!apply) {
    console.log(
      "[additive-schema] Dry run: nothing written (--apply applies the + lines: new enum values first, then the rest in one transaction)"
    );
    return 0;
  }

  // New enum values commit first: a column or table may default to one, and PostgreSQL refuses a value in the
  // transaction that added it. Added values on their own are harmless if the second batch then fails.
  const { enumValues, rest } = applyBatches(plan.statements);
  const dir = mkdtempSync(join(tmpdir(), "additive-schema-"));
  try {
    for (const [name, batch] of [
      ["enum values", enumValues],
      ["tables and columns", rest],
    ] as const) {
      if (batch.length === 0) continue;
      const file = join(dir, `${name.replace(/ /g, "-")}.sql`);
      writeFileSync(file, `BEGIN;\n${batch.map((s) => `${s};`).join("\n")}\nCOMMIT;\n`);
      const run = prisma(["db", "execute", "--schema", SCHEMA, "--file", file]);
      process.stdout.write(run.stdout);
      if (run.status !== 0) {
        const kept =
          name === "enum values"
            ? "nothing was changed"
            : `the ${enumValues.length} enum value(s) stay added`;
        console.error(`[additive-schema] Applying the ${name} failed; ${kept}:\n${run.stderr}`);
        return 1;
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log(`[additive-schema] Applied ${plan.statements.length} statement(s)`);
  return 0;
}

if (import.meta.main) process.exit(main());
