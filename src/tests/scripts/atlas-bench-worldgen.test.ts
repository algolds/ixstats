/**
 * @jest-environment node
 */
import { exitCode, RESULT_MARKER } from "../../../scripts/perf/atlas-bench-report";
import {
  directSchema,
  directTargets,
  stageTargets,
  measureDirect,
  measureRunner,
  readRun,
  runnerTargets,
  type DirectRun,
  type MessageRun,
  type RunnerRun,
} from "../../../scripts/perf/atlas-bench-worldgen";

const direct = (over: Partial<DirectRun> = {}): DirectRun => ({
  cellCount: 66626,
  firstMs: 850,
  rerollMs: [600, 610, 620, 630, 640],
  stageMs: {
    mesh: [700, 710, 720, 730, 740],
    land: [400, 410, 420, 430, 440],
    climate: [150, 160, 170, 180, 190],
    nations: [100, 110, 120, 130, 140],
    output: [100, 110, 120, 130, 140],
  },
  ...over,
});

const message = (over: Partial<MessageRun> = {}): MessageRun => ({
  totalMs: 1000,
  generateMs: 800,
  stringifyMs: 60,
  reliefMs: 100,
  statsMs: 5,
  copyMs: 3,
  postGenerateMs: 200,
  ...over,
});

const runner = (): RunnerRun => ({
  first: message(),
  slider: [message(), message(), message()],
  reroll: [message(), message(), message()],
});

const verdicts = (run: DirectRun | null) => directTargets(run).map((result) => result.pass);

describe("readRun", () => {
  const run = {
    cellCount: 66626,
    firstMs: 850,
    rerollMs: [600],
    stageMs: { mesh: [700], land: [400], climate: [150], nations: [100], output: [100] },
  };

  it("reads the marked line among whatever else the child printed", () => {
    const stdout = `loading\n${RESULT_MARKER}${JSON.stringify(run)}\n`;
    expect(readRun(stdout, directSchema)).toEqual(run);
  });

  it("is null, not a throw, for a child that printed nothing, a cut-off line or the wrong shape", () => {
    expect(readRun("", directSchema)).toBeNull();
    expect(readRun(`${RESULT_MARKER}${JSON.stringify(run).slice(0, 20)}`, directSchema)).toBeNull();
    expect(
      readRun(`${RESULT_MARKER}${JSON.stringify({ ...run, firstMs: null })}`, directSchema)
    ).toBeNull();
  });
});

describe("directTargets", () => {
  it("gates the first generation and a reroll, in that order", () => {
    expect(directTargets(direct()).map((result) => result.name)).toEqual([
      "world generator: first generation, cold process (66626 cells)",
      "world generator: reroll to a new seed, median",
    ]);
    expect(verdicts(direct())).toEqual([true, true]);
  });

  it("holds each to its own limit: 1.0 s and 0.9 s", () => {
    expect(verdicts(direct({ firstMs: 1000 }))[0]).toBe(true);
    expect(verdicts(direct({ firstMs: 1000.5 }))[0]).toBe(false);
    expect(verdicts(direct({ rerollMs: [900] }))[1]).toBe(true);
    expect(verdicts(direct({ rerollMs: [900.5] }))[1]).toBe(false);
  });

  it("gates the median of the repeats, and prints every one of them", () => {
    const run = direct({ rerollMs: [100, 100, 5000, 5000, 5000] });
    expect(verdicts(run)).toEqual([true, false]);
    expect(directTargets(run)[1]!.detail).toContain("100 / 100 / 5000 / 5000 / 5000");
  });

  it("fails both when the measurement is missing or broken", () => {
    expect(verdicts(null)).toEqual([false, false]);
    expect(verdicts(direct({ firstMs: Number.NaN, rerollMs: [Number.NaN] }))).toEqual([
      false,
      false,
    ]);
  });
});

