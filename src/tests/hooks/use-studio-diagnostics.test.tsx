/**
 * The diagnostic layers of the world on the map: one at a time, drawn by the worker from its cached graph (never by
 * a new generate), asked for again when a new world lands, and an answer for a world that moved on is dropped without
 * an error.
 */
import { act, renderHook } from "@testing-library/react";

import { useStudioDiagnostics } from "~/hooks/useStudioDiagnostics";
import { useWorldGenerator } from "~/hooks/useWorldGenerator";
import type { DiagnosticKind, DiagnosticLegend } from "~/lib/worldgen/diagnostics";
import {
  fakeWorldWorkers,
  resultMessage,
  type FakeWorldWorker,
} from "~/tests/helpers/fake-world-worker";

const legend = (kind: DiagnosticKind): DiagnosticLegend => ({
  kind,
  title: kind,
  unit: "",
  domain: [0, 1],
  scale: "linear",
  stops: [{ value: 0, color: "#000000" }],
  clipped: { low: false, high: false },
});

function setup() {
  const { factory, workers } = fakeWorldWorkers();
  const hook = renderHook(() => {
    const generator = useWorldGenerator(factory);
    return { generator, diagnostics: useStudioDiagnostics(generator) };
  });
  const generated = (id: number) => {
    act(() => hook.result.current.generator.generate({}, id));
    act(() => workers.at(-1)!.say(resultMessage(id)));
  };
  return { ...hook, workers, generated };
}

const queries = (worker: FakeWorldWorker) => worker.queries;

/** The worker answers its newest diagnostic request. */
async function answer(worker: FakeWorldWorker, kind: DiagnosticKind, world: number) {
  const request = worker.queries.filter((query) => query.type === "diagnostic").at(-1)!;
  await act(async () => {
    worker.say({
      type: "diagnostic-result",
      requestId: request.requestId,
      world,
      image: { kind, width: 1, height: 1, rgba: new Uint8Array(4).buffer, legend: legend(kind) },
    });
  });
}

describe("useStudioDiagnostics", () => {
  it("asks for nothing until a diagnostic is chosen", () => {
    const { workers, result, generated } = setup();
    generated(1);
    expect(queries(workers[0]!)).toHaveLength(0);
    expect(result.current.diagnostics.image).toBeNull();
    expect(result.current.diagnostics.kind).toBeNull();
  });

  it("draws the chosen diagnostic from the worker's graph, without a new generate", async () => {
    const { workers, result, generated } = setup();
    generated(1);
    act(() => result.current.diagnostics.setKind("temperature"));
    expect(queries(workers[0]!)).toEqual([
      expect.objectContaining({ type: "diagnostic", kind: "temperature", world: 1 }),
    ]);
    expect(result.current.diagnostics.image).toBeNull();

    await answer(workers[0]!, "temperature", 1);
    expect(result.current.diagnostics.image?.legend.kind).toBe("temperature");
    expect(workers).toHaveLength(1);
    expect(workers[0]!.posted).toHaveLength(1);
  });

  it("shows one at a time: another replaces it, and none removes it", async () => {
    const { workers, result, generated } = setup();
    generated(1);
    act(() => result.current.diagnostics.setKind("height"));
    await answer(workers[0]!, "height", 1);
    act(() => result.current.diagnostics.setKind("rainfall"));
    // The height image is not the rainfall one: nothing is drawn until rainfall lands
    expect(result.current.diagnostics.image).toBeNull();
    await answer(workers[0]!, "rainfall", 1);
    expect(result.current.diagnostics.image?.kind).toBe("rainfall");

    act(() => result.current.diagnostics.setKind(null));
    expect(result.current.diagnostics.image).toBeNull();
    expect(workers[0]!.queries).toHaveLength(2);
  });

  it("asks again when a new world lands, keeping the old image up until the new one comes", async () => {
    const { workers, result, generated } = setup();
    generated(1);
    act(() => result.current.diagnostics.setKind("flow"));
    await answer(workers[0]!, "flow", 1);
    const first = result.current.diagnostics.image;

    act(() => result.current.generator.generate({}, 2));
    // A run is on: nothing is asked of a worker that holds no world
    expect(workers[0]!.queries).toHaveLength(1);
    expect(result.current.diagnostics.image).toBe(first);

    act(() => workers.at(-1)!.say(resultMessage(2)));
    const worker = workers.at(-1)!;
    expect(worker.queries.at(-1)).toMatchObject({ type: "diagnostic", kind: "flow", world: 2 });
    await answer(worker, "flow", 2);
    expect(result.current.diagnostics.image).not.toBe(first);
  });

  it("drops an answer for a world that changed, without an error", async () => {
    const { workers, result, generated } = setup();
    generated(1);
    act(() => result.current.diagnostics.setKind("cells"));
    // The request is in flight when the world is replaced: the session rejects it
    await act(async () => result.current.generator.generate({}, 2));
    expect(result.current.diagnostics.error).toBeNull();
    expect(result.current.diagnostics.image).toBeNull();

    act(() => workers.at(-1)!.say(resultMessage(2)));
    await answer(workers.at(-1)!, "cells", 2);
    expect(result.current.diagnostics.image?.kind).toBe("cells");
    expect(result.current.diagnostics.error).toBeNull();
  });

  it("says so when the worker cannot draw it, and forgets it on the next choice", async () => {
    const { workers, result, generated } = setup();
    generated(1);
    act(() => result.current.diagnostics.setKind("height"));
    const request = workers[0]!.queries[0]!;
    await act(async () => {
      workers[0]!.say({
        type: "request-error",
        requestId: request.requestId,
        message: "No memory",
      });
    });
    expect(result.current.diagnostics.error).toBe("No memory");

    act(() => result.current.diagnostics.setKind("temperature"));
    expect(result.current.diagnostics.error).toBeNull();
  });

  it("places the nation seeds on request and takes them away", async () => {
    const { workers, result, generated } = setup();
    generated(1);
    expect(result.current.diagnostics.seeds).toBeNull();
    act(() => result.current.diagnostics.setSeedsOn(true));
    const request = workers[0]!.queries[0]!;
    expect(request).toMatchObject({ type: "seeds", world: 1 });
    const seeds = { type: "FeatureCollection" as const, features: [] };
    await act(async () => {
      workers[0]!.say({ type: "seeds-result", requestId: request.requestId, world: 1, seeds });
    });
    expect(result.current.diagnostics.seeds).toBe(seeds);

    act(() => result.current.diagnostics.setSeedsOn(false));
    expect(result.current.diagnostics.seeds).toBeNull();
    expect(workers[0]!.posted).toHaveLength(1);
  });
});
