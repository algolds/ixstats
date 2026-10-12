/**
 * The apply flow's hook on its own: a second press while a call is under way is ignored, whether it comes in the same
 * moment or after the view has caught up.
 */
import { act, renderHook } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const fake = jest.requireActual("~/tests/helpers/fake-map-import");
  return { api: { useUtils: fake.useUtils, geoEditor: fake.geoEditor } };
});
// jsdom has no CompressionStream; the bytes only need to exist
jest.mock("~/lib/maps/import/world-bundle", () => ({
  ...jest.requireActual("~/lib/maps/import/world-bundle"),
  encodeWorldBundle: jest.fn(),
}));

import { useWorldApply } from "~/components/maps/editor/hooks/useWorldApply";
import { applyWorld, setJob, start } from "~/tests/helpers/fake-map-import";
import { DRAFT, REALM, dryRun, resetWorldApplyTests } from "~/tests/helpers/world-apply-fixtures";

beforeEach(resetWorldApplyTests);

const mount = () =>
  renderHook(() =>
    useWorldApply({ realmId: REALM, result: DRAFT, source: "preset", onApplied: jest.fn() })
  );

describe("useWorldApply", () => {
  it("starts one check for two presses in the same moment", async () => {
    const { result } = mount();
    await act(async () => {
      void result.current.begin();
      void result.current.begin();
    });
    expect(start).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("starts one check for a press while the world is being sent", async () => {
    global.fetch = jest.fn(() => new Promise<Response>(() => {}));
    const { result } = mount();
    await act(async () => {
      void result.current.begin();
    });
    expect(result.current.view.stage).toBe("sending");
    await act(async () => result.current.begin());
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a preview", async () => {
    const { result } = renderHook(() =>
      useWorldApply({ realmId: REALM, result: null, source: "preset", onApplied: jest.fn() })
    );
    await act(async () => result.current.begin());
    expect(start).not.toHaveBeenCalled();
    expect(result.current.view.stage).toBe("idle");
  });

  it("queues one apply for two confirmations in the same moment, and none before a check is done", async () => {
    const { result } = mount();
    await act(async () => result.current.confirm());
    expect(applyWorld).not.toHaveBeenCalled();

    await act(async () => result.current.begin());
    act(() => setJob("j_check", dryRun()));
    expect(result.current.view.stage).toBe("review");
    await act(async () => {
      void result.current.confirm();
      void result.current.confirm();
    });
    expect(applyWorld).toHaveBeenCalledTimes(1);
  });

  it("queues no second apply once the first is under way", async () => {
    const { result } = mount();
    await act(async () => result.current.begin());
    act(() => setJob("j_check", dryRun()));
    await act(async () => result.current.confirm());
    expect(result.current.view.stage).toBe("applying");
    await act(async () => result.current.confirm());
    expect(applyWorld).toHaveBeenCalledTimes(1);
  });

  it("starts no new check while the world is being applied", async () => {
    const { result } = mount();
    await act(async () => result.current.begin());
    act(() => setJob("j_check", dryRun()));
    await act(async () => result.current.confirm());
    expect(result.current.view.stage).toBe("applying");
    await act(async () => result.current.begin());
    expect(start).toHaveBeenCalledTimes(1);
  });
});
