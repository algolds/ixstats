import { renderHook } from "@testing-library/react";

const useQuery = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: { realms: { map: { version: { useQuery: (...args: unknown[]) => useQuery(...args) } } } },
}));

import { useRealmMapVersion } from "~/hooks/useRealmMapVersion";
import { tileUrlTemplate } from "~/lib/maps/decorative-tiles";

beforeEach(() => useQuery.mockReset());

describe("useRealmMapVersion", () => {
  it("asks for the named realm's version and hands back what the server resolved", () => {
    useQuery.mockReturnValue({ data: { realmId: "r_eurth", version: 7 }, error: null });
    const { result } = renderHook(() => useRealmMapVersion("eurth"));
    expect(useQuery).toHaveBeenCalledWith({ realm: "eurth" }, expect.any(Object));
    expect(result.current).toEqual({ mapVersion: { realmId: "r_eurth", version: 7 }, error: null });
  });

  it("builds tile URLs from the realm id the server resolved, never the slug the map was asked for", () => {
    useQuery.mockReturnValue({ data: { realmId: "r_eurth", version: 7 }, error: null });
    const { result } = renderHook(() => {
      const { mapVersion } = useRealmMapVersion("eurth");
      return mapVersion && tileUrlTemplate(mapVersion, "rivers");
    });
    expect(result.current).toBe(
      `${window.location.origin}/api/map-tiles/r_eurth/7/rivers/{z}/{x}/{y}`
    );
    expect(result.current).not.toContain("/eurth/");
  });

  it("leaves the realm to the server (the viewer's) when none is named", () => {
    useQuery.mockReturnValue({ data: { realmId: "default", version: 0 }, error: null });
    renderHook(() => useRealmMapVersion());
    expect(useQuery).toHaveBeenCalledWith(undefined, expect.any(Object));
  });

  it("has no version until it is known", () => {
    useQuery.mockReturnValue({ data: undefined, error: null });
    expect(renderHook(() => useRealmMapVersion("eurth")).result.current.mapVersion).toBeUndefined();
  });

  it("reports the error when the version could not be had", () => {
    const error = new Error("version query failed");
    useQuery.mockReturnValue({ data: undefined, error });
    expect(renderHook(() => useRealmMapVersion("eurth")).result.current.error).toBe(error);
  });

  it("keeps the version for a minute, and checks again when the tab regains focus", () => {
    useQuery.mockReturnValue({ data: undefined, error: null });
    renderHook(() => useRealmMapVersion());
    expect(useQuery.mock.calls[0]![1]).toMatchObject({
      staleTime: 60_000,
      refetchOnWindowFocus: true,
    });
  });

  it("holds the query back while disabled, and runs it otherwise", () => {
    useQuery.mockReturnValue({ data: undefined, error: null });
    renderHook(() => useRealmMapVersion("eurth", false));
    renderHook(() => useRealmMapVersion("eurth"));
    expect(useQuery.mock.calls[0]![1]).toMatchObject({ enabled: false });
    expect(useQuery.mock.calls[1]![1]).toMatchObject({ enabled: true });
  });
});
