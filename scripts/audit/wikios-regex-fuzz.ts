/**
 * scripts/audit/wikios-regex-fuzz.ts — the regex-DoS fuzz of WikiOS's text-processing functions.
 *
 * Anyone with edit rights can store 2,000,000 characters of wikitext and anonymous readers trigger the
 * processing of it, so every function that reads page text must be linear (or bounded) on hostile input.
 * This runs each function listed in wikios-regex-fuzz-targets.ts (and the functions it skips, with
 * the reason, are listed there too) on 2 MB of every hostile family (openers that never close, nested
 * openers, unicode spaces, entities, seeded random soups of all of them …) and fails when one takes
 * longer than the budget.
 *
 * Each function runs in its own child process under a watchdog, so a function that never returns is
 * reported (and its process SIGKILLed) instead of stalling the run. (A `worker_threads` worker cannot
 * stand in: `terminate()` cannot interrupt a regular expression that is running, and the worker burns a
 * core for as long as the match takes.) A family is tried at 16 KB first: a function over the budget
 * there is a breach already and its 2 MB run (hours, when quadratic) is skipped.
 *
 * Usage:
 *   bun scripts/audit/wikios-regex-fuzz.ts                       whole run: a line per function (its slowest input family) and a row per breach, exit 1 on a breach
 *   bun scripts/audit/wikios-regex-fuzz.ts --only=wikitext-parser  just the targets whose name contains it
 *   bun scripts/audit/wikios-regex-fuzz.ts --family=nowiki --all   just those families, every row printed
 *   Options: --budget=200 (ms) --size=2000000 --workers=2 --hard=3000 (ms before a process is killed)
 *            --json=path (the whole table as JSON) --skipped (just list what is not run, and why)
 *
 * No database and no network is touched: DATABASE_URL is pointed at nothing before any module loads.
 */

