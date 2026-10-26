/**
 * scripts/audit/wikios-proof.ts — the WikiOS gold proof: runs the three harnesses (editor round trip, render parity,
 * bench) under a profile, checks their reports against scripts/audit/wikios-proof-thresholds.json, and writes
 * summary.json and summary.md keyed to the WikiOS tree it measured. `predeploy` is the release gate.
 *
 * Everything decidable is pure and tested in scripts/lib/wikios-proof-gate.ts; this file only reads and writes files,
 * runs git and the harness scripts, and asks the database for the corpus titles inside a READ ONLY transaction.
 * The one database write is the `wikios-proof` job lease (job_leases), which predeploy takes so the weekly proof
 * never runs mid-deploy and `deployed` releases. The harnesses keep their own guards (the round trip refuses a
 * non-local DATABASE_URL and the 15433 tunnel); they get this process's environment unchanged.
 *
 * Run it from the repository root. Usage: see USAGE below, or `bun scripts/audit/wikios-proof.ts --help`.
 * Docs: docs/audits/wikios-proof/README.md.
 */

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import type { z } from "zod";
import { acquireJobLease, releaseJobLease } from "../../src/lib/system/job-lock";
import { DEFAULT_ENV_FILES, loadEnvFiles } from "../lib/env-files";
import { exitWithError, loadPageList } from "../lib/wikios-harness";
import {
  DEFAULT_KEEP,
  WIKIOS_PROOF_LOCK,
  WIKIOS_PROOF_PATHS,
  assertProfileEnvironment,
  benchPageList,
  benchReportSchema,
  buildSummary,
  checkCommittedProof,
  corpusCounts,
  evaluatePredeploy,
  evaluateProof,
  leaseCheck,
  parityReportSchema,
  parseCli,
  parseProofSummary,
  parseThresholds,
  predeployFilesToPrune,
  predeployReport,
  profileCommands,
  releasesLease,
  proofStamp,
  renderChecks,
  renderProofSummary,
  resolveRunConfig,
  roundTripCommand,
  roundTripReportSchema,
  runsToPrune,
  treeState,
  type CliCommand,
  type CommittedProofResult,
  type DeployLease,
  type GitOutput,
  type HarnessCommand,
  type HarnessExit,
  type ProofProfile,
  type ProofReports,
  type ProofThresholds,
  type TreeState,
} from "../lib/wikios-proof-gate";

const USAGE = `Usage:
  bun scripts/audit/wikios-proof.ts run --profile local|launch|recurring [--out-dir d] [--mw-api url]
      [--wikios url] [--mw url] [--wikios-public url] [--parity-sample n|all] [--parity-interval-ms n]
      [--bench-pages n|all] [--bench-runs n] [--keep 12]
  bun scripts/audit/wikios-proof.ts gate --profile local|launch|recurring --roundtrip f --parity f [--bench f]
      [--out-dir d]
  bun scripts/audit/wikios-proof.ts predeploy
  bun scripts/audit/wikios-proof.ts deployed

Profiles:
  local      DATABASE_URL must be the ixstats_proof clone on localhost:5433. Parity samples 500 corpus pages
             against classic's public api.php, one request every 2 s at most, and reads WikiOS from the dev
             server at http://localhost:3200. The bench (the 25 default pages x 2 runs) is reference only.
  launch     On the server: NODE_ENV=production, parity over the whole corpus against the loopback renderer
             (WIKIOS_MEDIAWIKI_INTERNAL_URL) and IxStates on 127.0.0.1:$PORT$BASE_PATH; bench 200 pages x 2
             runs through the public URLs.
  recurring  As launch, with a parity sample of 200 and a bench of 50 pages x 1 run (the weekly cron job).

run      Writes <WIKIOS_PROOF_DIR or .bench-out/proof>/<yyyymmdd-HHMM UTC>-<profile>/ (or --out-dir): the corpus
         titles, the bench pages, each harness's report and log, summary.json and summary.md. The round trip
         always covers every namespace of the database. Server profiles keep the newest --keep runs. Exits 1
         unless every check passed.
gate     Checks existing reports against scripts/audit/wikios-proof-thresholds.json and writes the summary to
         --out-dir (default: <the parity report's directory>/regated).
predeploy  Takes the wikios-proof job lease for the deploy (2 hours; refused while the weekly proof holds it), checks
         docs/audits/wikios-proof/latest.json against this commit's WikiOS tree and runs the full round trip into
         <WIKIOS_PROOF_DIR or .bench-out/proof>/predeploy-<stamp>.json, keeping the newest 12 predeploy runs. Exits 1
         on a failure, releasing the lease; WIKIOS_PROOF_OVERRIDE=1 prints each failure as overridden and exits 0.
deployed Releases the lease predeploy took (the deploy runs it after its PM2 reload).

Run from the repository root. Nothing is written to any database but the wikios-proof job lease. See
docs/audits/wikios-proof/README.md.`;

