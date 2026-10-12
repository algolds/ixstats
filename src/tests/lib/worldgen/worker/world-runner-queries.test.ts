/**
 * The worker's diagnostic, seeds and render requests, answered from the world it finished last: no regeneration,
 * a diagnostic drawn once per kind until the next generate, a render encoded by the injected encoder, and a request
 * for any other world refused.
 */

import { generateWorldStaged } from "~/lib/worldgen/v2";
import type {
  WorldGenerateRequest,
  WorldWorkerResponse,
} from "~/lib/worldgen/worker/world-messages";
import { createWorldRunner, type PngEncoder } from "~/lib/worldgen/worker/world-runner";
import { encodePng } from "~/lib/worldgen/worker/encode-png";

type Posted = { message: WorldWorkerResponse; transfer: ArrayBuffer[] };

const generateRequest = (over: Partial<WorldGenerateRequest> = {}): WorldGenerateRequest => ({
  type: "generate",
  id: 1,
  params: { cellCount: 2500 },
  seed: 7,
  ...over,
});

function harness(toPng: PngEncoder = () => Promise.resolve(new Blob(["png"]))) {
  const posted: Posted[] = [];
  let generates = 0;
  const run = createWorldRunner(
    (message, transfer = []) => posted.push({ message, transfer }),
    (params, onProgress, options) => {
      generates++;
      return generateWorldStaged(params, onProgress, options);
    },
    toPng
  );
  return { posted, run, generates: () => generates };
}