import { spawn } from "node:child_process";
import { writeFileSync, writeSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import {
  FAMILIES,
  SKIPPED,
  TARGETS,
  familiesFor,
  inputFor,
  type Family,
  type Target,
} from "./wikios-regex-fuzz-targets";

/** What a child process is asked: one target, the families to run, and how big. */
interface Job {
  target: string;
  families: string[];
  size: number;
  probeSize: number;
  budgetMs: number;
}

/** What a child answers, one JSON line (after `@@`) per step. */
type Message =
  | { type: "start"; family: string }
  | { type: "done"; family: string; ms: number; at: number; threw: boolean }
  | { type: "loaded" }
  | { type: "failed"; error: string };

interface Row {
  target: string;
  family: string;
  /** Milliseconds, as measured (the watchdog's limit for a function that never returned). */
  ms: number;
  /** The input length it was measured at: the probe's when the probe already breached. */
  at: number;
  /** The process had to be killed. */
  hung: boolean;
  threw: boolean;
  /** The milliseconds it was allowed. */
  budget: number;
}

const PROBE_SIZE = 16_000;
/** What the runner passes its child (the job follows). */
const CHILD_FLAG = "--child";

// ---- the child -------------------------------------------------------------------------------------

async function runJob(job: Job): Promise<void> {
  // The measured code logs (an image URL it cannot parse is printed whole): none of it is wanted here.
  console.error = console.warn = console.log = console.info = () => {};
  // Written synchronously: the runner must see "start" before the function runs, not after it returns.
  const post = (message: Message) => writeSync(1, `@@${JSON.stringify(message)}\n`);
  const target = TARGETS.find((candidate) => candidate.name === job.target);
  if (!target) return void post({ type: "failed", error: `unknown target ${job.target}` });

  let call: Awaited<ReturnType<Target["load"]>>;
  try {
    call = await target.load();
  } catch (error) {
    return void post({
      type: "failed",
      error: String(error instanceof Error ? error.message : error),
    });
  }
  post({ type: "loaded" });

  const timed = async (input: string): Promise<{ ms: number; threw: boolean }> => {
    let threw = false;
    const began = performance.now();
    try {
      await call(input);
    } catch {
      threw = true; // a refusal (too large, malformed) is an answer; how fast it came is what counts
    }
    return { ms: performance.now() - began, threw };
  };

  await timed("<p>{{a}} [[b]] 'c'</p>"); // what a function sets up on its first call (a DOM, a table) is not what is measured

  for (const name of job.families) {
    const family = FAMILIES.find((candidate) => candidate.name === name)!;
    const probeInput = inputFor(target.kind, family, job.probeSize);
    post({ type: "start", family: name });
    let probe = await timed(probeInput);
    if (probe.ms > job.budgetMs && probe.ms < 5 * job.budgetMs) {
      const again = await timed(probeInput); // one stall (a collection, a busy machine) is not a breach: it has to happen twice
      if (again.ms < probe.ms) probe = again;
    }
    if (probe.ms > job.budgetMs) {
      post({ type: "done", family: name, ms: probe.ms, at: job.probeSize, threw: probe.threw });
      continue;
    }
    const input = inputFor(target.kind, family, job.size);
    post({ type: "start", family: name });
    let full = await timed(input);
    // Near the line: the machine may be busy (other jobs, a garbage collection). A breach is one that
    // happens three times running, so the best of up to three counts. A quadratic function is far past 5x.
    for (
      let tries = 1;
      tries < 3 && full.ms > job.budgetMs && full.ms < 5 * job.budgetMs;
      tries++
    ) {
      post({ type: "start", family: name });
      const again = await timed(input);
      if (again.ms < full.ms) full = again;
    }
    post({ type: "done", family: name, ms: full.ms, at: job.size, threw: full.threw });
  }
}

// ---- the runner ------------------------------------------------------------------------------------

interface Options {
  budgetMs: number;
  size: number;
  workers: number;
  hardMs: number;
  only: string | null;
  family: string | null;
  all: boolean;
  skipped: boolean;
  json: string | null;
}

function parseOptions(argv: string[]): Options {
  const value = (name: string): string | null =>
    argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null;
  return {
    budgetMs: Number(value("budget") ?? 200),
    size: Number(value("size") ?? 2_000_000),
    workers: Math.min(2, Math.max(1, Number(value("workers") ?? 2))),
    hardMs: Number(value("hard") ?? 3000),
    only: value("only"),
    family: value("family"),
    all: argv.includes("--all"),
    skipped: argv.includes("--skipped"),
    json: value("json"),
  };
}

/** The milliseconds `target` may take: the budget, times what it was granted. */
const budgetOf = (target: Target, options: Options): number =>
  options.budgetMs * (target.limits?.slowFactor ?? 1);

/** Runs one target to the end, killing and replacing a process that does not answer within `hardMs`. */
async function measure(target: Target, families: Family[], options: Options): Promise<Row[]> {
  const rows: Row[] = [];
  const hardMs = Math.max(options.hardMs, 2 * budgetOf(target, options)); // a function allowed 3 s is not killed at 3 s
  let remaining = families.map((family) => family.name);
  const row = (family: string, fields: Pick<Row, "ms" | "at" | "hung" | "threw">): Row => ({
    target: target.name,
    family,
    budget: budgetOf(target, options),
    ...fields,
  });

  while (remaining.length > 0) {
    const job: Job = {
      target: target.name,
      families: remaining,
      size: Math.min(options.size, target.limits?.maxChars ?? options.size),
      probeSize: PROBE_SIZE,
      budgetMs: budgetOf(target, options),
    };
    const child = spawn(
      process.execPath,
      [fileURLToPath(import.meta.url), CHILD_FLAG, JSON.stringify(job)],
      {
        stdio: ["ignore", "pipe", "ignore"],
      }
    );
    const stopped = await new Promise<{ hungOn: string | null; failed: string | null }>(
      (resolve) => {
        let current: string | null = null;
        let failed: string | null = null;
        let watchdog: ReturnType<typeof setTimeout> | undefined;
        createInterface({ input: child.stdout! }).on("line", (line) => {
          if (!line.startsWith("@@")) return;
          clearTimeout(watchdog);
          const message = JSON.parse(line.slice(2)) as Message;
          if (message.type === "start") {
            current = message.family;
            watchdog = setTimeout(() => {
              child.kill("SIGKILL");
              resolve({ hungOn: current, failed: null });
            }, hardMs);
          } else if (message.type === "done") {
            current = null;
            rows.push(
              row(message.family, {
                ms: message.ms,
                at: message.at,
                hung: false,
                threw: message.threw,
              })
            );
          } else if (message.type === "failed") {
            failed = message.error;
          }
        });
        child.on("error", (error) => resolve({ hungOn: null, failed: error.message }));
        child.on("exit", () => {
          clearTimeout(watchdog);
          resolve({ hungOn: null, failed });
        });
      }
    );
    child.kill("SIGKILL");

    const finished = new Set(rows.map((entry) => entry.family));
    if (stopped.hungOn !== null) {
      rows.push(row(stopped.hungOn, { ms: hardMs, at: options.size, hung: true, threw: false }));
      finished.add(stopped.hungOn);
    }
    remaining = remaining.filter((name) => !finished.has(name));
    if (stopped.hungOn === null) {
      // The child ended by itself: it is done, or it could not run (an import failed, it crashed).
      if (remaining.length > 0) {
        const why = stopped.failed ?? "the process ended early";
        rows.push(
          row(`(could not run: ${why})`, { ms: Infinity, at: 0, hung: false, threw: true })
        );
      }
      break;
    }
  }
  return rows;
}

const pad = (text: string, width: number) => text.padEnd(width);
const formatMs = (row: Row) =>
  row.hung ? `>${row.ms.toFixed(0)} (killed)` : `${row.ms.toFixed(row.ms < 10 ? 1 : 0)}`;

function describe(row: Row): string {
  const size = row.at === 0 ? "" : ` @ ${(row.at / 1000).toFixed(0)} KB`;
  return `${formatMs(row)} ms${size}${row.threw && !row.hung ? " (threw)" : ""}`;
}

async function main(): Promise<number> {
  const options = parseOptions(process.argv.slice(2));
  if (options.skipped) {
    console.log(`not run (${SKIPPED.length} groups):`);
    for (const [name, reason] of SKIPPED) console.log(`  ${name}: ${reason}`);
    return 0;
  }
  const targets = TARGETS.filter((target) => !options.only || target.name.includes(options.only));
  const queue = [...targets];
  const rows: Row[] = [];

  console.log(
    `wikios-regex-fuzz: ${targets.length} functions, budget ${options.budgetMs} ms, ` +
      `${(options.size / 1e6).toFixed(1)} MB inputs, ${options.workers} processes`
  );

  let completed = 0;
  const lane = async () => {
    for (let target = queue.shift(); target; target = queue.shift()) {
      const families = familiesFor(target.kind).filter(
        (family) => !options.family || family.name.includes(options.family)
      );
      const own = families.length > 0 ? await measure(target, families, options) : []; // `--family=` may name no family of this kind
      rows.push(...own);
      completed++;
      if (own.length === 0) continue;
      const worst = own.reduce((a, b) => (b.ms > a.ms ? b : a), own[0]!);
      const breaches = own.filter((entry) => entry.ms > entry.budget).length;
      process.stderr.write(
        `  [${completed}/${targets.length}] ${target.name}: worst ${describe(worst)}${breaches ? `, ${breaches} breaches` : ""}\n`
      );
    }
  };
  await Promise.all(Array.from({ length: options.workers }, lane));

  const breaches = rows.filter((row) => row.ms > row.budget);

  // One line per function: its slowest input family.
  console.log(
    `\n${pad("function", 74)}${pad("slowest input family", 24)}${pad("ms", 30)}allowed  pairs  breaches`
  );
  for (const target of targets) {
    const own = rows.filter((row) => row.target === target.name);
    if (own.length === 0) continue;
    const worst = own.reduce((a, b) => (b.ms > a.ms ? b : a), own[0]!);
    const over = own.filter((row) => row.ms > row.budget).length;
    console.log(
      `${pad(target.name, 74)}${pad(worst.family, 24)}${pad(describe(worst), 30)}${pad(String(worst.budget), 9)}${pad(String(own.length), 7)}${over}`
    );
  }

  const shown = options.all ? rows : breaches;
  if (shown.length > 0) {
    console.log(
      `\n${options.all ? "every pair" : "breaches"}:\n${pad("function", 74)}${pad("input family", 24)}ms`
    );
    for (const row of shown.sort((a, b) => a.target.localeCompare(b.target) || b.ms - a.ms)) {
      const flag = row.ms > row.budget ? "BREACH " : "";
      console.log(`${pad(row.target, 74)}${pad(row.family, 24)}${flag}${describe(row)}`);
    }
  }

  const functions = new Set(rows.map((row) => row.target));
  const slowest = [...rows].sort((a, b) => b.ms - a.ms).slice(0, 5);
  console.log(`\n${functions.size} functions, ${rows.length} function/input pairs.`);
  console.log(
    "slowest pairs: " +
      slowest.map((row) => `${row.target} / ${row.family} ${describe(row)}`).join("; ")
  );
  console.log(
    `not run: ${SKIPPED.length} groups, with their reasons, in wikios-regex-fuzz-targets.ts (--skipped lists them)`
  );
  console.log(breaches.length === 0 ? "OK: no breach." : `FAIL: ${breaches.length} breaches.`);

  if (options.json) writeFileSync(options.json, JSON.stringify({ options, rows }, null, 1));
  return breaches.length === 0 ? 0 : 1;
}

// Nothing in a measured module may reach a real database, whatever the .env files say.
process.env.DATABASE_URL = "postgresql://nobody:nothing@127.0.0.1:1/none";
process.env.SKIP_ENV_VALIDATION = "1";

const childAt = process.argv.indexOf(CHILD_FLAG);
if (childAt === -1) {
  void main().then((code) => process.exit(code));
} else {
  void runJob(JSON.parse(process.argv[childAt + 1]!) as Job).then(() => process.exit(0));
}
