/**
 * @jest-environment node
 */
import { exitCode, RESULT_MARKER } from "../../../scripts/perf/atlas-bench-report";
import {
  directSchema,
  directTargets,
  stageTargets,
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
  it("is null, not a throw, for a child that printed nothing, a cut-off line or the wrong shape", () => {
    expect(readRun("", directSchema)).toBeNull();
    expect(readRun(`${RESULT_MARKER}${JSON.stringify(run).slice(0, 20)}`, directSchema)).toBeNull();
    expect(
      readRun(`${RESULT_MARKER}${JSON.stringify({ ...run, firstMs: null })}`, directSchema)
    ).toBeNull();
  });
});

describe("directTargets", () => {
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
  it("fails all five when the measurement is missing", () => {
    expect(stageVerdicts(null)).toEqual([false, false, false, false, false]);
  });
});

describe("runnerTargets", () => {
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