const THRESHOLDS_FILE = fileURLToPath(new URL("./wikios-proof-thresholds.json", import.meta.url));
const DEFAULT_BENCH_PAGES = fileURLToPath(new URL("../bench/pages.default.json", import.meta.url));
const COMMITTED_PROOF = "docs/audits/wikios-proof/latest.json";
/** The deploy's hold on the proof's lease. Deploys never overlap, so a new one takes over a failed one's leftover hold. */
const DEPLOY_HOLDER = "deploy";
const DEPLOY_LEASE_MS = 2 * 60 * 60_000;
/** The files the production entry points load (load-env.mjs), first file wins. */
const PRODUCTION_ENV_FILES = [".env.production.local", ".env.local", ".env.production", ".env"];

const proofDir = (): string => process.env.WIKIOS_PROOF_DIR || ".bench-out/proof";
const thresholds = (): ProofThresholds => parseThresholds(readFileSync(THRESHOLDS_FILE, "utf8"));
const message = (error: Error | string): string => (error instanceof Error ? error.message : error);
const writeJson = (file: string, value: object): void =>
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

function git(args: string[]): GitOutput {
  const result = spawnSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status, stdout: result.stdout ?? "" };
}

function currentTree(): TreeState {
  return treeState(
    git(["ls-tree", "-r", "HEAD", "--", ...WIKIOS_PROOF_PATHS]),
    git(["status", "--porcelain", "--", ...WIKIOS_PROOF_PATHS]),
    git(["rev-parse", "HEAD"])
  );
}

// A SIGTERM (the cron job's timeout) takes the running harness down with this process.
let activeChild: ChildProcess | null = null;
process.on("SIGTERM", () => {
  activeChild?.kill("SIGTERM");
  process.exit(143);
});

/** Runs one harness with this process's environment, its stdout and stderr in `logFile`. */
function runHarness(command: HarnessCommand, logFile: string): Promise<HarnessExit> {
  console.error(`Running ${command.name} (log: ${logFile})`);
  const log = openSync(logFile, "w");
  return new Promise((resolve) => {
    let settled = false;
    const finish = (code: number | null): void => {
      if (settled) return;
      settled = true;
      activeChild = null;
      closeSync(log);
      resolve({ name: command.name, code });
    };
    const child = spawn(process.execPath, command.argv, {
      stdio: ["ignore", log, log],
      env: process.env,
    });
    activeChild = child;
    child.on("error", (error) => {
      console.error(`${command.name} did not start: ${error.message}`);
      finish(127);
    });
    child.on("close", finish);
  });
}

function readReport<T>(file: string, schema: z.ZodType<T>): T | null {
  if (!existsSync(file)) return null;
  try {
    return schema.parse(JSON.parse(readFileSync(file, "utf8")));
  } catch (error) {
    console.error(
      `${file} is not a usable report: ${message(error instanceof Error ? error : String(error))}`
    );
    return null;
  }
}

