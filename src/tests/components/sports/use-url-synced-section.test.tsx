import { act, renderHook } from "@testing-library/react";
import { useUrlSyncedSection } from "~/components/sports/core/useUrlSyncedSection";

type Section = "overview" | "roster" | "tactics";
const hook = ({ param }: { param: Section | null }) =>
  useUrlSyncedSection<Section>(param, "overview");

describe("useUrlSyncedSection", () => {
  it("does not bounce back to the stale URL param after a tab switch", () => {
    const { result, rerender } = renderHook(hook, { initialProps: { param: "overview" } });
    act(() => result.current[1]("roster"));
    expect(result.current[0]).toBe("roster");
    rerender({ param: "overview" });
    expect(result.current[0]).toBe("roster");
    rerender({ param: "roster" });
    expect(result.current[0]).toBe("roster");
  });
});
