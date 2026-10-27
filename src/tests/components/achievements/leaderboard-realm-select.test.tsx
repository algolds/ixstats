/**
 * Leaderboards rank one realm at a time (realm clocks design §3): realms run at their own speeds, so a nation is
 * only ranked against its own realm's. The selector shows the viewer's realm (Ixnay without a nation) until they
 * pick another, which it writes to `?realm=` for the realm-scoped queries.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { selectedRankingRealm } from "~/lib/realms/realm-scope-select";

const REALMS = [
  { id: "realm-eurth", slug: "eurth", name: "Eurth" },
  { id: "default", slug: "ixworld", name: "Ixnay" },
];
const mockReplace = jest.fn();
let mockViewerRealm: string | undefined;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/leaderboards",
  useSearchParams: () => new URLSearchParams("tab=gdp"),
}));
jest.mock("~/hooks/useViewerRealmId", () => ({ useViewerRealmId: () => mockViewerRealm }));
jest.mock("~/trpc/react", () => ({
  api: { realms: { directory: { useQuery: () => ({ data: REALMS }) } } },
}));

import { LeaderboardRealmSelect } from "~/components/achievements/tabs/LeaderboardRealmSelect";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
  Element.prototype.scrollIntoView ??= () => undefined;
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => undefined;
});
beforeEach(() => jest.clearAllMocks());

describe("the ranked realm", () => {
  it("is the named realm, Ixnay by any of its slugs, else the viewer's, else Ixnay", () => {
    expect(selectedRankingRealm(REALMS, "eurth", "default")?.name).toBe("Eurth");
    expect(selectedRankingRealm(REALMS, "ixnay", "realm-eurth")?.name).toBe("Ixnay");
    expect(selectedRankingRealm(REALMS, undefined, "realm-eurth")?.name).toBe("Eurth");
    expect(selectedRankingRealm(REALMS, undefined, undefined)?.name).toBe("Ixnay");
    expect(selectedRankingRealm(REALMS, "unlisted", "default")).toBeUndefined();
  });
});

describe("the realm selector", () => {
  it("shows the viewer's realm and writes a picked realm to ?realm=", () => {
    mockViewerRealm = "realm-eurth";
    render(<LeaderboardRealmSelect realmParam={undefined} />);
    const trigger = screen.getByRole("combobox", { name: "Realm" });
    expect(trigger).toHaveTextContent("Eurth");
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "Ixnay" }));
    expect(mockReplace).toHaveBeenCalledWith("/leaderboards?tab=gdp&realm=ixworld");
  });
});
