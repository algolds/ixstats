/**
 * The world generator hook: one worker for the editor's life, the newest generate queued behind one in flight, stale
 * answers dropped, and a failed run leaving the last good world in place.
 */
import { Activity, StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";

import { useWorldGenerator } from "~/hooks/useWorldGenerator";
import { WORLD_GEN_TIMEOUT_MS } from "~/lib/worldgen/worker/world-gen-session";
import {
  fakeWorldWorkers,
  resultMessage,
  type FakeWorldWorker,
} from "~/tests/helpers/fake-world-worker";

function setup() {
  const { factory, workers } = fakeWorldWorkers();
  const hook = renderHook(() => useWorldGenerator(factory));
  return { ...hook, workers };
}

/** Id of the latest request a fake worker was sent. */
const lastId = (worker: FakeWorldWorker) => worker.posted[worker.posted.length - 1]!.id;

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("useWorldGenerator", () => {
  it("starts idle with nothing generated and no worker", () => {
    const { result, workers } = setup();
    expect(result.current).toMatchObject({
      state: "idle",
      stage: null,
      error: null,
      result: null,
    });
    expect(workers).toHaveLength(0);
  });

  it("posts the request, shows progress, then the result with typed arrays", () => {
    const { result, workers } = setup();
    const landMaskLayers = { background: { type: "FeatureCollection" as const, features: [] } };
    act(() =>
      result.current.generate({ continentCount: 3 }, 12, { landMaskLayers, keepBorders: true })
    );

    expect(result.current.state).toBe("generating");
    expect(workers).toHaveLength(1);
    expect(workers[0]!.posted).toEqual([
      {
        type: "generate",
        id: 1,
        params: { continentCount: 3 },
        seed: 12,
        landMaskLayers,
        keepBorders: true,
      },
    ]);

    act(() =>
      workers[0]!.say({
        type: "progress",
        id: 1,
        stage: "terrain",
        pct: 40,
        message: "Computing terrain",
      })
    );
    expect(result.current).toMatchObject({
      state: "generating",
      stage: "terrain",
      pct: 40,
      message: "Computing terrain",
    });

    act(() => workers[0]!.say(resultMessage(1)));
    expect(result.current.state).toBe("ready");
    expect(result.current.error).toBeNull();
    const world = result.current.result!;
    expect(world.cells).toBeInstanceOf(Float32Array);
    expect(Array.from(world.cells)).toEqual([10, 20, 300]);
    expect(world.relief.rgba).toBeInstanceOf(Uint8ClampedArray);
    expect(world.relief).toMatchObject({ width: 2, height: 2 });
    expect(typeof world.layers.background).toBe("string");
    expect(world.stats.continents).toBe(4);
  });

  it("sends the land mask layers once per key to a worker, and again to a new worker", () => {
    const { result, workers } = setup();
    const landMaskLayers = { background: { type: "FeatureCollection" as const, features: [] } };
    const generate = (maskKey?: string) =>
      act(() => result.current.generate({}, 12, { landMaskLayers, keepBorders: true, maskKey }));
    const finish = (worker: FakeWorldWorker) =>
      act(() => worker.say(resultMessage(lastId(worker))));

    generate("realm:1");
    finish(workers[0]!);
    generate("realm:1");
    finish(workers[0]!);
    expect(workers[0]!.posted[0]).toMatchObject({ maskKey: "realm:1", landMaskLayers });
    expect(workers[0]!.posted[1]).toMatchObject({ maskKey: "realm:1", keepBorders: true });
    expect(workers[0]!.posted[1]).not.toHaveProperty("landMaskLayers");

    // A new map is sent again; a request without a key always carries its layers
    generate("realm:2");
    finish(workers[0]!);
    generate();
    finish(workers[0]!);
    expect(workers[0]!.posted[2]).toHaveProperty("landMaskLayers");
    expect(workers[0]!.posted[3]).toHaveProperty("landMaskLayers");

    // A request queued behind a run goes to the same worker, which has the layers already
    generate("realm:2");
    expect(workers[0]!.posted[4]).not.toHaveProperty("landMaskLayers");
    generate("realm:2");
    expect(workers).toHaveLength(1);
    act(() => workers[0]!.say(resultMessage(lastId(workers[0]!))));
    expect(workers[0]!.posted[5]).not.toHaveProperty("landMaskLayers");

    // A new worker (after a crash) has not seen them
    act(() => workers[0]!.listener.onCrash("boom"));
    generate("realm:2");
    expect(workers).toHaveLength(2);
    expect(workers[1]!.posted[0]).toHaveProperty("landMaskLayers");
  });

  it("sends no mask or borders flag when the caller gives none", () => {
    const { result, workers } = setup();
    act(() => result.current.generate({}, 1));
    expect(workers[0]!.posted[0]).toEqual({ type: "generate", id: 1, params: {}, seed: 1 });
  });

  it("reuses the idle worker, so its mesh cache survives a slider change", () => {
    const { result, workers } = setup();
    act(() => result.current.generate({}, 1));
    act(() => workers[0]!.say(resultMessage(1)));
    act(() => result.current.generate({ oceanPercentage: 0.6 }, 1));

    expect(workers).toHaveLength(1);
    expect(workers[0]!.terminated).toBe(false);
    expect(workers[0]!.posted.map((r) => r.id)).toEqual([1, 2]);
  });

  it("queues a generate that arrives while one is in flight and posts it to the same worker when that answers", () => {
    const { result, workers } = setup();
    act(() => result.current.generate({}, 1));
    act(() => result.current.generate({}, 2));

    expect(workers).toHaveLength(1);
    expect(workers[0]!.terminated).toBe(false);
    expect(workers[0]!.posted.map((r) => r.id)).toEqual([1]);
    expect(result.current.state).toBe("generating");

    act(() => workers[0]!.say(resultMessage(1, { seed: 111 })));
    expect(workers).toHaveLength(1);
    expect(workers[0]!.posted).toHaveLength(2);
    expect(workers[0]!.posted[1]).toMatchObject({ id: 2, seed: 2 });
    // The overtaken answer never reaches the view
    expect(result.current).toMatchObject({ state: "generating", result: null });

    act(() => workers[0]!.say(resultMessage(2, { seed: 222 })));
    expect(result.current.state).toBe("ready");
    expect(result.current.result!.seed).toBe(222);
  });

  it("posts only the newest of several generates queued behind one in flight", () => {
    const { result, workers } = setup();
    act(() => result.current.generate({}, 1));
    act(() => result.current.generate({}, 2));
    act(() => result.current.generate({}, 3));
    act(() => result.current.generate({}, 4));
    expect(workers[0]!.posted.map((r) => r.id)).toEqual([1]);

    act(() => workers[0]!.say(resultMessage(1)));
    expect(workers[0]!.posted.map((r) => [r.id, r.seed])).toEqual([
      [1, 1],
      [4, 4],
    ]);
    act(() => workers[0]!.say(resultMessage(4, { seed: 444 })));
    expect(workers[0]!.posted).toHaveLength(2);
    expect(result.current.result!.seed).toBe(444);
    expect(workers).toHaveLength(1);
  });

  it("posts the queued generate when the overtaken run fails, and drops that failure", () => {
    const { result, workers } = setup();
    act(() => result.current.generate({}, 1));
    act(() => result.current.generate({}, 2));
    act(() => workers[0]!.say({ type: "error", id: 1, message: "late failure" }));

    expect(result.current).toMatchObject({ state: "generating", error: null });
    expect(workers[0]!.posted.map((r) => r.id)).toEqual([1, 2]);
  });

  it("drops answers to a request that is no longer the latest", () => {
    const { result, workers } = setup();
    act(() => result.current.generate({}, 1));
    act(() => result.current.generate({}, 2));

    act(() =>
      workers[0]!.say({ type: "progress", id: 1, stage: "mesh", pct: 90, message: "late" })
    );
    expect(result.current).toMatchObject({
      state: "generating",
      result: null,
      error: null,
      pct: 0,
    });
    // A progress message does not free the worker
    expect(workers[0]!.posted).toHaveLength(1);
    act(() => workers[0]!.say(resultMessage(1, { seed: 111 })));
    expect(result.current).toMatchObject({
      state: "generating",
      result: null,
      error: null,
      pct: 0,
    });

    act(() => workers[0]!.say(resultMessage(2, { seed: 222 })));
    expect(result.current.state).toBe("ready");
    expect(result.current.result!.seed).toBe(222);
  });

  it("keeps the last good world while the next one is generating", () => {
    const { result, workers } = setup();
    act(() => result.current.generate({}, 1));
    act(() => workers[0]!.say(resultMessage(1, { seed: 5 })));
    act(() => result.current.generate({}, 2));

    expect(result.current.state).toBe("generating");
    expect(result.current.result!.seed).toBe(5);
  });

  it("reports a generator error, keeps the previous world and keeps the worker", () => {
    const { result, workers } = setup();
    act(() => result.current.generate({}, 1));
    act(() => workers[0]!.say(resultMessage(1, { seed: 5 })));
    act(() => result.current.generate({}, 2));
    act(() => workers[0]!.say({ type: "error", id: 2, message: "mesh exploded" }));

    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe("mesh exploded");
    expect(result.current.result!.seed).toBe(5);
    expect(workers[0]!.terminated).toBe(false);

    // Retry reuses the same worker and clears the error
    act(() => result.current.generate({}, 2));
    expect(workers).toHaveLength(1);
    expect(result.current.state).toBe("generating");
    expect(result.current.error).toBeNull();
  });

  it("treats a crashed worker as an error, discards it and starts a new one on retry", () => {
    const { result, workers } = setup();
    act(() => result.current.generate({}, 1));
    act(() => workers[0]!.listener.onCrash("Unexpected end of script"));

    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe("Unexpected end of script");
    expect(workers[0]!.terminated).toBe(true);

    act(() => result.current.generate({}, 1));
    expect(workers).toHaveLength(2);
    expect(workers[1]!.posted).toHaveLength(1);
  });

  it("times out a generation after 30 seconds: error state, worker terminated, last world kept", () => {
    expect(WORLD_GEN_TIMEOUT_MS).toBe(30_000);
    const { result, workers } = setup();
    act(() => result.current.generate({}, 1));
    act(() => workers[0]!.say(resultMessage(1, { seed: 5 })));
    act(() => result.current.generate({}, 2));

    act(() => {
      jest.advanceTimersByTime(WORLD_GEN_TIMEOUT_MS - 1);
    });
    expect(result.current.state).toBe("generating");
    act(() => {
      jest.advanceTimersByTime(1);
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toMatch(/too long|timed out/i);
    expect(workers[0]!.terminated).toBe(true);
    expect(result.current.result!.seed).toBe(5);

    // The next generate gets a fresh worker and a fresh clock
    act(() => result.current.generate({}, 3));
    expect(workers).toHaveLength(2);
    act(() => {
      jest.advanceTimersByTime(WORLD_GEN_TIMEOUT_MS - 1);
    });
    expect(result.current.state).toBe("generating");
  });

  it("starts the clock when a queued generate is posted and stops it when the result lands", () => {
    const { result, workers } = setup();
    act(() => result.current.generate({}, 1));
    act(() => {
      jest.advanceTimersByTime(20_000);
    });
    act(() => result.current.generate({}, 2));
    act(() => workers[0]!.say(resultMessage(1)));
    act(() => {
      jest.advanceTimersByTime(20_000);
    });
    expect(result.current.state).toBe("generating");

    act(() => workers[0]!.say(resultMessage(2)));
    act(() => {
      jest.advanceTimersByTime(WORLD_GEN_TIMEOUT_MS * 2);
    });
    expect(result.current.state).toBe("ready");
  });

  it("does not debounce: every generate on an idle worker goes straight to it", () => {
    const { result, workers } = setup();
    act(() => result.current.generate({}, 1));
    act(() => workers[0]!.say(resultMessage(1)));
    act(() => result.current.generate({}, 2));
    act(() => workers[0]!.say(resultMessage(2)));
    act(() => result.current.generate({}, 3));
    expect(workers.flatMap((w) => w.posted).map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("a timeout with a generate queued starts it on a fresh worker, sending the fit layers again", () => {
    const { result, workers } = setup();
    const landMaskLayers = { background: { type: "FeatureCollection" as const, features: [] } };
    const fit = { landMaskLayers, keepBorders: true, maskKey: "realm:1" };
    act(() => result.current.generate({}, 1, fit));
    act(() => result.current.generate({ continentCount: 3 }, 2, fit));
    act(() => {
      jest.advanceTimersByTime(WORLD_GEN_TIMEOUT_MS);
    });

    expect(workers).toHaveLength(2);
    expect(workers[0]!.terminated).toBe(true);
    expect(workers[0]!.posted).toHaveLength(1);
    expect(workers[1]!.posted).toEqual([
      {
        type: "generate",
        id: 2,
        params: { continentCount: 3 },
        seed: 2,
        landMaskLayers,
        keepBorders: true,
        maskKey: "realm:1",
      },
    ]);
    // Not an error: the queued run is the one in view, and the timed-out worker's late answer is dropped
    expect(result.current.state).toBe("generating");
    act(() => workers[0]!.say(resultMessage(1, { seed: 999 })));
    expect(result.current.state).toBe("generating");
    act(() => workers[1]!.say(resultMessage(2, { seed: 8 })));
    expect(result.current).toMatchObject({ state: "ready" });
    expect(result.current.result!.seed).toBe(8);
  });

  it("a queued generate that is itself too slow times out on its own clock", () => {
    const { result, workers } = setup();
    act(() => result.current.generate({}, 1));
    act(() => result.current.generate({}, 2));
    act(() => {
      jest.advanceTimersByTime(WORLD_GEN_TIMEOUT_MS);
    });
    expect(workers).toHaveLength(2);
    act(() => {
      jest.advanceTimersByTime(WORLD_GEN_TIMEOUT_MS);
    });
    expect(result.current.state).toBe("error");
    expect(workers[1]!.terminated).toBe(true);
  });

  it("a cancel and a reset clear the queued generate", () => {
    const { result, workers } = setup();
    act(() => result.current.generate({}, 3));
    act(() => result.current.generate({}, 4));
    act(() => result.current.cancel());
    act(() => workers[0]!.say(resultMessage(3)));
    expect(workers[0]!.posted).toHaveLength(1);

    act(() => result.current.generate({}, 5));
    act(() => result.current.generate({}, 6));
    act(() => result.current.reset());
    act(() => workers[1]!.say(resultMessage(5)));
    expect(workers[1]!.posted).toHaveLength(1);
    expect(result.current.state).toBe("idle");
  });

  it("cancel terminates the work in flight and falls back to the last state", () => {
    const { result, workers } = setup();
    act(() => result.current.cancel());
    expect(workers).toHaveLength(0);
    expect(result.current.state).toBe("idle");

    act(() => result.current.generate({}, 1));
    act(() => result.current.cancel());
    expect(workers[0]!.terminated).toBe(true);
    expect(result.current.state).toBe("idle");

    act(() => result.current.generate({}, 1));
    act(() => workers[1]!.say(resultMessage(lastId(workers[1]!), { seed: 5 })));
    act(() => result.current.generate({}, 2));
    const cancelled = lastId(workers[1]!);
    act(() => result.current.cancel());
    expect(workers[1]!.terminated).toBe(true);
    expect(result.current.state).toBe("ready");
    expect(result.current.result!.seed).toBe(5);

    // Whatever the cancelled run posts afterwards is dropped
    act(() => workers[1]!.say(resultMessage(cancelled, { seed: 999 })));
    expect(result.current.result!.seed).toBe(5);
    expect(result.current.state).toBe("ready");
  });

  it("drops what a worker killed by the timeout still delivers", () => {
    const { result, workers } = setup();
    act(() => result.current.generate({}, 1));
    act(() => workers[0]!.say(resultMessage(lastId(workers[0]!), { seed: 5 })));
    act(() => result.current.generate({}, 2));
    const late = lastId(workers[0]!);
    act(() => {
      jest.advanceTimersByTime(WORLD_GEN_TIMEOUT_MS);
    });
    expect(result.current.state).toBe("error");

    act(() =>
      workers[0]!.say({ type: "progress", id: late, stage: "mesh", pct: 50, message: "late" })
    );
    expect(result.current).toMatchObject({ state: "error", stage: null, pct: 0, message: "" });
    act(() => workers[0]!.say(resultMessage(late, { seed: 999 })));
    expect(result.current.state).toBe("error");
    expect(result.current.result!.seed).toBe(5);
  });

  it("drops what a crashed worker still delivers", () => {
    const { result, workers } = setup();
    act(() => result.current.generate({}, 1));
    const late = lastId(workers[0]!);
    act(() => workers[0]!.listener.onCrash("boom"));
    expect(result.current.state).toBe("error");

    act(() => workers[0]!.say(resultMessage(late, { seed: 999 })));
    expect(result.current).toMatchObject({ state: "error", error: "boom", result: null });
  });

  it("does nothing when generate is called after unmount: no worker, no clock", () => {
    const { result, workers, unmount } = setup();
    const { generate } = result.current;
    unmount();
    act(() => generate({}, 1));

    expect(workers).toHaveLength(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("keeps working after React's strict-mode unmount and remount", () => {
    const { factory, workers } = fakeWorldWorkers();
    const { result } = renderHook(() => useWorldGenerator(factory), { wrapper: StrictMode });
    act(() => result.current.generate({}, 1));

    expect(workers).toHaveLength(1);
    expect(result.current.state).toBe("generating");
    act(() => workers[0]!.say(resultMessage(lastId(workers[0]!))));
    expect(result.current.state).toBe("ready");
  });

  it("reset ends the run, drops the world and the error and goes back to idle", () => {
    const { result, workers } = setup();
    act(() => result.current.generate({}, 1));
    act(() => workers[0]!.say(resultMessage(lastId(workers[0]!), { seed: 5 })));
    act(() => result.current.generate({}, 2));
    const late = lastId(workers[0]!);
    act(() => result.current.reset());

    expect(result.current).toMatchObject({
      state: "idle",
      stage: null,
      pct: 0,
      message: "",
      error: null,
      result: null,
    });
    expect(workers[0]!.terminated).toBe(true);
    expect(jest.getTimerCount()).toBe(0);

    // What the run it ended posts afterwards is dropped
    act(() => workers[0]!.say(resultMessage(late, { seed: 999 })));
    expect(result.current.state).toBe("idle");
    expect(result.current.result).toBeNull();

    // And the hook is usable again
    act(() => result.current.generate({}, 3));
    expect(workers).toHaveLength(2);
    expect(result.current.state).toBe("generating");
  });

  it("reset also drops a world that state kept after the session was gone (Activity hidden, then shown)", () => {
    const { factory, workers } = fakeWorldWorkers();
    let mode: "visible" | "hidden" = "visible";
    const { result, rerender } = renderHook(() => useWorldGenerator(factory), {
      wrapper: ({ children }) => <Activity mode={mode}>{children}</Activity>,
    });
    act(() => result.current.generate({}, 1));
    act(() => workers[0]!.say(resultMessage(lastId(workers[0]!), { seed: 5 })));

    // Hiding unmounts the effects (the session is disposed); the state stays
    mode = "hidden";
    rerender();
    mode = "visible";
    rerender();
    expect(workers[0]!.terminated).toBe(true);
    expect(result.current.result!.seed).toBe(5);

    act(() => result.current.reset());
    expect(result.current).toMatchObject({ state: "idle", result: null, error: null });
  });

  it("reset clears an error and the world of an idle generator, with no worker to end", () => {
    const { result, workers } = setup();
    act(() => result.current.reset());
    expect(workers).toHaveLength(0);

    act(() => result.current.generate({}, 1));
    act(() => workers[0]!.say({ type: "error", id: lastId(workers[0]!), message: "no" }));
    expect(result.current.state).toBe("error");
    act(() => result.current.reset());
    expect(result.current).toMatchObject({ state: "idle", error: null, result: null });
  });

  it("terminates the worker and stops the clock on unmount", () => {
    const { result, workers, unmount } = setup();
    act(() => result.current.generate({}, 1));
    unmount();
    expect(workers[0]!.terminated).toBe(true);
    // A clock left running would end in a state update on an unmounted hook
    expect(jest.getTimerCount()).toBe(0);
  });

  it("terminates an idle worker on unmount too", () => {
    const { result, workers, unmount } = setup();
    act(() => result.current.generate({}, 1));
    act(() => workers[0]!.say(resultMessage(1)));
    unmount();
    expect(workers[0]!.terminated).toBe(true);
  });

  it("reports a worker that cannot be started and recovers on the next generate", () => {
    let fail = true;
    const { factory, workers } = fakeWorldWorkers();
    const flaky: typeof factory = (listener) => {
      if (fail) throw new Error("Worker is not defined");
      return factory(listener);
    };
    const { result } = renderHook(() => useWorldGenerator(flaky));

    act(() => result.current.generate({}, 1));
    expect(result.current.state).toBe("error");
    expect(result.current.error).toBe("Worker is not defined");

    fail = false;
    act(() => result.current.generate({}, 1));
    expect(result.current.state).toBe("generating");
    expect(workers).toHaveLength(1);
  });
});
