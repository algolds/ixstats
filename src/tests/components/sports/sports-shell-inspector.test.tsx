import React from "react";
import { act, render, screen } from "@testing-library/react";

const clearFocus = jest.fn();
let currentFocus: { type: string; id: string } | null = { type: "athlete", id: "a1" };
jest.mock("~/components/sports/core/SportsFocusProvider", () => ({
  useSportsFocus: () => ({ focus: currentFocus, clearFocus }),
}));
jest.mock("~/components/sports/core/SportsFocusPanel", () => ({
  SportsFocusPanel: () => <p>focus panel</p>,
  sportsFocusTitle: () => "Athlete",
}));

import { SportsShell } from "~/components/sports/core/SportsShell";

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  currentFocus = { type: "athlete", id: "a1" };
  window.matchMedia = originalMatchMedia;
  clearFocus.mockClear();
});

function controllableViewport() {
  const listeners = new Set<() => void>();
  let wide = false;
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query === "(min-width: 1280px)" ? wide : false;
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return {
    resize(next: boolean) {
      wide = next;
      act(() => listeners.forEach((fn) => fn()));
    },
  };
}

it("keeps the user's focus when the window widens past 1280px, now shown in the aside", () => {
  const viewport = controllableViewport();
  render(
    <SportsShell>
      <p>main</p>
    </SportsShell>
  );
  // Narrow with a focus: the sheet shows it.
  expect(screen.getByRole("dialog")).toHaveTextContent("focus panel");

  viewport.resize(true);
  expect(clearFocus).not.toHaveBeenCalled();
  expect(screen.getByRole("complementary", { name: "Athlete" })).toHaveTextContent("focus panel");
});

/** The page owns the controls sheet's flag, as the league and club routers do. */
function Page() {
  const [open, setOpen] = React.useState(true);
  return (
    <SportsShell
      sideContent={<p>controls</p>}
      sideTitle="Controls"
      sideOpen={open}
      onSideOpenChange={setOpen}
    >
      <p>main</p>
    </SportsShell>
  );
}

it("resets the controls sheet's UI flag on widening, so narrowing again keeps it closed", () => {
  currentFocus = null;
  const viewport = controllableViewport();
  render(<Page />);
  expect(screen.getByRole("dialog")).toHaveTextContent("controls");

  viewport.resize(true);
  expect(screen.queryByRole("dialog")).toBeNull();
  viewport.resize(false);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("leaves the focus alone while resetting the controls flag on widening", () => {
  const viewport = controllableViewport();
  render(<Page />);
  viewport.resize(true);
  viewport.resize(false);
  expect(clearFocus).not.toHaveBeenCalled();
  // The focus is still what the narrow sheet shows.
  expect(screen.getByRole("dialog")).toHaveTextContent("focus panel");
});
