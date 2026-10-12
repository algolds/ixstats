/**
 * scripts/perf/atlas-bench-worldgen.ts - the world generator's measurements of `bun run perf:atlas` (Release A).
 *
 * The Eurth preset at the default size (66,626 cells) and a fixed seed, in two fresh child processes so the first
 * generation is a cold one, as in a new worker, and nothing the database lines left on the heap is in the way:
 *
 * - `generateWorld` alone, gated on the spec's targets: first generation, a slider change (same seed, mesh cached,
 *   one param changed) and a reroll (new seed, new mesh). The slider change and the reroll are the median of five.
 * - The worker's runner (`createWorldRunner`, the code in `world.worker.ts`) end to end per message, printed for
 *   information: the generator plus what the runner does with the world before it posts it. The phases are timed by
 *   replaying the runner's steps on the world it just made (the runner exposes no hooks); "other" is the runner's own
 *   post-generate time that the replay does not account for: the first message's cold start shows up there, and on a
 *   warm message it is within a few ms of zero (a replay can run slightly slower than the original, so it can read
 *   negative).
 *
 * Not measured: the structured clone of the posted result, and the main thread's blob URLs and draft sources.
 */
import { spawnSync } from "node:child_process";
import { z } from "zod";
import { previewRelief } from "~/lib/worldgen/relief-preview";
import { generateWorld, MeshCache } from "~/lib/worldgen/v2";
import { WORLD_PRESETS } from "~/lib/worldgen/v2/config";
import type { GeneratedWorld, WorldGenParams } from "~/lib/worldgen/v2/types";
import { computeWorldStats } from "~/lib/worldgen/world-stats";
import { createWorldRunner } from "~/lib/worldgen/worker/world-runner";
import {
  atMost,
  info,
  markedPayload,
  median,
  RESULT_MARKER,
  type TargetResult,
} from "./atlas-bench-report";

/** Flag of the child-process mode (`atlas-bench.ts --worldgen-run direct|runner`). */
export const WORLDGEN_RUN_FLAG = "--worldgen-run";

/** Spec targets at 66,626 cells (docs/specs/2026-10-11-atlas-release-a-world-creation-design.md). */
const FIRST_LIMIT_MS = 1000;
const SLIDER_LIMIT_MS = 600;
const REROLL_LIMIT_MS = 900;
/** A child takes about 4 s (a generation under 2 s, the rest loading modules); a hung one must not stall the run. */
const CHILD_TIMEOUT_MS = 60_000;

const SEED = 7;
const REROLL_SEEDS = [8, 9, 10, 11, 12] as const;
/** One param off the Eurth preset per slider change, so the repeats are not five runs of the same work. */
const SLIDERS: readonly { label: string; params: Partial<WorldGenParams> }[] = [
  { label: "land share", params: { oceanPercentage: 0.74 } },
  { label: "continents", params: { continentCount: 7 } },
  { label: "warmer or colder", params: { temperatureOffset: 1 } },
  { label: "wetter or drier", params: { precipitationScale: 1.3 } },
  { label: "nations", params: { countryCountRange: [40, 120] } },
];

const messageSchema = z.object({
  totalMs: z.number(),
  generateMs: z.number(),
  stringifyMs: z.number(),
  reliefMs: z.number(),
  statsMs: z.number(),
  copyMs: z.number(),
  postGenerateMs: z.number(),
});
export const directSchema = z.object({
  cellCount: z.number(),
  firstMs: z.number(),
  sliderMs: z.array(z.number()),
  rerollMs: z.array(z.number()),
});
export const runnerSchema = z.object({
  first: messageSchema,
  slider: z.array(messageSchema),
  reroll: z.array(messageSchema),
});

/** One runner message: its wall time, the generator's part and the replayed phases of what the runner does after. */
export type MessageRun = z.infer<typeof messageSchema>;
export type DirectRun = z.infer<typeof directSchema>;
export type RunnerRun = z.infer<typeof runnerSchema>;

const log = (line: string) => process.stderr.write(`${line}\n`);
const ms = (values: readonly number[]) => values.map((value) => value.toFixed(0)).join(" / ");
const fmt = (value: number) => (value >= 10 ? value.toFixed(0) : value.toFixed(1));

const presetParams = (overrides: Partial<WorldGenParams>): Partial<WorldGenParams> => ({
  ...WORLD_PRESETS.eurth,
  ...overrides,
});

