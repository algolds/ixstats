/** @jest-environment node */
/**
 * The weekly `wikios-proof` cron job (src/server/cron/wikios-proof-cron.ts): it spawns the CLI's recurring profile
 * against IxStates on 3550 under /projects/ixstates whatever PORT the env files carry, reads the report directory and
 * the checks from the last 4 KB of output, and throws the failing checks (for alertCronFailure) on a failure, a refusal
 * or a run past 80 minutes, which it kills.
 */
import { EventEmitter } from "events";
import { spawn, type ChildProcess } from "child_process";
import { runWikiosProof } from "~/server/cron/wikios-proof-cron";

jest.mock("child_process");
const spawnMock = jest.mocked(spawn);

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = jest.fn((_signal?: NodeJS.Signals) => true);
}

function start(): FakeChild {
  const child = new FakeChild();
  spawnMock.mockReturnValue(child as unknown as ChildProcess);
  return child;
}

const DIR = "/ixwiki/private/logs/wikios-proof/20261026-0530-recurring";
const row = (name: string, result: string, measured: string, threshold: string): string =>
  `| ${name} | ${result} | ${measured} | ${threshold} |`;
const table = (...rows: string[]): string =>
  [
    "## Checks",
    "",
    "| Check | Result | Measured | Threshold |",
    "| :--- | :--- | :--- | :--- |",
    ...rows,
  ]
    .join("\n")
    .concat("\n");

afterEach(() => {
  jest.useRealTimers();
  spawnMock.mockReset();
});

