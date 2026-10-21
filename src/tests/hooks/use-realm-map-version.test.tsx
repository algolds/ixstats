import { renderHook } from "@testing-library/react";

const useQuery = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: { realms: { map: { version: { useQuery: (...args: unknown[]) => useQuery(...args) } } } },
}));

import { useRealmMapVersion } from "~/hooks/useRealmMapVersion";
import { tileUrlTemplate } from "~/lib/maps/decorative-tiles";

beforeEach(() => useQuery.mockReset());

describe("useRealmMapVersion", () => {
  it("builds tile URLs from the realm id the server resolved, never the slug the map was asked for", () => {
    useQuery.mockReturnValue({ data: { realmId: "r_eurth", version: 7 }, error: null });
    const { result } = renderHook(() => {
      const { mapVersion } = useRealmMapVersion("eurth");
      return mapVersion && tileUrlTemplate(mapVersion, "rivers");
    });
    expect(result.current).toBe(
      `${window.location.origin}/api/map-tiles/r_eurth/7/f1/rivers/{z}/{x}/{y}`
    );
    expect(result.current).not.toContain("/eurth/");
  });
});