const last = (posted: Posted[]) => posted[posted.length - 1]!.message;
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("worldgen/world-runner queries", () => {
  it("draws a diagnostic from the cached graph without generating, and transfers a copy", () => {
    const { posted, run, generates } = harness();
    run(generateRequest());
    run({ type: "diagnostic", requestId: 1, world: 1, kind: "temperature" });

    expect(generates()).toBe(1);
    const { message, transfer } = posted[posted.length - 1]!;
    if (message.type !== "diagnostic-result") throw new Error(`got ${message.type}`);
    expect(message).toMatchObject({ requestId: 1, world: 1 });
    expect(message.image).toMatchObject({ kind: "temperature", width: 2048, height: 2048 });
    expect(message.image.legend.title).toBe("Temperature");
    expect(message.image.rgba.byteLength).toBe(2048 * 2048 * 4);
    expect(transfer).toEqual([message.image.rgba]);
  });

  it("keeps a diagnostic per kind until the next generate, and serves it whole again", () => {
    const { posted, run } = harness();
    run(generateRequest());
    const ask = (requestId: number) =>
      run({ type: "diagnostic", requestId, world: 1, kind: "rainfall" });
    ask(1);
    ask(2);
    const [a, b] = posted.slice(-2).map((p) => p.message);
    if (a!.type !== "diagnostic-result" || b!.type !== "diagnostic-result")
      throw new Error("expected results");
    // The first buffer went away with the transfer in a browser; the second is a fresh copy of the same pixels
    expect(a!.image.rgba).not.toBe(b!.image.rgba);
    expect(Buffer.from(b!.image.rgba).equals(Buffer.from(a!.image.rgba))).toBe(true);
    expect(Buffer.from(b!.image.rgba).some((v) => v !== 0)).toBe(true);
  });

  it("answers the nations' seeds as GeoJSON points", () => {
    const { posted, run } = harness();
    run(generateRequest());
    run({ type: "seeds", requestId: 5, world: 1 });
    const message = last(posted);
    if (message.type !== "seeds-result") throw new Error(`got ${message.type}`);
    expect(message.requestId).toBe(5);
    expect(message.seeds.features.length).toBeGreaterThan(1);
    expect(message.seeds.features[0]!.geometry.type).toBe("Point");
  });

  it("renders a PNG with the encoder it is given", async () => {
    const encoded: { width: number; height: number; length: number }[] = [];
    const png = new Blob(["fake png"], { type: "image/png" });
    const { posted, run } = harness(async ({ width, height, rgba }) => {
      encoded.push({ width, height, length: rgba.length });
      return png;
    });
    run(generateRequest());
    run({ type: "render", requestId: 2, world: 1, width: 2048, politics: true });
    await flush();

    expect(encoded).toEqual([{ width: 2048, height: 1024, length: 2048 * 1024 * 4 }]);
    expect(last(posted)).toEqual({
      type: "render-result",
      requestId: 2,
      world: 1,
      width: 2048,
      png,
    });
  });

  it("answers a render the encoder cannot make with a request error", async () => {
    const { posted, run } = harness(() => Promise.reject(new Error("canvas too large")));
    run(generateRequest());
    run({ type: "render", requestId: 3, world: 1, width: 8192, politics: false });
    await flush();
    expect(last(posted)).toEqual({
      type: "request-error",
      requestId: 3,
      message: "canvas too large",
    });
  });

  it("refuses a request for a world it does not hold, and one before any world", () => {
    const { posted, run } = harness();
    run({ type: "seeds", requestId: 1, world: 1 });
    expect(last(posted)).toMatchObject({ type: "request-error", requestId: 1 });

    run(generateRequest({ id: 4 }));
    run({ type: "diagnostic", requestId: 2, world: 1, kind: "height" });
    expect(last(posted)).toMatchObject({ type: "request-error", requestId: 2 });
    run({ type: "diagnostic", requestId: 3, world: 4, kind: "height" });
    expect(last(posted)).toMatchObject({ type: "diagnostic-result", requestId: 3, world: 4 });
  });

  it("draws nothing from a graph a failed generate may have half rewritten", () => {
    let failing = false;
    const posted: Posted[] = [];
    const run = createWorldRunner(
      (message, transfer = []) => posted.push({ message, transfer }),
      (params, onProgress, options) => {
        if (failing) throw new Error("exploded");
        return generateWorldStaged(params, onProgress, options);
      }
    );
    run(generateRequest());
    // Fails, and fails again on the full re-run, so there is no world
    failing = true;
    run(generateRequest({ id: 2, params: { cellCount: 2500, temperatureOffset: 1 } }));
    expect(last(posted)).toMatchObject({ type: "error", id: 2 });
    run({ type: "seeds", requestId: 1, world: 1 });
    expect(last(posted)).toMatchObject({
      type: "request-error",
      message: "There is no world to draw",
    });
  });

  it("the real encoder reports a browser without OffscreenCanvas", async () => {
    await expect(
      encodePng({ width: 2, height: 1, rgba: new Uint8ClampedArray(8) })
    ).rejects.toThrow("cannot draw");
  });

  it("the real encoder puts the pixels on an OffscreenCanvas and asks for a PNG", async () => {
    const calls: string[] = [];
    const png = new Blob(["png"]);
    class FakeCanvas {
      constructor(
        readonly width: number,
        readonly height: number
      ) {
        calls.push(`canvas ${width}x${height}`);
      }
      getContext() {
        return { putImageData: (image: { width: number }) => calls.push(`put ${image.width}`) };
      }
      convertToBlob(options: { type: string }) {
        calls.push(`blob ${options.type}`);
        return Promise.resolve(png);
      }
    }
    class FakeImageData {
      constructor(
        readonly data: Uint8ClampedArray,
        readonly width: number,
        readonly height: number
      ) {}
    }
    Object.assign(globalThis, { OffscreenCanvas: FakeCanvas, ImageData: FakeImageData });
    try {
      await expect(
        encodePng({ width: 4, height: 2, rgba: new Uint8ClampedArray(32) })
      ).resolves.toBe(png);
      expect(calls).toEqual(["canvas 4x2", "put 4", "blob image/png"]);
    } finally {
      Reflect.deleteProperty(globalThis, "OffscreenCanvas");
      Reflect.deleteProperty(globalThis, "ImageData");
    }
  });
});
