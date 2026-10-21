/**
 * The generator worker's logic, called directly: what it posts, in which order, what it transfers, what it
 * remembers between requests, and what it does when the generator throws.
 */
import { generateWorldStaged } from "~/lib/worldgen/v2";
import type { LandMaskLayers } from "~/lib/worldgen/land-mask";
import type {
  WorldGenerateRequest,
  WorldWorkerResponse,
} from "~/lib/worldgen/worker/world-messages";
import { createWorldRunner } from "~/lib/worldgen/worker/world-runner";

type Posted = { message: WorldWorkerResponse; transfer: ArrayBuffer[] };
type GenerateOptions = NonNullable<Parameters<typeof generateWorldStaged>[2]>;

/** A runner whose posts are recorded, over the real generator at a size jest can afford. */
function harness(generate: typeof generateWorldStaged = generateWorldStaged) {
  const posted: Posted[] = [];
  const run = createWorldRunner(
    (message, transfer = []) => posted.push({ message, transfer }),
    generate
  );
  return { posted, run };
}

const request = (over: Partial<WorldGenerateRequest> = {}): WorldGenerateRequest => ({
  type: "generate",
  id: 1,
  params: { cellCount: 2500 },
  seed: 7,
  ...over,
});

const last = (posted: Posted[]) => posted[posted.length - 1]!;

/** A realm's landmass: one box of background land over the tropics. */
const boxMap = (): LandMaskLayers => ({
  background: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-60, -30],
              [60, -30],
              [60, 30],
              [-60, 30],
              [-60, -30],
            ],
          ],
        },
      },
    ],
  },
});

describe("worldgen/world-runner", () => {
  it("keeps the realm's borders: no political layer, no slots, no baseline", () => {
    const { posted, run } = harness();
    run(request({ landMaskLayers: boxMap(), keepBorders: true }));

    const result = last(posted).message;
    if (result.type !== "result") throw new Error(`expected a result, got ${result.type}`);
    expect(result.layers.political).toBeUndefined();
    expect(result.slots).toEqual([]);
    expect(result.stats.slotCount).toBe(0);
    expect(result.stats.baseline).toBeNull();
  });

  it("starts a slider change at the stage it reaches and says so in the result", () => {
    const { posted, run } = harness();
    const restarted = () => {
      const message = last(posted).message;
      if (message.type !== "result") throw new Error(`expected a result, got ${message.type}`);
      return message.restartedAt;
    };
    run(request({ id: 1 }));
    expect(restarted()).toBe("mesh");
    run(request({ id: 2, params: { cellCount: 2500, oceanPercentage: 0.6 } }));
    expect(restarted()).toBe("land");
    run(
      request({ id: 3, params: { cellCount: 2500, oceanPercentage: 0.6, temperatureOffset: 1 } })
    );
    expect(restarted()).toBe("climate");
    run(
      request({ id: 4, params: { cellCount: 2500, oceanPercentage: 0.6, temperatureOffset: 1 } })
    );
    expect(restarted()).toBe("output");
    run(request({ id: 5, seed: 8, params: { cellCount: 2500, oceanPercentage: 0.6 } }));
    expect(restarted()).toBe("mesh");
  });

  it("rasterises the mask once for a maskKey and keeps the same mask for the next request", () => {
    const options: (GenerateOptions | undefined)[] = [];
    const { posted, run } = harness((params, onProgress, opts) => {
      options.push(opts);
      return generateWorldStaged(params, onProgress, opts);
    });
    run(request({ id: 1, landMaskLayers: boxMap(), maskKey: "ixnay:3", keepBorders: true }));
    // The second request carries no layers: the worker has them under the key
    run(
      request({
        id: 2,
        maskKey: "ixnay:3",
        keepBorders: true,
        params: { cellCount: 2500, temperatureOffset: 1 },
      })
    );
    expect(options[1]!.landMask).toBe(options[0]!.landMask);
    const second = last(posted).message;
    if (second.type !== "result") throw new Error(`expected a result, got ${second.type}`);
    expect(second.restartedAt).toBe("climate");

    // A new key is a new map: rasterised again, and the land is generated again
    run(request({ id: 3, landMaskLayers: boxMap(), maskKey: "ixnay:4", keepBorders: true }));
    expect(options[2]!.landMask).not.toBe(options[0]!.landMask);
    const third = last(posted).message;
    if (third.type !== "result") throw new Error(`expected a result, got ${third.type}`);
    expect(third.restartedAt).toBe("land");
  });
  it("answers a key it has no mask for with an error, and keeps working", () => {
    const { posted, run } = harness();
    run(request({ id: 1, maskKey: "unseen" }));
    expect(last(posted).message).toMatchObject({ type: "error", id: 1 });
    run(request({ id: 2 }));
    expect(last(posted).message).toMatchObject({ type: "result", id: 2 });
  });

  it("runs a restart that fails again in full, once", () => {
    let calls = 0;
    const { posted, run } = harness((params, onProgress, options) => {
      calls++;
      if (calls === 2) throw new Error("climate exploded");
      return generateWorldStaged(params, onProgress, options);
    });
    run(request({ id: 1 }));
    run(request({ id: 2, params: { cellCount: 2500, temperatureOffset: 1 } }));

    expect(calls).toBe(3);
    const result = last(posted).message;
    if (result.type !== "result") throw new Error(`expected a result, got ${result.type}`);
    expect(result.id).toBe(2);
  });
  it("answers a generator failure with an error message and keeps working", () => {
    let calls = 0;
    const { posted, run } = harness((params, onProgress, options) => {
      calls++;
      if (calls === 1) throw new Error("mesh exploded");
      return generateWorldStaged(params, onProgress, options);
    });
    run(request({ id: 1 }));
    expect(last(posted).message).toEqual({ type: "error", id: 1, message: "mesh exploded" });

    posted.length = 0;
    run(request({ id: 2 }));
    expect(last(posted).message).toMatchObject({ type: "result", id: 2 });
  });
  it("lets the request's seed win over a seed in the params", () => {
    const { posted, run } = harness();
    run(request({ seed: 99, params: { cellCount: 2500, seed: 5 } }));
    const result = last(posted).message;
    if (result.type !== "result") throw new Error("expected a result");
    expect(result.seed).toBe(99);
  });
});
