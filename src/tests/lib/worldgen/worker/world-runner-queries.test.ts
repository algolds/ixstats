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
import { ENCODE_FAILED } from "~/lib/worldgen/worker/world-query-errors";
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
  it("refuses a measure for a world it no longer holds", () => {
    const { posted, run } = harness();
    run(generateRequest());
    run(generateRequest({ id: 2 }));
    run({ type: "measure", requestId: 1, world: 1 });
    expect(last(posted)).toMatchObject({ type: "request-error", requestId: 1 });
  });
  it("answers a render the encoder cannot make with the encode failure, whatever the encoder said", async () => {
    const { posted, run } = harness(() => Promise.reject(new Error("canvas too large")));
    run(generateRequest());
    run({ type: "render", requestId: 3, world: 1, width: 8192, politics: false });
    await flush();
    expect(last(posted)).toEqual({
      type: "request-error",
      requestId: 3,
      message: ENCODE_FAILED,
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
});
