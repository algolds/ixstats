/**
 * P2-6: a leaderboard opened on a draft or unlisted realm's slug says the realm isn't ranked, asks for nothing, and
 * the realm menu asks to pick one, instead of a blank menu over "No nations".
 */
import { render, screen } from "@testing-library/react";
import { isUnlistedRankingRealm } from "~/lib/realms/realm-scope-select";

const REALMS = [
  { id: "realm-eurth", slug: "eurth", name: "Eurth" },
  { id: "default", slug: "ixworld", name: "Ixnay" },
];
let mockSearch = "realm=studio-acceptance";
const mockLeaderboard = jest.fn((..._args: unknown[]) => ({ data: [], isLoading: false }));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  usePathname: () => "/leaderboards",
  useSearchParams: () => new URLSearchParams(mockSearch),
}));
jest.mock("~/hooks/useViewerRealmId", () => ({ useViewerRealmId: () => "default" }));
jest.mock("~/trpc/react", () => ({
  api: {
    realms: { directory: { useQuery: () => ({ data: REALMS }) } },
    achievements: {
      getLeaderboard: { useQuery: (...args: unknown[]) => mockLeaderboard(...args) },
      getCountryLeaderboard: { useQuery: () => ({ data: [], isLoading: false }) },
    },
  },
}));

import { CountryLeaderboards } from "~/components/achievements/tabs/CountryLeaderboards";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as never;
});
beforeEach(() => mockLeaderboard.mockClear());

it("knows an unlisted realm only once the directory has loaded", () => {
  expect(isUnlistedRankingRealm(REALMS, "studio-acceptance")).toBe(true);
  expect(isUnlistedRankingRealm(REALMS, "eurth")).toBe(false);
  expect(isUnlistedRankingRealm(REALMS, "ixnay")).toBe(false);
  expect(isUnlistedRankingRealm(REALMS, undefined)).toBe(false);
  expect(isUnlistedRankingRealm(undefined, "studio-acceptance")).toBe(false);
});

it("says a draft or unlisted realm isn't ranked and asks the server for nothing", () => {
  render(<CountryLeaderboards />);
  expect(screen.getByText("This realm isn't ranked")).toBeTruthy();
  expect(screen.queryByText(/No nations match/)).toBeNull();
  expect(screen.getByRole("combobox", { name: "Realm" })).toHaveTextContent("Pick a realm");
  expect(mockLeaderboard).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ enabled: false }));
});

it("ranks a listed realm as before", () => {
  mockSearch = "realm=eurth";
  render(<CountryLeaderboards />);
  expect(screen.queryByText("This realm isn't ranked")).toBeNull();
  expect(screen.getByText("No nations match your search")).toBeTruthy();
});
