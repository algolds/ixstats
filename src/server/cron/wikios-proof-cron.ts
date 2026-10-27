/**
 * The weekly WikiOS gold proof (`wikios-proof` in src/server/cron/jobs.ts; docs/audits/wikios-proof/README.md).
 *
 * Spawns the CLI's recurring profile (scripts/audit/wikios-proof.ts; src/ never imports scripts/, as db-backup spawns
 * pg_dump) from the runner's working directory: a render parity sample, the full editor round trip and a bench sample
 * against loopback MediaWiki and IxStates itself. The CLI prunes its own run directories. A failure, a refusal or a
 * run past 80 minutes (killed; the job's lease lasts 90) throws the failing checks and the report directory, so the
 * runner's alertCronFailure posts them.
 *
 * The runner holds the `wikios-proof` lease for the run, and the deploy's predeploy check holds the same lease from
 * before its database backup to its PM2 reload, so this job never overlaps itself or a deploy.
 */
import { spawn } from "child_process";

const MINUTE = 60_000;
const KILL_AFTER_MINUTES = 80;
/** A CLI that ignores SIGTERM gets SIGKILL this long after it. */
const KILL_GRACE_MS = MINUTE;
const TAIL_CHARS = 4096;
const CLI_ARGS = ["scripts/audit/wikios-proof.ts", "run", "--profile", "recurring"];
/**
 * IxStates as start-production.sh serves it. The profile reads PORT and BASE_PATH, and the runner's env files can
 * carry a development PORT (.env says 3000) and no BASE_PATH, which would point the proof at the wrong server.
 */
const IXSTATES_ENV = { PORT: "3550", BASE_PATH: "/projects/ixstates" };

interface WikiosProofResult {
  passed: true;
  outDir: string;
  checks: number;
}

interface CliExit {
  code: number | null;
  signal: NodeJS.Signals | null;
  output: string;
  timedOut: boolean;
}

interface CheckRow {
  name: string;
  result: string;
  measured: string;
  threshold: string;
}

/** The rows of the CLI's checks table: `| name | pass, FAIL or skipped (why) | measured | threshold |`. */
function checkRows(output: string): CheckRow[] {
  return [...output.matchAll(/^\| (\S+) \| (pass|FAIL|skipped[^|]*) \| (.*) \| (.*) \|$/gm)].map(
    ([, name = "", result = "", measured = "", threshold = ""]) => ({
      name,
      result,
      measured,
      threshold,
    })
  );
}

/** The CLI's last line, `Proof written to <dir>` (it prints it once). */
const outDirOf = (output: string): string | null =>
  /^Proof written to (.+)$/m.exec(output)?.[1] ?? null;

function failureReasons(exit: CliExit): string[] {
  const failing = checkRows(exit.output)
    .filter((row) => row.result === "FAIL")
    .map((row) => `${row.name}: ${row.measured} (needs ${row.threshold})`);
  if (exit.timedOut) return [`killed after ${KILL_AFTER_MINUTES} minutes`, ...failing];
  if (failing.length > 0) return failing;
  const lastLine = exit.output.trim().split("\n").at(-1) || "no output";
  return [`exit ${exit.code ?? exit.signal}: ${lastLine}`];
}

function runCli(): Promise<CliExit> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, CLI_ARGS, {
      cwd: process.cwd(),
      env: { ...process.env, ...IXSTATES_ENV },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let timedOut = false;
    let grace: NodeJS.Timeout | undefined;
    const collect = (chunk: Buffer): void => {
      output = (output + chunk.toString()).slice(-TAIL_CHARS);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      grace = setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS);
    }, KILL_AFTER_MINUTES * MINUTE);
    const stopTimers = (): void => {
      clearTimeout(timer);
      clearTimeout(grace);
    };
    child.on("error", (error) => {
      stopTimers();
      reject(new Error(`WikiOS proof did not start: ${error.message}`));
    });
    child.on("close", (code, signal) => {
      stopTimers();
      resolve({ code, signal, output, timedOut });
    });
  });
}

/** Cron entry: runs the recurring proof; throws unless every check passed. */
export async function runWikiosProof(): Promise<WikiosProofResult> {
  const exit = await runCli();
  const outDir = outDirOf(exit.output);
  if (exit.code === 0 && outDir !== null) {
    return { passed: true, outDir, checks: checkRows(exit.output).length };
  }
  throw new Error(
    `WikiOS proof failed: ${failureReasons(exit).join("; ")}; report in ${outDir ?? "no report directory"}`
  );
}
