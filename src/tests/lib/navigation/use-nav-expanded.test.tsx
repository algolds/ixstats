import { act, renderHook } from "@testing-library/react";
import { useNavExpanded } from "~/lib/navigation/use-nav-expanded";
import { NAV_STORAGE_KEYS } from "~/lib/design/appearance";

beforeEach(() => window.localStorage.clear());

describe("useNavExpanded", () => {
  it("starts from storage after mount and persists toggles", () => {
    window.localStorage.setItem(NAV_STORAGE_KEYS.expanded, JSON.stringify(["vault"]));
    const { result } = renderHook(() => useNavExpanded());
    expect(result.current.expanded.has("vault")).toBe(true);
    act(() => result.current.toggle("wiki"));
    act(() => result.current.toggle("vault"));
    expect([...result.current.expanded]).toEqual(["wiki"]);
    expect(JSON.parse(window.localStorage.getItem(NAV_STORAGE_KEYS.expanded)!)).toEqual(["wiki"]);
  });

  it("ignores corrupt storage", () => {
    window.localStorage.setItem(NAV_STORAGE_KEYS.expanded, "{not json");
    const { result } = renderHook(() => useNavExpanded());
    expect(result.current.expanded.size).toBe(0);
  });

  it("follows other tabs", () => {
    const { result } = renderHook(() => useNavExpanded());
    window.localStorage.setItem(NAV_STORAGE_KEYS.expanded, JSON.stringify(["forum"]));
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: NAV_STORAGE_KEYS.expanded }));
    });
    expect(result.current.expanded.has("forum")).toBe(true);
  });
});
