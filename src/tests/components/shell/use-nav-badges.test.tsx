import { renderHook } from "@testing-library/react";

let country: { id: string; name: string; flag: string } | null = null;
let inboxCount = 0;
let flagNormalizes = true;
let balance: { credits: number; canClaimDailyBonus: boolean; loginStreak: number } | undefined;
const balanceQuery = jest.fn();

jest.mock("~/hooks/useUserCountry", () => ({ useUserCountry: () => ({ country }) }));
jest.mock("~/components/mycountry/domains/diplomacy/inbox/useDiplomacyInbox", () => ({
  useDiplomacyInboxCount: (_id: string | undefined, enabled: boolean) => ({
    count: enabled ? inboxCount : 0,
  }),
}));
jest.mock("~/lib/flags/normalization", () => ({
  normalizeFlagUrl: (u: string) => (flagNormalizes ? `norm:${u}` : null),
}));
jest.mock("~/trpc/react", () => ({
  api: {
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

beforeEach(() => {
  country = { id: "c1", name: "Caphiria", flag: "flag.png" };
  inboxCount = 3;
  balance = { credits: 1240.7, canClaimDailyBonus: true, loginStreak: 4 };
  flagNormalizes = true;
  balanceQuery.mockClear();
});

describe("useNavBadges", () => {
  it("returns nothing and runs no protected query when signed out", () => {
    const { result } = renderHook(() => useNavBadges(false));
    expect(result.current).toEqual({});
    expect(balanceQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it("maps flag, inbox, balance and the claimable reward", () => {
    const { result } = renderHook(() => useNavBadges(true));
    expect(result.current).toEqual({
      "mycountry-flag": { kind: "icon", src: "norm:flag.png", alt: "Caphiria" },
      "diplomacy-inbox": { kind: "count", value: 3 },
      "vault-balance": { kind: "value", label: "1,240 IxC" },
      "daily-reward": { kind: "action", label: "4d" },
    });
  });

  it("omits the reward when claimed and the inbox when empty", () => {
    balance = { credits: 0, canClaimDailyBonus: false, loginStreak: 0 };
    inboxCount = 0;
    const { result } = renderHook(() => useNavBadges(true));
    expect(result.current["daily-reward"]).toBeUndefined();
    expect(result.current["diplomacy-inbox"]).toBeUndefined();
    expect(result.current["vault-balance"]).toEqual({ kind: "value", label: "0 IxC" });
  });

  it("labels a first claim New and skips a flag that normalizes to nothing", () => {
    balance = { credits: 5, canClaimDailyBonus: true, loginStreak: 0 };
    flagNormalizes = false;
    const { result } = renderHook(() => useNavBadges(true));
    expect(result.current["daily-reward"]).toEqual({ kind: "action", label: "New" });
    expect(result.current["mycountry-flag"]).toBeUndefined();
  });
});
