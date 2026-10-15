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
let forumCounts: { watchedUnread: number; realmBoardNew: number } | undefined;
const forumCountsQuery = jest.fn();

let pathname: string | null = "/dashboard";
jest.mock("next/navigation", () => ({ usePathname: () => pathname }));
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
    thinkpagesForum: {
      navCounts: {
        useQuery: (_input: undefined, opts: { enabled: boolean }) => {
          forumCountsQuery(opts);
          return { data: opts.enabled ? forumCounts : undefined };
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
  pathname = "/dashboard";
  country = { id: "c1", name: "Caphiria", flag: "flag.png" };
  inboxCount = 3;
  balance = { credits: 1240.7, canClaimDailyBonus: true, loginStreak: 4 };
  folderCounts = { inbox: 0 };
  pendingIssues = undefined;
  issuesQuery.mockClear();
  balanceQuery.mockClear();
  folderCountsQuery.mockClear();
  forumCounts = undefined;
  forumCountsQuery.mockClear();
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
      "daily-reward": { kind: "action", label: "4d", streak: 4 },
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

  it("maps the watched and realm board counts to their badges, and omits a zero count", () => {
    forumCounts = { watchedUnread: 3, realmBoardNew: 5 };
    const { result, rerender } = renderHook(() => useNavBadges(true));
    expect(result.current["forum-watched-unread"]).toEqual({ kind: "count", value: 3 });
    expect(result.current["forum-realm-board"]).toEqual({ kind: "count", value: 5 });
    forumCounts = { watchedUnread: 0, realmBoardNew: 0 };
    rerender();
    expect(result.current["forum-watched-unread"]).toBeUndefined();
    expect(result.current["forum-realm-board"]).toBeUndefined();
  });

  it("polls the forum counts every minute under the forum, for a signed-in member only", () => {
    pathname = "/thinkpages/c/general";
    renderHook(() => useNavBadges(false));
    expect(forumCountsQuery).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
    renderHook(() => useNavBadges(true));
    expect(forumCountsQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true, staleTime: 60_000, refetchInterval: 60_000 })
    );
  });

  it("polls the forum counts every five minutes elsewhere, and still not when signed out", () => {
    renderHook(() => useNavBadges(true));
    expect(forumCountsQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true, refetchInterval: 300_000 })
    );
    pathname = null;
    renderHook(() => useNavBadges(true));
    expect(forumCountsQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ refetchInterval: 300_000 })
    );
    renderHook(() => useNavBadges(false));
    expect(forumCountsQuery).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
  });
});