describe("stageTargets", () => {
  const stageVerdicts = (run: DirectRun | null) => stageTargets(run).map((result) => result.pass);
  const withStage = (stage: keyof DirectRun["stageMs"], ms: number[]): DirectRun => {
    const run = direct();
    return { ...run, stageMs: { ...run.stageMs, [stage]: ms } };
  };

  it("gates a restart at each stage, in the order of the stages", () => {
    expect(stageTargets(direct()).map((result) => result.name)).toEqual([
      "world generator: restart at mesh, median",
      "world generator: restart at land, median",
      "world generator: restart at climate, median",
      "world generator: restart at nations, median",
      "world generator: restart at output, median",
    ]);
    expect(stageVerdicts(direct())).toEqual([true, true, true, true, true]);
  });

  it("holds each to its own limit: 1.0 s, 0.6 s, 250 ms, 250 ms and 200 ms", () => {
    const limits = { mesh: 1000, land: 600, climate: 250, nations: 250, output: 200 } as const;
    (Object.keys(limits) as (keyof typeof limits)[]).forEach((stage, index) => {
      expect(stageVerdicts(withStage(stage, [limits[stage]]))[index]).toBe(true);
      expect(stageVerdicts(withStage(stage, [limits[stage] + 0.5]))[index]).toBe(false);
    });
  });

  it("gates the median of the repeats, and prints every one of them", () => {
    const run = withStage("climate", [100, 100, 100, 100, 5000]);
    expect(stageVerdicts(run)[2]).toBe(true);
    expect(stageTargets(run)[2]!.detail).toContain("100 / 100 / 100 / 100 / 5000");
  });

  it("fails all five when the measurement is missing", () => {
    expect(stageVerdicts(null)).toEqual([false, false, false, false, false]);
  });
});

describe("runnerTargets", () => {
  it("prints the first message, a slider message and a reroll message, none of them gated", () => {
    const results = runnerTargets(runner());
    expect(results.map((result) => result.name)).toEqual([
      "worker runner: first message, end to end",
      "worker runner: slider message, end to end, median",
      "worker runner: reroll message, end to end, median",
    ]);
    expect(results.every((result) => result.informational)).toBe(true);
    expect(results.map((result) => result.measured)).toEqual(["1000 ms", "1000 ms", "1000 ms"]);
  });

  it("splits a message into generateWorld, stringify, relief, stats, buffer copies and the rest", () => {
    const detail = runnerTargets(runner())[0]!.detail!;
    expect(detail).toContain("generateWorld 800");
    expect(detail).toContain("layer stringify 60");
    expect(detail).toContain("relief 100");
    expect(detail).toContain("stats 5.0");
    expect(detail).toContain("buffer copies 3.0");
    // 200 post-generate - (60 + 100 + 5 + 3) replayed = 32 that the replay does not account for
    expect(detail).toContain("other 32");
  });

  it("never decides the exit code, even when the measurement is missing", () => {
    const gate = directTargets(direct());
    expect(exitCode([...gate, ...runnerTargets(runner())])).toBe(0);
    expect(exitCode([...gate, ...runnerTargets(null)])).toBe(0);
    expect(runnerTargets(null).map((result) => result.measured)).toEqual([
      "NaN ms",
      "NaN ms",
      "NaN ms",
    ]);
  });
});

describe("the measurements", () => {
  // A small world keeps jest fast; the numbers themselves are the bench's business
  const small = { cellCount: 2500 };

  it("times a first generation and five rerolls", () => {
    const run = measureDirect(small);
    expect(run.cellCount).toBeGreaterThan(1000);
    expect(run.rerollMs).toHaveLength(5);
    for (const ms of [run.firstMs, ...run.rerollMs]) {
      expect(ms).toBeGreaterThan(0);
    }
  });

  it("times five restarts at each stage, each starting at the stage its change reaches", () => {
    // measureStages throws when a change restarts anywhere but at its own stage
    const { stageMs } = measureDirect(small);
    for (const times of Object.values(stageMs)) {
      expect(times).toHaveLength(5);
      for (const ms of times) expect(ms).toBeGreaterThan(0);
    }
  });

  it("times each runner message with every phase measured on the world it made", () => {
    const run = measureRunner(small);
    expect(run.slider).toHaveLength(4);
    expect(run.reroll).toHaveLength(5);
    for (const phases of [run.first, ...run.slider, ...run.reroll]) {
      expect(phases.generateMs).toBeGreaterThan(0);
      expect(phases.stringifyMs).toBeGreaterThan(0);
      expect(phases.reliefMs).toBeGreaterThan(0);
      expect(phases.postGenerateMs).toBeGreaterThan(0);
      // The runner's own time is the generator plus what it does with the world
      expect(phases.totalMs).toBeGreaterThanOrEqual(phases.generateMs + phases.postGenerateMs - 1);
    }
  });
});
