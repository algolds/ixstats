/**
 * Halo's global Escape handler only claims the event (preventDefault) when it has something to close.
 * In compact mode it must leave Escape alone so handlers that respect `defaultPrevented`, such as the
 * image repository detail rail, still run.
 */
import { act, renderHook } from "@testing-library/react";
import { useDynamicIslandState } from "~/components/halo/hooks";

jest.mock("~/trpc/react", () => {
  const idle = () => ({ data: undefined });
  return {
    api: {
      countries: { getSelectList: { useQuery: idle } },
      wikios: { advancedSearch: { useQuery: idle } },
    },
  };
});
jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: null, isSignedIn: false }),
  useAuth: () => ({ signOut: jest.fn() }),
}));
jest.mock("~/context/theme-context", () => ({
  useTheme: () => ({ toggleTheme: jest.fn(), toggleCompactMode: jest.fn() }),
}));
jest.mock("~/hooks/useSoundSettings", () => ({ useSoundSettings: () => ({}) }));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => jest.fn() }));
jest.mock("~/stores/notificationStore", () => ({
  useNotificationStore: (selector: (s: { markAllAsRead: () => void }) => unknown) =>
    selector({ markAllAsRead: jest.fn() }),
}));
jest.mock("~/lib/sound/cuelume", () => ({ soundEffects: { toggle: jest.fn() } }));
jest.mock("next/navigation", () => ({ usePathname: () => "/" }));
jest.mock("~/components/halo/plugin-context", () => ({ useActiveDIPlugin: () => undefined }));

const pressEscape = () => {
  const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
};

describe("useDynamicIslandState Escape handling", () => {
  let modeChanged: jest.Mock;

  beforeEach(() => {
    modeChanged = jest.fn();
    window.addEventListener("ix:di-mode-changed", modeChanged);
  });

  afterEach(() => {
    window.removeEventListener("ix:di-mode-changed", modeChanged);
  });

  it("does not prevent Escape or switch mode while compact", () => {
    const { result } = renderHook(() => useDynamicIslandState());
    expect(result.current.mode).toBe("compact");

    const event = pressEscape();

    expect(event.defaultPrevented).toBe(false);
    expect(modeChanged).not.toHaveBeenCalled();
    expect(result.current.mode).toBe("compact");
  });

  it("closes an open mode on Escape and claims the event", () => {
    const { result } = renderHook(() => useDynamicIslandState());
    act(() => result.current.switchMode("settings"));
    expect(result.current.mode).toBe("settings");
    modeChanged.mockClear();

    const event = pressEscape();

    expect(event.defaultPrevented).toBe(true);
    expect(result.current.mode).toBe("compact");
    expect(modeChanged).toHaveBeenCalledTimes(1);
  });

  it("clears the search query first when searching, without leaving search", () => {
    const { result } = renderHook(() => useDynamicIslandState());
    act(() => result.current.switchMode("search"));
    act(() => result.current.setSearchQuery("alpha"));
    modeChanged.mockClear();

    const event = pressEscape();

    expect(event.defaultPrevented).toBe(true);
    expect(result.current.searchQuery).toBe("");
    expect(result.current.mode).toBe("search");
    expect(modeChanged).not.toHaveBeenCalled();
  });
});
