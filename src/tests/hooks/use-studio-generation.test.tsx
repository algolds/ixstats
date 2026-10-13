/**
 * The Studio asks the shared worker for a world when the committed parameters, the seed or the realm's map change,
 * and only then: the same parameters ask for nothing, a fitted world waits for the realm's layers, and the mask goes
 * to the worker once per key.
 */
import { act, renderHook } from "@testing-library/react";

import type { StudioFit } from "~/hooks/useStudioFit";
import { useStudioGeneration } from "~/hooks/useStudioGeneration";
import { useWorldGenerator } from "~/hooks/useWorldGenerator";
import { paramsForPreset, type StudioParams } from "~/lib/worldgen/studio-fields";
import { fakeWorldWorkers, resultMessage } from "~/tests/helpers/fake-world-worker";

const OFF: StudioFit = {
  state: "off",
  landMaskLayers: {},
  mapVersion: undefined,
  maskKey: undefined,
  retry: jest.fn(),
};
const political = { type: "FeatureCollection" as const, features: [] };
const ready = (version: number): StudioFit => ({
  state: "ready",
  landMaskLayers: { political },
  mapVersion: version,
  maskKey: `eurth:${version}`,
  retry: jest.fn(),
});

interface Props {
  params: StudioParams;
  seed: number;
  fitting: boolean;
  fit: StudioFit;
}

function setup(initial: Props) {
  const { factory, workers } = fakeWorldWorkers();
  const hook = renderHook(
    (props: Props) => {
      const generator = useWorldGenerator(factory);
      return { generator, ...useStudioGeneration({ generator, ...props }) };
    },
    { initialProps: initial }
  );
  const posted = () => workers.flatMap((worker) => worker.posted);
  return { ...hook, workers, posted };
}

const base: Props = { params: paramsForPreset({}), seed: 7, fitting: false, fit: OFF };

describe("useStudioGeneration", () => {
  it("makes a world on mount, with the parameters and the seed, and no mask", () => {
    const { posted } = setup(base);
    expect(posted()).toHaveLength(1);
    expect(posted()[0]).toMatchObject({ type: "generate", seed: 7, params: base.params });
    expect(posted()[0]).not.toHaveProperty("landMaskLayers");
    expect(posted()[0]).not.toHaveProperty("keepBorders");
  });

  it("makes a new world for a committed change, and for a new seed", () => {
    const { rerender, posted, workers } = setup(base);
    act(() => workers[0]!.say(resultMessage(1)));
    rerender({ ...base, params: { ...base.params, oceanPercentage: 0.5 } });
    expect(posted()).toHaveLength(2);
    expect(posted()[1]!.params).toMatchObject({ oceanPercentage: 0.5 });
    act(() => workers[0]!.say(resultMessage(2)));
    rerender({ ...base, params: { ...base.params, oceanPercentage: 0.5 }, seed: 8 });
    expect(posted()).toHaveLength(3);
    expect(posted()[2]!.seed).toBe(8);
  });

  it("asks for nothing when the same parameters render again", () => {
    const { rerender, posted } = setup(base);
    rerender({ ...base });
    rerender({ ...base });
    expect(posted()).toHaveLength(1);
  });

  it("is stale until the world lands, again after a change, and while the run fails", () => {
    const { result, rerender, workers } = setup(base);
    expect(result.current.stale).toBe(true);
    act(() => workers[0]!.say(resultMessage(1)));
    expect(result.current.stale).toBe(false);

    rerender({ ...base, seed: 9 });
    expect(result.current.stale).toBe(true);
    act(() => workers.at(-1)!.say({ type: "error", id: 2, message: "boom" }));
    expect(result.current.stale).toBe(true);
  });

  it("asks again for Retry", () => {
    const { result, posted, workers } = setup(base);
    act(() => workers[0]!.say(resultMessage(1)));
    act(() => result.current.regenerate());
    expect(posted()).toHaveLength(2);
    expect(posted()[1]).toMatchObject({ seed: 7, params: base.params });
  });

  describe("fitted to a realm's map", () => {
    const fitted = (fit: StudioFit): Props => ({ ...base, fitting: true, fit });

    it("waits until the realm's layers are ready, then fits around them", () => {
      const { rerender, posted, result } = setup(
        fitted({ ...OFF, state: "loading" } satisfies StudioFit)
      );
      expect(posted()).toHaveLength(0);
      expect(result.current.stale).toBe(true);

      rerender(fitted(ready(3)));
      expect(posted()).toHaveLength(1);
      expect(posted()[0]).toMatchObject({
        keepBorders: true,
        maskKey: "eurth:3",
        landMaskLayers: { political },
      });
    });

    it("sends the layers once per mask key and fits again when the map's version moves", () => {
      const edited = { ...base.params, hypsometry: [1, 1, 1, 1, 1, 1, 1, 1, 1] };
      const { rerender, posted, workers } = setup(fitted(ready(3)));
      // The first run lands, so the worker is idle and keeps the mask it was sent
      act(() => workers[0]!.say(resultMessage(1)));
      rerender({ ...fitted(ready(3)), params: edited });
      expect(posted()).toHaveLength(2);
      expect(posted()[1]).toMatchObject({ keepBorders: true, maskKey: "eurth:3" });
      expect(posted()[1]).not.toHaveProperty("landMaskLayers");

      act(() => workers[0]!.say(resultMessage(2)));
      rerender({ ...fitted(ready(4)), params: edited });
      expect(posted()).toHaveLength(3);
      expect(posted()[2]).toMatchObject({ maskKey: "eurth:4", landMaskLayers: { political } });
    });

    it("makes no world while the realm has no map to fit, and one again on leaving the fit", () => {
      const { rerender, posted } = setup(fitted({ ...OFF, state: "none" }));
      expect(posted()).toHaveLength(0);
      rerender(base);
      expect(posted()).toHaveLength(1);
      expect(posted()[0]).not.toHaveProperty("keepBorders");
    });
  });
});
