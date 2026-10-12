/**
 * @jest-environment node
 */
import { exitCode } from "../../../scripts/perf/atlas-bench-report";
import {
  directTargets,
  measureDirect,
  measureRunner,
  runnerTargets,
  type DirectRun,
  type MessageRun,
  type RunnerRun,
} from "../../../scripts/perf/atlas-bench-worldgen";

const direct = (over: Partial<DirectRun> = {}): DirectRun => ({
  cellCount: 66626,
  firstMs: 850,
  sliderMs: [300, 310, 320, 330, 340],
  rerollMs: [600, 610, 620, 630, 640],
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

describe("directTargets", () => {
  it("gates the first generation, a slider change and a reroll, in that order", () => {
    expect(directTargets(direct()).map((result) => result.name)).toEqual([
      "world generator: first generation, cold process (66626 cells)",
      "world generator: slider change on the cached mesh, median",
      "world generator: reroll to a new seed, median",
    ]);
    expect(verdicts(direct())).toEqual([true, true, true]);
  });

  it("holds each to its own limit: 1.0 s, 0.6 s and 0.9 s", () => {
    expect(verdicts(direct({ firstMs: 1000 }))[0]).toBe(true);
    expect(verdicts(direct({ firstMs: 1000.5 }))[0]).toBe(false);
    expect(verdicts(direct({ sliderMs: [600] }))[1]).toBe(true);
    expect(verdicts(direct({ sliderMs: [600.5] }))[1]).toBe(false);
    expect(verdicts(direct({ rerollMs: [900] }))[2]).toBe(true);
    expect(verdicts(direct({ rerollMs: [900.5] }))[2]).toBe(false);
  });

  it("gates the median of the repeats, and prints every one of them", () => {
    const run = direct({
      sliderMs: [100, 100, 100, 100, 5000],
      rerollMs: [100, 100, 5000, 5000, 5000],
    });
    expect(verdicts(run)).toEqual([true, true, false]);
    expect(directTargets(run)[1]!.detail).toContain("100 / 100 / 100 / 100 / 5000");
  });

  it("fails all three when the measurement is missing or broken", () => {
    expect(verdicts(null)).toEqual([false, false, false]);
    expect(verdicts(direct({ firstMs: Number.NaN, sliderMs: [], rerollMs: [Number.NaN] }))).toEqual(
      [false, false, false]
    );
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

  it("times a first generation, five slider changes and five rerolls", () => {
    const run = measureDirect(small);
    expect(run.cellCount).toBeGreaterThan(1000);
    expect(run.sliderMs).toHaveLength(5);
    expect(run.rerollMs).toHaveLength(5);
    for (const ms of [run.firstMs, ...run.sliderMs, ...run.rerollMs]) {
      expect(ms).toBeGreaterThan(0);
    }
  });

  it("times each runner message with every phase measured on the world it made", () => {
    const run = measureRunner(small);
    expect(run.slider).toHaveLength(5);
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