async function withPrisma<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  try {
    return await fn(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

/** Published IxWiki articles with text that are not redirects, by title. Read only, enforced by Postgres. */
function corpusTitles(): Promise<string[]> {
  return withPrisma(async (prisma) => {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return tx.$queryRaw<Array<{ title: string }>>`
        SELECT "title" FROM "wiki_articles"
        WHERE "source" = 'ixwiki' AND "status" = 'PUBLISHED' AND "namespace" = 0
          AND btrim("wikitext") <> '' AND "wikitext" !~* '^\\s*#redirect'
        ORDER BY "title"`;
    });
    return rows.map((row) => row.title);
  });
}

/** Takes the proof's lease for the deploy, first dropping a failed deploy's leftover hold. */
async function takeDeployLease(): Promise<DeployLease> {
  try {
    return await withPrisma(async (prisma) => {
      await releaseJobLease(prisma, WIKIOS_PROOF_LOCK, DEPLOY_HOLDER);
      if (await acquireJobLease(prisma, WIKIOS_PROOF_LOCK, DEPLOY_HOLDER, DEPLOY_LEASE_MS)) {
        return { state: "taken" };
      }
      const [row] = await prisma.$queryRaw<Array<{ holder: string; expiresAt: Date }>>`
        SELECT "holder", "expiresAt" FROM "job_leases" WHERE "name" = ${WIKIOS_PROOF_LOCK}`;
      return {
        state: "held",
        holder: row?.holder ?? "another run",
        expiresAt: row?.expiresAt.toISOString() ?? "now",
      };
    });
  } catch (error) {
    return { state: "error", message: message(error instanceof Error ? error : String(error)) };
  }
}

const releaseDeployLease = (): Promise<void> =>
  withPrisma((prisma) => releaseJobLease(prisma, WIKIOS_PROOF_LOCK, DEPLOY_HOLDER));

/** Evaluates, writes summary.json and summary.md, prints the checks; true when the proof passed. */
function writeSummary(
  profile: ProofProfile,
  reports: ProofReports,
  exits: HarnessExit[],
  outDir: string,
  tree: TreeState
): boolean {
  const checks = evaluateProof(profile, reports, thresholds(), exits);
  const meta = {
    profile,
    generatedAt: new Date().toISOString(),
    ...tree,
    corpus: corpusCounts(reports),
  };
  const summary = buildSummary(meta, checks);
  writeJson(join(outDir, "summary.json"), summary);
  writeFileSync(join(outDir, "summary.md"), renderProofSummary(summary, reports));
  console.log(renderChecks(checks).join("\n"));
  const dirty = summary.dirty
    ? " (uncommitted WikiOS changes: this run cannot stand as a proof)"
    : "";
  console.log(`\n${summary.passed ? "PASSED" : "FAILED"}${dirty}`);
  return summary.passed;
}

function pruneServerRuns(keep: number): void {
  const dir = proofDir();
  if (!existsSync(dir)) return;
  for (const name of runsToPrune(readdirSync(dir), keep))
    rmSync(join(dir, name), { recursive: true, force: true });
}

