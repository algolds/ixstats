import { act, renderHook } from "@testing-library/react";
import { useUrlSyncedSection } from "~/components/sports/core/useUrlSyncedSection";

type Section = "overview" | "roster" | "tactics";
const hook = ({ param }: { param: Section | null }) =>
  useUrlSyncedSection<Section>(param, "overview");

describe("useUrlSyncedSection", () => {
  it("starts from the URL param, else the fallback", () => {
    expect(renderHook(hook, { initialProps: { param: "roster" } }).result.current[0]).toBe("roster");
    expect(renderHook(hook, { initialProps: { param: null } }).result.current[0]).toBe("overview");
  });

  it("does not bounce back to the stale URL param after a tab switch", () => {
    const { result, rerender } = renderHook(hook, { initialProps: { param: "overview" } });
    act(() => result.current[1]("roster"));
    expect(result.current[0]).toBe("roster");
    rerender({ param: "overview" });
    expect(result.current[0]).toBe("roster");
    rerender({ param: "roster" });
    expect(result.current[0]).toBe("roster");
  });

  it("follows a genuine external URL change (back/forward)", () => {
    const { result, rerender } = renderHook(hook, { initialProps: { param: "roster" } });
    rerender({ param: "tactics" });
    expect(result.current[0]).toBe("tactics");
  });
});
