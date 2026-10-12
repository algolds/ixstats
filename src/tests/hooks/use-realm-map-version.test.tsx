import { renderHook } from "@testing-library/react";

const useQuery = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: { realms: { map: { version: { useQuery: (...args: unknown[]) => useQuery(...args) } } } },
}));

import { useRealmMapVersion } from "~/hooks/useRealmMapVersion";

beforeEach(() => useQuery.mockReset());

describe("useRealmMapVersion", () => {
  it("asks for the named realm's version and hands back what the server resolved", () => {
    useQuery.mockReturnValue({ data: { realmId: "r_eurth", version: 7 } });
    const { result } = renderHook(() => useRealmMapVersion("eurth"));
    expect(useQuery).toHaveBeenCalledWith({ realm: "eurth" }, expect.any(Object));
    expect(result.current).toEqual({ realmId: "r_eurth", version: 7 });
  });

  it("leaves the realm to the server (the viewer's) when none is named", () => {
    useQuery.mockReturnValue({ data: { realmId: "default", version: 0 } });
    renderHook(() => useRealmMapVersion());
    expect(useQuery).toHaveBeenCalledWith(undefined, expect.any(Object));
  });

  it("is undefined until the version is known", () => {
    useQuery.mockReturnValue({ data: undefined });
    expect(renderHook(() => useRealmMapVersion("eurth")).result.current).toBeUndefined();
  });

  it("keeps the version for a minute, and checks again when the tab regains focus", () => {
    useQuery.mockReturnValue({ data: undefined });
    renderHook(() => useRealmMapVersion());
    expect(useQuery.mock.calls[0]![1]).toMatchObject({
      staleTime: 60_000,
      refetchOnWindowFocus: true,
    });
  });
});
