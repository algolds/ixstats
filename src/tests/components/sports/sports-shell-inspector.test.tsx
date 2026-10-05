import React from "react";
import { act, render, screen } from "@testing-library/react";

const clearFocus = jest.fn();
jest.mock("~/components/sports/core/SportsFocusProvider", () => ({
  useSportsFocus: () => ({ focus: { type: "athlete", id: "a1" }, clearFocus }),
}));
jest.mock("~/components/sports/core/SportsFocusPanel", () => ({
  SportsFocusPanel: () => <p>focus panel</p>,
  sportsFocusTitle: () => "Athlete",
}));

import { SportsShell } from "~/components/sports/core/SportsShell";

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = originalMatchMedia;
  clearFocus.mockClear();
});

it("keeps the user's focus when the window widens past 1280px, now shown in the aside", () => {
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

  render(
    <SportsShell>
      <p>main</p>
    </SportsShell>
  );
  // Narrow with a focus: the sheet shows it.
  expect(screen.getByRole("dialog")).toHaveTextContent("focus panel");

  wide = true;
  act(() => listeners.forEach((fn) => fn()));
  expect(clearFocus).not.toHaveBeenCalled();
  expect(screen.getByRole("complementary", { name: "Athlete" })).toHaveTextContent("focus panel");
});