describe("runWikiosProof", () => {
  it("a passing run returns its report directory", async () => {
    const child = start();
    const run = runWikiosProof();
    child.stderr.emit("data", Buffer.from("Running roundtrip (log: x)\n"));
    child.stdout.emit(
      "data",
      Buffer.from(
        table(
          row("roundTrip.pages", "pass", "12706", ">= 4000"),
          row("parity.mean", "pass", "98.2", ">= 97"),
          row("bench.p95", "skipped (local)", "900 ms", "<= 800 ms")
        )
      )
    );
    child.stdout.emit("data", Buffer.from(`\nPASSED\nProof written to ${DIR}\n`));
    child.emit("close", 0, null);

    await expect(run).resolves.toEqual({ passed: true, outDir: DIR, checks: 3 });
    expect(spawnMock).toHaveBeenCalledWith(
      process.execPath,
      ["scripts/audit/wikios-proof.ts", "run", "--profile", "recurring"],
      expect.objectContaining({ cwd: process.cwd() })
    );
  });

  it("points the proof at IxStates on 3550 under /projects/ixstates, whatever PORT the env files set", async () => {
    const saved = { PORT: process.env.PORT, BASE_PATH: process.env.BASE_PATH };
    process.env.PORT = "3000";
    delete process.env.BASE_PATH;
    try {
      const child = start();
      const run = runWikiosProof();
      child.stdout.emit("data", Buffer.from(`Proof written to ${DIR}\n`));
      child.emit("close", 0, null);
      await run;
      const options = spawnMock.mock.calls[0]?.[2];
      expect(options?.env).toEqual(
        expect.objectContaining({ PORT: "3550", BASE_PATH: "/projects/ixstates" })
      );
      expect(options?.env?.NODE_ENV).toBe(process.env.NODE_ENV);
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("a failing run throws with the failing checks and the directory", async () => {
    const child = start();
    const run = runWikiosProof();
    child.stdout.emit(
      "data",
      Buffer.from(
        table(
          row("roundTrip.errors", "FAIL", "2", "<= 0"),
          row("parity.mean", "FAIL", "95.1", ">= 97"),
          row("parity.share98", "pass", "97%", ">= 95%"),
          row("bench.p95", "skipped (local)", "900 ms", "<= 800 ms")
        ) + `\nFAILED\nProof written to ${DIR}\n`
      )
    );
    child.emit("close", 1, null);

    await expect(run).rejects.toThrow(
      `WikiOS proof failed: roundTrip.errors: 2 (needs <= 0); parity.mean: 95.1 (needs >= 97); report in ${DIR}`
    );
  });

  it("a refusal before any report throws the CLI's last line and says there is no report", async () => {
    const child = start();
    const run = runWikiosProof();
    child.stderr.emit(
      "data",
      Buffer.from(
        "loading env\nthe recurring proof runs on the server: NODE_ENV must be production\n"
      )
    );
    child.emit("close", 1, null);

    await expect(run).rejects.toThrow(
      "WikiOS proof failed: exit 1: the recurring proof runs on the server: NODE_ENV must be production; report in no report directory"
    );
  });

  it("an exit 0 without a report directory still throws", async () => {
    const child = start();
    const run = runWikiosProof();
    child.stdout.emit("data", Buffer.from("PASSED\n"));
    child.emit("close", 0, null);
    await expect(run).rejects.toThrow(
      "WikiOS proof failed: exit 0: PASSED; report in no report directory"
    );
  });

  it("a child killed by a signal names the signal", async () => {
    const child = start();
    const run = runWikiosProof();
    child.emit("close", null, "SIGKILL");
    await expect(run).rejects.toThrow(
      "WikiOS proof failed: exit SIGKILL: no output; report in no report directory"
    );
  });

  it("keeps only the last 4 KB of output", async () => {
    const child = start();
    const run = runWikiosProof();
    child.stdout.emit("data", Buffer.from(table(row("parity.mean", "FAIL", "95.1", ">= 97"))));
    child.stdout.emit("data", Buffer.from(`${"x".repeat(4096)}\nthe end\n`));
    child.emit("close", 1, null);
    await expect(run).rejects.toThrow(
      "WikiOS proof failed: exit 1: the end; report in no report directory"
    );
  });

  it("reads the 4 KB tail across chunks, so a table split between them still counts", async () => {
    const child = start();
    const run = runWikiosProof();
    const out = `${"y".repeat(3000)}\n${table(row("a.b", "pass", "1", "1"), row("c.d", "pass", "2", "2"))}Proof written to ${DIR}\n`;
    child.stdout.emit("data", Buffer.from(out.slice(0, 3100)));
    child.stdout.emit("data", Buffer.from(out.slice(3100)));
    child.emit("close", 0, null);
    await expect(run).resolves.toEqual({ passed: true, outDir: DIR, checks: 2 });
  });

  it("a run past 80 minutes is killed and throws", async () => {
    jest.useFakeTimers();
    const child = start();
    const run = runWikiosProof();
    jest.advanceTimersByTime(80 * 60_000 - 1);
    expect(child.kill).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    child.stdout.emit("data", Buffer.from(table(row("parity.pages", "FAIL", "12", ">= 200"))));
    child.emit("close", 143, null);

    await expect(run).rejects.toThrow(
      "WikiOS proof failed: killed after 80 minutes; parity.pages: 12 (needs >= 200); report in no report directory"
    );
    // The SIGKILL fallback is cancelled once the CLI has gone.
    expect(jest.getTimerCount()).toBe(0);
  });

  it("a run that ignores SIGTERM is killed a minute later, and a finished run leaves no timer", async () => {
    jest.useFakeTimers();
    const child = start();
    const run = runWikiosProof();
    jest.advanceTimersByTime(80 * 60_000);
    jest.advanceTimersByTime(60_000 - 1);
    expect(child.kill).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(child.kill).toHaveBeenLastCalledWith("SIGKILL");
    child.emit("close", null, "SIGKILL");
    await expect(run).rejects.toThrow(/^WikiOS proof failed: killed after 80 minutes; report in/);
    expect(jest.getTimerCount()).toBe(0);

    const second = start();
    const passing = runWikiosProof();
    second.stdout.emit("data", Buffer.from(`Proof written to ${DIR}\n`));
    second.emit("close", 0, null);
    await passing;
    expect(jest.getTimerCount()).toBe(0);
  });

  it("a CLI that cannot start rejects and leaves no timer", async () => {
    jest.useFakeTimers();
    const child = start();
    const run = runWikiosProof();
    child.emit("error", new Error("spawn ENOENT"));
    await expect(run).rejects.toThrow("WikiOS proof did not start: spawn ENOENT");
    expect(jest.getTimerCount()).toBe(0);
  });
});
