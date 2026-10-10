import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { boardData } from "~/tests/helpers/realm-board-fixtures";

interface SelectStubProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

// Radix Select does not render its options in jsdom; swap in a native <select> named by its trigger.
jest.mock("~/components/ui/select", () => {
  const { createContext, useContext } = jest.requireActual<typeof React>("react");
  const Ctx = createContext<{
    value?: string;
    onValueChange?: (value: string) => void;
    label?: string;
  }>({});
  return {
    Select: ({ value, onValueChange, children }: SelectStubProps) => (
      <Ctx.Provider value={{ value, onValueChange }}>{children}</Ctx.Provider>
    ),
    SelectTrigger: ({ "aria-label": label }: { "aria-label"?: string }) => {
      const ctx = useContext(Ctx);
      ctx.label = label;
      return null;
    },
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => {
      const { value, onValueChange, label } = useContext(Ctx);
      return (
        <select aria-label={label} value={value} onChange={(e) => onValueChange?.(e.target.value)}>
          {children}
        </select>
      );
    },
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
      <option value={value}>{children}</option>
    ),
  };
});

jest.mock("~/trpc/react", () => {
  const state = {
    mutate: jest.fn(),
    cancel: jest.fn(() => Promise.resolve()),
    setData: jest.fn(),
  };
  return {
    state,
    api: {
      useUtils: () => ({
        thinkpagesForum: { getBoard: { cancel: state.cancel, setData: state.setData } },
      }),
      thinkpagesForum: {
        updateBoardSettings: {
          useMutation: () => ({ mutateAsync: state.mutate }),
        },
      },
    },
  };
});

import { BoardSettingsPanel } from "~/components/thinkpages-forum/realm/BoardSettingsPanel";

const { state } = jest.requireMock<{
  state: { mutate: jest.Mock; cancel: jest.Mock; setData: jest.Mock };
}>("~/trpc/react");

const settings = { visitorsAllowed: true, slowModeSeconds: 0 };

/** The updater handed to `setData`, applied to a cached board, as the cache would. */
function applied(call: number) {
  const updater = state.setData.mock.calls[call]![1] as (
    old: ReturnType<typeof boardData> | undefined
  ) => ReturnType<typeof boardData> | undefined;
  const old = boardData([], { realm: { ...boardData([]).realm, settings } });
  return updater(old)?.realm.settings;
}

beforeEach(() => {
  jest.clearAllMocks();
  state.mutate.mockImplementation(async (input: object) => ({ ...settings, ...input }));
});

function renderPanel(value = settings) {
  return render(<BoardSettingsPanel realmId="r_eurth" slug="eurth" settings={value} />);
}

describe("BoardSettingsPanel", () => {
  it("shows the visitors switch and the slow mode choice with their current values", () => {
    renderPanel({ visitorsAllowed: false, slowModeSeconds: 30 });
    expect(screen.getByRole("heading", { level: 2, name: "Board settings" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Visitors can post" })).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: "Slow mode" })).toHaveValue("30");
  });

  it("offers Off, 10s, 30s, 1m and 5m", () => {
    renderPanel();
    const options = screen
      .getAllByRole("option")
      .map((o) => [o.getAttribute("value"), o.textContent]);
    expect(options).toEqual([
      ["0", "Off"],
      ["10", "10s"],
      ["30", "30s"],
      ["60", "1m"],
      ["300", "5m"],
    ]);
  });

  it("turns visitors off at once and sends only that setting", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("switch", { name: "Visitors can post" }));
    await waitFor(() =>
      expect(state.mutate).toHaveBeenCalledWith({ realmId: "r_eurth", visitorsAllowed: false })
    );
    expect(state.cancel).toHaveBeenCalledWith({ realm: "eurth" });
    expect(state.setData.mock.calls[0]![0]).toEqual({ realm: "eurth" });
    expect(applied(0)).toEqual({ visitorsAllowed: false, slowModeSeconds: 0 });
  });

  it("sets slow mode as a number of seconds", async () => {
    renderPanel();
    fireEvent.change(screen.getByRole("combobox", { name: "Slow mode" }), {
      target: { value: "60" },
    });
    await waitFor(() =>
      expect(state.mutate).toHaveBeenCalledWith({ realmId: "r_eurth", slowModeSeconds: 60 })
    );
    expect(applied(0)).toEqual({ visitorsAllowed: true, slowModeSeconds: 60 });
  });

  it("puts the saved settings in the board once the server answers", async () => {
    state.mutate.mockResolvedValue({ visitorsAllowed: false, slowModeSeconds: 10 });
    renderPanel();
    fireEvent.click(screen.getByRole("switch", { name: "Visitors can post" }));
    await waitFor(() => expect(state.setData).toHaveBeenCalledTimes(2));
    expect(applied(1)).toEqual({ visitorsAllowed: false, slowModeSeconds: 10 });
  });

  it("puts the old value back and says why when the server refuses", async () => {
    state.mutate.mockRejectedValue(new Error("Only the realm's founder can change the settings."));
    renderPanel();
    fireEvent.click(screen.getByRole("switch", { name: "Visitors can post" }));
    expect(
      await screen.findByText("Only the realm's founder can change the settings.")
    ).toBeVisible();
    expect(state.setData).toHaveBeenCalledTimes(2);
    // The optimistic value first, then the rollback of that one setting only.
    expect(applied(0)).toEqual({ visitorsAllowed: false, slowModeSeconds: 0 });
    expect(applied(1)).toEqual({ visitorsAllowed: true, slowModeSeconds: 0 });
  });

  it("rolls back only the setting that failed", async () => {
    state.mutate.mockRejectedValue(new Error("No"));
    renderPanel({ visitorsAllowed: true, slowModeSeconds: 0 });
    fireEvent.change(screen.getByRole("combobox", { name: "Slow mode" }), {
      target: { value: "300" },
    });
    await screen.findByText("No");
    const updater = state.setData.mock.calls[1]![1] as (
      old: ReturnType<typeof boardData>
    ) => ReturnType<typeof boardData>;
    const mid = boardData([], {
      realm: {
        ...boardData([]).realm,
        settings: { visitorsAllowed: false, slowModeSeconds: 300 },
      },
    });
    expect(updater(mid).realm.settings).toEqual({ visitorsAllowed: false, slowModeSeconds: 0 });
  });

  it("clears an old error when the next change goes through", async () => {
    state.mutate.mockRejectedValueOnce(new Error("Try again"));
    renderPanel();
    fireEvent.click(screen.getByRole("switch", { name: "Visitors can post" }));
    await screen.findByText("Try again");
    await act(async () => {
      fireEvent.click(screen.getByRole("switch", { name: "Visitors can post" }));
    });
    expect(screen.queryByText("Try again")).toBeNull();
  });

  it("leaves a board that is not cached alone", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("switch", { name: "Visitors can post" }));
    await waitFor(() => expect(state.setData).toHaveBeenCalled());
    const updater = state.setData.mock.calls[0]![1] as (old: undefined) => unknown;
    expect(updater(undefined)).toBeUndefined();
  });
});