function timed<T>(work: () => T): { result: T; ms: number } {
  const startedAt = performance.now();
  const result = work();
  return { result, ms: performance.now() - startedAt };
}

// --- Measuring (child processes) -----------------------------------------------------------------------------

/** `generateWorld` alone through one mesh cache, as the worker holds it: the first run is the cold one. */
export function measureDirect(overrides: Partial<WorldGenParams> = {}): DirectRun {
  const base = presetParams(overrides);
  const meshCache = new MeshCache();
  const generate = (params: Partial<WorldGenParams>) =>
    timed(() => generateWorld(params, undefined, { meshCache }));
  const first = generate({ ...base, seed: SEED });
  return {
    cellCount: first.result.stats.cellCount,
    firstMs: first.ms,
    sliderMs: SLIDERS.map((slider) => generate({ ...base, ...slider.params, seed: SEED }).ms),
    rerollMs: REROLL_SEEDS.map((seed) => generate({ ...base, seed }).ms),
  };
}

/** The bytes of `view` in a buffer of their own, as the runner copies them to transfer. */
function ownBuffer(view: Float32Array | Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(view.byteLength);
  new Uint8Array(copy).set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return copy;
}

/** The runner's steps after the generator, each timed on `world`. */
function replayAfterGenerate(
  world: GeneratedWorld
): Pick<MessageRun, "stringifyMs" | "reliefMs" | "statsMs" | "copyMs"> {
  const graph = world.graph;
  if (!graph) throw new Error("The generator returned no world graph");
  const stringify = timed(() => Object.values(world.layers).map((layer) => JSON.stringify(layer)));
  const relief = timed(() => previewRelief(world.cells));
  const stats = timed(() =>
    computeWorldStats({
      cells: graph.cells,
      continentCount: world.stats.continentCount,
      slots: world.slots,
    })
  );
  const copies = timed(() => [ownBuffer(world.cells), ownBuffer(relief.result.rgba)]);
  return {
    stringifyMs: stringify.ms,
    reliefMs: relief.ms,
    statsMs: stats.ms,
    copyMs: copies.ms,
  };
}

type Made = { world: GeneratedWorld; generateMs: number; endedAt: number };

/** The real runner, called directly with the posts captured: one fresh runner, as one editor session has. */
export function measureRunner(overrides: Partial<WorldGenParams> = {}): RunnerRun {
  const base = presetParams(overrides);
  const state: { made: Made | null; resultAt: number; failure: string | null } = {
    made: null,
    resultAt: 0,
    failure: null,
  };
  const generate: typeof generateWorld = (...args) => {
    const startedAt = performance.now();
    const world = generateWorld(...args);
    const endedAt = performance.now();
    state.made = { world, generateMs: endedAt - startedAt, endedAt };
    return world;
  };
  const run = createWorldRunner((posted) => {
    if (posted.type === "result") state.resultAt = performance.now();
    if (posted.type === "error") state.failure = posted.message;
  }, generate);

  const forget = () => {
    state.made = null;
    state.failure = null;
  };
  let id = 0;
  const send = (params: Partial<WorldGenParams>, seed: number): MessageRun => {
    forget();
    const startedAt = performance.now();
    run({ type: "generate", id: ++id, params, seed });
    const { made, failure, resultAt } = state;
    if (failure !== null || made === null) throw new Error(failure ?? "The runner posted no world");
    return {
      totalMs: resultAt - startedAt,
      generateMs: made.generateMs,
      postGenerateMs: resultAt - made.endedAt,
      ...replayAfterGenerate(made.world),
    };
  };

  return {
    first: send(base, SEED),
    slider: SLIDERS.map((slider) => send({ ...base, ...slider.params }, SEED)),
    reroll: REROLL_SEEDS.map((seed) => send(base, seed)),
  };
}

/** Child-process mode (`atlas-bench.ts --worldgen-run <direct|runner>`): one measurement on its own line. */
export function printWorldgenRun(mode: string): void {
  const run = mode === "direct" ? measureDirect() : mode === "runner" ? measureRunner() : null;
  if (run === null) throw new Error(`unknown world generator run: ${mode}`);
  process.stdout.write(`${RESULT_MARKER}${JSON.stringify(run)}\n`);
}

