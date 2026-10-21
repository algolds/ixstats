/**
 * The generator hook's diagnostic, seeds and render requests: they ask the worker that holds the world in view, are
 * answered by ids of their own (a newer generate never drops them), and are refused or rejected when no worker holds
 * that world. Also the run's `restartedAt` and `generationMs`, which the Studio's top bar shows.
 */
import { act, renderHook } from "@testing-library/react";

import { useWorldGenerator } from "~/hooks/useWorldGenerator";
import type { FeatureCollection, Point } from "geojson";
import type { DiagnosticLegend } from "~/lib/worldgen/diagnostics";
import type { DiagnosticResult } from "~/lib/worldgen/worker/world-messages";
import {
  fakeWorldWorkers,
  resultMessage,
  type FakeWorldWorker,
} from "~/tests/helpers/fake-world-worker";

const legend: DiagnosticLegend = {
  kind: "temperature",
  title: "Temperature",
  unit: "C",
  domain: [-30, 38],
  scale: "linear",
  stops: [{ value: -30, color: "#313695" }],
  clipped: { low: false, high: false },
};

function setup() {
  const { factory, workers } = fakeWorldWorkers();
  const hook = renderHook(() => useWorldGenerator(factory));
  return { ...hook, workers };
}

/** A hook with a finished world on worker 0 (generate id 1). */
function withWorld() {
  const rig = setup();
  act(() => rig.result.current.generate({}, 1));
  act(() => rig.workers[0]!.say(resultMessage(1, { restartedAt: "climate", generationMs: 412 })));
  return rig;
}

const lastQuery = (worker: FakeWorldWorker) => worker.queries[worker.queries.length - 1]!;

describe("useWorldGenerator queries", () => {
  it("asks for a diagnostic of the world in view and resolves it with typed pixels", async () => {
    const { result, workers } = withWorld();
    let image!: Awaited<ReturnType<typeof result.current.diagnostic>>;
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.diagnostic("temperature").then((d) => void (image = d));
    });
    expect(lastQuery(workers[0]!)).toMatchObject({
      type: "diagnostic",
      kind: "temperature",
      world: 1,
    });

    const { requestId } = lastQuery(workers[0]!);
    await act(async () => {
      workers[0]!.say({
        type: "diagnostic-result",
        requestId,
        world: 1,
        image: {
          kind: "temperature",
          width: 1,
          height: 1,
          rgba: new Uint8Array([1, 2, 3, 4]).buffer,
          legend,
        },
      });
      await pending;
    });
    expect(image.rgba).toBeInstanceOf(Uint8ClampedArray);
    expect(Array.from(image.rgba)).toEqual([1, 2, 3, 4]);
    expect(image.legend).toEqual(legend);
  });
  it("rejects a query in flight when a newer generate starts, even on an idle worker", async () => {
    const { result, workers } = withWorld();
    let pending!: Promise<Blob>;
    act(() => {
      pending = result.current.renderPng(2048, true);
    });
    const { requestId } = lastQuery(workers[0]!);
    expect(lastQuery(workers[0]!)).toMatchObject({ type: "render", width: 2048, politics: true });

    // The idle worker is reused, but world 1's picture must not be taken for world 2's
    const rejection = expect(pending).rejects.toThrow("changed");
    act(() => result.current.generate({ oceanPercentage: 0.6 }, 1));
    expect(workers).toHaveLength(1);
    await rejection;

    // Its late answer finds nobody waiting and changes nothing
    act(() => {
      workers[0]!.say({
        type: "render-result",
        requestId,
        world: 1,
        width: 2048,
        png: new Blob(["old"]),
      });
    });
    expect(result.current.state).toBe("generating");
  });
  it("rejects what is in flight when the hook unmounts", async () => {
    const { result, unmount } = withWorld();
    let pending!: Promise<DiagnosticResult>;
    act(() => {
      pending = result.current.diagnostic("height");
    });
    const rejection = expect(pending).rejects.toThrow("restarted");
    unmount();
    await rejection;
  });
  it("answers requests by their own ids, in any order", async () => {
    const { result, workers } = withWorld();
    let first!: Promise<FeatureCollection<Point>>;
    let second!: Promise<Blob>;
    act(() => {
      first = result.current.nationSeeds();
      second = result.current.renderPng(4096, false);
    });
    const [a, b] = workers[0]!.queries;
    expect(a!.requestId).not.toBe(b!.requestId);
    const png = new Blob(["x"]);
    await act(async () => {
      workers[0]!.say({
        type: "render-result",
        requestId: b!.requestId,
        world: 1,
        width: 4096,
        png,
      });
      await expect(second).resolves.toBe(png);
      workers[0]!.say({
        type: "seeds-result",
        requestId: a!.requestId,
        world: 1,
        seeds: { type: "FeatureCollection", features: [] },
      });
      await expect(first).resolves.toMatchObject({ type: "FeatureCollection" });
    });
  });
  it("rejects a diagnostic of a world that failed to generate", async () => {
    const { result, workers } = withWorld();
    act(() => result.current.generate({ oceanPercentage: 0.6 }, 1));
    act(() => workers[0]!.say({ type: "error", id: 2, message: "exploded" }));
    await expect(result.current.nationSeeds()).rejects.toThrow("no world");
  });
});
