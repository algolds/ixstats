/**
 * The executive console is URL-driven (?mode=executive) so the sidebar Overview link
 * (/mycountry, no param) always lands on home, and back/forward move between the two.
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

let mockSearch = "";
let mockPathname = "/mycountry";
const listeners = new Set<() => void>();
/** Like Next's useSearchParams: subscribers re-render when the URL changes. */
function setSearch(next: string) {
  mockSearch = next;
  act(() => listeners.forEach((l) => l()));
}

jest.mock("next/navigation", () => ({
  useSearchParams: () => {
    const search = React.useSyncExternalStore(
      (cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      () => mockSearch
    );
    return new URLSearchParams(search);
  },
  usePathname: () => mockPathname,
}));
jest.mock("~/components/mycountry/shared/primitives", () => ({
  useCountryData: () => ({ country: { id: "c1", name: "Testland" } }),
}));
jest.mock("~/context/theme-context", () => ({ useTheme: () => ({ compactMode: false }) }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn() }),
}));
jest.mock("~/components/mycountry/shell/headers/UnifiedGlassCommandBar", () => ({
  UnifiedGlassCommandBar: ({
    mode,
    onChangeMode,
    onDeclare,
  }: {
    mode: string;
    onChangeMode: (m: "home" | "executive") => void;
    onDeclare: () => void;
  }) => (
    <div>
      <span data-testid="bar-mode">{mode}</span>
      <button onClick={onDeclare}>declare</button>
      <button onClick={() => onChangeMode("home")}>go-home</button>
    </div>
  ),
}));
jest.mock("~/components/mycountry/shell/ExecutiveHome", () => ({
  ExecutiveHome: () => <div data-testid="home" />,
}));
jest.mock("~/components/mycountry/shell/ExecutiveConsole", () => ({
  ExecutiveConsole: ({ onDone }: { onDone: (msg?: string) => void }) => (
    <button data-testid="console" onClick={() => onDone()}>
      console
    </button>
  ),
}));
jest.mock("~/components/mycountry/shell/DomainSurface", () => ({
  DomainSurface: () => <div data-testid="domain" />,
}));
jest.mock("~/components/mycountry/shell/DrillSheets", () => ({ DrillSheets: () => null }));

import { CommandSurface } from "~/components/mycountry/shell/CommandSurface";

describe("CommandSurface executive mode", () => {
  let pushState: jest.SpyInstance;
  let replaceState: jest.SpyInstance;

  beforeEach(() => {
    mockSearch = "";
    mockPathname = "/mycountry";
    window.scrollTo = jest.fn();
    pushState = jest.spyOn(window.history, "pushState").mockImplementation(() => undefined);
    replaceState = jest.spyOn(window.history, "replaceState").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("shows home at /mycountry and the console at ?mode=executive", () => {
    render(<CommandSurface section="overview" />);
    expect(screen.getByTestId("home")).toBeInTheDocument();
    expect(screen.queryByTestId("console")).not.toBeInTheDocument();

    setSearch("mode=executive");
    expect(screen.getByTestId("console")).toBeInTheDocument();
    expect(screen.getByTestId("bar-mode")).toHaveTextContent("executive");
  });

  it("returns to home when the URL loses the param (sidebar Overview link)", () => {
    mockSearch = "mode=executive";
    render(<CommandSurface section="overview" />);
    expect(screen.getByTestId("console")).toBeInTheDocument();

    setSearch("");
    expect(screen.getByTestId("home")).toBeInTheDocument();
    expect(screen.queryByTestId("console")).not.toBeInTheDocument();
  });

  it("declaring pushes ?mode=executive onto the history", () => {
    render(<CommandSurface section="overview" />);
    fireEvent.click(screen.getByText("declare"));
    expect(pushState).toHaveBeenCalledWith(null, "", "/mycountry?mode=executive");
  });

  it("leaving the console clears the param", () => {
    mockSearch = "mode=executive";
    render(<CommandSurface section="overview" />);
    fireEvent.click(screen.getByText("go-home"));
    expect(pushState).toHaveBeenCalledWith(null, "", "/mycountry");
  });

  it("finishing a directive replaces the entry instead of stacking another", () => {
    mockSearch = "mode=executive";
    render(<CommandSurface section="overview" />);
    fireEvent.click(screen.getByTestId("console"));
    expect(replaceState).toHaveBeenCalledWith(null, "", "/mycountry");
    expect(pushState).not.toHaveBeenCalled();
  });

  it("always shows the console on the executive section", () => {
    mockPathname = "/mycountry/executive";
    render(<CommandSurface section="executive" />);
    expect(screen.getByTestId("console")).toBeInTheDocument();
  });
});