// --- The table ------------------------------------------------------------------------------------------------

/** The three gated lines; a missing run (the child failed) fails all three. */
export function directTargets(run: DirectRun | null): TargetResult[] {
  const measured = run ?? {
    cellCount: Number.NaN,
    firstMs: Number.NaN,
    sliderMs: [],
    rerollMs: [],
  };
  return [
    atMost(
      `world generator: first generation, cold process (${measured.cellCount} cells)`,
      measured.firstMs,
      FIRST_LIMIT_MS,
      "ms",
      `Eurth preset, seed ${SEED}, one run in a fresh process with an empty mesh cache; a reroll, which also builds its mesh, takes ${fmt(median(measured.rerollMs))} ms once the process is warm`
    ),
    atMost(
      "world generator: slider change on the cached mesh, median",
      median(measured.sliderMs),
      SLIDER_LIMIT_MS,
      "ms",
      `median of ${measured.sliderMs.length} changes of one param each (${SLIDERS.map((slider) => slider.label).join(", ")}): ${ms(measured.sliderMs)} ms`
    ),
    atMost(
      "world generator: reroll to a new seed, median",
      median(measured.rerollMs),
      REROLL_LIMIT_MS,
      "ms",
      `median of ${measured.rerollMs.length} seeds, a new mesh each: ${ms(measured.rerollMs)} ms`
    ),
  ];
}

/** One informational line for a kind of message: the median wall time, the median of each phase beneath it. */
function runnerLine(name: string, messages: readonly MessageRun[], note: string): TargetResult {
  const of = (pick: (message: MessageRun) => number) => median(messages.map(pick));
  const replayed = (message: MessageRun) =>
    message.stringifyMs + message.reliefMs + message.statsMs + message.copyMs;
  return info(
    name,
    of((message) => message.totalMs),
    "ms",
    `generateWorld ${fmt(of((m) => m.generateMs))} | layer stringify ${fmt(of((m) => m.stringifyMs))} | relief ${fmt(of((m) => m.reliefMs))} | stats ${fmt(of((m) => m.statsMs))} | buffer copies ${fmt(of((m) => m.copyMs))} | other ${fmt(of((m) => m.postGenerateMs - replayed(m)))} (all after generateWorld: ${fmt(of((m) => m.postGenerateMs))}); ${note}`
  );
}

/** The informational runner lines; they never decide the exit code. */
export function runnerTargets(run: RunnerRun | null): TargetResult[] {
  const missing = { first: [], slider: [], reroll: [] };
  const messages = run ? { first: [run.first], slider: run.slider, reroll: run.reroll } : missing;
  return [
    runnerLine(
      "worker runner: first message, end to end",
      messages.first,
      "fresh process and runner, mesh cache empty"
    ),
    runnerLine(
      "worker runner: slider message, end to end, median",
      messages.slider,
      `median of ${messages.slider.length}, mesh cached`
    ),
    runnerLine(
      "worker runner: reroll message, end to end, median",
      messages.reroll,
      `median of ${messages.reroll.length}, new seed`
    ),
  ];
}

/** The child's result line; null when it printed none, a cut-off one, or one of the wrong shape. */
export function readRun<T>(stdout: string, schema: z.ZodType<T>): T | null {
  const payload = markedPayload(stdout);
  if (payload === null) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(payload));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Runs one measurement in a fresh process; null when it failed or printed nothing readable. */
function childRun<T>(entry: string, mode: string, schema: z.ZodType<T>): T | null {
  const child = spawnSync(process.execPath, [entry, WORLDGEN_RUN_FLAG, mode], {
    env: process.env,
    encoding: "utf8",
    timeout: CHILD_TIMEOUT_MS,
  });
  const run = readRun(child.stdout ?? "", schema);
  if (run === null) log(`world generator (${mode}): the child run failed\n${child.stderr ?? ""}`);
  return run;
}

/** The generator's gated lines and the runner's informational ones; `entry` is atlas-bench.ts, which runs the children. */
export function worldgenTargets(entry: string): TargetResult[] {
  log("world generator: generateWorld alone in a fresh process");
  const direct = childRun(entry, "direct", directSchema);
  log("world generator: the worker runner in a fresh process");
  const runner = childRun(entry, "runner", runnerSchema);
  return [...directTargets(direct), ...runnerTargets(runner)];
}
