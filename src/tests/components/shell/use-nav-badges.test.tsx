import { act, renderHook } from "@testing-library/react";

let country: { id: string; name: string; flag: string } | null = null;
let inboxCount = 0;
const inboxEnabled = jest.fn();
let balance: { credits: number; canClaimDailyBonus: boolean; loginStreak: number } | undefined;
let folderCounts: { inbox: number } | undefined;
let pendingIssues: { total: number; urgent: number } | undefined;
const issuesQuery = jest.fn();
const balanceQuery = jest.fn();
const folderCountsQuery = jest.fn();

jest.mock("~/hooks/useUserCountry", () => ({ useUserCountry: () => ({ country }) }));
jest.mock("~/components/mycountry/domains/diplomacy/inbox/useDiplomacyInbox", () => ({
  useDiplomacyInboxCount: (_id: string | undefined, enabled: boolean) => {
    inboxEnabled(enabled);
    return { count: enabled ? inboxCount : 0 };
  },
}));
jest.mock("~/trpc/react", () => ({
  api: {
    messages: {
      getFolderCounts: {
        useQuery: (_input: unknown, opts: { enabled: boolean }) => {
          folderCountsQuery(opts);
          return { data: opts.enabled ? folderCounts : undefined };
        },
      },
    },
    nationalIssues: {
      getPendingCount: {
        useQuery: (input: { countryId: string }, opts: { enabled: boolean }) => {
          issuesQuery(input, opts);
          return { data: opts.enabled ? pendingIssues : undefined };
        },
      },
    },
    vault: {
      getBalance: {
        useQuery: (_input: unknown, opts: { enabled: boolean }) => {
          balanceQuery(opts);
          return { data: opts.enabled ? balance : undefined };
        },
      },
    },
  },
}));

import { useNavBadges } from "~/components/shell/use-nav-badges";
import { markVersionSeen } from "~/lib/navigation/seen-version";

beforeEach(() => {
  country = { id: "c1", name: "Caphiria", flag: "flag.png" };
  inboxCount = 3;
  balance = { credits: 1240.7, canClaimDailyBonus: true, loginStreak: 4 };
  folderCounts = { inbox: 0 };
  pendingIssues = undefined;
  issuesQuery.mockClear();
  balanceQuery.mockClear();
  folderCountsQuery.mockClear();
  inboxEnabled.mockClear();
  // A build the user has already seen, so only the what's-new tests see that badge.
  markVersionSeen();
});

describe("useNavBadges", () => {
  it("returns nothing and runs no protected query when signed out", () => {
    const { result } = renderHook(() => useNavBadges(false));
    expect(result.current).toEqual({});
    expect(balanceQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    expect(folderCountsQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    expect(inboxEnabled).toHaveBeenCalledWith(false);
    expect(inboxEnabled).not.toHaveBeenCalledWith(true);
  });

  it("maps the inbox and the claimable reward, with no flag or balance badge", () => {
    const { result } = renderHook(() => useNavBadges(true));
    expect(result.current).toEqual({
      "diplomacy-inbox": { kind: "count", value: 3 },
      "daily-reward": { kind: "action", label: "4d" },
    });
  });

  it("omits the reward when claimed and the inbox when empty", () => {
    balance = { credits: 0, canClaimDailyBonus: false, loginStreak: 0 };
    inboxCount = 0;
    const { result } = renderHook(() => useNavBadges(true));
    expect(result.current["daily-reward"]).toBeUndefined();
    expect(result.current["diplomacy-inbox"]).toBeUndefined();
  });

  it("labels a first claim New", () => {
    balance = { credits: 5, canClaimDailyBonus: true, loginStreak: 0 };
    const { result } = renderHook(() => useNavBadges(true));
    expect(result.current["daily-reward"]).toEqual({ kind: "action", label: "New" });
  });

  it("counts unread messages from the inbox and hides a zero count", () => {
    folderCounts = { inbox: 5 };
    const { result, rerender } = renderHook(() => useNavBadges(true));
    expect(result.current["messages-unread"]).toEqual({ kind: "count", value: 5 });
    folderCounts = { inbox: 0 };
    rerender();
    expect(result.current["messages-unread"]).toBeUndefined();
  });

  it("flags an unseen build as New and clears it once the changelog is visited", () => {
    window.localStorage.clear();
    const { result } = renderHook(() => useNavBadges(true));
    expect(result.current["whats-new"]).toEqual({ kind: "action", label: "New" });
    act(() => markVersionSeen());
    expect(result.current["whats-new"]).toBeUndefined();
  });

  it("shows no what's-new flag for a seen build or when signed out", () => {
    expect(renderHook(() => useNavBadges(true)).result.current["whats-new"]).toBeUndefined();
    window.localStorage.clear();
    expect(renderHook(() => useNavBadges(false)).result.current).toEqual({});
  });

  it("counts pending issues and hides a zero count", () => {
    pendingIssues = { total: 4, urgent: 1 };
    const { result, rerender } = renderHook(() => useNavBadges(true));
    expect(result.current["issues-pending"]).toEqual({ kind: "count", value: 4 });
    pendingIssues = { total: 0, urgent: 0 };
    rerender();
    expect(result.current["issues-pending"]).toBeUndefined();
  });

  it("queries issues only when signed in with a country, and never fetches meetings", () => {
    // The api mock has no `meetings` router: fetching them would throw.
    renderHook(() => useNavBadges(false));
    expect(issuesQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false })
    );
    issuesQuery.mockClear();
    country = null;
    renderHook(() => useNavBadges(true));
    expect(issuesQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false })
    );
    issuesQuery.mockClear();
    country = { id: "c1", name: "Caphiria", flag: "flag.png" };
    renderHook(() => useNavBadges(true));
    expect(issuesQuery).toHaveBeenCalledWith(
      { countryId: "c1" },
      expect.objectContaining({ enabled: true })
    );
  });
});
