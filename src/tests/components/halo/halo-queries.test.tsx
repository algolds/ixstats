/** Halo opens cheaply: the countries list is only fetched while the search view can show countries. */
import { act, renderHook } from "@testing-library/react";
import { useDynamicIslandState } from "~/components/halo/hooks";

const mockQuery = { data: undefined };
const mockUser = { user: null, isLoaded: true, isSignedIn: false };
const mockAuth = { signOut: jest.fn() };
const mockTheme = { toggleTheme: jest.fn(), toggleCompactMode: jest.fn() };
const countriesEnabled: Array<boolean | undefined> = [];
const realmsEnabled: Array<boolean | undefined> = [];

jest.mock("~/trpc/react", () => ({
  api: {
    countries: {
      getSelectList: {
        useQuery: (_input: unknown, options: { enabled?: boolean }) => {
          countriesEnabled.push(options.enabled);
          return mockQuery;
        },
      },
    },
    realms: {
      getSelectList: {
        useQuery: (_input: unknown, options: { enabled?: boolean }) => {
          realmsEnabled.push(options.enabled);
          return mockQuery;
        },
      },
    },
    wikios: { advancedSearch: { useQuery: () => mockQuery } },
  },
}));
jest.mock("~/context/auth-context", () => ({
  useUser: () => mockUser,
  useAuth: () => mockAuth,
}));
jest.mock("~/context/theme-context", () => ({ useTheme: () => mockTheme }));
jest.mock("~/hooks/useSoundSettings", () => ({ useSoundSettings: () => ({}) }));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => ({}) }));
jest.mock("~/hooks/usePermissions", () => ({ useCanOpenAdmin: () => false }));
jest.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("~/components/halo/plugin-context", () => ({ useActiveDIPlugin: () => null }));

beforeEach(() => {
  countriesEnabled.length = 0;
  realmsEnabled.length = 0;
});

const lastEnabled = () => countriesEnabled[countriesEnabled.length - 1];
const lastRealmsEnabled = () => realmsEnabled[realmsEnabled.length - 1];

describe("Halo countries query gating", () => {
  it("stays off while the Halo is closed", () => {
    renderHook(() => useDynamicIslandState());
    expect(lastEnabled()).toBe(false);
  });

  it.each(["notifications", "settings"] as const)("stays off in %s mode", (mode) => {
    const { result } = renderHook(() => useDynamicIslandState());
    act(() => {
      result.current.switchMode(mode);
    });
    expect(lastEnabled()).toBe(false);
  });

  it("turns on in search with the all filter", () => {
    const { result } = renderHook(() => useDynamicIslandState());
    act(() => {
      result.current.switchMode("search");
    });
    expect(result.current.searchFilter).toBe("all");
    expect(lastEnabled()).toBe(true);
  });

  it("turns on in search with the countries filter and off for other filters", () => {
    const { result } = renderHook(() => useDynamicIslandState());
    act(() => {
      result.current.switchMode("search");
    });
    act(() => {
      result.current.setSearchFilter("countries");
    });
    expect(lastEnabled()).toBe(true);
    act(() => {
      result.current.setSearchFilter("wiki");
    });
    expect(lastEnabled()).toBe(false);
  });

  it("enables realms.getSelectList only in search with the all filter", () => {
    const { result } = renderHook(() => useDynamicIslandState());
    expect(lastRealmsEnabled()).toBe(false);

    act(() => {
      result.current.switchMode("notifications");
    });
    expect(lastRealmsEnabled()).toBe(false);

    act(() => {
      result.current.switchMode("search");
    });
    expect(lastRealmsEnabled()).toBe(true);

    act(() => {
      result.current.setSearchFilter("countries");
    });
    expect(lastRealmsEnabled()).toBe(false);
  });
});
