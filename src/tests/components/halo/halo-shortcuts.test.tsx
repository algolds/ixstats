/** Halo global shortcuts: no stuck key lock, Tab keeps moving focus, Escape has one owner. */
import { act, fireEvent, render, renderHook } from "@testing-library/react";
import { useDynamicIslandState } from "~/components/halo/hooks";

const mockQuery = { data: undefined };
const mockUser = { user: null, isLoaded: true, isSignedIn: false };
const mockAuth = { signOut: jest.fn() };
const mockTheme = { toggleTheme: jest.fn(), toggleCompactMode: jest.fn() };
const mockSound = {};
const mockNotify = {};
let mockPlugin: unknown = null;

jest.mock("~/trpc/react", () => ({
  api: {
    countries: { getSelectList: { useQuery: () => mockQuery } },
    wikios: { advancedSearch: { useQuery: () => mockQuery } },
  },
}));
jest.mock("~/context/auth-context", () => ({
  useUser: () => mockUser,
  useAuth: () => mockAuth,
}));
jest.mock("~/context/theme-context", () => ({ useTheme: () => mockTheme }));
jest.mock("~/hooks/useSoundSettings", () => ({ useSoundSettings: () => mockSound }));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => mockNotify }));
jest.mock("~/hooks/usePermissions", () => ({ useCanOpenAdmin: () => false }));
jest.mock("next/navigation", () => ({ usePathname: () => "/" }));
jest.mock("~/components/halo/plugin-context", () => ({
  useActiveDIPlugin: () => mockPlugin,
}));

const wikiPlugin = { id: "wiki", expandedViews: { wiki: () => null } };

beforeEach(() => {
  jest.useFakeTimers();
  mockPlugin = null;
  document.body.innerHTML = "";
});

afterEach(() => {
  jest.useRealTimers();
});

function mountInput() {
  const input = document.createElement("input");
  document.body.appendChild(input);
  input.focus();
  return input;
}

describe("Halo shortcuts", () => {
  it("does not block typing after Ctrl+K", () => {
    const { result } = renderHook(() => useDynamicIslandState());
    act(() => {
      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    });
    expect(result.current.mode).toBe("search");
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    const input = mountInput();
    expect(fireEvent.keyDown(input, { key: "a" })).toBe(true);
  });

  it("does not block typing after Escape closes an open search", () => {
    const { result } = renderHook(() => useDynamicIslandState());
    act(() => {
      result.current.switchMode("search");
    });
    expect(result.current.mode).toBe("search");
    act(() => {
      fireEvent.keyDown(document.body, { key: "Escape" });
    });
    expect(result.current.mode).toBe("compact");
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    const input = mountInput();
    expect(fireEvent.keyDown(input, { key: "a" })).toBe(true);
  });

  it.each([{ shiftKey: false }, { shiftKey: true }])(
    "leaves Tab alone on a wiki page (%o)",
    ({ shiftKey }) => {
      mockPlugin = wikiPlugin;
      const { result } = renderHook(() => useDynamicIslandState());
      expect(result.current.mode).toBe("compact");
      let notPrevented = false;
      act(() => {
        notPrevented = fireEvent.keyDown(document.body, { key: "Tab", shiftKey });
      });
      expect(notPrevented).toBe(true);
      expect(result.current.mode).toBe("compact");
    }
  );

  it("leaves Tab alone in search mode when focus is on a button", () => {
    const { result } = renderHook(() => useDynamicIslandState());
    act(() => {
      result.current.switchMode("search");
    });
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    const before = result.current.searchFilter;
    let notPrevented = false;
    act(() => {
      notPrevented = fireEvent.keyDown(button, { key: "Tab" });
    });
    expect(notPrevented).toBe(true);
    expect(result.current.searchFilter).toBe(before);
  });

  it("ignores a held Ctrl+K", () => {
    const { result } = renderHook(() => useDynamicIslandState());
    act(() => {
      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    });
    expect(result.current.mode).toBe("search");
    act(() => {
      fireEvent.keyDown(window, { key: "k", ctrlKey: true, repeat: true });
    });
    expect(result.current.mode).toBe("search");
  });

  it("does not close Halo when a child handler already claimed Escape", () => {
    const { result } = renderHook(() => useDynamicIslandState());
    act(() => {
      result.current.switchMode("notifications");
    });
    const { getByTestId } = render(
      <div
        data-testid="row"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Escape") e.preventDefault();
        }}
      />
    );
    act(() => {
      fireEvent.keyDown(getByTestId("row"), { key: "Escape" });
    });
    expect(result.current.mode).toBe("notifications");
    act(() => {
      fireEvent.keyDown(document.body, { key: "Escape" });
    });
    expect(result.current.mode).toBe("compact");
  });
});