async function run(command: Extract<CliCommand, { command: "run" }>): Promise<number> {
  const { profile } = command;
  assertProfileEnvironment(profile, process.env);
  thresholds(); // a malformed thresholds file fails before an hour of measuring
  const outDir = command.outDir ?? join(proofDir(), `${proofStamp(new Date())}-${profile}`);
  const cfg = resolveRunConfig(profile, command.overrides, process.env, outDir);
  const tree = currentTree();
  mkdirSync(dirname(outDir), { recursive: true });
  mkdirSync(outDir); // a second run into the same directory refuses rather than mixing reports
  const corpus = await corpusTitles();
  writeJson(cfg.corpusFile, corpus);
  writeJson(
    cfg.benchPagesFile,
    benchPageList(loadPageList(DEFAULT_BENCH_PAGES), corpus, cfg.benchPages)
  );
  const commands = profileCommands(cfg);
  const exits: HarnessExit[] = [];
  for (const harness of commands)
    exits.push(await runHarness(harness, join(outDir, `${harness.name}.txt`)));
  const [roundtrip, parity, bench] = commands;
  const reports: ProofReports = {
    roundTrip: readReport(roundtrip.out, roundTripReportSchema),
    parity: readReport(parity.out, parityReportSchema),
    bench: readReport(bench.out, benchReportSchema),
  };
  const passed = writeSummary(profile, reports, exits, outDir, tree);
  if (profile !== "local") pruneServerRuns(command.keep);
  console.log(`Proof written to ${outDir}`);
  return passed ? 0 : 1;
}

function gate(command: Extract<CliCommand, { command: "gate" }>): number {
  const reports: ProofReports = {
    roundTrip: readReport(command.roundtrip, roundTripReportSchema),
    parity: readReport(command.parity, parityReportSchema),
    bench: command.bench === null ? null : readReport(command.bench, benchReportSchema),
  };
  const outDir = command.outDir ?? join(dirname(command.parity), "regated");
  mkdirSync(outDir, { recursive: true });
  const passed = writeSummary(command.profile, reports, [], outDir, currentTree());
  console.log(`Proof written to ${outDir}`);
  return passed ? 0 : 1;
}

function committedProof(treeKey: string): CommittedProofResult {
  if (!existsSync(COMMITTED_PROOF)) return checkCommittedProof(null, treeKey);
  try {
    return checkCommittedProof(parseProofSummary(readFileSync(COMMITTED_PROOF, "utf8")), treeKey);
  } catch (error) {
    const why = message(error instanceof Error ? error : String(error));
    return { ok: false, reason: `${COMMITTED_PROOF} is not a proof summary (${why})` };
  }
}

async function predeploy(): Promise<number> {
  const t = thresholds();
  const lease = await takeDeployLease();
  const committed = committedProof(currentTree().treeKey);
  const dir = proofDir();
  mkdirSync(dir, { recursive: true });
  const stamp = proofStamp(new Date());
  const command = roundTripCommand(join(dir, `predeploy-${stamp}.json`));
  const exit = await runHarness(command, join(dir, `predeploy-${stamp}.txt`));
  const checks = [
    leaseCheck(lease),
    ...evaluatePredeploy(committed, readReport(command.out, roundTripReportSchema), t, exit),
  ];
  for (const name of predeployFilesToPrune(readdirSync(dir), DEFAULT_KEEP))
    rmSync(join(dir, name), { force: true });
  const { lines, exitCode } = predeployReport(checks, process.env.WIKIOS_PROOF_OVERRIDE === "1");
  for (const line of lines) console.log(line);
  if (releasesLease(exitCode, lease)) await releaseDeployLease();
  return exitCode;
}

async function deployed(): Promise<number> {
  await releaseDeployLease();
  console.log(`Released the ${WIKIOS_PROOF_LOCK} lease`);
  return 0;
}

function dispatch(command: Exclude<CliCommand, { command: "help" }>): Promise<number> | number {
  if (command.command === "run") return run(command);
  if (command.command === "gate") return gate(command);
  if (command.command === "deployed") return deployed();
  return predeploy();
}

async function main(): Promise<void> {
  let command: CliCommand;
  try {
    command = parseCli(process.argv.slice(2));
  } catch (error) {
    console.error(message(error instanceof Error ? error : String(error)));
    console.error(USAGE);
    process.exit(1);
  }
  if (command.command === "help") {
    console.log(USAGE);
    return;
  }
  loadEnvFiles(process.env.NODE_ENV === "production" ? PRODUCTION_ENV_FILES : DEFAULT_ENV_FILES);
  process.exit(await dispatch(command));
}

main().catch(exitWithError);
