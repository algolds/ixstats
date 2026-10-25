/**
 * Realm time D3: the odds screen shows the chance of taking ground and every band as ranges under intelligence
 * uncertainty, the factor breakdown and the preview, in sentence case; committing asks for a confirmation and sends
 * the chosen share of forces.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { oddsView, previewCampaign, resolveTheatre } from "~/lib/military/combat";
import { landSetup } from "~/tests/lib/military/combat/fixtures";

const setup = landSetup(2, { mode: "pvp", days: 10 });
const data = {
  mode: "strike" as const,
  target: { id: "npc", name: "Npcland" },
  commitment: 0.5,
  days: 3,
  theatre: resolveTheatre({ map: null, declared: { terrain: "rugged", riverLine: true } }),
  odds: oddsView(setup, 0.4, 0.3),
  preview: previewCampaign({ setup, sigma: 0.4, u: 0.3, seedHex: "ab12", runs: 200 }),
  intel: { relationStrength: 50, recon: false },
};

// The Radix slider measures its track.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

jest.mock("~/trpc/react", () => ({
  api: { security: { getCombatOdds: { useQuery: () => ({ data, isLoading: false, error: null }) } } },
}));

import { CombatOdds, formatRange } from "~/components/mycountry/domains/defense/operations/CombatOdds";
import { EngagementPlanner } from "~/components/mycountry/domains/defense/operations/EngagementPlanner";

it("shows the odds and every band as ranges, the theatre and the preview", () => {
  render(<CombatOdds data={data} />);
  expect(screen.getByText(/Chance of taking ground/)).toBeTruthy();
  expect(screen.getByText(formatRange(data.odds.success, (v) => `${Math.round(v * 100)}%`))).toBeTruthy();
  expect(screen.getByText("Breakthrough")).toBeTruthy();
  expect(screen.getByText("Repulsed with heavy loss")).toBeTruthy();
  expect(screen.getByText(/Rugged, mixed behind a river line, the defender's declared terrain/)).toBeTruthy();
  expect(screen.getByText("In 200 simulations")).toBeTruthy();
  expect(screen.getByText("Enemy strength (estimate)")).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/—/);
});

it("collapses a range narrower than its rounding to one figure", () => {
  expect(formatRange({ low: 0.611, estimate: 0.612, high: 0.613 }, (v) => `${Math.round(v * 100)}%`)).toBe("61%");
});

it("commits only after a confirmation, with the chosen share of forces", () => {
  const onCommit = jest.fn();
  render(
    <EngagementPlanner
      mode="strike"
      targetId="npc"
      commitLabel="Commit strike"
      pendingLabel="Striking…"
      confirmText="The strike is rolled once."
      pending={false}
      onCommit={onCommit}
    />
  );
  expect(screen.queryByRole("button", { name: "Commit strike" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Review and commit" }));
  expect(screen.getByText("The strike is rolled once.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Commit strike" }));
  expect(onCommit).toHaveBeenCalledWith(0.5);
});
